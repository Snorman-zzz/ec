const { v4: uuidv4 } = require('uuid');
const db = require('../database/database');

class AnalyticsService {
    
    // Middleware to track all requests
    static trackingMiddleware() {
        return async (req, res, next) => {
            try {
                const sessionId = req.sessionId;
                const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
                const userAgent = req.get('User-Agent') || '';
                const referrer = req.get('Referer') || '';
                
                // Get or create visitor
                const visitorId = await AnalyticsService.getOrCreateVisitor({
                    sessionId,
                    ip,
                    userAgent,
                    referrer,
                    landingPage: req.originalUrl
                });

                req.visitorId = visitorId;
                
                // Track page view for main routes
                if (req.method === 'GET' && !req.originalUrl.startsWith('/api/')) {
                    await AnalyticsService.trackPageView({
                        visitorId,
                        sessionId,
                        pageUrl: req.originalUrl,
                        pageTitle: AnalyticsService.getPageTitle(req.originalUrl)
                    });
                }

                next();
            } catch (error) {
                console.error('Analytics tracking error:', error);
                next(); // Continue even if analytics fails
            }
        };
    }

    // Get or create visitor record
    static async getOrCreateVisitor({ sessionId, ip, userAgent, referrer, landingPage }) {
        try {
            // Check if visitor exists
            let visitor = await db.get('SELECT * FROM visitors WHERE session_id = ?', [sessionId]);
            
            if (visitor) {
                // Update last visit and increment visit count
                await db.run(
                    'UPDATE visitors SET last_visit = CURRENT_TIMESTAMP, total_visits = total_visits + 1 WHERE id = ?',
                    [visitor.id]
                );
                return visitor.id;
            } else {
                // Create new visitor
                const visitorId = uuidv4();
                const isBot = AnalyticsService.isBot(userAgent);
                
                await db.run(`
                    INSERT INTO visitors (
                        id, session_id, ip_address, user_agent, 
                        referrer, landing_page, is_bot
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [visitorId, sessionId, ip, userAgent, referrer, landingPage, isBot]);
                
                return visitorId;
            }
        } catch (error) {
            console.error('Error in getOrCreateVisitor:', error);
            return uuidv4(); // Return a temporary ID if database fails
        }
    }

    // Track page views
    static async trackPageView({ visitorId, sessionId, pageUrl, pageTitle }) {
        try {
            await db.run(`
                INSERT INTO page_views (id, visitor_id, session_id, page_url, page_title)
                VALUES (?, ?, ?, ?, ?)
            `, [uuidv4(), visitorId, sessionId, pageUrl, pageTitle]);
        } catch (error) {
            console.error('Error tracking page view:', error);
        }
    }

    // Track user events
    static async trackEvent({ 
        visitorId, 
        sessionId, 
        eventType, 
        eventCategory = null, 
        eventAction = null, 
        eventLabel = null, 
        eventValue = null, 
        pageUrl = null, 
        metadata = null 
    }) {
        try {
            await db.run(`
                INSERT INTO user_events (
                    id, visitor_id, session_id, event_type, event_category,
                    event_action, event_label, event_value, page_url, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                uuidv4(), visitorId, sessionId, eventType, eventCategory,
                eventAction, eventLabel, eventValue, pageUrl, 
                metadata ? JSON.stringify(metadata) : null
            ]);
        } catch (error) {
            console.error('Error tracking event:', error);
        }
    }

    // Track conversions
    static async trackConversion({ visitorId, sessionId, funnelStep, workspaceId = null }) {
        try {
            await db.run(`
                INSERT INTO conversions (id, visitor_id, session_id, funnel_step, workspace_id)
                VALUES (?, ?, ?, ?, ?)
            `, [uuidv4(), visitorId, sessionId, funnelStep, workspaceId]);
        } catch (error) {
            console.error('Error tracking conversion:', error);
        }
    }

    // Track feature usage
    static async trackFeatureUsage({ visitorId, featureName }) {
        try {
            // Check if feature usage exists
            const existing = await db.get(
                'SELECT * FROM feature_usage WHERE visitor_id = ? AND feature_name = ?',
                [visitorId, featureName]
            );

            if (existing) {
                // Update usage count and last used
                await db.run(`
                    UPDATE feature_usage 
                    SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [existing.id]);
            } else {
                // Create new feature usage record
                await db.run(`
                    INSERT INTO feature_usage (id, visitor_id, feature_name)
                    VALUES (?, ?, ?)
                `, [uuidv4(), visitorId, featureName]);
            }
        } catch (error) {
            console.error('Error tracking feature usage:', error);
        }
    }

    // Helper functions
    static getPageTitle(url) {
        const pageTitles = {
            '/': 'Home',
            '/calculator': 'Equity Calculator',
            '/report': 'Equity Report',
            '/dashboard': 'Analytics Dashboard'
        };
        return pageTitles[url] || 'Unknown Page';
    }

    static isBot(userAgent) {
        const botPatterns = [
            /bot/i, /crawler/i, /spider/i, /scraper/i, 
            /googlebot/i, /bingbot/i, /facebookexternalhit/i,
            /twitterbot/i, /linkedinbot/i, /slackbot/i
        ];
        return botPatterns.some(pattern => pattern.test(userAgent));
    }

    // Analytics queries
    static async getDailyStats(days = 30) {
        try {
            return await db.all(`
                SELECT 
                    DATE(first_visit) as date,
                    COUNT(DISTINCT id) as unique_visitors,
                    SUM(total_visits) as total_visits,
                    COUNT(CASE WHEN is_bot = 0 THEN 1 END) as human_visitors
                FROM visitors 
                WHERE first_visit >= datetime('now', '-${days} days')
                GROUP BY DATE(first_visit)
                ORDER BY date DESC
            `);
        } catch (error) {
            console.error('Error getting daily stats:', error);
            return [];
        }
    }

    static async getTopPages(limit = 10) {
        try {
            return await db.all(`
                SELECT 
                    page_url,
                    page_title,
                    COUNT(*) as views,
                    COUNT(DISTINCT visitor_id) as unique_visitors
                FROM page_views 
                WHERE timestamp >= datetime('now', '-30 days')
                GROUP BY page_url, page_title
                ORDER BY views DESC
                LIMIT ?
            `, [limit]);
        } catch (error) {
            console.error('Error getting top pages:', error);
            return [];
        }
    }

    static async getConversionFunnel() {
        try {
            return await db.all(`
                SELECT 
                    funnel_step,
                    COUNT(DISTINCT visitor_id) as users,
                    COUNT(*) as events
                FROM conversions 
                WHERE timestamp >= datetime('now', '-30 days')
                GROUP BY funnel_step
                ORDER BY 
                    CASE funnel_step
                        WHEN 'landing' THEN 1
                        WHEN 'started_calc' THEN 2
                        WHEN 'completed_calc' THEN 3
                        WHEN 'downloaded_report' THEN 4
                        ELSE 5
                    END
            `);
        } catch (error) {
            console.error('Error getting conversion funnel:', error);
            return [];
        }
    }

    static async getTopEvents(limit = 10) {
        try {
            return await db.all(`
                SELECT 
                    event_type,
                    event_action,
                    COUNT(*) as event_count,
                    COUNT(DISTINCT visitor_id) as unique_users
                FROM user_events 
                WHERE timestamp >= datetime('now', '-30 days')
                GROUP BY event_type, event_action
                ORDER BY event_count DESC
                LIMIT ?
            `, [limit]);
        } catch (error) {
            console.error('Error getting top events:', error);
            return [];
        }
    }

    static async getFeatureUsageStats() {
        try {
            return await db.all(`
                SELECT 
                    feature_name,
                    COUNT(DISTINCT visitor_id) as unique_users,
                    SUM(usage_count) as total_usage,
                    AVG(usage_count) as avg_usage_per_user
                FROM feature_usage 
                GROUP BY feature_name
                ORDER BY unique_users DESC
            `);
        } catch (error) {
            console.error('Error getting feature usage stats:', error);
            return [];
        }
    }
}

module.exports = AnalyticsService;
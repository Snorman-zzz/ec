const express = require('express');
const AnalyticsService = require('../middleware/analytics');
const router = express.Router();

// Event tracking endpoint
router.post('/event', async (req, res) => {
    try {
        const {
            eventType,
            eventCategory,
            eventAction,
            eventLabel,
            eventValue,
            pageUrl,
            metadata
        } = req.body;

        await AnalyticsService.trackEvent({
            visitorId: req.visitorId,
            sessionId: req.sessionId,
            eventType,
            eventCategory,
            eventAction,
            eventLabel,
            eventValue,
            pageUrl,
            metadata
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking event:', error);
        res.status(500).json({ error: 'Failed to track event' });
    }
});

// Conversion tracking endpoint
router.post('/conversion', async (req, res) => {
    try {
        const { funnelStep, workspaceId } = req.body;

        await AnalyticsService.trackConversion({
            visitorId: req.visitorId,
            sessionId: req.sessionId,
            funnelStep,
            workspaceId
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking conversion:', error);
        res.status(500).json({ error: 'Failed to track conversion' });
    }
});

// Feature usage tracking endpoint
router.post('/feature', async (req, res) => {
    try {
        const { featureName } = req.body;

        await AnalyticsService.trackFeatureUsage({
            visitorId: req.visitorId,
            featureName
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking feature usage:', error);
        res.status(500).json({ error: 'Failed to track feature usage' });
    }
});

// Analytics dashboard data
router.get('/stats/daily', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const stats = await AnalyticsService.getDailyStats(days);
        res.json(stats);
    } catch (error) {
        console.error('Error getting daily stats:', error);
        res.status(500).json({ error: 'Failed to get daily stats' });
    }
});

router.get('/stats/pages', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const pages = await AnalyticsService.getTopPages(limit);
        res.json(pages);
    } catch (error) {
        console.error('Error getting page stats:', error);
        res.status(500).json({ error: 'Failed to get page stats' });
    }
});

router.get('/stats/funnel', async (req, res) => {
    try {
        const funnel = await AnalyticsService.getConversionFunnel();
        res.json(funnel);
    } catch (error) {
        console.error('Error getting funnel stats:', error);
        res.status(500).json({ error: 'Failed to get funnel stats' });
    }
});

router.get('/stats/events', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const events = await AnalyticsService.getTopEvents(limit);
        res.json(events);
    } catch (error) {
        console.error('Error getting event stats:', error);
        res.status(500).json({ error: 'Failed to get event stats' });
    }
});

router.get('/stats/features', async (req, res) => {
    try {
        const features = await AnalyticsService.getFeatureUsageStats();
        res.json(features);
    } catch (error) {
        console.error('Error getting feature stats:', error);
        res.status(500).json({ error: 'Failed to get feature stats' });
    }
});

// Real-time stats
router.get('/stats/realtime', async (req, res) => {
    try {
        const db = require('../database/database');
        
        const [
            activeVisitors,
            todayStats,
            recentEvents
        ] = await Promise.all([
            // Active visitors (last 5 minutes)
            db.get(`
                SELECT COUNT(DISTINCT visitor_id) as count 
                FROM page_views 
                WHERE timestamp >= datetime('now', '-5 minutes')
            `),
            
            // Today's stats
            db.get(`
                SELECT 
                    COUNT(DISTINCT v.id) as unique_visitors,
                    SUM(v.total_visits) as total_visits,
                    COUNT(c.id) as conversions
                FROM visitors v
                LEFT JOIN conversions c ON v.id = c.visitor_id AND DATE(c.timestamp) = DATE('now')
                WHERE DATE(v.first_visit) = DATE('now')
            `),
            
            // Recent events (last hour)
            db.all(`
                SELECT event_type, event_action, COUNT(*) as count
                FROM user_events 
                WHERE timestamp >= datetime('now', '-1 hour')
                GROUP BY event_type, event_action
                ORDER BY count DESC
                LIMIT 5
            `)
        ]);

        res.json({
            activeVisitors: activeVisitors.count || 0,
            today: todayStats,
            recentEvents
        });
    } catch (error) {
        console.error('Error getting realtime stats:', error);
        res.status(500).json({ error: 'Failed to get realtime stats' });
    }
});

module.exports = router;
const express = require('express');
const db = require('../database/database');

const router = express.Router();

// Overview statistics
router.get('/overview', async (req, res) => {
    try {
        const [
            totalUsers,
            totalWorkspaces,
            completedWorkspaces,
            totalFounders,
            totalSessions,
            totalInvestment,
            totalHours,
            totalAssets
        ] = await Promise.all([
            db.get('SELECT COUNT(*) as count FROM users'),
            db.get('SELECT COUNT(*) as count FROM workspaces'),
            db.get('SELECT COUNT(*) as count FROM workspaces WHERE is_full_questionnaire_complete = 1'),
            db.get('SELECT COUNT(*) as count FROM founders f JOIN workspaces w ON f.workspace_id = w.id WHERE w.is_full_questionnaire_complete = 1'),
            db.get('SELECT COUNT(*) as count FROM sessions'),
            db.get('SELECT COALESCE(SUM(cash_invested), 0) as total FROM founders f JOIN workspaces w ON f.workspace_id = w.id WHERE w.is_full_questionnaire_complete = 1'),
            db.get('SELECT COALESCE(SUM(time_commitment), 0) as total FROM founders f JOIN workspaces w ON f.workspace_id = w.id WHERE w.is_full_questionnaire_complete = 1'),
            db.get('SELECT COALESCE(SUM(assets_contributed), 0) as total FROM founders f JOIN workspaces w ON f.workspace_id = w.id WHERE w.is_full_questionnaire_complete = 1')
        ]);

        const completionRate = totalWorkspaces.count > 0 ? 
            (completedWorkspaces.count / totalWorkspaces.count * 100).toFixed(1) : 0;

        res.json({
            totalUsers: totalUsers.count,
            totalWorkspaces: totalWorkspaces.count,
            completedWorkspaces: completedWorkspaces.count,
            completionRate: parseFloat(completionRate),
            totalFounders: totalFounders.count,
            totalSessions: totalSessions.count,
            totalInvestment: totalInvestment.total,
            totalHours: totalHours.total,
            totalAssets: totalAssets.total,
            avgTeamSize: totalFounders.count > 0 ? (totalFounders.count / completedWorkspaces.count).toFixed(1) : 0
        });
    } catch (error) {
        console.error('Analytics overview error:', error);
        res.status(500).json({ error: 'Failed to get overview analytics' });
    }
});

// Equity distribution analysis
router.get('/equity-distribution', async (req, res) => {
    try {
        const equityData = await db.all(`
            SELECT 
                w.company_name,
                w.name as workspace_name,
                f.name as founder_name,
                f.position,
                f.cash_invested,
                f.time_commitment,
                f.assets_contributed,
                ROUND(100.0 * f.cash_invested / NULLIF((SELECT SUM(cash_invested) FROM founders WHERE workspace_id = w.id), 0), 2) as cash_percentage,
                ROUND(100.0 * f.time_commitment / NULLIF((SELECT SUM(time_commitment) FROM founders WHERE workspace_id = w.id), 0), 2) as time_percentage,
                ROUND(100.0 * f.assets_contributed / NULLIF((SELECT SUM(assets_contributed) FROM founders WHERE workspace_id = w.id), 0), 2) as assets_percentage,
                ROUND(100.0 * (f.cash_invested + f.time_commitment*100 + f.assets_contributed) / 
                      NULLIF((SELECT SUM(cash_invested + time_commitment*100 + assets_contributed) FROM founders WHERE workspace_id = w.id), 0), 2) as total_equity_percentage
            FROM workspaces w
            JOIN founders f ON w.id = f.workspace_id
            WHERE w.is_full_questionnaire_complete = 1
            ORDER BY w.company_name, f.position
        `);

        res.json(equityData);
    } catch (error) {
        console.error('Equity distribution error:', error);
        res.status(500).json({ error: 'Failed to get equity distribution data' });
    }
});

// Factor analysis
router.get('/factors', async (req, res) => {
    try {
        const factorData = await db.all(`
            SELECT 
                factor_name,
                factor_type,
                COUNT(DISTINCT workspace_id) as companies_using,
                COUNT(*) as total_allocations,
                SUM(allocation) as total_points_allocated,
                ROUND(AVG(allocation), 2) as avg_points_per_allocation,
                MAX(allocation) as max_points_given
            FROM factors f
            JOIN workspaces w ON f.workspace_id = w.id
            WHERE w.is_full_questionnaire_complete = 1
            GROUP BY factor_name, factor_type
            ORDER BY total_points_allocated DESC
        `);

        // Factor type summary
        const factorTypeSummary = await db.all(`
            SELECT 
                factor_type,
                COUNT(DISTINCT workspace_id) as workspaces_using,
                SUM(allocation) as total_points,
                ROUND(AVG(allocation), 2) as avg_allocation
            FROM factors f
            JOIN workspaces w ON f.workspace_id = w.id
            WHERE w.is_full_questionnaire_complete = 1
            GROUP BY factor_type
            ORDER BY total_points DESC
        `);

        res.json({
            factors: factorData,
            factorTypes: factorTypeSummary
        });
    } catch (error) {
        console.error('Factor analysis error:', error);
        res.status(500).json({ error: 'Failed to get factor analysis data' });
    }
});

// Founder contribution patterns
router.get('/founder-patterns', async (req, res) => {
    try {
        const patterns = await db.all(`
            SELECT 
                CASE 
                    WHEN cash_invested > 0 AND time_commitment > 30 AND assets_contributed > 0 THEN 'Triple Contributor'
                    WHEN cash_invested > 0 AND time_commitment > 30 THEN 'Cash + Time Heavy'
                    WHEN cash_invested > 0 AND assets_contributed > 0 THEN 'Financial Contributor'
                    WHEN time_commitment > 30 AND assets_contributed > 0 THEN 'Time + Assets'
                    WHEN cash_invested > 0 THEN 'Cash Only'
                    WHEN time_commitment > 30 THEN 'Time Heavy'
                    WHEN assets_contributed > 0 THEN 'Assets Only'
                    ELSE 'Minimal Contributor'
                END as contributor_type,
                COUNT(*) as founder_count,
                ROUND(AVG(cash_invested), 2) as avg_cash,
                ROUND(AVG(time_commitment), 2) as avg_time,
                ROUND(AVG(assets_contributed), 2) as avg_assets
            FROM founders f
            JOIN workspaces w ON f.workspace_id = w.id
            WHERE w.is_full_questionnaire_complete = 1
            GROUP BY contributor_type
            ORDER BY founder_count DESC
        `);

        res.json(patterns);
    } catch (error) {
        console.error('Founder patterns error:', error);
        res.status(500).json({ error: 'Failed to get founder patterns data' });
    }
});

// Company size analysis
router.get('/company-size', async (req, res) => {
    try {
        const sizeData = await db.all(`
            SELECT 
                w.founding_team_size,
                COUNT(DISTINCT w.id) as companies,
                COUNT(*) as total_founders,
                ROUND(AVG(f.cash_invested), 2) as avg_cash_per_founder,
                ROUND(AVG(f.time_commitment), 2) as avg_time_per_founder,
                ROUND(AVG(f.assets_contributed), 2) as avg_assets_per_founder
            FROM workspaces w
            JOIN founders f ON w.id = f.workspace_id
            WHERE w.is_full_questionnaire_complete = 1
            GROUP BY w.founding_team_size
            ORDER BY w.founding_team_size
        `);

        res.json(sizeData);
    } catch (error) {
        console.error('Company size error:', error);
        res.status(500).json({ error: 'Failed to get company size data' });
    }
});

// Activity over time
router.get('/activity-timeline', async (req, res) => {
    try {
        const timelineData = await db.all(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as workspaces_created,
                COUNT(CASE WHEN is_full_questionnaire_complete = 1 THEN 1 END) as completed_same_day
            FROM workspaces 
            WHERE created_at >= DATE('now', '-30 days')
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `);

        res.json(timelineData);
    } catch (error) {
        console.error('Activity timeline error:', error);
        res.status(500).json({ error: 'Failed to get activity timeline data' });
    }
});

// Equity split patterns - simplified for reliability
router.get('/equity-splits', async (req, res) => {
    try {
        const splitPatterns = await db.all(`
            SELECT 
                w.company_name,
                w.name as workspace_name,
                COUNT(f.id) as founder_count,
                SUM(f.cash_invested + f.time_commitment*100 + f.assets_contributed) as total_contribution,
                GROUP_CONCAT(f.name || ': $' || (f.cash_invested + f.time_commitment*100 + f.assets_contributed)) as contribution_breakdown
            FROM workspaces w
            JOIN founders f ON w.id = f.workspace_id
            WHERE w.is_full_questionnaire_complete = 1
            GROUP BY w.id, w.company_name, w.name
            HAVING COUNT(f.id) >= 2
            ORDER BY founder_count DESC, total_contribution DESC
        `);

        res.json(splitPatterns);
    } catch (error) {
        console.error('Equity splits error:', error);
        res.status(500).json({ error: 'Failed to get equity splits data' });
    }
});

// Custom SQL query endpoint for console
router.post('/custom-query', async (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query is required and must be a string' });
        }

        // Security: Only allow SELECT statements and basic operations
        const trimmedQuery = query.trim().toUpperCase();
        const allowedPrefixes = ['SELECT', 'WITH'];
        const isAllowed = allowedPrefixes.some(prefix => trimmedQuery.startsWith(prefix));
        
        if (!isAllowed) {
            return res.status(403).json({ 
                error: 'Only SELECT and WITH queries are allowed for security reasons' 
            });
        }

        // Block potentially dangerous keywords
        const blockedKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'PRAGMA'];
        const hasBlockedKeyword = blockedKeywords.some(keyword => 
            trimmedQuery.includes(keyword)
        );
        
        if (hasBlockedKeyword) {
            return res.status(403).json({ 
                error: 'Query contains prohibited keywords. Only SELECT operations are allowed.' 
            });
        }

        // Execute the query
        const result = await db.all(query);
        res.json(result);
        
    } catch (error) {
        console.error('Custom query error:', error);
        res.status(500).json({ 
            error: 'Query execution failed: ' + error.message 
        });
    }
});

// Equity distribution ranges for infographics
router.get('/equity-ranges', async (req, res) => {
    try {
        const ranges = await db.all(`
            WITH equity_calcs AS (
                SELECT 
                    f.name as founder_name,
                    w.company_name,
                    ROUND(100.0 * (f.cash_invested + f.time_commitment*100 + f.assets_contributed) / 
                          NULLIF((SELECT SUM(cash_invested + time_commitment*100 + assets_contributed) 
                                 FROM founders WHERE workspace_id = w.id), 0), 1) as equity_percentage
                FROM workspaces w
                JOIN founders f ON w.id = f.workspace_id
                WHERE w.is_full_questionnaire_complete = 1
                AND f.cash_invested + f.time_commitment*100 + f.assets_contributed > 0
            )
            SELECT 
                CASE 
                    WHEN equity_percentage >= 90 THEN '90-100%'
                    WHEN equity_percentage >= 70 THEN '70-89%'
                    WHEN equity_percentage >= 50 THEN '50-69%'
                    WHEN equity_percentage >= 30 THEN '30-49%'
                    WHEN equity_percentage >= 10 THEN '10-29%'
                    ELSE '0-9%'
                END as range,
                COUNT(*) as count,
                ROUND(AVG(equity_percentage), 1) as avg_percentage
            FROM equity_calcs
            WHERE equity_percentage IS NOT NULL
            GROUP BY range
            ORDER BY avg_percentage DESC
        `);

        res.json(ranges);
    } catch (error) {
        console.error('Equity ranges error:', error);
        res.status(500).json({ error: 'Failed to get equity ranges data' });
    }
});

// Simplified factors endpoint for console
router.get('/factors-simple', async (req, res) => {
    try {
        const factors = await db.all(`
            SELECT 
                factor_name as factor,
                COUNT(*) as usage_count,
                ROUND(AVG(allocation), 2) as avg_weight,
                SUM(allocation) as total_weight
            FROM factors f
            JOIN workspaces w ON f.workspace_id = w.id
            WHERE w.is_full_questionnaire_complete = 1
            GROUP BY factor_name
            ORDER BY usage_count DESC, total_weight DESC
            LIMIT 10
        `);

        res.json(factors);
    } catch (error) {
        console.error('Simple factors error:', error);
        res.status(500).json({ error: 'Failed to get factors data' });
    }
});

module.exports = router;
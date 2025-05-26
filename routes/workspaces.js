const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/database');

const router = express.Router();

// Get all workspaces (for export functionality)
router.get('/all', async (req, res) => {
    try {
        const workspaces = await db.all(`
            SELECT 
                w.*,
                u.created_at as user_created_at,
                COUNT(f.id) as founder_count,
                COUNT(vq.id) as questions_answered
            FROM workspaces w
            LEFT JOIN users u ON w.user_id = u.id
            LEFT JOIN founders f ON w.id = f.workspace_id
            LEFT JOIN visited_questions vq ON w.id = vq.workspace_id
            GROUP BY w.id
            ORDER BY w.created_at DESC
        `);

        res.json({ workspaces });
    } catch (error) {
        console.error('Error getting all workspaces:', error);
        res.status(500).json({ error: 'Failed to get all workspaces' });
    }
});

// Get all workspaces for a user
router.get('/', async (req, res) => {
    try {
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        const workspaces = await db.all(
            'SELECT * FROM workspaces WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );

        // Get additional data for each workspace
        const workspacesWithData = await Promise.all(
            workspaces.map(async (workspace) => {
                const [founders, reservedPools, ratings, factors, adjustments, visitedQuestions] = await Promise.all([
                    db.all('SELECT * FROM founders WHERE workspace_id = ? ORDER BY position', [workspace.id]),
                    db.all('SELECT * FROM reserved_pools WHERE workspace_id = ?', [workspace.id]),
                    db.get('SELECT * FROM ratings WHERE workspace_id = ?', [workspace.id]),
                    db.all('SELECT * FROM factors WHERE workspace_id = ?', [workspace.id]),
                    db.all('SELECT * FROM equity_adjustments WHERE workspace_id = ?', [workspace.id]),
                    db.all('SELECT * FROM visited_questions WHERE workspace_id = ?', [workspace.id])
                ]);

                return {
                    ...workspace,
                    founders,
                    reservedPools,
                    ratings: ratings || {},
                    factors,
                    adjustments,
                    visitedQuestions
                };
            })
        );

        res.json({ workspaces: workspacesWithData });
    } catch (error) {
        console.error('Error getting workspaces:', error);
        res.status(500).json({ error: 'Failed to get workspaces' });
    }
});

// Get specific workspace
router.get('/:workspaceId', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        
        const workspace = await db.get('SELECT * FROM workspaces WHERE id = ?', [workspaceId]);
        if (!workspace) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        // Get all related data
        const [founders, reservedPools, ratings, factors, adjustments, visitedQuestions] = await Promise.all([
            db.all('SELECT * FROM founders WHERE workspace_id = ? ORDER BY position', [workspaceId]),
            db.all('SELECT * FROM reserved_pools WHERE workspace_id = ?', [workspaceId]),
            db.get('SELECT * FROM ratings WHERE workspace_id = ?', [workspaceId]),
            db.all('SELECT * FROM factors WHERE workspace_id = ?', [workspaceId]),
            db.all('SELECT * FROM equity_adjustments WHERE workspace_id = ?', [workspaceId]),
            db.all('SELECT * FROM visited_questions WHERE workspace_id = ?', [workspaceId])
        ]);

        const workspaceData = {
            ...workspace,
            founders,
            reservedPools,
            ratings: ratings || {},
            factors,
            adjustments,
            visitedQuestions
        };

        res.json({ workspace: workspaceData });
    } catch (error) {
        console.error('Error getting workspace:', error);
        res.status(500).json({ error: 'Failed to get workspace' });
    }
});

// Create new workspace
router.post('/',
    [
        body('userId').notEmpty().withMessage('userId is required'),
        body('name').notEmpty().withMessage('Workspace name is required'),
        body('companyName').optional().isString()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { userId, name, companyName = '' } = req.body;
            const workspaceId = uuidv4();

            await db.run(
                'INSERT INTO workspaces (id, user_id, name, company_name) VALUES (?, ?, ?, ?)',
                [workspaceId, userId, name, companyName]
            );

            // Create default ratings entry
            await db.run(
                'INSERT INTO ratings (id, workspace_id) VALUES (?, ?)',
                [uuidv4(), workspaceId]
            );

            const workspace = await db.get('SELECT * FROM workspaces WHERE id = ?', [workspaceId]);
            res.status(201).json({ workspace });
        } catch (error) {
            console.error('Error creating workspace:', error);
            res.status(500).json({ error: 'Failed to create workspace' });
        }
    }
);

// Update workspace
router.put('/:workspaceId', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const workspaceData = req.body;

        // Check if workspace exists
        const existingWorkspace = await db.get('SELECT * FROM workspaces WHERE id = ?', [workspaceId]);
        if (!existingWorkspace) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        // Begin transaction-like operations
        try {
            // Update basic workspace info
            await db.run(
                `UPDATE workspaces SET 
                    name = ?, 
                    company_name = ?, 
                    founding_team_size = ?, 
                    is_full_questionnaire_complete = ?,
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?`,
                [
                    workspaceData.name || existingWorkspace.name,
                    workspaceData.companyName || '',
                    workspaceData.foundingTeamSize || 0,
                    workspaceData.isFullQuestionnaireComplete || false,
                    workspaceId
                ]
            );

            // Clear and re-insert founders
            if (workspaceData.founders) {
                await db.run('DELETE FROM founders WHERE workspace_id = ?', [workspaceId]);
                
                for (let i = 0; i < workspaceData.founders.length; i++) {
                    const founder = workspaceData.founders[i];
                    await db.run(
                        'INSERT INTO founders (id, workspace_id, name, position, cash_invested, time_commitment, assets_contributed) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [
                            uuidv4(),
                            workspaceId,
                            founder,
                            i,
                            workspaceData.foundersCashInvested?.[founder] || 0,
                            workspaceData.foundersTime?.[founder] || 0,
                            workspaceData.foundersAssets?.[founder] || 0
                        ]
                    );
                }
            }

            // Update reserved pools
            if (workspaceData.reservedPools) {
                await db.run('DELETE FROM reserved_pools WHERE workspace_id = ?', [workspaceId]);
                
                for (const pool of workspaceData.reservedPools) {
                    // Only insert if poolName exists, is not empty, and is not just whitespace
                    if (pool && pool.poolName && typeof pool.poolName === 'string' && pool.poolName.trim().length > 0) {
                        await db.run(
                            'INSERT INTO reserved_pools (id, workspace_id, pool_name, weight) VALUES (?, ?, ?, ?)',
                            [uuidv4(), workspaceId, pool.poolName.trim(), pool.weight || 0]
                        );
                    }
                }
            }

            // Update ratings
            if (workspaceData.ratings) {
                await db.run(
                    `UPDATE ratings SET 
                        rating_financial_impact = ?, 
                        rating_time_importance = ?, 
                        rating_asset_importance = ?,
                        updated_at = CURRENT_TIMESTAMP 
                    WHERE workspace_id = ?`,
                    [
                        workspaceData.ratings.ratingFinancialImpact || 3,
                        workspaceData.ratings.ratingTimeImportance || 3,
                        workspaceData.ratings.ratingAssetImportance || 3,
                        workspaceId
                    ]
                );
            }

            // Update equity adjustments
            if (workspaceData.equityDistributionAdjustment) {
                await db.run('DELETE FROM equity_adjustments WHERE workspace_id = ?', [workspaceId]);
                
                for (const [category, weight] of Object.entries(workspaceData.equityDistributionAdjustment)) {
                    await db.run(
                        'INSERT INTO equity_adjustments (id, workspace_id, category, weight) VALUES (?, ?, ?, ?)',
                        [uuidv4(), workspaceId, category, weight]
                    );
                }
            }

            // Update factors
            const factorTypes = ['coreFactors', 'preFormation', 'roleResponsibility', 'experienceNetworks'];
            for (const factorType of factorTypes) {
                if (workspaceData[factorType]) {
                    await db.run('DELETE FROM factors WHERE workspace_id = ? AND factor_type = ?', [workspaceId, factorType]);
                    
                    for (const factor of workspaceData[factorType]) {
                        for (const [founderName, allocation] of Object.entries(factor.allocations || {})) {
                            if (allocation && parseFloat(allocation) > 0) {
                                await db.run(
                                    'INSERT INTO factors (id, workspace_id, factor_type, factor_name, founder_name, allocation) VALUES (?, ?, ?, ?, ?, ?)',
                                    [uuidv4(), workspaceId, factorType, factor.factorName, founderName, parseFloat(allocation)]
                                );
                            }
                        }
                    }
                }
            }

            // Update visited questions using UPSERT to avoid constraint violations
            const visitedTypes = [
                { key: 'visitedQuestionsPart1', part: 1 },
                { key: 'visitedQuestionsPart2', part: 2 }
            ];

            for (const { key, part } of visitedTypes) {
                if (workspaceData[key]) {
                    for (const [questionIndex, visited] of Object.entries(workspaceData[key])) {
                        if (visited) {
                            // First try to find existing record
                            const existingRecord = await db.get(
                                'SELECT id FROM visited_questions WHERE workspace_id = ? AND question_part = ? AND question_index = ?',
                                [workspaceId, part, parseInt(questionIndex)]
                            );
                            
                            if (existingRecord) {
                                // Update existing record
                                await db.run(
                                    'UPDATE visited_questions SET visited = ? WHERE id = ?',
                                    [true, existingRecord.id]
                                );
                            } else {
                                // Insert new record
                                await db.run(
                                    'INSERT INTO visited_questions (id, workspace_id, question_part, question_index, visited) VALUES (?, ?, ?, ?, ?)',
                                    [uuidv4(), workspaceId, part, parseInt(questionIndex), true]
                                );
                            }
                        }
                    }
                }
            }

            // Get updated workspace with all data
            const [workspace, founders, reservedPools, ratings, factors, adjustments, visitedQuestions] = await Promise.all([
                db.get('SELECT * FROM workspaces WHERE id = ?', [workspaceId]),
                db.all('SELECT * FROM founders WHERE workspace_id = ? ORDER BY position', [workspaceId]),
                db.all('SELECT * FROM reserved_pools WHERE workspace_id = ?', [workspaceId]),
                db.get('SELECT * FROM ratings WHERE workspace_id = ?', [workspaceId]),
                db.all('SELECT * FROM factors WHERE workspace_id = ?', [workspaceId]),
                db.all('SELECT * FROM equity_adjustments WHERE workspace_id = ?', [workspaceId]),
                db.all('SELECT * FROM visited_questions WHERE workspace_id = ?', [workspaceId])
            ]);

            const updatedWorkspace = {
                ...workspace,
                founders,
                reservedPools,
                ratings: ratings || {},
                factors,
                adjustments,
                visitedQuestions
            };

            res.json({ workspace: updatedWorkspace });

        } catch (innerError) {
            console.error('Error in workspace update transaction:', innerError);
            throw innerError;
        }

    } catch (error) {
        console.error('Error updating workspace:', error);
        res.status(500).json({ error: 'Failed to update workspace' });
    }
});

// Delete workspace
router.delete('/:workspaceId', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        
        const result = await db.run('DELETE FROM workspaces WHERE id = ?', [workspaceId]);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        res.json({ message: 'Workspace deleted successfully' });
    } catch (error) {
        console.error('Error deleting workspace:', error);
        res.status(500).json({ error: 'Failed to delete workspace' });
    }
});

module.exports = router;
const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/database');

const router = express.Router();

// Get or create user by session
router.post('/session', 
    [
        body('email').optional().isEmail().withMessage('Invalid email format')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { email } = req.body;
            const sessionId = req.sessionId;
            
            let user;
            
            if (email) {
                // Try to find existing user by email
                user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
                
                if (!user) {
                    // Create new user with email
                    const userId = uuidv4();
                    await db.run(
                        'INSERT INTO users (id, email) VALUES (?, ?)',
                        [userId, email]
                    );
                    user = { id: userId, email, created_at: new Date().toISOString() };
                }
            } else {
                // Anonymous session - check if session exists
                const session = await db.get('SELECT * FROM sessions WHERE id = ?', [sessionId]);
                
                if (!session) {
                    // Create anonymous user and session
                    const userId = uuidv4();
                    await db.run('INSERT INTO users (id) VALUES (?)', [userId]);
                    
                    await db.run(
                        'INSERT INTO sessions (id, user_id, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, datetime("now", "+30 days"))',
                        [sessionId, userId, req.ip, req.get('User-Agent')]
                    );
                    
                    user = { id: userId, created_at: new Date().toISOString() };
                } else {
                    user = await db.get('SELECT * FROM users WHERE id = ?', [session.user_id]);
                }
            }

            res.json({ user, sessionId });
        } catch (error) {
            console.error('Error in user session:', error);
            res.status(500).json({ error: 'Failed to handle user session' });
        }
    }
);

// Update user email
router.patch('/:userId', 
    [
        body('email').isEmail().withMessage('Valid email is required')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { userId } = req.params;
            const { email } = req.body;

            // Check if email already exists for another user
            const existingUser = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
            if (existingUser) {
                return res.status(409).json({ error: 'Email already exists' });
            }

            await db.run(
                'UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [email, userId]
            );

            const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
            res.json({ user });
        } catch (error) {
            console.error('Error updating user:', error);
            res.status(500).json({ error: 'Failed to update user' });
        }
    }
);

// Get user profile
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

module.exports = router;
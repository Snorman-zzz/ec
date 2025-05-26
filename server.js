require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { v4: uuidv4 } = require('uuid');

const db = require('./database/database');
const workspaceRoutes = require('./routes/workspaces');
const userRoutes = require('./routes/users');
const analyticsRoutes = require('./routes/analytics');
const trackingRoutes = require('./routes/tracking');
const AnalyticsService = require('./middleware/analytics');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware with CSP for console
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            fontSrc: ["'self'"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"]
        }
    }
}));
app.use(compression());

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl requests)
        if (!origin) return callback(null, true);
        
        // Allow all origins for now (development)
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID']
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Manual CORS headers as backup
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Session-ID');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Generate or get session ID
app.use((req, res, next) => {
    let sessionId = req.headers['x-session-id'];
    if (!sessionId) {
        sessionId = uuidv4();
        res.setHeader('x-session-id', sessionId);
    }
    req.sessionId = sessionId;
    next();
});

// Analytics tracking middleware
app.use(AnalyticsService.trackingMiddleware());

// Static files (for dashboard)
app.use('/dashboard', express.static('public'));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/tracking', trackingRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// CORS debug endpoint
app.get('/api/cors-test', (req, res) => {
    res.json({ 
        message: 'CORS test successful',
        origin: req.headers.origin,
        timestamp: new Date().toISOString()
    });
});

// Admin endpoint to view database stats (development only)
app.get('/api/admin/stats', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Admin endpoints disabled in production' });
    }
    
    try {
        const [users, workspaces, sessions, founders, visitedQuestions, reservedPools] = await Promise.all([
            db.all('SELECT COUNT(*) as count FROM users'),
            db.all('SELECT COUNT(*) as count FROM workspaces'), 
            db.all('SELECT COUNT(*) as count FROM sessions'),
            db.all('SELECT COUNT(*) as count FROM founders'),
            db.all('SELECT COUNT(*) as count FROM visited_questions'),
            db.all('SELECT COUNT(*) as count FROM reserved_pools')
        ]);

        res.json({
            stats: {
                users: users[0].count,
                workspaces: workspaces[0].count,
                sessions: sessions[0].count,
                founders: founders[0].count,
                visitedQuestions: visitedQuestions[0].count,
                reservedPools: reservedPools[0].count
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Admin endpoint to view recent workspaces (development only)
app.get('/api/admin/workspaces', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Admin endpoints disabled in production' });
    }
    
    try {
        const workspaces = await db.all(`
            SELECT w.*, u.created_at as user_created_at,
                   (SELECT COUNT(*) FROM founders WHERE workspace_id = w.id) as founder_count,
                   (SELECT COUNT(*) FROM visited_questions WHERE workspace_id = w.id) as questions_answered
            FROM workspaces w 
            LEFT JOIN users u ON w.user_id = u.id 
            ORDER BY w.created_at DESC 
            LIMIT 10
        `);

        res.json({ workspaces });
    } catch (error) {
        console.error('Admin workspaces error:', error);
        res.status(500).json({ error: 'Failed to get workspaces' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await db.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    await db.close();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('CORS enabled for all origins');
    console.log('Version: 1.0.1 - CORS Fix Applied');
    console.log('Manual CORS headers added for equity-calculator.com');
});

module.exports = app;
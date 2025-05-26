const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5003;

// Enable CORS for all origins
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
}));

// Proxy all requests to the main Railway backend
app.use('/api/*', async (req, res) => {
    try {
        const backendUrl = `https://lucid-alignment-production.up.railway.app${req.originalUrl}`;
        console.log(`Proxying: ${req.method} ${backendUrl}`);
        
        const fetch = await import('node-fetch').then(m => m.default);
        const response = await fetch(backendUrl, {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
                ...req.headers
            },
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
        });
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: 'Proxy failed' });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'CORS proxy running', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`CORS proxy running on port ${PORT}`);
    console.log('Proxying requests to Railway backend with CORS enabled');
});
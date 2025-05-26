#!/bin/bash

# Deploy script for dashboard only
echo "🚀 Starting dashboard deployment..."

# Create deployment directory
mkdir -p dashboard-deploy
cd dashboard-deploy

# Copy only essential files
cp ../public/dashboard.html index.html
cp ../package.json .
cp ../.env .

# Create minimal server for dashboard
cat > server.js << 'EOF'
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5001;

// Serve static files
app.use(express.static(__dirname));

// Dashboard route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Dashboard running on port ${PORT}`);
});
EOF

# Update package.json for dashboard only
cat > package.json << 'EOF'
{
  "name": "equity-dashboard",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF

echo "✅ Dashboard deployment files created in dashboard-deploy/"
echo "📋 Next steps:"
echo "   cd dashboard-deploy"
echo "   npm install"
echo "   npm start"
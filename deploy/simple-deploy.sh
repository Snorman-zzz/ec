#!/bin/bash

# Simple deployment script for cloud platforms
set -e

echo "🚀 Preparing for deployment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the backend directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Run database migration
echo "🗄️ Setting up database..."
node -e "const db = require('./database/database'); console.log('Database initialized');"

echo "✅ Preparation complete!"
echo ""
echo "🌐 Ready for deployment to:"
echo ""
echo "1. Railway.app (Recommended - easiest):"
echo "   npm install -g @railway/cli"
echo "   railway login"
echo "   railway deploy"
echo ""
echo "2. Render.com:"
echo "   - Connect your GitHub repo"
echo "   - Set build command: npm install"
echo "   - Set start command: npm start"
echo "   - Set environment: NODE_ENV=production"
echo ""
echo "3. Heroku:"
echo "   npm install -g heroku"
echo "   heroku create your-app-name"
echo "   git push heroku main"
echo ""
echo "4. Vercel:"
echo "   npm install -g vercel"
echo "   vercel --prod"
echo ""
echo "📊 After deployment, your services will be available at:"
echo "   - Health check: https://your-domain/api/health"
echo "   - Analytics dashboard: https://your-domain/dashboard/dashboard.html"
echo "   - User tracking: https://your-domain/api/tracking/stats/realtime"
echo ""
echo "🔧 Environment variables to set in your cloud platform:"
echo "   NODE_ENV=production"
echo "   PORT=5001 (or use platform default)"
echo ""
echo "📈 Your app will automatically track:"
echo "   ✓ Every visitor and page view"
echo "   ✓ User interactions and clicks"
echo "   ✓ Conversion funnel progression"
echo "   ✓ Feature usage analytics"
echo "   ✓ Real-time visitor statistics"
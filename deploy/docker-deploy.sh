#!/bin/bash

# Universal Docker Deployment Script
set -e

echo "🚀 Building Docker container..."

# Build the Docker image
docker build -t equity-calculator-backend .

echo "✅ Docker image built successfully!"
echo ""
echo "🔧 Available deployment options:"
echo ""
echo "1. Local deployment:"
echo "   docker run -p 5001:5001 -v equity_data:/app/data equity-calculator-backend"
echo ""
echo "2. Docker Compose:"
echo "   docker-compose up -d"
echo ""
echo "3. Push to registry for cloud deployment:"
echo "   # Tag for your registry"
echo "   docker tag equity-calculator-backend YOUR_REGISTRY/equity-calculator:latest"
echo "   docker push YOUR_REGISTRY/equity-calculator:latest"
echo ""
echo "4. Deploy to specific clouds:"
echo ""
echo "   Google Cloud Run:"
echo "   gcloud run deploy equity-calculator-backend \\"
echo "     --image gcr.io/YOUR_PROJECT/equity-calculator:latest \\"
echo "     --platform managed \\"
echo "     --region us-central1 \\"
echo "     --allow-unauthenticated \\"
echo "     --port 5001"
echo ""
echo "   Azure Container Instances:"
echo "   az container create \\"
echo "     --resource-group your-rg \\"
echo "     --name equity-calculator \\"
echo "     --image your-registry.azurecr.io/equity-calculator:latest \\"
echo "     --ports 5001"
echo ""
echo "   AWS ECS:"
echo "   # Use the task definition in deploy/aws-task-definition.json"
echo ""
echo "📊 After deployment, access:"
echo "   - API: http://your-domain:5001/api/health"
echo "   - Dashboard: http://your-domain:5001/dashboard/dashboard.html"
echo "   - Analytics: http://your-domain:5001/api/tracking/stats/realtime"
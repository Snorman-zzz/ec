#!/bin/bash

# Google Cloud Platform Deployment Script
set -e

echo "🚀 Deploying to Google Cloud Run..."

# Set your project ID
PROJECT_ID=${1:-"your-project-id"}
SERVICE_NAME="equity-calculator-backend"
REGION="us-central1"
GCLOUD_PATH="/Users/yuan/google-cloud-sdk/bin/gcloud"

# Use full path to gcloud
echo "📦 Building and deploying..."

# Deploy to Cloud Run
$GCLOUD_PATH run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 5001 \
  --memory 2Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 100 \
  --set-env-vars NODE_ENV=production,PORT=5001 \
  --timeout 3600

# Get the service URL
SERVICE_URL=$($GCLOUD_PATH run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo "✅ Deployment successful!"
echo "🌐 Service URL: $SERVICE_URL"
echo "📊 Analytics Dashboard: $SERVICE_URL/dashboard/dashboard.html"
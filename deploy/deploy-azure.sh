#!/bin/bash

# Azure Deployment Script
set -e

echo "🚀 Deploying to Azure Container Instances..."

RESOURCE_GROUP=${1:-"equity-calculator-rg"}
CONTAINER_NAME="equity-calculator-backend"
LOCATION="eastus"
REGISTRY_NAME=${2:-"equitycalculatorregistry"}

echo "📦 Creating resource group..."
az group create --name $RESOURCE_GROUP --location $LOCATION

echo "🏗️ Creating container registry..."
az acr create --resource-group $RESOURCE_GROUP --name $REGISTRY_NAME --sku Basic --admin-enabled true

echo "📦 Building container image..."
az acr build --registry $REGISTRY_NAME --image equity-calculator:latest .

echo "🚀 Deploying container..."
az container create \
  --resource-group $RESOURCE_GROUP \
  --name $CONTAINER_NAME \
  --image $REGISTRY_NAME.azurecr.io/equity-calculator:latest \
  --registry-login-server $REGISTRY_NAME.azurecr.io \
  --registry-username $REGISTRY_NAME \
  --registry-password $(az acr credential show --name $REGISTRY_NAME --query "passwords[0].value" --output tsv) \
  --dns-name-label equity-calculator-backend \
  --ports 5001 \
  --memory 2 \
  --cpu 1 \
  --environment-variables NODE_ENV=production PORT=5001

# Get the FQDN
FQDN=$(az container show --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME --query ipAddress.fqdn --output tsv)

echo "✅ Deployment successful!"
echo "🌐 Service URL: http://$FQDN:5001"
echo "📊 Analytics Dashboard: http://$FQDN:5001/dashboard/dashboard.html"
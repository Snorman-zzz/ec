#!/bin/bash

# AWS ECS Fargate Deployment Script
set -e

echo "🚀 Deploying to AWS ECS Fargate..."

CLUSTER_NAME="equity-calculator-cluster"
SERVICE_NAME="equity-calculator-backend"
TASK_FAMILY="equity-calculator-task"
REGION=${1:-"us-east-1"}

echo "📦 Creating ECS cluster..."
aws ecs create-cluster --cluster-name $CLUSTER_NAME --region $REGION

echo "🏗️ Building and pushing to ECR..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/equity-calculator"

# Create ECR repository
aws ecr create-repository --repository-name equity-calculator --region $REGION || true

# Get login token
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URI

# Build and push
docker build -t equity-calculator .
docker tag equity-calculator:latest $ECR_URI:latest
docker push $ECR_URI:latest

echo "📝 Creating task definition..."
cat > task-definition.json << EOF
{
  "family": "$TASK_FAMILY",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::$ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "equity-calculator",
      "image": "$ECR_URI:latest",
      "portMappings": [
        {
          "containerPort": 5001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "5001"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/$TASK_FAMILY",
          "awslogs-region": "$REGION",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

aws ecs register-task-definition --cli-input-json file://task-definition.json --region $REGION

echo "🚀 Creating ECS service..."
aws ecs create-service \
  --cluster $CLUSTER_NAME \
  --service-name $SERVICE_NAME \
  --task-definition $TASK_FAMILY \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-12345],securityGroups=[sg-12345],assignPublicIp=ENABLED}" \
  --region $REGION

echo "✅ Deployment successful!"
echo "🌐 Check AWS Console for service endpoint"
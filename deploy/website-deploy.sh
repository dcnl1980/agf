#!/bin/bash
set -e

# Change to the website directory
cd "$(dirname "$0")/../website"

echo "==== Building Docker Image (linux/amd64) ===="
docker build --platform linux/amd64 -t registry.neurocluster.dev/agf-website:latest -f Dockerfile .

echo "==== Pushing to Registry ===="
docker push registry.neurocluster.dev/agf-website:latest

echo "==== Deploying to Kubernetes (DMZ) ===="
kubectl apply -f ../deploy/k8s/10-website.yaml

echo "==== Restarting Deployment ===="
kubectl rollout restart deployment agf-website -n dmz

echo "==== Deployment Status ===="
kubectl rollout status deployment agf-website -n dmz

echo "Deployment complete! Website should be live at https://agf.2srv.io"

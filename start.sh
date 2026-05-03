#!/bin/bash

echo "Talent Intelligence Platform - Setup and Launch"
echo "================================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed."
    echo "Download it from https://nodejs.org and re-run this script."
    exit 1
fi

echo "Node.js $(node --version) found."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo ""
    echo "Installing dependencies (first run only)..."
    npm install || { echo "ERROR: npm install failed."; exit 1; }
fi

# Copy .env.local silently if missing
if [ ! -f ".env.local" ] && [ -f ".env.local.example" ]; then
    cp .env.local.example .env.local
fi

# Open browser after delay
echo ""
echo "Starting server at http://localhost:3000"
echo "You can enter your API keys and configure your data source in the app."
echo "Press Ctrl+C to stop."
echo ""

(sleep 3 && \
    if command -v xdg-open &> /dev/null; then xdg-open http://localhost:3000; \
    elif command -v open &> /dev/null; then open http://localhost:3000; fi) &

npm run dev

#!/bin/bash

# Test script for generate-nodes functionality
# This script tests the generate-nodes.js script without actually uploading to R2

echo "Testing generate-nodes.js script..."

cd generate-nodes

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Test that the script can be loaded without errors
echo "Testing script syntax..."
node -c generate-nodes.js
if [ $? -eq 0 ]; then
    echo "✅ Script syntax is valid"
else
    echo "❌ Script has syntax errors"
    exit 1
fi

# Test that required dependencies can be loaded
echo "Testing dependencies..."
node -e "
try {
    require('@kubernetes/client-node');
    require('geoip-lite');
    require('ngeohash');
    require('aws-sdk');
    require('axios');
    console.log('✅ All dependencies loaded successfully');
} catch (error) {
    console.error('❌ Dependency error:', error.message);
    process.exit(1);
}
"

echo ""
echo "Generate-nodes script tests completed successfully!"
echo ""
echo "To run the script with actual credentials:"
echo "export NETBOX_TOKEN=your_token"
echo "export CLOUDFLARE_ID=your_account_id"  
echo "export CLOUDFLARE_ACCESS_KEY=your_access_key"
echo "export CLOUDFLARE_SECRET_ACCESS_KEY=your_secret_key"
echo "node generate-nodes.js"
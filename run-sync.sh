#!/bin/bash

# PSX Stock Analysis - Sync Wrapper Script
# This script runs the full pipeline with proper environment setup

# Set Node options to avoid undici compatibility issues
export NODE_OPTIONS="--no-experimental-fetch"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to script directory
cd "$SCRIPT_DIR"

echo "Starting sync..."

# Run the steps
echo "Step 1: Scraping..."
node scraper.js
if [ $? -ne 0 ]; then
    echo "ERROR: Scraping failed"
    exit 1
fi

echo "Step 2: Analyzing..."
node analyzer.js
if [ $? -ne 0 ]; then
    echo "ERROR: Analysis failed"
    exit 1
fi

echo "Step 3: Generating recommendations..."
node strategies.js
if [ $? -ne 0 ]; then
    echo "ERROR: Strategies failed"
    exit 1
fi

echo "Step 4: Sending email..."
node daily-update-with-email.js
if [ $? -ne 0 ]; then
    echo "WARNING: Email failed but sync completed"
    exit 0
fi

echo "SUCCESS: Sync completed!"
exit 0

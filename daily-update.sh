#!/bin/bash

# Daily Update Script for PSX Stock Analysis System
# Run this every trading day to update data and recommendations

echo "================================"
echo "PSX Stock Analysis - Daily Update"
echo "================================"
echo ""

START_TIME=$(date +%s)

# Step 1: Scrape latest data
echo "📡 [1/4] Scraping latest data from PSX..."
node scraper.js
if [ $? -eq 0 ]; then
  echo "✓ Scraping complete"
else
  echo "✗ Scraping failed"
  exit 1
fi
echo ""

# Step 2: Calculate price changes
echo "📊 [2/4] Calculating price changes..."
node calculate-changes.js
if [ $? -eq 0 ]; then
  echo "✓ Changes calculated"
else
  echo "✗ Change calculation failed"
  exit 1
fi
echo ""

# Step 3: Analyze stocks
echo "🔍 [3/4] Analyzing stocks and generating scores..."
node analyzer.js
if [ $? -eq 0 ]; then
  echo "✓ Analysis complete"
else
  echo "✗ Analysis failed"
  exit 1
fi
echo ""

# Step 4: Generate recommendations
echo "💡 [4/4] Generating recommendations..."
node strategies.js
if [ $? -eq 0 ]; then
  echo "✓ Recommendations generated"
else
  echo "✗ Strategy generation failed"
  exit 1
fi
echo ""

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))

echo "================================"
echo "✅ Daily Update Complete!"
echo "Duration: ${MINUTES} minutes"
echo "================================"
echo ""
echo "View recommendations:"
echo "  CLI: node cli.js"
echo "  Dashboard: streamlit run dashboard/app.py"

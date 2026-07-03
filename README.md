# PSX Stock Analysis System

**DISCLAIMER: This system is for educational purposes only. It does not constitute financial advice. Always do your own research and consult with a qualified financial advisor before making investment decisions.**

## Overview

A comprehensive stock analysis system for Pakistan Stock Exchange (PSX) that identifies investment opportunities across multiple timeframes using multi-factor analysis combining value, growth, and dividend investing strategies.

## Features

- **Automated Data Collection**: Scrapes PSX screener data using Playwright
- **Multi-Factor Analysis**: Scores stocks on financial health, price momentum, dividends, and sector performance
- **Multi-Timeframe Strategies**: Short-term (1-6 months), Medium-term (6-18 months), Long-term (18+ months)
- **Interactive Dashboard**: Streamlit web interface with charts and recommendations
- **CLI Interface**: Command-line tool for analysis and queries

## Installation

```bash
cd stocks-analyze
npm install

# For dashboard (Python)
pip install streamlit plotly pandas psycopg2-binary scikit-learn
```

## Configuration

```bash
cp .env.example .env
# Edit .env with your database credentials
```

## Database Setup

```bash
# Create PostgreSQL database
createdb psx_stocks

# Run schema
psql -U postgres -d psx_stocks -f schema.sql
```

## Usage

### Command Line Interface

```bash
# Scrape latest data
npm run scrape

# Run analysis
npm run analyze

# Get recommendations by timeframe
npm run strategies -- --timeframe short
npm run strategies -- --timeframe medium
npm run strategies -- --timeframe long

# Full pipeline (scrape + analyze + strategies)
npm run pipeline

# Interactive CLI
npm run cli
```

### Web Dashboard

```bash
streamlit run dashboard/app.py
```

Access at http://localhost:8501

## Architecture

```
├── scraper.js          - Data collection from PSX
├── database.js         - PostgreSQL operations
├── analyzer.js         - Multi-factor scoring engine
├── strategies.js       - Investment strategy selector
├── predictor.js        - ML prediction models
├── cli.js             - Command-line interface
├── pipeline.js         - Automated workflow
├── dashboard/app.py   - Streamlit web interface
└── schema.sql         - Database schema
```

## Scoring Methodology

### Composite Score Components

- **Financial Health (25%)**: PE ratio, market cap, debt indicators, profitability
- **Price Momentum (30%)**: Multi-period returns, volume trends, technical indicators
- **Dividend Quality (20%)**: Yield, payout sustainability, growth history
- **Sector Performance (25%)**: Relative strength, sector momentum

## Legal Notice

This system collects data from the PSX website (https://dps.psx.com.pk). The PSX website restricts automated data collection and requires licensing for commercial use.

**For authorized data access, contact**: marketdatarequest@psx.com.pk

This implementation is for personal investing and educational purposes. Ensure compliance with PSX terms of service.

## Data Freshness

PSX screener data is delayed by 15 minutes. This is not real-time data.

## Risk Management

The system includes:
- Volatility calculations
- Liquidity warnings
- Portfolio diversification suggestions
- Risk alerts for extreme valuations

## Contributing

This is a personal project for educational purposes.

## License

MIT License - See LICENSE file for details

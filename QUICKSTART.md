# PSX Stock Analysis System - Quick Start Guide

## Prerequisites

1. **Node.js** (v16 or higher)
2. **PostgreSQL** (v12 or higher) with TimescaleDB extension
3. **Python** (v3.8 or higher) - for dashboard only

## Installation Steps

### 1. Install Dependencies

```bash
cd stocks-analyze
npm install
```

### 2. Setup Database

```bash
# Create database
createdb psx_stocks

# Run schema
psql -U postgres -d psx_stocks -f schema.sql
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your database credentials
```

## Quick Start

### Option 1: Full Pipeline (Recommended)

Run everything at once:

```bash
node pipeline.js
```

This will:
- Scrape data from PSX
- Analyze all stocks
- Generate recommendations for all timeframes

### Option 2: Step-by-Step

```bash
# Step 1: Scrape data
npm run scrape

# Step 2: Analyze stocks
npm run analyze

# Step 3: Generate recommendations
npm run strategies -- SHORT
npm run strategies -- MEDIUM
npm run strategies -- LONG
```

## Using the CLI

### View Top Recommendations

```bash
# Short-term (1-6 months)
node cli.js top --timeframe short --limit 10

# Medium-term (6-18 months)
node cli.js top --timeframe medium --limit 10

# Long-term (18+ months)
node cli.js top --timeframe long --limit 10
```

### Analyze Specific Stock

```bash
node cli.js analyze --symbol KEL --timeframe medium
node cli.js stock --symbol OGDC
```

## Launch Dashboard

```bash
# Install Python dependencies
pip install -r dashboard/requirements.txt

# Run dashboard
streamlit run dashboard/app.py
```

Access at: http://localhost:8501

## Common Issues

### Database Connection Error

```
Error: database "psx_stocks" does not exist
```

Solution:
```bash
createdb psx_stocks
psql -U postgres -d psx_stocks -f schema.sql
```

### TimescaleDB Extension Missing

```sql
-- In PostgreSQL
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

## Data Freshness

- Run pipeline daily for latest data
- PSX screener data is delayed by 15 minutes
- Historical data accumulates over time

## Legal Notice

This system is for personal investing and educational purposes.
For authorized data access, contact: marketdatarequest@psx.com.pk

## Next Steps

1. Run the full pipeline: `node pipeline.js`
2. View CLI recommendations: `node cli.js top`
3. Launch dashboard: `streamlit run dashboard/app.py`
4. Analyze specific stocks: `node cli.js stock --symbol KEL`

## File Reference

- `scraper.js` - Data collection from PSX
- `analyzer.js` - Multi-factor scoring engine
- `strategies.js` - Investment recommendations
- `cli.js` - Command-line interface
- `pipeline.js` - Automated workflow
- `dashboard/app.py` - Web dashboard
- `schema.sql` - Database schema

# PSX Stock Analysis - Complete Setup Guide

This guide walks through the complete setup process for the PSX Stock Analysis System, from installation to historical data import.

---

## Prerequisites

1. **Node.js** (v16 or higher)
2. **PostgreSQL** (v12 or higher)
3. **Python** (v3.8 or higher) - for dashboard only

---

## Part 1: Initial Installation

### 1. Install Dependencies

```bash
cd stocks-analyze
npm install
```

**Note:** Playwright is no longer needed. The scraper now uses axios + cheerio (much faster!).

### 2. Install Python Dashboard Dependencies

```bash
pip install streamlit plotly pandas psycopg2-binary scikit-learn
```

---

## Part 2: Database Setup

### 3. Create Database

```bash
# Create PostgreSQL database
createdb psx_stocks

# Run schema (creates all tables in one file)
psql -U <USER_NAME> -d psx_stocks -f schema.sql
```

**Tables created:**
- `stocks` - Stock symbols and basic info
- `stock_daily_data` - Time-series OHLCV data
- `stock_scores` - Multi-factor analysis scores
- `recommendations` - Investment recommendations
- `sector_performance` - Sector-level metrics
- `scrape_log` - Data collection logging
- `users` - User authentication
- `remember_tokens` - Remember me tokens
- `portfolio` - User portfolio holdings
- `alerts` - Price movement alerts

**Views created:**
- `v_stock_analysis` - Latest stock data with scores
- `v_top_recommendations` - Top recommendations by timeframe
- `v_portfolio_summary` - Portfolio summary aggregation

### 4. Configure Environment

```bash
cp .env.example .env
# Edit .env with your database credentials
```

**Required .env variables:**
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=psx_stocks
DB_USER=postgres
DB_PASSWORD=your_password

# Email (for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com

# User Email (for receiving briefings)
USER_EMAIL=your-email@gmail.com
```

---

## Part 3: Seed User Account

### 5. Create Admin User

```bash
node seed-user.js
```

**This creates:**
- Username: `ahmednaeem5575`
- Password: `9026040An!`
- Email: (set via `USER_EMAIL` in .env)

**Note:** Update `seed-user.js` to change credentials.

---

## Part 4: Historical Data Setup (One-Time)

This is a **one-time setup** to load 5 years of historical data.

### 6. Scrape Historical EOD Data (⏱ 60-90 minutes)

```bash
node scraper-historical.js
```

**What it does:**
- Fetches historical EOD data from `https://dps.psx.com.pk/timeseries/eod/{symbol}`
- Collects ~5 years of daily data for ~736 symbols
- Outputs to: `data/exports/historical-progress.json`
- Duration: 60-90 minutes (depends on network speed)

**Expected output:**
```
Total symbols: 736
Successful: 736
Failed: 0

Data saved to: data/exports/historical-progress.json
```

### 7. Insert Stock Symbols (⏱ 1 minute)

```bash
node insert-symbols.js
```

**What it does:**
- Reads symbols from: `data/exports/historical-progress.json`
- Inserts all symbols into `stocks` table (required for foreign key constraints)
- Duration: ~1 minute

**Expected output:**
```
Testing database connection...
Loading data from: ./data/exports/historical-progress.json
Total symbols: 736
Successful: 736
Failed: 0

=== Inserting 736 symbols into stocks table ===

=== Insert Complete ===
Succeeded: 736
Failed: 0

Total symbols in stocks table: 736
```

**Important:** Run this BEFORE importing historical data to avoid foreign key constraint errors.

### 8. Import Historical Data to Database (⏱ 10-20 minutes)

```bash
node import-historical.js
```

**What it does:**
- Reads from: `data/exports/historical-progress.json`
- Imports ~562K historical records to `stock_daily_data` table
- Duration: 10-20 minutes

**Expected output:**
```
Total symbols: 736
Importing XYZ (1234 records)...
...
Total inserted: 562,456
Total skipped: 0
Total failed: 0
```

### 9. Calculate Historical Price Changes (⏱ 5-10 minutes)

```bash
node calculate-changes.js
```

**What it does:**
- Calculates price changes: 1d, 1w, 1m, 3m, 6m, 1y
- Updates `stock_daily_data` table
- Coverage: ~98.7% of records

**Expected output:**
```
Processing 2021-07-01...
...
Records processed: 562,456
Records updated: 555,320
Coverage: 98.7%
```

### 10. Analyze Historical Data (⏱ 20-30 minutes)

```bash
node analyze-historical.js
```

**What it does:**
- Calculates multi-factor scores for all historical dates
- Populates `stock_scores` table
- Duration: 20-30 minutes

**Expected output:**
```
Analyzing data from 2021-07-01 to 2026-07-04...
Processing 2021-07-01 (736 stocks)...
...
Total records analyzed: 405,360
Completed successfully
```

### 11. Fix Sector Codes (Optional)

```bash
node fix-sector-codes.js
```

**What it does:**
- Updates sector codes based on stock symbols
- Maps PSX sector codes to readable names

---

## Part 5: Daily Operations

### 12. Scrape Latest Data (Daily)

```bash
npm run scrape
# or
node scraper.js
```

**What it does:**
- Fetches latest data from `https://dps.psx.com.pk/market-watch`
- Scrapes ~494 stocks
- Duration: 2-3 seconds

### 13. Analyze Stocks (Daily)

```bash
npm run analyze
# or
node analyzer.js
```

**What it does:**
- Calculates multi-factor scores
- Generates composite scores (0-100)
- Determines risk levels (LOW/MEDIUM/HIGH)

### 14. Generate Recommendations (Daily)

```bash
npm run strategies
# or
node strategies.js
```

**What it does:**
- Generates SHORT-TERM, MEDIUM-TERM, LONG-TERM recommendations
- Calculates entry prices, target prices, expected returns
- Stores in `recommendations` table

### 15. Send Daily Email Briefing (Daily - Optional)

```bash
npm run daily-update
# or
node daily-update-with-email.js
```

**What it does:**
- Runs complete pipeline (scrape → analyze → recommend → email)
- Sends email briefing to `USER_EMAIL`
- Duration: ~37 seconds

### 16. Start Scheduler (Optional - Automated Daily Updates)

```bash
npm run scheduler
# or
node scheduler.js
```

**What it does:**
- Runs daily update every day at 4:00 PM Pakistan time
- Configured to run after market close

**Scheduler commands:**
```bash
npm run scheduler:once      # Run once immediately
npm run scheduler:stop      # Stop scheduler
npm run scheduler:status    # Check scheduler status
```

---

## Part 6: Launch Dashboard

### 17. Launch Dashboard

```bash
streamlit run dashboard/app.py
```

**Access at:** http://localhost:8501

**Default login:**
- Username: `ahmednaeem5575`
- Password: `9026040An!`

---

## Quick Reference: Setup Commands

```bash
# 1. Install dependencies
npm install
pip install streamlit plotly pandas psycopg2-binary scikit-learn

# 2. Database setup
createdb psx_stocks
psql -U <USER_NAME> -d psx_stocks -f schema.sql

# 3. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 4. Seed user
node seed-user.js

# 5. Historical data (one-time, 60-90 min)
node scraper-historical.js
node insert-symbols.js
node import-historical.js
node calculate-changes.js
node analyze-historical.js
node fix-sector-codes.js

# 6. Daily operations
npm run daily-update      # Full pipeline with email
npm run scheduler          # Start automated scheduler

# 7. Launch dashboard
streamlit run dashboard/app.py
```

---

## Verification Steps

### Verify Database Connection

```bash
node -e "
const db = require('./database');
db.testConnection().then(result => {
  console.log('Database connection:', result ? 'SUCCESS' : 'FAILED');
  process.exit(0);
});
"
```

### Verify User Account

```bash
node -e "
const db = require('./database');
db.pool.query('SELECT username FROM users WHERE username = \$1', ['ahmednaeem5575'])
  .then(result => console.log('User found:', result.rowCount > 0));
"
```

### Verify Historical Data

```bash
node -e "
const db = require('./database');
db.pool.query('SELECT COUNT(*) FROM stock_daily_data')
  .then(result => console.log('Historical records:', result.rows[0].count));
"
```

Expected: `562,456` records (or similar)

### Verify Latest Data

```bash
npm run scrape
```

Check that 400+ stocks are scraped successfully.

---

## File Reference

| File | Purpose | When to Run |
|------|---------|-------------|
| `schema.sql` | Database schema | One-time setup |
| `seed-user.js` | Create admin user | One-time setup |
| `scraper-historical.js` | Scrape 5 years data | One-time setup |
| `insert-symbols.js` | Insert stock symbols | One-time setup (before import) |
| `import-historical.js` | Import historical data | One-time setup |
| `calculate-changes.js` | Calculate price changes | One-time setup |
| `analyze-historical.js` | Analyze historical dates | One-time setup |
| `fix-sector-codes.js` | Update sector codes | One-time setup |
| `scraper.js` | Scrape latest data | Daily |
| `analyzer.js` | Analyze stocks | Daily |
| `strategies.js` | Generate recommendations | Daily |
| `daily-update-with-email.js` | Full pipeline with email | Daily |
| `scheduler.js` | Automated daily updates | Optional |

---

## Troubleshooting

### Issue: Scraper returns 0 stocks

**Solution:** Check if `https://dps.psx.com.pk/market-watch` is accessible

```bash
curl -I https://dps.psx.com.pk/market-watch
```

### Issue: Database connection error

**Solution:** Verify PostgreSQL is running and credentials are correct

```bash
psql -U postgres -d psx_stocks -c "SELECT 1"
```

### Issue: Email not sending

**Solution:** Verify Gmail App Password is correct (not regular password)

Generate at: https://myaccount.google.com/apppasswords

---

## Estimated Setup Time

- **Installation:** 5-10 minutes
- **Database setup:** 5 minutes
- **User seeding:** 1 minute
- **Historical data scrape:** 60-90 minutes
- **Historical data import:** 10-20 minutes
- **Calculate changes:** 5-10 minutes
- **Analyze historical:** 20-30 minutes

**Total Setup Time:** ~2-3 hours (mostly automated)

---

## Legal Notice

This system is for personal investing and educational purposes.
For authorized data access, contact: marketdatarequest@psx.com.pk

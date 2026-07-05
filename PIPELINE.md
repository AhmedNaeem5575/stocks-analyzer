# PSX Stock Analysis Pipeline Documentation

> A comprehensive guide to the stock analysis pipeline, from data collection to investment recommendations.

---

## Table of Contents

1. [Pipeline Overview](#pipeline-overview)
2. [Architecture](#architecture)
3. [Pipeline Stages](#pipeline-stages)
4. [Database Schema](#database-schema)
5. [Analysis Methodology](#analysis-methodology)
6. [Investment Strategies](#investment-strategies)
7. [Running the Pipeline](#running-the-pipeline)
8. [Dashboard](#dashboard)
9. [Key Points & Best Practices](#key-points--best-practices)

---

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PSX STOCK ANALYSIS PIPELINE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────┐   │
│  │ SCRAPING │ -> │ STORAGE  │ -> │ ANALYSIS │ -> │STRATEGY │ ->  │VIEW  │   │
│  │          │    │          │    │          │    │         │     │      │   │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

The pipeline is a **5-stage automated workflow** that transforms raw market data into actionable investment recommendations.

### Key Characteristics

| Aspect | Description |
|--------|-------------|
| **Data Source** | PSX Screener (official PSX website) |
| **Database** | PostgreSQL with TimescaleDB (optional) |
| **Analysis Engine** | Multi-factor scoring (0-100 scale) |
| **Recommendations** | Timeframe-specific (SHORT/MEDIUM/LONG) |
| **Interfaces** | CLI + Streamlit Dashboard |

---

## Architecture

### File Structure

```
stocks-analyze/
├── Core Pipeline
│   ├── pipeline.js          # Main orchestrator
│   ├── scraper.js           # Web scraping
│   ├── analyzer.js          # Multi-factor analysis
│   ├── strategies.js        # Investment recommendations
│   └── database.js          # PostgreSQL operations
│
├── Interfaces
│   ├── cli.js               # Interactive CLI
│   ├── index.js             # Module exports
│   └── dashboard/
│       ├── app.py           # Streamlit dashboard
│       └── requirements.txt # Python dependencies
│
├── Utilities
│   ├── analyze-raw.js       # Simple raw data analyzer
│   ├── load-data.js         # Bulk JSON loader
│   └── debug-*.js           # Debugging utilities
│
├── Database
│   └── schema.sql           # PostgreSQL schema
│
└── Configuration
    ├── package.json          # Node.js config & scripts
    ├── .env                  # Environment variables
    └── .env.example          # Environment template
```

### Technology Stack

```
┌────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js)                       │
├────────────────────────────────────────────────────────────┤
│  • axios         - HTTP requests                          │
│  • cheerio       - HTML parsing                            │
│  • pg            - PostgreSQL client                       │
│  • dotenv        - Configuration management                │
│  • nodemailer    - Email notifications                      │
│  • handlebars    - Template rendering                       │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                    FRONTEND (Python)                        │
├────────────────────────────────────────────────────────────┤
│  • streamlit     - Web dashboard framework                  │
│  • plotly        - Interactive charts                       │
│  • pandas        - Data manipulation                        │
│  • psycopg2      - PostgreSQL connector                     │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                      DATABASE (PostgreSQL)                  │
├────────────────────────────────────────────────────────────┤
│  • Relational data storage                                  │
│  • Time-series optimization (TimescaleDB optional)          │
│  • Materialized views for analysis                          │
└────────────────────────────────────────────────────────────┘
```

---

## Pipeline Stages

### Stage 1: Data Collection (SCRAPING)

**File:** `scraper.js`

```javascript
npm run scrape
# or
node scraper.js
```

#### Process Flow

```
┌──────────────────┐
│   HTTP Request    │ (axios - fetch market-watch page)
└────────┬─────────┘
         ▼
┌──────────────────┐
│  Parse HTML      │ (cheerio - extract table data)
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Transform &      │ (Normalize formats, calculate changes)
│   Enrich Data    │
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Save to DB +     │ (PostgreSQL + JSON export)
│   JSON Export    │
└──────────────────┘
```

#### Data Collected

| Field | Description | Source |
|-------|-------------|--------|
| `symbol` | Stock ticker symbol | PSX Screener |
| `name` | Company name | PSX Screener |
| `sector` | Industry sector | PSX Screener |
| `close` | Current price | PSX Screener |
| `change_1d` | 1-day change % | Calculated |
| `change_1w` | 1-week change % | PSX Screener |
| `change_1m` | 1-month change % | PSX Screener |
| `change_1y` | 1-year change % | PSX Screener |
| `volume` | Trading volume | PSX Screener |
| `market_cap` | Market capitalization | PSX Screener |
| `pe_ratio` | Price-to-earnings ratio | PSX Screener |
| `pb_ratio` | Price-to-book ratio | PSX Screener |
| `dividend_yield` | Annual dividend yield | PSX Screener |
| `free_float` | Free float shares | PSX Screener |

#### Key Points

> - **Legal Notice:** PSX restricts automated data collection. For authorized access, contact marketdatarequest@psx.com.pk
> - Uses **axios + cheerio** for fast, lightweight scraping (2-3 seconds)
> - Implements **error handling** for network issues and missing data
> - Exports JSON to `data/stocks-{timestamp}.json` for backup
> - Fetches data from `https://dps.psx.com.pk/market-watch`

---

### Stage 2: Data Storage (DATABASE)

**File:** `database.js`, `schema.sql`

#### Database Tables

```sql
-- Core Tables
stocks              -- Basic company information
stock_daily_data    -- Time-series OHLCV & fundamentals
stock_scores        -- Multi-factor analysis scores
recommendations     -- Investment recommendations
sector_performance  -- Sector-level metrics
scrape_log          -- Data collection logging
alerts              -- Price movement alerts
portfolio           -- User portfolio tracking
```

#### Data Flow

```
┌─────────────────┐     ┌─────────────────┐
│ Scraper Output  │ --> │   PostgreSQL    │
│  (JSON + API)   │     │   Database      │
└─────────────────┘     └────────┬────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
  ┌──────────┐          ┌──────────────┐        ┌───────────┐
  │  stocks  │          │stock_daily_  │        │scrape_log │
  │          │          │   data       │        │           │
  └──────────┘          └──────────────┘        └───────────┘
```

#### Key Features

- **Bulk inserts** for efficient data loading
- **Upsert operations** (INSERT ... ON CONFLICT) for idempotency
- **Time-series optimization** with TimescaleDB (optional)
- **Materialized views** for fast analysis queries
- **Automatic timestamping** for all records

---

### Stage 3: Analysis (SCORING)

**File:** `analyzer.js`

```javascript
npm run analyze
# or
node analyzer.js
```

#### Scoring Framework

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPOSITE SCORE (0-100)                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   FINANCIAL  │  │   MOMENTUM   │  │   DIVIDEND   │       │
│  │   HEALTH     │  │              │  │              │       │
│  │   Weight:    │  │   Weight:    │  │   Weight:    │       │
│  │   25%        │  │   30%        │  │   20%        │       │
│  └──────────────┘  └──────────────┘  └──────────────┘      
 │
│                                                             │
│  ┌──────────────┐                                           │
│  │    SECTOR    │                                           │
│  │   Weight:    │                                           │
│  │   25%        │                                           │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

#### Individual Score Calculations

##### 1. Financial Health Score (0-100)

**Factors:**

| Factor | Weight | Criteria |
|--------|--------|----------|
| PE Ratio | 40% | 5-15 (best), <5 (suspicious), >40 (expensive) |
| Market Cap | 25% | >$100B (95), >$10B (85), >$1B (70) |
| P/B Ratio | 20% | ≤1 (95), ≤2 (75), >3 (35) |
| Dividend | 15% | Paying dividends = financial stability |

**Code Logic:**
```javascript
// PE Ratio Scoring
PE < 5:   60 points (suspiciously low)
PE 5-15:  90 points (good value)
PE 15-25: 70 points (fair)
PE 25-40: 50 points (expensive)
PE > 40:  25 points (very expensive)
```

##### 2. Momentum Score (0-100)

**Factors:**

| Period | Weight | Scoring |
|--------|--------|---------|
| 1 Month | 30% | >20% (100), >10% (85), >5% (70), >0% (60) |
| 3 Month | 30% | >40% (100), >20% (85), >10% (70), >0% (60) |
| 6 Month | 25% | >50% (100), >30% (85), >15% (70), >0% (60) |
| 1 Year | 15% | >75% (100), >50% (90), >25% (75), >0% (60) |

##### 3. Dividend Score (0-100)

**Factors:**

| Factor | Weight | Criteria |
|--------|--------|----------|
| Yield | 60% | 4-8% (100), 6% (80), 2-4% (75), <1% (30) |
| Payout | 25% | PE in healthy range (0-50) |
| Consistency | 15% | Currently paying dividend |

##### 4. Sector Score (0-100)

**Factors:**

| Factor | Weight | Criteria |
|--------|--------|----------|
| Sector Momentum | 50% | Relative sector strength |
| 3-Month Change | 30% | Sector price movement |
| Sector Size | 20% | Market cap percentage |

##### 5. Additional Metrics

| Metric | Calculation | Usage |
|--------|-------------|-------|
| **Volatility** | Annualized std dev of daily returns | Risk assessment |
| **Liquidity Score** | 30-day avg volume + free float % | Tradeability |
| **Risk Level** | Based on vol, financial, liquidity | HIGH/MEDIUM/LOW |

#### Key Points

> - **Z-score normalization** ensures fair comparison across stocks
> - **Historical data** (365 days) used for volatility calculation
> - **Sector-relative** scoring for context-aware analysis
> - All scores **clamped to 0-100** range

---

### Stage 4: Investment Strategies (RECOMMENDATIONS)

**File:** `strategies.js`

```javascript
npm run strategies -- --timeframe short
# or
node strategies.js short
```

#### Strategy Framework

```
┌───────────────────────────────────────────────────────────────┐
│                    INVESTMENT STRATEGIES                       │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌────────────┐ │
│  │   SHORT-TERM    │    │   MEDIUM-TERM   │    │  LONG-TERM │ │
│  │  (1-6 months)   │    │  (6-18 months)  │    │ (18+ months)│ │
│  │                 │    │                 │    │            │ │
│  │  • MOMENTUM     │    │  • GROWTH       │    │  • VALUE   │ │
│  │  • Volume       │    │  • Balanced     │    │  • Dividend│ │
│  │  • Technical    │    │  • Fundamentals │    │  • Safety  │ │
│  └─────────────────┘    └─────────────────┘    └────────────┘ │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

#### Strategy Selection Logic

| Timeframe | Strategy Type | Key Factors | Target Hold |
|-----------|--------------|-------------|-------------|
| SHORT | MOMENTUM | Momentum score > 70, Volume > 1M, 1M change > 5% | 1-6 months |
| MEDIUM | GROWTH | Composite score > 60, Financial > 50, Momentum > 55 | 6-18 months |
| LONG | VALUE | Financial health > 65, Dividend score > 50, PE < 25 | 18+ months |

#### Recommendation Components

Each recommendation includes:

```javascript
{
  symbol: "KEL",
  timeframe: "SHORT",
  strategy_type: "MOMENTUM",
  recommendation_rank: 1,
  entry_price: 120.50,
  target_price: 145.00,
  expected_return: "20.3",
  stop_loss: 112.00,
  risk_reward_ratio: "2.5:1",
  reasoning: "Strong momentum with high volume..."
}
```

#### Target Price Calculation

| Strategy | Formula |
|----------|---------|
| MOMENTUM | `entry × (1 + (1M_return × 0.5))` |
| GROWTH | `entry × (1 + (1Y_return × 0.4))` |
| VALUE | `entry × (1 + (composite_score/100 × 0.3))` |

#### Key Points

> - **Top 5 stocks** selected per timeframe
> - **Risk-reward ratio** calculated for each recommendation
> - **Stop loss** set at 5-10% below entry (varies by strategy)
> - **Reasoning** generated from key factors

---

### Stage 5: Presentation (INTERFACES)

#### 1. CLI Interface (`cli.js`)

```bash
node cli.js
```

**Available Commands:**

| Command | Description | Example |
|---------|-------------|---------|
| `scrape` | Run web scraper | `> scrape` |
| `analyze` | Run analysis | `> analyze` |
| `top [n]` | Show top N stocks | `> top 10` |
| `stock [symbol]` | Show stock details | `> stock KEL` |
| `help` | Show help | `> help` |
| `exit` | Exit CLI | `> exit` |

#### 2. Streamlit Dashboard (`dashboard/app.py`)

```bash
cd dashboard
streamlit run app.py
```

**Dashboard Pages:**

| Page | Features |
|------|----------|
| **Dashboard** | Market overview, top stocks, score distribution |
| **Stock Screener** | Filter by sector, risk, score, P/E |
| **Recommendations** | Timeframe-specific recommendations |
| **Stock Details** | Individual stock analysis with history |
| **Sector Analysis** | Sector performance and comparison |

**Dashboard Features:**

- Interactive charts (Plotly)
- Real-time data refresh
- Historical price charts (candlestick)
- Score breakdown with progress bars
- Export capabilities

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────┐       ┌──────────────────┐
│   stocks    │       │ stock_daily_data │
│─────────────│       │──────────────────│
│ symbol (PK) │<──────│ symbol (FK)      │
│ name        │       │ time (PK)        │
│ sector      │       │ open, high, low  │
│ industry    │       │ close, volume    │
└─────────────┘       │ market_cap       │
                      │ pe_ratio         │
         ┌────────────│ dividend_yield   │
         │            └──────────────────┘
         │
         ▼
┌──────────────────┐       ┌──────────────────┐
│  stock_scores    │       │ recommendations  │
│──────────────────│       │──────────────────│
│ time (PK)        │       │ time (PK)        │
│ symbol (FK)      │<──────│ symbol (FK)      │
│ financial_health │       │ timeframe (PK)   │
│ momentum         │       │ strategy_type    │
│ dividend         │       │ target_price     │
│ sector           │       │ expected_return  │
│ composite        │       │ risk_reward      │
│ volatility       │       │ reasoning        │
│ risk_level       │       └──────────────────┘
└──────────────────┘
         │
         ▼
┌──────────────────┐
│sector_performance│
│──────────────────│
│ time (PK)        │
│ sector (PK)      │
│ momentum_score   │
│ change_1m        │
│ change_3m        │
└──────────────────┘
```

### Database Views

#### `v_stock_analysis`
Latest stock data with scores for dashboard.

```sql
CREATE VIEW v_stock_analysis AS
SELECT
    s.symbol, s.name, s.sector,
    d.close, d.market_cap, d.pe_ratio,
    sc.financial_health_score,
    sc.momentum_score,
    sc.dividend_score,
    sc.sector_score,
    sc.composite_score,
    sc.risk_level
FROM stocks s
JOIN stock_daily_data d ON s.symbol = d.symbol
JOIN stock_scores sc ON s.symbol = sc.symbol
WHERE d.time = (SELECT MAX(time) FROM stock_daily_data)
  AND sc.time = (SELECT MAX(time) FROM stock_scores);
```

#### `v_top_recommendations`
Top recommendations by timeframe.

---

## Analysis Methodology

### Complete Formula

```
COMPOSITE_SCORE =
  (FINANCIAL_HEALTH × 0.25) +
  (MOMENTUM × 0.30) +
  (DIVIDEND × 0.20) +
  (SECTOR × 0.25)
```

### Score Interpretation

| Score Range | Rating | Action |
|-------------|--------|--------|
| 80-100 | Excellent | Strong Buy |
| 70-79 | Good | Buy |
| 60-69 | Fair | Moderate Buy |
| 50-59 | Neutral | Hold |
| 40-49 | Weak | Hold/Reduce |
| 0-39 | Poor | Avoid |

### Risk Level Matrix

| Volatility | Financial Health | Liquidity | Risk Level |
|------------|------------------|-----------|------------|
| > 50% | < 40 | < 30 | HIGH |
| Any | < 40 | Any | MEDIUM |
| Any | Any | < 30 | MEDIUM |
| Else | Else | Else | LOW |

---

## Running the Pipeline

### Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure database
cp .env.example .env
# Edit .env with your database credentials

# 3. Initialize database
psql -U postgres -d psx_stocks -f schema.sql

# 4. Run full pipeline
npm run pipeline
```

### Individual Commands

```bash
# Scraping only
npm run scrape

# Analysis only
npm run analyze

# Recommendations only
npm run strategies -- --timeframe short

# Interactive CLI
npm run cli

# Dashboard
cd dashboard && streamlit run app.py
```

### Pipeline Options

```bash
# Run specific stages
node pipeline.js --stages scrape,analyze

# Dry run (no database writes)
node pipeline.js --dry-run

# Verbose output
node pipeline.js --verbose

# Specific timeframe for strategies
node strategies.js [short|medium|long]
```

### Environment Variables

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=psx_stocks
DB_USER=postgres
DB_PASSWORD=your_password

# Scraping
HEADLESS=true              # Run browser in headless mode
SCRAPE_DELAY=1000          # Delay between requests (ms)
MAX_RETRIES=3              # Retry attempts on failure
```

---

## Key Points & Best Practices

### Key Points

> **Data Collection**
> - PSX restricts automated data collection - use responsibly
> - Scraping should be done during market hours for latest data
> - JSON exports provide backup and offline analysis capability

> **Analysis**
> - Composite score is **not a buy/sell signal** - it's a screening tool
> - Always consider additional factors beyond scores
> - Sector-relative scoring accounts for market cycles

> **Recommendations**
> - Strategies are **guidelines, not guarantees**
> - Risk-reward ratios help assess potential vs downside
> - Stop losses are essential for risk management

> **Database**
> - Regular backups of PostgreSQL database recommended
> - TimescaleDB extension improves time-series query performance
> - Materialized views should be refreshed periodically

### Best Practices

1. **Run pipeline regularly**
   ```bash
   # Add to crontab for daily execution
   0 17 * * 1-5 cd /path/to/stocks-analyze && npm run pipeline
   ```

2. **Monitor scraping logs**
   - Check `scrape_log` table for failures
   - Review error details for data quality issues

3. **Validate before acting**
   - Cross-check scores with fundamental analysis
   - Consider news and market conditions
   - Verify data recency

4. **Database maintenance**
   ```sql
   -- Refresh materialized views
   REFRESH MATERIALIZED VIEW v_stock_analysis;
   REFRESH MATERIALIZED VIEW v_top_recommendations;

   -- Clean old data (optional)
   DELETE FROM stock_daily_data WHERE time < NOW() - INTERVAL '2 years';
   ```

5. **Dashboard configuration**
   - Use `requirements.txt` for Python dependencies
   - Configure `.env` for database connection
   - Set `autoreload=true` in Streamlit for development

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Scraping fails | Check internet connection, verify PSX website is accessible |
| Database connection error | Verify PostgreSQL is running, check credentials in `.env` |
| Scores are NULL | Run `analyze` command after scraping |
| Dashboard won't load | Install Python dependencies: `pip install -r dashboard/requirements.txt` |
| Old data showing | Run `scrape` then `analyze` to refresh |

---

## Disclaimer

> **LEGAL NOTICE:** This system is for **educational purposes only** and does NOT constitute financial advice.
>
> Always do your own research and consult with a qualified financial advisor before making investment decisions.
>
> The PSX website restricts automated data collection. For authorized data access, contact: marketdatarequest@psx.com.pk

---

## Appendix

### NPM Scripts Reference

```json
{
  "start": "node index.js",
  "scrape": "node scraper.js",
  "analyze": "node analyzer.js",
  "strategies": "node strategies.js",
  "pipeline": "node pipeline.js",
  "cli": "node cli.js"
}
```

### File Size Summary

| File | Lines | Purpose |
|------|-------|---------|
| `pipeline.js` | ~150 | Orchestration |
| `scraper.js` | ~300 | Data collection |
| `analyzer.js` | ~550 | Scoring engine |
| `strategies.js` | ~400 | Recommendations |
| `database.js` | ~250 | DB operations |
| `cli.js` | ~200 | User interface |
| `app.py` | ~560 | Dashboard |

---

**Version:** 1.0.0
**Last Updated:** 2025
**Repository:** folio3-learning-portal/stocks-analyze

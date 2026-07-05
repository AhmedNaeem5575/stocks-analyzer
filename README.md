# PSX Stock Analysis System

**DISCLAIMER: This system is for educational purposes only. It does not constitute financial advice. Always do your own research and consult with a qualified financial advisor before making investment decisions.**

## Overview

A comprehensive stock analysis system for Pakistan Stock Exchange (PSX) that identifies investment opportunities across multiple timeframes using multi-factor analysis combining value, growth, and dividend investing strategies.

**Key Features:**
- **5 Years of Historical Data**: Complete historical analysis from July 2021 to present
- **Multi-Factor Scoring**: Financial health, price momentum, dividends, sector performance
- **Multi-Timeframe Strategies**: Short-term (1-6 mo), Medium-term (6-18 mo), Long-term (18+ mo)
- **Interactive Dashboard**: Streamlit web interface with charts and recommendations
- **CLI Interface**: Command-line tool for analysis and queries

---

## Quick Start

### Installation

```bash
cd stocks-analyze
npm install

# For dashboard (Python)
pip install streamlit plotly pandas psycopg2-binary scikit-learn
```

### Configuration

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### Database Setup

```bash
# Create PostgreSQL database
createdb psx_stocks

# Run schema
psql -U postgres -d psx_stocks -f schema.sql
```

### Daily Update (Run Once Per Trading Day)

```bash
./daily-update.sh
```

This single command:
1. ✅ Scrapes latest PSX data
2. ✅ Calculates price changes
3. ✅ Analyzes stocks & generates scores
4. ✅ Creates recommendations

**View results:**
```bash
node cli.js                    # View latest recommendations
streamlit run dashboard/app.py  # Launch web dashboard
```

---

## Complete Pipeline

### Initial Setup (One-time)

#### 1. Scrape Historical Data (5 years)
```bash
node scraper-historical.js
```
- Scrapes from: `https://dps.psx.com.pk/timeseries/eod/{symbol}`
- Collects: open, close, volume for ~1,237 trading days
- Output: `data/exports/historical-progress.json`
- Duration: ~60-90 minutes for 736 symbols

#### 2. Import Historical Data
```bash
node import-historical.js
```
- Reads from: `data/exports/historical-progress.json`
- Writes to: `stock_daily_data` table
- Records: ~562K historical records

#### 3. Calculate Price Changes
```bash
node calculate-changes.js
```
- Calculates: change_1d, change_1w, change_1m, change_3m, change_6m, change_1y
- Updates: `stock_daily_data` table
- Coverage: 98.7% of records

#### 4. Analyze Historical Dates
```bash
node analyze-historical.js
```
- Calculates scores for all historical dates
- Populates: `stock_scores` table
- Records: ~223K score records across 1,237 dates

### Daily Workflow

Run this every trading day after market close:

```bash
./daily-update.sh
```

Or run individually:

```bash
# Step 1: Scrape latest data (~5 min)
node scraper.js

# Step 2: Calculate price changes (~2 min)
node calculate-changes.js

# Step 3: Analyze stocks (~5 min)
node analyzer.js

# Step 4: Generate recommendations (~2 min)
node strategies.js
```

**Total time: ~15 minutes**

---

## Recommendation Logic

### How Stocks Are Selected as "Best to Buy"

The system uses a **multi-factor scoring approach** to identify the best investment opportunities. Here's how it works:

#### Step 1: Calculate Individual Scores (0-100 scale)

**Financial Health Score (25% weight)**
- **PE Ratio Analysis**: Lower PE = better value (5-15 range optimal)
- **Market Cap**: Larger cap = more stable (100B+ = 95 points, <100M = 30 points)
- **Price-to-Book**: P/B ≤ 1 = trading at/below book value (95 points)
- **Dividend Indicator**: Paying dividends = financially stable

**Example:**
```
PE = 12 → 90 points (good value)
Market Cap = 50B → 85 points (stable)
P/B = 0.8 → 95 points (below book value)
Dividend Yield = 5% → 75 points
→ Financial Health = 87/100
```

**Price Momentum Score (30% weight)**
- **1-month return**: 10% = 70 points, 20%+ = 90 points
- **3-month return**: Strong upward trend = higher score
- **6-month return**: Consistent gains over 6 months
- **1-year return**: Long-term performance
- **Volume Trend**: Increasing volume = bullish signal

**Example:**
```
1M change = +15% → 80 points
3M change = +25% → 85 points
6M change = +40% → 90 points
1Y change = +60% → 95 points
Volume = Increasing → +5 points
→ Momentum Score = 88/100
```

**Dividend Score (20% weight)**
- **Yield**: 4-6% = optimal (100 points)
- **Sustainability**: Reasonable PE + consistent payments
- **Growth History**: History of increasing dividends

**Sector Performance Score (25% weight)**
- **Sector Momentum**: Outperforming market = higher score
- **Relative Strength**: Sector vs market comparison
- **Industry Trend**: Cyclical vs growth sectors

#### Step 2: Calculate Composite Score

```
Composite Score = (Financial × 0.25) + (Momentum × 0.30) + (Dividend × 0.20) + (Sector × 0.25)
```

**Example:**
```
Financial: 87
Momentum: 88
Dividend: 75
Sector: 70

Composite = (87 × 0.25) + (88 × 0.30) + (75 × 0.20) + (70 × 0.25)
          = 21.75 + 26.4 + 15 + 17.5
          = 80.65/100
```

#### Step 3: Risk Assessment

**Volatility Calculation:**
- Measures standard deviation of daily returns
- High volatility = higher risk
- Used to determine risk level: LOW, MEDIUM, HIGH

**Liquidity Score:**
- Average volume over 30 days
- Higher volume = more liquid = safer
- Low volume stocks flagged as illiquid

#### Step 4: Strategy-Specific Selection

Each timeframe has different criteria:

**SHORT-TERM (1-6 months) - Momentum Strategy**
- Focus: Price momentum & technical indicators
- Prioritizes: High momentum scores (>70)
- Looks for: Breakout candidates, increasing volume
- Target: Quick gains from trending stocks
- Stop-loss: Tight (5-10%)
- Risk tolerance: Higher

**Example Recommendation:**
```
TRG - Composite: 82, Momentum: 90
Why: Strong upward momentum (+45% in 3M), high volume breakout
Entry: 67.50, Target: 82.00 (+21%), Stop-loss: 61.50
Risk: MEDIUM, Reward/Risk: 2.1
```

**MEDIUM-TERM (6-18 months) - Growth Strategy**
- Focus: Earnings growth + reasonable valuation
- Prioritizes: Balanced financial health + momentum
- Looks for: Industry leaders, PEG ratio < 1.5
- Target: Growth with reasonable valuation
- Stop-loss: Moderate (10-15%)
- Risk tolerance: Medium

**Example Recommendation:**
```
OGDC - Composite: 78, Momentum: 75, Financial: 85
Why: Strong financials, moderate growth, undervalued (PE=8)
Entry: 95.00, Target: 120.00 (+26%), Stop-loss: 85.00
Risk: LOW, Reward/Risk: 2.5
```

**LONG-TERM (18+ months) - Value Strategy**
- Focus: Undervalued + dividend income
- Prioritizes: High financial health + dividend yield
- Looks for: Low PE (<15), high dividend (>4%)
- Target: Compound growth + income
- Stop-loss: Loose (15-20%)
- Risk tolerance: Low

**Example Recommendation:**
```
FFC - Composite: 75, Financial: 88, Dividend: 90
Why: Strong dividend payer (6%), low PE (12), stable company
Entry: 570.00, Target: 720.00 (+26%), Dividend: 34.20/year
Risk: LOW, Total Return: 32% (capital + dividend)
```

### Why a Stock is Recommended?

A stock appears in recommendations when:

1. **High Composite Score** (>70/100)
   - Balanced strength across multiple factors

2. **Strategy Alignment**
   - SHORT: High momentum (>70)
   - MEDIUM: Balanced health + momentum
   - LONG: High financial health + dividend

3. **Favorable Risk/Reward**
   - Target return ≥ 20%
   - Risk/reward ratio ≥ 2.0
   - Risk level: LOW or MEDIUM

4. **Sector Strength**
   - Sector showing positive momentum
   - Industry in growth phase

5. **Technical Confirmation**
   - Price above key moving averages
   - Increasing volume trend
   - No nearby resistance

### What Makes a Stock "Best to Buy"?

**The Top 10 in each timeframe are selected because they have:**

1. **Highest composite scores** in that timeframe's strategy
2. **Strong recent performance** aligned with strategy goals
3. **Manageable risk** (LOW or MEDIUM risk level)
4. **Clear upside potential** (20%+ target returns)
5. **Liquidity** for position entry/exit
6. **No red flags** (extreme valuation, circuit breakers, suspensions)

**Example Top Recommendation:**
```
#1 SHORT-TERM: TRG
  Composite: 82, Momentum: 90, Risk: MEDIUM
  Reasoning: Exceptional momentum (+45% in 3M), high volume
              breakout, no nearby resistance, sector bullish
  Entry: 67.50, Target: 82.00, Stop: 61.50
  Reward/Risk: 2.1, Expected Return: 21%
```

---

## Architecture

```
├── scraper.js              - Latest PSX screener data
├── scraper-historical.js   - 5-year historical EOD data
├── import-historical.js    - Import historical data to DB
├── calculate-changes.js    - Calculate price changes
├── analyze-historical.js   - Analyze all historical dates
├── database.js            - PostgreSQL operations
├── analyzer.js            - Multi-factor scoring engine
├── strategies.js          - Investment strategy selector
├── cli.js                 - Command-line interface
├── daily-update.sh        - Complete daily pipeline
├── dashboard/app.py       - Streamlit web interface
└── schema.sql             - Database schema
```

---

## Database Schema

**stocks**: Basic stock information (symbol, name, sector)

**stock_daily_data**: Time-series data (562K+ records)
- Fields: open, high, low, close, volume, market_cap, pe_ratio, etc.
- Price changes: change_1d, change_1w, change_1m, change_3m, change_6m, change_1y
- Coverage: July 2021 to present

**stock_scores**: Analysis scores (223K+ records)
- Scores: financial_health, momentum, dividend, sector, composite
- Risk: volatility, liquidity_score, risk_level

**recommendations**: Strategy picks by timeframe
- Fields: timeframe, target_price, expected_return, risk_reward_ratio
- Reasoning: Explanation for recommendation

---

## Usage Examples

### CLI Interface

```bash
# View all recommendations
node cli.js

# Filter by timeframe
node cli.js --timeframe short
node cli.js --timeframe medium
node cli.js --timeframe long

# Limit results
node cli.js --limit 20

# View specific stock analysis
node cli.js --symbol FFC
```

### Web Dashboard

```bash
streamlit run dashboard/app.py
```

Access at http://localhost:8501

Features:
- Real-time stock screener
- Top 10 recommendations by timeframe
- Historical performance charts
- Risk analysis dashboard
- Sector comparison

---

## Data Sources

**PSX Data Portal**: https://dps.psx.com.pk

**Endpoints Used:**
- Screener: `https://dps.psx.com.pk/screener` (latest data)
- Historical: `https://dps.psx.com.pk/timeseries/eod/{symbol}` (5-year history)

**Data Freshness:**
- Live scraper: Delayed by 15 minutes (PSX delay)
- Historical data: End-of-day prices

---

## Legal Notice

This system collects data from the PSX website. The PSX website restricts automated data collection and requires licensing for commercial use.

**For authorized data access, contact**: marketdatarequest@psx.com.pk

This implementation is for personal investing and educational purposes. Ensure compliance with PSX terms of service.

---

## Automation (Optional)

### Cron Job Setup

Edit crontab:
```bash
crontab -e
```

**Run daily at 6 PM (after market close):**
```bash
0 18 * * 1-5 cd /Users/ahmednaeem/Projects/folio3-learning-portal/stocks-analyze && ./daily-update.sh >> logs/daily-update.log 2>&1
```

**Run every weekday:**
- `0 18 * * 1-5` = Mon-Fri at 6 PM
- `0 17 * * *` = Every day at 5 PM

---

## Troubleshooting

**Scraper fails:**
- Check internet connection
- Verify PSX website is accessible
- Try running with `HEADLESS=false` in .env

**Database errors:**
- Verify PostgreSQL is running
- Check database credentials in .env
- Ensure schema.sql has been executed

**Analysis returns no data:**
- Run scraper first
- Check if stock_daily_data has records
- Verify calculate-changes.js has been run

**Dashboard won't load:**
- Install Python dependencies
- Check database connection
- Verify streamlit is installed

---

## License

MIT License - See LICENSE file for details

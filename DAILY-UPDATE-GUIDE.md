# Daily Stock Analysis Update System

Your PSX Stock Analysis system is configured to automatically run a daily update at **4:00 PM Pakistan Standard Time** (after the market closes at 4:00 PM).

## What Happens Daily at 4:00 PM

The system automatically:

1. **📊 Scrapes Latest Data** - Fetches end-of-day stock prices from PSX screener
2. **🔍 Analyzes Stocks** - Scores stocks on financial health, momentum, dividends, and sector performance
3. **📋 Generates Recommendations** - Creates investment picks for SHORT (1-6 months), MEDIUM (6-18 months), and LONG (18+ months) timeframes
4. **📧 Sends Email Briefing** - Delivers a comprehensive report to your inbox at **ahmednaeem.career@gmail.com**

## Email Briefing Contents

Your daily email includes:

- **Market Overview** - Total stocks analyzed, market sentiment, average score
- **Your Portfolio** - Current value, daily changes, unrealized gains/losses, and alerts
- **Top 5 Opportunities** - Best stocks ranked by composite score
- **Recommendations by Risk** - LOW, MEDIUM, and HIGH risk picks
- **Recommendations by Timeframe** - SHORT, MEDIUM, and LONG-term picks

## Manual Commands

### Run Complete Daily Update Now

```bash
cd /Users/ahmednaeem/Projects/folio3-learning-portal/stocks-analyze
npm run daily-update
```

This runs the complete process (scrape → analyze → recommend → email) immediately.

### Test Email Configuration

```bash
npm run test-email
```

Sends a test email to verify email settings are working.

### Start/Stop Scheduler

```bash
# Start the scheduler (runs daily at 4:00 PM)
npm run scheduler

# Run once immediately
npm run scheduler:once

# Stop the scheduler
npm run scheduler:stop

# Check scheduler status
npm run scheduler:status
```

## Configuration

Email and scheduler settings are in your `.env` file:

```bash
# Email Settings (already configured)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=mailerhere10@gmail.com
EMAIL_APP_PASSWORD="gxib hifn amfv bhcc"

# Scheduler Settings
SCHEDULER_ENABLED=true
SCHEDULER_TIMEZONE=Asia/Karachi
SCHEDULER_CRON=0 16 * * *  # 4:00 PM daily
```

## Customize Schedule Time

To change when the daily update runs, modify `SCHEDULER_CRON` in `.env`:

```bash
# Cron format: minute hour day month weekday
SCHEDULER_CRON=0 16 * * *   # 4:00 PM daily (current)
SCHEDULER_CRON=0 18 * * *   # 6:00 PM daily
SCHEDULER_CRON=30 16 * * *  # 4:30 PM daily
SCHEDULER_CRON=0 9 * * 1-5  # 9:00 AM weekdays only
```

## Troubleshooting

### Email Not Received

1. Check spam/junk folder
2. Verify `USER_EMAIL` is set correctly in `.env`
3. Test email: `npm run test-email`
4. Check Gmail App Password is valid (regenerate if needed)

### Scheduler Not Running

1. Check status: `npm run scheduler:status`
2. Ensure `SCHEDULER_ENABLED=true` in `.env`
3. Restart: `npm run scheduler:stop && npm run scheduler`

### Data Not Updated

1. Check PSX website is accessible
2. Manually run: `npm run daily-update`
3. Check logs for errors

## Files

- `daily-update-with-email.js` - Main daily update script
- `scheduler.js` - Cron scheduler that triggers daily updates
- `notifier.js` - Email sending functionality
- `scraper.js` - PSX data scraper
- `analyzer.js` - Stock scoring and analysis
- `strategies.js` - Recommendation generation

## Quick Start

1. **Start the scheduler:**
   ```bash
   npm run scheduler
   ```

2. **Wait until 4:00 PM** - The system will run automatically

3. **Check your email** at ahmednaeem.career@gmail.com for the daily briefing

4. **Access dashboard** anytime:
   ```bash
   npm run dashboard
   ```
   Then visit: http://localhost:8501

## Notes

- The scheduler must be kept running to trigger daily updates
- For production, consider using a process manager like PM2 or systemd
- Email contains password-protected links for sensitive data
- All times are in Pakistan Standard Time (Asia/Karachi timezone)

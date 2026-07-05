# Daily Scheduler and Email Notification System

## Overview

The PSX Stock Analysis system now includes an automated daily scheduler that runs at 6:00 AM Pakistan Standard Time (Asia/Karachi timezone) and sends comprehensive email briefings.

## Features

- **Automated Daily Execution**: Runs the complete data pipeline (scrape → analyze → recommend) at 6:00 AM PST
- **Email Notifications**: Sends comprehensive daily briefings with:
  - Market overview (stocks analyzed, sentiment, average score)
  - Portfolio health (current value, gains/losses, alerts)
  - Top 5 investment opportunities
  - Recommendations by risk level (LOW/MEDIUM/HIGH)
  - Recommendations by investment horizon (SHORT/MEDIUM/LONG)
- **Portfolio Monitoring**: Tracks your stock holdings with automatic gain/loss calculations
- **Alert Generation**: Notifies significant portfolio changes (>5% gain/loss, >3% daily movement)

## Setup

### 1. Email Configuration

To use Gmail for email notifications, you need to generate an App Password:

1. Enable 2-Factor Authentication on your Google Account
2. Go to Google Account → Security → App Passwords
3. Generate a new app password for "Mail"
4. Add the following to your `.env` file:

```env
EMAIL_SERVICE=gmail
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-app-password  # The 16-character app password
EMAIL_FROM=PSX Stock Analysis <your-email@gmail.com>
```

### 2. User Configuration

Add your email address to receive daily briefings:

```env
USER_EMAIL=your-email@example.com
USER_ID=default
```

### 3. Scheduler Configuration

The scheduler is configured by default to run at 6:00 AM Pakistan Standard Time:

```env
SCHEDULER_ENABLED=true
SCHEDULER_TIMEZONE=Asia/Karachi
SCHEDULER_CRON=0 6 * * *
```

To customize the schedule, modify the `SCHEDULER_CRON` expression (cron format: `minute hour day month day-of-week`).

## Usage

### Start the Scheduler

```bash
npm run scheduler
```

This starts the persistent scheduler that will run daily at the configured time. Keep this process running for automated execution.

### Run Once (Manual Execution)

```bash
npm run scheduler:once
```

This runs the complete pipeline and sends the email immediately, then exits.

### Test Email

```bash
npm run test-email
```

Sends a test email to verify your email configuration is working.

### Check Scheduler Status

```bash
npm run scheduler:status
```

Shows the current scheduler status and configuration.

### Stop the Scheduler

```bash
npm run scheduler:stop
```

Stops the running scheduler.

## Portfolio Management

The system includes a portfolio management feature accessible via the Streamlit dashboard:

1. Start the dashboard: `streamlit run dashboard/app.py`
2. Navigate to the "Portfolio" page
3. Add your stock holdings (symbol, shares, average cost, purchase date)
4. View your portfolio with:
   - Current value and unrealized gains/losses
   - Daily percentage changes
   - Sector allocation pie chart
   - Top gainers and losers
   - Edit and delete functionality

## Email Template

The daily briefing email includes:

- **Header**: Date and market overview
- **Portfolio Section**: Your holdings summary, total value, daily change, and alerts
- **Top 5 Opportunities**: Best-ranked stocks with composite scores and risk levels
- **Recommendations by Risk**: Grouped by LOW/MEDIUM/HIGH risk
- **Recommendations by Timeframe**: SHORT (1-6M), MEDIUM (6-18M), LONG (18M+) recommendations
- **Disclaimer**: Legal notice about educational purposes

## Production Deployment

For production use, consider using PM2 for process management:

1. Install PM2: `npm install -g pm2`
2. Start the scheduler: `pm2 start scheduler.js --name psx-scheduler`
3. Configure log rotation: `pm2 install pm2-logrotate`
4. Monitor: `pm2 monit`
5. View logs: `pm2 logs psx-scheduler`

## Troubleshooting

### Email Not Sending

- Verify your App Password is correct (16 characters, no spaces)
- Check that 2FA is enabled on your Google Account
- Ensure the email configuration in `.env` matches your settings
- Run `npm run test-email` to test the connection

### Scheduler Not Running

- Check `SCHEDULER_ENABLED=true` in `.env`
- Verify the cron expression is valid: `npm run scheduler:status`
- Check system timezone matches `SCHEDULER_TIMEZONE`

### Portfolio Values Not Updating

- Ensure the pipeline has run at least once to populate stock_daily_data
- Click "Refresh Values" in the Portfolio page
- Run the pipeline: `npm run pipeline`

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SCHEDULER (scheduler.js)                 │
│  - Cron job: 0 6 * * * (Asia/Karachi)                       │
│  - Orchestrates daily job execution                          │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
┌─────────────┐ ┌────────────┐ ┌──────────────┐
│   PIPELINE   │ │  PORTFOLIO  │ │  STRATEGIES   │
│   (existing) │ │   MONITOR   │ │  (existing)  │
└──────┬───────┘ └─────┬──────┘ └───────┬──────┘
       │               │                │
       └───────────────┴────────────────┘
                       ▼
              ┌────────────────┐
              │   REPORT DATA  │
              └────────┬───────┘
                       ▼
              ┌────────────────┐
              │    NOTIFIER    │
              │  (nodemailer)  │
              └────────┬───────┘
                       ▼
              ┌────────────────┐
              │  EMAIL BRIEFING│
              └────────────────┘
```

## Files Created/Modified

### New Files
- `notifier.js` - Email service with nodemailer
- `portfolio-monitor.js` - Portfolio tracking and alert generation
- `scheduler.js` - Daily job scheduler with cron
- `templates/daily-briefing.html` - Email HTML template

### Modified Files
- `database.js` - Added portfolio management functions
- `dashboard/app.py` - Added Portfolio management page
- `package.json` - Added nodemailer and scheduler scripts
- `.env.example` - Added email and scheduler configuration

## Database Schema Additions

The following tables are already in the schema:

- `portfolio` - User portfolio holdings
- `portfolio_users` - User account information
- `alerts` - Price movement and signal alerts

## Next Steps

1. Configure your email settings in `.env`
2. Run `npm run test-email` to verify email configuration
3. Add your portfolio holdings via the dashboard
4. Run `npm run scheduler:once` to test the full pipeline
5. Start the scheduler with `npm run scheduler` for daily execution

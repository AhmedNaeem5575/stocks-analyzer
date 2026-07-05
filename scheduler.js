/**
 * Daily Scheduler Module
 * Orchestrates the daily stock analysis and email notification workflow
 * Runs at 4:00 PM Pakistan Standard Time (Asia/Karachi timezone)
 * After market close when data is available
 */

const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

function colorize(text, color) {
  return `${colors[color] || ''}${text}${colors.reset}`;
}

// Scheduler state
let scheduledTask = null;
let isRunning = false;

/**
 * Get user ID from environment
 */
async function getUserId() {
  const userEmail = process.env.USER_EMAIL || process.env.EMAIL_USER;
  return await database.getOrCreateUserId(userEmail);
}

/**
 * Generate report data for email
 */
async function generateReportData() {
  console.log(colorize('[Scheduler] Generating report data...', 'cyan'));

  const userId = await getUserId();

  // Get market overview
  const latestStocks = await database.getLatestStockData();
  const marketOverview = {
    totalStocks: latestStocks.length,
    sentiment: calculateMarketSentiment(latestStocks),
    avgScore: latestStocks.length > 0
      ? latestStocks.reduce((sum, s) => sum + (s.composite_score || 0), 0) / latestStocks.length
      : 0
  };

  // Get top opportunities
  const topOpportunities = latestStocks.slice(0, 5).map(s => ({
    symbol: s.symbol,
    composite_score: Math.round(s.composite_score || 0),
    risk_level: s.risk_level || 'N/A',
    current_price: s.current_price ? s.current_price.toFixed(2) : 'N/A'
  }));

  // Get recommendations by risk
  const recommendationsByRisk = {
    LOW: latestStocks.filter(s => s.risk_level === 'LOW').slice(0, 5),
    MEDIUM: latestStocks.filter(s => s.risk_level === 'MEDIUM').slice(0, 5),
    HIGH: latestStocks.filter(s => s.risk_level === 'HIGH').slice(0, 5)
  };

  // Get recommendations by timeframe
  const shortTermRecs = await database.getTopRecommendations('SHORT', 5);
  const mediumTermRecs = await database.getTopRecommendations('MEDIUM', 5);
  const longTermRecs = await database.getTopRecommendations('LONG', 5);

  const recommendationsByTimeframe = {
    SHORT: shortTermRecs.map(r => ({ symbol: r.symbol, composite_score: r.composite_score })),
    MEDIUM: mediumTermRecs.map(r => ({ symbol: r.symbol, composite_score: r.composite_score })),
    LONG: longTermRecs.map(r => ({ symbol: r.symbol, composite_score: r.composite_score }))
  };

  // Get portfolio report
  const portfolioReport = await portfolioMonitor.monitorPortfolio(userId);
  const portfolio = portfolioReport.hasHoldings
    ? portfolioMonitor.formatPortfolioForEmail(portfolioReport)
    : null;

  return {
    marketOverview,
    topOpportunities,
    recommendationsByRisk,
    recommendationsByTimeframe,
    portfolio
  };
}

/**
 * Calculate market sentiment based on stock data
 */
function calculateMarketSentiment(stocks) {
  if (!stocks || stocks.length === 0) return 'Neutral';

  const avgChange1d = stocks.reduce((sum, s) => sum + (s.change_1d || 0), 0) / stocks.length;

  if (avgChange1d > 1) return 'Bullish';
  if (avgChange1d < -1) return 'Bearish';
  return 'Neutral';
}

/**
 * Run the complete daily job
 */
async function runDailyJob() {
  if (isRunning) {
    console.log(colorize('[Scheduler] ⚠ Job already running, skipping...', 'yellow'));
    return { success: false, message: 'Job already running' };
  }

  isRunning = true;
  const startTime = Date.now();

  console.log(colorize('\n' + '='.repeat(60), 'cyan'));
  console.log(colorize('[Scheduler] 📅 Starting Daily Stock Analysis Job', 'bright'));
  console.log(colorize('[Scheduler] Time: ' + new Date().toISOString(), 'cyan'));
  console.log(colorize('='.repeat(60) + '\n', 'cyan'));

  try {
    // Run the daily update script
    console.log(colorize('[Scheduler] Running daily update (scrape → analyze → recommend → email)...', 'cyan'));

    const result = await spawnPromise('node', ['daily-update-with-email.js']);

    const duration = Math.round((Date.now() - startTime) / 1000);

    if (result.success) {
      console.log(colorize(`\n[Scheduler] ✓ Daily update completed successfully in ${duration}s`, 'green'));
      console.log(colorize('='.repeat(60) + '\n', 'cyan'));
    } else {
      console.log(colorize(`\n[Scheduler] ✗ Daily update failed after ${duration}s`, 'red'));
      console.log(colorize(`[Scheduler] Error: ${result.error}`, 'red'));
      console.log(colorize('='.repeat(60) + '\n', 'cyan'));
    }

    isRunning = false;
    return result;

  } catch (error) {
    isRunning = false;
    console.error(colorize(`\n[Scheduler] ✗ Fatal error: ${error.message}`, 'red'));
    console.log(colorize('='.repeat(60) + '\n', 'cyan'));
    return { success: false, error: error.message };
  }
}

/**
 * Spawn a command and return a promise
 */
function spawnPromise(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: `Process exited with code ${code}` });
      }
    });

    proc.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });
  });
}

/**
 * Start the scheduler
 */
function start() {
  if (scheduledTask) {
    console.log(colorize('[Scheduler] ⚠ Scheduler already running', 'yellow'));
    return false;
  }

  const enabled = process.env.SCHEDULER_ENABLED !== 'false';
  if (!enabled) {
    console.log(colorize('[Scheduler] Scheduler is disabled (SCHEDULER_ENABLED=false)', 'yellow'));
    return false;
  }

  const timezone = process.env.SCHEDULER_TIMEZONE || 'Asia/Karachi';
  const cronExpression = process.env.SCHEDULER_CRON || '0 16 * * *'; // 4:00 PM daily (after market close)

  console.log(colorize('[Scheduler] Starting daily scheduler...', 'cyan'));
  console.log(colorize(`[Scheduler] Timezone: ${timezone}`, 'cyan'));
  console.log(colorize(`[Scheduler] Schedule: ${cronExpression} (4:00 PM Pakistan Time - After Market Close)`, 'cyan'));

  // Validate cron expression
  if (!cron.validate(cronExpression)) {
    console.error(colorize(`[Scheduler] ✗ Invalid cron expression: ${cronExpression}`, 'red'));
    return false;
  }

  // Start scheduled task
  scheduledTask = cron.schedule(
    cronExpression,
    async () => {
      await runDailyJob();
    },
    { timezone }
  );

  console.log(colorize('[Scheduler] ✓ Scheduler started successfully', 'green'));
  console.log(colorize('[Scheduler] Next run: Calculated by cron in ' + timezone + ' timezone', 'cyan'));

  return true;
}

/**
 * Stop the scheduler
 */
function stop() {
  if (!scheduledTask) {
    console.log(colorize('[Scheduler] ⚠ Scheduler not running', 'yellow'));
    return false;
  }

  scheduledTask.stop();
  scheduledTask = null;

  console.log(colorize('[Scheduler] ✓ Scheduler stopped', 'green'));
  return true;
}

/**
 * Get scheduler status
 */
function getStatus() {
  return {
    isRunning: !!scheduledTask,
    isJobRunning: isRunning,
    enabled: process.env.SCHEDULER_ENABLED !== 'false',
    timezone: process.env.SCHEDULER_TIMEZONE || 'Asia/Karachi',
    cronExpression: process.env.SCHEDULER_CRON || '0 6 * * *'
  };
}

/**
 * Run job once immediately (manual trigger)
 */
async function runOnce() {
  console.log(colorize('[Scheduler] Running manual job execution...', 'cyan'));
  return await runDailyJob();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(colorize('\n[Scheduler] Received SIGINT, stopping scheduler...', 'yellow'));
  stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(colorize('\n[Scheduler] Received SIGTERM, stopping scheduler...', 'yellow'));
  stop();
  process.exit(0);
});

// Start scheduler if this file is run directly
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--once')) {
    // Run once and exit
    runOnce()
      .then(result => {
        process.exit(result.success ? 0 : 1);
      })
      .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
      });
  } else if (args.includes('--stop')) {
    stop();
  } else if (args.includes('--status')) {
    const status = getStatus();
    console.log('Scheduler Status:', JSON.stringify(status, null, 2));
  } else {
    // Start persistent scheduler
    start();

    // Keep process running
    console.log(colorize('[Scheduler] Press Ctrl+C to stop', 'cyan'));
  }
}

module.exports = {
  runDailyJob,
  start,
  stop,
  getStatus,
  runOnce
};

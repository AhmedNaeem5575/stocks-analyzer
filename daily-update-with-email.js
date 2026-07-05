#!/usr/bin/env node

/**
 * Daily Update with Email
 *
 * This script runs the complete daily process:
 * 1. Scrapes latest stock data from PSX
 * 2. Analyzes and scores stocks
 * 3. Generates investment recommendations
 * 4. Sends email briefing to user
 *
 * Intended to run daily at 4:00 PM Pakistan time (after market close)
 *
 * Usage:
 *   node daily-update-with-email.js
 *
 * Environment variables:
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 *   EMAIL_USER, EMAIL_APP_PASSWORD, EMAIL_HOST, EMAIL_PORT
 */

require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runDailyUpdate() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  log('\n' + '='.repeat(60), 'cyan');
  log('  PSX Stock Analysis - Daily Update with Email', 'cyan');
  log('  Started: ' + new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }), 'cyan');
  log('='.repeat(60) + '\n', 'cyan');

  try {
    // Step 1: Scrape latest stock data
    log('📊 Step 1: Scraping latest stock data from PSX...', 'cyan');
    const { spawn } = require('child_process');

    await runCommand('node', ['scraper.js'], 'Scraper');
    log('  ✓ Stock data scraped successfully\n', 'green');

    // Step 2: Analyze and score stocks
    log('🔍 Step 2: Analyzing and scoring stocks...', 'cyan');
    await runCommand('node', ['analyzer.js'], 'Analyzer');
    log('  ✓ Stocks analyzed and scored\n', 'green');

    // Step 3: Generate recommendations
    log('📋 Step 3: Generating investment recommendations...', 'cyan');
    await runCommand('node', ['strategies.js'], 'Strategies');
    log('  ✓ Recommendations generated\n', 'green');

    // Step 4: Prepare and send email briefing
    log('📧 Step 4: Preparing email briefing...', 'cyan');

    const database = require('./database');
    const notifier = require('./notifier');

    // Get user email
    const userEmail = await database.getUserEmail('ahmednaeem5575');
    if (!userEmail) {
      throw new Error('User email not found');
    }
    log(`  → Recipient: ${userEmail}\n`, 'cyan');

    // Prepare report data
    const reportData = await prepareReportData();

    // Send email
    log('  📨 Sending email...', 'cyan');
    const emailResult = await notifier.sendDailyBriefing(reportData, userEmail);

    if (emailResult.success) {
      log('  ✓ Email briefing sent successfully!\n', 'green');
    } else {
      log('  ✗ Email failed: ' + emailResult.error, 'red');
      throw new Error('Email sending failed');
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log('='.repeat(60), 'cyan');
    log('  ✓ Daily update completed successfully!', 'green');
    log(`  Duration: ${duration} seconds`, 'cyan');
    log(`  Completed: ${new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}`, 'cyan');
    log('='.repeat(60) + '\n', 'cyan');

    process.exit(0);

  } catch (error) {
    log('\n❌ Daily update failed: ' + error.message, 'red');
    log('Stack trace:', 'red');
    console.error(error);
    process.exit(1);
  }
}

function runCommand(command, args, label) {
  return new Promise((resolve, reject) => {
    const spawn = require('child_process').spawn;

    const proc = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, PWD: process.cwd() }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} failed with exit code ${code}`));
      }
    });

    proc.on('error', (error) => {
      reject(new Error(`${label} error: ${error.message}`));
    });
  });
}

async function prepareReportData() {
  const database = require('./database');

  // Get market overview
  const marketOverview = await getMarketOverview();

  // Get portfolio data
  const portfolio = await getPortfolioData();

  // Get top opportunities and parse data
  const topOpportunitiesRaw = await database.getTopRecommendations('SHORT', 5);
  const topOpportunities = topOpportunitiesRaw.map(stock => ({
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    composite_score: parseFloat(stock.composite_score) || 0,
    risk_level: stock.risk_level || 'UNKNOWN',
    current_price: parseFloat(stock.current_price) || 0,
    entry_price: parseFloat(stock.entry_price) || 0,
    target_price: parseFloat(stock.target_price) || 0,
    expected_return: parseFloat(stock.expected_return) || 0,
    timeframe: stock.timeframe,
    strategy_type: stock.strategy_type,
    recommendation_rank: stock.recommendation_rank
  }));

  // Get recommendations by risk
  const recommendationsByRisk = await getRecommendationsByRisk();

  // Get recommendations by timeframe
  const recommendationsByTimeframe = await getRecommendationsByTimeframe();

  return {
    timestamp: new Date().toISOString(),
    marketOverview,
    portfolio,
    topOpportunities,
    recommendationsByRisk,
    recommendationsByTimeframe
  };
}

async function getMarketOverview() {
  const database = require('./database');
  const pool = database.pool;

  try {
    const result = await pool.query(`
      SELECT
        COUNT(DISTINCT d.symbol) as total_stocks,
        AVG(sc.composite_score) as avg_score,
        COUNT(CASE WHEN sc.composite_score >= 70 THEN 1 END) as high_score_count
      FROM stock_daily_data d
      LEFT JOIN stock_scores sc ON d.symbol = sc.symbol
        AND sc.time = (
          SELECT MAX(time) FROM stock_scores
        )
      WHERE d.time = (
        SELECT MAX(time) FROM stock_daily_data
      )
    `);

    const row = result.rows[0];

    // Determine sentiment
    const avgScore = parseFloat(row.avg_score) || 50;
    let sentiment = 'Neutral';
    if (avgScore >= 65) sentiment = 'Bullish';
    else if (avgScore >= 55) sentiment = 'Slightly Bullish';
    else if (avgScore <= 35) sentiment = 'Bearish';
    else if (avgScore <= 45) sentiment = 'Slightly Bearish';

    return {
      totalStocks: parseInt(row.total_stocks) || 0,
      avgScore: avgScore,
      sentiment: sentiment
    };
  } catch (error) {
    console.error('Error getting market overview:', error.message);
    return {
      totalStocks: 0,
      avgScore: 50,
      sentiment: 'Neutral'
    };
  }
}

async function getPortfolioData() {
  const database = require('./database');
  const pool = database.pool;

  try {
    // Get user ID
    const userResult = await pool.query('SELECT id FROM users WHERE username = $1', ['ahmednaeem5575']);
    if (userResult.rows.length === 0) {
      return {
        totalValue: 0,
        dailyChange: 0,
        unrealizedGainLoss: 0,
        alerts: []
      };
    }

    const userId = userResult.rows[0].id;

    // Get portfolio summary
    const summary = await database.getPortfolioSummary(userId);

    // Get alerts
    const alerts = await database.getUnreadAlerts(userId, 5);

    return {
      totalValue: summary.total_value || 0,
      dailyChange: parseFloat(summary.avg_return_pct) || 0,
      unrealizedGainLoss: parseFloat(summary.total_gain_loss) || 0,
      alerts: alerts.map(a => ({
        symbol: a.symbol,
        message: a.message,
        created_at: a.created_at
      }))
    };
  } catch (error) {
    console.error('Error getting portfolio data:', error.message);
    return {
      totalValue: 0,
      dailyChange: 0,
      unrealizedGainLoss: 0,
      alerts: []
    };
  }
}

async function getRecommendationsByRisk() {
  const database = require('./database');
  const pool = database.pool;

  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (r.symbol)
        r.symbol,
        s.name,
        sc.composite_score,
        sc.risk_level,
        r.expected_return,
        r.target_price,
        r.entry_price,
        d.close as current_price
      FROM (
        SELECT *
        FROM recommendations
        WHERE timeframe = 'SHORT'
          AND time >= date_trunc('minute', (
            SELECT MAX(time) FROM recommendations WHERE timeframe = 'SHORT'
          ))
          AND time < date_trunc('minute', (
            SELECT MAX(time) FROM recommendations WHERE timeframe = 'SHORT'
          )) + interval '1 minute'
      ) r
      JOIN stocks s ON r.symbol = s.symbol
      LEFT JOIN stock_scores sc ON r.symbol = sc.symbol
        AND sc.time = (SELECT MAX(time) FROM stock_scores WHERE symbol = r.symbol)
      LEFT JOIN LATERAL (
        SELECT close, symbol
        FROM stock_daily_data
        WHERE symbol = r.symbol
        ORDER BY time DESC
        LIMIT 1
      ) d ON true
      ORDER BY r.symbol, r.recommendation_rank
    `);

    const byRisk = { LOW: [], MEDIUM: [], HIGH: [] };

    result.rows.forEach(row => {
      const risk = row.risk_level || 'UNKNOWN';
      if (byRisk[risk]) {
        byRisk[risk].push({
          symbol: row.symbol,
          name: row.name,
          composite_score: parseFloat(row.composite_score) || 0,
          risk_level: row.risk_level || 'UNKNOWN',
          current_price: parseFloat(row.current_price) || 0,
          expected_return: parseFloat(row.expected_return) || 0,
          target_price: parseFloat(row.target_price) || 0,
          entry_price: parseFloat(row.entry_price) || 0
        });
      }
    });

    return byRisk;
  } catch (error) {
    console.error('Error getting recommendations by risk:', error.message);
    return { LOW: [], MEDIUM: [], HIGH: [] };
  }
}

async function getRecommendationsByTimeframe() {
  const database = require('./database');
  const pool = database.pool;

  const timeframes = ['SHORT', 'MEDIUM', 'LONG'];
  const result = {};

  for (const tf of timeframes) {
    try {
      const rows = await pool.query(`
        SELECT DISTINCT ON (r.symbol)
          r.symbol,
          sc.composite_score,
          sc.risk_level,
          d.close as current_price
        FROM (
          SELECT *
          FROM recommendations
          WHERE timeframe = $1
            AND time >= date_trunc('minute', (
              SELECT MAX(time) FROM recommendations WHERE timeframe = $1
            ))
            AND time < date_trunc('minute', (
              SELECT MAX(time) FROM recommendations WHERE timeframe = $1
            )) + interval '1 minute'
        ) r
        LEFT JOIN stock_scores sc ON r.symbol = sc.symbol
          AND sc.time = (SELECT MAX(time) FROM stock_scores WHERE symbol = r.symbol)
        LEFT JOIN LATERAL (
          SELECT close, symbol
          FROM stock_daily_data
          WHERE symbol = r.symbol
          ORDER BY time DESC
          LIMIT 1
        ) d ON true
        ORDER BY r.symbol, r.recommendation_rank
        LIMIT 10
      `, [tf]);

      result[tf] = rows.rows.map(row => ({
        symbol: row.symbol,
        composite_score: parseFloat(row.composite_score) || 0,
        risk_level: row.risk_level || 'UNKNOWN',
        current_price: parseFloat(row.current_price) || 0
      }));
    } catch (error) {
      result[tf] = [];
    }
  }

  return result;
}

// Run the daily update
if (require.main === module) {
  runDailyUpdate().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runDailyUpdate };

/**
 * Historical Analysis Script
 * Analyzes stock data for all historical dates to populate stock_scores table
 */

const database = require('./database');
require('dotenv').config();

/**
 * Calculate all scores for a stock at a specific date
 */
async function analyzeStockForDate(stockData, sectorData, stockHistory) {
  // Import scoring functions from analyzer
  const {
    calculateFinancialHealthScore,
    calculateMomentumScore,
    calculateDividendScore,
    calculateSectorScore,
    calculateCompositeScore,
    calculateVolatility,
    calculateLiquidityScore,
    determineRiskLevel
  } = require('./analyzer');

  const financialHealth = calculateFinancialHealthScore(stockData, sectorData);
  const momentum = calculateMomentumScore(stockData, stockHistory);
  const dividend = calculateDividendScore(stockData, stockHistory);
  const sector = calculateSectorScore(stockData, sectorData);
  const volatility = calculateVolatility(stockHistory);
  const liquidity = calculateLiquidityScore(stockData);
  const riskLevel = determineRiskLevel(volatility, financialHealth, liquidity);
  const compositeScore = calculateCompositeScore(financialHealth, momentum, dividend, sector);

  return {
    time: stockData.time,
    symbol: stockData.symbol,
    financial_health_score: financialHealth,
    momentum_score: momentum,
    dividend_score: dividend,
    sector_score: sector,
    composite_score: compositeScore,
    volatility,
    liquidity_score: liquidity,
    risk_level: riskLevel
  };
}

/**
 * Load all historical data into memory
 * Returns Map<symbol, Array<historical_data>>
 */
async function loadAllHistoricalData() {
  console.log('Loading all historical data into memory...');

  const result = await database.pool.query(`
    SELECT symbol, time, open, high, low, close, volume
    FROM stock_daily_data
    ORDER BY symbol, time
  `);

  const historicalMap = new Map();

  for (const row of result.rows) {
    if (!historicalMap.has(row.symbol)) {
      historicalMap.set(row.symbol, []);
    }
    historicalMap.get(row.symbol).push(row);
  }

  console.log(`  Loaded ${result.rows.length} records for ${historicalMap.size} symbols`);

  return historicalMap;
}

/**
 * Analyze all stocks for a specific date
 */
async function analyzeDate(date, allHistoricalData, sectorData) {
  console.log(`\nAnalyzing date: ${date.toISOString().substring(0, 10)}`);

  // Get all stock data for this date
  const result = await database.pool.query(`
    SELECT
      s.symbol,
      s.name,
      s.sector,
      s.industry,
      d.time,
      d.open,
      d.high,
      d.low,
      d.close,
      d.volume,
      d.market_cap,
      d.pe_ratio,
      d.pb_ratio,
      d.dividend_yield,
      d.free_float,
      d.free_float_pct,
      d.avg_volume_30d,
      d.change_1d,
      d.change_1w,
      d.change_1m,
      d.change_3m,
      d.change_6m,
      d.change_1y
    FROM stock_daily_data d
    JOIN stocks s ON d.symbol = s.symbol
    WHERE d.time::date = $1
    ORDER BY s.symbol
  `, [date]);

  if (result.rows.length === 0) {
    console.log(`  No data found for ${date.toISOString().substring(0, 10)}`);
    return { success: false, date, count: 0 };
  }

  console.log(`  Found ${result.rows.length} stocks`);

  // Analyze each stock and collect scores
  const scores = [];
  let successCount = 0;
  let failureCount = 0;

  for (const stock of result.rows) {
    try {
      // Get historical data for this stock from memory (up to this date)
      let history = [];
      if (allHistoricalData.has(stock.symbol)) {
        const allHistory = allHistoricalData.get(stock.symbol);
        // Filter to only include data up to this date, take last 252 records
        const filtered = allHistory.filter(h => h.time <= date);
        history = filtered.slice(-252);
      }

      const scoreData = await analyzeStockForDate(stock, sectorData, history);
      scores.push(scoreData);
      successCount++;

    } catch (error) {
      failureCount++;
      if (failureCount <= 5) {
        console.log(`    ✗ Failed ${stock.symbol}: ${error.message.substring(0, 80)}`);
      }
    }
  }

  // Bulk insert all scores for this date
  if (scores.length > 0) {
    try {
      const bulkResult = await database.bulkInsertScores(scores);
      console.log(`  ✓ Analyzed: ${bulkResult.successCount} succeeded, ${bulkResult.failureCount} failed`);
    } catch (error) {
      console.error(`  ✗ Bulk insert failed: ${error.message}`);
    }
  }

  return {
    success: true,
    date,
    count: result.rows.length,
    successCount,
    failureCount,
    scores
  };
}

/**
 * Get all distinct dates from stock_daily_data
 */
async function getAllHistoricalDates() {
  const result = await database.pool.query(`
    SELECT DISTINCT time::date as date
    FROM stock_daily_data
    ORDER BY date DESC
  `);

  return result.rows.map(r => r.date);
}

/**
 * Check which dates already have scores
 */
async function getDatesWithoutScores(dates) {
  if (dates.length === 0) return [];

  const result = await database.pool.query(`
    SELECT DISTINCT time::date as date
    FROM stock_scores
    WHERE time::date = ANY($1)
  `, [dates]);

  const datesWithScores = new Set(result.rows.map(r => r.date.toISOString().substring(0, 10)));
  return dates.filter(d => !datesWithScores.has(d.toISOString().substring(0, 10)));
}

/**
 * Analyze all historical dates
 */
async function analyzeAllHistory(options = {}) {
  const {
    limit = null,
    startDate = null,
    resume = true
  } = options;

  console.log('=== Historical Analysis ===\n');

  // Test database connection
  const isConnected = await database.testConnection();
  if (!isConnected) {
    console.error('Database connection failed');
    process.exit(1);
  }

  // Get all historical dates
  let allDates = await getAllHistoricalDates();
  console.log(`Found ${allDates.length} distinct dates in stock_daily_data`);

  if (startDate) {
    const start = new Date(startDate);
    allDates = allDates.filter(d => d >= start);
    console.log(`Filtered to ${allDates.length} dates from ${startDate}`);
  }

  // Filter out dates that already have scores
  let datesToAnalyze = allDates;
  if (resume) {
    datesToAnalyze = await getDatesWithoutScores(allDates);
    console.log(`Dates without scores: ${datesToAnalyze.length}`);
  }

  // Apply limit
  if (limit && datesToAnalyze.length > limit) {
    datesToAnalyze = datesToAnalyze.slice(0, limit);
    console.log(`Limited to ${limit} dates`);
  }

  if (datesToAnalyze.length === 0) {
    console.log('\nAll dates already have scores. Nothing to do.');
    return { success: true, totalDates: 0, analyzed: 0 };
  }

  console.log(`\nStarting analysis for ${datesToAnalyze.length} dates...\n`);

  // Preload all historical data into memory
  const allHistoricalData = await loadAllHistoricalData();

  // Get sector data once (reuse for all dates)
  const sectorData = await database.getSectorPerformance();

  let totalAnalyzed = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  const startTime = Date.now();

  // Analyze each date
  for (let i = 0; i < datesToAnalyze.length; i++) {
    const date = datesToAnalyze[i];
    const progress = ((i + 1) / datesToAnalyze.length * 100).toFixed(1);

    console.log(`[${i + 1}/${datesToAnalyze.length}] ${progress}% - ${date.toISOString().substring(0, 10)}`);

    try {
      const result = await analyzeDate(date, allHistoricalData, sectorData);
      totalAnalyzed++;
      totalSuccess += result.successCount || 0;
      totalFailed += result.failureCount || 0;

    } catch (error) {
      console.error(`  ✗ Analysis failed: ${error.message}`);
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);

  console.log(`\n=== Summary ===`);
  console.log(`Total dates analyzed: ${totalAnalyzed}`);
  console.log(`Total stock scores: ${totalSuccess} succeeded, ${totalFailed} failed`);
  console.log(`Duration: ${duration}s`);

  await database.closePool();

  return {
    success: true,
    totalDates: datesToAnalyze.length,
    analyzed: totalAnalyzed,
    totalSuccess,
    totalFailed,
    duration
  };
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);

  const options = {};
  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--start=')) {
      options.startDate = arg.split('=')[1];
    } else if (arg === '--full') {
      options.resume = false;
    } else if (arg.startsWith('--date=') || arg.startsWith('-d=')) {
      options.startDate = arg.split('=')[1] || arg.split('=')[1];
    } else if (arg === '--resume') {
      options.resume = true;
    }
  }

  // If no start date provided but args exist, treat first arg as date
  if (!options.startDate && args.length > 0 && !args[0].startsWith('--')) {
    options.startDate = args[0];
  }

  analyzeAllHistory(options)
    .then(result => {
      if (result.success) {
        console.log('\n✓ Historical analysis completed');
      } else {
        console.log('\n✗ Historical analysis failed');
      }
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  analyzeStockForDate,
  analyzeDate,
  analyzeAllHistory,
  getAllHistoricalDates,
  loadAllHistoricalData
};

/**
 * Database Operations Module
 * Handles all PostgreSQL database operations for the PSX Stock Analysis System
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'psx_stocks',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection cannot be established
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('Database connection successful:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}

/**
 * Initialize database schema
 */
async function initializeSchema() {
  try {
    const fs = require('fs');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(schema);
    console.log('Database schema initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize schema:', error.message);
    return false;
  }
}

/**
 * Insert or update stock basic information
 */
async function upsertStock(stockData) {
  const { symbol, name, sector, industry, listed_date, face_value } = stockData;

  const query = `
    INSERT INTO stocks (symbol, name, sector, industry, listed_date, face_value, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (symbol)
    DO UPDATE SET
      name = EXCLUDED.name,
      sector = EXCLUDED.sector,
      industry = EXCLUDED.industry,
      listed_date = EXCLUDED.listed_date,
      face_value = EXCLUDED.face_value,
      updated_at = NOW()
  `;

  try {
    await pool.query(query, [symbol, name, sector, industry, listed_date, face_value]);
    return { success: true, symbol };
  } catch (error) {
    console.error(`Error upserting stock ${symbol}:`, error.message);
    return { success: false, symbol, error: error.message };
  }
}

/**
 * Insert daily stock data (time-series)
 */
async function insertDailyData(dailyData) {
  const query = `
    INSERT INTO stock_daily_data (
      time, scrape_id, scrape_date, symbol, open, high, low, close, volume, market_cap,
      pe_ratio, pb_ratio, dividend_yield, free_float, free_float_pct,
      avg_volume_30d, change_1d, change_1w, change_1m, change_3m,
      change_6m, change_1y
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
    ON CONFLICT (time, symbol)
    DO UPDATE SET
      open = EXCLUDED.open,
      high = EXCLUDED.high,
      low = EXCLUDED.low,
      close = EXCLUDED.close,
      volume = EXCLUDED.volume,
      market_cap = EXCLUDED.market_cap,
      pe_ratio = EXCLUDED.pe_ratio,
      pb_ratio = EXCLUDED.pb_ratio,
      dividend_yield = EXCLUDED.dividend_yield,
      free_float = EXCLUDED.free_float,
      free_float_pct = EXCLUDED.free_float_pct,
      avg_volume_30d = EXCLUDED.avg_volume_30d,
      change_1d = EXCLUDED.change_1d,
      change_1w = EXCLUDED.change_1w,
      change_1m = EXCLUDED.change_1m,
      change_3m = EXCLUDED.change_3m,
      change_6m = EXCLUDED.change_6m,
      change_1y = EXCLUDED.change_1y
  `;

  try {
    await pool.query(query, [
      dailyData.time || new Date(),
      dailyData.scrape_id || 'manual',
      dailyData.scrape_date || dailyData.time || new Date(),
      dailyData.symbol,
      dailyData.open,
      dailyData.high,
      dailyData.low,
      dailyData.close,
      dailyData.volume,
      dailyData.market_cap,
      dailyData.pe_ratio,
      dailyData.pb_ratio,
      dailyData.dividend_yield,
      dailyData.free_float,
      dailyData.free_float_pct,
      dailyData.avg_volume_30d,
      dailyData.change_1d,
      dailyData.change_1w,
      dailyData.change_1m,
      dailyData.change_3m,
      dailyData.change_6m,
      dailyData.change_1y
    ]);
    return { success: true, symbol: dailyData.symbol };
  } catch (error) {
    console.error(`Error inserting daily data for ${dailyData.symbol}:`, error.message);
    return { success: false, symbol: dailyData.symbol, error: error.message };
  }
}

/**
 * Insert stock analysis scores
 */
async function insertScore(scoreData) {
  const query = `
    INSERT INTO stock_scores (
      time, symbol, financial_health_score, momentum_score,
      dividend_score, sector_score, composite_score,
      volatility, liquidity_score, risk_level
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (time, symbol)
    DO UPDATE SET
      financial_health_score = EXCLUDED.financial_health_score,
      momentum_score = EXCLUDED.momentum_score,
      dividend_score = EXCLUDED.dividend_score,
      sector_score = EXCLUDED.sector_score,
      composite_score = EXCLUDED.composite_score,
      volatility = EXCLUDED.volatility,
      liquidity_score = EXCLUDED.liquidity_score,
      risk_level = EXCLUDED.risk_level
  `;

  try {
    await pool.query(query, [
      scoreData.time || new Date(),
      scoreData.symbol,
      scoreData.financial_health_score,
      scoreData.momentum_score,
      scoreData.dividend_score,
      scoreData.sector_score,
      scoreData.composite_score,
      scoreData.volatility,
      scoreData.liquidity_score,
      scoreData.risk_level
    ]);
    return { success: true, symbol: scoreData.symbol };
  } catch (error) {
    console.error(`Error inserting score for ${scoreData.symbol}:`, error.message);
    return { success: false, symbol: scoreData.symbol, error: error.message };
  }
}

/**
 * Insert recommendation
 */
async function insertRecommendation(recData) {
  const query = `
    INSERT INTO recommendations (
      time, symbol, timeframe, strategy_type, recommendation_rank,
      target_price, expected_return, risk_reward_ratio,
      entry_price, stop_loss, reasoning
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `;

  try {
    await pool.query(query, [
      recData.time || new Date(),
      recData.symbol,
      recData.timeframe,
      recData.strategy_type,
      recData.recommendation_rank,
      recData.target_price,
      recData.expected_return,
      recData.risk_reward_ratio,
      recData.entry_price,
      recData.stop_loss,
      recData.reasoning
    ]);
    return { success: true, symbol: recData.symbol };
  } catch (error) {
    console.error(`Error inserting recommendation for ${recData.symbol}:`, error.message);
    return { success: false, symbol: recData.symbol, error: error.message };
  }
}

/**
 * Get latest stock data with scores (for dashboard/recommendations)
 */
async function getLatestStockData(symbol = null) {
  let query = `
    SELECT * FROM v_stock_analysis
  `;

  const params = [];
  if (symbol) {
    query += ' WHERE symbol = $1';
    params.push(symbol);
  }

  query += ' ORDER BY composite_score DESC';

  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching latest stock data:', error.message);
    return [];
  }
}

/**
 * Get latest stock data for analysis (doesn't require scores to exist)
 * Used by analyzer to calculate fresh scores from raw daily data
 */
async function getLatestStockDataForAnalysis(symbol = null) {
  const params = [];
  let query = `
    SELECT
      s.symbol,
      s.name,
      s.sector,
      s.industry,
      d.close,
      d.open,
      d.high,
      d.low,
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
      d.change_1y,
      d.time
    FROM stocks s
    JOIN stock_daily_data d ON s.symbol = d.symbol
    WHERE d.time = (SELECT MAX(time) FROM stock_daily_data)
  `;

  if (symbol) {
    query += ' AND s.symbol = $1';
    params.push(symbol);
  }

  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching stock data for analysis:', error.message);
    return [];
  }
}

/**
 * Get top recommendations by timeframe
 */
async function getTopRecommendations(timeframe = 'SHORT', limit = 10) {
  const query = `
    SELECT * FROM v_top_recommendations
    WHERE timeframe = $1
    ORDER BY recommendation_rank
    LIMIT $2
  `;

  try {
    const result = await pool.query(query, [timeframe, limit]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching recommendations:', error.message);
    return [];
  }
}

/**
 * Get stock history for analysis
 */
async function getStockHistory(symbol, startDate, endDate) {
  const query = `
    SELECT time, open, high, low, close, volume, market_cap, pe_ratio, dividend_yield
    FROM stock_daily_data
    WHERE symbol = $1
      AND time >= $2
      AND time <= $3
    ORDER BY time ASC
  `;

  try {
    const result = await pool.query(query, [symbol, startDate, endDate]);
    return result.rows;
  } catch (error) {
    console.error(`Error fetching history for ${symbol}:`, error.message);
    return [];
  }
}

/**
 * Get sector performance data
 */
async function getSectorPerformance() {
  const query = `
    SELECT * FROM sector_performance
    WHERE time = (SELECT MAX(time) FROM sector_performance)
    ORDER BY momentum_score DESC
  `;

  try {
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error('Error fetching sector performance:', error.message);
    return [];
  }
}

/**
 * Log scraping operation
 */
async function logScrape(scrapeData) {
  const query = `
    INSERT INTO scrape_log (scrape_time, status, stocks_scraped, errors, error_details, duration_seconds, data_source)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `;

  try {
    const result = await pool.query(query, [
      scrapeData.scrape_time || new Date(),
      scrapeData.status,
      scrapeData.stocks_scraped,
      scrapeData.errors,
      scrapeData.error_details,
      scrapeData.duration_seconds,
      scrapeData.data_source
    ]);
    return { success: true, id: result.rows[0].id };
  } catch (error) {
    console.error('Error logging scrape:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Bulk insert stocks
 */
async function bulkInsertStocks(stocks) {
  const client = await pool.connect();
  let successCount = 0;
  let failureCount = 0;

  try {
    await client.query('BEGIN');

    for (const stock of stocks) {
      try {
        await upsertStock(stock);
        successCount++;
      } catch (error) {
        failureCount++;
        console.error(`Failed to insert ${stock.symbol}:`, error.message);
      }
    }

    await client.query('COMMIT');
    console.log(`Bulk insert completed: ${successCount} succeeded, ${failureCount} failed`);
    return { success: true, successCount, failureCount };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Bulk insert transaction failed:', error.message);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

/**
 * Bulk insert daily data
 */
async function bulkInsertDailyData(dataArray) {
  const client = await pool.connect();
  let successCount = 0;
  let failureCount = 0;

  try {
    await client.query('BEGIN');

    for (const data of dataArray) {
      try {
        await insertDailyData(data);
        successCount++;
      } catch (error) {
        failureCount++;
        console.error(`Failed to insert daily data for ${data.symbol}:`, error.message);
      }
    }

    await client.query('COMMIT');
    console.log(`Bulk insert daily data completed: ${successCount} succeeded, ${failureCount} failed`);
    return { success: true, successCount, failureCount };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Bulk insert transaction failed:', error.message);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

/**
 * Close database connection pool
 */
async function closePool() {
  await pool.end();
  console.log('Database connection pool closed');
}

module.exports = {
  pool,
  testConnection,
  initializeSchema,
  upsertStock,
  insertDailyData,
  insertScore,
  insertRecommendation,
  getLatestStockData,
  getLatestStockDataForAnalysis,
  getTopRecommendations,
  getStockHistory,
  getSectorPerformance,
  logScrape,
  bulkInsertStocks,
  bulkInsertDailyData,
  closePool
};

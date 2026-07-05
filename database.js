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
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
  } : process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? {
    // Enable SSL for remote connections by default
    rejectUnauthorized: false // For cloud databases like Aiven
  } : undefined,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 60000, // Close idle clients after 60 seconds (increased from 30)
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection cannot be established
  keepAlive: true, // Keep connections alive for long-running operations
});

// Handle pool errors - log but don't exit (pool will automatically recreate connections)
pool.on('error', (err) => {
  // Ignore ECONNRESET errors as the pool will handle reconnection
  if (err.code === 'ECONNRESET' || err.code === 'CONNECTION_CLOSED') {
    console.warn('Database connection reset, pool will reconnect...');
    return;
  }
  console.error('Unexpected error on idle client', err);
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
 * Bulk insert daily data (true bulk insert with single query)
 */
async function bulkInsertDailyData(dataArray) {
  if (!dataArray || dataArray.length === 0) {
    return { success: true, successCount: 0, failureCount: 0 };
  }

  const client = await pool.connect();
  let successCount = 0;
  let failureCount = 0;

  try {
    await client.query('BEGIN');

    // Helper function to format a value for SQL
    const formatValue = (val) => {
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`; // Escape single quotes
      if (val instanceof Date) return `'${val.toISOString()}'`;
      return String(val);
    };

    // Build the query with actual values
    const rows = [];
    for (const data of dataArray) {
      const row = `(
        ${formatValue(data.time)},
        ${formatValue(data.scrape_id)},
        ${formatValue(data.scrape_date)},
        ${formatValue(data.symbol)},
        ${formatValue(data.open)},
        ${formatValue(data.high)},
        ${formatValue(data.low)},
        ${formatValue(data.close)},
        ${formatValue(data.volume)},
        ${formatValue(data.market_cap)},
        ${formatValue(data.pe_ratio)},
        ${formatValue(data.pb_ratio)},
        ${formatValue(data.dividend_yield)},
        ${formatValue(data.free_float)},
        ${formatValue(data.free_float_pct)},
        ${formatValue(data.avg_volume_30d)},
        ${formatValue(data.change_1d)},
        ${formatValue(data.change_1w)},
        ${formatValue(data.change_1m)},
        ${formatValue(data.change_3m)},
        ${formatValue(data.change_6m)},
        ${formatValue(data.change_1y)}
      )`;

      rows.push(row.replace(/\s+/g, ' '));
    }

    const query = `
      INSERT INTO stock_daily_data (
        time, scrape_id, scrape_date, symbol, open, high, low, close, volume,
        market_cap, pe_ratio, pb_ratio, dividend_yield, free_float, free_float_pct,
        avg_volume_30d, change_1d, change_1w, change_1m, change_3m, change_6m, change_1y
      )
      VALUES ${rows.join(', ')}
      ON CONFLICT (time, symbol)
      DO UPDATE SET
        scrape_id = EXCLUDED.scrape_id,
        scrape_date = EXCLUDED.scrape_date,
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

    await client.query(query);
    successCount = dataArray.length;

    await client.query('COMMIT');
    console.log(`Bulk insert daily data completed: ${successCount} succeeded, ${failureCount} failed`);
    return { success: true, successCount, failureCount };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Bulk insert transaction failed:', error.message);
    return { success: false, error: error.message, successCount: 0, failureCount: dataArray.length };
  } finally {
    client.release();
  }
}

/**
 * Get user portfolio with current prices and gains/losses
 */
async function getUserPortfolio(userId) {
  const query = `
    SELECT
      p.id,
      p.user_id,
      p.symbol,
      s.name,
      s.sector,
      p.shares,
      p.avg_cost,
      p.current_value,
      p.unrealized_gain_loss,
      p.purchase_date,
      d.close AS current_price,
      d.change_1d AS daily_change,
      d.pe_ratio,
      d.dividend_yield
    FROM portfolio p
    LEFT JOIN stocks s ON p.symbol = s.symbol
    LEFT JOIN stock_daily_data d ON p.symbol = d.symbol
      AND d.time = (SELECT MAX(time) FROM stock_daily_data)
    WHERE p.user_id = $1
    ORDER BY p.created_at DESC
  `;

  try {
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching user portfolio:', error.message);
    return [];
  }
}

/**
 * Get portfolio summary for a user
 */
async function getPortfolioSummary(userId) {
  const query = `
    SELECT
      COUNT(*) AS holding_count,
      COALESCE(SUM(current_value), 0) AS total_value,
      COALESCE(SUM(unrealized_gain_loss), 0) AS total_gain_loss,
      COALESCE(AVG(unrealized_gain_loss / NULLIF(avg_cost * shares, 0) * 100), 0) AS avg_return_pct
    FROM portfolio
    WHERE user_id = $1
  `;

  try {
    const result = await pool.query(query, [userId]);
    return result.rows[0] || {};
  } catch (error) {
    console.error('Error fetching portfolio summary:', error.message);
    return {};
  }
}

/**
 * Add new portfolio holding (with consolidation logic)
 * If user already owns this symbol, consolidates by calculating weighted average cost
 */
async function addPortfolioHolding(userId, symbol, shares, avgCost, purchaseDate = null) {
  // First get the current price
  const priceQuery = `
    SELECT close FROM stock_daily_data
    WHERE symbol = $1
      AND time = (SELECT MAX(time) FROM stock_daily_data)
  `;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const symbolUpper = symbol.toUpperCase();

    // Check if user already has this stock
    const existingHolding = await client.query(
      'SELECT id, shares, avg_cost FROM portfolio WHERE user_id = $1 AND symbol = $2',
      [userId, symbolUpper]
    );

    // Get current price
    const priceResult = await client.query(priceQuery, [symbolUpper]);
    const currentPrice = priceResult.rows[0]?.close || avgCost;

    let result;

    if (existingHolding.rows.length > 0) {
      // User already has this stock - consolidate!
      const existing = existingHolding.rows[0];
      const oldShares = parseFloat(existing.shares);
      const oldAvgCost = parseFloat(existing.avg_cost);

      // Calculate weighted average cost
      const totalShares = oldShares + shares;
      const totalCost = (oldShares * oldAvgCost) + (shares * avgCost);
      const newAvgCost = totalCost / totalShares;

      // Calculate new current value and unrealized gain/loss
      const currentValue = currentPrice * totalShares;
      const unrealizedGainLoss = (currentPrice - newAvgCost) * totalShares;

      // Update existing holding
      await client.query(
        `UPDATE portfolio
         SET shares = $1,
             avg_cost = $2,
             current_value = $3,
             unrealized_gain_loss = $4,
             updated_at = NOW()
         WHERE id = $5`,
        [totalShares, newAvgCost, currentValue, unrealizedGainLoss, existing.id]
      );

      result = {
        success: true,
        id: existing.id,
        consolidated: true,
        newShares: totalShares,
        newAvgCost: newAvgCost.toFixed(2),
        oldShares: oldShares,
        oldAvgCost: oldAvgCost
      };
    } else {
      // New holding - insert as usual
      const currentValue = currentPrice * shares;
      const unrealizedGainLoss = (currentPrice - avgCost) * shares;

      const insertQuery = `
        INSERT INTO portfolio (user_id, symbol, shares, avg_cost, current_value, unrealized_gain_loss, purchase_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;

      const insertResult = await client.query(insertQuery, [
        userId,
        symbolUpper,
        shares,
        avgCost,
        currentValue,
        unrealizedGainLoss,
        purchaseDate
      ]);

      result = {
        success: true,
        id: insertResult.rows[0].id,
        consolidated: false,
        newShares: shares,
        newAvgCost: avgCost.toFixed(2)
      };
    }

    await client.query('COMMIT');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding portfolio holding:', error.message);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

/**
 * Update portfolio holding
 */
async function updatePortfolioHolding(id, shares, avgCost) {
  // Get current price
  const priceQuery = `
    SELECT close FROM stock_daily_data
    WHERE symbol = (SELECT symbol FROM portfolio WHERE id = $1)
      AND time = (SELECT MAX(time) FROM stock_daily_data)
  `;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get current price
    const priceResult = await client.query(priceQuery, [id]);
    const currentPrice = priceResult.rows[0]?.close || avgCost;

    // Calculate current value and unrealized gain/loss
    const currentValue = currentPrice * shares;
    const unrealizedGainLoss = (currentPrice - avgCost) * shares;

    const updateQuery = `
      UPDATE portfolio
      SET shares = $2,
          avg_cost = $3,
          current_value = $4,
          unrealized_gain_loss = $5,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await client.query(updateQuery, [id, shares, avgCost, currentValue, unrealizedGainLoss]);

    await client.query('COMMIT');

    return { success: true, holding: result.rows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating portfolio holding:', error.message);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

/**
 * Delete portfolio holding
 */
async function deletePortfolioHolding(id) {
  const query = 'DELETE FROM portfolio WHERE id = $1 RETURNING id';

  try {
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return { success: false, error: 'Holding not found' };
    }
    return { success: true, id: result.rows[0].id };
  } catch (error) {
    console.error('Error deleting portfolio holding:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Update portfolio values (refresh current prices and gains/losses)
 */
async function updatePortfolioValues(userId) {
  // Get all holdings with their symbols
  const holdingsQuery = `
    SELECT id, symbol, shares, avg_cost
    FROM portfolio
    WHERE user_id = $1
  `;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const holdingsResult = await client.query(holdingsQuery, [userId]);
    const holdings = holdingsResult.rows;

    let updatedCount = 0;

    for (const holding of holdings) {
      // Get current price
      const priceQuery = `
        SELECT close FROM stock_daily_data
        WHERE symbol = $1
          AND time = (SELECT MAX(time) FROM stock_daily_data)
      `;
      const priceResult = await client.query(priceQuery, [holding.symbol]);
      const currentPrice = priceResult.rows[0]?.close;

      if (currentPrice) {
        // Calculate current value and unrealized gain/loss
        const currentValue = currentPrice * holding.shares;
        const unrealizedGainLoss = (currentPrice - holding.avg_cost) * holding.shares;

        // Update holding
        await client.query(
          `UPDATE portfolio
           SET current_value = $2,
               unrealized_gain_loss = $3,
               updated_at = NOW()
           WHERE id = $1`,
          [holding.id, currentValue, unrealizedGainLoss]
        );

        updatedCount++;
      }
    }

    await client.query('COMMIT');

    console.log(`Updated ${updatedCount} portfolio holdings for user ${userId}`);
    return { success: true, updatedCount };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating portfolio values:', error.message);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

/**
 * Insert alert
 */
async function insertAlert(alertData) {
  const query = `
    INSERT INTO alerts (time, symbol, alert_type, message, is_read)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `;

  try {
    const result = await pool.query(query, [
      alertData.time || new Date(),
      alertData.symbol,
      alertData.alert_type,
      alertData.message,
      alertData.is_read || false
    ]);
    return { success: true, id: result.rows[0].id };
  } catch (error) {
    console.error('Error inserting alert:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get unread alerts
 */
async function getUnreadAlerts(limit = 10) {
  const query = `
    SELECT * FROM alerts
    WHERE is_read = false
    ORDER BY time DESC
    LIMIT $1
  `;

  try {
    const result = await pool.query(query, [limit]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching unread alerts:', error.message);
    return [];
  }
}

/**
 * Mark alerts as read
 */
async function markAlertsAsRead(alertIds) {
  const query = `
    UPDATE alerts
    SET is_read = true
    WHERE id = ANY($1)
  `;

  try {
    await pool.query(query, [alertIds]);
    return { success: true };
  } catch (error) {
    console.error('Error marking alerts as read:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get user email from username
 */
async function getUserEmail(username) {
  const query = 'SELECT email FROM users WHERE username = $1';

  try {
    const result = await pool.query(query, [username]);
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0].email;
  } catch (error) {
    console.error('Error getting user email:', error.message);
    return null;
  }
}

/**
 * Get or create default user ID
 */
async function getOrCreateUserId(userEmail) {
  const query = `
    SELECT user_id FROM portfolio_users
    WHERE email = $1
  `;

  const insertQuery = `
    INSERT INTO portfolio_users (user_id, email, created_at)
    VALUES ($1, $2, NOW())
    RETURNING user_id
  `;

  const client = await pool.connect();

  try {
    // Check if user exists
    const result = await client.query(query, [userEmail]);

    if (result.rows.length > 0) {
      return result.rows[0].user_id;
    }

    // Create new user - use email as user_id for simplicity
    const userId = userEmail; // Could also use a UUID or hash
    const insertResult = await client.query(insertQuery, [userId, userEmail]);
    return insertResult.rows[0].user_id;
  } catch (error) {
    // If table doesn't exist, create it
    if (error.code === '42P01') {
      await client.query(`
        CREATE TABLE IF NOT EXISTS portfolio_users (
          user_id VARCHAR(100) PRIMARY KEY,
          email VARCHAR(200) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      const userId = userEmail;
      const insertResult = await client.query(insertQuery, [userId, userEmail]);
      return insertResult.rows[0].user_id;
    }
    console.error('Error getting user ID:', error.message);
    return 'default';
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
  getUserPortfolio,
  getPortfolioSummary,
  addPortfolioHolding,
  updatePortfolioHolding,
  deletePortfolioHolding,
  updatePortfolioValues,
  insertAlert,
  getUnreadAlerts,
  markAlertsAsRead,
  getUserEmail,
  getOrCreateUserId,
  closePool
};

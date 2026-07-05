#!/usr/bin/env node

/**
 * Portfolio Operations Script
 * Handles portfolio CRUD operations for the Streamlit dashboard
 *
 * Usage:
 *   node portfolio-ops.js summary <userId>
 *   node portfolio-ops.js get <userId>
 *   node portfolio-ops.js add <userId> <symbol> <shares> <avgCost> <purchaseDate>
 *   node portfolio-ops.js refresh <userId>
 *   node portfolio-ops.js delete <userId> <holdingId>
 */

require('dotenv').config();
const path = require('path');

// Load database module from current directory
const database = require(path.join(__dirname, 'database'));

async function main() {
  const args = process.argv.slice(2);
  const operation = args[0];

  try {
    let result;

    switch (operation) {
      case 'summary':
        result = await getSummary(parseInt(args[1]));
        break;

      case 'get':
        result = await getHoldings(parseInt(args[1]));
        break;

      case 'add':
        result = await addHolding(
          parseInt(args[1]),
          args[2],
          parseInt(args[3]),
          parseFloat(args[4]),
          args[5]
        );
        break;

      case 'refresh':
        result = await refreshPortfolio(parseInt(args[1]));
        break;

      case 'delete':
        result = await deleteHolding(parseInt(args[1]), parseInt(args[2]));
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({ success: false, error: error.message }));
    process.exit(1);
  }
}

/**
 * Get portfolio summary
 */
async function getSummary(userId) {
  const summary = await database.getPortfolioSummary(userId);

  return {
    success: true,
    data: {
      holding_count: parseInt(summary.holding_count) || 0,
      total_value: parseFloat(summary.total_value) || 0,
      total_gain_loss: parseFloat(summary.total_gain_loss) || 0,
      avg_return_pct: parseFloat(summary.avg_return_pct) || 0
    }
  };
}

/**
 * Get all holdings for a user
 */
async function getHoldings(userId) {
  const holdings = await database.getUserPortfolio(userId);

  return {
    success: true,
    data: holdings.map(h => ({
      id: h.id,
      symbol: h.symbol,
      name: h.name,
      sector: h.sector,
      shares: parseInt(h.shares),
      avg_cost: parseFloat(h.avg_cost),
      current_value: parseFloat(h.current_value),
      unrealized_gain_loss: parseFloat(h.unrealized_gain_loss),
      purchase_date: h.purchase_date,
      current_price: parseFloat(h.current_price),
      daily_change: parseFloat(h.daily_change) || 0,
      pe_ratio: parseFloat(h.pe_ratio) || 0,
      dividend_yield: parseFloat(h.dividend_yield) || 0
    }))
  };
}

/**
 * Add a new holding
 */
async function addHolding(userId, symbol, shares, avgCost, purchaseDate) {
  try {
    const result = await database.addPortfolioHolding(
      userId,
      symbol,
      shares,
      avgCost,
      purchaseDate || null
    );

    return {
      success: true,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Refresh portfolio values (recalculate based on latest prices)
 */
async function refreshPortfolio(userId) {
  try {
    const holdings = await database.getUserPortfolio(userId);
    const results = [];

    for (const holding of holdings) {
      // Get latest price
      const priceResult = await database.pool.query(
        `SELECT close FROM stock_daily_data
         WHERE symbol = $1
         ORDER BY time DESC
         LIMIT 1`,
        [holding.symbol]
      );

      if (priceResult.rows.length > 0) {
        const currentPrice = parseFloat(priceResult.rows[0].close);
        const currentValue = currentPrice * holding.shares;
        const gainLoss = (currentPrice - holding.avg_cost) * holding.shares;

        // Update holding
        await database.pool.query(
          `UPDATE portfolio
           SET current_value = $1,
               unrealized_gain_loss = $2
           WHERE id = $3`,
          [currentValue, gainLoss, holding.id]
        );

        results.push({
          symbol: holding.symbol,
          current_price: currentPrice,
          current_value: currentValue,
          gain_loss: gainLoss
        });
      }
    }

    return {
      success: true,
      data: results
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete a holding
 */
async function deleteHolding(userId, holdingId) {
  try {
    await database.pool.query(
      'DELETE FROM portfolio WHERE id = $1 AND user_id = $2',
      [holdingId, userId]
    );

    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  getSummary,
  getHoldings,
  addHolding,
  refreshPortfolio,
  deleteHolding
};

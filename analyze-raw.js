/**
 * Simple analyzer that works with raw stock_daily_data
 */

const { pool } = require('./database');

async function analyzeRawData() {
  console.log('Analyzing raw stock data...');

  try {
    // Get the latest timestamp first
    const timeResult = await pool.query('SELECT MAX(time) as max_time FROM stock_daily_data');
    const maxTime = timeResult.rows[0].max_time;

    // Get stocks from daily data table
    const result = await pool.query(`
      SELECT s.symbol, s.name, s.sector, d.close, d.market_cap, d.pe_ratio,
             d.dividend_yield, d.volume, d.change_1d, d.change_1m, d.change_1y, d.time
      FROM stocks s
      JOIN stock_daily_data d ON s.symbol = d.symbol
      WHERE d.time = $1
    `, [maxTime]);

    const stocks = result.rows;
    console.log(`Found ${stocks.length} stocks to analyze`);

    let analyzed = 0;

    for (const stock of stocks) {
      try {
        // Simple scoring
        const financialHealth = calculateFinancialScore(stock);
        const momentum = calculateMomentumScore(stock);
        const dividend = calculateDividendScore(stock);
        const sector = 50; // Default
        const composite = Math.round(
          (financialHealth * 0.25) +
          (momentum * 0.30) +
          (dividend * 0.20) +
          (sector * 0.25)
        );

        // Insert score - use the same timestamp as the daily data
        await pool.query(`
          INSERT INTO stock_scores (time, symbol, financial_health_score, momentum_score,
            dividend_score, sector_score, composite_score, volatility, liquidity_score, risk_level)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (time, symbol) DO UPDATE SET
            financial_health_score = EXCLUDED.financial_health_score,
            momentum_score = EXCLUDED.momentum_score,
            dividend_score = EXCLUDED.dividend_score,
            sector_score = EXCLUDED.sector_score,
            composite_score = EXCLUDED.composite_score
        `, [stock.time, stock.symbol, financialHealth, momentum, dividend, sector, composite, null, 50, 'MEDIUM']);

        analyzed++;

      } catch (error) {
        console.error(`Error analyzing ${stock.symbol}:`, error.message);
      }
    }

    console.log(`✓ Analyzed ${analyzed} stocks`);

    // Show top 5
    const topResult = await pool.query(`
      SELECT symbol, composite_score FROM stock_scores
      WHERE time = (SELECT MAX(time) FROM stock_scores)
      ORDER BY composite_score DESC LIMIT 5
    `);

    console.log('\nTop 5 stocks by composite score:');
    topResult.rows.forEach((s, i) => {
      console.log(`  ${i+1}. ${s.symbol}: ${s.composite_score}`);
    });

    await pool.end();

  } catch (error) {
    console.error('Analysis error:', error.message);
    await pool.end();
  }
}

function calculateFinancialScore(stock) {
  let score = 50;

  const pe = parseFloat(stock.pe_ratio);
  if (pe && pe > 0 && pe <= 15) score = 80;
  else if (pe && pe <= 25) score = 65;
  else if (pe && pe <= 40) score = 50;
  else if (pe && pe > 40) score = 30;

  // Market cap bonus
  const mc = parseFloat(stock.market_cap);
  if (mc && mc >= 10000000000) score += 10;

  return Math.min(100, Math.round(score));
}

function calculateMomentumScore(stock) {
  let score = 50;

  const ch1m = parseFloat(stock.change_1m);
  if (!isNaN(ch1m)) {
    if (ch1m > 10) score = 80;
    else if (ch1m > 5) score = 65;
    else if (ch1m > 0) score = 55;
    else score = 40;
  }

  return Math.min(100, Math.round(score));
}

function calculateDividendScore(stock) {
  const dy = parseFloat(stock.dividend_yield);
  if (!dy || dy === 0) return 30;

  if (dy >= 4) return 80;
  if (dy >= 2) return 60;
  return 45;
}

if (require.main === module) {
  analyzeRawData().catch(console.error);
}

module.exports = { analyzeRawData };

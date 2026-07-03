/**
 * Multi-Factor Stock Analysis Engine
 * Scores stocks on financial health, price momentum, dividends, and sector performance
 */

const database = require('./database');
require('dotenv').config();

/**
 * Calculate Z-score normalization
 */
function zScore(value, mean, stdDev) {
  if (stdDev === 0) return 50; // Return neutral score if no variation
  return 50 + ((value - mean) / stdDev) * 10; // Scale to 0-100 range
}

/**
 * Normalize value to 0-100 scale using min-max
 */
function normalizeTo100(value, min, max) {
  if (max === min) return 50;
  return ((value - min) / (max - min)) * 100;
}

/**
 * Calculate Financial Health Score (0-100)
 * Factors: PE ratio, market cap, profitability indicators
 */
function calculateFinancialHealthScore(stockData, sectorStats) {
  let score = 50; // Base score
  let factors = [];

  // PE Ratio Analysis (40% of financial health)
  // Lower PE is generally better for value investing
  if (stockData.pe_ratio && stockData.pe_ratio > 0) {
    // Reasonable PE range: 5-30
    let peScore = 100;
    if (stockData.pe_ratio < 5) {
      peScore = 60; // Suspiciously low
    } else if (stockData.pe_ratio <= 15) {
      peScore = 90; // Good value
    } else if (stockData.pe_ratio <= 25) {
      peScore = 70; // Fair
    } else if (stockData.pe_ratio <= 40) {
      peScore = 50; // Expensive
    } else {
      peScore = 25; // Very expensive
    }
    score = score * 0.6 + peScore * 0.4;
    factors.push({ name: 'PE Ratio', value: stockData.pe_ratio, score: peScore });
  }

  // Market Cap Analysis (25% of financial health)
  // Larger companies tend to be more stable
  if (stockData.market_cap) {
    let mcScore = 50;
    const mcBillions = stockData.market_cap / 1000000000;

    if (mcBillions >= 100) {
      mcScore = 95; // Large cap - very stable
    } else if (mcBillions >= 10) {
      mcScore = 85; // Mid-large cap
    } else if (mcBillions >= 1) {
      mcScore = 70; // Mid cap
    } else if (mcBillions >= 0.1) {
      mcScore = 50; // Small cap
    } else {
      mcScore = 30; // Micro cap - risky
    }
    score = score * 0.75 + mcScore * 0.25;
    factors.push({ name: 'Market Cap', value: mcBillions.toFixed(2) + 'B', score: mcScore });
  }

  // Price-to-Book Ratio (20% of financial health)
  if (stockData.pb_ratio && stockData.pb_ratio > 0) {
    let pbScore = 100;
    if (stockData.pb_ratio <= 1) {
      pbScore = 95; // Trading at or below book value
    } else if (stockData.pb_ratio <= 2) {
      pbScore = 75; // Reasonable
    } else if (stockData.pb_ratio <= 3) {
      pbScore = 55; // Getting expensive
    } else {
      pbScore = 35; // Expensive
    }
    score = score * 0.8 + pbScore * 0.2;
    factors.push({ name: 'P/B Ratio', value: stockData.pb_ratio, score: pbScore });
  }

  // Dividend Coverage (15% of financial health)
  // Companies paying dividends are typically financially stable
  if (stockData.dividend_yield && stockData.dividend_yield > 0) {
    const divScore = Math.min(100, 50 + stockData.dividend_yield * 5);
    score = score * 0.85 + divScore * 0.15;
    factors.push({ name: 'Dividend Yield', value: stockData.dividend_yield + '%', score: divScore });
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate Price Momentum Score (0-100)
 * Factors: Multi-period returns, volume trends, technical indicators
 */
function calculateMomentumScore(stockData) {
  let score = 50; // Base score
  const weights = {
    '1M': 0.30,
    '3M': 0.30,
    '6M': 0.25,
    '1Y': 0.15
  };

  // 1-Month Momentum (30%)
  if (stockData.change_1m !== null && stockData.change_1m !== undefined) {
    let momScore = 50;
    if (stockData.change_1m > 20) {
      momScore = 100;
    } else if (stockData.change_1m > 10) {
      momScore = 85;
    } else if (stockData.change_1m > 5) {
      momScore = 70;
    } else if (stockData.change_1m > 0) {
      momScore = 60;
    } else if (stockData.change_1m > -10) {
      momScore = 40;
    } else {
      momScore = 20;
    }
    score = score * 0.7 + momScore * 0.3;
  }

  // 3-Month Momentum (30%)
  if (stockData.change_3m !== null && stockData.change_3m !== undefined) {
    let momScore = 50;
    if (stockData.change_3m > 40) {
      momScore = 100;
    } else if (stockData.change_3m > 20) {
      momScore = 85;
    } else if (stockData.change_3m > 10) {
      momScore = 70;
    } else if (stockData.change_3m > 0) {
      momScore = 60;
    } else if (stockData.change_3m > -15) {
      momScore = 40;
    } else {
      momScore = 20;
    }
    score = score * 0.7 + momScore * 0.3;
  }

  // 6-Month Momentum (25%)
  if (stockData.change_6m !== null && stockData.change_6m !== undefined) {
    let momScore = 50;
    if (stockData.change_6m > 50) {
      momScore = 100;
    } else if (stockData.change_6m > 30) {
      momScore = 85;
    } else if (stockData.change_6m > 15) {
      momScore = 70;
    } else if (stockData.change_6m > 0) {
      momScore = 60;
    } else if (stockData.change_6m > -20) {
      momScore = 40;
    } else {
      momScore = 20;
    }
    score = score * 0.75 + momScore * 0.25;
  }

  // 1-Year Momentum (15%)
  if (stockData.change_1y !== null && stockData.change_1y !== undefined) {
    let momScore = 50;
    if (stockData.change_1y > 75) {
      momScore = 100;
    } else if (stockData.change_1y > 50) {
      momScore = 90;
    } else if (stockData.change_1y > 25) {
      momScore = 75;
    } else if (stockData.change_1y > 0) {
      momScore = 60;
    } else if (stockData.change_1y > -25) {
      momScore = 40;
    } else {
      momScore = 20;
    }
    score = score * 0.85 + momScore * 0.15;
  }

  // Recent Performance Bonus
  if (stockData.change_1d !== null && stockData.change_1d > 0) {
    score = Math.min(100, score + 3);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate Dividend Score (0-100)
 * Factors: Dividend yield, consistency, growth
 */
function calculateDividendScore(stockData, stockHistory = []) {
  let score = 0;

  // Dividend Yield (60% of dividend score)
  if (stockData.dividend_yield && stockData.dividend_yield > 0) {
    let yieldScore = 0;

    if (stockData.dividend_yield >= 8) {
      yieldScore = 60; // Very high but potentially unsustainable
    } else if (stockData.dividend_yield >= 6) {
      yieldScore = 80; // Excellent
    } else if (stockData.dividend_yield >= 4) {
      yieldScore = 100; // Optimal range
    } else if (stockData.dividend_yield >= 2) {
      yieldScore = 75; // Good
    } else if (stockData.dividend_yield >= 1) {
      yieldScore = 50; // Decent
    } else {
      yieldScore = 30; // Low yield
    }

    score += yieldScore * 0.6;
  }

  // Payout Ratio Assessment (25% of dividend score)
  // Assuming reasonable payout ratio if PE is in healthy range
  if (stockData.pe_ratio && stockData.pe_ratio > 0 && stockData.pe_ratio < 50) {
    score += 25;
  }

  // Dividend Consistency (15% of dividend score)
  // In real implementation, this would check payment history
  if (stockData.dividend_yield && stockData.dividend_yield > 0) {
    // Assuming some consistency if currently paying dividend
    score += 15;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate Sector Performance Score (0-100)
 */
function calculateSectorScore(stockData, sectorData) {
  if (!sectorData || !stockData.sector) {
    return 50; // Neutral score if no sector data
  }

  const sectorInfo = sectorData.find(s => s.sector === stockData.sector);
  if (!sectorInfo) {
    return 50;
  }

  let score = 50;

  // Sector Momentum (50%)
  if (sectorInfo.momentum_score !== null) {
    score = score * 0.5 + sectorInfo.momentum_score * 0.5;
  }

  // Sector 3-Month Change (30%)
  if (sectorInfo.change_3m !== null) {
    let sectorChangeScore = 50;
    if (sectorInfo.change_3m > 15) {
      sectorChangeScore = 90;
    } else if (sectorInfo.change_3m > 5) {
      sectorChangeScore = 70;
    } else if (sectorInfo.change_3m > 0) {
      sectorChangeScore = 60;
    } else if (sectorInfo.change_3m > -10) {
      sectorChangeScore = 40;
    } else {
      sectorChangeScore = 20;
    }
    score = score * 0.7 + sectorChangeScore * 0.3;
  }

  // Sector Size/Stability (20%)
  if (sectorInfo.market_cap_pct !== null) {
    let sizeScore = Math.min(100, sectorInfo.market_cap_pct * 2);
    score = score * 0.8 + sizeScore * 0.2;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate Volatility (annualized standard deviation of returns)
 */
function calculateVolatility(stockHistory) {
  if (!stockHistory || stockHistory.length < 2) {
    return null;
  }

  const returns = [];
  for (let i = 1; i < stockHistory.length; i++) {
    const prev = parseFloat(stockHistory[i - 1].close);
    const curr = parseFloat(stockHistory[i].close);

    if (prev > 0 && curr > 0) {
      returns.push((curr - prev) / prev);
    }
  }

  if (returns.length === 0) {
    return null;
  }

  // Calculate standard deviation
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Annualize (assuming ~250 trading days per year)
  const annualizedVolatility = stdDev * Math.sqrt(250) * 100;

  return Math.round(annualizedVolatility * 100) / 100;
}

/**
 * Calculate Liquidity Score
 */
function calculateLiquidityScore(stockData) {
  let score = 50;

  if (stockData.avg_volume_30d) {
    const volumeMillions = stockData.avg_volume_30d / 1000000;

    if (volumeMillions >= 5) {
      score = 100; // Very liquid
    } else if (volumeMillions >= 2) {
      score = 85; // Liquid
    } else if (volumeMillions >= 1) {
      score = 70; // Moderate liquidity
    } else if (volumeMillions >= 0.5) {
      score = 50; // Less liquid
    } else if (volumeMillions >= 0.1) {
      score = 30; // Illiquid
    } else {
      score = 10; // Very illiquid
    }
  }

  if (stockData.free_float_pct) {
    const floatScore = stockData.free_float_pct;
    score = score * 0.6 + floatScore * 0.4;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Determine Risk Level
 */
function determineRiskLevel(volatility, financialScore, liquidityScore) {
  let riskFactors = 0;

  // High volatility
  if (volatility && volatility > 50) riskFactors++;

  // Poor financial health
  if (financialScore < 40) riskFactors++;

  // Low liquidity
  if (liquidityScore < 30) riskFactors++;

  if (riskFactors >= 2) return 'HIGH';
  if (riskFactors === 1) return 'MEDIUM';
  return 'LOW';
}

/**
 * Calculate Composite Score
 * Weights: Financial 25%, Momentum 30%, Dividend 20%, Sector 25%
 */
function calculateCompositeScore(financialHealth, momentum, dividend, sector) {
  return Math.round(
    (financialHealth * 0.25) +
    (momentum * 0.30) +
    (dividend * 0.20) +
    (sector * 0.25)
  );
}

/**
 * Analyze a single stock
 */
async function analyzeStock(stockData, sectorData, stockHistory) {
  // Calculate individual scores
  const financialHealth = calculateFinancialHealthScore(stockData, sectorData);
  const momentum = calculateMomentumScore(stockData);
  const dividend = calculateDividendScore(stockData, stockHistory);
  const sector = calculateSectorScore(stockData, sectorData);

  // Calculate volatility
  const volatility = calculateVolatility(stockHistory);

  // Calculate liquidity
  const liquidity = calculateLiquidityScore(stockData);

  // Determine risk level
  const riskLevel = determineRiskLevel(volatility, financialHealth, liquidity);

  // Calculate composite score
  const compositeScore = calculateCompositeScore(financialHealth, momentum, dividend, sector);

  return {
    symbol: stockData.symbol,
    time: new Date(),
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
 * Analyze all stocks in the database
 */
async function analyzeAllStocks() {
  console.log('Starting stock analysis...');

  try {
    // Get latest stock data
    const stocks = await database.getLatestStockDataForAnalysis();

    if (stocks.length === 0) {
      console.log('No stock data found. Please run the scraper first.');
      return { success: false, error: 'No data available' };
    }

    console.log(`Analyzing ${stocks.length} stocks...`);

    // Get sector performance data
    const sectorData = await database.getSectorPerformance();

    // Use a single timestamp for all stocks in this batch
    const batchTimestamp = new Date();

    // Analyze each stock
    const scores = [];

    for (const stock of stocks) {
      try {
        // Get historical data for more accurate analysis
        const history = await database.getStockHistory(
          stock.symbol,
          new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
          new Date()
        );

        const scoreData = await analyzeStock(stock, sectorData, history);
        // Use the batch timestamp instead of individual timestamps
        scoreData.time = batchTimestamp;
        scores.push(scoreData);

        // Save to database
        await database.insertScore(scoreData);

      } catch (error) {
        console.error(`Error analyzing ${stock.symbol}:`, error.message);
      }
    }

    console.log(`Analysis completed: ${scores.length} stocks scored`);

    return {
      success: true,
      scores,
      timestamp: batchTimestamp
    };

  } catch (error) {
    console.error('Analysis failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get analysis for a specific symbol
 */
async function getStockAnalysis(symbol) {
  try {
    const stocks = await database.getLatestStockDataForAnalysis(symbol);

    if (stocks.length === 0) {
      return { success: false, error: 'Stock not found' };
    }

    const stock = stocks[0];
    const sectorData = await database.getSectorPerformance();
    const history = await database.getStockHistory(
      symbol,
      new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      new Date()
    );

    const analysis = await analyzeStock(stock, sectorData, history);

    return {
      success: true,
      ...analysis,
      stockData: stock
    };

  } catch (error) {
    console.error(`Error analyzing ${symbol}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Run analysis if called directly
if (require.main === module) {
  analyzeAllStocks()
    .then(result => {
      if (result.success) {
        console.log('\n✓ Analysis completed successfully');
        console.log(`  Stocks analyzed: ${result.scores.length}`);

        // Show top 5 stocks by composite score
        const top5 = result.scores.sort((a, b) => b.composite_score - a.composite_score).slice(0, 5);
        console.log('\nTop 5 stocks by composite score:');
        top5.forEach((stock, i) => {
          console.log(`  ${i + 1}. ${stock.symbol}: ${stock.composite_score} (${stock.risk_level} risk)`);
        });
      } else {
        console.log('\n✗ Analysis failed');
        console.log(`  Error: ${result.error}`);
      }
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  analyzeStock,
  analyzeAllStocks,
  getStockAnalysis,
  calculateFinancialHealthScore,
  calculateMomentumScore,
  calculateDividendScore,
  calculateSectorScore,
  calculateCompositeScore
};

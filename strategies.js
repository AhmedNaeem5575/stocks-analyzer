/**
 * Investment Strategy Selector
 * Generates recommendations for short-term, medium-term, and long-term timeframes
 */

const database = require('./database');
const analyzer = require('./analyzer');

/**
 * Short-term Strategy (1-6 months)
 * Focus: Price momentum, technical analysis, volume
 */
function shortTermStrategy(stock, score) {
  let recommendationScore = 0;
  let reasons = [];

  // High momentum is crucial (40%)
  if (score.momentum_score >= 75) {
    recommendationScore += 40;
    reasons.push('Strong price momentum');
  } else if (score.momentum_score >= 60) {
    recommendationScore += 30;
    reasons.push('Moderate price momentum');
  }

  // Recent performance (25%)
  if (stock.change_1m > 10) {
    recommendationScore += 25;
    reasons.push('Strong 1-month performance');
  } else if (stock.change_1m > 5) {
    recommendationScore += 20;
    reasons.push('Positive 1-month trend');
  } else if (stock.change_1m > 0) {
    recommendationScore += 15;
  }

  // Volume analysis (20%)
  if (score.liquidity_score >= 70) {
    recommendationScore += 20;
    reasons.push('High liquidity');
  } else if (score.liquidity_score >= 50) {
    recommendationScore += 15;
    reasons.push('Good liquidity');
  }

  // Volatility check - too volatile is bad for short-term (15%)
  if (score.volatility) {
    if (score.volatility < 30) {
      recommendationScore += 15;
      reasons.push('Acceptable volatility');
    } else if (score.volatility < 50) {
      recommendationScore += 10;
    } else {
      recommendationScore += 0;
      reasons.push('High volatility - use caution');
    }
  }

  return {
    strategy_type: 'MOMENTUM',
    score: recommendationScore,
    reasons,
    expected_hold_period: '1-6 months',
    risk_level: score.volatility > 40 ? 'HIGH' : 'MEDIUM'
  };
}

/**
 * Medium-term Strategy (6-18 months)
 * Focus: Growth + quality, balanced fundamentals and technicals
 */
function mediumTermStrategy(stock, score) {
  let recommendationScore = 0;
  let reasons = [];

  // Balanced score - composite matters most (35%)
  if (score.composite_score >= 70) {
    recommendationScore += 35;
    reasons.push('Strong overall fundamentals');
  } else if (score.composite_score >= 55) {
    recommendationScore += 25;
    reasons.push('Good fundamentals');
  }

  // Momentum + financial health balance (30%)
  if (score.momentum_score >= 60 && score.financial_health_score >= 60) {
    recommendationScore += 30;
    reasons.push('Balanced growth and quality');
  } else if (score.momentum_score >= 50 || score.financial_health_score >= 50) {
    recommendationScore += 20;
  }

  // Sector momentum (20%)
  if (score.sector_score >= 70) {
    recommendationScore += 20;
    reasons.push('Strong sector performance');
  } else if (score.sector_score >= 55) {
    recommendationScore += 15;
  }

  // Reasonable valuation - PEG ratio proxy (15%)
  if (stock.pe_ratio && stock.pe_ratio > 0) {
    // Assuming growth rate roughly equals PE for simplicity
    const peg = stock.pe_ratio / (stock.change_1y || 10);
    if (peg > 0 && peg <= 1.5) {
      recommendationScore += 15;
      reasons.push('Reasonable valuation for growth');
    } else if (peg > 0 && peg <= 2.5) {
      recommendationScore += 10;
    }
  }

  return {
    strategy_type: 'GROWTH',
    score: recommendationScore,
    reasons,
    expected_hold_period: '6-18 months',
    risk_level: score.risk_level
  };
}

/**
 * Long-term Strategy (18+ months)
 * Focus: Value + dividends, stable companies
 */
function longTermStrategy(stock, score) {
  let recommendationScore = 0;
  let reasons = [];

  // Financial health is paramount (40%)
  if (score.financial_health_score >= 75) {
    recommendationScore += 40;
    reasons.push('Excellent financial health');
  } else if (score.financial_health_score >= 60) {
    recommendationScore += 30;
    reasons.push('Strong financial position');
  } else if (score.financial_health_score >= 50) {
    recommendationScore += 20;
  }

  // Dividend yield and consistency (30%)
  if (stock.dividend_yield >= 4) {
    recommendationScore += 30;
    reasons.push('Attractive dividend yield');
  } else if (stock.dividend_yield >= 2) {
    recommendationScore += 20;
    reasons.push('Good dividend yield');
  } else if (stock.dividend_yield >= 1) {
    recommendationScore += 10;
  }

  // Low valuation - value investing (20%)
  if (stock.pe_ratio && stock.pe_ratio > 0 && stock.pe_ratio <= 15) {
    recommendationScore += 20;
    reasons.push('Attractive valuation (low PE)');
  } else if (stock.pe_ratio && stock.pe_ratio <= 20) {
    recommendationScore += 15;
  }

  // Stability - market cap and volatility (10%)
  if (stock.market_cap && stock.market_cap > 10000000000) { // >10B
    recommendationScore += 10;
    reasons.push('Large cap stability');
  } else if (score.volatility && score.volatility < 30) {
    recommendationScore += 10;
    reasons.push('Low volatility');
  }

  return {
    strategy_type: 'VALUE',
    score: recommendationScore,
    reasons,
    expected_hold_period: '18+ months',
    risk_level: 'LOW'
  };
}

/**
 * Calculate target price and expected return
 */
function calculateTargets(stock, strategy, timeframe) {
  const currentPrice = parseFloat(stock.current_price || stock.close || 0);

  // Return null if price is invalid
  if (!currentPrice || currentPrice <= 0 || isNaN(currentPrice)) {
    return null;
  }

  let targetPrice, expectedReturn, stopLoss;

  // Define parameters based on timeframe and strategy
  const timeframes = {
    'SHORT': { months: 3, return_multiple: 1.5, stop_loss_pct: 8 },
    'MEDIUM': { months: 12, return_multiple: 1.3, stop_loss_pct: 12 },
    'LONG': { months: 24, return_multiple: 1.2, stop_loss_pct: 15 }
  };

  const tf = timeframes[timeframe] || timeframes['MEDIUM'];

  // Calculate target based on strategy type
  if (strategy === 'MOMENTUM') {
    // Momentum stocks can have higher targets
    const momentumPremium = Math.min(0.5, stock.change_1m / 100);
    expectedReturn = 0.15 + momentumPremium;
  } else if (strategy === 'GROWTH') {
    expectedReturn = 0.20;
  } else if (strategy === 'VALUE') {
    expectedReturn = 0.12;
  } else if (strategy === 'DIVIDEND') {
    expectedReturn = 0.10 + (stock.dividend_yield || 0) / 100;
  } else {
    expectedReturn = 0.15;
  }

  // Apply timeframe multiplier
  expectedReturn = expectedReturn * tf.return_multiple;

  // Calculate target price
  targetPrice = currentPrice * (1 + expectedReturn);

  // Calculate stop loss
  stopLoss = currentPrice * (1 - tf.stop_loss_pct / 100);

  // Risk-reward ratio
  const riskAmount = currentPrice - stopLoss;
  const rewardAmount = targetPrice - currentPrice;
  const riskRewardRatio = riskAmount > 0 ? (rewardAmount / riskAmount).toFixed(2) : 0;

  return {
    entry_price: currentPrice,
    target_price: Math.round(targetPrice * 100) / 100,
    expected_return: Math.round(expectedReturn * 100),
    stop_loss: Math.round(stopLoss * 100) / 100,
    risk_reward_ratio: parseFloat(riskRewardRatio)
  };
}

/**
 * Generate recommendation reasoning
 */
function generateRecommendationReasoning(stock, score, strategyResult) {
  const parts = [];

  parts.push(`Strategy: ${strategyResult.strategy_type}`);
  parts.push(`Expected Hold: ${strategyResult.expected_hold_period}`);

  // Add specific reasons
  if (strategyResult.reasons && strategyResult.reasons.length > 0) {
    parts.push('Key Factors:');
    strategyResult.reasons.forEach(reason => {
      parts.push(`  • ${reason}`);
    });
  }

  // Add score breakdown
  parts.push('\nScore Breakdown:');
  parts.push(`  • Financial Health: ${score.financial_health_score}/100`);
  parts.push(`  • Momentum: ${score.momentum_score}/100`);
  parts.push(`  • Dividend: ${score.dividend_score}/100`);
  parts.push(`  • Sector: ${score.sector_score}/100`);
  parts.push(`  • Composite: ${score.composite_score}/100`);

  // Add risk warning if applicable
  if (strategyResult.risk_level === 'HIGH') {
    parts.push('\n⚠️ HIGH RISK: This stock shows high volatility. Consider position sizing carefully.');
  } else if (strategyResult.risk_level === 'MEDIUM') {
    parts.push('\n⚠️ MEDIUM RISK: Moderate volatility. Monitor closely.');
  }

  return parts.join('\n');
}

/**
 * Generate recommendations for a specific timeframe
 */
async function generateRecommendations(timeframe = 'SHORT', limit = 10) {
  console.log(`Generating ${timeframe}-TERM recommendations...`);

  try {
    // Get latest stock data with scores
    const stocks = await database.getLatestStockData();

    if (stocks.length === 0) {
      console.log('No stock data found. Please run scraper and analyzer first.');
      return { success: false, error: 'No data available' };
    }

    // Score each stock for the given timeframe
    const recommendations = [];
    let processed = 0;
    let skipped = 0;

    for (const stock of stocks) {
      const score = {
        financial_health_score: parseFloat(stock.financial_health_score || 0),
        momentum_score: parseFloat(stock.momentum_score || 0),
        dividend_score: parseFloat(stock.dividend_score || 0),
        sector_score: parseFloat(stock.sector_score || 0),
        composite_score: parseFloat(stock.composite_score || 0),
        volatility: stock.volatility,
        liquidity_score: parseFloat(stock.liquidity_score || 50),
        risk_level: stock.risk_level
      };
      processed++;

      // Apply strategy based on timeframe
      let strategyResult;
      if (timeframe === 'SHORT') {
        strategyResult = shortTermStrategy(stock, score);
      } else if (timeframe === 'MEDIUM') {
        strategyResult = mediumTermStrategy(stock, score);
      } else if (timeframe === 'LONG') {
        strategyResult = longTermStrategy(stock, score);
      } else {
        continue;
      }

      // Calculate targets
      const targets = calculateTargets(stock, strategyResult.strategy_type, timeframe);

      // Skip if no valid price
      if (!targets || !targets.entry_price || isNaN(targets.entry_price)) {
        skipped++;
        continue;
      }

      // Generate reasoning
      const reasoning = generateRecommendationReasoning(stock, score, strategyResult);

      recommendations.push({
        symbol: stock.symbol,
        timeframe,
        strategy_type: strategyResult.strategy_type,
        score: strategyResult.score,
        ...targets,
        reasoning,
        sector: stock.sector,
        current_price: stock.current_price || stock.close
      });
    }

    console.log(`Processed ${processed} stocks, skipped ${skipped} due to invalid prices`);

    // Filter and sort by score
    const filtered = recommendations
      .filter(rec => rec.score >= 10) // Minimum score threshold (lowered for testing)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Add rank
    filtered.forEach((rec, i) => {
      rec.recommendation_rank = i + 1;
    });

    // Save to database
    console.log(`Saving ${filtered.length} recommendations to database...`);
    for (const rec of filtered) {
      await database.insertRecommendation(rec);
    }

    console.log(`Generated ${filtered.length} ${timeframe}-term recommendations`);

    return {
      success: true,
      timeframe,
      recommendations: filtered,
      timestamp: new Date()
    };

  } catch (error) {
    console.error('Failed to generate recommendations:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get recommendations for all timeframes
 */
async function generateAllRecommendations(limit = 10) {
  console.log('Generating recommendations for all timeframes...');

  const timeframes = ['SHORT', 'MEDIUM', 'LONG'];
  const results = {};

  for (const tf of timeframes) {
    const result = await generateRecommendations(tf, limit);
    results[tf] = result;

    // Add delay between timeframes
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return {
    success: true,
    results,
    timestamp: new Date()
  };
}

/**
 * Get recommendation for a specific stock
 */
async function getStockRecommendation(symbol, timeframe = 'MEDIUM') {
  try {
    const analysis = await analyzer.getStockAnalysis(symbol);

    if (!analysis.success) {
      return { success: false, error: analysis.error };
    }

    const stock = analysis.stockData;
    const score = {
      financial_health_score: analysis.financial_health_score,
      momentum_score: analysis.momentum_score,
      dividend_score: analysis.dividend_score,
      sector_score: analysis.sector_score,
      composite_score: analysis.composite_score,
      volatility: analysis.volatility,
      liquidity_score: analysis.liquidity_score,
      risk_level: analysis.risk_level
    };

    // Apply strategy
    let strategyResult;
    if (timeframe === 'SHORT') {
      strategyResult = shortTermStrategy(stock, score);
    } else if (timeframe === 'MEDIUM') {
      strategyResult = mediumTermStrategy(stock, score);
    } else if (timeframe === 'LONG') {
      strategyResult = longTermStrategy(stock, score);
    } else {
      return { success: false, error: 'Invalid timeframe' };
    }

    // Calculate targets
    const targets = calculateTargets(stock, strategyResult.strategy_type, timeframe);

    // Generate reasoning
    const reasoning = generateRecommendationReasoning(stock, score, strategyResult);

    return {
      success: true,
      symbol,
      timeframe,
      strategy_type: strategyResult.strategy_type,
      score: strategyResult.score,
      ...targets,
      reasoning,
      sector: stock.sector,
      current_price: stock.close,
      analysis
    };

  } catch (error) {
    console.error(`Error getting recommendation for ${symbol}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Run recommendations if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const timeframe = args[0] || 'SHORT';
  const limit = parseInt(args[1]) || 10;

  generateRecommendations(timeframe.toUpperCase(), limit)
    .then(result => {
      if (result.success) {
        console.log(`\n✓ Recommendations generated for ${timeframe}-TERM`);
        console.log(`  Top ${result.recommendations.length} stocks:\n`);

        result.recommendations.forEach((rec, i) => {
          console.log(`  ${i + 1}. ${rec.symbol} (${rec.strategy_type})`);
          console.log(`     Score: ${rec.score}/100`);
          console.log(`     Entry: ${rec.entry_price} → Target: ${rec.target_price}`);
          console.log(`     Expected Return: ${rec.expected_return}%`);
          console.log(`     Risk/Reward: ${rec.risk_reward_ratio}`);
          console.log(`     Sector: ${rec.sector}\n`);
        });
      } else {
        console.log('\n✗ Failed to generate recommendations');
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
  shortTermStrategy,
  mediumTermStrategy,
  longTermStrategy,
  generateRecommendations,
  generateAllRecommendations,
  getStockRecommendation
};

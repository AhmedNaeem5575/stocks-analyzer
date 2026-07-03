const database = require('./database');
const { shortTermStrategy, calculateTargets, generateRecommendationReasoning } = require('./strategies');

async function debugShortTerm() {
  console.log('Getting latest stocks...');
  const stocks = await database.getLatestStockData();
  console.log('Got', stocks.length, 'stocks\n');

  const recommendations = [];

  for (const stock of stocks.slice(0, 10)) {
    const score = {
      financial_health_score: parseFloat(stock.financial_health_score),
      momentum_score: parseFloat(stock.momentum_score),
      dividend_score: parseFloat(stock.dividend_score),
      sector_score: parseFloat(stock.sector_score),
      composite_score: parseFloat(stock.composite_score),
      volatility: stock.volatility,
      liquidity_score: parseFloat(stock.liquidity_score || 50),
      risk_level: stock.risk_level
    };

    const strategyResult = shortTermStrategy(stock, score);
    const targets = calculateTargets(stock, strategyResult.strategy_type, 'SHORT');
    const reasoning = generateRecommendationReasoning(stock, score, strategyResult);

    recommendations.push({
      symbol: stock.symbol,
      timeframe: 'SHORT',
      strategy_type: strategyResult.strategy_type,
      score: strategyResult.score,
      ...targets,
      reasoning,
      sector: stock.sector,
      current_price: stock.current_price
    });

    console.log(`${stock.symbol}: score=${strategyResult.score}, target=${targets.target_price}, expected_return=${targets.expected_return}`);
  }

  console.log('\nTotal recommendations before filter:', recommendations.length);

  const filtered = recommendations.filter(rec => rec.score >= 10);
  console.log('After filter (score >= 10):', filtered.length);

  await database.closePool();
}

debugShortTerm().catch(console.error);

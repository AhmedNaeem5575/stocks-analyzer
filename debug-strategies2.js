const database = require('./database');
const { shortTermStrategy } = require('./strategies');

async function debugShortTerm() {
  console.log('Getting latest stocks...');
  const stocks = await database.getLatestStockData();
  console.log('Got', stocks.length, 'stocks\n');

  const recommendations = [];

  for (let i = 0; i < Math.min(10, stocks.length); i++) {
    const stock = stocks[i];
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

    recommendations.push({
      symbol: stock.symbol,
      score: strategyResult.score,
      current_price: stock.current_price
    });

    console.log(`${stock.symbol}: score=${strategyResult.score}`);
  }

  console.log('\nTotal recommendations:', recommendations.length);
  const filtered = recommendations.filter(rec => rec.score >= 10);
  console.log('After filter:', filtered.length);

  await database.closePool();
}

debugShortTerm().catch(console.error);

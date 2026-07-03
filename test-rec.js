const database = require('./database');
const { shortTermStrategy } = require('./strategies');

database.getLatestStockData().then(stocks => {
  const recommendations = [];

  for (const stock of stocks.slice(0, 20)) {
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

    const result = shortTermStrategy(stock, score);
    recommendations.push({
      symbol: stock.symbol,
      score: result.score
    });
  }

  console.log('Total recommendations processed:', recommendations.length);
  console.log('Scores >= 10:', recommendations.filter(r => r.score >= 10).length);
  console.log('\nScores distribution:');
  recommendations.slice(0, 10).forEach(r => console.log(`  ${r.symbol}: ${r.score}`));

  return database.closePool();
}).catch(console.error);

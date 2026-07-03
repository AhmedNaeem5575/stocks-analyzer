const database = require('./database');
const { shortTermStrategy } = require('./strategies');

function calculateTargets(stock, strategy, timeframe) {
  const currentPrice = parseFloat(stock.current_price || stock.close || 0);
  if (!currentPrice || isNaN(currentPrice)) return null;

  let expectedReturn = 0.15;
  let targetPrice = currentPrice * (1 + expectedReturn);
  let stopLoss = currentPrice * 0.92;
  let riskRewardRatio = ((targetPrice - currentPrice) / (currentPrice - stopLoss)).toFixed(2);

  return {
    entry_price: currentPrice,
    target_price: Math.round(targetPrice * 100) / 100,
    expected_return: Math.round(expectedReturn * 100),
    stop_loss: Math.round(stopLoss * 100) / 100,
    risk_reward_ratio: parseFloat(riskRewardRatio)
  };
}

async function test() {
  const stocks = await database.getLatestStockData();
  console.log('Got', stocks.length, 'stocks\n');

  let processed = 0;
  let added = 0;

  for (const stock of stocks.slice(0, 20)) {
    processed++;
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

    if (targets && targets.entry_price && !isNaN(targets.entry_price)) {
      added++;
      console.log(`  ${stock.symbol}: score=${strategyResult.score}, price=${targets.entry_price}`);
    } else {
      console.log(`  ${stock.symbol}: SKIP (no valid price)`);
    }
  }

  console.log(`\nProcessed: ${processed}, Valid: ${added}`);
  await database.closePool();
}

test().catch(console.error);

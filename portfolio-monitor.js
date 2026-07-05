/**
 * Portfolio Monitor Module
 * Tracks user portfolio holdings, calculates gains/losses, and generates alerts
 */

const database = require('./database');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

function colorize(text, color) {
  return `${colors[color] || ''}${text}${colors.reset}`;
}

/**
 * Get portfolio report with summary
 */
async function getPortfolioReport(userId) {
  try {
    console.log(colorize('[Portfolio] Fetching portfolio data...', 'cyan'));

    // Update portfolio values first
    await database.updatePortfolioValues(userId);

    // Get portfolio holdings
    const holdings = await database.getUserPortfolio(userId);

    if (holdings.length === 0) {
      return {
        hasHoldings: false,
        holdings: [],
        summary: {
          totalValue: 0,
          totalGainLoss: 0,
          dailyChange: 0,
          holdingCount: 0
        },
        alerts: []
      };
    }

    // Calculate summary
    let totalValue = 0;
    let totalGainLoss = 0;
    let totalDailyChange = 0;
    let dailyChangeCount = 0;

    const enrichedHoldings = [];

    for (const holding of holdings) {
      totalValue += holding.current_value || 0;
      totalGainLoss += holding.unrealized_gain_loss || 0;

      if (holding.daily_change !== null && holding.daily_change !== undefined) {
        totalDailyChange += holding.daily_change;
        dailyChangeCount++;
      }

      // Calculate percentage gain/loss
      const gainLossPct = holding.avg_cost > 0
        ? ((holding.current_price - holding.avg_cost) / holding.avg_cost) * 100
        : 0;

      enrichedHoldings.push({
        ...holding,
        gain_loss_pct: gainLossPct
      });
    }

    const avgDailyChange = dailyChangeCount > 0 ? totalDailyChange / dailyChangeCount : 0;

    // Generate alerts
    const alerts = await generateAlerts(enrichedHoldings);

    const summary = {
      totalValue,
      totalGainLoss,
      dailyChange: avgDailyChange,
      holdingCount: holdings.length
    };

    console.log(colorize(`[Portfolio] ✓ Found ${holdings.length} holdings, value: PKR ${totalValue.toLocaleString()}`, 'green'));

    return {
      hasHoldings: true,
      holdings: enrichedHoldings,
      summary,
      alerts
    };
  } catch (error) {
    console.error(colorize(`[Portfolio] ✗ Error: ${error.message}`, 'red'));
    return {
      hasHoldings: false,
      holdings: [],
      summary: { totalValue: 0, totalGainLoss: 0, dailyChange: 0, holdingCount: 0 },
      alerts: [],
      error: error.message
    };
  }
}

/**
 * Generate alerts for significant portfolio changes
 */
async function generateAlerts(holdings) {
  const alerts = [];
  const ALERT_THRESHOLDS = {
    SIGNIFICANT_GAIN_PCT: 5,   // Alert on 5%+ gain
    SIGNIFICANT_LOSS_PCT: -5,   // Alert on 5%+ loss
    DAILY_GAIN_PCT: 3,          // Alert on 3%+ daily gain
    DAILY_LOSS_PCT: -3          // Alert on 3%+ daily loss
  };

  for (const holding of holdings) {
    const gainLossPct = holding.gain_loss_pct || 0;
    const dailyChange = holding.daily_change || 0;

    // Significant gain/loss alert
    if (gainLossPct >= ALERT_THRESHOLDS.SIGNIFICANT_GAIN_PCT) {
      alerts.push({
        symbol: holding.symbol,
        alert_type: 'SIGNIFICANT_GAIN',
        message: `${holding.symbol} is up ${gainLossPct.toFixed(1)}% from your average cost of PKR ${holding.avg_cost.toFixed(2)}`,
        time: new Date(),
        is_read: false
      });
    } else if (gainLossPct <= ALERT_THRESHOLDS.SIGNIFICANT_LOSS_PCT) {
      alerts.push({
        symbol: holding.symbol,
        alert_type: 'SIGNIFICANT_LOSS',
        message: `${holding.symbol} is down ${Math.abs(gainLossPct).toFixed(1)}% from your average cost of PKR ${holding.avg_cost.toFixed(2)}`,
        time: new Date(),
        is_read: false
      });
    }

    // Daily movement alert
    if (dailyChange >= ALERT_THRESHOLDS.DAILY_GAIN_PCT) {
      alerts.push({
        symbol: holding.symbol,
        alert_type: 'DAILY_GAIN',
        message: `${holding.symbol} gained ${dailyChange.toFixed(1)}% today`,
        time: new Date(),
        is_read: false
      });
    } else if (dailyChange <= ALERT_THRESHOLDS.DAILY_LOSS_PCT) {
      alerts.push({
        symbol: holding.symbol,
        alert_type: 'DAILY_LOSS',
        message: `${holding.symbol} lost ${Math.abs(dailyChange).toFixed(1)}% today`,
        time: new Date(),
        is_read: false
      });
    }
  }

  // Save alerts to database
  for (const alert of alerts) {
    await database.insertAlert(alert);
  }

  return alerts;
}

/**
 * Format portfolio summary for email template
 */
function formatPortfolioForEmail(portfolioReport) {
  if (!portfolioReport.hasHoldings) {
    return null;
  }

  return {
    totalValue: portfolioReport.summary.totalValue,
    dailyChange: portfolioReport.summary.dailyChange,
    unrealizedGainLoss: portfolioReport.summary.totalGainLoss,
    alerts: portfolioReport.alerts.map(a => ({
      symbol: a.symbol,
      message: a.message
    }))
  };
}

/**
 * Get top gainers from portfolio
 */
function getTopGainers(holdings, limit = 3) {
  if (!holdings || holdings.length === 0) return [];

  return holdings
    .filter(h => h.gain_loss_pct > 0)
    .sort((a, b) => (b.gain_loss_pct || 0) - (a.gain_loss_pct || 0))
    .slice(0, limit)
    .map(h => ({
      symbol: h.symbol,
      gain_pct: h.gain_loss_pct?.toFixed(1) || '0'
    }));
}

/**
 * Get top losers from portfolio
 */
function getTopLosers(holdings, limit = 3) {
  if (!holdings || holdings.length === 0) return [];

  return holdings
    .filter(h => h.gain_loss_pct < 0)
    .sort((a, b) => (a.gain_loss_pct || 0) - (b.gain_loss_pct || 0))
    .slice(0, limit)
    .map(h => ({
      symbol: h.symbol,
      loss_pct: Math.abs(h.gain_loss_pct || 0).toFixed(1)
    }));
}

/**
 * Get sector allocation
 */
function getSectorAllocation(holdings) {
  if (!holdings || holdings.length === 0) return {};

  const allocation = {};
  let totalValue = 0;

  for (const holding of holdings) {
    const sector = holding.sector || 'Unknown';
    const value = holding.current_value || 0;

    allocation[sector] = (allocation[sector] || 0) + value;
    totalValue += value;
  }

  // Convert to percentages
  const allocationPct = {};
  for (const sector in allocation) {
    allocationPct[sector] = totalValue > 0
      ? ((allocation[sector] / totalValue) * 100).toFixed(1)
      : 0;
  }

  return allocationPct;
}

/**
 * Monitor portfolio and return comprehensive report
 */
async function monitorPortfolio(userId) {
  console.log(colorize('[Portfolio] Starting portfolio monitoring...', 'cyan'));

  const report = await getPortfolioReport(userId);

  if (!report.hasHoldings) {
    console.log(colorize('[Portfolio] No holdings found for user', 'yellow'));
    return report;
  }

  // Add additional analysis
  const topGainers = getTopGainers(report.holdings);
  const topLosers = getTopLosers(report.holdings);
  const sectorAllocation = getSectorAllocation(report.holdings);

  const enrichedReport = {
    ...report,
    topGainers,
    topLosers,
    sectorAllocation
  };

  console.log(colorize(`[Portfolio] ✓ Monitoring complete`, 'green'));
  console.log(colorize(`[Portfolio]   Top Gainers: ${topGainers.map(g => `${g.symbol} (+${g.gain_pct}%)`).join(', ')}`, 'cyan'));
  console.log(colorize(`[Portfolio]   Top Losers: ${topLosers.map(l => `${l.symbol} (-${l.loss_pct}%)`).join(', ')}`, 'cyan'));

  return enrichedReport;
}

module.exports = {
  getPortfolioReport,
  generateAlerts,
  formatPortfolioForEmail,
  getTopGainers,
  getTopLosers,
  getSectorAllocation,
  monitorPortfolio
};

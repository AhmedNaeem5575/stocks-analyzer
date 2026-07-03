/**
 * Command-Line Interface for PSX Stock Analysis System
 */

const database = require('./database');
const scraper = require('./scraper');
const analyzer = require('./analyzer');
const strategies = require('./strategies');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

/**
 * Print colored text
 */
function colorize(text, color) {
  return `${colors[color] || ''}${text}${colors.reset}`;
}

/**
 * Create clickable hyperlink in terminal
 */
function link(text, url) {
  // ANSI hyperlink escape sequence
  // Format: \033]8;;URL\033\TEXT\033]8;;\033\
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
}

/**
 * Create clickable stock symbol link
 */
function stockLink(symbol) {
  const url = `https://sarmaaya.pk/stocks/${symbol}`;
  return link(symbol, url);
}

/**
 * Print header
 */
function printHeader(title) {
  console.log(`\n${colorize('═'.repeat(60), 'cyan')}`);
  console.log(colorize(`  ${title}`, 'bright'));
  console.log(colorize('═'.repeat(60), 'cyan') + '\n');
}

/**
 * Print stock table
 */
function printStockTable(stocks, columns) {
  if (!stocks || stocks.length === 0) {
    console.log(colorize('No stocks found', 'yellow'));
    return;
  }

  // Calculate column widths
  const widths = {};
  columns.forEach(col => {
    widths[col] = Math.max(
      col.length,
      ...stocks.map(s => String(s[col] || '-').length)
    );
  });

  // Print header
  const header = columns.map(col => col.padEnd(widths[col])).join(' | ');
  console.log(colorize(header, 'bright'));
  console.log(colorize('-'.repeat(header.length), 'dim'));

  // Print rows
  stocks.forEach((stock, i) => {
    const row = columns.map(col => {
      let value = stock[col];
      if (value === null || value === undefined) value = '-';

      // Colorize specific values
      if (col === 'symbol') {
        // Make symbol clickable - link to sarmaaya.pk
        const linkText = stockLink(String(value));
        return linkText.padEnd(widths[col] + 20); // Extra padding for hyperlink escape codes
      } else if (col === 'recommendation_rank') {
        return colorize(String(value).padEnd(widths[col]), 'cyan');
      } else if (col === 'risk_level') {
        const color = value === 'LOW' ? 'green' : value === 'MEDIUM' ? 'yellow' : 'red';
        return colorize(String(value).padEnd(widths[col]), color);
      } else if (col === 'composite_score' || col === 'score') {
        const color = value >= 70 ? 'green' : value >= 50 ? 'yellow' : 'red';
        return colorize(String(value).padEnd(widths[col]), color);
      } else if (col === 'expected_return') {
        const color = value >= 20 ? 'green' : value >= 10 ? 'yellow' : 'dim';
        return colorize((value + '%').padEnd(widths[col]), color);
      } else {
        return String(value).padEnd(widths[col]);
      }
    }).join(' | ');

    console.log(row);
  });
}

/**
 * Command: Analyze stocks
 */
async function cmdAnalyze(args) {
  printHeader('STOCK ANALYSIS');

  const timeframe = args.timeframe || 'medium';
  const symbol = args.symbol || null;

  console.log(`Timeframe: ${colorize(timeframe.toUpperCase(), 'cyan')}`);

  try {
    const isConnected = await database.testConnection();
    if (!isConnected) {
      console.log(colorize('✗ Database not connected. Please check your configuration.', 'red'));
      return;
    }

    if (symbol) {
      // Analyze single stock
      console.log(`\nAnalyzing ${stockLink(symbol)}...`);

      const analysis = await analyzer.getStockAnalysis(symbol);

      if (analysis.success) {
        console.log(colorize('✓ Analysis complete', 'green'));

        const stock = analysis.stockData;
        const score = {
          'Financial Health': analysis.financial_health_score,
          'Momentum': analysis.momentum_score,
          'Dividend': analysis.dividend_score,
          'Sector': analysis.sector_score,
          'Composite': analysis.composite_score
        };

        console.log(`\n${colorize('Scores:', 'bright')}`);
        Object.entries(score).forEach(([key, value]) => {
          const color = value >= 70 ? 'green' : value >= 50 ? 'yellow' : 'dim';
          console.log(`  ${key.padEnd(20)}: ${colorize(String(value), color)}`);
        });

        console.log(`\n${colorize('Stock Data:', 'bright')}`);
        console.log(`  ${'Price'.padEnd(20)}: ${colorize(String(stock.close), 'cyan')} PKR`);
        console.log(`  ${'PE Ratio'.padEnd(20)}: ${stock.pe_ratio || '-'}`);
        console.log(`  ${'Dividend Yield'.padEnd(20)}: ${stock.dividend_yield ? stock.dividend_yield + '%' : '-'}`);
        console.log(`  ${'Volume'.padEnd(20)}: ${stock.volume ? (stock.volume / 1000000).toFixed(2) + 'M' : '-'}`);
        console.log(`  ${'Market Cap'.padEnd(20)}: ${stock.market_cap ? (stock.market_cap / 1000000000).toFixed(2) + 'B' : '-'}`);

        // Get recommendation
        const rec = await strategies.getStockRecommendation(symbol, timeframe.toUpperCase());
        if (rec.success) {
          console.log(`\n${colorize('Recommendation:', 'bright')}`);
          console.log(`  ${'Strategy'.padEnd(20)}: ${rec.strategy_type}`);
          console.log(`  ${'Entry Price'.padEnd(20)}: ${colorize(String(rec.entry_price), 'cyan')} PKR`);
          console.log(`  ${'Target Price'.padEnd(20)}: ${colorize(String(rec.target_price), 'green')} PKR`);
          console.log(`  ${'Stop Loss'.padEnd(20)}: ${colorize(String(rec.stop_loss), 'red')} PKR`);
          console.log(`  ${'Expected Return'.padEnd(20)}: ${colorize(rec.expected_return + '%', 'green')}`);
          console.log(`  ${'Risk/Reward'.padEnd(20)}: ${rec.risk_reward_ratio}`);
        }
      } else {
        console.log(colorize(`✗ Analysis failed: ${analysis.error}`, 'red'));
      }
    } else {
      // Analyze all stocks
      console.log('\nAnalyzing all stocks in database...');
      const result = await analyzer.analyzeAllStocks();

      if (result.success) {
        console.log(colorize(`✓ Analyzed ${result.scores.length} stocks`, 'green'));

        const top10 = result.scores
          .sort((a, b) => b.composite_score - a.composite_score)
          .slice(0, 10);

        printStockTable(top10, [
          'symbol',
          'composite_score',
          'momentum_score',
          'financial_health_score',
          'risk_level'
        ]);
      } else {
        console.log(colorize(`✗ Analysis failed: ${result.error}`, 'red'));
      }
    }
  } catch (error) {
    console.log(colorize(`✗ Error: ${error.message}`, 'red'));
  }
}

/**
 * Command: Get top recommendations
 */
async function cmdTop(args) {
  printHeader('TOP RECOMMENDATIONS');

  const timeframe = (args.timeframe || 'short').toUpperCase();
  const limit = parseInt(args.limit) || 10;

  console.log(`Timeframe: ${colorize(timeframe, 'cyan')}`);
  console.log(`Limit: ${colorize(limit, 'cyan')}\n`);

  try {
    const isConnected = await database.testConnection();
    if (!isConnected) {
      console.log(colorize('✗ Database not connected', 'red'));
      return;
    }

    // Generate new recommendations
    console.log('Generating recommendations...');
    const result = await strategies.generateRecommendations(timeframe, limit);

    if (result.success && result.recommendations.length > 0) {
      console.log(colorize(`✓ Found ${result.recommendations.length} recommendations`, 'green') + '\n');

      printStockTable(result.recommendations, [
        'recommendation_rank',
        'symbol',
        'strategy_type',
        'entry_price',
        'target_price',
        'expected_return',
        'risk_reward_ratio',
        'risk_level'
      ]);

      // Show detailed info for top 3
      console.log(colorize('\nTop 3 Details:', 'bright') + '\n');

      result.recommendations.slice(0, 3).forEach((rec, i) => {
        console.log(colorize(`${i + 1}. `, 'cyan') + stockLink(rec.symbol) + colorize(` (${rec.strategy_type})`, 'cyan'));
        console.log(`   ${colorize('Reasoning:', 'dim')}`);
        console.log(`   ${rec.reasoning}`);
        console.log();
      });
    } else {
      console.log(colorize('✗ No recommendations found', 'yellow'));
    }
  } catch (error) {
    console.log(colorize(`✗ Error: ${error.message}`, 'red'));
  }
}

/**
 * Command: Scrape data
 */
async function cmdScrape(args) {
  printHeader('DATA SCRAPING');

  const headless = !args.headful;

  console.log(`Mode: ${colorize(headless ? 'Headless' : 'Headful', 'cyan')}\n`);

  try {
    console.log('Starting scraper...');
    const result = await scraper.scrapePSX({ headless });

    if (result.success) {
      console.log(colorize(`✓ Scraping complete`, 'green'));
      console.log(`  Stocks: ${colorize(result.count, 'cyan')}`);
      console.log(`  Duration: ${colorize(result.duration + 's', 'cyan')}`);
    } else {
      console.log(colorize(`✗ Scraping failed: ${result.error}`, 'red'));
    }
  } catch (error) {
    console.log(colorize(`✗ Error: ${error.message}`, 'red'));
  }
}

/**
 * Command: Show stock info
 */
async function cmdStock(args) {
  const symbol = args.symbol;

  if (!symbol) {
    console.log(colorize('✗ Please specify a stock symbol', 'red'));
    console.log('  Usage: node cli.js stock --symbol KEL');
    return;
  }

  printHeader(`STOCK INFO: ${symbol.toUpperCase()}`);

  try {
    const isConnected = await database.testConnection();
    if (!isConnected) {
      console.log(colorize('✗ Database not connected', 'red'));
      return;
    }

    const stocks = await database.getLatestStockData(symbol.toUpperCase());

    if (stocks.length === 0) {
      console.log(colorize(`✗ Stock ${symbol.toUpperCase()} not found`, 'yellow'));
      console.log('  Try running the scraper first: npm run scrape');
      return;
    }

    const stock = stocks[0];

    // Basic info
    console.log(colorize('Basic Information:', 'bright'));
    console.log(`  Symbol: ${colorize(stock.symbol, 'cyan')} (${stockLink(stock.symbol)})`);
    console.log(`  Name: ${stock.name}`);
    console.log(`  Sector: ${stock.sector}`);
    console.log(`  Current Price: ${colorize(stock.close + ' PKR', 'cyan')}`);
    console.log();

    // Performance
    console.log(colorize('Price Performance:', 'bright'));
    console.log(`  1 Day:   ${stock.change_1d ? stock.change_1d + '%' : '-'}`);
    console.log(`  1 Month: ${stock.change_1m ? stock.change_1m + '%' : '-'}`);
    console.log(`  3 Month: ${stock.change_3m ? stock.change_3m + '%' : '-'}`);
    console.log(`  6 Month: ${stock.change_6m ? stock.change_6m + '%' : '-'}`);
    console.log(`  1 Year:  ${stock.change_1y ? stock.change_1y + '%' : '-'}`);
    console.log();

    // Fundamentals
    console.log(colorize('Fundamentals:', 'bright'));
    console.log(`  Market Cap:        ${stock.market_cap ? (stock.market_cap / 1000000000).toFixed(2) + 'B PKR' : '-'}`);
    console.log(`  P/E Ratio:         ${stock.pe_ratio || '-'}`);
    console.log(`  Dividend Yield:    ${stock.dividend_yield ? stock.dividend_yield + '%' : '-'}`);
    console.log(`  Free Float:        ${stock.free_float ? (stock.free_float / 1000000).toFixed(2) + 'M' : '-'}`);
    console.log(`  Avg Volume (30D):  ${stock.avg_volume_30d ? (stock.avg_volume_30d / 1000000).toFixed(2) + 'M' : '-'}`);
    console.log();

    // Analysis scores
    console.log(colorize('Analysis Scores:', 'bright'));
    console.log(`  Financial Health:  ${stock.financial_health_score || '-'}`);
    console.log(`  Momentum:          ${stock.momentum_score || '-'}`);
    console.log(`  Dividend:          ${stock.dividend_score || '-'}`);
    console.log(`  Sector:            ${stock.sector_score || '-'}`);
    console.log(`  Composite:         ${stock.composite_score || '-'}`);
    console.log(`  Risk Level:        ${stock.risk_level || '-'}`);
    console.log(`  Volatility:        ${stock.volatility ? stock.volatility + '%' : '-'}`);
    console.log(`  Liquidity:         ${stock.liquidity_score || '-'}`);

  } catch (error) {
    console.log(colorize(`✗ Error: ${error.message}`, 'red'));
  }
}

/**
 * Command: Show help
 */
function cmdHelp() {
  printHeader('PSX STOCK ANALYSIS - CLI HELP');

  const commands = [
    { cmd: 'scrape', desc: 'Scrape latest data from PSX screener', usage: 'node cli.js scrape [--headful]' },
    { cmd: 'analyze', desc: 'Analyze stocks (all or single)', usage: 'node cli.js analyze [--symbol KEL] [--timeframe short|medium|long]' },
    { cmd: 'top', desc: 'Show top recommendations', usage: 'node cli.js top [--timeframe short|medium|long] [--limit 10]' },
    { cmd: 'stock', desc: 'Show detailed stock information', usage: 'node cli.js stock --symbol KEL' },
    { cmd: 'help', desc: 'Show this help message', usage: 'node cli.js help' }
  ];

  commands.forEach(({ cmd, desc, usage }) => {
    console.log(colorize(cmd, 'bright').padEnd(12) + ` - ${desc}`);
    console.log(colorize(`  ${usage}`, 'dim'));
    console.log();
  });

  console.log(colorize('Examples:', 'bright'));
  console.log(`  ${colorize('node cli.js scrape', 'cyan')}`);
  console.log(`  ${colorize('node cli.js analyze --symbol KEL --timeframe medium', 'cyan')}`);
  console.log(`  ${colorize('node cli.js top --timeframe short --limit 5', 'cyan')}`);
  console.log(`  ${colorize('node cli.js stock --symbol OGDC', 'cyan')}`);
  console.log();
  console.log(colorize('Note:', 'yellow') + ' Click on any stock symbol to open it on sarmaaya.pk');
  console.log();
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      parsed[key] = value;
      i += value !== true ? 1 : 0;
    }
  }
  return parsed;
}

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help') {
    cmdHelp();
    return;
  }

  const parsedArgs = parseArgs(args.slice(1));
  const command = args[0];

  switch (command) {
    case 'scrape':
      await cmdScrape(parsedArgs);
      break;
    case 'analyze':
      await cmdAnalyze(parsedArgs);
      break;
    case 'top':
      await cmdTop(parsedArgs);
      break;
    case 'stock':
      await cmdStock(parsedArgs);
      break;
    default:
      console.log(colorize(`✗ Unknown command: ${command}`, 'red'));
      console.log(`Run ${colorize('node cli.js help', 'cyan')} for available commands`);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(colorize('\n✗ Fatal error:', 'red'), error.message);
    process.exit(1);
  });
}

module.exports = { cmdScrape, cmdAnalyze, cmdTop, cmdStock, cmdHelp };

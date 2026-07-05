/**
 * PSX Data Scraper Module (Simple Version)
 * Collects stock data from Pakistan Stock Exchange market-watch using axios & cheerio
 *
 * LEGAL NOTICE: The PSX website restricts automated data collection.
 * For authorized data access, contact: marketdatarequest@psx.com.pk
 * This implementation is for personal investing and educational purposes.
 */

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const config = {
  marketWatchUrl: process.env.PSX_MARKET_WATCH_URL || 'https://dps.psx.com.pk/market-watch',
  timeout: 30000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

/**
 * Format number string (e.g., "1.5M" to 1500000)
 * @param {string|null} str - The number string to format
 * @param {boolean} asInteger - If true, round to nearest integer (for BIGINT columns)
 * @param {number} maxValue - Maximum allowed value (for DECIMAL columns to prevent overflow)
 */
function formatNumber(str, asInteger = false, maxValue = null) {
  if (!str || str === '-' || str === 'N/A') return null;

  const units = { 'K': 1000, 'M': 1000000, 'B': 1000000000 };
  const match = str.toString().match(/^([\d.,]+)([KMB]?)$/);

  let result;
  if (match) {
    const num = parseFloat(match[1].replace(/,/g, ''));
    const unit = match[2] || '';
    result = unit ? num * units[unit] : num;
  } else {
    result = parseFloat(str.replace(/,/g, '')) || null;
  }

  // Round to integer for BIGINT columns (volume, market_cap, etc.)
  if (asInteger && result !== null) {
    result = Math.round(result);
  }

  // Cap at maximum value to prevent numeric overflow
  if (maxValue !== null && result !== null && result > maxValue) {
    console.warn(`Value ${result} exceeds maximum ${maxValue}, capping at maximum`);
    result = maxValue;
  }

  return result;
}

/**
 * Format percentage string to decimal
 * @param {string|null} str - The percentage string to format
 * @param {number} maxValue - Maximum allowed value (default 999.99 for DECIMAL(5,2))
 */
function formatPercentage(str, maxValue = 999.99) {
  if (!str || str === '-' || str === 'N/A') return null;
  const cleaned = str.toString().replace(/[%,]/g, '');
  const result = parseFloat(cleaned) || null;

  // Cap at maximum value to prevent numeric overflow
  if (result !== null && result > maxValue) {
    console.warn(`Percentage ${result} exceeds maximum ${maxValue}, capping at maximum`);
    return maxValue;
  }

  return result;
}

/**
 * Sector code to name mapping
 * PSX uses numeric sector codes in the market-watch table
 */
const sectorCodeMap = {
  '0801': 'Automobile',
  '0802': 'Automobile',
  '0803': 'Engineering',
  '0804': 'Cement',
  '0805': 'Chemicals',
  '0806': 'Mutual Funds',
  '0807': 'Financials',
  '0808': 'Engineering',
  '0809': 'Fertilizer',
  '0810': 'Food',
  '0811': 'Materials',
  '0812': 'Financials',
  '0813': 'Financials',
  '0814': 'Materials',
  '0815': 'Financials',
  '0816': 'Materials',
  '0818': 'Other',
  '0819': 'Financials',
  '0820': 'Energy',
  '0821': 'Energy',
  '0822': 'Materials',
  '0823': 'Pharmaceuticals',
  '0824': 'Energy',
  '0825': 'Energy',
  '0826': 'Food',
  '0827': 'Textile',
  '0828': 'Technology',
  '0829': 'Textile',
  '0830': 'Textile',
  '0831': 'Textile',
  '0832': 'Consumer Goods',
  '0833': 'Transportation',
  '0834': 'Food',
  '0835': 'Textile',
  '0836': 'Real Estate',
  '0837': 'Mutual Funds',
  '0838': 'Real Estate',
  '0839': 'Textile'
};

/**
 * Convert sector code to sector name
 * @param {string} sector - The sector value from the table (could be code or name)
 */
function formatSector(sector) {
  if (!sector || sector === '-' || sector === 'N/A') return 'Unknown';

  const sectorStr = sector.toString().trim();

  // Check if it's a 4-digit sector code
  if (/^\d{4}$/.test(sectorStr)) {
    return sectorCodeMap[sectorStr] || sectorStr;
  }

  // Already a sector name, return as-is
  return sectorStr;
}

/**
 * Scrape market-watch page
 */
async function scrapeMarketWatch() {
  console.log(`Fetching data from ${config.marketWatchUrl}...`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    const response = await fetch(config.marketWatchUrl, {
      headers: {
        'User-Agent': config.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const stocks = [];

    // Parse table rows
    $('table.tbl tbody tr').each((index, element) => {
      const $row = $(element);
      const cells = $row.find('td');

      if (cells.length >= 11) {
        const symbol = $row.find('td:first a').text().trim();

        // Skip if no symbol found
        if (!symbol) return;

        stocks.push({
          symbol: symbol,
          name: null, // Not available in market-watch table
          sector: formatSector($(cells[1]).text().trim()),
          open: formatNumber($(cells[4]).text()),
          high: formatNumber($(cells[5]).text()),
          low: formatNumber($(cells[6]).text()),
          close: formatNumber($(cells[7]).text()),
          change: formatNumber($(cells[8]).text()),
          change_pct: formatPercentage($(cells[9]).text()),
          volume: formatNumber($(cells[10]).text(), true),
          market_cap: null, // Not in market-watch table
          pe_ratio: null, // Not in market-watch table
          dividend_yield: null, // Not in market-watch table
          free_float: null, // Not in market-watch table
          avg_volume_30d: null // Not in market-watch table
        });
      }
    });

    console.log(`Found ${stocks.length} stocks`);
    return stocks;
  } catch (error) {
    console.error('Error scraping market-watch:', error.message);
    return [];
  }
}

/**
 * Generate unique scrape ID
 */
function generateScrapeId() {
  const now = new Date();
  const date = now.toISOString().replace(/[-:.]/g, '').substring(0, 15);
  const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${date}-${randomSuffix}`;
}

/**
 * Parse and transform raw stock data
 */
function transformStockData(rawStocks, scrapeTime, scrapeId) {
  // Format date as YYYY-MM-DD for database DATE column
  const scrapeDate = scrapeTime.toISOString().substring(0, 10);

  return rawStocks.map(stock => ({
    time: scrapeTime,
    scrape_id: scrapeId,
    scrape_date: scrapeDate,
    symbol: stock.symbol,
    name: stock.symbol, // Use symbol as name since not available
    sector: stock.sector || 'Unknown',
    close: stock.close,
    open: stock.open,
    high: stock.high,
    low: stock.low,
    change_1d: stock.change_pct,
    change_1y: null, // Not available in market-watch
    volume: stock.volume,
    market_cap: stock.market_cap,
    pe_ratio: stock.pe_ratio,
    dividend_yield: stock.dividend_yield,
    free_float: stock.free_float,
    avg_volume_30d: stock.avg_volume_30d
  }));
}

/**
 * Main scraping function
 */
async function scrapePSX(options = {}) {
  const {
    saveJson = true
  } = options;

  console.log('Starting PSX scraper (Simple Version)...');
  console.log(`URL: ${config.marketWatchUrl}\n`);

  const startTime = Date.now();

  try {
    // Scrape market-watch page
    const rawStocks = await scrapeMarketWatch();

    if (rawStocks.length === 0) {
      throw new Error('No stocks found');
    }

    // Transform data
    const scrapeTime = new Date();
    const scrapeId = generateScrapeId();
    console.log(`Scrape ID: ${scrapeId}`);
    const stocks = transformStockData(rawStocks, scrapeTime, scrapeId);

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\nScraping completed in ${duration} seconds`);
    console.log(`Successfully scraped ${stocks.length} stocks\n`);

    // Save to file
    if (saveJson) {
      const exportDir = path.join(__dirname, 'data', 'exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const filename = path.join(exportDir, `stocks_${scrapeTime.toISOString().replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(filename, JSON.stringify({ scrapeTime, stocks }, null, 2));
      console.log(`Data saved to: ${filename}`);
    }

    // Log to database if available
    try {
      const db = require('./database');
      const isConnected = await db.testConnection();

      if (isConnected) {
        console.log('\nSaving data to database...');

        // First, insert/update stocks table (required for foreign key constraint)
        console.log('Step 1: Inserting stock symbols...');
        const stocksBasicData = stocks.map(s => ({
          symbol: s.symbol,
          name: s.name,
          sector: s.sector,
          is_active: true,
          last_seen_date: scrapeTime.toISOString().substring(0, 10)
        }));

        const stockResult = await db.bulkInsertStocks(stocksBasicData);
        console.log(`Stocks table: ${stockResult.successCount} succeeded, ${stockResult.failureCount} failed`);

        // Then insert daily data
        console.log('Step 2: Inserting daily data...');
        const dailyResult = await db.bulkInsertDailyData(stocks);

        await db.logScrape({
          status: dailyResult.success ? 'SUCCESS' : 'PARTIAL',
          stocks_scraped: dailyResult.successCount,
          errors: dailyResult.failureCount,
          duration_seconds: duration,
          data_source: 'PSX Market Watch'
        });

        console.log(`Database insert completed: ${dailyResult.successCount} succeeded, ${dailyResult.failureCount} failed`);

        // Mark stocks as inactive if not seen in 30+ days
        console.log('Step 3: Marking inactive stocks...');
        await db.markInactiveStocks(30);
      }
    } catch (error) {
      console.log('\nNote: Database save skipped (database not configured)');
      console.log('Error:', error.message);
    }

    return {
      success: true,
      scrapeTime,
      stocks,
      count: stocks.length,
      duration
    };

  } catch (error) {
    console.error('Scraping failed:', error.message);

    // Log failure to database if available
    try {
      const db = require('./database');
      await db.logScrape({
        status: 'FAILED',
        stocks_scraped: 0,
        errors: 1,
        error_details: error.message,
        duration_seconds: Math.round((Date.now() - startTime) / 1000),
        data_source: 'PSX Market Watch'
      });
    } catch (dbError) {
      // Database not available
    }

    return {
      success: false,
      error: error.message,
      stocks: []
    };
  }
}

// Run scraper if called directly
if (require.main === module) {
  scrapePSX({ saveJson: true })
    .then(result => {
      if (result.success) {
        console.log('\n✓ Scraping completed successfully');
        console.log(`  Stocks: ${result.count}`);
        console.log(`  Duration: ${result.duration}s`);
      } else {
        console.log('\n✗ Scraping failed');
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
  scrapePSX,
  config
};

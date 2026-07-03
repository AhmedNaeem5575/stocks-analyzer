/**
 * PSX Data Scraper Module
 * Collects stock data from Pakistan Stock Exchange screener using Playwright
 *
 * LEGAL NOTICE: The PSX website restricts automated data collection.
 * For authorized data access, contact: marketdatarequest@psx.com.pk
 * This implementation is for personal investing and educational purposes.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const config = {
  screenerUrl: process.env.PSX_SCREENER_URL || 'https://dps.psx.com.pk/screener',
  headless: process.env.HEADLESS === 'false' ? false : true,
  delayMin: parseInt(process.env.SCRAPE_DELAY_MIN) || 2000,
  delayMax: parseInt(process.env.SCRAPE_DELAY_MAX) || 5000,
  maxRetries: 3,
  timeout: 60000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

/**
 * Random delay between min and max milliseconds
 */
function randomDelay() {
  const delay = Math.floor(Math.random() * (config.delayMax - config.delayMin + 1)) + config.delayMin;
  return new Promise(resolve => setTimeout(resolve, delay));
}

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
 * Scrape PSX screener page
 */
async function scrapeScreenerPage(page, pageNum = 1) {
  console.log(`Scraping page ${pageNum}...`);

  try {
    // Wait for table to load
    await page.waitForSelector('table, tbody, tr', { timeout: 10000 });

    // Scroll to ensure all data is loaded
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Get all table rows
    const stocks = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      return Array.from(rows).map(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 0) return null;

        const getText = (index) => cells[index]?.textContent?.trim() || null;
        const getLinkText = (index) => {
          const link = cells[index]?.querySelector('a');
          return link?.textContent?.trim() || null;
        };

        // PSX Screener actual column structure (as of 2026):
        // 0: SYMBOL, 1: MARKET CAP, 2: PRICE, 3: CHANGE (%),
        // 4: 1-YEAR CH. (%), 5: PE RATIO, 6: DIVIDEND YIELD,
        // 7: FREE FLOAT, 8: 30D VOLUME AVG

        return {
          symbol: getLinkText(0) || getText(0),
          name: null, // Not available in main table
          sector: null, // Not available in main table
          price: getText(2),
          change: getText(3),
          change_pct: getText(3), // Same as change, includes %
          change_1y: getText(4),
          volume: getText(8),
          market_cap: getText(1),
          pe_ratio: getText(5),
          dividend_yield: getText(6),
          free_float: getText(7),
          avg_volume_30d: getText(8)
        };
      }).filter(item => item !== null && item.symbol);
    });

    console.log(`Found ${stocks.length} stocks on page ${pageNum}`);
    return stocks;
  } catch (error) {
    console.error(`Error scraping page ${pageNum}:`, error.message);
    return [];
  }
}

/**
 * Navigate through pagination and scrape all pages
 */
async function scrapeAllPages(page) {
  const allStocks = [];
  let pageNum = 1;
  let hasNextPage = true;
  let emptyPageCount = 0; // Track consecutive empty pages

  while (hasNextPage) {
    const stocks = await scrapeScreenerPage(page, pageNum);

    // If no stocks returned, we've reached the end
    if (stocks.length === 0) {
      console.log(`Page ${pageNum} returned no stocks, stopping pagination`);
      hasNextPage = false;
      break;
    }

    emptyPageCount = 0; // Reset empty page counter
    allStocks.push(...stocks);

    // Check for next page button/link
    const hasNext = await page.evaluate(() => {
      // Look for "Next" button or pagination links
      const nextButton = document.querySelector('a[rel="next"], .next, button[aria-label="Next"]');
      const paginationLinks = Array.from(document.querySelectorAll('.pagination a, nav a'));
      const currentPage = paginationLinks.find(a => a.classList.contains('active') || a.getAttribute('aria-current') === 'page');
      const currentPageNum = currentPage ? parseInt(currentPage.textContent) : 1;

      // Check if there's a page number greater than current
      const hasHigherPage = paginationLinks.some(a => {
        const num = parseInt(a.textContent);
        return !isNaN(num) && num > currentPageNum;
      });

      return !!(nextButton || hasHigherPage);
    });

    if (hasNext) {
      await randomDelay();

      try {
        // Try clicking next button or navigating to next page
        const clicked = await page.evaluate(() => {
          const nextButton = document.querySelector('a[rel="next"], .next, button[aria-label="Next"]');
          if (nextButton) {
            nextButton.click();
            return true;
          }

          // Try clicking the next page number
          const paginationLinks = Array.from(document.querySelectorAll('.pagination a, nav a'));
          const currentPage = paginationLinks.find(a =>
            a.classList.contains('active') || a.getAttribute('aria-current') === 'page'
          );
          const currentPageNum = currentPage ? parseInt(currentPage.textContent) : 1;

          const nextPageLink = paginationLinks.find(a => {
            const num = parseInt(a.textContent);
            return !isNaN(num) && num === currentPageNum + 1;
          });

          if (nextPageLink) {
            nextPageLink.click();
            return true;
          }

          return false;
        });

        if (!clicked) {
          console.log('Could not find next page button, stopping pagination');
          hasNextPage = false;
        } else {
          // Wait for page to load
          await page.waitForTimeout(2000);
          pageNum++;
        }
      } catch (error) {
        console.error('Error navigating to next page:', error.message);
        hasNextPage = false;
      }
    } else {
      hasNextPage = false;
    }

    // Safety limit to prevent infinite loops
    if (pageNum > 50) {
      console.log('Reached maximum page limit (50), stopping pagination');
      hasNextPage = false;
    }
  }

  console.log(`Total stocks scraped: ${allStocks.length} from ${pageNum} pages`);
  return allStocks;
}

/**
 * Generate unique scrape ID
 */
function generateScrapeId() {
  const now = new Date();
  // Format: YYYYMMDD-HHMMSS for readability
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
    sector: 'Unknown', // Sector not available in main table
    close: formatNumber(stock.price),
    change_1d: formatPercentage(stock.change_pct),
    change_1y: formatPercentage(stock.change_1y),
    volume: formatNumber(stock.volume, true),
    market_cap: formatNumber(stock.market_cap, true),
    pe_ratio: formatNumber(stock.pe_ratio, false, 99999999.99),  // DECIMAL(10,2) max
    dividend_yield: formatPercentage(stock.dividend_yield),
    free_float: formatNumber(stock.free_float, true),
    avg_volume_30d: formatNumber(stock.avg_volume_30d, true)
  }));
}

/**
 * Main scraping function
 */
async function scrapePSX(options = {}) {
  const {
    headless = config.headless,
    saveJson = true,
    saveCsv = false
  } = options;

  console.log('Starting PSX scraper...');
  console.log(`URL: ${config.screenerUrl}`);
  console.log(`Headless: ${headless}\n`);

  const browser = await chromium.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: config.userAgent,
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();
  const startTime = Date.now();

  try {
    // Navigate to screener
    console.log('Navigating to PSX screener...');
    await page.goto(config.screenerUrl, {
      waitUntil: 'networkidle',
      timeout: config.timeout
    });

    await randomDelay();

    // Check if we need to accept cookies or handle any popups
    try {
      const cookieButton = await page.$('button:has-text("Accept"), button:has-text("Agree"), .cookie-accept');
      if (cookieButton) {
        await cookieButton.click();
        await randomDelay();
      }
    } catch (error) {
      // No cookie popup, continue
    }

    // Scrape all pages
    const rawStocks = await scrapeAllPages(page);

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
          sector: s.sector
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
          data_source: 'PSX Screener'
        });

        console.log(`Database insert completed: ${dailyResult.successCount} succeeded, ${dailyResult.failureCount} failed`);
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
        data_source: 'PSX Screener'
      });
    } catch (dbError) {
      // Database not available
    }

    return {
      success: false,
      error: error.message,
      stocks: []
    };
  } finally {
    await browser.close();
  }
}

/**
 * Scrape individual stock historical data
 */
async function scrapeStockHistory(symbol, months = 12) {
  console.log(`Scraping historical data for ${symbol}...`);

  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({ userAgent: config.userAgent });
  const page = await context.newPage();

  try {
    const url = `https://dps.psx.com.pk/company/${symbol}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: config.timeout });
    await randomDelay();

    // Try to find historical data table or chart
    const historicalData = await page.evaluate(() => {
      // This will need to be adapted based on actual page structure
      const rows = document.querySelectorAll('table.historical-table tbody tr, .price-history tbody tr');
      return Array.from(rows).map(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 5) {
          return {
            date: cells[0]?.textContent?.trim(),
            open: cells[1]?.textContent?.trim(),
            high: cells[2]?.textContent?.trim(),
            low: cells[3]?.textContent?.trim(),
            close: cells[4]?.textContent?.trim(),
            volume: cells[5]?.textContent?.trim()
          };
        }
        return null;
      }).filter(item => item !== null);
    });

    console.log(`Found ${historicalData.length} historical data points for ${symbol}`);
    return { symbol, data: historicalData };

  } catch (error) {
    console.error(`Error scraping history for ${symbol}:`, error.message);
    return { symbol, data: [], error: error.message };
  } finally {
    await browser.close();
  }
}

/**
 * Load previously scraped data from file
 */
function loadScrapedData(filename) {
  const filepath = filename
    ? filename
    : path.join(__dirname, 'data', 'exports', 'stocks_latest.json');

  try {
    if (fs.existsSync(filepath)) {
      const data = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(data);
    }
    console.log(`No existing data found at: ${filepath}`);
    return null;
  } catch (error) {
    console.error(`Error loading data from ${filepath}:`, error.message);
    return null;
  }
}

/**
 * Get latest scraped data
 */
function getLatestData() {
  const exportDir = path.join(__dirname, 'data', 'exports');

  if (!fs.existsSync(exportDir)) {
    return null;
  }

  const files = fs.readdirSync(exportDir)
    .filter(f => f.startsWith('stocks_') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    return null;
  }

  const latestFile = path.join(exportDir, files[0]);
  return loadScrapedData(latestFile);
}

// Run scraper if called directly
if (require.main === module) {
  scrapePSX({ headless: true })
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
  scrapeStockHistory,
  loadScrapedData,
  getLatestData,
  config
};

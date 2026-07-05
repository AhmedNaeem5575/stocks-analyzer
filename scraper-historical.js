/**
 * Historical EOD Data Scraper
 * Collects End-of-Day historical data from PSX timeseries API
 * API endpoint: https://dps.psx.com.pk/timeseries/eod/{symbol}
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = {
  baseUrl: process.env.PSX_BASE_URL || 'https://dps.psx.com.pk/timeseries/eod',
  timeout: parseInt(process.env.SCRAPE_TIMEOUT) || 30000,
  delayMin: parseInt(process.env.SCRAPE_DELAY_MIN) || 100,
  delayMax: parseInt(process.env.SCRAPE_DELAY_MAX) || 500
};

/**
 * Random delay to respect rate limits
 */
function randomDelay() {
  const delay = Math.floor(Math.random() * (config.delayMax - config.delayMin + 1)) + config.delayMin;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Fetch EOD historical data for a symbol
 */
async function fetchEODData(symbol) {
  try {
    const url = `${config.baseUrl}/${symbol}`;
    console.log(`Fetching ${symbol}...`);

    const response = await axios.get(url, {
      timeout: config.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });

    if (response.data && response.data.status === 1 && response.data.data) {
      return {
        success: true,
        symbol,
        dataPoints: response.data.data.length,
        data: response.data.data
      };
    } else {
      return {
        success: false,
        symbol,
        error: 'Invalid response format'
      };
    }
  } catch (error) {
    return {
      success: false,
      symbol,
      error: error.message
    };
  }
}

/**
 * Parse EOD data structure
 * Based on sample: [timestamp, price1, volume, price2]
 * This appears to be: [timestamp, open_price, volume, close_price]
 */
function parseEODData(rawData, symbol) {
  if (!Array.isArray(rawData)) {
    return [];
  }

  return rawData.map(point => {
    // Structure: [timestamp (Unix), value1, volume, value2]
    // Hypothesis: value1 = open_price, value2 = close_price (or vice versa)
    const [timestamp, price1, volume, price2] = point;

    const date = new Date(timestamp * 1000).toISOString().substring(0, 10);

    return {
      symbol,
      date,
      timestamp,
      open: price1 || null,
      close: price2 || price1 || null,
      volume: volume || 0,
      high: null, // Not available in EOD data
      low: null   // Not available in EOD data
    };
  });
}

/**
 * Calculate OHLC from intraday data (if available)
 * Since EOD only provides O, C, V, we can infer H/L if needed
 */
function enhanceEODData(parsedData) {
  // Group by date and calculate high/low if we have intraday data
  // For now, we'll keep H/L as null since EOD doesn't provide them
  return parsedData;
}

/**
 * Scrape EOD data for multiple symbols
 */
async function scrapeHistoricalData(symbols, options = {}) {
  const {
    batchSize = 10,
    saveProgress = true,
    progressFile = './data/exports/historical-progress.json'
  } = options;

  console.log(`Starting historical data scrape for ${symbols.length} symbols...`);
  console.log(`Batch size: ${batchSize}\n`);

  const results = {
    total: symbols.length,
    success: 0,
    failed: 0,
    startTime: new Date().toISOString(),
    symbols: {},
    totalDataPoints: 0
  };

  // Load existing progress if file exists
  let startIndex = 0;
  if (saveProgress && fs.existsSync(progressFile)) {
    try {
      const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
      results.symbols = progress.symbols || {};
      results.success = progress.success || 0;
      results.failed = progress.failed || 0;
      startIndex = results.success + results.failed;

      console.log(`Resuming from index ${startIndex}`);
      console.log(`Already scraped: ${results.success} succeeded, ${results.failed} failed\n`);
    } catch (error) {
      console.log('Could not load progress file, starting fresh');
    }
  }

  for (let i = startIndex; i < symbols.length; i++) {
    const symbol = symbols[i];
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(symbols.length / batchSize);

    console.log(`[${batchNum}/${totalBatches}] ${i + 1}/${symbols.length} - ${symbol}`);

    const result = await fetchEODData(symbol);

    if (result.success) {
      const parsedData = parseEODData(result.data, symbol);

      results.symbols[symbol] = {
        success: true,
        dataPoints: result.dataPoints,
        dateRange: {
          from: parsedData.length > 0 ? parsedData[parsedData.length - 1].date : null,
          to: parsedData.length > 0 ? parsedData[0].date : null
        },
        data: parsedData
      };

      results.success++;
      results.totalDataPoints += result.dataPoints;

      console.log(`  ✓ ${result.dataPoints} data points`);
    } else {
      results.symbols[symbol] = {
        success: false,
        error: result.error
      };

      results.failed++;
      console.log(`  ✗ Failed: ${result.error}`);
    }

    // Save progress
    if (saveProgress && (i % batchSize === 0 || i === symbols.length - 1)) {
      const progressData = {
        total: results.total,
        success: results.success,
        failed: results.failed,
        symbols: results.symbols
      };

      const progressDir = path.dirname(progressFile);
      if (!fs.existsSync(progressDir)) {
        fs.mkdirSync(progressDir, { recursive: true });
      }

      fs.writeFileSync(progressFile, JSON.stringify(progressData, null, 2));
      console.log(`  Progress saved`);
    }

    // Rate limiting
    if (i < symbols.length - 1) {
      await randomDelay();
    }

    console.log('');
  }

  results.endTime = new Date().toISOString();
  results.duration = Math.round((new Date() - new Date(results.startTime)) / 1000);

  console.log(`\n=== Summary ===`);
  console.log(`Total symbols: ${results.total}`);
  console.log(`Successful: ${results.success}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total data points: ${results.totalDataPoints}`);
  console.log(`Duration: ${results.duration}s`);

  return results;
}

/**
 * Save historical data to database
 */
async function saveToDatabase(results) {
  try {
    const db = require('./database');
    const isConnected = await db.testConnection();

    if (!isConnected) {
      console.log('Database not connected, skipping save');
      return;
    }

    console.log('\nSaving historical data to database...');

    let totalInserted = 0;
    let totalFailed = 0;

    for (const [symbol, symbolData] of Object.entries(results.symbols)) {
      if (!symbolData.success || !symbolData.data) {
        continue;
      }

      // Insert each day's data
      for (const dayData of symbolData.data) {
        try {
          await db.insertDailyData({
            symbol: dayData.symbol,
            time: new Date(dayData.date),
            open: dayData.open,
            close: dayData.close,
            volume: dayData.volume,
            high: dayData.high,
            low: dayData.low,
            scrape_id: `HIST-${Date.now()}`,
            scrape_date: dayData.date
          });

          totalInserted++;
        } catch (error) {
          totalFailed++;
          if (totalFailed <= 5) {
            console.log(`Failed to insert ${dayData.symbol} for ${dayData.date}: ${error.message}`);
          }
        }
      }

      if (totalInserted % 1000 === 0) {
        console.log(`Inserted ${totalInserted} records...`);
      }
    }

    console.log(`\nDatabase save complete: ${totalInserted} succeeded, ${totalFailed} failed`);

  } catch (error) {
    console.error('Error saving to database:', error.message);
  }
}

/**
 * Export historical data to CSV
 */
function exportToCSV(results, outputFile) {
  const lines = ['symbol,date,timestamp,open,close,volume,high,low'];

  for (const [symbol, symbolData] of Object.entries(results.symbols)) {
    if (!symbolData.success || !symbolData.data) {
      continue;
    }

    for (const dayData of symbolData.data) {
      lines.push([
        symbol,
        dayData.date,
        dayData.timestamp,
        dayData.open,
        dayData.close,
        dayData.volume,
        dayData.high,
        dayData.low
      ].join(','));
    }
  }

  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, lines.join('\n'));
  console.log(`\nExported to CSV: ${outputFile}`);
}

// Run if called directly
if (require.main === module) {
  // Get symbols from database or use a default list
  const symbols = process.argv.slice(2);

  if (symbols.length === 0) {
    console.log('Usage: node scraper-historical.js SYMBOL1 SYMBOL2 ...');
    console.log('Or provide symbols via environment or database');

    // Try to load from database
    (async () => {
      try {
        const db = require('./database');
        const isConnected = await db.testConnection();

        if (isConnected) {
          const stocks = await db.pool.query('SELECT symbol FROM stocks ORDER BY symbol');
          const stockSymbols = stocks.rows.map(r => r.symbol);

          console.log(`Found ${stockSymbols.length} symbols in database`);
          console.log('Starting scrape...\n');

          const results = await scrapeHistoricalData(stockSymbols);

          // Save results
          const outputFile = `./data/exports/historical-${Date.now()}.json`;
          const outputDir = path.dirname(outputFile);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));

          // Save to database
          await saveToDatabase(results);

          // Export to CSV
          const csvFile = outputFile.replace('.json', '.csv');
          exportToCSV(results, csvFile);

          process.exit(results.success > 0 ? 0 : 1);
        } else {
          console.log('No database connection and no symbols provided');
          process.exit(1);
        }
      } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    })();
  } else {
    // Use provided symbols
    scrapeHistoricalData(symbols)
      .then(results => {
        const outputFile = `./data/exports/historical-${symbols[0]}-${Date.now()}.json`;
        fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
        console.log(`\nResults saved to: ${outputFile}`);
        process.exit(0);
      })
      .catch(error => {
        console.error('Error:', error);
        process.exit(1);
      });
  }
}

module.exports = {
  fetchEODData,
  parseEODData,
  scrapeHistoricalData,
  saveToDatabase,
  exportToCSV
};

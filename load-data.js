/**
 * Load previously scraped JSON data into database
 */

const fs = require('fs');
const path = require('path');
const database = require('./database');

async function loadScrapedData(jsonFile) {
  console.log('Loading scraped data from:', jsonFile);

  const filePath = jsonFile || path.join(__dirname, 'data', 'exports', 'stocks_latest.json');

  // Find latest file if not specified
  if (!fs.existsSync(filePath)) {
    const exportDir = path.join(__dirname, 'data', 'exports');
    const files = fs.readdirSync(exportDir)
      .filter(f => f.startsWith('stocks_') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      console.log('No exported data found');
      return;
    }

    const latestFile = path.join(exportDir, files[0]);
    console.log('Using latest file:', latestFile);

    const data = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
    await processData(data);
  } else {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    await processData(data);
  }
}

async function processData(data) {
  const stocks = data.stocks;
  console.log(`Processing ${stocks.length} stocks...`);

  try {
    // Step 1: Insert stocks table
    console.log('\nStep 1: Inserting into stocks table...');
    const stocksBasicData = stocks.map(s => ({
      symbol: s.symbol,
      name: s.name,
      sector: s.sector
    }));

    const stockResult = await database.bulkInsertStocks(stocksBasicData);
    console.log(`✓ Stocks table: ${stockResult.successCount} succeeded, ${stockResult.failureCount} failed`);

    // Step 2: Insert daily data
    console.log('\nStep 2: Inserting into stock_daily_data table...');
    const dailyResult = await database.bulkInsertDailyData(stocks);
    console.log(`✓ Daily data: ${dailyResult.successCount} succeeded, ${dailyResult.failureCount} failed`);

    // Verify
    console.log('\nVerifying...');
    const count = await database.pool.query('SELECT COUNT(*) FROM stock_daily_data');
    console.log(`Total records in stock_daily_data: ${count.rows[0].count}`);

    await database.closePool();
    console.log('\n✓ Load complete!');

  } catch (error) {
    console.error('Error:', error.message);
    await database.closePool();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const jsonFile = process.argv[2];
  loadScrapedData(jsonFile).catch(console.error);
}

module.exports = { loadScrapedData };

/**
 * Historical Data Import Script
 * Imports scraped historical data from JSON progress file to database
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PROGRESS_FILE = './data/exports/historical-progress.json';

async function importToDatabase(progressFile = PROGRESS_FILE) {
  const db = require('./database');

  // Test connection
  console.log('Testing database connection...');
  const isConnected = await db.testConnection();

  if (!isConnected) {
    console.error('Database connection failed');
    process.exit(1);
  }

  // Load progress data
  console.log(`\nLoading data from: ${progressFile}`);
  const data = JSON.parse(fs.readFileSync(progressFile, 'utf8'));

  console.log(`Total symbols: ${data.total}`);
  console.log(`Successful: ${data.success}`);
  console.log(`Failed: ${data.failed}\n`);

  const scrapeId = `HIST-${Date.now()}`;

  // Collect all data for bulk insert
  const allDailyData = [];
  let totalRecords = 0;

  console.log('Preparing data for bulk import...');

  for (const [symbol, symbolData] of Object.entries(data.symbols)) {
    if (!symbolData.success || !symbolData.data) {
      continue;
    }

    for (const dayData of symbolData.data) {
      allDailyData.push({
        symbol: dayData.symbol,
        time: new Date(dayData.date + 'T12:00:00Z'), // Noon time to avoid timezone issues
        open: dayData.open,
        close: dayData.close,
        volume: dayData.volume,
        high: dayData.high || Math.max(dayData.open, dayData.close),
        low: dayData.low || Math.min(dayData.open, dayData.close),
        scrape_id: scrapeId,
        scrape_date: dayData.date
      });
      totalRecords++;
    }

    if (totalRecords % 10000 === 0) {
      console.log(`  Prepared ${totalRecords} records...`);
    }
  }

  console.log(`\nTotal records to import: ${allDailyData.length}`);
  console.log('Starting bulk import...');

  // Import in batches to avoid overwhelming the database
  const BATCH_SIZE = 5000;
  let totalInserted = 0;
  let totalFailed = 0;

  for (let i = 0; i < allDailyData.length; i += BATCH_SIZE) {
    const batch = allDailyData.slice(i, Math.min(i + BATCH_SIZE, allDailyData.length));
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(allDailyData.length / BATCH_SIZE);

    console.log(`\nBatch ${batchNum}/${totalBatches} (${batch.length} records)...`);

    const result = await db.bulkInsertDailyData(batch);

    if (result.success) {
      totalInserted += result.successCount;
      totalFailed += result.failureCount;
      console.log(`  ✓ Batch ${batchNum} completed: ${result.successCount} succeeded, ${result.failureCount} failed`);
    } else {
      console.error(`  ✗ Batch ${batchNum} failed: ${result.error}`);
      totalFailed += batch.length;
    }
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`Total inserted: ${totalInserted}`);
  console.log(`Total failed: ${totalFailed}`);
  console.log(`Success rate: ${((totalInserted / (totalInserted + totalFailed)) * 100).toFixed(2)}%`);

  // Verify import
  console.log(`\n=== Verification ===`);
  const result = await db.pool.query(`
    SELECT
      COUNT(DISTINCT symbol) as symbols,
      COUNT(*) as records,
      MIN(time) as earliest_date,
      MAX(time) as latest_date
    FROM stock_daily_data
    WHERE scrape_id = $1
  `, [scrapeId]);

  if (result.rows.length > 0) {
    const row = result.rows[0];
    console.log(`Symbols imported: ${row.symbols}`);
    console.log(`Total records: ${row.records}`);
    console.log(`Date range: ${row.earliest_date?.toISOString().substring(0, 10)} to ${row.latest_date?.toISOString().substring(0, 10)}`);
  }

  await db.closePool();
}

// Run import
importToDatabase()
  .then(() => {
    console.log('\n✓ Import completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n✗ Import failed:', error);
    process.exit(1);
  });

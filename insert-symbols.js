/**
 * Insert Stock Symbols Script
 * Reads symbols from historical progress file and inserts them into the stocks table
 *
 * This script should be run BEFORE import-historical.js to ensure all symbols
 * exist in the stocks table (required for foreign key constraints)
 *
 * Usage:
 *   node insert-symbols.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PROGRESS_FILE = './data/exports/historical-progress.json';

async function insertSymbols(progressFile = PROGRESS_FILE) {
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

  // Extract all successful symbols
  const symbols = Object.keys(data.symbols).filter(symbol =>
    data.symbols[symbol].success && data.symbols[symbol].data
  );

  console.log(`=== Inserting ${symbols.length} symbols into stocks table ===\n`);

  // Prepare stock data
  const stocksBasicData = symbols.map(symbol => ({
    symbol: symbol,
    name: null,
    sector: null,
    industry: null
  }));

  // Bulk insert symbols
  const result = await db.bulkInsertStocks(stocksBasicData);

  console.log(`\n=== Insert Complete ===`);
  console.log(`Succeeded: ${result.successCount}`);
  console.log(`Failed: ${result.failureCount}`);

  if (result.failures && result.failures.length > 0) {
    console.log(`\nFailed symbols (${result.failures.length}):`);
    result.failures.slice(0, 10).forEach(f => {
      console.log(`  - ${f.symbol}: ${f.error}`);
    });
    if (result.failures.length > 10) {
      console.log(`  ... and ${result.failures.length - 10} more`);
    }
  }

  // Verify insertion
  const verifyResult = await db.pool.query('SELECT COUNT(*) as count FROM stocks');
  console.log(`\nTotal symbols in stocks table: ${verifyResult.rows[0].count}`);

  await db.closePool();
}

// Run insertion
insertSymbols()
  .then(() => {
    console.log('\n✓ Symbol insertion completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n✗ Symbol insertion failed:', error);
    process.exit(1);
  });

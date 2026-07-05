/**
 * Migration Script: Update Stock Sectors from PSX API
 * Fetches all symbols with sectors from https://dps.psx.com.pk/symbols
 * and updates the stocks table with correct sector information
 */

const axios = require('axios');
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
 * Fetch all symbols with sectors from PSX API
 */
async function fetchSymbolsFromPSX() {
  console.log(colorize('[Migration] Fetching symbols from PSX API...', 'cyan'));

  const url = 'https://dps.psx.com.pk/symbols';

  try {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.data && Array.isArray(response.data)) {
      console.log(colorize(`[Migration] ✓ Fetched ${response.data.length} symbols from PSX`, 'green'));
      return response.data;
    }

    // Try parsing as JSON if response is a string
    if (typeof response.data === 'string') {
      try {
        const parsed = JSON.parse(response.data);
        if (Array.isArray(parsed)) {
          console.log(colorize(`[Migration] ✓ Fetched ${parsed.length} symbols from PSX`, 'green'));
          return parsed;
        }
      } catch (parseError) {
        console.error(colorize('[Migration] ✗ Failed to parse response', 'red'));
      }
    }

    console.error(colorize('[Migration] ✗ Invalid response format', 'red'));
    return [];
  } catch (error) {
    console.error(colorize(`[Migration] ✗ Error fetching symbols: ${error.message}`, 'red'));
    return [];
  }
}

/**
 * Map PSX sector names to our database sector names
 * PSX may use different sector naming conventions
 */
function normalizeSectorName(sector) {
  if (!sector) return 'Other';

  const sectorMap = {
    // Main sectors
    'Technology': 'Technology',
    'Telecom': 'Telecommunication',
    'Telecommunication': 'Telecommunication',

    // Financial sectors
    'Financials': 'Financials',
    'Banks': 'Financials',
    'Banking': 'Financials',
    'Insurance': 'Financials',
    'Investment': 'Financials',
    'Investment Companies': 'Financials',
    'Asset Management': 'Financials',
    'Leasing Companies': 'Financials',
    'Leasing': 'Financials',
    'Modarabas': 'Financials',
    'MODARABAS': 'Financials',

    // Fixed Income
    'Bills and Bonds': 'Fixed Income',
    'BILLS AND BONDS': 'Fixed Income',
    'Fixed Income': 'Fixed Income',

    // Funds
    'Mutual Funds': 'Mutual Funds',
    'CLOSE - END MUTUAL FUND': 'Mutual Funds',
    'Exchange Traded Funds': 'Mutual Funds',
    'EXCHANGE TRADED FUNDS': 'Mutual Funds',

    // Energy
    'Energy': 'Energy',
    'Oil & Gas': 'Energy',
    'Oil and Gas': 'Energy',
    'Refinery': 'Energy',
    'REFINERY': 'Energy',
    'Power': 'Energy',
    'Power Generation': 'Energy',

    // Industrial/Manufacturing
    'Textile': 'Textile',
    'Textiles': 'Textile',
    'Textile Manufacturing': 'Textile',
    'Synthetic & Rayon': 'Textile',
    'SYNTHETIC & RAYON': 'Textile',
    'Cement': 'Cement',
    'Chemical': 'Chemicals',
    'Chemicals': 'Chemicals',
    'Engineering': 'Engineering',
    'Cable & Electrical Goods': 'Engineering',
    'CABLE & ELECTRICAL GOODS': 'Engineering',
    'Steel': 'Materials',
    'Glass & Ceramics': 'Materials',
    'GLASS & CERAMICS': 'Materials',

    // Consumer
    'Pharmaceutical': 'Pharmaceuticals',
    'Pharmaceuticals': 'Pharmaceuticals',
    'Automobile': 'Automobile',
    'Auto': 'Automobile',
    'Automotive': 'Automobile',
    'Assembler': 'Automobile',
    'Food': 'Food',
    'Food & Beverages': 'Food',
    'Sugar & Allied Industries': 'Food',
    'SUGAR & ALLIED INDUSTRIES': 'Food',
    'Vanaspati & Allied Industries': 'Food',
    'VANASPATI & ALLIED INDUSTRIES': 'Food',
    'Tobacco': 'Consumer Goods',
    'TOBACCO': 'Consumer Goods',

    // Materials
    'Paper': 'Materials',
    'Jute': 'Materials',
    'Leather & Tanneries': 'Materials',
    'LEATHER & TANNERIES': 'Materials',
    'Woolen': 'Textile',
    'WOOLLEN': 'Textile',
    'Apparel': 'Textile',
    'APPAREL': 'Textile',

    // Other
    'Construction': 'Construction',
    'Fertilizer': 'Fertilizer',
    'Fertilizers': 'Fertilizer',
    'Transport': 'Transportation',
    'Logistics': 'Transportation',
    'Real Estate': 'Real Estate',
    'Property': 'Real Estate',
    'Mining': 'Mining',
    'Materials': 'Materials',
    'Retail': 'Retail',
    'Trading': 'Trading',
    'Miscellaneous': 'Other',
    'Other': 'Other'
  };

  // Direct match (case-insensitive)
  const upperSector = sector.toUpperCase();
  for (const [key, value] of Object.entries(sectorMap)) {
    if (key.toUpperCase() === upperSector) {
      return value;
    }
  }

  // Partial match
  for (const [key, value] of Object.entries(sectorMap)) {
    if (upperSector.includes(key.toUpperCase())) {
      return value;
    }
  }

  // Return capitalized version if no match found
  return sector.charAt(0).toUpperCase() + sector.slice(1).toLowerCase();
}

/**
 * Update sectors in database
 */
async function updateSectorsInDatabase(symbolsData) {
  console.log(colorize('\n[Migration] Updating sectors in database...', 'cyan'));

  const client = await database.pool.connect();

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Get all current symbols from database
  const dbSymbols = await client.query('SELECT symbol, sector FROM stocks ORDER BY symbol');
  const dbSymbolMap = new Map(dbSymbols.rows.map(row => [row.symbol, row.sector]));

  console.log(colorize(`[Migration] Found ${dbSymbolMap.size} symbols in database`, 'cyan'));

  try {
    await client.query('BEGIN');

    for (const item of symbolsData) {
      const symbol = item.symbol || item.Symbol;

      if (!symbol) {
        skippedCount++;
        continue;
      }

      const symbolUpper = symbol.toUpperCase();
      const newSector = normalizeSectorName(item.sectorName || item.sector || item.Sector || item.category || item.Category);

      // Check if symbol exists in database
      if (!dbSymbolMap.has(symbolUpper)) {
        skippedCount++;
        continue;
      }

      const currentSector = dbSymbolMap.get(symbolUpper);

      // Skip if sector is the same
      if (currentSector === newSector) {
        skippedCount++;
        continue;
      }

      // Update sector
      try {
        await client.query(
          'UPDATE stocks SET sector = $1, updated_at = NOW() WHERE symbol = $2',
          [newSector, symbolUpper]
        );
        updatedCount++;

        // Show update
        const sectorChanged = currentSector !== newSector;
        const statusSymbol = sectorChanged ? '→' : '=';
        console.log(colorize(`  [${symbolUpper}] ${currentSector} ${statusSymbol} ${newSector}`, sectorChanged ? 'yellow' : 'cyan'));
      } catch (error) {
        errorCount++;
        console.error(colorize(`  ✗ Error updating ${symbolUpper}: ${error.message}`, 'red'));
      }
    }

    await client.query('COMMIT');

    console.log(colorize(`\n[Migration] ✓ Database update completed`, 'green'));
    console.log(colorize(`[Migration]   Updated: ${updatedCount} symbols`, 'cyan'));
    console.log(colorize(`[Migration]   Skipped: ${skippedCount} symbols`, 'cyan'));
    console.log(colorize(`[Migration]   Errors: ${errorCount} symbols`, errorCount > 0 ? 'red' : 'cyan'));

    return { success: true, updatedCount, skippedCount, errorCount };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(colorize(`[Migration] ✗ Transaction failed: ${error.message}`, 'red'));
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

/**
 * Show sector statistics
 */
async function showSectorStatistics() {
  console.log(colorize('\n[Migration] Current sector distribution:', 'cyan'));

  const result = await database.pool.query(`
    SELECT sector, COUNT(*) as count
    FROM stocks
    WHERE sector IS NOT NULL
    GROUP BY sector
    ORDER BY count DESC
  `);

  console.log(colorize('\nSector          Count', 'bright'));
  console.log(colorize('-'.repeat(30), 'cyan'));

  for (const row of result.rows) {
    const sector = (row.sector || 'NULL').padEnd(15, ' ');
    console.log(`${sector}   ${row.count}`);
  }
}

/**
 * Run the migration
 */
async function runMigration() {
  console.log(colorize('\n' + '='.repeat(60), 'cyan'));
  console.log(colorize('[Migration] PSX Stock Sector Update Migration', 'bright'));
  console.log(colorize('='.repeat(60) + '\n', 'cyan'));

  const startTime = Date.now();

  try {
    // Test database connection
    console.log(colorize('[Step 1/4] Testing database connection...', 'cyan'));
    const connected = await database.testConnection();

    if (!connected) {
      console.error(colorize('[Migration] ✗ Database connection failed', 'red'));
      return { success: false, error: 'Database connection failed' };
    }
    console.log(colorize('[Step 1/4] ✓ Database connected', 'green'));

    // Fetch symbols from PSX
    console.log(colorize('\n[Step 2/4] Fetching symbols from PSX API...', 'cyan'));
    const symbolsData = await fetchSymbolsFromPSX();

    if (!symbolsData || symbolsData.length === 0) {
      console.error(colorize('[Migration] ✗ No symbols fetched from PSX', 'red'));
      return { success: false, error: 'No symbols fetched' };
    }

    // Update database
    console.log(colorize('\n[Step 3/4] Updating sectors in database...', 'cyan'));
    const updateResult = await updateSectorsInDatabase(symbolsData);

    if (!updateResult.success) {
      console.error(colorize('[Migration] ✗ Database update failed', 'red'));
      return updateResult;
    }

    // Show statistics
    console.log(colorize('\n[Step 4/4] Showing sector statistics...', 'cyan'));
    await showSectorStatistics();

    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log(colorize('\n' + '='.repeat(60), 'cyan'));
    console.log(colorize('[Migration] ✓ Migration completed successfully', 'green'));
    console.log(colorize(`[Migration] Total duration: ${duration}s`, 'cyan'));
    console.log(colorize('='.repeat(60) + '\n', 'cyan'));

    return { success: true, duration, updateResult };

  } catch (error) {
    console.error(colorize(`\n[Migration] ✗ Migration failed: ${error.message}`, 'red'));
    console.log(colorize('='.repeat(60) + '\n', 'cyan'));
    return { success: false, error: error.message };
  }
}

// Run migration if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    console.log(colorize('[Migration] DRY RUN MODE - No database changes will be made', 'yellow'));
    // Just fetch and show what would be updated
    fetchSymbolsFromPSX().then(data => {
      console.log(colorize(`\n[Migration] Would update sectors for ${data.length} symbols`, 'cyan'));
      data.slice(0, 10).forEach(item => {
        const symbol = item.symbol || item.Symbol;
        const sector = item.sectorName || item.sector || item.Sector || 'N/A';
        console.log(colorize(`  ${symbol}: ${sector}`, 'cyan'));
      });
      if (data.length > 10) {
        console.log(colorize(`  ... and ${data.length - 10} more`, 'cyan'));
      }
    });
  } else {
    runMigration()
      .then(result => {
        process.exit(result.success ? 0 : 1);
      })
      .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
      });
  }
}

module.exports = {
  runMigration,
  fetchSymbolsFromPSX,
  normalizeSectorName,
  updateSectorsInDatabase
};

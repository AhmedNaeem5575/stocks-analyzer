/**
 * Fix Sector Codes - Convert numeric sector codes to proper sector names
 * PSX uses numeric codes like 0801, 0802, etc. that need to be mapped to sector names
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
 * Complete sector code to name mapping from PSX
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
 * Check if a value is a sector code (4 digit number)
 */
function isSectorCode(value) {
  if (!value) return false;
  return /^\d{4}$/.test(value.toString());
}

/**
 * Convert sector code to sector name
 */
function sectorCodeToName(code) {
  const codeStr = code.toString();
  if (sectorCodeMap[codeStr]) {
    return sectorCodeMap[codeStr];
  }
  return null;
}

/**
 * Fix all sector codes in the database
 */
async function fixSectorCodes() {
  console.log(colorize('\n' + '='.repeat(60), 'cyan'));
  console.log(colorize('[Fix] Converting Sector Codes to Sector Names', 'bright'));
  console.log(colorize('='.repeat(60) + '\n', 'cyan'));

  const client = await database.pool.connect();

  let fixedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    await client.query('BEGIN');

    // Get all stocks with sector values
    const result = await client.query('SELECT symbol, sector FROM stocks ORDER BY symbol');

    console.log(colorize(`[Fix] Found ${result.rows.length} stocks in database`, 'cyan'));
    console.log(colorize('[Fix] Scanning for numeric sector codes...\n', 'cyan'));

    for (const row of result.rows) {
      const { symbol, sector } = row;

      // Skip if sector is null or already a name
      if (!sector || !isSectorCode(sector)) {
        skippedCount++;
        continue;
      }

      const sectorName = sectorCodeToName(sector);

      if (!sectorName) {
        console.log(colorize(`  [${symbol}] Unknown sector code: ${sector}`, 'yellow'));
        skippedCount++;
        continue;
      }

      // Update the sector
      try {
        await client.query(
          'UPDATE stocks SET sector = $1, updated_at = NOW() WHERE symbol = $2',
          [sectorName, symbol]
        );
        fixedCount++;
        console.log(colorize(`  [${symbol}] ${sector} → ${sectorName}`, 'green'));
      } catch (error) {
        errorCount++;
        console.error(colorize(`  ✗ Error updating ${symbol}: ${error.message}`, 'red'));
      }
    }

    await client.query('COMMIT');

    console.log(colorize(`\n[Fix] ✓ Sector codes fixed successfully`, 'green'));
    console.log(colorize(`[Fix]   Fixed: ${fixedCount} stocks`, 'cyan'));
    console.log(colorize(`[Fix]   Skipped: ${skippedCount} stocks`, 'cyan'));
    console.log(colorize(`[Fix]   Errors: ${errorCount} stocks`, errorCount > 0 ? 'red' : 'cyan'));

    // Show updated sector distribution
    console.log(colorize('\n[Fix] Updated sector distribution:', 'cyan'));

    const stats = await client.query(`
      SELECT sector, COUNT(*) as count
      FROM stocks
      WHERE sector IS NOT NULL
      GROUP BY sector
      ORDER BY count DESC
    `);

    console.log(colorize('\nSector          Count', 'bright'));
    console.log(colorize('-'.repeat(30), 'cyan'));

    for (const row of stats.rows) {
      const sector = (row.sector || 'NULL').padEnd(15, ' ');
      console.log(`${sector}   ${row.count}`);
    }

    console.log(colorize('\n' + '='.repeat(60), 'cyan'));
    console.log(colorize('[Fix] ✓ Fix completed successfully', 'green'));
    console.log(colorize('='.repeat(60) + '\n', 'cyan'));

    return { success: true, fixedCount, skippedCount, errorCount };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(colorize(`\n[Fix] ✗ Fix failed: ${error.message}`, 'red'));
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

// Run fix if called directly
if (require.main === module) {
  fixSectorCodes()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  fixSectorCodes,
  sectorCodeToName,
  isSectorCode,
  sectorCodeMap
};

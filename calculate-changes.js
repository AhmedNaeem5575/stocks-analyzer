/**
 * Calculate Historical Price Changes
 * Computes change_1d, change_1w, change_1m, change_3m, change_6m, change_1y
 * from historical stock_daily_data
 */

const database = require('./database');
require('dotenv').config();

/**
 * Calculate percentage change between two prices
 */
function calculateChange(current, previous) {
  if (!previous || previous === 0) return null;
  if (!current || current === 0) return null;

  const result = ((current - previous) / previous) * 100;

  // Check for NaN or Infinity
  if (!isFinite(result)) return null;

  return result;
}

/**
 * Calculate changes for all records using bulk operations
 */
async function calculateAllHistoricalChanges() {
  console.log('=== Calculating Historical Price Changes ===\n');

  const isConnected = await database.testConnection();
  if (!isConnected) {
    console.error('Database connection failed');
    process.exit(1);
  }

  const startTime = Date.now();

  // Get all records grouped by symbol
  const result = await database.pool.query(`
    SELECT symbol, time, close
    FROM stock_daily_data
    WHERE close IS NOT NULL
    ORDER BY symbol, time
  `);

  console.log(`Found ${result.rows.length} records to process`);
  console.log('Organizing data by symbol...');

  // Group records by symbol
  const bySymbol = new Map();
  for (const row of result.rows) {
    if (!bySymbol.has(row.symbol)) {
      bySymbol.set(row.symbol, []);
    }
    bySymbol.get(row.symbol).push(row);
  }

  console.log(`Processing ${bySymbol.size} symbols...`);

  let processed = 0;
  let updated = 0;

  // Process each symbol
  for (const [symbol, records] of bySymbol) {
    // Create a map of time -> close for quick lookup
    const closeByTime = new Map();
    for (const rec of records) {
      closeByTime.set(rec.time.getTime(), parseFloat(rec.close));
    }

    const sortedTimes = Array.from(closeByTime.keys()).sort((a, b) => a - b);
    const updates = [];

    // Calculate changes for each record
    for (const time of sortedTimes) {
      const close = closeByTime.get(time);
      const currentIndex = sortedTimes.indexOf(time);

      const changes = {
        change_1d: null,
        change_1w: null,
        change_1m: null,
        change_3m: null,
        change_6m: null,
        change_1y: null
      };

      // 1 day change (1 trading day back)
      if (currentIndex >= 1) {
        changes.change_1d = calculateChange(close, closeByTime.get(sortedTimes[currentIndex - 1]));
      }

      // 1 week change (~5 trading days)
      if (currentIndex >= 5) {
        changes.change_1w = calculateChange(close, closeByTime.get(sortedTimes[currentIndex - 5]));
      }

      // 1 month change (~21 trading days)
      if (currentIndex >= 21) {
        changes.change_1m = calculateChange(close, closeByTime.get(sortedTimes[currentIndex - 21]));
      }

      // 3 month change (~63 trading days)
      if (currentIndex >= 63) {
        changes.change_3m = calculateChange(close, closeByTime.get(sortedTimes[currentIndex - 63]));
      }

      // 6 month change (~126 trading days)
      if (currentIndex >= 126) {
        changes.change_6m = calculateChange(close, closeByTime.get(sortedTimes[currentIndex - 126]));
      }

      // 1 year change (~252 trading days)
      if (currentIndex >= 252) {
        changes.change_1y = calculateChange(close, closeByTime.get(sortedTimes[currentIndex - 252]));
      }

      updates.push({
        symbol: symbol,
        time: new Date(time),
        changes: changes
      });
    }

    // Bulk update this symbol's records
    if (updates.length > 0) {
      const success = await bulkUpdateChanges(updates);
      if (success) {
        updated += updates.length;
      }
      processed += updates.length;
    }

    // Progress
    if (processed % 50000 === 0) {
      const progress = ((processed / result.rows.length) * 100).toFixed(1);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[${progress}%] ${processed}/${result.rows.length} processed (${elapsed}s elapsed)`);
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);

  console.log(`\n=== Summary ===`);
  console.log(`Total processed: ${processed}`);
  console.log(`Successfully updated: ${updated}`);
  console.log(`Duration: ${duration}s`);

  await database.closePool();
}

/**
 * Bulk update changes for multiple records
 */
async function bulkUpdateChanges(updates) {
  const client = await database.pool.connect();

  try {
    await client.query('BEGIN');

    // Helper function to format a value for SQL with explicit type casting
    const formatValue = (val) => {
      if (val === null || val === undefined) return 'NULL::numeric';
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'::numeric`;
      if (val instanceof Date) return `'${val.toISOString()}'`;
      if (typeof val === 'number') {
        // Check for NaN or Infinity
        if (!isFinite(val)) return 'NULL::numeric';
        return `${val}::numeric`; // Explicitly cast to numeric
      }
      return 'NULL::numeric';
    };

    // Build CASE WHEN clauses for each column
    const cases = {
      change_1d: [],
      change_1w: [],
      change_1m: [],
      change_3m: [],
      change_6m: [],
      change_1y: []
    };
    const whens = [];

    for (const update of updates) {
      const key = `${update.symbol}_${update.time.getTime()}`;
      whens.push(`'${update.symbol}_${update.time.getTime()}'`);

      cases.change_1d.push(`WHEN '${update.symbol}_${update.time.getTime()}' THEN ${formatValue(update.changes.change_1d)}`);
      cases.change_1w.push(`WHEN '${update.symbol}_${update.time.getTime()}' THEN ${formatValue(update.changes.change_1w)}`);
      cases.change_1m.push(`WHEN '${update.symbol}_${update.time.getTime()}' THEN ${formatValue(update.changes.change_1m)}`);
      cases.change_3m.push(`WHEN '${update.symbol}_${update.time.getTime()}' THEN ${formatValue(update.changes.change_3m)}`);
      cases.change_6m.push(`WHEN '${update.symbol}_${update.time.getTime()}' THEN ${formatValue(update.changes.change_6m)}`);
      cases.change_1y.push(`WHEN '${update.symbol}_${update.time.getTime()}' THEN ${formatValue(update.changes.change_1y)}`);
    }

    const query = `
      UPDATE stock_daily_data
      SET
        change_1d = (CASE (symbol || '_' || extract(epoch from time)::bigint)::text ${cases.change_1d.map(c => c).join(' ')} ELSE NULL::numeric END)::numeric,
        change_1w = (CASE (symbol || '_' || extract(epoch from time)::bigint)::text ${cases.change_1w.map(c => c).join(' ')} ELSE NULL::numeric END)::numeric,
        change_1m = (CASE (symbol || '_' || extract(epoch from time)::bigint)::text ${cases.change_1m.map(c => c).join(' ')} ELSE NULL::numeric END)::numeric,
        change_3m = (CASE (symbol || '_' || extract(epoch from time)::bigint)::text ${cases.change_3m.map(c => c).join(' ')} ELSE NULL::numeric END)::numeric,
        change_6m = (CASE (symbol || '_' || extract(epoch from time)::bigint)::text ${cases.change_6m.map(c => c).join(' ')} ELSE NULL::numeric END)::numeric,
        change_1y = (CASE (symbol || '_' || extract(epoch from time)::bigint)::text ${cases.change_1y.map(c => c).join(' ')} ELSE NULL::numeric END)::numeric
      WHERE (symbol, time) IN (
        ${updates.map(u => `('${u.symbol}', '${u.time.toISOString()}')`).join(', ')}
      )
    `;

    await client.query(query);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Bulk update failed: ${error.message}`);
    return false;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  calculateAllHistoricalChanges()
    .then(() => {
      console.log('\n✓ Historical changes calculated');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n✗ Failed:', error);
      process.exit(1);
    });
}

module.exports = {
  calculateChangesForRecord: async function(symbol, time, close) {
    // Legacy function for compatibility
    const currentPrice = parseFloat(close);
    if (!currentPrice || currentPrice === 0) {
      return null;
    }

    const changes = {};

    // Need previous prices - this is inefficient, kept for backward compatibility
    const offsets = {1: 1, 7: 5, 30: 21, 90: 63, 180: 126, 365: 252};

    for (const [period, days] of Object.entries(offsets)) {
      const result = await database.pool.query(`
        SELECT close
        FROM stock_daily_data
        WHERE symbol = $1 AND time < $2
        ORDER BY time DESC
        LIMIT 1
        OFFSET $3
      `, [symbol, time, days - 1]);

      if (result.rows.length > 0) {
        const prevPrice = parseFloat(result.rows[0].close);
        changes[`change_${period}d`] = calculateChange(currentPrice, prevPrice);
      }
    }

    return changes;
  },
  calculateAllHistoricalChanges
};

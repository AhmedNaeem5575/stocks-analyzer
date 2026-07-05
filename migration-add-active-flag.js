/**
 * Migration: Add is_active and last_seen_date columns to stocks table
 * Run this to update existing databases
 */

const database = require('./database');

async function migrate() {
  console.log('=== Migration: Add is_active flag to stocks table ===\n');

  try {
    const isConnected = await database.testConnection();
    if (!isConnected) {
      console.error('Database connection failed');
      process.exit(1);
    }

    // Check if columns already exist
    const checkResult = await database.pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'stocks'
        AND column_name IN ('is_active', 'last_seen_date')
    `);

    const existingColumns = checkResult.rows.map(r => r.column_name);

    // Add is_active column if not exists
    if (!existingColumns.includes('is_active')) {
      console.log('Adding is_active column...');
      await database.pool.query(`
        ALTER TABLE stocks
        ADD COLUMN is_active BOOLEAN DEFAULT true
      `);
      console.log('✓ Added is_active column');
    } else {
      console.log('is_active column already exists');
    }

    // Add last_seen_date column if not exists
    if (!existingColumns.includes('last_seen_date')) {
      console.log('Adding last_seen_date column...');
      await database.pool.query(`
        ALTER TABLE stocks
        ADD COLUMN last_seen_date DATE
      `);
      console.log('✓ Added last_seen_date column');
    } else {
      console.log('last_seen_date column already exists');
    }

    // Set last_seen_date based on stock_daily_data
    console.log('\nPopulating last_seen_date from existing data...');
    const updateResult = await database.pool.query(`
      UPDATE stocks s
      SET last_seen_date = (
        SELECT MAX(d.time)::date
        FROM stock_daily_data d
        WHERE d.symbol = s.symbol
      )
      WHERE s.last_seen_date IS NULL
    `);

    console.log(`✓ Updated ${updateResult.rowCount} stocks with last_seen_date`);

    // Mark stocks as inactive if not seen in last 30 days
    console.log('\nMarking inactive stocks (not seen in 30+ days)...');
    const inactiveResult = await database.pool.query(`
      UPDATE stocks
      SET is_active = false
      WHERE last_seen_date < CURRENT_DATE - INTERVAL '30 days'
        OR last_seen_date IS NULL
    `);

    console.log(`✓ Marked ${inactiveResult.rowCount} stocks as inactive`);

    // Show summary
    const summary = await database.pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE is_active = false) as inactive
      FROM stocks
    `);

    console.log('\n=== Summary ===');
    console.log(`Total stocks: ${summary.rows[0].total}`);
    console.log(`Active stocks: ${summary.rows[0].active}`);
    console.log(`Inactive stocks: ${summary.rows[0].inactive}`);

    await database.closePool();
    console.log('\n✓ Migration completed successfully');
    process.exit(0);

  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration
migrate();

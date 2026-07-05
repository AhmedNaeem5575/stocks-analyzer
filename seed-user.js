/**
 * Generate password hash and seed user
 */

const bcrypt = require('bcrypt');
const { pool } = require('./database');

async function seedUser() {
  const username = 'ahmednaeem5575';
  const password = '9026040An!';
  const email = 'ahmednaeem.career@gmail.com';

  console.log('Seeding user...');

  try {
    // Generate password hash
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    console.log('Password hash generated');

    // Insert user
    await pool.query(`
      INSERT INTO users (username, password_hash, email)
      VALUES ($1, $2, $3)
      ON CONFLICT (username) DO UPDATE SET
        password_hash = EXCLUDED.password_hash
    `, [username, passwordHash, email]);

    console.log(`✓ User '${username}' created successfully`);
    console.log(`  Password: ${password}`);

    // Verify user was created
    const result = await pool.query('SELECT username, created_at FROM users WHERE username = $1', [username]);
    if (result.rows.length > 0) {
      console.log(`  Created at: ${result.rows[0].created_at}`);
    }

    await pool.close();
  } catch (error) {
    console.error('Failed to seed user:', error.message);
    process.exit(1);
  }
}

seedUser();

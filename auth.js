/**
 * Authentication Module
 * Handles user authentication for dashboard
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { pool } = require('./database');

/**
 * Verify user credentials
 */
async function verifyCredentials(username, password) {
  try {
    const result = await pool.query(
      'SELECT id, username, password_hash, is_active FROM users WHERE username = $1 AND is_active = TRUE',
      [username]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'Invalid username or password' };
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return { success: false, error: 'Invalid username or password' };
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username
      }
    };

  } catch (error) {
    console.error('Authentication error:', error.message);
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Get user by ID (for session validation)
 */
async function getUserById(userId) {
  try {
    const result = await pool.query(
      'SELECT id, username, is_active FROM users WHERE id = $1 AND is_active = TRUE',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error('Get user error:', error.message);
    return null;
  }
}

/**
 * Generate a remember token
 */
async function generateRememberToken(userId, days = 30) {
  try {
    // Generate random token
    const token = crypto.randomBytes(32).toString('hex');

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    // Clean up old tokens for this user
    await pool.query('DELETE FROM remember_tokens WHERE user_id = $1', [userId]);

    // Store new token
    await pool.query(
      'INSERT INTO remember_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, token, expiresAt]
    );

    return token;
  } catch (error) {
    console.error('Generate token error:', error.message);
    return null;
  }
}

/**
 * Validate remember token and return user
 */
async function validateRememberToken(token) {
  try {
    const result = await pool.query(
      `SELECT rt.user_id, u.id, u.username, u.is_active
       FROM remember_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token = $1
         AND rt.expires_at > NOW()
         AND u.is_active = TRUE`,
      [token]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];

    // Update last used timestamp
    await pool.query(
      'UPDATE remember_tokens SET last_used = NOW() WHERE token = $1',
      [token]
    );

    return {
      id: user.id,
      username: user.username
    };
  } catch (error) {
    console.error('Validate token error:', error.message);
    return null;
  }
}

/**
 * Delete remember token (logout)
 */
async function deleteRememberToken(token) {
  try {
    await pool.query('DELETE FROM remember_tokens WHERE token = $1', [token]);
    return true;
  } catch (error) {
    console.error('Delete token error:', error.message);
    return false;
  }
}

module.exports = {
  verifyCredentials,
  getUserById,
  generateRememberToken,
  validateRememberToken,
  deleteRememberToken
};

/**
 * Validate Remember Token
 * Called from Python dashboard for auto-login
 */

const path = require('path');

// Get absolute path to parent directory
const parentDir = path.join(__dirname, '..');

// Load .env from parent directory before anything else
process.env.PWD = parentDir;
require('dotenv').config({ path: path.join(parentDir, '.env') });

// Now load auth (which loads database.js which uses env vars)
const auth = require(path.join(parentDir, 'auth.js'));

(async () => {
  const token = process.argv[2];

  if (!token) {
    console.log(JSON.stringify({ success: false, error: 'Missing token' }));
    process.exit(1);
  }

  try {
    const user = await auth.validateRememberToken(token);

    if (user) {
      console.log(JSON.stringify({
        success: true,
        user: {
          id: user.id,
          username: user.username
        }
      }));
      process.exit(0);
    } else {
      console.log(JSON.stringify({ success: false, error: 'Invalid or expired token' }));
      process.exit(1);
    }
  } catch (error) {
    console.log(JSON.stringify({ success: false, error: error.message }));
    process.exit(1);
  }
})();

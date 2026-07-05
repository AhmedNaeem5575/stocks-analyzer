/**
 * Verify User Credentials
 * Called from Python login page
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
  const username = process.argv[2];
  const password = process.argv[3];
  const remember = process.argv[4] === 'true';

  if (!username || !password) {
    console.log(JSON.stringify({ success: false, error: 'Missing credentials' }));
    process.exit(1);
  }

  try {
    const result = await auth.verifyCredentials(username, password);

    if (result.success && remember) {
      // Generate remember token
      const token = await auth.generateRememberToken(result.user.id, 30);
      if (token) {
        result.token = token;
      }
    }

    console.log(JSON.stringify(result));
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.log(JSON.stringify({ success: false, error: error.message }));
    process.exit(1);
  }
})();

/**
 * Delete Remember Token
 * Called from Python dashboard on logout
 */

const path = require('path');
const auth = require('./auth.js');

(async () => {
  const token = process.argv[2];

  if (!token) {
    console.log(JSON.stringify({ success: false, error: 'Missing token' }));
    process.exit(1);
  }

  try {
    await auth.deleteRememberToken(token);
    console.log(JSON.stringify({ success: true }));
    process.exit(0);
  } catch (error) {
    console.log(JSON.stringify({ success: false, error: error.message }));
    process.exit(1);
  }
})();

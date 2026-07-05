#!/usr/bin/env node

/**
 * Test Email Notification
 *
 * This script tests your email notification configuration.
 * It will send a test email to verify everything is working.
 *
 * Usage:
 *   node test-email.js                    # Test SMTP connection only
 *   node test-email.js --send             # Send a test email
 *
 * Environment variables required in .env:
 *   EMAIL_USER               Your email address
 *   EMAIL_APP_PASSWORD       Your app-specific password (not your login password!)
 *   EMAIL_HOST               SMTP server (default: smtp.gmail.com)
 *   EMAIL_PORT               SMTP port (default: 587)
 */

const notifier = require('./notifier');
const database = require('./database');

const args = process.argv.slice(2);
const shouldSend = args.includes('--send');

console.log('\n========================================');
console.log('   PSX Stock Analysis - Email Test');
console.log('========================================\n');

async function runTest() {
  try {
    // Step 1: Get user email from database
    console.log('👤 Step 1: Getting user email from database...');
    const userEmail = await database.getUserEmail('ahmednaeem5575');

    if (!userEmail) {
      console.error('   ✗ User email not found in database');
      console.log('   → Using fallback from environment variables\n');
    } else {
      console.log(`   ✓ User email: ${userEmail}\n`);
    }

    // Step 2: Validate configuration
    console.log('📋 Step 2: Validating email configuration...');
    const config = notifier.validateConfig();
    console.log(`   ✓ Email user: ${config.user}`);
    console.log(`   ✓ SMTP host: ${config.host}:${config.port}`);
    console.log(`   ✓ From: ${config.from}\n`);

    // Step 3: Test SMTP connection
    console.log('🔌 Step 3: Testing SMTP connection...');
    const testResult = await notifier.testEmail();

    if (!testResult.success) {
      console.error(`   ✗ Connection failed: ${testResult.error}`);
      console.log('\n💡 Troubleshooting tips:');
      console.log('   1. For Gmail: Generate an App Password at');
      console.log('      https://myaccount.google.com/apppasswords');
      console.log('   2. Use the App Password (16 characters) as EMAIL_APP_PASSWORD');
      console.log('   3. Make sure "Less secure app access" is NOT required');
      console.log('   4. Check if 2FA is enabled on your account\n');
      process.exit(1);
    }

    console.log('   ✓ SMTP connection successful\n');

    // Step 4: Send test email (if requested)
    if (shouldSend) {
      console.log('📧 Step 4: Sending test email...');
      console.log(`   → Sending to: ${userEmail || config.user}`);
      const sendResult = await notifier.sendTestEmail(userEmail);

      if (sendResult.success) {
        console.log('   ✓ Test email sent successfully!');
        console.log(`   ✓ Message ID: ${sendResult.messageId}`);
        console.log('\n   → Check your inbox (and spam folder)\n');
      } else {
        console.error(`   ✗ Failed to send: ${sendResult.error}`);
        console.error(`   ✗ Error code: ${sendResult.code}\n`);
        process.exit(1);
      }
    } else {
      console.log('ℹ️  To send a test email, run:');
      console.log('   node test-email.js --send\n');
    }

    console.log('========================================');
    console.log('   ✓ Email test completed successfully!');
    console.log('========================================\n');

  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}\n`);
    console.log('💡 Make sure you have configured these in your .env file:');
    console.log('   EMAIL_USER=your-email@gmail.com');
    console.log('   EMAIL_APP_PASSWORD=your-16-char-app-password');
    console.log('   EMAIL_HOST=smtp.gmail.com');
    console.log('   EMAIL_PORT=587\n');
    process.exit(1);
  }
}

runTest();

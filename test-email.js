#!/usr/bin/env node

/**
 * Test Email Notification
 *
 * This script tests your email notification configuration.
 * It will send a test email to verify everything is working.
 *
 * Usage:
 *   node test-email.js                    # Test email connection only
 *   node test-email.js --send             # Send a test email
 *
 * Environment variables in .env:
 *   EMAIL_SERVICE=sendgrid|smtp
 *   SENDGRID_API_KEY=your-key (for sendgrid)
 *   EMAIL_FROM=sender@example.com
 *
 * For SMTP:
 *   EMAIL_USER=your-email@gmail.com
 *   EMAIL_APP_PASSWORD=your-app-password
 *   EMAIL_HOST=smtp.gmail.com
 *   EMAIL_PORT=587
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
    console.log(`   ✓ Email service: ${config.service}`);
    console.log(`   ✓ From: ${config.from}\n`);

    // Step 3: Test email connection
    console.log('🔌 Step 3: Testing email connection...');
    const testResult = await notifier.testEmail();

    if (!testResult.success) {
      console.error(`   ✗ Connection failed: ${testResult.error}`);
      console.log('\n💡 Troubleshooting tips:');
      console.log('   • Check your EMAIL_SERVICE setting in .env');
      console.log('   • For SendGrid: Verify SENDGRID_API_KEY is set');
      console.log('   • For SMTP: Check EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_APP_PASSWORD\n');
      process.exit(1);
    }

    console.log('   ✓ Connection successful\n');

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
    console.log('   EMAIL_SERVICE=sendgrid|smtp');
    console.log('   SENDGRID_API_KEY=your-key (if using sendgrid)');
    console.log('   EMAIL_USER=your-email@gmail.com (if using smtp)');
    console.log('   EMAIL_APP_PASSWORD=your-app-password (if using smtp)\n');
    process.exit(1);
  }
}

runTest();

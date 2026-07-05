/**
 * Email Notification Service
 * Handles email delivery via SMTP (nodemailer)
 * Includes retry logic and template rendering
 */

const nodemailer = require('nodemailer');
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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
 * Validate email configuration
 */
function validateConfig() {
  const required = ['EMAIL_USER', 'EMAIL_APP_PASSWORD'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required email configuration: ${missing.join(', ')}`);
  }

  return {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER
  };
}

/**
 * Create SMTP transporter
 */
function createTransporter() {
  const config = validateConfig();

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass
    }
  });

  return transporter;
}

/**
 * Delay helper for retry logic
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send email with retry logic
 */
async function sendEmail(to, subject, html, text = null) {
  const config = validateConfig();
  const transporter = createTransporter();

  const mailOptions = {
    from: config.from,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject: subject,
    html: html,
    text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for text version
  };

  let lastError;

  // Retry logic: 3 attempts with exponential backoff
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(colorize(`[Email] Attempt ${attempt}/3: Sending to ${mailOptions.to}`, 'cyan'));

      const info = await transporter.sendMail(mailOptions);

      console.log(colorize(`[Email] ✓ Sent successfully: ${info.messageId}`, 'green'));

      await transporter.close();
      return { success: true, messageId: info.messageId };
    } catch (error) {
      lastError = error;
      console.error(colorize(`[Email] ✗ Attempt ${attempt} failed: ${error.message}`, 'red'));

      if (attempt < 3) {
        const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(colorize(`[Email] Retrying in ${waitTime / 1000}s...`, 'yellow'));
        await delay(waitTime);
      }
    }
  }

  await transporter.close();
  return {
    success: false,
    error: lastError.message,
    code: lastError.code
  };
}

/**
 * Load HTML template
 */
function loadTemplate(templateName) {
  const templatePath = path.join(__dirname, 'templates', `${templateName}.html`);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  const templateContent = fs.readFileSync(templatePath, 'utf8');
  return Handlebars.compile(templateContent);
}

/**
 * Send daily briefing email
 */
async function sendDailyBriefing(reportData, recipientEmail = null) {
  try {
    // Use provided email, or fall back to environment variables
    const user_email = recipientEmail || process.env.USER_EMAIL || process.env.EMAIL_USER;

    console.log(colorize('[Email] Preparing daily briefing...', 'cyan'));
    console.log(colorize(`[Email] Recipient: ${user_email}`, 'cyan'));

    // Load and compile template
    const template = loadTemplate('daily-briefing');

    // Prepare template data
    const templateData = {
      date: new Date().toLocaleDateString('en-PK', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      year: new Date().getFullYear(),

      // Market overview
      total_stocks: reportData.marketOverview?.totalStocks || 0,
      market_sentiment: reportData.marketOverview?.sentiment || 'Neutral',
      avg_score: reportData.marketOverview?.avgScore?.toFixed(1) || 'N/A',

      // Portfolio section
      has_portfolio: reportData.portfolio?.totalValue > 0,
      portfolio_value: formatCurrency(reportData.portfolio?.totalValue || 0),
      portfolio_change: parseFloat(reportData.portfolio?.dailyChange || 0).toFixed(2) || '0.00',
      portfolio_change_positive: (parseFloat(reportData.portfolio?.dailyChange || 0) || 0) >= 0,
      portfolio_gain_loss: formatCurrency(reportData.portfolio?.unrealizedGainLoss || 0),
      portfolio_gain_loss_positive: (parseFloat(reportData.portfolio?.unrealizedGainLoss || 0) || 0) >= 0,

      // Top opportunities
      top_opportunities: reportData.topOpportunities || [],

      // Recommendations by risk (format as strings for Handlebars)
      low_risk_stocks: formatRecommendations(reportData.recommendationsByRisk?.LOW || []),
      medium_risk_stocks: formatRecommendations(reportData.recommendationsByRisk?.MEDIUM || []),
      high_risk_stocks: formatRecommendations(reportData.recommendationsByRisk?.HIGH || []),

      // Recommendations by timeframe (format as strings for Handlebars)
      short_term_stocks: formatRecommendations(reportData.recommendationsByTimeframe?.SHORT || []),
      medium_term_stocks: formatRecommendations(reportData.recommendationsByTimeframe?.MEDIUM || []),
      long_term_stocks: formatRecommendations(reportData.recommendationsByTimeframe?.LONG || []),

      // Alerts
      has_alerts: (reportData.portfolio?.alerts || []).length > 0,
      alerts: reportData.portfolio?.alerts || []
    };

    // Render template
    const html = template(templateData);

    // Create text version
    const text = generateTextVersion(templateData);

    // Send email
    const subject = `PSX Stock Daily Briefing - ${new Date().toLocaleDateString('en-PK')}`;

    const result = await sendEmail(user_email, subject, html, text);

    if (result.success) {
      console.log(colorize('[Email] ✓ Daily briefing sent successfully', 'green'));
    } else {
      console.error(colorize(`[Email] ✗ Failed to send briefing: ${result.error}`, 'red'));
    }

    return result;
  } catch (error) {
    console.error(colorize(`[Email] ✗ Error preparing briefing: ${error.message}`, 'red'));
    return { success: false, error: error.message };
  }
}

/**
 * Format currency for display
 */
function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'PKR 0';

  const absAmount = Math.abs(amount);
  let formatted;

  if (absAmount >= 10000000) {
    formatted = (absAmount / 10000000).toFixed(2) + ' Cr';
  } else if (absAmount >= 100000) {
    formatted = (absAmount / 100000).toFixed(2) + ' L';
  } else {
    formatted = absAmount.toLocaleString('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  return `PKR ${formatted}`;
}

/**
 * Format recommendations list for template
 */
function formatRecommendations(recommendations) {
  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    return 'None';
  }

  return recommendations
    .map(r => {
      const score = parseFloat(r.composite_score || 0);
      return `${r.symbol} (${isNaN(score) ? 'N/A' : score.toFixed(0)})`;
    })
    .join(', ');
}

/**
 * Generate plain text version of the briefing
 */
function generateTextVersion(data) {
  let text = `PSX STOCK DAILY BRIEFING\n`;
  text += `Date: ${data.date}\n`;
  text += `${'='.repeat(50)}\n\n`;

  text += `MARKET OVERVIEW\n`;
  text += `-`.repeat(30) + `\n`;
  text += `Total Stocks Analyzed: ${data.total_stocks}\n`;
  text += `Market Sentiment: ${data.market_sentiment}\n`;
  text += `Average Score: ${data.avg_score}/100\n\n`;

  if (data.has_portfolio) {
    text += `YOUR PORTFOLIO\n`;
    text += `-`.repeat(30) + `\n`;
    text += `Current Value: ${data.portfolio_value}\n`;
    const changeSymbol = data.portfolio_change_positive ? '+' : '';
    text += `Daily Change: ${changeSymbol}${data.portfolio_change}%\n`;
    const gainSymbol = data.portfolio_gain_loss_positive ? '+' : '';
    text += `Unrealized Gain/Loss: ${gainSymbol}${data.portfolio_gain_loss}\n\n`;

    if (data.alerts.length > 0) {
      text += `ALERTS\n`;
      text += `-`.repeat(30) + `\n`;
      data.alerts.forEach(alert => {
        text += `• ${alert.symbol}: ${alert.message}\n`;
      });
      text += `\n`;
    }
  }

  text += `TOP 5 OPPORTUNITIES\n`;
  text += `-`.repeat(30) + `\n`;
  if (data.top_opportunities.length > 0) {
    data.top_opportunities.slice(0, 5).forEach((stock, i) => {
      text += `${i + 1}. ${stock.symbol} - Score: ${stock.composite_score?.toFixed(0) || 'N/A'} (${stock.risk_level || 'N/A'} Risk)\n`;
    });
  } else {
    text += `No opportunities available\n`;
  }
  text += `\n`;

  text += `RECOMMENDATIONS BY RISK\n`;
  text += `-`.repeat(30) + `\n`;
  text += `LOW Risk: ${data.low_risk_stocks}\n`;
  text += `MEDIUM Risk: ${data.medium_risk_stocks}\n`;
  text += `HIGH Risk: ${data.high_risk_stocks}\n\n`;

  text += `RECOMMENDATIONS BY TIMEFRAME\n`;
  text += `-`.repeat(30) + `\n`;
  text += `SHORT Term (1-6 months): ${data.short_term_stocks}\n`;
  text += `MEDIUM Term (6-18 months): ${data.medium_term_stocks}\n`;
  text += `LONG Term (18+ months): ${data.long_term_stocks}\n\n`;

  text += `${'='.repeat(50)}\n`;
  text += `DISCLAIMER: This briefing is for educational purposes only.\n`;
  text += `It does not constitute financial advice.\n`;
  text += `Always do your own research and consult a financial advisor.\n`;

  return text;
}

/**
 * Test email configuration
 */
async function testEmail() {
  try {
    console.log(colorize('[Email] Testing email configuration...', 'cyan'));

    const config = validateConfig();
    console.log(colorize(`[Email] Config: ${config.host}:${config.port}`, 'cyan'));

    const transporter = createTransporter();
    await transporter.verify();

    console.log(colorize('[Email] ✓ SMTP connection verified', 'green'));

    await transporter.close();
    return { success: true };
  } catch (error) {
    console.error(colorize(`[Email] ✗ Configuration test failed: ${error.message}`, 'red'));
    return { success: false, error: error.message };
  }
}

/**
 * Send simple test email
 */
async function sendTestEmail(recipientEmail = null) {
  const user_email = recipientEmail || process.env.USER_EMAIL || process.env.EMAIL_USER;

  const html = `
    <html>
      <head></head>
      <body style="font-family: Arial, sans-serif;">
        <h2>PSX Stock Analysis - Test Email</h2>
        <p>This is a test email from your PSX Stock Analysis System.</p>
        <p>If you receive this, your email configuration is working correctly!</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          Sent at: ${new Date().toISOString()}
        </p>
      </body>
    </html>
  `;

  return sendEmail(user_email, 'PSX Stock Analysis - Test Email', html);
}

module.exports = {
  validateConfig,
  createTransporter,
  sendEmail,
  loadTemplate,
  sendDailyBriefing,
  testEmail,
  sendTestEmail
};

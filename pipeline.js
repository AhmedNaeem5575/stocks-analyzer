/**
 * Automated Data Pipeline
 * Runs the full workflow: Scrape → Analyze → Generate Recommendations
 * Can be scheduled via cron or run manually
 */

const database = require('./database');
const scraper = require('./scraper');
const analyzer = require('./analyzer');
const strategies = require('./strategies');

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
 * Log pipeline status
 */
function log(message, status = 'info') {
  const timestamp = new Date().toISOString();
  const color = status === 'error' ? 'red' : status === 'success' ? 'green' : 'cyan';
  console.log(`[${timestamp}] ${colorize(message, color)}`);
}

/**
 * Run the complete pipeline
 */
async function runPipeline(options = {}) {
  const {
    scrape = true,
    analyze = true,
    recommend = true,
    timeframes = ['SHORT', 'MEDIUM', 'LONG'],
    headless = true,
    skipErrors = true
  } = options;

  log('╔════════════════════════════════════════════════════════════╗', 'info');
  log('║        PSX STOCK ANALYSIS - DATA PIPELINE                  ║', 'info');
  log('╚════════════════════════════════════════════════════════════╝', 'info');

  const startTime = Date.now();
  const results = {
    scrape: null,
    analyze: null,
    recommend: {}
  };

  let dbConnected = false;

  try {
    // Step 1: Check database connection
    log('\n[Step 1/4] Checking database connection...', 'info');
    dbConnected = await database.testConnection();

    if (!dbConnected) {
      log('Database not connected. Attempting to initialize schema...', 'warning');

      const schemaResult = await database.initializeSchema();
      if (schemaResult) {
        dbConnected = await database.testConnection();
      }

      if (!dbConnected) {
        log('Cannot connect to database. Please check your configuration.', 'error');
        return { success: false, error: 'Database connection failed' };
      }
    }

    log('✓ Database connected', 'success');

    // Step 2: Scrape data
    if (scrape) {
      log('\n[Step 2/4] Scraping PSX screener data...', 'info');

      try {
        results.scrape = await scraper.scrapePSX({ headless, saveJson: true });

        if (results.scrape.success) {
          log(`✓ Scraped ${results.scrape.count} stocks in ${results.scrape.duration}s`, 'success');
        } else {
          log(`✗ Scraping failed: ${results.scrape.error}`, 'error');

          if (!skipErrors) {
            return { success: false, error: 'Scraping failed', results };
          }
          log('Continuing with existing data...', 'warning');
        }
      } catch (error) {
        log(`✗ Scraping error: ${error.message}`, 'error');

        if (!skipErrors) {
          return { success: false, error: error.message, results };
        }
        log('Continuing with existing data...', 'warning');
      }
    } else {
      log('Skipping scraping step', 'info');
    }

    // Step 3: Analyze stocks
    if (analyze) {
      log('\n[Step 3/4] Analyzing stocks...', 'info');

      try {
        results.analyze = await analyzer.analyzeAllStocks();

        if (results.analyze.success) {
          log(`✓ Analyzed ${results.analyze.scores.length} stocks`, 'success');

          // Show quick stats
          const avgScore = results.analyze.scores.reduce((sum, s) => sum + s.composite_score, 0) / results.analyze.scores.length;
          log(`  Average composite score: ${avgScore.toFixed(1)}`, 'info');
        } else {
          log(`✗ Analysis failed: ${results.analyze.error}`, 'error');

          if (!skipErrors) {
            return { success: false, error: 'Analysis failed', results };
          }
        }
      } catch (error) {
        log(`✗ Analysis error: ${error.message}`, 'error');

        if (!skipErrors) {
          return { success: false, error: error.message, results };
        }
      }
    } else {
      log('Skipping analysis step', 'info');
    }

    // Step 4: Generate recommendations
    if (recommend) {
      log('\n[Step 4/4] Generating recommendations...', 'info');

      for (const timeframe of timeframes) {
        try {
          log(`  Generating ${timeframe}-TERM recommendations...`, 'info');

          const recResult = await strategies.generateRecommendations(timeframe, 10);
          results.recommend[timeframe] = recResult;

          if (recResult.success) {
            const top3 = recResult.recommendations.slice(0, 3).map(r => r.symbol).join(', ');
            log(`  ✓ ${timeframe}-TERM: Generated ${recResult.recommendations.length} recommendations`, 'success');
            log(`    Top 3: ${top3}`, 'info');
          } else {
            log(`  ✗ ${timeframe}-TERM failed: ${recResult.error}`, 'error');
          }
        } catch (error) {
          log(`  ✗ ${timeframe}-TERM error: ${error.message}`, 'error');
          results.recommend[timeframe] = { success: false, error: error.message };
        }
      }
    } else {
      log('Skipping recommendations step', 'info');
    }

    // Summary
    const duration = Math.round((Date.now() - startTime) / 1000);
    log('\n' + '═'.repeat(60), 'info');
    log('PIPELINE SUMMARY', 'success');
    log('═'.repeat(60), 'info');

    if (results.scrape?.success) {
      log(`✓ Scraping: ${results.scrape.count} stocks`, 'success');
    } else {
      log(`⚠ Scraping: ${scrape ? 'Failed' : 'Skipped'}`, 'warning');
    }

    if (results.analyze?.success) {
      log(`✓ Analysis: ${results.analyze.scores.length} stocks analyzed`, 'success');
    } else {
      log(`⚠ Analysis: ${analyze ? 'Failed' : 'Skipped'}`, 'warning');
    }

    Object.entries(results.recommend).forEach(([tf, result]) => {
      if (result.success) {
        log(`✓ ${tf}-TERM: ${result.recommendations.length} recommendations`, 'success');
      } else {
        log(`✗ ${tf}-TERM: Failed`, 'error');
      }
    });

    log(`\nTotal duration: ${duration}s`, 'info');
    log(`\nTo view recommendations, run: node cli.js top --timeframe short`, 'info');

    return {
      success: true,
      results,
      duration,
      timestamp: new Date()
    };

  } catch (error) {
    log(`\n✗ Pipeline failed: ${error.message}`, 'error');
    return {
      success: false,
      error: error.message,
      results
    };
  }
}

/**
 * Quick pipeline (scrape + analyze only)
 */
async function quickPipeline() {
  return runPipeline({
    scrape: true,
    analyze: true,
    recommend: false,
    headless: true
  });
}

/**
 * Recommendations pipeline (analyze + recommend only, no scraping)
 */
async function recommendationsPipeline() {
  return runPipeline({
    scrape: false,
    analyze: true,
    recommend: true,
    timeframes: ['SHORT', 'MEDIUM', 'LONG']
  });
}

// Run pipeline if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--no-scrape') options.scrape = false;
    if (args[i] === '--no-analyze') options.analyze = false;
    if (args[i] === '--no-recommend') options.recommend = false;
    if (args[i] === '--headful') options.headless = false;
    if (args[i] === '--fail-fast') options.skipErrors = false;
  }

  runPipeline(options)
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  runPipeline,
  quickPipeline,
  recommendationsPipeline
};

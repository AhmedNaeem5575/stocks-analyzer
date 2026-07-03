/**
 * PSX Stock Analysis System - Main Entry Point
 *
 * This is the main entry point for the application.
 * Use CLI interface (cli.js) for interactive operations.
 */

const scraper = require('./scraper');
const analyzer = require('./analyzer');
const strategies = require('./strategies');

async function main() {
  console.log('PSX Stock Analysis System');
  console.log('==========================\n');

  console.log('Use the CLI for interactive operations:');
  console.log('  node cli.js analyze --timeframe short');
  console.log('  node cli.js top --limit 10 --timeframe medium');
  console.log('  node cli.js stock --symbol KEL\n');

  console.log('Or run individual components:');
  console.log('  npm run scrape    # Collect data from PSX');
  console.log('  npm run analyze   # Run analysis engine');
  console.log('  npm run pipeline   # Full automated workflow');
  console.log('  npm run strategies # Get recommendations\n');

  console.log('For web dashboard:');
  console.log('  streamlit run dashboard/app.py');
  console.log('  Access at http://localhost:8501\n');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { scraper, analyzer, strategies };

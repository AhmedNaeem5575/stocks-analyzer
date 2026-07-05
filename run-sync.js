#!/usr/bin/env node

/**
 * Sync Wrapper Script
 * Sets NODE_OPTIONS and runs the full pipeline
 */

// Set NODE_OPTIONS before requiring any modules
process.env.NODE_OPTIONS = '--no-experimental-fetch';

const { spawn } = require('child_process');
const path = require('path');

async function runCommand(command, args, label) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${label}`);

    // Set NODE_OPTIONS in the environment before spawning
    const env = {
      ...process.env,
      NODE_OPTIONS: '--no-experimental-fetch'
    };

    const proc = spawn(command, args, {
      stdio: 'inherit',
      env: env,
      cwd: __dirname,
      shell: true
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} failed with exit code ${code}`));
      }
    });

    proc.on('error', (error) => {
      reject(new Error(`${label} error: ${error.message}`));
    });
  });
}

async function main() {
  try {
    await runCommand('node', ['scraper.js'], 'Scraper');
    await runCommand('node', ['analyzer.js'], 'Analyzer');
    await runCommand('node', ['strategies.js'], 'Strategies');
    await runCommand('node', ['daily-update-with-email.js'], 'Email');
    console.log('SUCCESS: Sync completed!');
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
}

main();

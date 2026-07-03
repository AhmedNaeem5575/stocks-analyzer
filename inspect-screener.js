/**
 * Inspect PSX screener HTML structure
 */

const { chromium } = require('playwright');

async function inspectScreener() {
  console.log('Launching browser to inspect PSX screener...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to PSX screener...');
    await page.goto('https://dps.psx.com.pk/screener', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    console.log('Waiting for table to load...');
    await page.waitForSelector('table', { timeout: 10000 });

    // Wait for user to inspect
    console.log('\n=== PAGE LOADED ===');
    console.log('Please inspect the page and press Ctrl+C when done\n');
    console.log('I will extract the table structure now...\n');

    await page.waitForTimeout(3000);

    // Get table headers
    const headers = await page.evaluate(() => {
      const headerCells = document.querySelectorAll('table thead th, table tr:first-child td');
      return Array.from(headerCells).map((cell, i) => ({
        index: i,
        text: cell.textContent?.trim() || '',
        class: cell.className
      }));
    });

    console.log('=== TABLE HEADERS ===');
    headers.forEach(h => {
      console.log(`Column ${h.index}: "${h.text}" (class: ${h.class || 'none'})`);
    });

    // Get first row of data
    console.log('\n=== FIRST DATA ROW ===');
    const firstRow = await page.evaluate(() => {
      const dataCells = document.querySelectorAll('table tbody tr:first-child td, table tr:nth-child(2) td');
      return Array.from(dataCells).map((cell, i) => ({
        index: i,
        text: cell.textContent?.trim() || '',
        html: cell.innerHTML
      }));
    });

    firstRow.forEach(cell => {
      const preview = cell.text.length > 30 ? cell.text.substring(0, 30) + '...' : cell.text;
      console.log(`Cell ${cell.index}: "${preview}"`);
    });

    console.log('\nKeep browser open for manual inspection...');
    console.log('Press Ctrl+C to exit\n');

    // Keep browser open
    await new Promise(() => {});

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

inspectScreener().catch(console.error);

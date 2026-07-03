/**
 * Save PSX screener HTML to file for inspection
 */

const { chromium } = require('playwright');
const fs = require('fs');

async function saveAndInspect() {
  console.log('Fetching PSX screener HTML...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  try {
    await page.goto('https://dps.psx.com.pk/screener', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    await page.waitForSelector('table', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Get table structure
    const tableInfo = await page.evaluate(() => {
      // Find the main data table
      const tables = document.querySelectorAll('table');
      let mainTable = null;
      let mainTableIndex = 0;

      for (let i = 0; i < tables.length; i++) {
        const rows = tables[i].querySelectorAll('tbody tr, tr');
        if (rows.length > 10) { // Assume main table has many rows
          mainTable = tables[i];
          mainTableIndex = i;
          break;
        }
      }

      if (!mainTable) {
        return { error: 'No main table found' };
      }

      // Get headers
      const headers = Array.from(mainTable.querySelectorAll('thead th, tr:first-child td')).map(cell => ({
        text: cell.textContent?.trim() || '',
        colspan: cell.colSpan || 1
      }));

      // Get first 3 data rows
      const dataRows = [];
      const rows = mainTable.querySelectorAll('tbody tr, tr');

      let dataRowIndex = 0;
      for (let i = 1; i < rows.length && dataRowIndex < 3; i++) {
        const row = rows[i];
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length > 5) { // Skip header rows
          dataRows.push(cells.map(cell => cell.textContent?.trim() || ''));
          dataRowIndex++;
        }
      }

      return {
        tableIndex: mainTableIndex,
        totalTables: tables.length,
        headers,
        dataRows,
        totalRows: rows.length
      };
    });

    if (tableInfo.error) {
      console.log('Error:', tableInfo.error);
    } else {
      console.log('=== TABLE STRUCTURE ===');
      console.log(`\nFound main table (table #${tableInfo.tableIndex} of ${tableInfo.totalTables})`);
      console.log(`Total rows: ${tableInfo.totalRows}\n`);

      console.log('HEADERS:');
      tableInfo.headers.forEach((h, i) => {
        if (h.text) {
          console.log(`  Column ${i}: "${h.text}" ${h.colspan > 1 ? `(spans ${h.colspan} cols)` : ''}`);
        }
      });

      console.log('\nFIRST 3 DATA ROWS:');
      tableInfo.dataRows.forEach((row, rowIndex) => {
        console.log(`\nRow ${rowIndex + 1}:`);
        row.forEach((cell, cellIndex) => {
          const preview = cell.length > 25 ? cell.substring(0, 25) + '...' : cell || '[empty]';
          console.log(`  [${cellIndex}]: ${preview}`);
        });
      });

      // Save full HTML for manual inspection
      const html = await page.content();
      fs.writeFileSync('./screener-sample.html', html);
      console.log('\nFull HTML saved to: screener-sample.html');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

saveAndInspect().catch(console.error);

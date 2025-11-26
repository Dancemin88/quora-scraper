// server.js
const express = require('express');
const { chromium } = require('playwright'); // use full Playwright here

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Quora scraper is running');
});

app.get('/search-quora', async (req, res) => {
  const keyword = (req.query.keyword || '').trim();

  if (!keyword) {
    return res
      .status(400)
      .json({ error: 'Missing keyword query parameter ?keyword=' });
  }

  const searchUrl = `https://www.quora.com/search?q=${encodeURIComponent(
    keyword,
  )}&type=question`;

  console.log('Navigating to:', searchUrl);

  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });

    // Create a context with a desktop Chrome user agent
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Try to navigate, but if it times out, log the error and continue
    try {
      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded', // do NOT use networkidle on Quora
        timeout: 20000, // 20s, to avoid Render request timeouts
      });
    } catch (navErr) {
      console.error('Navigation error (continuing anyway):', navErr);
    }

    // Give the page a few seconds to render dynamic content
    await page.waitForTimeout(5000);

    const results = await page.evaluate(() => {
      const items = [];

      // Each question block
      const containers = document.querySelectorAll(
        'div.puppeteer_test_question_component_base',
      );

      containers.forEach((container) => {
        // Main question link
        const link =
          container.querySelector(
            'a.puppeteer_test_link[href*="/question/"], a.puppeteer_test_question_link',
          ) ||
          container.querySelector(
            'a.puppeteer_test_link[href^="https://www.quora.com/"]',
          );

        if (!link) return;

        const titleEl =
          container.querySelector('.puppeteer_test_question_title') || link;

        const title = titleEl.innerText.trim();
        const url = link.href;

        // Very rough snippet: first visible small text after the title
        let snippet = '';
        const snippetCandidate = container.querySelector(
          '.q-text.qu-dynamicFontSize--small',
        );
        if (snippetCandidate) {
          snippet = snippetCandidate.innerText.trim();
        }

        if (title) {
          items.push({ title, url, snippet });
        }
      });

      return items;
    });

    console.log(
      `Returning ${results.length} results for keyword "${keyword}"`,
    );

    res.json({ keyword, results });
  } catch (error) {
    console.error('SCRAPE_FAILED:', error);
    res.status(500).json({ error: 'SCRAPE_FAILED', details: String(error) });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.error('Error closing browser:', closeErr);
      }
    }
  }
});

// Extra safety: log unhandled rejections instead of crashing the process
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

app.listen(PORT, () => {
  console.log(`Quora scraper listening on port ${PORT}`);
});

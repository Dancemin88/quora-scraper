// server.js

const express = require('express');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/healthz', (_req, res) => {
  res.send('OK');
});

app.get('/search-quora', async (req, res) => {
  const keyword = req.query.keyword || 'truck';
  const searchUrl = `https://www.quora.com/search?q=${encodeURIComponent(
    keyword
  )}&type=question`;

  console.log('Navigating to:', searchUrl);

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,         // we only need headless
    });

    const page = await browser.newPage();

    // Simple desktop-like UA just in case
    await page.setExtraHTTPHeaders({
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    // Give the page a few seconds to hydrate with JS results
    await page.waitForTimeout(5000);

    // Extract question cards
    const results = await page.$$eval(
      'div.puppeteer_test_question_component_base',
      (items) =>
        items
          .slice(0, 20)
          .map((item) => {
            const link = item.querySelector(
              'a.puppeteer_test_link[href*="quora.com"]'
            );
            const titleNode = item.querySelector(
              '.puppeteer_test_question_title'
            );
            const snippetNode = item.querySelector(
              '.q-text.qu-dynamicFontSize--small'
            );

            return {
              title: titleNode
                ? titleNode.innerText.replace(/\s+/g, ' ').trim()
                : null,
              url: link ? link.href : null,
              snippet: snippetNode
                ? snippetNode.innerText.replace(/\s+/g, ' ').trim()
                : null,
            };
          })
          .filter((r) => r.url && r.title)
    );

    res.json({ keyword, count: results.length, results });
  } catch (err) {
    console.error('SCRAPE_FAILED:', err);
    res
      .status(500)
      .json({ error: 'SCRAPE_FAILED', details: String(err) });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Quora scraper listening on port ${PORT}`);
});

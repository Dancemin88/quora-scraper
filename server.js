const express = require('express');
const { chromium } = require('playwright');

const app = express();

// health check for Render
app.get('/healthz', (_req, res) => {
  res.send('OK');
});

// n8n will call: /search-quora?keyword=truck
app.get('/search-quora', async (req, res) => {
  const keyword = req.query.keyword || '';
  if (!keyword) {
    return res.status(400).json({ error: 'Missing keyword' });
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const url = `https://www.quora.com/search?q=${encodeURIComponent(keyword)}&type=question`;
    await page.goto(url, { waitUntil: 'networkidle' });

    const results = await page.evaluate(() => {
      const cards = document.querySelectorAll('div.q-box.qu-borderBottom');
      const out = [];

      cards.forEach(card => {
        // main link (question)
        const link = card.querySelector(
          'a.q-box.qu-display--block.puppeteer_test_link[href*="quora.com/"]'
        );
        if (!link) return;

        const titleEl = card.querySelector('.puppeteer_test_question_title');
        const title = titleEl
          ? titleEl.innerText.trim()
          : link.innerText.trim();
        const href = link.href;

        const snippetEl = card.querySelector(
          '.q-text.qu-dynamicFontSize--small'
        );
        const snippet = snippetEl ? snippetEl.innerText.trim() : '';

        out.push({ title, url: href, snippet });
      });

      return out;
    });

    res.json({ keyword, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'SCRAPE_FAILED', details: String(err) });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Quora scraper listening on port', PORT);
});

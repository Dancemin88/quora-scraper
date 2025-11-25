const express = require('express');
const { chromium } = require('playwright-core');

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/search-quora', async (req, res) => {
  const keyword = (req.query.keyword || 'truck').toString();

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });

    // Pretend to be a normal desktop Chrome
    await page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const url = `https://www.quora.com/search?q=${encodeURIComponent(
      keyword,
    )}&type=question`;

    console.log('Navigating to:', url);

    await page.goto(url, {
      // IMPORTANT: no "networkidle", Quora never really goes idle
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Let the SPA finish rendering
    await page.waitForTimeout(5000);

    const results = await page.evaluate(() => {
      const items = [];

      // Question blocks
      const blocks = document.querySelectorAll(
        '.puppeteer_test_question_component_base, .q-box'
      );

      blocks.forEach((block) => {
        // Title
        let title = '';
        const titleEl =
          block.querySelector('.puppeteer_test_question_title') ||
          block.querySelector('a[role="link"] .q-text') ||
          block.querySelector('.q-text');

        if (titleEl) {
          title = titleEl.innerText.trim();
        }

        // URL
        let url = '';
        const linkEl =
          block.querySelector('a.puppeteer_test_link[href^="https://www.quora.com/"]') ||
          block.querySelector('a[href^="https://www.quora.com/"]');

        if (linkEl) {
          url = linkEl.href;
        }

        // Snippet (small gray text under the title / around it)
        let snippet = '';
        const snippetEl = block.querySelector(
          '.q-text.qu-color--gray, .q-text.qu-color--gray_light'
        );
        if (snippetEl) {
          snippet = snippetEl.innerText.trim();
        }

        if (title && url) {
          items.push({ title, url, snippet });
        }
      });

      // Return up to 20 results
      return items.slice(0, 20);
    });

    res.json(results);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: 'SCRAPE_FAILED', details: String(err) });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// simple health check
app.get('/', (req, res) => {
  res.send('Quora scraper is running');
});

app.listen(PORT, () => {
  console.log(`Quora scraper listening on port ${PORT}`);
});

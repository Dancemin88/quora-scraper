const express = require('express');
const { chromium } = require('playwright');

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

    // Create context WITH userAgent here (Playwright way)
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    const url = `https://www.quora.com/search?q=${encodeURIComponent(
      keyword,
    )}&type=question`;

    console.log('Navigating to:', url);

    await page.goto(url, {
      // 'domcontentloaded' is safer than 'networkidle' on Quora
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    // Give React a bit of time to render content
    await page.waitForTimeout(5000);

    const results = await page.evaluate(() => {
      const items = [];

      // Each question card container
      const blocks = document.querySelectorAll(
        '.puppeteer_test_question_component_base'
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

        // Snippet (the small gray text under/around the title)
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

// Simple health check route
app.get('/', (req, res) => {
  res.send('Quora scraper is running');
});

app.listen(PORT, () => {
  console.log(`Quora scraper listening on port ${PORT}`);
});

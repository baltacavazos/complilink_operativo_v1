import { chromium } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
const target = `${baseURL.replace(/\/$/, '')}/auditar?legalGateHarness=1`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', (msg) => {
  console.log('[browser-console]', msg.type(), msg.text());
});

page.on('response', async (response) => {
  const url = response.url();
  if (url.includes('/auditar') || url.includes('/api/')) {
    console.log('[response]', response.status(), url);
  }
});

await page.goto(target, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

const diagnostics = await page.evaluate(() => {
  const harness = document.querySelector('[data-testid="legal-gate-harness"]');
  const metrics = document.querySelector('[data-testid="legal-gate-lock-metrics"]');
  return {
    href: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    title: document.title,
    hasHarness: Boolean(harness),
    hasMetrics: Boolean(metrics),
    bodySnippet: document.body.innerText.slice(0, 1200),
  };
});

console.log(JSON.stringify(diagnostics, null, 2));
await browser.close();

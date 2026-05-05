import { chromium, devices } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

const baseUrl = process.env.AUDIT_URL || 'http://127.0.0.1:3000';
const outputDir = '/home/ubuntu/complilink_operativo_v1/ui-audit';
await fs.mkdir(outputDir, { recursive: true });

const routes = [
  { name: 'home', path: '/' },
  { name: 'acceso', path: '/acceso' },
  { name: 'auditar', path: '/auditar' },
];

const browser = await chromium.launch({ headless: true });

async function auditRoute(route) {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1600 } });
  const mobile = await browser.newContext({ ...devices['iPhone 13'] });

  for (const [label, context] of [['desktop', desktop], ['mobile', mobile]]) {
    const page = await context.newPage();
    const url = new URL(route.path, baseUrl).toString();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
    await page.screenshot({ path: path.join(outputDir, `${route.name}-${label}.png`), fullPage: true });

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const all = Array.from(document.querySelectorAll('*'));
      const offenders = all
        .map((el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120);
          return {
            tag: el.tagName.toLowerCase(),
            className: (el.className || '').toString().slice(0, 180),
            text,
            left: rect.left,
            right: rect.right,
            width: rect.width,
            overflowX: style.overflowX,
            position: style.position,
          };
        })
        .filter((item) => item.width > window.innerWidth + 1 || item.left < -1 || item.right > window.innerWidth + 1)
        .slice(0, 25);

      return {
        title: document.title,
        viewportWidth: window.innerWidth,
        scrollWidth: doc.scrollWidth,
        bodyScrollWidth: body ? body.scrollWidth : null,
        horizontalOverflow: doc.scrollWidth > window.innerWidth + 1,
        offenders,
      };
    });

    await fs.writeFile(
      path.join(outputDir, `${route.name}-${label}.json`),
      JSON.stringify(metrics, null, 2),
      'utf8',
    );

    await context.close();
  }
}

for (const route of routes) {
  await auditRoute(route);
}

await browser.close();
console.log(`UI audit saved in ${outputDir}`);

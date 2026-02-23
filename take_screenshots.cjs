const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:5000';
const OUTPUT_DIR = path.join(__dirname, 'uploads');
const WIDTH = 1440;
const HEIGHT = 900;

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log('Navigating to app...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  console.log('Current URL:', page.url());

  const usernameInput = page.locator('[data-testid="input-username"]');
  await usernameInput.waitFor({ state: 'visible', timeout: 15000 });
  await usernameInput.fill('Admin');

  const passwordInput = page.locator('[data-testid="input-password"]');
  await passwordInput.fill('Admin');

  const submitBtn = page.locator('[data-testid="button-auth-submit"]');
  await submitBtn.click();

  await page.waitForTimeout(3000);
  console.log('After login URL:', page.url());

  const screenshots = [
    { name: 'schedule', path: '/' },
    { name: 'events', path: '/events' },
    { name: 'results', path: '/results' },
    { name: 'stats', path: '/stats' },
    { name: 'compare', path: '/compare' },
    { name: 'opponents', path: '/opponents' },
    { name: 'player_stats', path: '/player-stats' },
    { name: 'players', path: '/players' },
    { name: 'chat', path: '/chat' },
    { name: 'dashboard_users', path: '/dashboard', tab: 'Users' },
    { name: 'dashboard_roles', path: '/dashboard', tab: 'Roles' },
    { name: 'dashboard_log', path: '/dashboard', tab: 'Activity' },
  ];

  for (const s of screenshots) {
    console.log(`Taking screenshot: ${s.name}`);
    await page.goto(`${BASE_URL}${s.path}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    if (s.tab) {
      try {
        const tabButton = page.locator('button[role="tab"]').filter({ hasText: s.tab });
        const count = await tabButton.count();
        if (count > 0) {
          await tabButton.first().click();
          await page.waitForTimeout(1500);
          console.log(`  Clicked tab: ${s.tab}`);
        } else {
          const textEl = page.getByText(s.tab, { exact: true });
          const textCount = await textEl.count();
          if (textCount > 0) {
            await textEl.first().click();
            await page.waitForTimeout(1500);
            console.log(`  Clicked text: ${s.tab}`);
          } else {
            console.log(`  Tab "${s.tab}" not found`);
          }
        }
      } catch (e) {
        console.log(`  Error clicking tab: ${e.message}`);
      }
    }

    await page.screenshot({
      path: path.join(OUTPUT_DIR, `${s.name}.png`),
      fullPage: false,
    });
    console.log(`  Saved: uploads/${s.name}.png`);
  }

  await browser.close();
  console.log('\nAll screenshots taken!');
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

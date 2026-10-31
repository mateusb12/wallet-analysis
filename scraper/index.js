import { chromium } from 'playwright';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const targetUrl = process.argv[2] || process.env.SCRAPER_TARGET_URL || 'https://www.investidor.b3.com.br/';
const scraperDir = dirname(fileURLToPath(import.meta.url));
const userDataDir = resolve(process.env.SCRAPER_PROFILE_DIR || resolve(scraperDir, 'browser_profile'));
const browserChannel = process.env.SCRAPER_BROWSER_CHANNEL || 'chrome';

console.log(`Abrindo ${targetUrl}`);
console.log(`Perfil: ${userDataDir}`);

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  channel: browserChannel,
  ignoreHTTPSErrors: true,
  args: ['--disable-blink-features=AutomationControlled'],
  ignoreDefaultArgs: ['--enable-automation'],
});

const page = context.pages()[0] || await context.newPage();
await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
console.log('Navegador aberto. Pressione Ctrl+C para fechar.');

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await context.close();
  process.exit(0);
}

process.once('SIGINT', close);
process.once('SIGTERM', close);
await new Promise(() => {});

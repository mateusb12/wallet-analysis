import { chromium } from 'playwright';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const targetUrl = process.argv[2] || process.env.SCRAPER_TARGET_URL || 'https://www.investidor.b3.com.br/';
const scraperDir = dirname(fileURLToPath(import.meta.url));
const userDataDir = resolve(process.env.SCRAPER_PROFILE_DIR || resolve(scraperDir, 'browser_profile'));
const browserChannel = process.env.SCRAPER_BROWSER_CHANNEL || 'chrome';
const b3Cpf = process.env.B3_CPF;
const b3Password = process.env.B3_PASSWORD;
const browserArgs = [
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage',
];

console.log(`Abrindo ${targetUrl}`);
console.log(`Perfil: ${userDataDir}`);

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  channel: browserChannel,
  ignoreHTTPSErrors: true,
  args: browserArgs,
  ignoreDefaultArgs: ['--enable-automation'],
});

const page = context.pages()[0] || await context.newPage();
await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

if (b3Cpf && b3Password && page.url().includes('/login')) {
  const cpfInput = page.locator(
    'input[placeholder*="CPF" i], input[name*="cpf" i], input[id*="cpf" i]'
  ).first();
  const passwordInput = page.locator('input[type="password"]').first();

  if (await cpfInput.count()) {
    await cpfInput.fill(b3Cpf);
    if (!(await passwordInput.count())) {
      await page.getByRole('button', { name: /entrar|continuar|avançar/i }).first().click();
      await page.waitForTimeout(1000);
    }
    if (await passwordInput.count()) {
      await passwordInput.fill(b3Password);
      await page.getByRole('button', { name: /entrar|continuar|avançar/i }).first().click();
    }
  }
}
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

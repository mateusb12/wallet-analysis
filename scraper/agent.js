import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.SCRAPER_AGENT_PORT || 8765);
const targetUrl = process.env.SCRAPER_TARGET_URL || 'https://www.investidor.b3.com.br/';
const scraperDir = dirname(fileURLToPath(import.meta.url));
const userDataDir = resolve(process.env.SCRAPER_PROFILE_DIR || resolve(scraperDir, 'browser_profile'));
const browserChannel = process.env.SCRAPER_BROWSER_CHANNEL || 'chrome';
const b3Cpf = process.env.B3_CPF;
const b3Password = process.env.B3_PASSWORD;

let context = null;
let status = 'idle';
let error = null;
let requestEntries = [];
let requestSequence = 0;

function attachRequestCapture(page) {
  page.on('request', (request) => {
    const entry = {
      id: ++requestSequence,
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
      status: null,
      startedAt: new Date().toISOString(),
      durationMs: null,
      failed: false,
    };
    requestEntries.push(entry);
    if (requestEntries.length > 500) requestEntries.shift();
    request.__scraperEntry = entry;
  });

  page.on('response', (response) => {
    const entry = response.request().__scraperEntry;
    if (!entry) return;
    entry.status = response.status();
    entry.durationMs = Date.now() - new Date(entry.startedAt).getTime();
  });

  page.on('requestfailed', (request) => {
    const entry = request.__scraperEntry;
    if (!entry) return;
    entry.failed = true;
    entry.durationMs = Date.now() - new Date(entry.startedAt).getTime();
  });
}

async function findInput(page, patterns, type = null) {
  const inputs = page.locator('input');
  const count = await inputs.count();

  for (let index = 0; index < count; index += 1) {
    const input = inputs.nth(index);
    const attributes = await input.evaluate((element) => ({
      type: element.getAttribute('type') || 'text',
      name: element.getAttribute('name') || '',
      id: element.getAttribute('id') || '',
      placeholder: element.getAttribute('placeholder') || '',
      ariaLabel: element.getAttribute('aria-label') || '',
    }));
    const searchableText = Object.values(attributes).join(' ').toLowerCase();

    if ((!type || attributes.type.toLowerCase() === type) && patterns.some((pattern) => searchableText.includes(pattern))) {
      return input;
    }
  }

  return null;
}

async function markDebugInput(input) {
  if (!input) return;
  await input.evaluate((element) => {
    element.style.setProperty('border', '3px solid red', 'important');
    element.style.setProperty('box-shadow', '0 0 0 2px rgba(255, 0, 0, 0.25)', 'important');
  });
}

async function clickLoginButton(page) {
  const button = page.getByRole('button', { name: /entrar|continuar|avançar/i }).first();
  if (await button.count() && await button.isVisible()) {
    await button.click();
    return true;
  }
  return false;
}

async function loginToB3(page) {
  if (!page.url().includes('/login')) return;

  const cpfInput = await findInput(page, ['cpf', 'documento', 'identificação']);
  console.log(`Campo CPF detectado: ${Boolean(cpfInput)}`);
  await markDebugInput(cpfInput);
  if (!cpfInput || !b3Cpf) return;

  await cpfInput.fill(b3Cpf);
  console.log('CPF preenchido.');
  await clickLoginButton(page);
  console.log('Botão Entrar clicado.');

  await page.waitForTimeout(1000);
  const passwordInput = await findInput(page, ['senha', 'password'], 'password');
  console.log(`Campo senha detectado: ${Boolean(passwordInput)}`);
  if (!passwordInput || !b3Password) return;

  await passwordInput.fill(b3Password);
  console.log('Senha preenchida.');
  await clickLoginButton(page);
  console.log('Botão Entrar da senha clicado.');
}

async function runScraper() {
  if (context) return;

  status = 'running';
  error = null;
  requestEntries = [];
  requestSequence = 0;

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: browserChannel,
      ignoreHTTPSErrors: true,
      args: ['--disable-blink-features=AutomationControlled'],
      ignoreDefaultArgs: ['--enable-automation'],
    });

    const page = context.pages()[0] || await context.newPage();
    for (const existingPage of context.pages()) attachRequestCapture(existingPage);
    context.on('page', attachRequestCapture);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    console.log(`URL após navegação: ${page.url()}`);
    await loginToB3(page);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
    status = 'failed';
    await closeScraper();
    throw cause;
  }
}

async function closeScraper() {
  const currentContext = context;
  context = null;
  if (currentContext) await currentContext.close();
  if (status !== 'failed') status = 'paused';
}

function sendJson(response, code, payload) {
  response.writeHead(code, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/status') {
      sendJson(response, 200, { status, error });
      return;
    }

    if (request.method === 'GET' && request.url === '/requests') {
      sendJson(response, 200, { requests: requestEntries });
      return;
    }

    if (request.method === 'POST' && request.url === '/run') {
      await runScraper();
      sendJson(response, 202, { status: 'running' });
      return;
    }

    if (request.method === 'POST' && request.url === '/pause') {
      await closeScraper();
      sendJson(response, 202, { status: 'paused' });
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  } catch (cause) {
    sendJson(response, 500, {
      status: 'failed',
      error: cause instanceof Error ? cause.message : String(cause),
    });
  }
});

async function shutdown() {
  await closeScraper();
  server.close(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
server.listen(port, '0.0.0.0', () => {
  console.log(`Agente do scraper ouvindo na porta ${port}`);
});

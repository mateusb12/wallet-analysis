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
let contributionEntries = [];
let progress = { current: 0, total: 1, label: 'Aguardando execução' };

function setProgress(current, total, label) {
  progress = { current, total, label };
}

function isLoginPage(page) {
  const url = page.url();
  return url.includes('/login') || url.includes('b2clogin.com');
}

function safeUrl(page) {
  const url = new URL(page.url());
  return `${url.origin}${url.pathname}`;
}

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

    const matchesType = !type || attributes.type.toLowerCase() === type;
    const matchesPattern = patterns.length === 0 || patterns.some((pattern) => searchableText.includes(pattern));
    if (matchesType && (type === 'password' || matchesPattern)) {
      return input;
    }
  }

  return null;
}

async function clickLoginButton(page) {
  const button = page.getByRole('button', { name: /entrar|continuar|avançar/i }).first();
  if (await button.count() && await button.isVisible()) {
    if (!(await button.isEnabled())) return false;
    await button.click({ timeout: 10000, noWaitAfter: true });
    return true;
  }
  return false;
}

async function revealPassword(page, passwordInput) {
  const siblingButton = passwordInput.locator('xpath=..').locator('button').first();
  const accessibleButton = page.locator(
    '[aria-label*="mostrar senha" i], [aria-label*="exibir senha" i], [aria-label*="show password" i], [title*="senha" i]'
  ).first();
  const eyeButton = (await siblingButton.count()) ? siblingButton : accessibleButton;

  if (!(await eyeButton.count())) return false;
  await eyeButton.evaluate((element) => element.click());
  await page.waitForTimeout(300);
  return true;
}

async function loginToB3(page) {
  if (!isLoginPage(page)) return;

  setProgress(1, 10, 'Tentando fazer login');
  const cpfInput = await findInput(page, ['cpf', 'documento', 'identificação']);
  console.log(`Campo CPF detectado: ${Boolean(cpfInput)}`);
  if (!cpfInput || !b3Cpf) return;

  setProgress(2, 10, 'Preenchendo CPF');
  await cpfInput.fill(b3Cpf);
  setProgress(3, 10, 'Enviando CPF');
  console.log('CPF preenchido.');
  await clickLoginButton(page);
  console.log('Botão Entrar clicado.');

  await page.waitForTimeout(1500);
  const passwordInput = await findInput(page, ['senha', 'password'], 'password');
  console.log(`Campo senha detectado: ${Boolean(passwordInput)}`);
  if (!passwordInput || !b3Password) return;

  setProgress(1, 12, 'Colocando senha');
  await passwordInput.fill('');
  await passwordInput.pressSequentially(b3Password, { delay: 30 });
  await page.waitForTimeout(500);
  console.log('Senha preenchida.');
  setProgress(2, 12, 'Revelando senha');
  console.log(`Olho da senha acionado: ${await revealPassword(page, passwordInput)}`);
  setProgress(3, 12, 'Entrando na B3');
  if (!(await clickLoginButton(page))) {
    console.log('Botão Entrar da senha continua desabilitado.');
    return;
  }
  console.log('Botão Entrar da senha clicado.');
}

async function configureMovementFilters(page) {
  const movementUrl = 'https://www.investidor.b3.com.br/extrato/movimentacao';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    setProgress(4, 12, 'Abrindo extratos');
    console.log('Abrindo Extratos > Movimentação.');
    await page.goto(movementUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    if (!isLoginPage(page)) break;

    setProgress(5, 12, 'Refazendo login');
    console.log('B3 pediu login novamente ao abrir Movimentação.');
    await loginToB3(page);
    await page.waitForURL(
      (url) => !url.toString().includes('/login') && !url.toString().includes('b2clogin.com'),
      { timeout: 15000 }
    ).catch(() => null);
  }

  if (isLoginPage(page)) {
    throw new Error('A B3 não concluiu o login ao abrir Movimentação.');
  }

  const cookieButton = page.getByRole('button', { name: /permitir todos/i }).first();
  if (await cookieButton.count()) {
    await cookieButton.evaluate((element) => element.click());
    await page.waitForTimeout(1000);
    console.log('Banner de cookies fechado.');
  }

  const filterButton = page.locator('button').filter({ hasText: /filter icon|filtrar/i }).first();
  setProgress(6, 12, 'Abrindo filtros');
  console.log(`Filtro inicial detectado: ${Boolean(await filterButton.count())}`);
  if (await filterButton.count()) {
    await filterButton.evaluate((element) => element.click());
    console.log('Filtro inicial clicado.');
  }

  await page.waitForTimeout(1000);
  const twelveMonths = page.getByText(/12\s*(meses|months)/i).first();
  setProgress(7, 12, 'Selecionando 12 meses');
  console.log(`Opção 12 meses detectada: ${Boolean(await twelveMonths.count())}`);
  if (await twelveMonths.count()) {
    await twelveMonths.evaluate((element) => element.click());
    console.log('Opção 12 meses selecionada.');
  }

  const applyButton = page.locator('button').filter({ hasText: /apply|filtrar/i }).last();
  setProgress(8, 12, 'Aplicando filtro');
  console.log(`Filtro final detectado: ${Boolean(await applyButton.count())}`);
  if (await applyButton.count()) {
    await applyButton.evaluate((element) => element.click());
    console.log('Filtro final clicado.');
  }

  await page.waitForTimeout(1500);
  contributionEntries = await extractContributions(page);
  console.log(`Aportes capturados: ${contributionEntries.length}`);
  setProgress(12, 12, 'Movimentações carregadas');
  console.log(`Filtros de movimentação aplicados: ${safeUrl(page)}`);
}

async function extractContributions(page) {
  return page.evaluate(() => {
    const normalize = (value) => value.replace(/\s+/g, ' ').trim();
    const datePattern = /\b\d{1,2}\s+de\s+[A-Za-zÀ-ÿ]+\s+de\s+\d{4}\b|\b\d{2}\/\d{2}\/\d{4}\b/i;
    const rows = [];

    for (const table of document.querySelectorAll('table')) {
      const tableRows = [...table.querySelectorAll('tr')];
      const cellsOf = (row) => [...row.querySelectorAll(':scope > th, :scope > td, :scope > [role="cell"], :scope > [role="gridcell"]')]
        .map((cell) => normalize(cell.textContent || ''));
      const headerRowIndex = tableRows.findIndex((row) => {
        const text = cellsOf(row).join(' ').toLowerCase();
        return text.includes('movimenta') && text.includes('produto');
      });
      if (headerRowIndex < 0) continue;
      const headerCells = cellsOf(tableRows[headerRowIndex]);

      let date = '';
      let node = table;
      for (let depth = 0; node && depth < 8 && !date; depth += 1, node = node.parentElement) {
        for (let previous = node.previousElementSibling; previous && !date; previous = previous.previousElementSibling) {
          const match = previous.textContent?.match(datePattern);
          if (match) date = normalize(match[0]);
        }
      }

      const indexOf = (pattern) => headerCells.findIndex((header) => pattern.test(header));
      const movementIndex = indexOf(/movimenta/i);
      const productIndex = indexOf(/produto/i);
      const quantityIndex = indexOf(/quantidade/i);
      const totalIndex = indexOf(/valor total|total/i);

      for (const row of tableRows.slice(headerRowIndex + 1)) {
        const cells = cellsOf(row);
        if (!cells.length || cells.join('').length === 0) continue;
        const valueAt = (index) => (index >= 0 ? cells[index] : '');
        rows.push({
          id: `${date}-${cells.join('|')}`,
          date,
          movement: valueAt(movementIndex),
          product: valueAt(productIndex),
          quantity: valueAt(quantityIndex),
          total: valueAt(totalIndex),
        });
      }
    }

    return rows;
  });
}

async function runScraper() {
  if (context || status === 'running') return;

  status = 'running';
  error = null;
  setProgress(1, 10, 'Iniciando navegador');
  requestEntries = [];
  requestSequence = 0;
  contributionEntries = [];

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: browserChannel,
      ignoreHTTPSErrors: true,
      args: ['--disable-blink-features=AutomationControlled'],
      ignoreDefaultArgs: ['--enable-automation'],
    });
    const currentContext = context;
    context.on('close', () => {
      if (context !== currentContext) return;
      context = null;
      if (status === 'running') {
        status = 'failed';
        error = 'O navegador foi fechado durante a execução.';
        setProgress(0, 1, 'Navegador fechado');
      }
    });

    const page = context.pages()[0] || await context.newPage();
    for (const existingPage of context.pages()) attachRequestCapture(existingPage);
    context.on('page', attachRequestCapture);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    console.log(`URL após navegação: ${safeUrl(page)}`);
    await loginToB3(page);
    if (isLoginPage(page)) {
      await page.waitForURL((url) => !url.toString().includes('/login') && !url.toString().includes('b2clogin.com'), { timeout: 15000 }).catch(() => null);
      console.log(`URL após login: ${safeUrl(page)}`);
    }
    if (!isLoginPage(page)) {
      await configureMovementFilters(page);
    }
  } catch (cause) {
    if (status === 'paused') return;
    error = cause instanceof Error ? cause.message : String(cause);
    status = 'failed';
    await closeScraper();
    throw cause;
  }
}

async function closeScraper() {
  const currentContext = context;
  context = null;
  if (status !== 'failed') status = 'paused';
  if (currentContext) await currentContext.close();
}

function sendJson(response, code, payload) {
  response.writeHead(code, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/status') {
      sendJson(response, 200, { status, error, progress });
      return;
    }

    if (request.method === 'GET' && request.url === '/requests') {
      sendJson(response, 200, { requests: requestEntries });
      return;
    }

    if (request.method === 'GET' && request.url === '/contributions') {
      sendJson(response, 200, { contributions: contributionEntries });
      return;
    }

    if (request.method === 'POST' && request.url === '/run') {
      // O endpoint apenas dispara a execução. O front consulta /status para
      // acompanhar o progresso enquanto o navegador trabalha em background.
      void runScraper().catch(() => {});
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

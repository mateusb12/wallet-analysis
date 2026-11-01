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
const browserArgs = [
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage',
];

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
    const isVisible = await input.isVisible().catch(() => false);
    const isEnabled = await input.isEnabled().catch(() => false);
    if (isVisible && isEnabled && matchesType && (type === 'password' || matchesPattern)) {
      return input;
    }
  }

  return null;
}

async function waitForInput(page, patterns, type = null, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const input = await findInput(page, patterns, type);
    if (input) return input;
    await page.waitForTimeout(250);
  }
  return null;
}

async function findDateInput(page, labelPattern) {
  const inputs = page.locator('input');
  const count = await inputs.count();

  for (let index = 0; index < count; index += 1) {
    const input = inputs.nth(index);
    const matches = await input.evaluate((element, patternSource) => {
      const pattern = new RegExp(patternSource, 'i');
      const context = [
        element.getAttribute('name') || '',
        element.getAttribute('id') || '',
        element.getAttribute('placeholder') || '',
        element.getAttribute('aria-label') || '',
        element.parentElement?.textContent || '',
      ].join(' ');
      return pattern.test(context);
    }, labelPattern.source);
    if (matches && await input.isVisible().catch(() => false)) return input;
  }

  return null;
}

async function waitForDateInput(page, labelPattern, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const input = await findDateInput(page, labelPattern);
    if (input) return input;
    await page.waitForTimeout(200);
  }
  return null;
}

async function selectDateFromPicker(page, dateInput, targetDate, debugLabel = 'data-inicial') {
  await markDebugTarget(dateInput, debugLabel);
  const dateField = dateInput.locator('xpath=..');
  const calendarTriggers = dateField.locator('button, [role="button"]');
  let calendarTrigger = null;
  for (let index = 0; index < await calendarTriggers.count(); index += 1) {
    const candidate = calendarTriggers.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      calendarTrigger = candidate;
      break;
    }
  }
  if (calendarTrigger) {
    await markDebugTarget(calendarTrigger, 'trigger-calendario');
    await calendarTrigger.click();
  } else {
    await dateInput.click();
  }

  const comboboxes = page.locator('input[role="combobox"][aria-haspopup="listbox"]:visible');
  const comboboxCount = await comboboxes.count();
  const monthSelector = comboboxCount > 0 ? comboboxes.nth(0) : null;
  const yearSelector = comboboxCount > 1 ? comboboxes.nth(1) : null;
  if (!monthSelector || !yearSelector) {
    await dumpCalendarControls(page);
    throw new Error('Os comboboxes de mês e ano da B3 não apareceram no DOM.');
  }

  await markDebugTarget(monthSelector, 'seletor-mes');
  await monthSelector.click();
  const monthAbbreviations = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const monthOption = page.locator(`a[role="option"][aria-label="${monthAbbreviations[targetDate.month - 1]}"]:visible`).last();
  if (!(await monthOption.count()) || !(await monthOption.isVisible().catch(() => false))) {
    throw new Error(`A opção ${monthAbbreviations[targetDate.month - 1]} não apareceu no DOM do mês da B3.`);
  }
  await markDebugTarget(monthOption, `opcao-mes-${monthAbbreviations[targetDate.month - 1]}`);
  await monthOption.click();

  await markDebugTarget(yearSelector, 'seletor-ano');
  await yearSelector.click();
  const yearOption = page.locator(`a[role="option"][aria-label="${targetDate.year}"]:visible`).last();
  if (!(await yearOption.count()) || !(await yearOption.isVisible().catch(() => false))) {
    throw new Error(`${targetDate.year} não apareceu no DOM do ano da B3.`);
  }
  await markDebugTarget(yearOption, `opcao-ano-${targetDate.year}`);
  await yearOption.click();

  await page.waitForTimeout(300);
  const calendarTitle = page.getByText(new RegExp(`${monthNames[targetDate.month - 1]}\\s+de\\s+${targetDate.year}`, 'i')).last();
  if (!(await calendarTitle.count()) || !(await calendarTitle.isVisible().catch(() => false))) {
    throw new Error('O calendário da B3 não confirmou janeiro de 2025 no DOM.');
  }

  const day = page.locator('body *:visible').filter({ hasText: new RegExp(`^\\s*${targetDate.day}\\s*$`) }).last();
  if (!(await day.count()) || !(await day.isVisible().catch(() => false))) {
    throw new Error('O calendário da B3 abriu, mas o dia 1 não foi encontrado no DOM.');
  }
  await markDebugTarget(day, `dia-${targetDate.day}`);
  await day.click();

  const expectedDay = String(targetDate.day).padStart(2, '0');
  const expectedMonth = String(targetDate.month).padStart(2, '0');
  const expectedValues = [`${expectedDay}/${expectedMonth}/${targetDate.year}`, `${targetDate.year}-${expectedMonth}-${expectedDay}`];
  const actualValue = await dateInput.inputValue();
  if (!expectedValues.includes(actualValue)) {
    throw new Error(`A data inicial não foi confirmada pelo DOM: ${actualValue || '(vazia)'}.`);
  }
}

async function markDebugTarget(locator, label) {
  await locator.evaluate((element, targetLabel) => {
    let target = element;
    for (let level = 0; level < 4; level += 1) {
      const rect = target.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) break;
      target = target.parentElement || target;
    }
    target.scrollIntoView({ block: 'center', inline: 'center' });
    target.style.setProperty('border', '3px solid red', 'important');
    target.style.setProperty('outline', '3px solid red', 'important');
    target.setAttribute('data-scraper-debug-target', targetLabel);
  }, label);
  console.log(`Debug border aplicada: ${label}`);
}

async function rejectCookieBanner(page) {
  const cookieDialog = page
    .locator('[role="alertdialog"], [aria-modal="true"]')
    .filter({ hasText: /privacidade|cookies/i });

  if (!(await cookieDialog.count())) {
    console.log('Diálogo de cookies não encontrado no DOM.');
    return false;
  }

  const rejectButton = page
    .locator('button:visible, [role="button"]:visible')
    .filter({ hasText: /rejeitar todos os cookies/i })
    .first();

  if (!(await rejectButton.count())) {
    throw new Error('Diálogo de cookies encontrado no DOM, mas o botão “Rejeitar todos os cookies” não foi encontrado.');
  }

  await markDebugTarget(rejectButton, 'rejeitar-todos-os-cookies');
  await rejectButton.click({ timeout: 10000 });
  console.log('Cookies rejeitados pelo diálogo da B3.');
  return true;
}

async function dumpCalendarControls(page) {
  const controls = await page.locator('body *:visible').evaluateAll((elements) => elements
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName,
        className: typeof element.className === 'string' ? element.className : '',
        role: element.getAttribute('role') || '',
        ariaLabel: element.getAttribute('aria-label') || '',
        text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50),
        rect: [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)],
      };
    })
    .filter((element) => element.rect[0] < 650 && element.rect[1] > 100 && element.rect[1] < 650)
    .filter((element) => element.rect[2] > 0 && element.rect[3] > 0)
    .filter((element) => element.role || element.ariaLabel || element.text === 'Out' || element.text === '2026' || /select|month|year|calendar|date/i.test(element.className))
    .slice(-40));
  console.log(`Controles do calendário no DOM: ${JSON.stringify(controls)}`);
}

async function findVisibleControl(page, labelPattern) {
  const controls = page.locator('button, [role="button"], input[type="submit"], a');
  const count = await controls.count();

  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    const matches = await control.evaluate((element, patternSource) => {
      const pattern = new RegExp(patternSource, 'i');
      const text = [
        element.textContent || '',
        element.getAttribute('aria-label') || '',
        element.getAttribute('title') || '',
        element.getAttribute('value') || '',
      ].join(' ').replace(/\s+/g, ' ').trim();
      return pattern.test(text);
    }, labelPattern.source);
    if (matches && await control.isVisible().catch(() => false)) return control;
  }

  return null;
}

async function waitForVisibleControl(page, labelPattern, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const control = await findVisibleControl(page, labelPattern);
    if (control) return control;
    await page.waitForTimeout(200);
  }
  return null;
}

async function waitForEnabledControl(page, labelPattern, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const control = await findVisibleControl(page, labelPattern);
    if (control && await control.isEnabled().catch(() => false)) return control;
    await page.waitForTimeout(200);
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
  const cpfInput = await waitForInput(page, ['cpf', 'documento', 'identificação']);
  console.log(`Campo CPF detectado: ${Boolean(cpfInput)}`);
  if (!cpfInput || !b3Cpf) return;

  setProgress(2, 10, 'Preenchendo CPF');
  await markDebugTarget(cpfInput, 'login-cpf');
  await cpfInput.fill(b3Cpf);
  setProgress(3, 10, 'Enviando CPF');
  console.log('CPF preenchido.');
  await clickLoginButton(page);
  console.log('Botão Entrar clicado.');

  const passwordInput = await waitForInput(page, ['senha', 'password'], 'password');
  console.log(`Campo senha detectado: ${Boolean(passwordInput)}`);
  if (!passwordInput || !b3Password) return;

  setProgress(1, 12, 'Colocando senha');
  await markDebugTarget(passwordInput, 'login-senha');
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
  let movementLoaded = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    setProgress(4, 12, 'Abrindo extratos');
    console.log('Abrindo Extratos > Movimentação.');
    await page.goto(movementUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await rejectCookieBanner(page);
    console.log(`URL após abrir movimentação: ${safeUrl(page)}`);

    if (!isLoginPage(page) && page.url().includes('/extrato/movimentacao')) {
      movementLoaded = true;
      break;
    }

    setProgress(5, 12, 'Refazendo login');
    console.log('B3 pediu login novamente ao abrir Movimentação.');
    await loginToB3(page);
    await page.waitForURL(
      (url) => !url.toString().includes('/login') && !url.toString().includes('b2clogin.com'),
      { timeout: 15000 }
    ).catch(() => null);
    await page.waitForTimeout(1500);
    console.log(`URL após refazer login: ${safeUrl(page)}`);
  }

  if (!movementLoaded) {
    throw new Error('A B3 não abriu a página de movimentação após o login.');
  }

  setProgress(6, 12, 'Abrindo filtros');
  const filterButton = await waitForVisibleControl(page, /filtrar/i);
  console.log(`Filtro inicial detectado: ${Boolean(filterButton)}`);
  if (!filterButton) throw new Error('Não foi possível localizar o botão para abrir os filtros da B3.');
  await filterButton.click({ timeout: 10000 });
  console.log('Filtro inicial clicado.');

  setProgress(7, 12, 'Selecionando período desde 01/01/2025');
  const startDateInput = await waitForDateInput(page, /data\s*inicial|in[ií]cio/, 10000);
  if (!startDateInput) throw new Error('Não foi possível localizar a data inicial dos filtros da B3.');
  const endDateInput = await waitForDateInput(page, /data\s*final|fim/, 10000);
  if (!endDateInput) throw new Error('Não foi possível localizar a data final dos filtros da B3.');
  const endDateValue = await endDateInput.inputValue();
  const endDateMatch = endDateValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!endDateMatch) throw new Error(`A data final inicial da B3 não tem formato reconhecido: ${endDateValue || '(vazia)'}.`);
  const endDate = {
    day: Number(endDateMatch[1]),
    month: Number(endDateMatch[2]),
    year: Number(endDateMatch[3]),
  };

  await selectDateFromPicker(page, startDateInput, { year: 2025, month: 1, day: 1 });
  console.log('Data inicial selecionada: 01/01/2025.');

  await selectDateFromPicker(page, endDateInput, endDate, 'data-final');
  console.log(`Data final selecionada: ${endDateValue}.`);

  const applyButton = await waitForEnabledControl(page, /^(apply|filtrar)$/i, 10000);
  setProgress(8, 12, 'Aplicando filtro');
  const hasApplyButton = Boolean(applyButton);
  console.log(`Filtro final detectado: ${hasApplyButton}`);
  if (!hasApplyButton) throw new Error('Não foi possível localizar o botão para aplicar os filtros da B3.');
  await applyButton.evaluate((element) => {
    element.scrollIntoView({ block: 'center', inline: 'center' });
    element.style.setProperty('border', '3px solid red', 'important');
    element.style.setProperty('outline', '3px solid red', 'important');
    element.setAttribute('data-scraper-debug', 'apply-filter-target');
  });
  console.log('Borda vermelha aplicada no botão FILTRAR.');
  await page.waitForTimeout(500);
  await applyButton.click({ force: true, timeout: 10000 });
  console.log('Filtro final clicado.');

  const backButton = await waitForVisibleControl(page, /^\s*voltar\s*$/i, 10000);
  setProgress(9, 12, 'Voltando para movimentações');
  const hasBackButton = Boolean(backButton);
  console.log(`Botão voltar detectado: ${hasBackButton}`);
  if (!hasBackButton) throw new Error('Não foi possível localizar o botão Voltar dos filtros da B3.');
  await backButton.evaluate((element) => element.click());
  await page.waitForLoadState('domcontentloaded').catch(() => null);
  console.log(`Tela após voltar: ${safeUrl(page)}`);

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
      const priceIndex = indexOf(/preço unitário|preco unitario|preço|preco/i);
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
          price: valueAt(priceIndex),
          total: valueAt(totalIndex),
        });
      }
    }

    return rows;
  });
}

async function runScraper() {
  if (status === 'running') return;
  if (context) {
    const previousContext = context;
    context = null;
    await previousContext.close().catch(() => null);
  }

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
      args: browserArgs,
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
    await rejectCookieBanner(page);
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
    // Mantemos o navegador aberto para inspeção manual. Uma nova execução
    // fecha este contexto falho antes de iniciar outro.
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

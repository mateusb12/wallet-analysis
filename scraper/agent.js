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
let dividendEntries = [];
let progress = { current: 0, total: 1, label: 'Aguardando execução' };

function setProgress(current, total, label) {
  progress = { current, total, label, stageLabel: label, debug: null };
}

function setDebugAction(action, target, selector, dom = {}) {
  const domState = [
    dom.present === undefined ? null : `DOM ${dom.present ? 'presente' : 'ausente'}`,
    dom.visible === undefined ? null : `${dom.visible ? 'visível' : 'oculto'}`,
    dom.enabled === undefined ? null : `${dom.enabled ? 'habilitado' : 'desabilitado'}`,
    dom.focused === undefined ? null : `foco ${dom.focused ? 'ativo' : 'inativo'}`,
  ].filter(Boolean).join(', ');
  progress = {
    ...progress,
    label: `${progress.stageLabel || progress.label} · ${action}: ${target} [${selector}]${domState ? ` · ${domState}` : ''}`,
    debug: {
      action,
      target,
      selector,
      ...dom,
      updatedAt: new Date().toISOString(),
    },
  };
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

async function selectDateFromPicker(page, dateInput, targetDate, debugLabel) {
  const selector = debugLabel === 'data-final' ? '#datepicker-composto_end' : '#datepicker-composto_start';
  const expectedValue = `${String(targetDate.day).padStart(2, '0')}/${String(targetDate.month).padStart(2, '0')}/${targetDate.year}`;
  const targetDescription = `${debugLabel} → ${expectedValue}`;
  setDebugAction('Verificando campo no DOM', targetDescription, selector);
  const isPresent = await dateInput.count().catch(() => 0);
  const isVisible = isPresent > 0 && await dateInput.isVisible().catch(() => false);
  const isEnabled = isPresent > 0 && await dateInput.isEnabled().catch(() => false);
  if (!isPresent || !isVisible || !isEnabled) {
    setDebugAction('Campo indisponível', targetDescription, selector, { present: Boolean(isPresent), visible: isVisible, enabled: isEnabled });
    throw new Error(`O campo ${debugLabel} não está presente, visível e habilitado no DOM da B3.`);
  }

  await markDebugTarget(dateInput, debugLabel);
  setDebugAction('Aplicando foco', targetDescription, selector, { present: true, visible: true, enabled: true });
  await dateInput.focus();
  const focusedInput = await dateInput.evaluate((element) => document.activeElement === element).catch(() => false);
  if (!focusedInput) {
    setDebugAction('Foco não confirmado', targetDescription, selector, { present: true, visible: true, enabled: true, focused: false });
    throw new Error(`O campo ${debugLabel} está no DOM, mas não recebeu foco antes de abrir o calendário da B3.`);
  }
  setDebugAction('Clicando para abrir calendário', targetDescription, selector, { present: true, visible: true, enabled: true, focused: true });
  await dateInput.click();

  const comboboxes = page.locator('input[role="combobox"][aria-haspopup="listbox"]:visible');
  const monthSelector = comboboxes.first();
  setDebugAction('Aguardando calendário no DOM', targetDescription, 'input[role="combobox"][aria-haspopup="listbox"]', { dateFieldFocused: true });
  try {
    await monthSelector.waitFor({ state: 'visible', timeout: 1000 });
  } catch {
    if (!(await dateInput.count()) || !(await dateInput.isVisible().catch(() => false))) {
      throw new Error(`O campo ${debugLabel} saiu do DOM antes de abrir o calendário da B3.`);
    }
    await dateInput.click();
    await monthSelector.waitFor({ state: 'visible', timeout: 5000 });
  }

  const monthAbbreviations = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  setDebugAction('Abrindo seletor de mês', targetDescription, 'input[role="combobox"][aria-haspopup="listbox"]:visible');
  await markDebugTarget(monthSelector, 'seletor-mes');
  await monthSelector.click();
  const monthOption = page.locator(`a[role="option"][aria-label="${monthAbbreviations[targetDate.month - 1]}"]:visible`).last();
  if (!(await monthOption.count()) || !(await monthOption.isVisible().catch(() => false))) {
    throw new Error(`A opção ${monthAbbreviations[targetDate.month - 1]} não apareceu no DOM do mês da B3.`);
  }
  setDebugAction('Selecionando mês', targetDescription, `a[role="option"][aria-label="${monthAbbreviations[targetDate.month - 1]}"]`);
  await markDebugTarget(monthOption, `opcao-mes-${monthAbbreviations[targetDate.month - 1]}`);
  await monthOption.click();

  const yearSelector = comboboxes.nth(1);
  if (!(await yearSelector.count()) || !(await yearSelector.isVisible().catch(() => false))) {
    throw new Error(`O seletor de ano não está presente no DOM para ${debugLabel}.`);
  }
  setDebugAction('Abrindo seletor de ano', targetDescription, 'input[role="combobox"][aria-haspopup="listbox"] (ano)');
  await markDebugTarget(yearSelector, 'seletor-ano');
  await yearSelector.click();
  const yearOption = page.locator(`a[role="option"][aria-label="${targetDate.year}"]:visible`).last();
  if (!(await yearOption.count()) || !(await yearOption.isVisible().catch(() => false))) {
    throw new Error(`${targetDate.year} não apareceu no DOM do ano da B3.`);
  }
  setDebugAction('Selecionando ano', targetDescription, `a[role="option"][aria-label="${targetDate.year}"]`);
  await markDebugTarget(yearOption, `opcao-ano-${targetDate.year}`);
  await yearOption.click();

  const dayOptions = page.locator('[role="option"]:visible');
  const dayPattern = new RegExp(`,\\s*${targetDate.day}\\s+de\\s+${monthNames[targetDate.month - 1]}\\s+de\\s+${targetDate.year}$`, 'i');
  let dayOption = null;
  for (let index = 0; index < await dayOptions.count(); index += 1) {
    const candidate = dayOptions.nth(index);
    const ariaLabel = await candidate.getAttribute('aria-label').catch(() => '');
    if (dayPattern.test(ariaLabel || '')) {
      dayOption = candidate;
      break;
    }
  }
  if (!dayOption || !(await dayOption.isVisible().catch(() => false))) {
    throw new Error(`O dia ${targetDate.day} não apareceu no DOM do calendário da B3.`);
  }
  setDebugAction('Selecionando dia', targetDescription, `a[role="option"] com aria-label do dia ${targetDate.day}`);
  await markDebugTarget(dayOption, `dia-${targetDate.day}`);
  await dayOption.click();

  await page.waitForTimeout(200);
  const actualValue = await dateInput.inputValue();
  if (actualValue !== expectedValue) {
    setDebugAction('Validando valor da data', targetDescription, selector, { expectedValue, actualValue });
    throw new Error(`A B3 não confirmou ${debugLabel}: esperado ${expectedValue}, recebido ${actualValue || '(vazio)'}.`);
  }
  setDebugAction('Data selecionada', targetDescription, selector, { expectedValue, actualValue, present: true, visible: true, enabled: true });
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
    .locator('[role="alertdialog"]:visible, [aria-modal="true"]:visible')
    .filter({ hasText: /privacidade|cookies/i });

  setDebugAction('Verificando janela de cookies', 'botão de rejeição', '[role="alertdialog"], [aria-modal="true"]');
  if (!(await cookieDialog.count())) {
    console.log('Diálogo de cookies não encontrado no DOM.');
    return false;
  }

  const rejectButton = page
    .locator('button:visible, [role="button"]:visible')
    .filter({ hasText: /rejeitar todos os cookies/i })
    .first();

  if (!(await rejectButton.count())) {
    setDebugAction('Botão não encontrado no DOM', 'Rejeitar todos os cookies', 'button, [role="button"]', { present: false });
    throw new Error('Diálogo de cookies encontrado no DOM, mas o botão “Rejeitar todos os cookies” não foi encontrado.');
  }

  setDebugAction('Clicando no botão presente no DOM', 'Rejeitar todos os cookies', 'button, [role="button"]', { present: true, visible: await rejectButton.isVisible().catch(() => false), enabled: await rejectButton.isEnabled().catch(() => false) });
  await markDebugTarget(rejectButton, 'rejeitar-todos-os-cookies');
  await rejectButton.click({ timeout: 10000 });
  console.log('Cookies rejeitados pelo diálogo da B3.');
  return true;
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
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
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
  await markDebugTarget(filterButton, 'abrir-filtros-movimentacao');
  await filterButton.click({ timeout: 10000 });
  console.log('Filtro inicial clicado.');

  const filterDialog = page.locator('[role="dialog"]:visible').last();
  await filterDialog.waitFor({ state: 'visible', timeout: 10000 });
  setProgress(7, 12, 'Selecionando período desde 01/01/2025');
  const startDateInput = filterDialog.locator('#datepicker-composto_start');
  await startDateInput.waitFor({ state: 'visible', timeout: 10000 });
  const initialEndDateInput = filterDialog.locator('#datepicker-composto_end');
  await initialEndDateInput.waitFor({ state: 'visible', timeout: 10000 });
  const endDateValue = await initialEndDateInput.inputValue();
  const endDateMatch = endDateValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!endDateMatch) throw new Error(`A data final inicial da B3 não tem formato reconhecido: ${endDateValue || '(vazia)'}.`);
  const endDate = {
    day: Number(endDateMatch[1]),
    month: Number(endDateMatch[2]),
    year: Number(endDateMatch[3]),
  };

  await selectDateFromPicker(page, startDateInput, { year: 2025, month: 1, day: 1 }, 'data-inicial');
  console.log('Data inicial selecionada: 01/01/2025.');

  const endDateInput = filterDialog.locator('#datepicker-composto_end');
  const endFieldPresent = await endDateInput.count().catch(() => 0);
  if (!endFieldPresent || !(await endDateInput.isVisible().catch(() => false)) || !(await endDateInput.isEnabled().catch(() => false))) {
    throw new Error('Após selecionar a data inicial, o campo Data final não está presente, visível e habilitado no DOM da B3.');
  }
  const endValueAfterStart = await endDateInput.inputValue();
  console.log(`DOM após data inicial: campo Data final presente; valor ${endValueAfterStart || '(vazio)'}.`);
  await selectDateFromPicker(page, endDateInput, endDate, 'data-final');
  console.log(`Data final selecionada: ${endDateValue}.`);

  setDebugAction('Buscando botão presente no DOM', 'Filtrar', 'button:visible, [role="button"]:visible');
  const applyButtons = page
    .locator('button:visible, [role="button"]:visible, input[type="submit"]:visible, a:visible')
    .filter({ hasText: /^(apply|filtrar)$/i });
  const applyButtonCount = await applyButtons.count();
  const applyButton = applyButtonCount ? applyButtons.last() : null;
  setProgress(8, 12, 'Aplicando filtro');
  const hasApplyButton = Boolean(applyButton)
    && await applyButton.isVisible().catch(() => false)
    && await applyButton.isEnabled().catch(() => false);
  console.log(`Filtro final detectado, visível e habilitado: ${hasApplyButton}`);
  if (!hasApplyButton) {
    setDebugAction('Botão ausente ou desabilitado', 'Filtrar', 'button:visible, [role="button"]:visible', { present: applyButtonCount > 0 });
    throw new Error('O botão “Filtrar” não está presente, visível e habilitado no DOM da B3.');
  }
  setDebugAction('Clicando no botão presente no DOM', 'Filtrar', 'button:visible, [role="button"]:visible', { present: true, visible: true, enabled: true });
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

  await filterDialog.waitFor({ state: 'hidden', timeout: 15000 });
  const expectedRange = `Exibindo: 01/01/2025 - ${endDateValue}`;
  await page.getByText(expectedRange, { exact: true }).last().waitFor({ state: 'visible', timeout: 15000 });
  setProgress(9, 12, 'Movimentações filtradas');
  console.log(`Filtro aplicado; intervalo exibido: ${expectedRange}`);

  await waitForMovementRows(page);
  const movementRows = await collectCurrentTabRows(page, waitForMovementRows);
  dividendEntries = movementRows.filter((row) => /dividendo|juros sobre capital|jcp|rendimento|amortização|amortizacao|bonificação|bonificacao/i.test(row.movement));
  console.log(`Dividendos capturados na aba Movimentação: ${dividendEntries.length}`);

  console.log(`Filtros de movimentação aplicados: ${safeUrl(page)}`);
}

async function configureNegotiationFilters(page) {
  setProgress(10, 12, 'Abrindo Negociação para capturar aportes');
  const negotiationTab = page.getByRole('tab', { name: /negociação/i });
  if (!(await negotiationTab.count()) || !(await negotiationTab.isVisible().catch(() => false))) {
    throw new Error('A aba Negociação não está presente e visível no DOM da B3.');
  }
  await markDebugTarget(negotiationTab, 'aba-negociacao-aportes');
  await negotiationTab.click();
  await page.waitForURL(/\/extrato\/negociacao/, { timeout: 10000 }).catch(() => null);
  await page.waitForTimeout(500);

  const filterButton = await waitForVisibleControl(page, /filtrar/i);
  if (!filterButton) throw new Error('O botão Filtrar da aba Negociação não está presente no DOM.');
  await markDebugTarget(filterButton, 'abrir-filtros-negociacao');
  await filterButton.click({ timeout: 10000 });

  const dialog = page.locator('[role="dialog"]:visible').last();
  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  const dateFields = [
    { selector: '#datepicker-composto_start', expected: '01/01/2025', picker: { year: 2025, month: 1, day: 1 }, label: 'data-inicial-negociacao' },
    { selector: '#datepicker-composto_end', expected: '30/10/2026', picker: { year: 2026, month: 10, day: 30 }, label: 'data-final-negociacao' },
  ];

  for (const field of dateFields) {
    const input = dialog.locator(field.selector);
    const present = await input.count().catch(() => 0);
    if (!present || !(await input.isVisible().catch(() => false)) || !(await input.isEnabled().catch(() => false))) {
      throw new Error(`Campo ${field.selector} não está presente, visível e habilitado no DOM dos filtros de Negociação.`);
    }
    const current = (await input.inputValue()).trim();
    if (current === field.expected) {
      console.log(`Negociação ${field.selector}: DOM já contém ${field.expected}; nenhuma ação necessária.`);
      setDebugAction('DOM já corresponde; sem ação', field.expected, field.selector, { present: true, visible: true, enabled: true, actualValue: current });
      continue;
    }
    console.log(`Negociação ${field.selector}: DOM contém ${current || '(vazio)'}; selecionando ${field.expected}.`);
    await selectDateFromPicker(page, input, field.picker, field.label);
    const updated = (await input.inputValue()).trim();
    if (updated !== field.expected) {
      throw new Error(`DOM não confirmou ${field.expected} em ${field.selector}; valor atual: ${updated || '(vazio)'}.`);
    }
  }

  const applyButtons = page
    .locator('button:visible, [role="button"]:visible, input[type="submit"]:visible, a:visible')
    .filter({ hasText: /^(apply|filtrar)$/i });
  const count = await applyButtons.count();
  const applyButton = count ? applyButtons.last() : null;
  if (!applyButton || !(await applyButton.isVisible().catch(() => false)) || !(await applyButton.isEnabled().catch(() => false))) {
    throw new Error('O botão Filtrar da aba Negociação não está presente, visível e habilitado no DOM.');
  }
  await markDebugTarget(applyButton, 'aplicar-filtros-negociacao');
  await applyButton.click({ force: true, timeout: 10000 });
  await dialog.waitFor({ state: 'hidden', timeout: 15000 });
  await page.getByText('Exibindo: 01/01/2025 - 30/10/2026', { exact: true }).last().waitFor({ state: 'visible', timeout: 15000 });
  setProgress(11, 12, 'Filtro de Negociação aplicado; aguardando operações');
  await waitForNegotiationRows(page);

  contributionEntries = await collectCurrentTabRows(page, waitForNegotiationRows);
  console.log(`Aportes capturados na aba Negociação: ${contributionEntries.length}`);
  setProgress(12, 12, 'Aportes e dividendos carregados');
}

async function collectCurrentTabRows(page, waitForRows) {
  const collected = [];
  const seen = new Set();
  for (let pageNumber = 0; pageNumber < 500; pageNumber += 1) {
    const pageRows = await extractStatementRows(page);
    for (const row of pageRows) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        collected.push(row);
      }
    }
    const next = page.getByRole('button', { name: /próxima página/i });
    if (!(await next.count()) || !(await next.isVisible().catch(() => false)) || !(await next.isEnabled().catch(() => false))) break;
    await next.click();
    await page.waitForTimeout(500);
    await waitForRows(page);
  }
  return collected;
}

async function waitForMovementRows(page) {
  setDebugAction('Aguardando movimentações presentes no DOM', 'Movimentação', 'table tr com produto, quantidade e valor total');
  await page.waitForFunction(() => {
    const cellSelector = ':scope > th, :scope > td, :scope > [role="cell"], :scope > [role="gridcell"]';
    return [...document.querySelectorAll('table')].some((table) => {
      const rows = [...table.querySelectorAll('tr')];
      const headerIndex = rows.findIndex((row) => {
        const text = [...row.querySelectorAll(cellSelector)].map((cell) => cell.textContent || '').join(' ').toLowerCase();
        return text.includes('movimenta') && text.includes('produto') && text.includes('quantidade');
      });
      return headerIndex >= 0 && rows.slice(headerIndex + 1).some((row) => [...row.querySelectorAll(cellSelector)].some((cell) => (cell.textContent || '').trim()));
    });
  }, null, { timeout: 15000 });
}

async function waitForNegotiationRows(page) {
  setDebugAction('Aguardando operações presentes no DOM', 'Negociação', 'table tr com código, quantidade e valor total');
  await page.waitForFunction(() => {
    const cellSelector = ':scope > th, :scope > td, :scope > [role="cell"], :scope > [role="gridcell"]';
    return [...document.querySelectorAll('table')].some((table) => {
      const rows = [...table.querySelectorAll('tr')];
      const headerIndex = rows.findIndex((row) => {
        const text = [...row.querySelectorAll(cellSelector)].map((cell) => cell.textContent || '').join(' ').toLowerCase();
        return text.includes('movimenta') && text.includes('negociação') && text.includes('quantidade');
      });
      return headerIndex >= 0 && rows.slice(headerIndex + 1).some((row) => [...row.querySelectorAll(cellSelector)].some((cell) => (cell.textContent || '').trim()));
    });
  }, null, { timeout: 15000 });
}

async function extractStatementRows(page) {
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
        return text.includes('movimenta') && (text.includes('produto') || text.includes('negociação'));
      });
      if (headerRowIndex < 0) continue;
      const headerCells = cellsOf(tableRows[headerRowIndex]);

      let date = '';
      const tableHeaderDate = table.closest('b3-table')?.querySelector('.table__left-information, [id^="left_info_tabela-extrato_top"]')?.textContent;
      if (tableHeaderDate) date = normalize(tableHeaderDate);
      let node = table;
      for (let depth = 0; node && depth < 8 && !date; depth += 1, node = node.parentElement) {
        for (let previous = node.previousElementSibling; previous && !date; previous = previous.previousElementSibling) {
          const match = previous.textContent?.match(datePattern);
          if (match) date = normalize(match[0]);
        }
      }

      const indexOf = (pattern) => headerCells.findIndex((header) => pattern.test(header));
      const movementIndex = indexOf(/movimenta/i);
      const productIndex = indexOf(/produto|cód\. de negociação/i);
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
  dividendEntries = [];

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
      await configureNegotiationFilters(page);
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

    if (request.method === 'GET' && request.url === '/dividends') {
      sendJson(response, 200, { dividends: dividendEntries });
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

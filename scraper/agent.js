import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { resolve } from 'node:path';

const port = Number(process.env.SCRAPER_AGENT_PORT || 8765);
const targetUrl = process.env.SCRAPER_TARGET_URL || 'https://www.google.com';
const userDataDir = resolve(process.env.SCRAPER_PROFILE_DIR || './browser_profile');
const browserChannel = process.env.SCRAPER_BROWSER_CHANNEL || 'chrome';

let context = null;
let status = 'idle';
let error = null;

async function runScraper() {
  if (context) return;

  status = 'running';
  error = null;

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: browserChannel,
      ignoreHTTPSErrors: true,
      args: ['--disable-blink-features=AutomationControlled'],
      ignoreDefaultArgs: ['--enable-automation'],
    });

    const page = context.pages()[0] || await context.newPage();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
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

import 'dotenv/config';
import { chromium } from 'playwright';

const defaultMetricDefinitions = [
  {
    key: 'dispensed30Days',
    envName: 'PHARMACY_LABEL_DISPENSED',
    defaultLabel: 'Dispensed (30 Days)',
  },
  {
    key: 'lowStockAlerts',
    envName: 'PHARMACY_LABEL_LOW_STOCK',
    defaultLabel: 'Low Stock Alerts',
  },
  {
    key: 'pendingRequests',
    envName: 'PHARMACY_LABEL_PENDING',
    defaultLabel: 'Pending Requests',
  },
  {
    key: 'expiringUnder90Days',
    envName: 'PHARMACY_LABEL_EXPIRING',
    defaultLabel: 'Expiring < 90 Days',
  },
];

export async function getSystemOverviewMetrics(options = {}) {
  const config = getConfig(options);
  const overviewUrl = options.overviewUrl ?? process.env.PHARMACY_OVERVIEW_URL ?? 'https://pharmacy.mercy.org.my/index.php';

  return withLoggedInPage(config, async page => {
    await page.goto(overviewUrl, { waitUntil: 'networkidle' });
    await page.getByText('System Overview', { exact: false }).waitFor({ timeout: config.timeout });

    const overviewText = await page.locator('body').innerText();
    const result = {};

    for (const metric of getMetricDefinitions()) {
      result[metric.key] = readNumberAfterLabel(overviewText, metric.label);
    }

    return result;
  });
}

export async function getIncomingRequests(options = {}) {
  const config = getConfig(options);
  const incomingRequestsUrl = options.incomingRequestsUrl ?? process.env.PHARMACY_INCOMING_REQUESTS_URL;

  return withLoggedInPage(config, async page => {
    await openIncomingRequests(page, incomingRequestsUrl, config.timeout);

    await page.getByRole('heading', { name: 'Incoming Requests' }).waitFor({ timeout: config.timeout });
    await page.getByText('Requisition Management', { exact: false }).waitFor({ timeout: config.timeout });

    const total = await readTotal(page);
    const requests = await readRequestRows(page);

    return { total, requests };
  });
}

function getConfig(options) {
  const username = process.env.PHARMACY_USERNAME;
  const password = process.env.PHARMACY_PASSWORD;

  if (!username || !password) {
    throw new Error('Set PHARMACY_USERNAME and PHARMACY_PASSWORD in .env before running.');
  }

  return {
    loginUrl: options.loginUrl ?? process.env.PHARMACY_LOGIN_URL ?? 'https://pharmacy.mercy.org.my/login.php',
    username,
    password,
    headless: options.headless ?? process.env.PHARMACY_HEADLESS !== 'false',
    timeout: options.timeoutMs ?? Number(process.env.PHARMACY_TIMEOUT_MS ?? 30_000),
  };
}

async function withLoggedInPage(config, callback) {
  const browser = await chromium.launch(await getLaunchOptions(config));
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(config.timeout);

  try {
    await login(page, config);
    return await callback(page);
  } finally {
    await browser.close();
  }
}

async function getLaunchOptions(config) {
  if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return { headless: config.headless };
  }

  const serverlessChromium = (await import('@sparticuz/chromium')).default;

  return {
    args: serverlessChromium.args,
    executablePath: await serverlessChromium.executablePath(),
    headless: serverlessChromium.headless,
  };
}

async function login(page, config) {
  await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });

  await fillFirstVisible(page, [
    'input[name="username"]',
    'input[name="user"]',
    'input[name="email"]',
    'input[type="email"]',
    'input[type="text"]',
  ], config.username);

  await fillFirstVisible(page, [
    'input[name="password"]',
    'input[type="password"]',
  ], config.password);

  await Promise.all([
    page.waitForURL(url => !url.toString().includes('/login.php'), { timeout: config.timeout }).catch(() => null),
    clickFirstVisible(page, [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Login")',
      'button:has-text("Sign in")',
      'button:has-text("Log in")',
    ], 'submit control'),
  ]);
}

async function openIncomingRequests(page, incomingRequestsUrl, timeout) {
  if (incomingRequestsUrl) {
    await page.goto(incomingRequestsUrl, { waitUntil: 'networkidle' });
    return;
  }

  await clickFirstVisible(page, [
    'a:has-text("Incoming Requests")',
    'button:has-text("Incoming Requests")',
    'text=Incoming Requests',
  ], 'Incoming Requests navigation item');
  await page.waitForLoadState('networkidle', { timeout }).catch(() => null);
}

async function readTotal(page) {
  const text = await page.locator('body').innerText();
  const match = text.match(/(\d+)\s+Total/i);
  return match ? Number(match[1]) : null;
}

async function readRequestRows(page) {
  const tableRows = page.locator('table tbody tr');
  const rowCount = await tableRows.count();

  if (rowCount === 0) {
    throw new Error('Could not find incoming request table rows.');
  }

  const rows = [];
  for (let index = 0; index < rowCount; index += 1) {
    const cells = tableRows.nth(index).locator('td');
    const cellCount = await cells.count();

    if (cellCount < 7) {
      continue;
    }

    const date = cleanText(await cells.nth(0).innerText());
    const itemAndRequester = splitItemAndRequester(await cells.nth(1).innerText());
    const quantity = Number(cleanText(await cells.nth(2).innerText()).replaceAll(',', ''));
    const status = cleanText(await cells.nth(3).innerText());
    const auditInfo = splitAuditInfo(await cells.nth(4).innerText());
    const adminRemarks = normalizeDash(await cells.nth(5).innerText());
    const action = cleanText(await cells.nth(6).innerText());

    rows.push({
      date,
      item: itemAndRequester.item,
      requester: itemAndRequester.requester,
      quantity,
      status,
      auditBy: auditInfo.by,
      auditAt: auditInfo.at,
      adminRemarks,
      action,
    });
  }

  return rows;
}

async function fillFirstVisible(page, selectors, value) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.fill(value);
      return;
    }
  }

  throw new Error(`Could not find a visible input for selectors: ${selectors.join(', ')}`);
}

async function clickFirstVisible(page, selectors, label) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click();
      return;
    }
  }

  throw new Error(`Could not find a visible ${label} for selectors: ${selectors.join(', ')}`);
}

function getMetricDefinitions() {
  return defaultMetricDefinitions.map(metric => ({
    key: metric.key,
    label: process.env[metric.envName] ?? metric.defaultLabel,
  }));
}

function readNumberAfterLabel(text, label) {
  const pattern = new RegExp(`${escapeRegExp(label)}[\\s\\S]{0,120}?(-?\\d[\\d,]*)`, 'i');
  const match = text.match(pattern);

  if (!match) {
    throw new Error(`Could not find metric value for label: ${label}`);
  }

  return Number(match[1].replaceAll(',', ''));
}

function splitItemAndRequester(value) {
  const lines = cleanLines(value);
  return {
    item: lines[0] ?? '',
    requester: lines.slice(1).join(' '),
  };
}

function splitAuditInfo(value) {
  const lines = cleanLines(value);
  return {
    by: lines[0] ?? '',
    at: lines.slice(1).join(' '),
  };
}

function normalizeDash(value) {
  const text = cleanText(value);
  return text === '-' ? null : text;
}

function cleanLines(value) {
  return value
    .split('\n')
    .map(cleanText)
    .filter(Boolean);
}

function cleanText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

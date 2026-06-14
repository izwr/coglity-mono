import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { ParsedSpec } from '../spec/types';
import type { PlaywrightAction } from './events';
import { ElementNotFoundError, NavigationError } from '../agents/shared/errors';

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

async function ensureChromium(headed: boolean): Promise<Browser> {
  try {
    return await chromium.launch({ headless: !headed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (!msg.includes('Executable doesn') && !msg.includes('browserType.launch')) {
      throw err;
    }

    process.stderr.write('Chromium not found — installing (one-time)…\n');
    // @ts-expect-error — internal Playwright API, no published types
    const { registry } = await import('playwright-core/lib/server');
    const executable = registry.findExecutable('chromium');
    if (!executable) throw new Error('Could not find chromium in Playwright registry');
    await registry.install([executable]);

    return chromium.launch({ headless: !headed });
  }
}

export async function launchBrowser(
  spec: ParsedSpec,
  opts: { headed?: boolean } = {},
): Promise<BrowserSession> {
  const browser = await ensureChromium(!!opts.headed);
  const context = await browser.newContext({
    viewport: spec.viewport,
    ...(spec.auth ? { storageState: spec.auth } : {}),
  });
  const page = await context.newPage();
  page.setDefaultTimeout(spec.timeout);
  page.setDefaultNavigationTimeout(spec.timeout);
  await page.goto(spec.url, { waitUntil: 'domcontentloaded', timeout: spec.timeout });
  return { browser, context, page };
}

export async function closeBrowser(session: BrowserSession): Promise<void> {
  await session.context.close();
  await session.browser.close();
}

export async function executeAction(
  page: Page,
  action: PlaywrightAction,
  timeoutMs: number,
): Promise<string> {
  try {
    switch (action.tool) {
      case 'click': {
        const el = page.locator(action.selector).first();
        await el.click({ timeout: timeoutMs });
        return `Clicked "${action.selector}"`;
      }
      case 'fill': {
        const el = page.locator(action.selector).first();
        await el.fill(action.value, { timeout: timeoutMs });
        return `Filled "${action.selector}" with "${action.value}"`;
      }
      case 'goto': {
        await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        return `Navigated to ${action.url}`;
      }
      case 'press': {
        await page.keyboard.press(action.key);
        return `Pressed "${action.key}"`;
      }
      case 'select': {
        const el = page.locator(action.selector).first();
        await el.selectOption(action.value, { timeout: timeoutMs });
        return `Selected "${action.value}" in "${action.selector}"`;
      }
      case 'wait_for': {
        const el = page.locator(action.selector).first();
        await el.waitFor({ state: action.state ?? 'visible', timeout: timeoutMs });
        return `Element "${action.selector}" is ${action.state ?? 'visible'}`;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const selector = 'selector' in action ? action.selector : '';
    if (msg.includes('Timeout') || msg.includes('waiting for')) {
      throw new ElementNotFoundError(`Element not found: ${selector} — ${msg}`);
    }
    if (msg.includes('net::') || msg.includes('Navigation')) {
      throw new NavigationError(msg);
    }
    throw err;
  }
}

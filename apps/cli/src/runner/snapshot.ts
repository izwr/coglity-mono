import type { Page } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface Snapshot {
  accessibilityTree: string;
  screenshotPath: string;
}

export async function takeSnapshot(
  page: Page,
  snapshotsDir: string,
  label: string,
): Promise<Snapshot> {
  const screenshotPath = path.join(snapshotsDir, `${label}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const tree = await page.locator('body').ariaSnapshot({ mode: 'ai' });
  const treePath = path.join(snapshotsDir, `${label}-a11y.yaml`);
  await fs.writeFile(treePath, tree);

  return {
    accessibilityTree: tree,
    screenshotPath,
  };
}

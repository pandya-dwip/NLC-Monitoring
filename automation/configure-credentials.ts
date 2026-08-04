/**
 * One-off utility: configures MQTT Basic credentials (clientId/userName/password) on
 * ThingsBoard for every device listed in devices.json. Run with `npm run configure-credentials`.
 * Processes devices strictly one after another; a single device failure is logged and
 * screenshotted, never aborts the run.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';

interface DeviceCredentials {
  clientId: string;
  userName: string;
  password: string;
}

const config = {
  baseUrl: process.env['TB_BASE_URL'] ?? 'http://199.199.50.111:8080',
  username: process.env['TB_USERNAME'] ?? 'nlcqatest@thingsboard.org',
  password: process.env['TB_PASSWORD'] ?? 'cimcon',
  devicesJsonPath: path.resolve(__dirname, process.env['DEVICES_JSON_PATH'] ?? '../backend/devices.json'),
  screenshotsDir: path.resolve(__dirname, process.env['SCREENSHOTS_DIR'] ?? './screenshots'),
  headless: (process.env['HEADLESS'] ?? 'true').toLowerCase() !== 'false',
};

function readDevices(filePath: string): DeviceCredentials[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`devices.json not found: ${filePath}`);
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`devices.json must be a non-empty array: ${filePath}`);
  }
  return parsed as DeviceCredentials[];
}

/** --start/--end are 1-indexed and inclusive, matching how you'd say "device 501 to the end". */
function resolveRange(totalCount: number): { start: number; end: number } {
  const argAfter = (flag: string): number | undefined => {
    const idx = process.argv.indexOf(flag);
    return idx !== -1 ? Number(process.argv[idx + 1]) : undefined;
  };
  const start = argAfter('--start') ?? 1;
  const end = argAfter('--end') ?? totalCount;
  return { start, end };
}

async function login(page: Page): Promise<void> {
  await page.goto(`${config.baseUrl}/login`);
  await page.getByRole('textbox', { name: 'Username (email)' }).fill(config.username);
  await page.getByRole('textbox', { name: 'Password' }).fill(config.password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.locator('[id="docs-menu-entity.entities"]').getByRole('link', { name: 'Devices' }).waitFor();
}

async function logout(page: Page): Promise<void> {
  await page.getByRole('button').filter({ hasText: 'more_vert' }).click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();
}

async function configureDevice(page: Page, device: DeviceCredentials): Promise<void> {
  const searchUrl = `${config.baseUrl}/entities/devices/all?textSearch=${encodeURIComponent(device.clientId)}`;
  await page.goto(searchUrl);

  const deviceCell = page.getByRole('cell', { name: device.clientId, exact: true });
  await deviceCell.waitFor();
  await deviceCell.click();

  const manageCredentialsButton = page.getByRole('button', { name: 'Manage credentials' });
  await manageCredentialsButton.waitFor();
  await manageCredentialsButton.click();

  const alreadyMqttBasic = await page
    .getByText('Credentials typeMQTT Basic')
    .isVisible()
    .catch(() => false);
  if (!alreadyMqttBasic) {
    await page.getByText(/^Credentials type/).click();
    await page.getByRole('option', { name: 'MQTT Basic' }).click();
  }

  await page.getByRole('textbox', { name: 'Client ID' }).fill(device.clientId);
  await page.getByRole('textbox', { name: 'User Name' }).fill(device.userName);
  await page.getByRole('textbox', { name: 'Password' }).fill(device.password);

  await page.getByRole('button', { name: 'Save' }).click();
  // The credentials dialog closes back to the device details panel on success --
  // "Manage credentials" reappearing is our signal the save completed.
  await manageCredentialsButton.waitFor();

  const detailsPanel = page.locator('tb-details-panel');
  await detailsPanel.getByRole('button').filter({ hasText: 'close' }).click();
  await detailsPanel.waitFor({ state: 'hidden' });
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function captureFailureScreenshot(page: Page, clientId: string): Promise<string> {
  fs.mkdirSync(config.screenshotsDir, { recursive: true });
  const filePath = path.join(config.screenshotsDir, `${sanitizeFileName(clientId)}-error.png`);
  await page.screenshot({ path: filePath, fullPage: true }).catch(() => undefined);
  return filePath;
}

async function main(): Promise<void> {
  const allDevices = readDevices(config.devicesJsonPath);
  const { start, end } = resolveRange(allDevices.length);
  const devices = allDevices.slice(start - 1, end);
  if (devices.length === 0) {
    throw new Error(`--start ${start} / --end ${end} selected 0 devices out of ${allDevices.length}.`);
  }
  console.log(`Configuring devices ${start}-${end} of ${allDevices.length} (${devices.length} device(s)).`);

  const browser = await chromium.launch({ headless: config.headless });
  const page = await browser.newContext().then((context) => context.newPage());

  let successCount = 0;
  let failedCount = 0;

  try {
    await login(page);

    for (let i = 0; i < devices.length; i++) {
      const device = devices[i]!;
      console.log(`[${i + 1}/${devices.length}] Configuring ${device.clientId}`);
      try {
        await configureDevice(page, device);
        successCount++;
        console.log('✓ Credentials Updated');
      } catch (err) {
        failedCount++;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`✗ Failed: ${message}`);
        const screenshotPath = await captureFailureScreenshot(page, device.clientId);
        console.error(`  Screenshot: ${screenshotPath}`);
      }
      console.log('----------------------');
    }

    await logout(page);
  } finally {
    await browser.close();
  }

  console.log('Completed');
  console.log(`${successCount} Successful`);
  console.log(`${failedCount} Failed`);

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});

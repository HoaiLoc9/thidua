const fs = require("fs");
const path = require("path");

const playwrightPath = process.env.PLAYWRIGHT_PACKAGE || "playwright";
const { chromium } = require(playwrightPath);

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const OUT_DIR = path.resolve(__dirname, "..", "report_assets", "screenshots");

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.click('button[type="submit"], button:has-text("Đăng nhập"), button:has-text("Dang nhap")'),
  ]);
}

async function shot(page, route, name) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true });
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const adminContext = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      deviceScaleFactor: 1,
    });
    const adminPage = await adminContext.newPage();
    await adminPage.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await adminPage.screenshot({ path: path.join(OUT_DIR, "01_login.png"), fullPage: true });
    await login(adminPage, "admin@iuh.edu.vn", "123456");
    await shot(adminPage, "/", "02_dashboard.png");
    await shot(adminPage, "/criteria", "03_criteria_management.png");
    await shot(adminPage, "/reviews", "04_review_screen.png");
    await shot(adminPage, "/nominations", "05_nomination_management.png");
    await shot(adminPage, "/users", "06_user_management.png");
    await adminContext.close();

    const studentContext = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      deviceScaleFactor: 1,
    });
    const studentPage = await studentContext.newPage();
    await login(studentPage, "hoailoc0505@gmail.com", "123456");
    await shot(studentPage, "/nominations", "07_create_nomination_upload.png");
    await studentContext.close();
  } finally {
    await browser.close();
  }
})();

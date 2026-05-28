const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const BASE_URL = process.env.APP_URL || "http://localhost:5173";
const API_URL = process.env.API_URL || "http://localhost:4000/api";
const OUT_DIR = path.resolve(__dirname, "..", "report_assets", "screenshots");
const PROFILE_DIR = path.resolve(__dirname, "..", "report_assets", "edge-profile");
const EDGE_EXE =
  process.env.EDGE_EXE || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = Number(process.env.CDP_PORT || 9227);
const DEBUG_LOG = path.resolve(__dirname, "..", "report_assets", "screenshot-cdp.log");

let nextId = 1;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function debug(message) {
  fs.appendFileSync(DEBUG_LOG, `${new Date().toISOString()} ${message}\n`);
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const keepAlive = setInterval(() => {}, 1000);
  ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(JSON.stringify(data.error)));
      else resolve(data.result);
    }
  });
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => {
      resolve({
        send(method, params = {}) {
          const id = nextId++;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej }));
        },
        close() {
          clearInterval(keepAlive);
          ws.close();
        },
      });
    });
    ws.addEventListener("error", (error) => {
      clearInterval(keepAlive);
      reject(error);
    });
  });
}

async function waitForCdp() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      if (res.ok) return res.json();
    } catch {
      // Browser is still booting.
    }
    await delay(250);
  }
  throw new Error("Could not connect to Edge DevTools Protocol");
}

async function screenshot(client, fileName) {
  await client.send("Page.bringToFront");
  await delay(900);
  const data = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    fromSurface: true,
  });
  fs.writeFileSync(path.join(OUT_DIR, fileName), Buffer.from(data.data, "base64"));
}

async function navigate(client, url) {
  await client.send("Page.navigate", { url });
  await delay(1800);
}

async function injectAuth(client, email, password) {
  const expression = `
    (async () => {
      const res = await fetch("${API_URL}/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "${email}", password: "${password}" })
      });
      const data = await res.json();
      sessionStorage.setItem("thidua_auth", JSON.stringify({ token: data.token, user: data.user }));
      return data.user && data.user.role;
    })()
  `;
  await client.send("Runtime.evaluate", { expression, awaitPromise: true });
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  debug("start");

  const edge = spawn(EDGE_EXE, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    "--window-size=1366,900",
    "--disable-gpu",
    "--no-first-run",
    "--remote-allow-origins=*",
    "about:blank",
  ], { stdio: "ignore" });

  try {
    debug("waiting cdp");
    await waitForCdp();
    debug("creating target");
    const targetRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
    const target = await targetRes.json();
    debug(`target ${JSON.stringify(target).slice(0, 120)}`);
    const client = await cdp(target.webSocketDebuggerUrl);
    debug("connected");
    await client.send("Page.enable");
    await client.send("Runtime.enable");

    await navigate(client, `${BASE_URL}/login`);
    debug("login page");
    await screenshot(client, "01_login.png");

    await injectAuth(client, "admin@iuh.edu.vn", "123456");
    await navigate(client, `${BASE_URL}/`);
    await screenshot(client, "02_dashboard.png");
    await navigate(client, `${BASE_URL}/criteria`);
    await screenshot(client, "03_criteria_management.png");
    await navigate(client, `${BASE_URL}/reviews`);
    await screenshot(client, "04_review_screen.png");
    await navigate(client, `${BASE_URL}/nominations`);
    await screenshot(client, "05_nomination_management.png");
    await navigate(client, `${BASE_URL}/users`);
    await screenshot(client, "06_user_management.png");

    await injectAuth(client, "hoailoc0505@gmail.com", "123456");
    await navigate(client, `${BASE_URL}/nominations`);
    await screenshot(client, "07_create_nomination_upload.png");
    client.close();
    console.log(`Wrote screenshots to ${OUT_DIR}`);
  } finally {
    edge.kill();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { assertFileSignature } = require("../src/utils/fileSecurity");

test("accept valid pdf signature", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "thidua-test-"));
  const file = path.join(dir, "ok.pdf");
  fs.writeFileSync(file, Buffer.from("%PDF-1.4\n"));
  await assert.doesNotReject(() => assertFileSignature(file, ".pdf"));
});

test("reject invalid pdf signature", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "thidua-test-"));
  const file = path.join(dir, "bad.pdf");
  fs.writeFileSync(file, Buffer.from("MZ...."));
  await assert.rejects(() => assertFileSignature(file, ".pdf"));
});

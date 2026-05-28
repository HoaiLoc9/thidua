const fs = require("fs");
const crypto = require("crypto");
const net = require("net");

const CHUNK_SIZE = 64 * 1024;

const SIGNATURE_CHECKERS = {
  ".pdf": (buffer) => buffer.length >= 4 && buffer.slice(0, 4).toString() === "%PDF",
  ".png": (buffer) =>
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a,
  ".jpg": (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  ".jpeg": (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  ".zip": (buffer) =>
    buffer.length >= 4 &&
    ((buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) ||
      (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x05 && buffer[3] === 0x06) ||
      (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x07 && buffer[3] === 0x08)),
  ".docx": (buffer) =>
    SIGNATURE_CHECKERS[".zip"](buffer),
  ".xlsx": (buffer) =>
    SIGNATURE_CHECKERS[".zip"](buffer),
};

async function readHead(filePath, maxBytes = 16) {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
    return buffer.slice(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function assertFileSignature(filePath, extension) {
  const checker = SIGNATURE_CHECKERS[extension];
  if (!checker) return;
  const head = await readHead(filePath);
  if (!checker(head)) {
    const error = new Error(`Noi dung tep khong khop dinh dang ${extension}`);
    error.status = 400;
    throw error;
  }
}

async function calculateSHA256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function scanFileWithClamAV(filePath) {
  const host = process.env.CLAMAV_HOST || "127.0.0.1";
  const port = Number(process.env.CLAMAV_PORT || 3310);
  const timeoutMs = Number(process.env.CLAMAV_TIMEOUT_MS || 20000);

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let finished = false;
    let response = "";
    let stream = null;

    const finish = (result) => {
      if (finished) return;
      finished = true;
      if (stream) {
        stream.destroy();
      }
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);

    socket.on("timeout", () => finish({ status: "SCAN_ERROR", detail: "ClamAV timeout" }));
    socket.on("error", (err) => finish({ status: "SCAN_ERROR", detail: `ClamAV connection error: ${err.message}` }));
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
    });
    socket.on("end", () => {
      if (response.includes("FOUND")) {
        finish({ status: "INFECTED", detail: response.trim() });
        return;
      }
      if (response.includes("OK")) {
        finish({ status: "CLEAN", detail: "OK" });
        return;
      }
      finish({ status: "SCAN_ERROR", detail: response.trim() || "Unknown ClamAV response" });
    });

    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      stream = fs.createReadStream(filePath, { highWaterMark: CHUNK_SIZE });
      stream.on("error", (err) => finish({ status: "SCAN_ERROR", detail: `Read file error: ${err.message}` }));
      stream.on("data", (chunk) => {
        const length = Buffer.alloc(4);
        length.writeUInt32BE(chunk.length, 0);
        socket.write(length);
        socket.write(chunk);
      });
      stream.on("end", () => {
        const end = Buffer.alloc(4);
        end.writeUInt32BE(0, 0);
        socket.write(end);
      });
    });
  });
}

module.exports = {
  assertFileSignature,
  calculateSHA256,
  scanFileWithClamAV,
};

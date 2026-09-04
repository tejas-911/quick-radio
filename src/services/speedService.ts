import https from "https";

export interface InternetSpeedResult {
  downloadMbps: number;
  uploadMbps: number;
  timestamp: number;
}

export interface SessionDataUsage {
  downloadedBytes: number;
  uploadedBytes: number;
  totalBytesIn: number;
  totalBytesOut: number;
}

let cachedSpeed: InternetSpeedResult | undefined;
let isSpeedTestRunning = false;

/**
 * Measures actual internet download speed by streaming bytes from Cloudflare CDN.
 */
function measureDownloadSpeed(
  bytes = 3.5 * 1024 * 1024,
): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = `https://speed.cloudflare.com/__down?bytes=${bytes}`;
    const t0 = Date.now();
    let received = 0;

    const req = https.get(url, (res) => {
      res.on("data", (chunk) => {
        received += chunk.length;
      });
      res.on("end", () => {
        const durationSec = (Date.now() - t0) / 1000;
        if (durationSec > 0 && received > 0) {
          const mbps = (received * 8) / (durationSec * 1_000_000);
          resolve(Math.round(mbps * 10) / 10);
        } else {
          resolve(undefined);
        }
      });
    });

    req.on("error", () => resolve(undefined));
    req.setTimeout(3500, () => {
      req.destroy();
      resolve(undefined);
    });
  });
}

/**
 * Measures actual internet upload speed by sending a payload to Cloudflare CDN.
 */
function measureUploadSpeed(bytes = 1024 * 1024): Promise<number | undefined> {
  return new Promise((resolve) => {
    const payload = Buffer.alloc(bytes, "x");
    const t0 = Date.now();
    const options = {
      hostname: "speed.cloudflare.com",
      port: 443,
      path: "/__up",
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": payload.length,
      },
    };

    const req = https.request(options, (res) => {
      res.on("data", () => {});
      res.on("end", () => {
        const durationSec = (Date.now() - t0) / 1000;
        if (durationSec > 0) {
          const mbps = (bytes * 8) / (durationSec * 1_000_000);
          resolve(Math.round(mbps * 10) / 10);
        } else {
          resolve(undefined);
        }
      });
    });

    req.on("error", () => resolve(undefined));
    req.setTimeout(3500, () => {
      req.destroy();
      resolve(undefined);
    });
    req.write(payload);
    req.end();
  });
}

/**
 * Runs a fast, accurate internet speed test measuring download and upload speeds.
 */
export async function getInternetSpeed(
  force = false,
): Promise<InternetSpeedResult | undefined> {
  const now = Date.now();
  if (!force && cachedSpeed && now - cachedSpeed.timestamp < 120000) {
    return cachedSpeed;
  }

  if (isSpeedTestRunning && cachedSpeed) {
    return cachedSpeed;
  }

  isSpeedTestRunning = true;
  try {
    const [down, up] = await Promise.all([
      measureDownloadSpeed(),
      measureUploadSpeed(),
    ]);

    if (down !== undefined && up !== undefined) {
      cachedSpeed = {
        downloadMbps: down,
        uploadMbps: up,
        timestamp: Date.now(),
      };
      return cachedSpeed;
    }
    return cachedSpeed;
  } finally {
    isSpeedTestRunning = false;
  }
}

/**
 * Returns the currently cached speed result if still fresh (< 2 minutes).
 */
export function getCachedInternetSpeed(): InternetSpeedResult | undefined {
  if (cachedSpeed && Date.now() - cachedSpeed.timestamp < 120000) {
    return cachedSpeed;
  }
  return undefined;
}

/**
 * Tracks session baseline data usage for a specific Wi-Fi SSID connection.
 */
interface StoredBaseline {
  ssid: string;
  baselineIn: number;
  baselineOut: number;
}

let activeBaseline: StoredBaseline | undefined;

export function calculateSessionUsage(
  ssid: string | undefined,
  currentBytesIn: number,
  currentBytesOut: number,
): SessionDataUsage {
  if (!ssid || (currentBytesIn === 0 && currentBytesOut === 0)) {
    return {
      downloadedBytes: 0,
      uploadedBytes: 0,
      totalBytesIn: currentBytesIn,
      totalBytesOut: currentBytesOut,
    };
  }

  // If new network or baseline not set yet
  if (!activeBaseline || activeBaseline.ssid !== ssid) {
    activeBaseline = {
      ssid,
      baselineIn: 0,
      baselineOut: 0,
    };
  }

  const downloadedBytes = Math.max(
    0,
    currentBytesIn - activeBaseline.baselineIn,
  );
  const uploadedBytes = Math.max(
    0,
    currentBytesOut - activeBaseline.baselineOut,
  );

  return {
    downloadedBytes,
    uploadedBytes,
    totalBytesIn: currentBytesIn,
    totalBytesOut: currentBytesOut,
  };
}

export function formatGigaBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(2)} GB`;
}

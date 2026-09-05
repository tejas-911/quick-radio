import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// 1. Test formatBytes implementation
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let unitIndex = 0;
  let val = bytes;

  while (val >= 1024 && unitIndex < units.length - 1) {
    val /= 1024;
    unitIndex++;
  }

  if (unitIndex === 0) {
    return `${Math.round(val)} B`;
  }

  if (parseFloat(val.toFixed(2)) >= 1024 && unitIndex < units.length - 1) {
    val /= 1024;
    unitIndex++;
  }

  return `${val.toFixed(2)} ${units[unitIndex]}`;
}

console.log("--- Testing formatBytes ---");
assert.equal(formatBytes(0), "0 B");
assert.equal(formatBytes(-100), "0 B");
assert.equal(formatBytes(NaN), "0 B");
assert.equal(formatBytes(Infinity), "0 B");
assert.equal(formatBytes(500), "500 B");
assert.equal(formatBytes(1023), "1023 B");
assert.equal(formatBytes(1024), "1.00 KB");
assert.equal(formatBytes(1536), "1.50 KB");
assert.equal(formatBytes(1024 * 1024), "1.00 MB");
assert.equal(formatBytes(2.5 * 1024 * 1024), "2.50 MB");
assert.equal(formatBytes(1024 * 1024 * 1024), "1.00 GB");
assert.equal(formatBytes(5.75 * 1024 * 1024 * 1024), "5.75 GB");
assert.equal(formatBytes(1024 * 1024 * 1024 * 1024), "1.00 TB");
assert.equal(formatBytes(1023.999 * 1024), "1.00 MB"); // Bump boundary
console.log("✓ formatBytes tests passed!");

// 2. Test calculateSessionUsage with simulated Cache
class MockCache {
  constructor() {
    this.store = new Map();
  }
  get(key) {
    return this.store.get(key);
  }
  set(key, val) {
    this.store.set(key, String(val));
  }
  remove(key) {
    return this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

function createSessionCalculator(cache) {
  const LAST_SSID_KEY = "__active_ssid__";

  return function calculateSessionUsage(ssid, currentBytesIn, currentBytesOut) {
    if (!ssid || (currentBytesIn === 0 && currentBytesOut === 0)) {
      return {
        downloadedBytes: 0,
        uploadedBytes: 0,
        totalBytesIn: currentBytesIn,
        totalBytesOut: currentBytesOut,
      };
    }

    const now = Date.now();
    let baseline;

    const lastActiveSsid = cache.get(LAST_SSID_KEY);
    const cachedStr = cache.get(ssid);
    if (cachedStr) {
      try {
        baseline = JSON.parse(cachedStr);
      } catch {
        baseline = undefined;
      }
    }

    const isSsidSwitched =
      lastActiveSsid !== undefined && lastActiveSsid !== ssid;
    const countersWrapped =
      baseline !== undefined &&
      (currentBytesIn < baseline.baselineIn ||
        currentBytesOut < baseline.baselineOut);

    if (!baseline || isSsidSwitched || countersWrapped) {
      baseline = {
        ssid,
        baselineIn: currentBytesIn,
        baselineOut: currentBytesOut,
        firstObservedTime: now,
        lastUpdatedTime: now,
      };
      cache.set(ssid, JSON.stringify(baseline));
    } else {
      baseline.lastUpdatedTime = now;
      cache.set(ssid, JSON.stringify(baseline));
    }

    cache.set(LAST_SSID_KEY, ssid);

    const downloadedBytes = Math.max(0, currentBytesIn - baseline.baselineIn);
    const uploadedBytes = Math.max(0, currentBytesOut - baseline.baselineOut);

    return {
      downloadedBytes,
      uploadedBytes,
      totalBytesIn: currentBytesIn,
      totalBytesOut: currentBytesOut,
    };
  };
}

console.log("--- Testing calculateSessionUsage Cache behavior ---");
const sharedCache = new MockCache();

// Launch 1: First connection to MyHomeNet
const calc1 = createSessionCalculator(sharedCache);
const res1 = calc1("MyHomeNet", 10_000_000, 2_000_000);
assert.equal(res1.downloadedBytes, 0, "First launch delta should be 0");
assert.equal(res1.uploadedBytes, 0, "First launch delta should be 0");
assert.equal(res1.totalBytesIn, 10_000_000);
assert.equal(res1.totalBytesOut, 2_000_000);

// Launch 2 (Raycast closed and reopened 5 mins later, same SSID, data transferred)
const calc2 = createSessionCalculator(sharedCache);
const res2 = calc2("MyHomeNet", 25_000_000, 5_000_000);
assert.equal(res2.downloadedBytes, 15_000_000, "Delta must be preserved across launches!");
assert.equal(res2.uploadedBytes, 3_000_000, "Delta must be preserved across launches!");
assert.equal(res2.totalBytesIn, 25_000_000);
assert.equal(res2.totalBytesOut, 5_000_000);

// Launch 3: User switches to CoffeeShop
const calc3 = createSessionCalculator(sharedCache);
const res3 = calc3("CoffeeShop", 30_000_000, 6_000_000);
assert.equal(res3.downloadedBytes, 0, "Delta should reset when switching to new SSID");
assert.equal(res3.uploadedBytes, 0, "Delta should reset when switching to new SSID");
assert.equal(res3.totalBytesIn, 30_000_000);
assert.equal(res3.totalBytesOut, 6_000_000);

// Launch 4: CoffeeShop accumulates data
const calc4 = createSessionCalculator(sharedCache);
const res4 = calc4("CoffeeShop", 35_000_000, 7_000_000);
assert.equal(res4.downloadedBytes, 5_000_000);
assert.equal(res4.uploadedBytes, 1_000_000);

// Launch 5: Counter wrap / reboot scenario
const calc5 = createSessionCalculator(sharedCache);
const res5 = calc5("CoffeeShop", 500_000, 100_000); // counters dropped below baseline
assert.equal(res5.downloadedBytes, 0, "Delta should reset on counter wrap");
assert.equal(res5.uploadedBytes, 0, "Delta should reset on counter wrap");
assert.equal(res5.totalBytesIn, 500_000);
assert.equal(res5.totalBytesOut, 100_000);
console.log("✓ calculateSessionUsage Cache tests passed!");

// 3. Test Windows netsh parser
function parseSubinterfaceBytes(output, ifaceName) {
  try {
    const lines = output.split("\n").map((l) => l.trim());
    const targetIfaceLower = ifaceName.toLowerCase();
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 5) {
        const lineIface = parts.slice(4).join(" ").toLowerCase();
        if (
          lineIface === targetIfaceLower ||
          lineIface.includes(targetIfaceLower) ||
          (targetIfaceLower.includes("wi-fi") && lineIface.includes("wi-fi"))
        ) {
          const bytesIn = parseInt(parts[2], 10);
          const bytesOut = parseInt(parts[3], 10);
          if (!isNaN(bytesIn) && !isNaN(bytesOut)) {
            return { bytesIn, bytesOut };
          }
        }
      }
    }
  } catch {
    // Return undefined on parsing failure
  }
  return undefined;
}

console.log("--- Testing Windows netsh parser ---");
const sampleIpv4 = `
       MTU  MediaSenseState      Bytes In     Bytes Out  Interface
----------  ---------------  ------------  ------------  -------------
4294967295                1             0         69231  Loopback Pseudo-Interface 1
      1500                1    4309730893    4402268540  Wi-Fi
      1500                5             0             0  Ethernet
`;
const sampleIpv6 = `
       MTU  MediaSenseState      Bytes In     Bytes Out  Interface
----------  ---------------  ------------  ------------  -------------
4294967295                1             0         59841  Loopback Pseudo-Interface 1
      1500                1         14658         77987  Wi-Fi
      1500                5             0           152  Ethernet
`;

const v4Counters = parseSubinterfaceBytes(sampleIpv4, "Wi-Fi");
assert.deepEqual(v4Counters, { bytesIn: 4309730893, bytesOut: 4402268540 });

const v6Counters = parseSubinterfaceBytes(sampleIpv6, "Wi-Fi");
assert.deepEqual(v6Counters, { bytesIn: 14658, bytesOut: 77987 });

const totalIn = v4Counters.bytesIn + v6Counters.bytesIn;
const totalOut = v4Counters.bytesOut + v6Counters.bytesOut;
assert.equal(totalIn, 4309745551);
assert.equal(totalOut, 4402346527);
console.log("✓ Windows netsh parser tests passed!");

// 4. Test macOS netstat parser
function parseNetstatBytes(output, device) {
  try {
    const lines = output
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return undefined;

    const header = lines[0].split(/\s+/);
    let ibytesIdx = header.findIndex((h) => /^ibytes$/i.test(h));
    let obytesIdx = header.findIndex((h) => /^obytes$/i.test(h));

    if (ibytesIdx === -1 || obytesIdx === -1) {
      ibytesIdx = 6;
      obytesIdx = 9;
    }

    const deviceLower = device.toLowerCase();

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/\s+/);
      if (parts.length > Math.max(ibytesIdx, obytesIdx)) {
        const lineDev = parts[0].toLowerCase();
        if (lineDev === deviceLower || lineDev.startsWith(deviceLower)) {
          if (parts.some((p) => p.includes("<Link"))) {
            const bytesIn = parseInt(parts[ibytesIdx], 10);
            const bytesOut = parseInt(parts[obytesIdx], 10);
            if (!isNaN(bytesIn) && !isNaN(bytesOut)) {
              return { bytesIn, bytesOut };
            }
          }
        }
      }
    }

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/\s+/);
      if (parts.length > Math.max(ibytesIdx, obytesIdx)) {
        const lineDev = parts[0].toLowerCase();
        if (lineDev === deviceLower || lineDev.startsWith(deviceLower)) {
          const bytesIn = parseInt(parts[ibytesIdx], 10);
          const bytesOut = parseInt(parts[obytesIdx], 10);
          if (!isNaN(bytesIn) && !isNaN(bytesOut)) {
            return { bytesIn, bytesOut };
          }
        }
      }
    }
  } catch {
    // Netstat parse error fallback
  }

  return undefined;
}

console.log("--- Testing macOS netstat parser ---");
const sampleMacNetstat = `
Name  Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll
en0   1500  <Link#14>     38:f9:d3:a1:b2:c3 234123     0  987654321   123456     0   12345678     0
en0   1500  fe80::1%en0   fe80::...         234123     -  987654321   123456     -   12345678     -
en0   1500  192.168.1     192.168.1.50      234123     -  987654321   123456     -   12345678     -
`;

const macCounters = parseNetstatBytes(sampleMacNetstat, "en0");
assert.deepEqual(macCounters, { bytesIn: 987654321, bytesOut: 12345678 });
console.log("✓ macOS netstat parser tests passed!");

// 5. Test Live Windows Netsh execution (since we are on Windows)
if (process.platform === "win32") {
  console.log("--- Testing Live Windows Netsh execution ---");
  const { stdout: v4Out } = await execFileAsync("netsh", ["interface", "ipv4", "show", "subinterfaces"]);
  const { stdout: v6Out } = await execFileAsync("netsh", ["interface", "ipv6", "show", "subinterfaces"]);
  
  const liveV4 = parseSubinterfaceBytes(v4Out, "Wi-Fi");
  const liveV6 = parseSubinterfaceBytes(v6Out, "Wi-Fi");
  console.log("Live Wi-Fi IPv4 counters:", liveV4);
  console.log("Live Wi-Fi IPv6 counters:", liveV6);
  assert(liveV4 !== undefined, "Live IPv4 Wi-Fi counters should be parsed");
  assert(typeof liveV4.bytesIn === "number" && liveV4.bytesIn > 0, "Bytes In should be > 0");
  assert(typeof liveV4.bytesOut === "number" && liveV4.bytesOut > 0, "Bytes Out should be > 0");
  console.log("✓ Live Windows Netsh query verified successfully!");
}

console.log("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉");

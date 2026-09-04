export function generateWifiQrString(
  ssid: string,
  password?: string,
  authentication = "WPA",
): string {
  const auth =
    !password || authentication.toLowerCase().includes("open")
      ? "nopass"
      : "WPA";
  const escapedSsid = ssid.replace(/([\\;,:"])/g, "\\$1");
  const escapedPassword = password
    ? password.replace(/([\\;,:"])/g, "\\$1")
    : "";
  return `WIFI:T:${auth};S:${escapedSsid};P:${escapedPassword};;`;
}

export function getWifiQrCodeImageUrl(wifiQrString: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=2&data=${encodeURIComponent(wifiQrString)}`;
}

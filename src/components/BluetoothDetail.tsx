import { Color, Icon, List } from "@raycast/api";
import { BluetoothDevice } from "../services/types";

interface BluetoothDetailProps {
  device: BluetoothDevice;
}

const CONNECTED_BADGE =
  "![Connected](data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMCAyMCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ij48Y2lyY2xlIGN4PSIxMCIgY3k9IjEwIiByPSI5IiBmaWxsPSIjMzBEMTU4Ii8+PHBhdGggZD0iTTYgMTAuNWwzIDMgNS02IiBzdHJva2U9IiNGRkZGRkYiIHN0cm9rZS13aWR0aD0iMi4yIiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L3N2Zz4=)";

export function BluetoothDetail({ device }: BluetoothDetailProps) {
  const categoryLabel = getCategoryLabel(device.category);

  let markdown = `## ${device.name}\n\n`;
  markdown += `**Type**: ${categoryLabel}  \n`;
  markdown += `**State**: ${device.isConnected ? `${CONNECTED_BADGE} **Connected**` : "⚪ **Disconnected**"}  \n`;

  if (device.address) {
    markdown += `**Bluetooth Address**: \`${device.address}\`  \n`;
  }

  if (device.batteryPercent !== undefined) {
    markdown += `**Battery**: 🔋 ${device.batteryPercent}%  \n`;
  }

  markdown += `\n---\n*Press **Enter** to ${device.isConnected ? "disconnect" : "connect"} this device.*`;

  return (
    <List.Item.Detail
      markdown={markdown}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label
            title="Device Name"
            text={device.name}
          />
          <List.Item.Detail.Metadata.Label
            title="Category"
            text={categoryLabel}
          />
          {device.address && (
            <List.Item.Detail.Metadata.Label
              title="MAC Address"
              text={device.address}
            />
          )}
          {device.batteryPercent !== undefined && (
            <List.Item.Detail.Metadata.Label
              title="Battery"
              text={`${device.batteryPercent}%`}
            />
          )}
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.TagList title="Status">
            <List.Item.Detail.Metadata.TagList.Item
              icon={{
                source: device.isConnected ? Icon.CheckCircle : Icon.Circle,
                tintColor: device.isConnected
                  ? Color.Green
                  : Color.SecondaryText,
              }}
              text={device.isConnected ? "Connected" : "Paired"}
              color={device.isConnected ? Color.Green : Color.SecondaryText}
            />
          </List.Item.Detail.Metadata.TagList>
        </List.Item.Detail.Metadata>
      }
    />
  );
}

function getCategoryLabel(category: BluetoothDevice["category"]): string {
  switch (category) {
    case "audio":
      return "🎧 Audio / Headphones";
    case "controller":
      return "🎮 Game Controller";
    case "peripheral":
      return "⌨️ Mouse & Keyboard";
    case "phone":
      return "📱 Phone / Mobile";
    default:
      return "🔌 Bluetooth Device";
  }
}

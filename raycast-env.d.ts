/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `wifi` command */
  export type Wifi = ExtensionPreferences & {}
  /** Preferences accessible in the `bluetooth` command */
  export type Bluetooth = ExtensionPreferences & {}
  /** Preferences accessible in the `toggle-wifi` command */
  export type ToggleWifi = ExtensionPreferences & {}
  /** Preferences accessible in the `toggle-bluetooth` command */
  export type ToggleBluetooth = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `wifi` command */
  export type Wifi = {}
  /** Arguments passed to the `bluetooth` command */
  export type Bluetooth = {}
  /** Arguments passed to the `toggle-wifi` command */
  export type ToggleWifi = {}
  /** Arguments passed to the `toggle-bluetooth` command */
  export type ToggleBluetooth = {}
}


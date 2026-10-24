import type { OSPathBase, PathProvider } from "./paths";

/**
 * macOS locations (mORTEX). Interface :
 * - `appSupport` : ~/Library/Application Support
 * - `caches` : ~/Library/Caches
 * - `logs` : ~/Library/Logs
 * @public */
export const DarwinPath = {
  appSupport: "appSupport",
  caches: "caches",
  logs: "logs",
} as const;

/** @public */
export type DarwinPathBase = OSPathBase | (typeof DarwinPath)[keyof typeof DarwinPath];

/** @public */
export interface IDarwinPathProvider extends PathProvider<DarwinPathBase> {
  readonly platform: "darwin";
}

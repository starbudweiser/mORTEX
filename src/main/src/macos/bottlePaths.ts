/**
 * mORTEX (macOS) : redirection de `documents` et `localAppData` vers la
 * bouteille Wine qui contient le jeu.
 *
 * Lit `<userData>/bottles.json` (clé `userDir` = drive_c/users/<user>, écrite
 * par le renderer, util/macos/bottles.ts). Renvoie undefined hors darwin ou
 * tant que le fichier n'existe pas (premier lancement : relancer une fois).
 */
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

export function bottleUserPath(
  userData: string,
  id: "documents" | "localAppData",
): string | undefined {
  if (process.platform !== "darwin") return undefined;
  try {
    const { userDir } = JSON.parse(readFileSync(path.join(userData, "bottles.json"), "utf8")) as {
      userDir?: unknown;
    };
    const sub = id === "documents" ? "Documents" : path.join("AppData", "Local");
    const dir = typeof userDir === "string" ? path.join(userDir, sub) : undefined;
    return dir !== undefined && existsSync(dir) ? dir : undefined;
  } catch {
    return undefined;
  }
}

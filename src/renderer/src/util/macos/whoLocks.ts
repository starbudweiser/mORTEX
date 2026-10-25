/**
 * mORTEX (macOS) : processus qui ouvrent un fichier.
 *
 * Interface :
 *  - whoLocks(filePath): IProcessInfo[]       { appName, pid } ; sur macOS via `lsof`, ailleurs wholocks
 *  - parseLsof(output): IProcessInfo[]        analyse de `lsof -F pc` (exposée pour les tests)
 *
 * wholocks n'a pas de version darwin (« Platform not supported »).
 */
import { execFileSync } from "node:child_process";

export interface IProcessInfo {
  appName: string;
  pid: number;
}

/** sortie de `lsof -F pc` : lignes « p<pid> » puis « c<commande> » */
export function parseLsof(output: string): IProcessInfo[] {
  const result: IProcessInfo[] = [];
  let pid: number | undefined;
  for (const line of output.split("\n")) {
    if (line.startsWith("p")) {
      pid = Number(line.slice(1));
    } else if (line.startsWith("c") && pid !== undefined && !Number.isNaN(pid)) {
      result.push({ appName: line.slice(1), pid });
      pid = undefined;
    }
  }
  return result;
}

export function whoLocks(filePath: string): IProcessInfo[] {
  if (process.platform === "darwin") {
    try {
      return parseLsof(
        execFileSync("/usr/sbin/lsof", ["-F", "pc", "--", filePath], {
          encoding: "utf8",
          timeout: 5000,
        }),
      );
    } catch {
      // lsof sort avec le code 1 quand aucun processus n'ouvre le fichier
      return [];
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("wholocks").default(filePath) as IProcessInfo[];
}

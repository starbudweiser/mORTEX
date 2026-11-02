import { readFile } from "fs/promises";
import path from "path";

import iconv from "iconv-lite";
import { parseStringPromise } from "xml2js";

import { log } from "../../../util/log";
import type { IChoices } from "../types/interface";

/**
 * The FOMOD engine finds the author's recorded choices again by exact step, group and option
 * name (the `idx` is only used by the dialog). When a collection pins choices recorded for one
 * version of a mod but a newer one is installed ("prefer"/"latest" update policy), a step or a
 * group that was merely renamed ("Race Compatability" -> "Race Compatibility Version") no longer
 * matches: its recorded choices are ignored and the engine falls back to the first option of
 * every "select exactly one" group. This module rewrites the recorded names to the ones of the
 * installer that is actually about to run, so the engine can find them.
 */

export interface IGroupStructure {
  name: string;
  options: string[];
}

export interface IStepStructure {
  name: string;
  groups: IGroupStructure[];
}

type ChoiceStep = NonNullable<IChoices>[number];
type ChoiceGroup = ChoiceStep["groups"][number];
type Choice = ChoiceGroup["choices"][number];

// a step or group name is taken for a rename of another when it contains it, whole words only,
// and at least this share of the longer name is the shorter one
const MIN_NAME_SCORE = 0.6;

const tokenize = (name: string): string[] =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; ++i) {
    const row = [i];
    for (let j = 1; j <= b.length; ++j) {
      row.push(
        Math.min(
          previous[j] + 1,
          row[j - 1] + 1,
          previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        ),
      );
    }
    previous = row;
  }
  return previous[b.length];
}

// same word, give or take a typo ("compatability" / "compatibility"); short words must be equal
function sameToken(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }
  const longest = Math.max(a.length, b.length);
  return Math.min(a.length, b.length) >= 5 && levenshtein(a, b) <= Math.max(1, longest >> 3);
}

/**
 * 1 when both names say the same words (case, punctuation and typos aside), less when the
 * shorter one only sits whole inside the longer, 0 otherwise.
 */
export function nameScore(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (short.length === 0) {
    return 0;
  }
  for (let from = 0; from + short.length <= long.length; ++from) {
    if (short.every((token, i) => sameToken(token, long[from + i]))) {
      return short.length / long.length;
    }
  }
  return 0;
}

/**
 * One-to-one pairing of the best matching names, most similar first. A pair is only made when
 * it is the unambiguous best for both sides; ties are left unpaired rather than guessed.
 * Returns left index -> right index.
 */
function pairByName(left: string[], right: string[]): Map<number, number> {
  const pairs = new Map<number, number>();
  const freeLeft = new Set(left.keys());
  const freeRight = new Set(right.keys());
  for (;;) {
    const scored: Array<{ l: number; r: number; score: number }> = [];
    freeLeft.forEach((l) =>
      freeRight.forEach((r) => {
        const score = nameScore(left[l], right[r]);
        if (score >= MIN_NAME_SCORE) {
          scored.push({ l, r, score });
        }
      }),
    );
    const top = Math.max(0, ...scored.map((s) => s.score));
    const best = scored.filter((s) => s.score === top);
    const unique = best.filter(
      (s) =>
        best.filter((o) => o.l === s.l).length === 1 &&
        best.filter((o) => o.r === s.r).length === 1,
    );
    if (unique.length === 0) {
      return pairs;
    }
    unique.forEach(({ l, r }) => {
      pairs.set(l, r);
      freeLeft.delete(l);
      freeRight.delete(r);
    });
  }
}

// index of the option a recorded choice stands for, -1 when the installer has no such option
function resolveOption(name: string, options: string[]): number {
  const exact = options.indexOf(name);
  if (exact >= 0) {
    return exact;
  }
  const similar = options.map((_, i) => i).filter((i) => nameScore(name, options[i]) === 1);
  return similar.length === 1 ? similar[0] : -1;
}

function resolveChoices(recorded: ChoiceGroup[], target: IGroupStructure): Choice[] {
  const resolved = new Map<number, Choice>();
  recorded.forEach((group) =>
    group.choices.forEach((choice) => {
      const idx = resolveOption(choice.name, target.options);
      if (idx >= 0) {
        resolved.set(idx, { name: target.options[idx], idx });
      }
    }),
  );
  return Array.from(resolved.values());
}

// recorded groups that no group of the installer carries the name of, paired with the groups
// of the installer that no recorded group carries the name of
function pairGroups(
  recorded: ChoiceGroup[],
  actual: IGroupStructure[],
): Map<IGroupStructure, ChoiceGroup> {
  const recordedNames = new Set(recorded.map((g) => g.name));
  const actualNames = new Set(actual.map((g) => g.name));
  const orphanRecorded = recorded.filter((g) => !actualNames.has(g.name));
  const orphanActual = actual.filter((g) => !recordedNames.has(g.name));
  const result = new Map<IGroupStructure, ChoiceGroup>();
  pairByName(
    orphanRecorded.map((g) => g.name),
    orphanActual.map((g) => g.name),
  ).forEach((r, l) => result.set(orphanActual[r], orphanRecorded[l]));

  // a group renamed beyond recognition ("Version" -> "Version (Select Your Installed Version)")
  // is still found when it is the only one left on both sides and its recorded choices all
  // exist among its options
  const left = orphanRecorded.filter((g) => !Array.from(result.values()).includes(g));
  const right = orphanActual.filter((g) => !result.has(g));
  if (left.length === 1 && right.length === 1) {
    const choices = resolveChoices(left, right[0]);
    if (choices.length > 0 && choices.length === left[0].choices.length) {
      result.set(right[0], left[0]);
    }
  }
  return result;
}

interface IRemap {
  step: string;
  group: string;
  choices: string[];
}

/**
 * Groups to add to the recorded choices so the engine finds them in this step. `whole` also
 * lists the groups that already match by name (the step itself is new to the record).
 */
function adaptStep(
  actual: IStepStructure,
  recorded: ChoiceGroup[],
  whole: boolean,
  remaps: IRemap[],
): ChoiceGroup[] {
  const renamed = pairGroups(recorded, actual.groups);
  return actual.groups.flatMap((group): ChoiceGroup[] => {
    const sources = renamed.has(group)
      ? [renamed.get(group)]
      : recorded.filter((g) => g.name === group.name);
    if (sources.length === 0) {
      return [];
    }
    const choices = resolveChoices(sources, group);
    const recordedNames = sources.flatMap((g) => g.choices.map((c) => c.name));
    const adapted = renamed.has(group) || choices.some((c) => !recordedNames.includes(c.name));
    if (!adapted && !whole) {
      return [];
    }
    if (adapted) {
      remaps.push({ step: actual.name, group: group.name, choices: choices.map((c) => c.name) });
    }
    return [{ name: group.name, choices }];
  });
}

export interface IReconciled {
  choices: IChoices;
  remaps: IRemap[];
}

/**
 * Rewrite the recorded choices so that every step, group and option of the installer finds
 * its recorded counterpart by exact name, whatever was renamed since the choices were recorded.
 * Nothing is added for what has no counterpart: the engine then applies its own defaults.
 */
export function reconcileChoices(recorded: IChoices, structure: IStepStructure[]): IReconciled {
  if (!Array.isArray(recorded) || recorded.length === 0) {
    return { choices: recorded, remaps: [] };
  }
  const remaps: IRemap[] = [];
  const out: ChoiceStep[] = recorded.map((step) => ({ ...step, groups: [...step.groups] }));

  const recordedNames = new Set(recorded.map((s) => s.name));
  const actualNames = new Set(structure.map((s) => s.name));
  const orphanRecorded = recorded.filter((s) => !actualNames.has(s.name));
  const orphanActual = structure.filter((s) => !recordedNames.has(s.name));
  const renamed = pairByName(
    orphanRecorded.map((s) => s.name),
    orphanActual.map((s) => s.name),
  );
  const additions: ChoiceStep[] = [];

  // adapt everything against the choices as recorded, then add the result
  const sameNamed = structure.flatMap((step) => {
    const entries = out.filter((s) => s.name === step.name);
    const groups =
      entries.length > 0
        ? adaptStep(
            step,
            entries.flatMap((s) => s.groups),
            false,
            remaps,
          )
        : [];
    return groups.length > 0 ? [{ entry: entries[0], groups }] : [];
  });
  sameNamed.forEach(({ entry, groups }) => entry.groups.push(...groups));
  renamed.forEach((r, l) => {
    const source = orphanRecorded[l];
    const target = orphanActual[r];
    const groups = adaptStep(target, source.groups, true, remaps);
    if (groups.length > 0) {
      additions.push({ name: target.name, groups });
    }
  });

  if (remaps.length === 0 && additions.length === 0) {
    return { choices: recorded, remaps };
  }
  return { choices: [...out, ...additions], remaps };
}

// ---- reading the installer's structure -------------------------------------------------------

function decode(data: Buffer): string {
  const bom16 = (data[0] === 0xff && data[1] === 0xfe) || (data[0] === 0xfe && data[1] === 0xff);
  if (bom16) {
    return iconv.decode(data, "utf-16");
  }
  const bom8 = data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf;
  return data.subarray(bom8 ? 3 : 0).toString("utf8");
}

const attr = (node: any): string | undefined => node?.$?.name;

/** Step, group and option names of a fomod/ModuleConfig.xml; undefined if it isn't one. */
export async function parseStructure(xml: string): Promise<IStepStructure[] | undefined> {
  const doc = await parseStringPromise(xml);
  const steps: any[] | undefined = doc?.config?.installSteps?.[0]?.installStep;
  if (!Array.isArray(steps)) {
    return undefined;
  }
  return steps.map((step) => ({
    name: attr(step) ?? "",
    groups: (step.optionalFileGroups?.[0]?.group ?? []).map((group: any) => ({
      name: attr(group) ?? "",
      options: (group.plugins?.[0]?.plugin ?? []).map((plugin: any) => attr(plugin) ?? ""),
    })),
  }));
}

function findModuleConfig(files: string[]): string | undefined {
  return files
    .filter(
      (file) =>
        path.basename(file).toLowerCase() === "moduleconfig.xml" &&
        path.basename(path.dirname(file)).toLowerCase() === "fomod",
    )
    .sort((lhs, rhs) => lhs.split(/[\\/]/).length - rhs.split(/[\\/]/).length)[0];
}

/**
 * Recorded choices adapted to the installer found in `installDir`. Any problem reading or
 * understanding the installer leaves the choices as they were.
 */
export async function adaptChoicesToInstaller(
  files: string[],
  installDir: string,
  recorded: IChoices,
): Promise<IChoices> {
  try {
    const script = findModuleConfig(files.map((file) => file.replace(/\\/g, path.sep)));
    if (script === undefined || !Array.isArray(recorded)) {
      return recorded;
    }
    const structure = await parseStructure(decode(await readFile(path.join(installDir, script))));
    if (structure === undefined) {
      return recorded;
    }
    const { choices, remaps } = reconcileChoices(recorded, structure);
    if (remaps.length > 0) {
      log("info", "FOMOD choices adapted to the installer version in use", { script, remaps });
    }
    return choices;
  } catch (err) {
    log("warn", "Could not match the recorded FOMOD choices to the installer", {
      error: (err as Error).message,
    });
    return recorded;
  }
}

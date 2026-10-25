/**
 * mORTEX : une ligne de `crash_events.jsonl` (export de sKYCRASH, contrat `schema` 1).
 * Tolérant sur les champs facultatifs, strict sur le `schema` : un schéma inconnu est ignoré,
 * jamais interprété de travers.
 */
import type { CrashEvent } from "@vortex/shared/ipc";
import { z } from "zod";

const optionalText = z
  .string()
  .nullish()
  .transform((value) => value ?? null);

const suspectSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["dll", "plugin", "object", "mod", "env"]),
  score: z.number().catch(0),
  reasons: z.array(z.string()).catch([]),
});

const eventSchema = z.object({
  schema: z.literal(1),
  crash_time: z.string().min(1),
  log_name: z.string().min(1),
  game_runtime: optionalText,
  skse_runtime: optionalText,
  verdict: optionalText,
  // Un suspect isolé d'un `kind` inconnu ne doit pas faire perdre tout le plantage.
  suspects: z
    .array(z.unknown())
    .catch([])
    .transform((list) =>
      list.flatMap((item) => {
        const parsed = suspectSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
  plugins_hash: optionalText,
  bottle: optionalText,
});

export type ParsedLine = { event: CrashEvent } | { skipped: true };

/** Lit une ligne ; `undefined` pour une ligne vide. */
export function parseCrashLine(line: string): ParsedLine | undefined {
  const trimmed = line.trim();
  if (trimmed === "") {
    return undefined;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return { skipped: true };
  }
  const parsed = eventSchema.safeParse(raw);
  return parsed.success ? { event: parsed.data } : { skipped: true };
}

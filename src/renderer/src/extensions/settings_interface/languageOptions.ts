import type { IExtensionDownloadInfo } from "../../types/extensions";

export interface ILanguage {
  key: string;
  displayName: string;
  ext: Array<Partial<IExtensionDownloadInfo>>;
  /** mORTEX : avancement de sa propre traduction, en %, tant qu'elle n'est pas finie */
  progress?: number;
}

/**
 * A single selectable language entry. The `Picker` is keyed purely by value, so we
 * flatten the languages-with-extensions structure into one entry per option and key it
 * by a composite `id` (a language may be provided by more than one extension, giving
 * several options that share the same `key`). `extName` carries what the old
 * `<option data-ext>` did — the extension to install on selection.
 */
export interface ILanguageOption {
  id: string;
  key: string;
  extName?: string;
  label: string;
}

/**
 * Flatten `languages` into one `ILanguageOption` per selectable entry, mirroring the
 * option set the old react-bootstrap `<select>` produced: a language with fewer than two
 * extensions yields a single option (using its first ext if present), otherwise one
 * option per extension. Each option carries a composite `id` so same-key entries stay
 * distinct, and `extName` so selection can trigger the extension install as before.
 */
export function buildLanguageOptions(
  languages: ILanguage[],
  t: (input: string, options?: Record<string, unknown>) => string,
): ILanguageOption[] {
  const nameOf = (language: ILanguage) =>
    language.progress !== undefined && language.progress < 100
      ? `${language.displayName} — ${t("translation in progress, {{percent}}%", { replace: { percent: language.progress } })}`
      : language.displayName;

  const optionFor = (
    language: ILanguage,
    ext: Partial<IExtensionDownloadInfo>,
  ): ILanguageOption => ({
    id: `${language.key}::${ext.name ?? "local"}`,
    key: language.key,
    extName: ext.name,
    label:
      ext.modId !== undefined
        ? `${language.displayName} (${t("Extension")} by ${ext["author"] || "unknown author"})`
        : nameOf(language),
  });

  return languages.reduce<ILanguageOption[]>((prev, language) => {
    if (language.ext.length < 2) {
      prev.push(
        optionFor(language, language.ext.length > 0 ? language.ext[0] : { name: undefined }),
      );
    } else {
      language.ext.forEach((ext) => prev.push(optionFor(language, ext)));
    }
    return prev;
  }, []);
}

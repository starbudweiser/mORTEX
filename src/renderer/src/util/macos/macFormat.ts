/**
 * mORTEX (macOS) : nombres affichés dans la langue de l'interface (séparateur de milliers et
 * décimale), pour les compteurs et les tailles des écrans ajoutés par mORTEX.
 *
 *  - formatNumber(value, options?): string   1284 -> « 1 284 » (fr), « 1,284 » (en)
 */
import { getCurrentLanguage } from "../i18n";

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  const language = getCurrentLanguage();
  try {
    return new Intl.NumberFormat(language, options).format(value);
  } catch {
    // langue inconnue d'Intl : repli sur celle du système
    return new Intl.NumberFormat(undefined, options).format(value);
  }
}

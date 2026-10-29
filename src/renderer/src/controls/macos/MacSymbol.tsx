/**
 * mORTEX (macOS) : un symbole SF officiel (chevron.down…), fourni par le système via le
 * processus principal, teinté à la couleur du texte. Rien ne s'affiche là où il n'existe pas.
 */
import React, { useEffect, useState } from "react";

const cache = new Map<string, Promise<string | undefined>>();

const load = (name: string) => {
  let pending = cache.get(name);
  if (pending === undefined) {
    pending = window.api?.menu?.symbol?.(name).catch(() => undefined) ?? Promise.resolve(undefined);
    cache.set(name, pending);
  }
  return pending;
};

/** vrai là où les symboles SF existent (macOS) */
export const hasMacSymbols = () => window.api?.menu?.symbol !== undefined;

export const MacSymbol = ({ name, size = 14 }: { name: string; size?: number }) => {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void load(name).then((found) => live && setUrl(found));
    return () => {
      live = false;
    };
  }, [name]);
  return (
    <span
      aria-hidden
      className="mortex-mac-symbol"
      style={{
        width: size,
        height: size,
        maskImage: url === undefined ? undefined : `url(${url})`,
      }}
    />
  );
};

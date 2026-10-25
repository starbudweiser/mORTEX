import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";

import {
  bySeverity,
  type ExistingActionId,
  type IExplanationItem,
  LOOT_ATTRIBUTION_URL,
  LOOT_LICENSE_URL,
  needsLootAttribution,
} from "./explain/types";

export interface IAssistantPanelProps {
  title: string;
  items: IExplanationItem[];
  /** Les actions sont celles que mORTEX a déjà ; le panneau ne fait que les proposer. */
  onAction?: (id: ExistingActionId) => void;
  /** Ajoute la remarque « les messages LOOT ne se mettent à jour qu'au tri ». */
  lootSortNote?: boolean;
  onOpenUrl?: (url: string) => void;
}

const Item = ({
  item,
  onAction,
  onOpenUrl,
}: {
  item: IExplanationItem;
  onAction?: IAssistantPanelProps["onAction"];
  onOpenUrl?: IAssistantPanelProps["onOpenUrl"];
}) => {
  const { t } = useTranslation(["common"]);
  const [open, setOpen] = useState(false);
  const quote = typeof item.params.quote === "string" ? item.params.quote : undefined;
  return (
    <li className={`mortex-assistant-item mortex-assistant-${item.severity}`}>
      <div className="mortex-assistant-head">
        <span className="mortex-assistant-dot" aria-hidden="true" />
        <strong>{t(item.titleKey, item.params)}</strong>
      </div>
      <p className="mortex-assistant-text">{t(item.textKey, item.params)}</p>
      {quote !== undefined && <blockquote className="mortex-assistant-quote">{quote}</blockquote>}
      {item.details !== undefined && (
        <ul className="mortex-assistant-details">
          {item.details.map((d, i) => (
            <li key={i} className={`mortex-assistant-${d.severity ?? "info"}`}>
              {t(d.textKey, { ...d.params, label: t(String(d.params.label ?? "")) })}
            </li>
          ))}
        </ul>
      )}
      <div className="mortex-assistant-foot">
        {item.sources.length > 0 && (
          <button
            className="mortex-assistant-toggle"
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? t("Hide sources") : t("Sources")}
          </button>
        )}
        {(item.actions ?? []).map((action) => (
          <Button
            key={action.id}
            appearance="moderate"
            brand="neutral"
            size="sm"
            onClick={() => onAction?.(action.id)}
          >
            {t(action.labelKey)}
          </Button>
        ))}
      </div>
      {open && (
        <ul className="mortex-assistant-sources">
          {item.sources.map((s, i) => (
            <li key={i}>
              {t(s.label)}
              {s.detail !== undefined && s.detail !== "" && ` · ${s.detail}`}
              {s.url !== undefined && onOpenUrl !== undefined && (
                <>
                  {" · "}
                  <a
                    href={s.url}
                    onClick={(e) => {
                      e.preventDefault();
                      onOpenUrl(s.url!);
                    }}
                  >
                    {t("Open")}
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

/**
 * mORTEX : bloc « Assistant ». Liste d'explications calculées sans IA ni réseau, chacune avec sa
 * gravité, ses sources repliables et les actions déjà existantes de l'appli.
 */
export const AssistantPanel = ({
  title,
  items,
  onAction,
  lootSortNote,
  onOpenUrl,
}: IAssistantPanelProps) => {
  const { t } = useTranslation(["common"]);
  const sorted = [...items].sort(bySeverity);
  return (
    <section className="mortex-assistant">
      <h6>{title}</h6>
      {sorted.length === 0 ? (
        <p className="mortex-assistant-text">{t("Nothing to report.")}</p>
      ) : (
        <ul className="mortex-assistant-list">
          {sorted.map((item) => (
            <Item key={item.id} item={item} onAction={onAction} onOpenUrl={onOpenUrl} />
          ))}
        </ul>
      )}
      {lootSortNote === true && (
        <p className="mortex-assistant-note">
          {t("LOOT messages are only updated when plugins are sorted.")}
        </p>
      )}
      {needsLootAttribution(items) && (
        <p className="mortex-assistant-note">
          <a
            href={LOOT_ATTRIBUTION_URL}
            onClick={(e) => {
              e.preventDefault();
              onOpenUrl?.(LOOT_ATTRIBUTION_URL);
            }}
          >
            {t("Source: LOOT masterlist")}
          </a>{" "}
          (
          <a
            href={LOOT_LICENSE_URL}
            onClick={(e) => {
              e.preventDefault();
              onOpenUrl?.(LOOT_LICENSE_URL);
            }}
          >
            CC BY-NC-SA 4.0
          </a>
          )
        </p>
      )}
    </section>
  );
};

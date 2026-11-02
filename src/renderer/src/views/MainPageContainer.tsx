import React, {
  Component,
  type FC,
  useCallback,
  type ReactNode,
  useState,
  useMemo,
  type JSX,
} from "react";
import { Alert, Button, Jumbotron } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { useMainContext } from "../contexts";
import {
  PageHeaderProvider,
  type IPageHeaderContext,
  PageHeaderContext,
} from "../contexts/MainPageHeaderContext";
import ExtensionGate from "../controls/ExtensionGate";
import Icon from "../controls/Icon";
import type { IMainPage } from "../types/IMainPage";
import { getApplication } from "../util/application";
import { didIgnoreError, isOutdated, reportRenderError } from "../util/errorHandling";
import { genHash } from "../util/genHash";
import { log } from "../util/log";
import { selectAlwaysCompactHeaders } from "./components/Page/Page";
import { type IPageContext, PageContext } from "./components/Page/Page.context";
import { PageHeader } from "./components/Page/PageHeader";

// Backward compatibility export
export { type IPageHeaderContext, PageHeaderContext };

export interface IBaseProps {
  page: IMainPage;
  active: boolean;
  secondary: boolean;
}

export interface IMainPageContext {
  globalOverlay: JSX.Element;
}

interface IErrorBoundaryProps {
  pageId: string;
  classes: string[];
  children: ReactNode;
}

interface IErrorBoundaryState {
  error: Error | undefined;
  errorInfo: React.ErrorInfo | undefined;
}

// Error boundaries must be class components - no hook equivalent exists
class PageErrorBoundary extends Component<IErrorBoundaryProps, IErrorBoundaryState> {
  constructor(props: IErrorBoundaryProps) {
    super(props);
    this.state = { error: undefined, errorInfo: undefined };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportRenderError(error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    const { error, errorInfo } = this.state;
    const { pageId, classes, children } = this.props;

    if (error !== undefined) {
      return (
        <ErrorFallback
          classes={classes}
          error={error}
          errorInfo={errorInfo}
          pageId={pageId}
          onRetry={() => this.setState({ error: undefined, errorInfo: undefined })}
        />
      );
    }

    return children;
  }
}

interface IErrorFallbackProps {
  pageId: string;
  classes: string[];
  error: Error;
  errorInfo: React.ErrorInfo;
  onRetry: () => void;
}

const ErrorFallback: FC<React.PropsWithChildren<IErrorFallbackProps>> = ({
  pageId,
  classes,
  error,
  errorInfo,
  onRetry,
}) => {
  const { t } = useTranslation(["common"]);
  const context = useMainContext();

  const report = useCallback(() => {
    context.api.events.emit(
      "report-feedback",
      error.stack.split("\n")[0],
      `Component rendering error

Vortex Version: ${getApplication().version},

${error.stack}

ComponentStack:
  ${errorInfo.componentStack}
`,
      [],
      genHash(error),
    );
  }, [context.api, error, errorInfo]);

  return (
    <div className={classes.join(" ")} id={`page-${pageId}`}>
      <Alert bsStyle="danger" className="render-failure">
        <Icon className="render-failure-icon" name="sad" />

        <div className="render-failure-text">{t("Failed to render.")}</div>

        <div className="render-failure-buttons">
          {isOutdated() || didIgnoreError() ? null : (
            <Button onClick={report}>{t("Report")}</Button>
          )}

          <Button onClick={onRetry}>{t("Retry")}</Button>
        </div>
      </Alert>
    </div>
  );
};

/**
 * mORTEX : les pages classiques qui n'affichent aucun titre reçoivent le même en-tête que les pages
 * redessinées (titre et sous-titre), pour que toutes se présentent de la même façon.
 */
const LEGACY_PAGE_SUBTITLES: { [pageId: string]: string } = {
  Profiles: "Each profile keeps its own enabled mods, plugins and game settings.",
  "game-profiles": "Each profile keeps its own enabled mods, plugins and game settings.",
  "gamebryo-plugins": "The plugins the game loads, in their load order.",
  Downloads: "The archives downloaded for this game, ready to install.",
  "gamebryo-savegames": "Your saved games, character by character.",
};

/** Follows the always-compact-headers setting, like the header of a redesigned page. */
const LegacyPageHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => {
  const alwaysCompact = useSelector(selectAlwaysCompactHeaders);
  const context = useMemo<IPageContext>(
    () => ({ scrolled: false, compact: alwaysCompact, setScrolled: () => undefined }),
    [alwaysCompact],
  );
  return (
    <PageContext.Provider value={context}>
      <PageHeader subtitle={subtitle} title={title} />
    </PageContext.Provider>
  );
};

export const MainPageContainer: React.FC<React.PropsWithChildren<IBaseProps>> = ({
  page,
  active,
  secondary,
}) => {
  const { t } = useTranslation(["common"]);
  const [headerRef, setHeaderRef] = useState<HTMLElement | null>(null);

  const classes = useMemo(() => {
    const result = ["main-page"];
    result.push(active ? "page-active" : "page-hidden");
    if (secondary) {
      result.push("secondary");
    }
    return result;
  }, [active, secondary]);

  const headerContextValue = useMemo<IPageHeaderContext>(
    () => ({
      headerPortal: () => headerRef,
      page: page.id,
    }),
    [headerRef, page.id],
  );

  const handleHeaderRef = useCallback((ref: HTMLElement | null) => {
    setHeaderRef(ref);
  }, []);

  // Render the page content
  let content: JSX.Element;
  try {
    const props = page.propsFunc();
    // Already resolved by PagesContext, so a page that decides for itself has had its
    // say by now. Compared against `true` rather than tested for truth so an unresolved
    // callback can't pass for a yes.
    if (page.newLayout === true) {
      // Redesigned pages render their own Page, so we skip the legacy
      // `.main-page` / header / body-container chrome to keep the subtree flat.
      content = (
        <ExtensionGate id={page.id}>
          <page.component active={active} pageId={page.id} secondary={secondary} {...props} />
        </ExtensionGate>
      );
    } else {
      content = (
        <PageHeaderProvider value={headerContextValue}>
          <div className={classes.join(" ")} id={`page-${page.id}`}>
            {LEGACY_PAGE_SUBTITLES[page.id] !== undefined ? (
              <LegacyPageHeader
                subtitle={t(LEGACY_PAGE_SUBTITLES[page.id])}
                title={t(page.title, { ns: page.namespace })}
              />
            ) : null}
            <div className="mainpage-header-container" ref={handleHeaderRef} />

            <div className="mainpage-body-container">
              <ExtensionGate id={page.id}>
                <page.component active={active} secondary={secondary} {...props} />
              </ExtensionGate>
            </div>
          </div>
        </PageHeaderProvider>
      );
    }
  } catch (err) {
    log("warn", "error rendering extension main page", err);
    content = (
      <div className={classes.join(" ")}>
        <Jumbotron>
          <h4>{t("Unavailable")}</h4>
        </Jumbotron>
      </div>
    );
  }

  return (
    <PageErrorBoundary classes={classes} pageId={page.id}>
      {content}
    </PageErrorBoundary>
  );
};

export default MainPageContainer;

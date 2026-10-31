import * as React from "react";
import { Button } from "react-bootstrap";

import Icon from "../../../controls/Icon";
import type { IRect, RectMap } from "../gridLayout";
import {
  cellAt,
  columnWidth,
  GAP,
  resolveLayout,
  ROW_HEIGHT,
  rowCount,
  sizeAt,
  toPixels,
} from "../gridLayout";

export interface IGridItem {
  id: string;
  closable: boolean;
  content: React.ReactNode;
}

export interface IProps {
  items: IGridItem[];
  /** positions des cartes, collisions déjà résolues */
  rects: RectMap;
  editMode: boolean;
  onCommit: (rects: RectMap) => void;
  onDismiss: (id: string) => void;
}

interface IDrag {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  /** case visée */
  cell: IRect;
}

/** lignes libres ajoutées sous les cartes en mode édition, pour pouvoir les poser plus bas */
const SPARE_ROWS = 2;

/**
 * Grille du tableau de bord : les cartes se posent où on veut, sur des cases ; la case visée
 * est montrée par un cadre en pointillés, les cartes gênées s'écartent.
 */
function DashboardGrid(props: IProps): JSX.Element {
  const { items, rects, editMode, onCommit, onDismiss } = props;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const [drag, setDrag] = React.useState<IDrag | undefined>(undefined);

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (el === null) {
      return undefined;
    }
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const colW = columnWidth(width);

  const preview = React.useMemo<RectMap>(
    () => (drag === undefined ? rects : resolveLayout({ ...rects, [drag.id]: drag.cell }, drag.id)),
    [rects, drag],
  );

  const begin = React.useCallback(
    (id: string, mode: IDrag["mode"]) => (evt: React.PointerEvent<HTMLElement>) => {
      if (evt.button !== 0) {
        return;
      }
      evt.preventDefault();
      evt.currentTarget.setPointerCapture(evt.pointerId);
      setDrag({
        id,
        mode,
        startX: evt.clientX,
        startY: evt.clientY,
        dx: 0,
        dy: 0,
        cell: rects[id],
      });
    },
    [rects],
  );

  const move = React.useCallback(
    (evt: React.PointerEvent<HTMLElement>) => {
      if (drag === undefined) {
        return;
      }
      const dx = evt.clientX - drag.startX;
      const dy = evt.clientY - drag.startY;
      const origin = toPixels(rects[drag.id], colW);
      const cell =
        drag.mode === "move"
          ? cellAt(rects[drag.id], origin.x + dx, origin.y + dy, colW)
          : sizeAt(rects[drag.id], origin.w + dx, origin.h + dy, colW);
      setDrag({ ...drag, dx, dy, cell });
    },
    [drag, rects, colW],
  );

  const end = React.useCallback(
    (evt: React.PointerEvent<HTMLElement>) => {
      if (drag === undefined) {
        return;
      }
      if (evt.currentTarget.hasPointerCapture(evt.pointerId)) {
        evt.currentTarget.releasePointerCapture(evt.pointerId);
      }
      const final = resolveLayout({ ...rects, [drag.id]: drag.cell }, drag.id);
      setDrag(undefined);
      onCommit(final);
    },
    [drag, rects, onCommit],
  );

  const cancel = React.useCallback(() => setDrag(undefined), []);

  const rows = rowCount(preview) + (editMode ? SPARE_ROWS : 0);
  const style: React.CSSProperties = {
    height: rows > 0 ? rows * (ROW_HEIGHT + GAP) - GAP : 0,
  };
  if (editMode && colW > 0) {
    style.backgroundImage =
      "radial-gradient(circle, var(--color-stroke-moderate) 1.5px, transparent 2px)";
    style.backgroundSize = `${colW + GAP}px ${ROW_HEIGHT + GAP}px`;
    style.backgroundPosition = `${-GAP / 2}px ${-GAP / 2}px`;
  }

  const renderItem = (item: IGridItem): JSX.Element | null => {
    const rect = preview[item.id];
    if (rect === undefined || colW === 0) {
      return null;
    }
    const px = toPixels(rect, colW);
    const dragged = drag?.id === item.id;
    if (dragged) {
      const origin = toPixels(rects[item.id], colW);
      if (drag.mode === "move") {
        px.x = origin.x + drag.dx;
        px.y = origin.y + drag.dy;
        px.w = origin.w;
        px.h = origin.h;
      } else {
        px.x = origin.x;
        px.y = origin.y;
        px.w = Math.max(colW, origin.w + drag.dx);
        px.h = Math.max(ROW_HEIGHT, origin.h + drag.dy);
      }
    }
    const classes = ["dash-item"];
    if (editMode) {
      classes.push("dash-editing");
    }
    if (dragged) {
      classes.push("dash-dragged");
    }
    return (
      <div
        key={item.id}
        id={item.id}
        className={classes.join(" ")}
        style={{ transform: `translate(${px.x}px, ${px.y}px)`, width: px.w, height: px.h }}
      >
        <div className="dash-item-content">{item.content}</div>
        {editMode ? (
          <>
            <div
              className="dash-drag-handle"
              onPointerDown={begin(item.id, "move")}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={cancel}
            />
            {item.closable ? (
              <Button
                className="dashlet-close-button dash-close"
                onClick={() => onDismiss(item.id)}
              >
                <Icon name="close" />
              </Button>
            ) : null}
            <div
              className="dash-resize-handle"
              onPointerDown={begin(item.id, "resize")}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={cancel}
            >
              <Icon name="corner-handle" />
            </div>
          </>
        ) : null}
      </div>
    );
  };

  const ghost = drag !== undefined && colW > 0 ? toPixels(preview[drag.id], colW) : undefined;

  return (
    <div ref={containerRef} className="dash-grid" style={style}>
      {ghost !== undefined ? (
        <div
          className="dash-ghost"
          style={{
            transform: `translate(${ghost.x}px, ${ghost.y}px)`,
            width: ghost.w,
            height: ghost.h,
          }}
        />
      ) : null}
      {items.map(renderItem)}
    </div>
  );
}

export default DashboardGrid;

import { Application, Container, Graphics } from 'pixi.js';
import type { Seat } from '@carrom/engine';
import type { BoardRenderer, RendererFactory } from './boardRenderer';
import { drawClock } from './boardCtrl';
import { drawBoard, layoutFor } from './drawBoard';
import { createPieceLayer, drawAim, syncPieces } from './drawPieces';
import { boardPalette, DEFAULT_SKINS, type BoardSkins } from './skins';

/** The 2D board: the Pixi drawing that used to live in the board hook, unchanged. */
export const createPixiBoard: RendererFactory = async (host, fit, onResize) => {
  const app = new Application();
  const avail = () => (fit === 'contain' ? Math.min(host.clientWidth, host.clientHeight) : host.clientWidth);
  await app.init({
    width: layoutFor(host.clientWidth).canvasPx,
    height: layoutFor(host.clientWidth).canvasPx,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    antialias: true,
    backgroundAlpha: 0,
  });
  const root = new Container();
  const boardG = new Graphics();
  const pieces = createPieceLayer();
  const aimG = new Graphics();
  const clockG = new Graphics();
  root.addChild(boardG, clockG, pieces.container, aimG);
  app.canvas.style.touchAction = 'none';
  app.canvas.style.display = 'block';
  host.appendChild(app.canvas);
  app.stage.addChild(root);

  let layout = layoutFor(0);
  let view: Seat = 0;
  let skins: BoardSkins = DEFAULT_SKINS;
  const resize = () => {
    const size = layoutFor(avail());
    if (size.canvasPx !== layout.canvasPx) app.renderer.resize(size.canvasPx, size.canvasPx);
    layout = size;
    root.position.set(size.framePx, size.framePx);
    drawBoard(boardG, size, view, boardPalette(skins.board));
    onResize();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const r: BoardRenderer = {
    canvas: app.canvas,
    layout: () => layout,
    local(e) {
      const rect = app.canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left - layout.framePx, y: e.clientY - rect.top - layout.framePx };
    },
    redraw(v, s) {
      view = v;
      skins = s;
      resize();
    },
    draw(d) {
      syncPieces(pieces, {
        state: d.board, viewSeat: d.view, boardPx: layout.boardPx, nowMs: d.nowMs,
        pocketedAt: d.pocketedAt, striker: d.striker, styleOf: d.styleOf,
      });
      drawAim(aimG, d.spot, d.aim, d.pull, d.seat, d.view, layout.boardPx);
      drawClock(clockG, d.clock, d.spot, d.view, layout.boardPx);
    },
    start(tick) { app.ticker.add((t) => tick(t.deltaMS)); },
    destroy() {
      observer.disconnect();
      app.destroy(true, { children: true });
    },
  };
  return r;
};

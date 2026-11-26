import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { BoardRenderer, RendererFactory } from './boardRenderer';
import { drawClock } from './boardCtrl';
import { layoutFor, paintBoardCanvas } from './drawBoard';
import { drawAim } from './aimPointer';
import { createPieceLayer, syncPieces } from './drawPieces';
import { boardFinish, boardPalette, DEFAULT_SKINS, type BoardSkins } from './skins';

/** The 2D board: a painted board sprite under Pixi-drawn pieces, aim and clock. */
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
  const boardS = new Sprite();
  const pieces = createPieceLayer();
  const aimG = new Graphics();
  const clockG = new Graphics();
  root.addChild(boardS, clockG, pieces.container, aimG);
  app.canvas.style.touchAction = 'none';
  app.canvas.style.display = 'block';
  host.appendChild(app.canvas);
  app.stage.addChild(root);

  let layout = layoutFor(0);
  let skins: BoardSkins = DEFAULT_SKINS;
  let painted = '';
  const paintBoard = () => {
    const key = `${layout.canvasPx}|${skins.board}`;
    if (key === painted) return;
    painted = key;
    const old = boardS.texture;
    const canvas = paintBoardCanvas(layout, boardPalette(skins.board), boardFinish(skins.board), window.devicePixelRatio || 1);
    boardS.texture = Texture.from(canvas);
    if (old !== Texture.EMPTY) old.destroy(true);
    boardS.position.set(-layout.framePx, -layout.framePx);
    boardS.width = boardS.height = layout.canvasPx;
  };
  const resize = () => {
    const size = layoutFor(avail());
    if (size.canvasPx !== layout.canvasPx) app.renderer.resize(size.canvasPx, size.canvasPx);
    layout = size;
    root.position.set(size.framePx, size.framePx);
    paintBoard();
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
    redraw(_view, s) {
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

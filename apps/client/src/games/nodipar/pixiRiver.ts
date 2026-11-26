import { Application, Container, Graphics } from 'pixi.js';
import { screenToWorld, worldToPx, worldToScreen } from '@/games/carrom/view';
import { drawBoats, drawRiverAim, drawRiverClock, drawScene, drawWhirl, riverLayoutFor } from './drawRiver';
import type { RiverFactory, RiverRenderer } from './riverRenderer';

const WHIRL_SPEED = 0.0015;

/** The 2D river: the Pixi drawing that used to live in the river hook, unchanged. */
export const createPixiRiver: RiverFactory = async (host) => {
  const app = new Application();
  await app.init({
    width: riverLayoutFor(host.clientWidth).canvasPx, height: riverLayoutFor(host.clientWidth).canvasPx,
    resolution: window.devicePixelRatio || 1, autoDensity: true, antialias: true, backgroundAlpha: 0,
  });
  const scene = new Graphics();
  const whirls = new Container();
  const boats = new Graphics();
  const aimG = new Graphics();
  const clockG = new Graphics();
  const root = new Container();
  root.addChild(scene, whirls, boats, clockG, aimG);
  app.canvas.style.touchAction = 'none';
  app.canvas.style.display = 'block';
  host.appendChild(app.canvas);
  app.stage.addChild(root);
  let layout = riverLayoutFor(0);
  let whirlKey = '';
  const resize = () => {
    const size = riverLayoutFor(host.clientWidth);
    if (size.canvasPx !== layout.canvasPx) app.renderer.resize(size.canvasPx, size.canvasPx);
    layout = size;
    whirlKey = '';
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const screen = (e: { clientX: number; clientY: number }) => {
    const rect = app.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const r: RiverRenderer = {
    canvas: app.canvas,
    layout: () => layout,
    world: (e, view) => screenToWorld(screen(e), view, layout.boardPx),
    screen,
    draw(d) {
      const v = { viewSeat: d.view, boardPx: layout.boardPx };
      drawScene(scene, { ...v, config: d.config, table: d.table, owners: d.owners, pars: d.pars, river: d.river, teamColor: d.teamColor });
      const key = `${layout.boardPx}:${d.config.players}:${d.view}:${d.river.whirl}`;
      if (key !== whirlKey) {
        whirlKey = key;
        whirls.removeChildren().forEach((w) => w.destroy());
        for (const w of d.table.pockets) {
          const g = new Graphics();
          drawWhirl(g, worldToPx(d.table.pocketD / 2, layout.boardPx), d.river);
          const at = worldToScreen(w, d.view, layout.boardPx);
          g.position.set(at.x, at.y);
          whirls.addChild(g);
        }
      }
      for (const w of whirls.children) w.rotation -= WHIRL_SPEED * d.deltaMs;
      drawBoats(boats, d.board, v, d.skinOf, d.ready, d.selected);
      drawRiverAim(aimG, d.aimFrom, d.aim, d.aimSeat, v);
      drawRiverClock(clockG, d.clock, d.clockAt, v);
    },
    start(tick) { app.ticker.add((t) => tick(t.deltaMS)); },
    destroy() {
      observer.disconnect();
      app.destroy(true, { children: true });
    },
  };
  return r;
};

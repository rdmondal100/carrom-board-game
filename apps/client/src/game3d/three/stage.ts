import {
  ACESFilmicToneMapping, DirectionalLight, HemisphereLight, Mesh, PCFShadowMap, PerspectiveCamera, Plane,
  PMREMGenerator, Raycaster, Scene, SpotLight, Vector2, Vector3, WebGLRenderer, type Intersection, type Material,
  type Object3D, type Texture,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Quality } from '@/store/settingsSlice';

/** T3D-9 pixel ratio caps per quality. */
const RATIO: Record<Quality, number> = { low: 1, auto: 1.75, high: 2 };
/** A frame longer than this (tab was hidden) counts as this long. */
const MAX_DT = 100;
/** The table lamp's strength (no fall-off with distance, so it is the same at every table size). */
const LAMP = 3.4;

export interface StageOptions {
  quality: Quality;
  /** Width and height (CSS px) to draw at, from the host. */
  fit: (host: HTMLElement) => { w: number; h: number };
  fov?: number;
  /** The GPU dropped the context (T3D-2: fall back to 2D). */
  onLost?: () => void;
}

export type PointerLike = { clientX: number; clientY: number };

/** T3D-3 one 3D canvas: renderer, scene, camera, lights, a frame loop and pointer picking. */
export interface Stage {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  canvas: HTMLCanvasElement;
  key: SpotLight;
  /** Runs every animation frame with ms since the last; return true when something moved (draws this frame). */
  onFrame(fn: (dtMs: number, nowMs: number) => boolean | void): () => void;
  /** Draw on the next frame. */
  invalidate(): void;
  /** The point under the pointer on the level plane y = `y`, or null when the ray misses it. */
  ground(e: PointerLike, y?: number): Vector3 | null;
  /** What the pointer is over, nearest first. */
  hit(e: PointerLike, objects: readonly Object3D[]): Intersection[];
  /** Place the lamp, fill light, shadows and camera range for a table of half-size `half` (scene units). */
  fitLights(half: number): void;
  /** Called with the new size after each resize. */
  onResize(fn: (w: number, h: number) => void): void;
  dispose(): void;
}

/** Free every geometry, material and texture under `root`. */
export function disposeTree(root: Object3D): void {
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    o.geometry.dispose();
    const mats: Material[] = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      for (const v of Object.values(m)) if ((v as Texture | null)?.isTexture) (v as Texture).dispose();
      m.dispose();
    }
  });
}

/** T3D-3 make a stage in `host`. Throws when WebGL can't start (the caller falls back to 2D). */
export function createStage(host: HTMLElement, opts: StageOptions): Stage {
  const renderer = new WebGLRenderer({ antialias: opts.quality !== 'low', alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RATIO[opts.quality]));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = opts.quality !== 'low';
  renderer.shadowMap.type = PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.touchAction = 'none';
  host.appendChild(canvas);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 0.55;
  room.dispose?.();

  const camera = new PerspectiveCamera(opts.fov ?? 35, 1, 0.01, 100);
  // A warm hanging lamp over the table (soft-edged pool of light, soft shadows), a cool
  // fill from behind for rim highlights, and a dim sky/ground bounce.
  scene.add(new HemisphereLight(0xfff1dc, 0x1a1020, 0.5));
  const key = new SpotLight(0xffe6c2, LAMP, 0, 0.6, 0.7, 0);
  key.castShadow = renderer.shadowMap.enabled;
  const map = opts.quality === 'low' ? 512 : 2048;
  key.shadow.mapSize.set(map, map);
  key.shadow.radius = 4;
  const fill = new DirectionalLight(0xa9bcff, 0.45);
  scene.add(key, key.target, fill);

  const frames = new Set<(dt: number, now: number) => boolean | void>();
  const resizers: ((w: number, h: number) => void)[] = [];
  let dirty = true;
  let last = performance.now();
  let raf = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(MAX_DT, now - last);
    last = now;
    let draw = dirty;
    for (const f of frames) if (f(dt, now)) draw = true;
    if (!draw) return;
    dirty = false;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  const resize = () => {
    const { w, h } = opts.fit(host);
    if (w <= 0 || h <= 0) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    resizers.forEach((r) => r(w, h));
    dirty = true;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  const lost = (e: Event) => { e.preventDefault(); opts.onLost?.(); };
  canvas.addEventListener('webglcontextlost', lost);

  const ray = new Raycaster();
  const ndc = new Vector2();
  const aim = (e: PointerLike) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray;
  };

  return {
    scene, camera, renderer, canvas, key,
    onFrame(fn) { frames.add(fn); return () => { frames.delete(fn); }; },
    invalidate() { dirty = true; },
    ground(e, y = 0) {
      const out = new Vector3();
      return aim(e).ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -y), out);
    },
    hit(e, objects) { return aim(e).intersectObjects([...objects], true); },
    fitLights(half) {
      // The lamp hangs a little left of and in front of the table centre; its pool covers the table and fades past it.
      key.position.set(-0.5 * half, 3.4 * half, 1.1 * half);
      key.target.position.set(0, 0, 0);
      key.angle = Math.atan2(1.75 * half, 3.4 * half);
      key.shadow.camera.near = half * 1.2;
      key.shadow.camera.far = half * 8;
      key.shadow.bias = -0.00015;
      key.shadow.normalBias = 0.006 * half;
      key.shadow.camera.updateProjectionMatrix();
      fill.position.set(2 * half, 1.4 * half, -2.6 * half);
      camera.near = half * 0.04;
      camera.far = half * 60;
      camera.updateProjectionMatrix();
      dirty = true;
    },
    onResize(fn) { resizers.push(fn); const { w, h } = opts.fit(host); if (w > 0 && h > 0) fn(w, h); },
    dispose() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener('webglcontextlost', lost);
      frames.clear();
      disposeTree(scene);
      scene.environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}

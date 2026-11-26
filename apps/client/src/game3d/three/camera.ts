import { Vector3, type PerspectiveCamera } from 'three';

const STEPS = 28;

/**
 * T3D-3 place `camera` on the line from `target` along `dir` (toward the camera),
 * as close as it can be while every point stays on screen (inside `margin` of the edge).
 */
export function fitCamera(camera: PerspectiveCamera, target: Vector3, dir: Vector3, points: readonly Vector3[], margin = 0.92): void {
  const d = dir.clone().normalize();
  const v = new Vector3();
  const fits = (dist: number) => {
    camera.position.copy(target).addScaledVector(d, dist);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    return points.every((p) => {
      v.copy(p).project(camera);
      return Math.abs(v.x) <= margin && Math.abs(v.y) <= margin && v.z < 1;
    });
  };
  let lo = 0.1;
  let hi = 1;
  while (!fits(hi) && hi < 1000) hi *= 2;
  for (let i = 0; i < STEPS; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  fits(hi);
}

/** The 8 corners of a box centred on the origin (half sizes). */
export function boxCorners(hx: number, hy: number, hz: number, y0 = 0): Vector3[] {
  const out: Vector3[] = [];
  for (const x of [-hx, hx]) for (const y of [y0 - hy, y0 + hy]) for (const z of [-hz, hz]) out.push(new Vector3(x, y, z));
  return out;
}

/** A unit direction from the target up and toward the viewer, `deg` above the table (0 = edge on, 90 = straight down). */
export function viewDir(deg: number): Vector3 {
  const a = (deg * Math.PI) / 180;
  return new Vector3(0, Math.sin(a), Math.cos(a));
}

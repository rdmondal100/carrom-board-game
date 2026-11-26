import { Fog, Mesh, MeshStandardMaterial, MirroredRepeatWrapping, PlaneGeometry, type Vector3 } from 'three';
import type { Stage } from './stage';
import { canvasTexture } from './textures';
import { paintPlanks } from './wood';

/** The page background (index.css --background): the room fades into it. */
const ROOM_BG = 0x0f0b2a;
const FLOOR_WOOD = 0x3b2416;

/**
 * T3D-3 the room around a table: a wooden floor at `y` that catches the
 * table's shadow under the lamp and fades into the page in the distance.
 * Call after the scene's own `onResize`, so the fog follows the fitted camera.
 */
export function addRoom(stage: Stage, half: number, y: number, target: Vector3): void {
  const tex = canvasTexture(512, (ctx, s) => paintPlanks(ctx, s, FLOOR_WOOD), true);
  tex.wrapS = tex.wrapT = MirroredRepeatWrapping;
  tex.repeat.set(8, 8);
  const size = half * 16;
  const floor = new Mesh(new PlaneGeometry(size, size).rotateX(-Math.PI / 2), new MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0 }));
  floor.position.y = y;
  floor.receiveShadow = true;
  stage.scene.add(floor);
  stage.scene.fog = new Fog(ROOM_BG, 1, 2);
  stage.onResize(() => {
    const d = stage.camera.position.distanceTo(target);
    const fog = stage.scene.fog as Fog;
    fog.near = d * 1.1;
    fog.far = d * 2.3;
  });
}

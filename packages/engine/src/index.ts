export { BORSHA_CURRENT, config, NODI, TABLES, type Config, type TableId } from './config';
export type {
  BoardState, Circle, Kind, Piece, PocketId, Seat, ShotEvent, ShotInput, Table, Vec,
} from './types';
export { createRack, placeStriker } from './rack';
export { baselinePoint, seatForward, seatOutward, seatRight, seatToWorld } from './seats';
export { pocketCentre } from './pockets';
export { placeCoin, spotIsFree } from './place';
export { cloneState, isAtRest, step } from './step';
export { simulateFlick, simulateShot, stateHash, type ShotResult } from './shot';

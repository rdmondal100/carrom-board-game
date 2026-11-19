export { config, type Config } from './config';
export type {
  BoardState, Kind, Piece, PocketId, Seat, ShotEvent, ShotInput, Vec,
} from './types';
export { createRack, placeStriker } from './rack';
export { baselinePoint, seatForward, seatOutward, seatRight, seatToWorld } from './seats';
export { pocketCentre } from './pockets';
export { cloneState, isAtRest, step } from './step';
export { simulateShot, stateHash } from './shot';

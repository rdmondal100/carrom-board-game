import { z } from 'zod';

/**
 * VOICE-2: WebRTC signalling that rides on the room connection. The server
 * only checks the shape and size and relays it to the addressed session.
 */

/** An SDP is a few kB for one Opus audio track; anything much bigger is not ours. */
export const SDP_MAX = 12_000;
/** One ICE candidate line. */
export const CANDIDATE_MAX = 1_000;
/** Colyseus session ids are short strings. */
export const SESSION_ID_MAX = 64;

export type VoiceSignal =
  | { kind: 'offer'; sdp: string }
  | { kind: 'answer'; sdp: string }
  | { kind: 'ice'; candidate: string; sdpMid: string | null; sdpMLineIndex: number | null };

export const VoiceSignalSchema: z.ZodType<VoiceSignal> = z.union([
  z.object({ kind: z.enum(['offer', 'answer']), sdp: z.string().min(1).max(SDP_MAX) }),
  z.object({
    kind: z.literal('ice'),
    candidate: z.string().max(CANDIDATE_MAX),
    sdpMid: z.string().max(64).nullable(),
    sdpMLineIndex: z.number().int().min(0).max(16).nullable(),
  }),
]);

export const SessionIdSchema = z.string().min(1).max(SESSION_ID_MAX);

/** VOICE-6 why a player is reported. */
export const REPORT_REASONS = ['abuse', 'harassment', 'cheating', 'spam', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

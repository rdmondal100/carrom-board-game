import { Room, type Client } from '@colyseus/core';

/** Test room: answers each 'ping' with a 'pong' carrying the same payload. */
export class PingRoom extends Room {
  maxClients = 4;

  messages = {
    ping: (client: Client, payload: unknown) => {
      client.send('pong', payload ?? null);
    },
  };
}

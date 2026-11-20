import { Match } from '../models/match.model.js';
import { User } from '../models/user.model.js';
import { logger } from './logger.js';

/** What one migration run changed. */
export interface MigrationReport { users: number; matches: number }

/**
 * HUB-8: data from before the hub, moved once at startup. Safe to run any
 * number of times; a second run finds nothing to do.
 * - users: top-level `rating` / `rankedGames` (carrom) → `ratings.carrom`, old fields removed;
 * - matches without `game` were carrom games.
 */
export async function runMigrations(): Promise<MigrationReport> {
  const users = await User.collection.updateMany(
    { rating: { $exists: true } },
    [
      {
        $set: {
          'ratings.carrom': {
            $ifNull: ['$ratings.carrom', { rating: '$rating', games: { $ifNull: ['$rankedGames', 0] } }],
          },
        },
      },
      { $unset: ['rating', 'rankedGames'] },
    ],
  );
  const matches = await Match.collection.updateMany({ game: { $exists: false } }, { $set: { game: 'carrom' } });
  const report = { users: users.modifiedCount, matches: matches.modifiedCount };
  if (report.users || report.matches) logger.info(`migrations: ${report.users} users, ${report.matches} matches moved to the hub`);
  return report;
}

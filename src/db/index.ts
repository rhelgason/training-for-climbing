/* eslint-disable @typescript-eslint/no-require-imports -- platform-conditional lazy load of the native SQLite module */
import { InMemoryRepository, type Repository } from '@tfc/core';
import { Platform } from 'react-native';

import { log } from '../lib/logger';

export type { Repository } from '@tfc/core';
export type { AssessmentRecord, NewAssessment, UsageEventRecord } from '@tfc/core';

/**
 * Build the Repository for the current platform. Native uses SQLite; anything
 * else (e.g. web in early development, or the jest/node environment) falls back
 * to in-memory storage.
 *
 * The SQLite module is required lazily so that importing this file does not pull
 * in `expo-sqlite` (and its native-only deps) in environments that can't load
 * it — notably unit tests.
 */
export function createRepository(): Repository {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    const { SqliteRepository } =
      require('./sqliteRepository') as typeof import('./sqliteRepository');
    return new SqliteRepository();
  }
  log.warn(`No persistent storage for platform "${Platform.OS}"; using in-memory repository`);
  return new InMemoryRepository();
}

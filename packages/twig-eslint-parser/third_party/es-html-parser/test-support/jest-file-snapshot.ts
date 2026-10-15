import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect } from 'vitest';

type MatcherResult = { readonly pass: boolean; readonly message: () => string };

const snapshotCountByTest = new Map<string, number>();

// Compares a value with the file jest-file-snapshot would have written for the current test, without ever writing one.
export function toMatchFile(received: string, filename: string | undefined, options: { readonly fileExtension?: string } = {}): MatcherResult {
  const { currentTestName = '', testPath = '' } = expect.getState();
  const testName = currentTestName.split(' > ').join(' ').replace(/\s+/g, '-');
  const index = snapshotCountByTest.get(`${testPath}\0${testName}`) ?? 0;
  snapshotCountByTest.set(`${testPath}\0${testName}`, index + 1);
  const snapshotPath = filename ?? join(dirname(testPath), '__file_snapshots__', `${testName}-${index}${options.fileExtension ?? ''}`);
  if (!existsSync(snapshotPath)) return { pass: false, message: () => `No file snapshot at ${snapshotPath}.` };
  const expected = readFileSync(snapshotPath, 'utf8');
  return { pass: received === expected, message: () => `${snapshotPath} does not match the received value.` };
}

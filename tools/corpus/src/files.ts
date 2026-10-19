import { renameSync, writeFileSync } from 'node:fs';

export function writeFileAtomically(path: string, content: string): void {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, content);
  renameSync(temporaryPath, path);
}

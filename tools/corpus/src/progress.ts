import { writeSync } from 'node:fs';
import type { CheckContext } from './types.js';

export type ProgressOutput = { readonly write: (text: string) => void; readonly isTerminal: boolean };
export type ProgressReporter = {
  readonly phase: (message: string) => void;
  readonly track: (label: string, total: number) => CheckContext['progress'];
};

const terminalIntervalMilliseconds = 250;
const logIntervalMilliseconds = 5000;
const logPercentStep = 10;
const clearLine = '\r\x1b[2K';

export function stderrOutput(isTerminal: boolean): ProgressOutput {
  return {
    write: (text) => {
      try {
        writeSync(2, text);
      } catch {
        return;
      }
    },
    isTerminal,
  };
}

function describeCounts(counts: Readonly<Record<string, number>>): string {
  return Object.entries(counts).map(([name, value]) => `${name} ${value}`).join(', ');
}

export function createProgressReporter(output: ProgressOutput, now: () => number = () => performance.now()): ProgressReporter {
  const phase = (message: string): void => {
    output.write(`${output.isTerminal ? clearLine : ''}[corpus] ${message}\n`);
  };

  const track = (label: string, total: number): CheckContext['progress'] => {
    const startedAt = now();
    let lastPrintedAt = startedAt;
    let lastPercentStep = 0;
    return (done, counts = {}) => {
      if (done <= 0 || done >= total) return;
      const current = now();
      const percent = Math.floor((done / total) * 100);
      const percentStep = Math.floor(percent / logPercentStep);
      const isDue = output.isTerminal
        ? current - lastPrintedAt >= terminalIntervalMilliseconds
        : percentStep > lastPercentStep || current - lastPrintedAt >= logIntervalMilliseconds;
      if (!isDue) return;
      lastPrintedAt = current;
      lastPercentStep = percentStep;
      const perSecond = Math.round(done / Math.max((current - startedAt) / 1000, 0.001));
      const line = `[corpus] ${label}  ${done}/${total} (${percent}%)  ${describeCounts(counts)}  ${perSecond} templates/s`;
      output.write(output.isTerminal ? `${clearLine}${line}` : `${line}\n`);
    };
  };

  return { phase, track };
}

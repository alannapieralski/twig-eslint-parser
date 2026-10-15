import type { Linter } from 'eslint';
import { findInterpolatedStrings, TwigSyntaxError } from 'twig-eslint-parser';
import { containsGroupDelimiter, isGroupDelimiter } from './class-groups.js';

type Range = readonly [number, number];
type FileSpans = { readonly text: string; readonly lineStarts: readonly number[]; readonly interpolatedStrings: readonly Range[] };

const silencedRulePrefix = 'better-tailwindcss/';
const spansByFilename = new Map<string, FileSpans>();

function findLineStarts(text: string): number[] {
  return [0, ...[...text.matchAll(/\r\n|\r|\n/g)].map((match) => (match.index as number) + match[0].length)];
}

function findInterpolatedStringsOrNone(text: string): readonly Range[] {
  try {
    return findInterpolatedStrings(text);
  } catch (error) {
    if (error instanceof TwigSyntaxError) return [];
    throw error;
  }
}

function offsetOf(spans: FileSpans, line: number, column: number): number | undefined {
  const lineStart = spans.lineStarts[line - 1];
  return lineStart === undefined ? undefined : lineStart + column - 1;
}

function isInsideInterpolatedString(message: Linter.LintMessage, spans: FileSpans): boolean {
  const offset = offsetOf(spans, message.line, message.column);
  if (offset === undefined) return false;
  return spans.interpolatedStrings.some(([start, end]) => offset >= start && offset < end);
}

function isAboutAGroupDelimiter(message: Linter.LintMessage, spans: FileSpans): boolean {
  if (message.endLine === undefined || message.endColumn === undefined) return false;
  const start = offsetOf(spans, message.line, message.column);
  const end = offsetOf(spans, message.endLine, message.endColumn);
  return start !== undefined && end !== undefined && isGroupDelimiter(spans.text.slice(start, end));
}

function isAboutAGroupedClassList(message: Linter.LintMessage, spans: FileSpans): boolean {
  if (isAboutAGroupDelimiter(message, spans)) return true;
  return message.fix !== undefined && containsGroupDelimiter(spans.text.slice(...message.fix.range));
}

function adjustBetterTailwindcssMessage(message: Linter.LintMessage, spans: FileSpans): Linter.LintMessage | undefined {
  if (!message.ruleId?.startsWith(silencedRulePrefix)) return message;
  if (isInsideInterpolatedString(message, spans) || isAboutAGroupedClassList(message, spans)) return undefined;
  return message;
}

export function createProcessor(meta: { name: string; version: string }): Linter.Processor {
  return {
    meta: { name: `${meta.name}/twig`, version: meta.version },
    supportsAutofix: true,
    preprocess(text, filename) {
      spansByFilename.set(filename, { text, lineStarts: findLineStarts(text), interpolatedStrings: findInterpolatedStringsOrNone(text) });
      return [text];
    },
    postprocess(messages, filename) {
      const spans = spansByFilename.get(filename);
      spansByFilename.delete(filename);
      const fileMessages = messages.flat();
      if (!spans) return fileMessages;
      return fileMessages.flatMap((message) => adjustBetterTailwindcssMessage(message, spans) ?? []);
    },
  };
}

import type { Linter } from 'eslint';
import { findInterpolatedStrings, TwigSyntaxError } from 'twig-eslint-parser';

type Range = readonly [number, number];
type FileSpans = { readonly lineStarts: readonly number[]; readonly interpolatedStrings: readonly Range[] };

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

function isInsideInterpolatedString(message: Linter.LintMessage, spans: FileSpans): boolean {
  const lineStart = spans.lineStarts[message.line - 1];
  if (lineStart === undefined) return false;
  const offset = lineStart + message.column - 1;
  return spans.interpolatedStrings.some(([start, end]) => offset >= start && offset < end);
}

export function createProcessor(meta: { name: string; version: string }): Linter.Processor {
  return {
    meta: { name: `${meta.name}/twig`, version: meta.version },
    supportsAutofix: true,
    preprocess(text, filename) {
      spansByFilename.set(filename, { lineStarts: findLineStarts(text), interpolatedStrings: findInterpolatedStringsOrNone(text) });
      return [text];
    },
    postprocess(messages, filename) {
      const spans = spansByFilename.get(filename);
      spansByFilename.delete(filename);
      const fileMessages = messages.flat();
      if (!spans) return fileMessages;
      return fileMessages.filter((message) => !(message.ruleId?.startsWith(silencedRulePrefix) && isInsideInterpolatedString(message, spans)));
    },
  };
}

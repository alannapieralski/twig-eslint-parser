import { readFileSpans } from './file-spans.js';
import { isSilencedMessage } from './silence-messages.js';
import type { Linter } from 'eslint';
import type { FileSpans } from './file-spans.js';

const spansByFilename = new Map<string, FileSpans>();

export function createProcessor(meta: { name: string; version: string }): Linter.Processor {
  return {
    meta: { name: `${meta.name}/twig`, version: meta.version },
    supportsAutofix: true,
    preprocess(text, filename) {
      spansByFilename.set(filename, readFileSpans(text));
      return [text];
    },
    postprocess(messages, filename) {
      const spans = spansByFilename.get(filename);
      spansByFilename.delete(filename);
      const fileMessages = messages.flat();
      if (!spans) return fileMessages;

      return fileMessages.filter((message) => !isSilencedMessage(message, spans));
    },
  };
}

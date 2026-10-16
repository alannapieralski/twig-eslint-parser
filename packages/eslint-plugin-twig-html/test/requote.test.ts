import { describe, expect, it } from 'vitest';
import { requote } from '../src/rules/quotes/requote.js';

describe('requote', () => {
  it('keeps a body with no quotes or escapes as it is', () => {
    expect(requote('plain text', "'", '"')).toBe('plain text');
  });

  it('removes the escape from the old quote', () => {
    expect(requote("it\\'s", "'", '"')).toBe("it's");
  });

  it('keeps other escapes', () => {
    expect(requote('line\\nbreak', "'", '"')).toBe('line\\nbreak');
  });

  it('gives up when the body holds the new quote unescaped', () => {
    expect(requote('say "hi"', "'", '"')).toBeUndefined();
  });

  it('gives up when a double-quoted string would start an interpolation', () => {
    expect(requote('#{name}', "'", '"')).toBeUndefined();
  });

  it('keeps # { when moving to single quotes', () => {
    expect(requote('#{name}', '"', "'")).toBe('#{name}');
  });
});

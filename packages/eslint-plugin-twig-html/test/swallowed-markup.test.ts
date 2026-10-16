import { describe, expect, it } from 'vitest';
import { isOpenTagSwallowingMarkup } from '../src/shared/swallowed-markup.js';

const tag = (text: string, openEndValue: string | undefined) => {
  const attributeRange = [text.indexOf(' ') + 1, text.length] as const;
  return { attributes: [{ range: attributeRange }], ...(openEndValue && { openEnd: { range: [text.length, text.length + 1] as const, value: openEndValue } }) };
};

describe('isOpenTagSwallowingMarkup', () => {
  it('is false for a tag that ends with > and holds only attributes', () => {
    expect(isOpenTagSwallowingMarkup(tag('<a href="x"', '>'), '<a href="x">')).toBe(false);
  });

  it('is true when the open tag has no closing bracket', () => {
    expect(isOpenTagSwallowingMarkup(tag('<a href="x"', undefined), '<a href="x"')).toBe(true);
  });

  it('is true when an attribute holds a stray < outside quotes and Twig', () => {
    expect(isOpenTagSwallowingMarkup(tag('<a <b', '>'), '<a <b>')).toBe(true);
  });

  it('is false when the < sits inside a quoted value or a Twig block', () => {
    expect(isOpenTagSwallowingMarkup(tag('<a title="a<b" {{ x < y }}', '>'), '<a title="a<b" {{ x < y }}>')).toBe(false);
  });
});

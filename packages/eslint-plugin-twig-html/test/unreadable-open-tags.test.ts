import { parseForESLint } from 'twig-eslint-parser';
import { describe, expect, it } from 'vitest';
import { findUnreadableTagStarts, isOpenTagUnreadable } from '../src/shared/unreadable-open-tags.js';

const tagAt = (start: number) => ({ openStart: { range: [start, start + 2] as const, value: '<a' } });

function unreadableTagStartsIn(code: string): ReadonlySet<number> {
  return findUnreadableTagStarts(parseForESLint(code).services.twig.diagnostics);
}

describe('findUnreadableTagStarts', () => {
  it('is empty for a tag that ends with > and holds only attributes', () => {
    expect(unreadableTagStartsIn('<a href="x">y</a>').size).toBe(0);
  });

  it('holds the start of an open tag with no closing bracket', () => {
    expect([...unreadableTagStartsIn('<p>x</p><a href="x"')]).toEqual([8]);
  });

  it('holds the start of a tag with an unquoted value that runs into the next tag', () => {
    expect([...unreadableTagStartsIn('<p>x</p><li id=b<span>x</span></li>')]).toEqual([8]);
  });

  it('holds the start of a tag whose quotes are mangled, so an attribute name holds a quote', () => {
    expect([...unreadableTagStartsIn('<p>x</p><li class="a\' data-x="y" id="z">x</li>')]).toEqual([8]);
  });

  it('ignores problems that do not misread an open tag', () => {
    expect(unreadableTagStartsIn('<p>x</p></div>').size).toBe(0);
  });

  it('ignores a < inside a quoted value or a Twig block', () => {
    expect(unreadableTagStartsIn('<a title="a<b" {{ x < y }}>y</a>').size).toBe(0);
  });
});

describe('isOpenTagUnreadable', () => {
  it('matches a tag by where its open tag starts', () => {
    const starts = new Set([8]);
    expect(isOpenTagUnreadable(tagAt(8), starts)).toBe(true);
    expect(isOpenTagUnreadable(tagAt(0), starts)).toBe(false);
  });
});

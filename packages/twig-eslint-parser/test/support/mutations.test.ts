import { describe, expect, it } from 'vitest';
import { markupForMutation, mutators, runMutations, seedFrom } from './mutations.js';
import { groupTwigBlocks } from '../../src/twig/blocks.js';
import { tokenizeTwig } from '../../src/twig/tokens.js';

const template = [
  '<section class="a">',
  '  <ul>',
  '    {% for item in items %}',
  '      <li class="b" id="c">{{ item }}</li>',
  '    {% endfor %}',
  '  </ul>',
  '  <p>text</p>',
  '</section>',
  '',
].join('\n');

function outcomeFor(name: string) {
  return runMutations(template, 0).find((outcome) => outcome.mutator === name);
}

describe('runMutations', () => {
  it('flags a dropped close tag, a stray close tag and a broken Twig print', () => {
    expect(outcomeFor('drop-close-tag')?.isFlagged).toBe(true);
    expect(outcomeFor('stray-close-tag')?.isFlagged).toBe(true);
    expect(outcomeFor('unterminate-print')?.isFlagged).toBe(true);
  });

  it('does not flag edits that change nothing the parser reads', () => {
    for (const name of ['tab-between-attributes', 'append-text', 'append-html-comment']) {
      expect(outcomeFor(name), name).toMatchObject({ isFlagged: false });
    }
  });

  it('says where the edit was and whether the flagged span covers it', () => {
    expect(outcomeFor('stray-close-tag')).toMatchObject({ isFlaggedAtTheEdit: true });
  });

  it('chooses the same edit for the same seed', () => {
    expect(runMutations(template, 7)).toEqual(runMutations(template, 7));
    expect(seedFrom('a.twig')).toBe(seedFrom('a.twig'));
  });

  it('only edits markup, never Twig, comments or script content', () => {
    const source = '{# </p> #}<!-- </p> --><script>"</p>"</script>{{ "</p>" }}<p>x</p>';
    const markup = markupForMutation(source, groupTwigBlocks(tokenizeTwig(source)));
    expect(markup.match(/<\/p>/g)).toHaveLength(1);
    expect(markup).toHaveLength(source.length);
  });

  it('has a mutator for every kind it reports', () => {
    expect(new Set(mutators.map((mutator) => mutator.kind))).toEqual(new Set(['defect', 'harmless']));
  });
});

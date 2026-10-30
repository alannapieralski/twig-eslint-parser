import { isClosingTag, isMiddleTag, isOpeningTag } from 'twig-eslint-parser';
import type { TwigBlockSummary } from 'twig-eslint-parser';
import type { TwigSegment } from './types.js';

type OpenFrame = { readonly name: string; readonly frameStart: number; readonly segmentStart: number; readonly boundaryStart: number };

export function twigBlockEnd(block: TwigBlockSummary, text: string): number {
  return text.lastIndexOf('}', block.range[1] - 1) + 1;
}

export function findTwigSegments(blocks: readonly TwigBlockSummary[], text: string): TwigSegment[] {
  const openFrames: OpenFrame[] = [];
  const segments: TwigSegment[] = [];

  for (const block of blocks) {
    if (isOpeningTag(block)) {
      openFrames.push({ name: block.tagName ?? '', frameStart: block.range[0], segmentStart: twigBlockEnd(block, text), boundaryStart: block.range[0] });
      continue;
    }

    const isFrameBoundary = isMiddleTag(block) || isClosingTag(block);
    if (!isFrameBoundary) continue;

    const frame = openFrames.pop();
    if (!frame) throw new Error(`The Twig tag at offset ${block.range[0]} closes nothing. The parser rejects unpaired Twig tags, so this is a bug.`);

    segments.push({
      range: [frame.segmentStart, block.range[0]],
      extent: [frame.boundaryStart, twigBlockEnd(block, text)],
      frameStart: frame.frameStart,
      frameName: frame.name,
    });

    if (isMiddleTag(block)) openFrames.push({ ...frame, segmentStart: twigBlockEnd(block, text), boundaryStart: block.range[0] });
  }

  return segments;
}

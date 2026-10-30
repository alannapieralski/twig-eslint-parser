import { isRangeWithin } from 'twig-eslint-parser';
import { findInterpolatedAttributeProblems, findInterpolatedStringProblems, findOmittedAttributeProblems } from './find-twig-interpolation-problems.js';
import type { OmittedAttribute, TwigStringSummary } from 'twig-eslint-parser';
import type { Problem } from '../../shared/problem.js';
import type { ResolvedOptions } from './options.js';
import type { TagWithAttributes } from './types.js';

export type InterpolationReport = {
  readonly addTag: (tag: TagWithAttributes) => void;
  readonly findProblems: () => Problem[];
};

type InterpolationSource = { readonly omittedAttributes: readonly OmittedAttribute[]; readonly strings: readonly TwigStringSummary[] };

export function createInterpolationReport(source: InterpolationSource, options: ResolvedOptions): InterpolationReport {
  const tagProblems: Problem[] = [];

  return {
    addTag: (tag) => tagProblems.push(...findInterpolatedAttributeProblems(tag, options)),
    findProblems: () => {
      const attributeProblems = [...tagProblems, ...findOmittedAttributeProblems(source.omittedAttributes, options)];
      const isInReportedAttribute = (problem: Problem) => attributeProblems.some((attributeProblem) => isRangeWithin(problem.range, attributeProblem.range));
      const stringProblems = findInterpolatedStringProblems(source.strings).filter((problem) => !isInReportedAttribute(problem));

      return [...attributeProblems, ...stringProblems];
    },
  };
}

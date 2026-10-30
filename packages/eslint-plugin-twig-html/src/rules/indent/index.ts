import { readTwigServices } from 'twig-eslint-parser';
import { docsUrlFor } from '../../shared/docs-url.js';
import { reportProblems } from '../../shared/report-problems.js';
import { createTagSource } from '../../shared/tag-source.js';
import { findIndentProblems } from './find-indent-problems.js';
import { messages } from './messages.js';
import { indentSizeSchema, optionsSchema, resolveOptions } from './options.js';
import { readRawContentTags } from './html/raw-content-tags.js';
import type { Rule } from 'eslint';
import type { MarkupProgram } from './find-indent-problems.js';

export const indent: Rule.RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Indent HTML and Twig blocks one step per level of nesting',
      url: docsUrlFor('indent'),
    },
    fixable: 'whitespace',
    schema: [indentSizeSchema, optionsSchema],
    messages,
  },

  create(context) {
    const options = resolveOptions(context.options[0], context.options[1]);
    const services = readTwigServices(context.sourceCode, context.id);
    const { text, blocks, attributesOf, unreadableTagStarts } = createTagSource(context.sourceCode, services);
    const { strings } = services;
    const rawContentTags = readRawContentTags(context.languageOptions.parserOptions);

    const checkProgram = (program: unknown) => reportProblems(context, findIndentProblems(program as MarkupProgram, { text, blocks, attributesOf, rawContentTags, strings, unreadableTagStarts }, options));

    return { Program: checkProgram };
  },
};

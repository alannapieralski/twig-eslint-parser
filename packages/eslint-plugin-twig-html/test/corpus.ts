import { ruleChecks, type PackageCorpus } from '../../../tools/corpus/src/index.js';
import twigHtml from '../src/index.js';

export default {
  package: 'eslint-plugin-twig-html',
  checks: ruleChecks({ plugin: twigHtml, prefix: 'twig-html', rules: { 'attrs-newline': { fixKeeps: 'layout' } } }),
} satisfies PackageCorpus;

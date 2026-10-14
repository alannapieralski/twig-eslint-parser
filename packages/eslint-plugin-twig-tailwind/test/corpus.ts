import { ruleChecks, type PackageCorpus } from '../../../tools/corpus/src/index.js';
import twigTailwind from '../src/index.js';

export default {
  package: 'eslint-plugin-twig-tailwind',
  checks: ruleChecks({ plugin: twigTailwind, prefix: 'twig-tailwind' }),
} satisfies PackageCorpus;

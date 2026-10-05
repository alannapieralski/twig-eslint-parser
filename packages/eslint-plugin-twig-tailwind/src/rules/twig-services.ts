import type { Rule } from 'eslint';
import type { TwigParserServices } from 'twig-eslint-parser';

export function readTwigServices(context: Rule.RuleContext): TwigParserServices {
  const services = context.sourceCode.parserServices as { twig?: TwigParserServices } | undefined;
  if (!services?.twig) {
    throw new Error(`${context.id} needs twig-eslint-parser as the parser for this file.`);
  }
  return services.twig;
}

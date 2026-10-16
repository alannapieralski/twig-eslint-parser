export const messages = {
  twigInAttribute: 'Avoid Twig inside {{name}}="": linters cannot see what it produces. Build the value with {% set classes = [...] %} and attributes.addClass(), or pass it to an include as { classes: [...] }.',
} as const;

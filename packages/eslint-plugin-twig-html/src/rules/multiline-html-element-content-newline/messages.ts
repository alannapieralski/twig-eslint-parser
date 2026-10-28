export const messages = {
  unexpectedAfterClosingBracket: 'Expected 1 line break after opening tag (`{{tag}}`), but {{actual}} line breaks found.',
  unexpectedBeforeOpeningBracket: 'Expected 1 line break before closing tag (`{{tag}}`), but {{actual}} line breaks found.',
} as const;

export type MessageId = keyof typeof messages;

export const messages = {
  unexpectedAfterClosingBracket: 'Expected 1 line break after opening tag (`{{writtenTag}}`), but {{actual}} line breaks found.',
  unexpectedBeforeOpeningBracket: 'Expected 1 line break before closing tag (`{{writtenTag}}`), but {{actual}} line breaks found.',
} as const;

export type MessageId = keyof typeof messages;

/*
 * Derived from twig-lexer 1.0.0 (https://gitlab.com/nightlycommit/twig-lexer,
 * revision dda1882), Copyright Eric MORAND, licensed under the Apache
 * License, Version 2.0. Modified by Numiko, 2026: see
 * third_party/twig-lexer/UPSTREAM.md for every change.
 */
export type TokenType =
    "CLOSING_QUOTE" |
    "COMMENT_END" |
    "COMMENT_START" |
    "EOF" |
    "INLINE_COMMENT" |
    "INTERPOLATION_START" |
    "INTERPOLATION_END" |
    "LINE_TRIMMING_MODIFIER" |
    "NAME" |
    "NUMBER" |
    "OPENING_QUOTE" |
    "OPERATOR" |
    "PUNCTUATION" |
    "SPREAD_OPERATOR" |
    "STRING" |
    "TAG_END" |
    "TAG_START" |
    "TEST_OPERATOR" |
    "TEXT" |
    "TRIMMING_MODIFIER" |
    "VARIABLE_END" |
    "VARIABLE_START" |
    "WHITESPACE" |
    "ARROW"
    ;
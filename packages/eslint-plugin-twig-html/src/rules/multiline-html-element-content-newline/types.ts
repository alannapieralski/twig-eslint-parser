import type { Range } from '../../shared/range.js';
import type { MessageId } from './messages.js';

export type ContentEdge = { readonly range: Range; readonly messageId: MessageId; readonly indentationWhenMissing: string };

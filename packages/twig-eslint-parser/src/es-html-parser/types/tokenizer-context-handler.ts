import { CharsBuffer } from "../tokenizer/chars-buffer.js";
import { TokenizerState } from "./tokenizer-state.js";

export interface TokenizeHandler {
  parse(chars: CharsBuffer, state: TokenizerState): void;
  handleContentEnd?: (state: TokenizerState) => void;
}

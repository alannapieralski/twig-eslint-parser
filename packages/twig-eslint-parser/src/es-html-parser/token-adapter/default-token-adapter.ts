import type { TokenAdapter } from "../types/index.js";

export const defaultTokenAdapter: TokenAdapter = {
  finalizeRange(token) {
    return token.range;
  },
  finalizeLocation(token) {
    return token.loc;
  },
};

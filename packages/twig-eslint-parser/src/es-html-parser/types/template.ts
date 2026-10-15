import { Range } from "./range.js";

export type TemplateKind = "print" | "tag" | "comment";

export type TemplateWrapper = {
  open: Range;
  close: Range;
  kind?: TemplateKind;
  role?: "attributes";
};

export type TemplateInfo = Range | TemplateWrapper;

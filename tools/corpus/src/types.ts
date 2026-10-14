export type TailwindSettings = { readonly cwd?: string; readonly entryPoint?: string; readonly tsconfig?: string };
export type CorpusRoot = { readonly path: string; readonly quick: boolean; readonly tailwind?: TailwindSettings };

export type Template = {
  readonly root: string;
  readonly path: string;
  readonly relativePath: string;
  readonly source: string;
};

export type Finding = {
  readonly check: string;
  readonly severity: 'failure' | 'report' | 'skipped';
  readonly template: Template;
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly endLine?: number;
  readonly endColumn?: number;
  readonly before?: string;
  readonly after?: string;
};

export type FixChange = {
  readonly template: Template;
  readonly before: string;
  readonly after: string;
};

export type CoverageSpan = {
  readonly startLine: number;
  readonly endLine: number;
  readonly label: string;
  readonly detail: string;
  readonly isExcused: boolean;
};

export type TemplateCoverage = {
  readonly template: Template;
  readonly lines: number;
  readonly uncovered: number;
  readonly excused: number;
  readonly spans: readonly CoverageSpan[];
};

export type CheckContext = {
  readonly sampleSize: number;
  readonly roots: ReadonlyMap<string, CorpusRoot>;
  readonly progress: (done: number, counts?: Readonly<Record<string, number>>) => void;
};

export type CheckOutcome = {
  readonly findings: readonly Finding[];
  readonly stats: Readonly<Record<string, number>>;
  readonly skipped?: string;
  readonly changes?: readonly FixChange[];
  readonly lineCoverage?: readonly TemplateCoverage[];
};

export type Check = {
  readonly id: string;
  readonly rule?: string;
  readonly isSlow?: boolean;
  readonly run: (templates: readonly Template[], context: CheckContext) => Promise<CheckOutcome> | CheckOutcome;
};

export type PackageCorpus = {
  readonly package: string;
  readonly checks: readonly Check[];
};

export type CorpusOptions = {
  readonly package?: string;
  readonly rule?: string;
  readonly check?: string;
  readonly roots?: readonly string[];
  readonly quick: boolean;
  readonly sample: number;
  readonly updateBaseline: boolean;
  readonly strict: boolean;
  readonly slow: boolean;
  readonly list: boolean;
};

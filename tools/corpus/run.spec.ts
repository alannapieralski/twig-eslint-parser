import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkOfKey, findingKey, loadBaseline, writeBaseline } from './src/baseline.js';
import { discoverTemplates, loadConfig } from './src/config.js';
import { buildCheckReports, writeReport, type CheckResult } from './src/report.js';
import { selectChecks } from './src/select.js';
import type { CorpusOptions, PackageCorpus, Template } from './src/types.js';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const reportDirectory = resolve(repositoryRoot, 'corpus-report');
const baselinePath = resolve(repositoryRoot, 'corpus.baseline.json');

function readOptions(): CorpusOptions {
  const raw = process.env['CORPUS_OPTIONS'];
  if (raw === undefined) throw new Error('Run the corpus with npm run corpus, which passes the options.');
  return JSON.parse(raw) as CorpusOptions;
}

const options = readOptions();
const packages = Object.values(import.meta.glob<{ default: PackageCorpus }>('../../packages/*/test/corpus.ts', { eager: true })).map((module) => module.default);
const selectedChecks = selectChecks(packages, options);

describe.skipIf(!options.list)('corpus checks', () => {
  it('lists the checks that match', () => {
    console.info(selectedChecks.map(({ package: packageName, check }) => `${packageName}: ${check.id}`).join('\n'));
  });
});

describe.skipIf(options.list)('corpus', () => {
  const baseline = loadBaseline(baselinePath);
  const results: CheckResult[] = [];
  let templates: Template[] = [];

  beforeAll(() => {
    templates = discoverTemplates(loadConfig(repositoryRoot, process.env), options);
    expect(templates.length, 'no templates found in the corpus roots').toBeGreaterThan(0);
  });

  it.each(selectedChecks)('$check.id', async ({ package: packageName, check }) => {
    const started = performance.now();
    const outcome = await check.run(templates, { sampleSize: options.sample });
    const result: CheckResult = { package: packageName, check, outcome, seconds: (performance.now() - started) / 1000 };
    results.push(result);
    const [report] = buildCheckReports([result], baseline);
    if (options.updateBaseline || !report || report.newFailures.length === 0) return;
    throw new Error(`${report.newFailures.length} failures are not in the baseline. See corpus-report/summary.md.`);
  });

  afterAll(() => {
    const rootCount = new Set(templates.map((template) => template.root)).size;
    const reports = buildCheckReports(results, baseline);
    console.info(writeReport(reportDirectory, { results, reports, baseline, templateCount: templates.length, rootCount, sampleSize: options.sample }));
    if (!options.updateBaseline) return;
    const checksRun = new Set(results.map(({ check }) => check.id));
    const kept = [...baseline].filter((key) => !checksRun.has(checkOfKey(key)));
    const recorded = results.flatMap(({ outcome }) => outcome.findings.filter((finding) => finding.severity === 'failure').map(findingKey));
    writeBaseline(baselinePath, [...kept, ...recorded]);
    console.info(`Baseline updated: corpus.baseline.json`);
  });
});

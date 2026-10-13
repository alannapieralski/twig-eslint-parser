import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkOfKey, findingKey, loadBaseline, writeBaseline } from './src/baseline.js';
import { discoverTemplates, loadConfig } from './src/config.js';
import { createProgressReporter, stderrOutput } from './src/progress.js';
import { buildCheckReport, buildCheckReports, writeReport, type CheckResult } from './src/report.js';
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
const reporter = createProgressReporter(stderrOutput(process.env['CORPUS_TTY'] === '1'));
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
    const countsByRoot = Map.groupBy(templates, (template) => template.root);
    reporter.phase(`config: ${countsByRoot.size} roots, ${templates.length} templates, ${selectedChecks.length} checks`);
    for (const [root, rootTemplates] of countsByRoot) reporter.phase(`  ${rootTemplates.length} templates in ${root}`);
  });

  const numberedChecks = selectedChecks.map((selected, index) => ({ ...selected, position: `${index + 1}/${selectedChecks.length}` }));

  it.each(numberedChecks)('$check.id', async ({ package: packageName, check, position }) => {
    const label = `${position} ${check.id}`;
    reporter.phase(`${label}: starting`);
    const started = performance.now();
    const outcome = await check.run(templates, { sampleSize: options.sample, progress: reporter.track(label, templates.length) });
    const result: CheckResult = { package: packageName, check, outcome, seconds: (performance.now() - started) / 1000 };
    results.push(result);
    const report = buildCheckReport(result, baseline);
    reporter.phase(report.skipped === undefined
      ? `${label}: done in ${report.seconds.toFixed(1)}s, ${report.reports} reports, ${report.failures} failures (${report.newFailures.length} new)`
      : `${label}: skipped, ${report.skipped}`);
    if (options.updateBaseline || report.newFailures.length === 0) return;
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

// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  classifyEntry,
  parseRawEntry,
  runKbIngestion,
} from '../lib/kb-ingestion.js';

const tmpRoots = [];

afterEach(() => {
  for (const root of tmpRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function makeKb() {
  const root = path.join(os.tmpdir(), `mc-kb-ingest-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  tmpRoots.push(root);
  mkdirSync(path.join(root, 'raw', 'marketing'), { recursive: true });
  mkdirSync(path.join(root, 'wiki'), { recursive: true });
  writeFileSync(path.join(root, 'wiki', 'distribution.md'), '# Distribution\n');
  return root;
}

describe('KB ingestion automation', () => {
  it('routes StageSnap raw notes to wiki updates and task drafts', () => {
    const kbRoot = makeKb();
    const rawPath = path.join(kbRoot, 'raw', 'marketing', '2026-06-16-brokerage-outreach.md');
    writeFileSync(rawPath, [
      '---',
      'title: "Brokerage Lunch And Learn Outreach"',
      'source: "https://example.com/source"',
      'type: note',
      'date_captured: 2026-06-16',
      'tags: [StageSnap, outreach, brokerage]',
      '---',
      '',
      '# Brokerage plan',
      '',
      'StageSnap should test brokerage lunch-and-learns with before/after renovation visuals.',
      'Action item: draft a Mission Control implementation task for an outreach tracker and call script.',
    ].join('\n'));

    const entry = parseRawEntry(rawPath, kbRoot);
    expect(entry.title).toBe('Brokerage Lunch And Learn Outreach');
    expect(entry.tags).toContain('stagesnap');

    const classification = classifyEntry(entry);
    expect(classification.isStageSnapRelevant).toBe(true);
    expect(classification.clusters).toEqual(expect.arrayContaining(['distribution', 'outreach']));

    const result = runKbIngestion({
      kbRoot,
      now: new Date('2026-06-16T20:00:00.000Z'),
    });

    expect(result.processed).toHaveLength(1);
    expect(result.taskDrafts.length).toBeGreaterThan(0);
    expect(result.taskDrafts[0]).toMatchObject({
      status: 'backlog',
      priority: 'medium',
      source: 'raw/marketing/2026-06-16-brokerage-outreach.md',
    });

    const distribution = readFileSync(path.join(kbRoot, 'wiki', 'distribution.md'), 'utf8');
    expect(distribution).toContain('Automated KB Ingest');
    expect(distribution).toContain('Brokerage Lunch And Learn Outreach');
    expect(distribution).toContain('../raw/marketing/2026-06-16-brokerage-outreach.md');

    const drafts = JSON.parse(readFileSync(
      path.join(kbRoot, 'compilations', 'task-drafts', '2026-06-16-mission-control-task-drafts.json'),
      'utf8',
    ));
    expect(drafts.note).toContain('Drafts only');
    expect(drafts.tasks[0].tags).toContain('kb-draft');

    const dryRun = runKbIngestion({
      kbRoot,
      dryRun: true,
      now: new Date('2026-06-16T20:05:00.000Z'),
    });
    expect(dryRun.selectedFiles).toHaveLength(0);
  });

  it('does not write files in dry-run mode', () => {
    const kbRoot = makeKb();
    writeFileSync(path.join(kbRoot, 'raw', 'marketing', '2026-06-16-dry-run.md'), [
      '---',
      'title: "StageSnap dry run"',
      'tags: [StageSnap, product]',
      '---',
      'Add a dry-run check before publishing outreach.',
    ].join('\n'));

    const result = runKbIngestion({
      kbRoot,
      dryRun: true,
      now: new Date('2026-06-16T20:00:00.000Z'),
    });

    expect(result.selectedFiles).toHaveLength(1);
    expect(result.taskDrafts.length).toBeGreaterThan(0);
    expect(() => readFileSync(path.join(kbRoot, '.kb-ingest-state.json'), 'utf8')).toThrow();
  });
});

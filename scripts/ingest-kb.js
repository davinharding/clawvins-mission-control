#!/usr/bin/env node

import {
  acquireLock,
  getKbPaths,
  parseArgs,
  runKbIngestion,
} from '../server/lib/kb-ingestion.js';

const options = parseArgs(process.argv.slice(2));
const paths = getKbPaths(options.kbRoot);
let releaseLock = null;

try {
  releaseLock = acquireLock(paths.lockFile);
  const result = runKbIngestion(options);

  console.log(`KB root: ${result.paths.root}`);
  console.log(`Mode: ${result.dryRun ? 'dry-run' : 'write'}`);
  console.log(`Raw entries selected: ${result.selectedFiles.length}`);
  console.log(`Wiki pages updated: ${Object.keys(result.wikiUpdates).length}`);
  console.log(`Mission Control task drafts: ${result.taskDrafts.length}`);

  if (result.taskDrafts.length > 0) {
    console.log('');
    console.log('Drafts:');
    for (const draft of result.taskDrafts.slice(0, 20)) {
      console.log(`- [${draft.priority}] ${draft.title} (${draft.cluster}, ${draft.assignedAgent})`);
    }
    if (result.taskDrafts.length > 20) {
      console.log(`- ...and ${result.taskDrafts.length - 20} more`);
    }
  }

  if (result.dryRun) {
    console.log('');
    console.log('Dry run only. No wiki, digest, task draft, or state files were written.');
  } else {
    console.log('');
    console.log(`Action digest directory: ${result.paths.actionDigests}`);
    console.log(`Task draft directory: ${result.paths.taskDrafts}`);
  }
} catch (err) {
  if (err && err.code === 'EEXIST') {
    console.error(`KB ingestion already running or stale lock exists: ${paths.lockFile}`);
  } else {
    console.error(err.stack || err.message || err);
  }
  process.exitCode = 1;
} finally {
  if (releaseLock) releaseLock();
}

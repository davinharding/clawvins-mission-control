import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_KB_ROOT = '/home/node/.openclaw/workspace/kb';

const ROUTES = {
  product: {
    wikiFile: 'product-roadmap.md',
    label: 'Product',
    agent: 'agent-patch',
    keywords: [
      'stagesnap', 'feature', 'roadmap', 'ux', 'ui', 'virtual staging',
      'renovate', 'remodel', 'listing video', 'stripe', 'billing', 'onboarding',
      'bulk staging', 'staged photo', 'property photo', 'support chatbot', 'email notification',
    ],
  },
  distribution: {
    wikiFile: 'distribution.md',
    label: 'Distribution',
    agent: 'agent-nova',
    keywords: [
      'distribution', 'growth', 'gtm', 'go-to-market', 'creator', 'tiktok', 'reels',
      'linkedin', 'content', 'ads', 'seo', 'affiliate', 'partnership', 'channel',
      'viral', 'launch', 'audience', 'marketing',
    ],
  },
  outreach: {
    wikiFile: 'outreach.md',
    label: 'Outreach',
    agent: 'agent-iris',
    keywords: [
      'outreach', 'cold call', 'cold email', 'dm', 'follow up', 'lead', 'broker',
      'brokerage', 'realtor', 'real estate agent', 'photographer', 'sales meeting', 'lunch-and-learn',
      'email script', 'voicemail', 'prospect',
    ],
  },
};

const CATEGORY_DEFAULTS = {
  product: ['product'],
  marketing: ['distribution'],
  competitors: ['distribution'],
};

const ACTION_WORDS = [
  'add',
  'audit',
  'build',
  'call',
  'create',
  'draft',
  'email',
  'fix',
  'follow up',
  'implement',
  'launch',
  'publish',
  'reach out',
  'research',
  'ship',
  'test',
  'update',
];

const WRITE_MARKER_START = '<!-- kb-auto-ingest:start -->';
const WRITE_MARKER_END = '<!-- kb-auto-ingest:end -->';

export function getKbPaths(kbRoot = process.env.KB_ROOT || DEFAULT_KB_ROOT) {
  return {
    root: kbRoot,
    raw: path.join(kbRoot, 'raw'),
    wiki: path.join(kbRoot, 'wiki'),
    compilations: path.join(kbRoot, 'compilations'),
    actionDigests: path.join(kbRoot, 'compilations', 'action-digests'),
    taskDrafts: path.join(kbRoot, 'compilations', 'task-drafts'),
    stateFile: path.join(kbRoot, '.kb-ingest-state.json'),
    lockFile: path.join(kbRoot, '.kb-ingest.lock'),
  };
}

export function parseArgs(argv) {
  const options = {
    kbRoot: process.env.KB_ROOT || DEFAULT_KB_ROOT,
    dryRun: false,
    all: false,
    limit: 0,
    now: new Date(),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--all') options.all = true;
    else if (arg === '--kb-root') {
      options.kbRoot = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--kb-root=')) {
      options.kbRoot = arg.slice('--kb-root='.length);
    } else if (arg === '--limit') {
      options.limit = Number.parseInt(argv[i + 1] || '0', 10) || 0;
      i += 1;
    } else if (arg.startsWith('--limit=')) {
      options.limit = Number.parseInt(arg.slice('--limit='.length), 10) || 0;
    }
  }

  return options;
}

export function loadState(stateFile) {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    return { version: 1, processed: {} };
  }
}

export function saveState(stateFile, state) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
}

export function scanRawEntries(rawDir) {
  if (!fs.existsSync(rawDir)) return [];

  const entries = [];
  const walk = (dir) => {
    for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (dirent.name.startsWith('.')) continue;
      const fullPath = path.join(dir, dirent.name);
      if (dirent.isDirectory()) {
        walk(fullPath);
      } else if (dirent.isFile() && dirent.name.endsWith('.md')) {
        entries.push(fullPath);
      }
    }
  };
  walk(rawDir);
  return entries.sort();
}

export function fileFingerprint(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const stat = fs.statSync(filePath);
  return {
    checksum: crypto.createHash('sha256').update(text).digest('hex'),
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    text,
  };
}

export function parseRawEntry(filePath, kbRoot) {
  const { text, checksum, mtimeMs, size } = fileFingerprint(filePath);
  const relativePath = path.relative(kbRoot, filePath);
  const rawRelativePath = path.relative(path.join(kbRoot, 'raw'), filePath);
  const parts = rawRelativePath.split(path.sep);
  const category = parts.length > 1 ? parts[0] : 'uncategorized';
  const parsed = parseFrontmatter(text);
  const title = parsed.frontmatter.title || findHeading(parsed.body) || titleFromFilename(filePath);
  const tags = normalizeTags(parsed.frontmatter.tags);
  const summary = summarizeBody(parsed.body);

  return {
    filePath,
    relativePath,
    rawRelativePath,
    category,
    checksum,
    mtimeMs,
    size,
    title,
    tags,
    source: parsed.frontmatter.source || '',
    type: parsed.frontmatter.type || category,
    dateCaptured: parsed.frontmatter.date_captured || parsed.frontmatter.date || inferDate(filePath),
    body: parsed.body,
    summary,
  };
}

export function classifyEntry(entry) {
  const haystack = [
    entry.title,
    entry.category,
    entry.tags.join(' '),
    entry.summary,
    entry.body.slice(0, 4000),
  ].join(' ').toLowerCase();

  const clusters = new Set(CATEGORY_DEFAULTS[entry.category] || []);
  for (const [cluster, route] of Object.entries(ROUTES)) {
    if (route.keywords.some((keyword) => haystack.includes(keyword))) {
      clusters.add(cluster);
    }
  }

  const alwaysStageSnapCategories = ['product', 'marketing', 'competitors'];
  const nonStageSnapDefaultCategories = ['finance', 'legal', 'personal'];
  const hasExplicitStageSnap = haystack.includes('stagesnap')
    && !nonStageSnapDefaultCategories.includes(entry.category);
  const hasRealEstateProductSignal = haystack.includes('virtual staging')
    || haystack.includes('listing photo')
    || haystack.includes('real estate photographer')
    || haystack.includes('real estate agent')
    || (haystack.includes('real estate') && /(staging|listing|broker|outreach|photographer|property)/.test(haystack));
  const isStageSnapRelevant = hasExplicitStageSnap
    || hasRealEstateProductSignal
    || alwaysStageSnapCategories.includes(entry.category);

  if (isStageSnapRelevant && clusters.size === 0) clusters.add('product');

  return {
    clusters: [...clusters],
    isStageSnapRelevant,
  };
}

export function extractActionDrafts(entry, classification) {
  const candidates = splitActionCandidates(entry.body)
    .filter((candidate) => looksActionable(candidate))
    .slice(0, 3);

  return candidates.map((candidate, index) => {
    const cluster = chooseActionCluster(candidate, classification.clusters);
    const route = ROUTES[cluster] || ROUTES.product;
    return {
      title: makeTaskTitle(candidate, entry.title),
      description: [
        candidate.trim(),
        '',
        `Source: ${entry.relativePath}`,
        entry.source ? `Original source: ${entry.source}` : null,
        `KB route: ${route.label}`,
      ].filter(Boolean).join('\n'),
      status: 'backlog',
      priority: inferPriority(candidate, entry, classification),
      assignedAgent: route.agent,
      tags: unique(['kb-draft', 'kb-ingest', cluster, ...entry.tags.slice(0, 6)]),
      source: entry.relativePath,
      cluster,
      draftId: `${slugify(entry.rawRelativePath)}-${index + 1}`,
    };
  });
}

export function buildWikiUpdate(entry, classification, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  const tags = unique(['kb-ingest', ...entry.tags, ...classification.clusters]).slice(0, 10);
  return [
    `### ${entry.dateCaptured || date}: ${entry.title}`,
    `- Summary: ${entry.summary}`,
    `- Source: [${entry.rawRelativePath}](../raw/${entry.rawRelativePath.split(path.sep).join('/')})`,
    entry.source ? `- Original: ${entry.source}` : null,
    `- Tags: ${tags.map((tag) => `\`${tag}\``).join(', ')}`,
  ].filter(Boolean).join('\n');
}

export function applyGeneratedSection(existing, generatedBody, now = new Date()) {
  const header = [
    WRITE_MARKER_START,
    '## Automated KB Ingest',
    '',
    `> Maintained by \`npm run kb:ingest\`. Last updated: ${now.toISOString().slice(0, 10)}.`,
    '',
    generatedBody.trim(),
    WRITE_MARKER_END,
  ].join('\n');

  if (existing.includes(WRITE_MARKER_START) && existing.includes(WRITE_MARKER_END)) {
    const before = existing.slice(0, existing.indexOf(WRITE_MARKER_START)).trimEnd();
    const after = existing.slice(existing.indexOf(WRITE_MARKER_END) + WRITE_MARKER_END.length).trimStart();
    return [before, header, after].filter(Boolean).join('\n\n') + '\n';
  }

  return `${existing.trimEnd()}\n\n${header}\n`;
}

export function buildDigest(processed, taskDrafts, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  const lines = [
    `# KB Action Digest - ${date}`,
    '',
    `Processed ${processed.length} raw KB entr${processed.length === 1 ? 'y' : 'ies'}.`,
    `Drafted ${taskDrafts.length} Mission Control task${taskDrafts.length === 1 ? '' : 's'} for review.`,
    '',
    'No external messages were published by this run.',
    '',
    '## New Wiki Inputs',
  ];

  if (processed.length === 0) {
    lines.push('- None');
  } else {
    for (const item of processed) {
      lines.push(`- ${item.entry.title} -> ${item.classification.clusters.join(', ') || 'unrouted'} (${item.entry.relativePath})`);
    }
  }

  lines.push('', '## Task Drafts');
  if (taskDrafts.length === 0) {
    lines.push('- None');
  } else {
    for (const draft of taskDrafts) {
      lines.push(`- [${draft.priority}] ${draft.title} (${draft.cluster}, ${draft.assignedAgent})`);
    }
  }

  return `${lines.join('\n')}\n`;
}

export function buildTaskDraftPayload(drafts, now = new Date()) {
  return {
    generatedAt: now.toISOString(),
    note: 'Drafts only. Review before creating Mission Control tasks or sending external messages.',
    tasks: drafts,
  };
}

export function runKbIngestion(options = {}) {
  const now = options.now || new Date();
  const paths = getKbPaths(options.kbRoot);
  const state = loadState(paths.stateFile);
  const files = scanRawEntries(paths.raw);
  const selectedFiles = [];

  for (const filePath of files) {
    const fingerprint = fileFingerprint(filePath);
    const relativePath = path.relative(paths.root, filePath);
    const previous = state.processed[relativePath];
    if (options.all || !previous || previous.checksum !== fingerprint.checksum) {
      selectedFiles.push(filePath);
    }
    if (options.limit > 0 && selectedFiles.length >= options.limit) break;
  }

  const processed = selectedFiles.map((filePath) => {
    const entry = parseRawEntry(filePath, paths.root);
    const classification = classifyEntry(entry);
    const taskDrafts = classification.isStageSnapRelevant
      ? extractActionDrafts(entry, classification)
      : [];
    return { entry, classification, taskDrafts };
  });

  const wikiUpdates = groupWikiUpdates(processed, now);
  const taskDrafts = processed.flatMap((item) => item.taskDrafts);
  const digest = buildDigest(processed, taskDrafts, now);
  const taskDraftPayload = buildTaskDraftPayload(taskDrafts, now);

  if (!options.dryRun) {
    fs.mkdirSync(paths.wiki, { recursive: true });
    fs.mkdirSync(paths.actionDigests, { recursive: true });
    fs.mkdirSync(paths.taskDrafts, { recursive: true });

    for (const [wikiFile, updates] of Object.entries(wikiUpdates)) {
      const wikiPath = path.join(paths.wiki, wikiFile);
      const existing = fs.existsSync(wikiPath)
        ? fs.readFileSync(wikiPath, 'utf8')
        : `# ${wikiTitleFromFile(wikiFile)}\n`;
      const existingSources = extractGeneratedSources(existing);
      const nextUpdates = updates.filter((update) => !existingSources.has(update.source));
      if (nextUpdates.length === 0) continue;
      const generatedBody = [
        existingGeneratedBody(existing),
        nextUpdates.map((update) => update.markdown).join('\n\n'),
      ].filter(Boolean).join('\n\n');
      fs.writeFileSync(wikiPath, applyGeneratedSection(existing, generatedBody, now));
    }

    const stamp = now.toISOString().slice(0, 10);
    fs.writeFileSync(path.join(paths.actionDigests, `${stamp}-kb-action-digest.md`), digest);
    fs.writeFileSync(
      path.join(paths.taskDrafts, `${stamp}-mission-control-task-drafts.json`),
      `${JSON.stringify(taskDraftPayload, null, 2)}\n`,
    );

    for (const item of processed) {
      state.processed[item.entry.relativePath] = {
        checksum: item.entry.checksum,
        mtimeMs: item.entry.mtimeMs,
        size: item.entry.size,
        processedAt: now.toISOString(),
        clusters: item.classification.clusters,
        taskDraftCount: item.taskDrafts.length,
      };
    }
    state.lastRunAt = now.toISOString();
    saveState(paths.stateFile, state);
  }

  return {
    paths,
    selectedFiles,
    processed,
    taskDrafts,
    digest,
    taskDraftPayload,
    wikiUpdates,
    dryRun: Boolean(options.dryRun),
  };
}

export function acquireLock(lockFile) {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  const fd = fs.openSync(lockFile, 'wx');
  fs.writeFileSync(fd, `${process.pid}\n${new Date().toISOString()}\n`);
  return () => {
    fs.closeSync(fd);
    fs.rmSync(lockFile, { force: true });
  };
}

function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return { frontmatter: {}, body: text.trim() };
  const end = text.indexOf('\n---', 4);
  if (end === -1) return { frontmatter: {}, body: text.trim() };

  const raw = text.slice(4, end).trim();
  const body = text.slice(end + 4).trim();
  const frontmatter = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }
  return { frontmatter, body };
}

function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(cleanTag).filter(Boolean);
  const text = String(tags).trim();
  const inner = text.startsWith('[') && text.endsWith(']') ? text.slice(1, -1) : text;
  return inner.split(',').map(cleanTag).filter(Boolean);
}

function cleanTag(tag) {
  return String(tag).trim().replace(/^['"]|['"]$/g, '').toLowerCase();
}

function findHeading(body) {
  const line = body.split('\n').find((candidate) => candidate.startsWith('# '));
  return line ? line.replace(/^#\s+/, '').trim() : '';
}

function titleFromFilename(filePath) {
  return path.basename(filePath, '.md')
    .replace(/^\d{4}-\d{2}-\d{2}-/, '')
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function summarizeBody(body) {
  const clean = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('---'))
    .join(' ')
    .replace(/\s+/g, ' ');
  if (clean.length <= 260) return clean || 'No body text available.';
  return `${clean.slice(0, 257).trim()}...`;
}

function inferDate(filePath) {
  const match = path.basename(filePath).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function splitActionCandidates(body) {
  const bulletLines = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !line.startsWith('#') && !line.startsWith('|'))
    .map((line) => line.replace(/^[-*]\s+\[[ xX]\]\s+/, '').replace(/^[-*]\s+/, '').trim())
    .filter((line) => line && !line.startsWith('|'));
  const sentenceLines = body
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return unique([...bulletLines, ...sentenceLines]).filter((line) => line.length >= 20 && line.length <= 320);
}

function looksActionable(text) {
  const lower = text.toLowerCase();
  if (lower.includes('no outreach') || lower.includes('do not ')) return false;
  return /^(action item|todo|next step|recommendation|recommended|stageSnap application):/i.test(text)
    || /^(add|audit|build|call|create|draft|email|fix|follow up|implement|launch|reach out|research|ship|test|update)\b/i.test(text)
    || /\b(should|need to|needs to|must)\s+(add|audit|build|create|draft|fix|implement|launch|research|test|update)\b/i.test(text)
    || ACTION_WORDS.some((word) => lower.startsWith(`${word} `));
}

function chooseActionCluster(text, clusters) {
  const lower = text.toLowerCase();
  for (const [cluster, route] of Object.entries(ROUTES)) {
    if (route.keywords.some((keyword) => lower.includes(keyword))) return cluster;
  }
  return clusters[0] || 'product';
}

function makeTaskTitle(candidate, fallbackTitle) {
  const cleaned = candidate
    .replace(/^(recommendation|next step|action item|todo):\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const title = cleaned.length > 88 ? `${cleaned.slice(0, 85).trim()}...` : cleaned;
  return title || `Review KB item: ${fallbackTitle}`;
}

function inferPriority(candidate, entry, classification) {
  const lower = `${candidate} ${entry.title} ${entry.tags.join(' ')}`.toLowerCase();
  if (/(critical|blocker|urgent|security|payment|stripe|revenue|customer|launch)/.test(lower)) return 'high';
  if (classification.isStageSnapRelevant) return 'medium';
  return 'low';
}

function groupWikiUpdates(processed, now) {
  const grouped = {};
  for (const item of processed) {
    for (const cluster of item.classification.clusters) {
      const route = ROUTES[cluster];
      if (!route) continue;
      grouped[route.wikiFile] ||= [];
      grouped[route.wikiFile].push({
        source: item.entry.relativePath,
        markdown: buildWikiUpdate(item.entry, item.classification, now),
      });
    }
  }
  return grouped;
}

function extractGeneratedSources(existing) {
  const sources = new Set();
  const matches = existing.matchAll(/- Source: \[[^\]]+\]\((?:\.\.\/raw\/)?([^)]+)\)/g);
  for (const match of matches) {
    sources.add(`raw/${match[1].replace(/^\.\.\/raw\//, '')}`);
  }
  return sources;
}

function existingGeneratedBody(existing) {
  if (!existing.includes(WRITE_MARKER_START) || !existing.includes(WRITE_MARKER_END)) return '';
  const section = existing.slice(
    existing.indexOf(WRITE_MARKER_START) + WRITE_MARKER_START.length,
    existing.indexOf(WRITE_MARKER_END),
  );
  return section
    .replace(/^## Automated KB Ingest[\s\S]*?\n\n/, '')
    .trim();
}

function wikiTitleFromFile(wikiFile) {
  return wikiFile
    .replace(/\.md$/, '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

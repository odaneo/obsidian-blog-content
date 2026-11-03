const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const YAML = require('yaml');

function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function frontmatter(text) {
  text = text.replace(/^\uFEFF/, '');
  const opening = /^---[ \t]*\r?\n/.exec(text);
  if (!opening) return null;
  const rest = text.slice(opening[0].length);
  const end = /^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/m.exec(rest);
  if (!end) {
    if (/^Published:[ \t]*true[ \t]*(?:#.*)?$/m.test(rest)) throw new Error('Published properties are not closed');
    return null;
  }
  return { yaml: rest.slice(0, end.index), content: rest.slice(end.index + end[0].length) };
}

function parseProperties(raw, file) {
  const document = YAML.parseDocument(raw, { uniqueKeys: true });
  if (document.errors.length) throw new Error('Invalid properties: ' + file);
  const data = document.toJS();
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Expected properties: ' + file);
  return data;
}

function buildSnapshot(root, repository, workflowRunNumber, branch = 'main', { allowDirty = false } = {}) {
  if (!repository || !Number.isSafeInteger(workflowRunNumber) || workflowRunNumber <= 0) throw new Error('Repository and a positive run number are required');
  if (!allowDirty && git(root, 'diff', '--name-only', 'HEAD', '--', '*.md')) throw new Error('Commit Markdown changes before building a snapshot');
  const result = { repository, branch, commitSha: git(root, 'rev-parse', 'HEAD'), workflowRunNumber,
    complete: true, articles: [], tags: [], subTags: [] };
  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(file);
    }
  }
  walk(root);
  for (const file of files.sort()) {
    const sourcePath = path.relative(root, file).replaceAll('\\', '/');
    const category = sourcePath.startsWith('Tags/') ? 'tags' : sourcePath.startsWith('SubTags/') ? 'subTags' : null;
    const header = frontmatter(fs.readFileSync(file, 'utf8'));
    if (!header) {
      if (category) throw new Error('Category properties missing: ' + sourcePath);
      continue;
    }
    // Draft properties and body are never parsed or added to the package.
    if (!category && !/^(?:Published|"Published"|'Published')[ \t]*:[ \t]*(?:true|True|TRUE)[ \t]*(?:#.*)?$/m.test(header.yaml)) continue;
    const data = parseProperties(header.yaml, sourcePath);
    if (!category && data.Published !== true) continue;
    if (typeof data.Id !== 'string' || !/^(?:[0-9a-f]{32}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i.test(data.Id))
      throw new Error('A fixed text UUID is required: ' + sourcePath);
    if (typeof data.Slug !== 'string' || !data.Slug.trim()) throw new Error('Slug is required: ' + sourcePath);
    const dirty = allowDirty && (git(root, 'diff', '--name-only', 'HEAD', '--', sourcePath) ||
      !git(root, 'ls-files', '--', sourcePath));
    const lastEditedTime = dirty ? fs.statSync(file).mtime.toISOString() : git(root, 'log', '-1', '--format=%cI', '--', sourcePath);
    if (!lastEditedTime) throw new Error('Note must be committed: ' + sourcePath);
    const common = { id: data.Id, sourcePath, slug: data.Slug, description: data.Description ?? null, lastEditedTime };
    if (category) {
      result[category].push({ ...common, lucideIconName: category === 'tags' ? data.LucideIconName ?? null : null });
    } else {
      const references = value => (Array.isArray(value) ? value : value == null ? [] : [value]).filter(item => typeof item === 'string');
      result.articles.push({ ...common, published: true, title: data.Title ?? path.basename(file, path.extname(file)),
        recommend: data.Recommend === true, content: header.content, tagRefs: references(data.TagRefs), subTags: references(data.SubTags) });
    }
  }
  return result;
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const argument = name => args[args.indexOf(name) + 1];
    const output = argument('--output');
    if (!args.includes('--output') || !output) throw new Error('--output is required');
    const snapshot = buildSnapshot(path.resolve(__dirname, '../..'), process.env.GITHUB_REPOSITORY,
      Number(process.env.GITHUB_RUN_NUMBER), 'main');
    fs.writeFileSync(output, JSON.stringify(snapshot));
    console.log(JSON.stringify({ commitSha: snapshot.commitSha, articles: snapshot.articles.length, tags: snapshot.tags.length, subTags: snapshot.subTags.length }));
  } catch (error) { console.error(JSON.stringify({ error: error.message })); process.exitCode = 1; }
}

module.exports = { buildSnapshot };

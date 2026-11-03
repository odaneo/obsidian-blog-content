const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { buildSnapshot } = require('./build-snapshot.cjs');
const { send } = require('./send-snapshot.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'obsidian-sync-'));
  t.after(() => {
    const target = path.resolve(root);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert(path.basename(target).startsWith('obsidian-sync-'));
    fs.rmSync(target, { recursive: true, force: true });
  });
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
  git('init', '-b', 'main');
  git('config', 'user.name', 'Sync Test'); git('config', 'user.email', 'sync-test@example.invalid');
  const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
  const commit = () => { git('add', '.'); git('commit', '-m', 'fixture'); };
  return { root, write, commit };
}

test('only boolean Published true notes and category metadata enter the package', t => {
  const f = fixture(t);
  f.write('知识/文章.md', '---\nId: "11111111111141118111111111111111"\nPublished: true\nSlug: article\nTagRefs:\n  - "[[后端]]"\n---\n# Published body');
  f.write('private.md', '---\nPublished: false\nInvalid: [\n---\nPRIVATE DRAFT');
  f.write('quoted.md', '---\nPublished: "true"\n---\nPRIVATE STRING');
  f.write('normal.md', 'PRIVATE NOTE');
  f.write('Tags/后端.md', '---\nId: "22222222222242228222222222222222"\nSlug: backend\n---\nPRIVATE CATEGORY BODY');
  f.write('.obsidian/hidden.md', '---\nPublished: true\n---\nHIDDEN');
  f.commit();
  const snapshot = buildSnapshot(f.root, 'test/content', 1);
  assert.equal(snapshot.articles.length, 1); assert.equal(snapshot.tags.length, 1); assert.equal(snapshot.subTags.length, 0);
  assert.equal(snapshot.articles[0].content, '# Published body');
  assert.equal(typeof snapshot.articles[0].id, 'string');
  assert.deepEqual(snapshot.articles[0].tagRefs, ['[[后端]]']);
  assert.match(snapshot.articles[0].lastEditedTime, /^\d{4}-/);
  assert.doesNotMatch(JSON.stringify(snapshot), /PRIVATE|HIDDEN/);
  assert.equal(snapshot.complete, true);
});

test('a valid empty published snapshot is supported', t => {
  const f = fixture(t); f.write('private.md', 'draft'); f.commit();
  assert.deepEqual(buildSnapshot(f.root, 'test/content', 2).articles, []);
});

test('invalid published properties and dirty tracked notes cannot produce a snapshot', t => {
  const f = fixture(t); f.write('note.md', '---\nPublished: true\nInvalid: [\n---\nbody'); f.commit();
  assert.throws(() => buildSnapshot(f.root, 'test/content', 3), /Invalid properties/);
  f.write('note.md', '---\nPublished: false\n---\nbody');
  assert.throws(() => buildSnapshot(f.root, 'test/content', 3), /Commit Markdown/);
});

test('new published notes require a persisted text UUID', t => {
  const f = fixture(t); f.write('note.md', '---\nPublished: true\nSlug: note\n---\nbody'); f.commit();
  assert.throws(() => buildSnapshot(f.root, 'test/content', 1), /fixed text UUID/);
});

test('local mode includes dirty and untracked published notes without weakening the Actions default', t => {
  const f = fixture(t);
  const note = '---\nId: "11111111111141118111111111111111"\nPublished: true\nSlug: note\n---\n';
  f.write('note.md', note + 'committed'); f.commit();
  f.write('note.md', note + 'local edit');
  f.write('new.md', note.replaceAll('11111111111141118111111111111111', '22222222222242228222222222222222').replace('Slug: note', 'Slug: new') + 'new note');
  f.write('draft.md', '---\nPublished: false\nInvalid: [\n---\nPRIVATE DRAFT');
  assert.throws(() => buildSnapshot(f.root, 'test/content', 1), /Commit Markdown/);
  const local = buildSnapshot(f.root, 'test/content', 1, 'main', { allowDirty: true });
  assert.equal(local.articles.length, 2);
  assert.deepEqual(local.articles.map(note => note.content).sort(), ['local edit', 'new note']);
  assert.equal(local.articles.find(note => note.sourcePath === 'new.md').lastEditedTime, fs.statSync(path.join(f.root, 'new.md')).mtime.toISOString());
  assert.doesNotMatch(JSON.stringify(local), /PRIVATE/);
  assert.deepEqual(local, buildSnapshot(f.root, 'test/content', 1, 'main', { allowDirty: true }));
});

test('transient failures retry the identical snapshot and token without redirects', async t => {
  const f = fixture(t); const file = path.join(f.root, 'snapshot.json'); fs.writeFileSync(file, '{"complete":true}');
  const calls = [];
  const result = await send(file, 'https://example.invalid/api/sync/obsidian', 'x'.repeat(48), async (url, options) => {
    calls.push(options); assert.equal(options.redirect, 'error');
    return calls.length === 1 ? new Response('', { status: 503 }) : new Response('{"status":"applied"}', { status: 200 });
  }, async () => {});
  assert.equal(result.status, 'applied'); assert.equal(calls.length, 2);
  assert.equal(calls[0].body, calls[1].body); assert.equal(calls[0].headers.authorization, 'Bearer ' + 'x'.repeat(48));
});

test('unauthorized requests do not retry and plain HTTP is refused', async t => {
  const f = fixture(t); const file = path.join(f.root, 'snapshot.json'); fs.writeFileSync(file, '{}'); let calls = 0;
  const fetcher = async () => { calls++; return new Response('', { status: 401 }); };
  await assert.rejects(send(file, 'https://example.invalid', 'x'.repeat(48), fetcher), /HTTP 401/);
  assert.equal(calls, 1);
  await assert.rejects(send(file, 'http://example.invalid', 'x'.repeat(48), fetcher), /HTTPS/);
});

test('403 diagnostics report the response source without logging URL, token or response body', async t => {
  const f = fixture(t); const file = path.join(f.root, 'snapshot.json'); fs.writeFileSync(file, '{}');
  const token = 'sensitive-token-'.repeat(4);
  const endpoint = 'https://private.example.invalid/api/sync/obsidian';
  let calls = 0;
  await assert.rejects(send(file, endpoint, token, async () => {
    calls++;
    return new Response('<html>PRIVATE RESPONSE ' + endpoint + ' ' + token + '</html>', {
      status: 403, headers: { server: 'cloudflare', 'content-type': 'text/html', 'cf-ray': 'example-ray', 'cf-mitigated': 'challenge' }
    });
  }), error => {
    assert.match(error.message, /HTTP 403/);
    assert.equal(error.diagnostics.cfRay, 'example-ray');
    assert.equal(error.diagnostics.responseKind, 'challenge');
    assert.equal(error.diagnostics.server, 'cloudflare');
    assert.equal(error.diagnostics.requestBytes, 2);
    const log = JSON.stringify({ error: error.message, ...error.diagnostics });
    for (const secret of [endpoint, token, 'PRIVATE RESPONSE']) assert(!log.includes(secret));
    return true;
  });
  assert.equal(calls, 1);
});

const fs = require('node:fs');
const { setTimeout: delay } = require('node:timers/promises');

async function send(file, endpoint, token, fetcher = fetch, pause = delay) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:') throw new Error('SYNC_API_URL must use HTTPS');
  if (!token || token.length < 32) throw new Error('SYNC_TOKEN is missing or too short');
  const payload = fs.readFileSync(file);
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await pause([0, 2000, 5000, 10000][attempt]);
    let response;
    try {
      response = await fetcher(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        body: payload, redirect: 'error', signal: AbortSignal.timeout(120000) });
    } catch {
      if (attempt === 3) throw new Error('Sync request failed after retries');
      continue;
    }
    if (response.ok) return response.json();
    const rejected = response.status !== 429 && response.status < 500;
    if (rejected || attempt === 3) {
      const body = await response.text().catch(() => '');
      const error = new Error(rejected
        ? 'Sync rejected (HTTP ' + response.status + '); check the snapshot and server configuration'
        : 'Sync remains incomplete (HTTP ' + response.status + '); rerun the latest workflow');
      error.diagnostics = {
        timestamp: new Date().toISOString(), status: response.status,
        server: response.headers.get('server'), contentType: response.headers.get('content-type'),
        cfRay: response.headers.get('cf-ray'), cfMitigated: response.headers.get('cf-mitigated'),
        requestId: response.headers.get('x-request-id'), requestBytes: payload.length,
        responseKind: response.headers.get('cf-mitigated') === 'challenge' || /cf_chl_opt|\/cdn-cgi\/challenge-platform\//i.test(body)
          ? 'challenge' : /sorry, you have been blocked|error 1020/i.test(body)
          ? 'cloudflare_block' : /nginx/i.test(body) ? 'nginx_error'
          : response.headers.get('content-type')?.includes('json') ? 'json' : 'other'
      };
      throw error;
    }
    await response.body?.cancel();
  }
}

if (require.main === module) send(process.argv[2], process.env.SYNC_API_URL, process.env.SYNC_TOKEN)
  .then(result => console.log(JSON.stringify(result)))
  .catch(error => { console.error(JSON.stringify({ error: error.message, ...error.diagnostics })); process.exitCode = 1; });

module.exports = { send };

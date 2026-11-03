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
    if (response.status !== 429 && response.status < 500) throw new Error('Sync rejected (HTTP ' + response.status + '); check the snapshot and server configuration');
    if (attempt === 3) throw new Error('Sync remains incomplete (HTTP ' + response.status + '); rerun the latest workflow');
    await response.body?.cancel();
  }
}

if (require.main === module) send(process.argv[2], process.env.SYNC_API_URL, process.env.SYNC_TOKEN)
  .then(result => console.log(JSON.stringify(result)))
  .catch(error => { console.error(JSON.stringify({ error: error.message })); process.exitCode = 1; });

module.exports = { send };

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

function startMockServer() {
  const server = http.createServer(async (req, res) => {
    const body = await readBody(req);
    const url = new URL(req.url, 'http://127.0.0.1');

    if (req.method === 'POST' && url.pathname === '/auth/login') {
      return json(res, 200, {
        access_token: 'cli-access',
        refresh_token: 'cli-refresh',
        user: {
          id: 'u1',
          email: 'partner@example.com',
          workspace: {
            id: 'w1',
            name: 'Partner Demo',
            slug: 'partner-demo',
            workspace_type: 'partner',
            role: 'owner',
          },
        },
      });
    }

    if (req.method === 'POST' && url.pathname === '/auth/refresh') {
      return json(res, 200, {
        access_token: 'cli-access-2',
        refresh_token: 'cli-refresh-2',
        user: {
          id: 'u1',
          email: 'partner@example.com',
          workspace: {
            id: 'w1',
            name: 'Partner Demo',
            slug: 'partner-demo',
            workspace_type: 'partner',
            role: 'owner',
          },
        },
      });
    }

    if (req.method === 'GET' && url.pathname === '/auth/me') {
      if (!req.headers.authorization && !req.headers['x-api-key']) {
        return json(res, 401, { message: 'missing auth' });
      }
      return json(res, 200, {
        id: 'u1',
        email: 'partner@example.com',
        workspace: {
          id: 'w1',
          name: 'Partner Demo',
          slug: 'partner-demo',
          workspace_type: 'partner',
          role: 'owner',
        },
      });
    }

    if (req.method === 'POST' && url.pathname === '/auth/logout') {
      return json(res, 200, { message: 'ok' });
    }

    if (req.method === 'GET' && url.pathname === '/api/circuits') {
      return json(res, 200, {
        circuits: [{ id: 'c1', name: 'Demo Circuit', visibility: 'public', status: 'active' }],
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/circuits/c1') {
      return json(res, 200, {
        id: 'c1',
        name: 'Demo Circuit',
        visibility: 'public',
        status: 'active',
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/circuits/c1/join-requests') {
      return json(res, 200, { request_id: 'jr1', status: 'pending' });
    }

    if (req.method === 'GET' && url.pathname === '/api/circuits/c1/members') {
      return json(res, 200, { members: [{ id: 'u1', role: 'owner' }] });
    }

    if (req.method === 'GET' && url.pathname === '/api/items') {
      return json(res, 200, {
        items: [{ id: 'i1', dfid: 'DFID-BEEF-UY-2026-000001-xyz111', status: 'active' }],
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/items/i1') {
      return json(res, 200, { id: 'i1', dfid: 'DFID-BEEF-UY-2026-000001-xyz111', status: 'active' });
    }

    if (req.method === 'POST' && url.pathname === '/api/items') {
      const parsed = JSON.parse(body || '{}');
      return json(res, 200, { id: 'i2', ...parsed });
    }

    if (req.method === 'POST' && url.pathname === '/v1/partner/ingestions') {
      const parsed = JSON.parse(body || '{}');
      const row = parsed.items?.[0] || {};
      return json(res, 200, {
        summary: {
          status: 'completed',
          total_rows: 1,
          processed_rows: 1,
          unresolved_rows: 0,
          routes: 1,
          items: 1,
          created_circuits: 0,
          impacted_circuits: 1,
          items_created: 0,
          items_enriched: 1,
          warnings: [],
        },
        items: [
          {
            dfid: 'DFID-BEEF-UY-2026-000021-7b1f27',
            url: 'https://defarm.net/i/DFID-BEEF-UY-2026-000021-7b1f27',
            asset_reference: {
              identifier_type: 'chip',
              value: row.chip || '900264000319233',
            },
            matched_existing_item: true,
            resolution_result: 'enriched',
            merged_fields: ['breed', 'weight_kg', 'year', 'country', 'value_chain'],
            routes: [
              {
                route_type: 'fallback',
                route_value: 'source_circuit',
                circuit_id: 'c1',
              },
            ],
          },
        ],
        errors: [],
        routes: [
          {
            route_type: 'fallback',
            route_value: 'source_circuit',
            circuit_id: 'c1',
            rows: 1,
            status: 'completed',
            items: 1,
          },
        ],
      });
    }

    if (req.method === 'PUT' && url.pathname === '/api/items/i2') {
      const parsed = JSON.parse(body || '{}');
      return json(res, 200, { id: 'i2', ...parsed });
    }

    if (req.method === 'GET' && url.pathname === '/api/events') {
      return json(res, 200, {
        events: [{ id: 'e1', event_type: 'item_weighed', status: 'recorded' }],
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/events/e1') {
      return json(res, 200, {
        id: 'e1',
        event_type: 'item_weighed',
        status: 'recorded',
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/events') {
      const parsed = JSON.parse(body || '{}');
      if (!parsed.source_type || !parsed.source_id) {
        return json(res, 422, { message: 'missing source_type/source_id' });
      }
      return json(res, 200, { id: 'e2', ...parsed });
    }

    if (req.method === 'PUT' && url.pathname === '/api/events/e2/status') {
      const parsed = JSON.parse(body || '{}');
      return json(res, 200, { id: 'e2', ...parsed });
    }

    return json(res, 404, { message: 'not found' });
  });

  return server;
}

function json(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function runCli(args, env) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['dist/index.js', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
    });

    proc.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });

    proc.on('error', reject);
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('CLI acceptance: auth/workspace/circuits/items/events', async () => {
  const server = startMockServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  const base = `http://127.0.0.1:${addr.port}`;

  const fakeHome = await mkdtemp(join(tmpdir(), 'defarm-cli-test-'));
  const env = { HOME: fakeHome };

  const steps = [
    ['workspace', 'init', '--gateway', base],
    ['workspace', 'config', '--gateway', base],
    ['auth', 'login', '--email', 'partner@example.com', '--password', 'secret'],
    ['auth', 'whoami'],
    ['auth', 'refresh'],
    ['workspace', 'status'],
    ['circuits', 'list'],
    ['circuits', 'show', 'c1'],
    ['circuits', 'join', 'c1', '--message', 'join pls'],
    ['circuits', 'members', 'c1'],
    ['items', 'list', '--circuit', 'c1'],
    ['items', 'show', 'i1'],
    ['items', 'update', 'i2', '--circuit-id', 'c1', '--metadata', '{"status":"updated"}'],
    ['events', 'list', '--circuit', 'c1'],
    ['events', 'show', 'e1'],
    ['events', 'add', '--event-type', 'item_vaccinated', '--source-type', 'partner', '--source-id', 'demo-source', '--circuit-id', 'c1', '--item-id', 'i1', '--payload', '{"dose":1}'],
    ['events', 'add', '--event-type', 'item_weighed', '--circuit-id', 'c1', '--item-id', 'i1', '--payload', '{"weight_kg":520}'],
    ['events', 'update', 'e2', '--status', 'recorded'],
  ];

  for (const cmd of steps) {
    const result = await runCli(cmd, env);
    assert.equal(result.code, 0, `command failed: ${cmd.join(' ')}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  }

  const created = await runCli(
    ['items', 'new', '--value-chain', 'BEEF', '--country', 'UY', '--year', '2026', '--circuit-id', 'c1', '--metadata', '{"chip":"900264000319233","breed":"Angus","weight_kg":520}'],
    env,
  );
  assert.equal(created.code, 0, `items new failed\nstdout=${created.stdout}\nstderr=${created.stderr}`);
  assert.match(created.stdout, /Item enriquecido via ingestão/);
  assert.match(created.stdout, /DFID-BEEF-UY-2026-000021-7b1f27/);
  assert.match(created.stdout, /https:\/\/defarm\.net\/i\/DFID-BEEF-UY-2026-000021-7b1f27/);
  assert.match(created.stdout, /Campos incorporados: breed, weight_kg/);
  assert.match(created.stdout, /Circuito: http:\/\/127\.0\.0\.1\/app\/circuitos\/c1/);

  const finalSteps = [
    ['auth', 'logout'],
    ['auth', 'api-key', '--key', 'demo-api-key-1'],
    ['auth', 'whoami'],
    ['workspace', 'reset'],
  ];

  for (const cmd of finalSteps) {
    const result = await runCli(cmd, env);
    assert.equal(result.code, 0, `command failed: ${cmd.join(' ')}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  }

  server.close();
});

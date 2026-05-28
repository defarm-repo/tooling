import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { DefarmSdk, DefarmApiError } from '../dist/index.js';

function startMockServer() {
  const server = http.createServer(async (req, res) => {
    const body = await readBody(req);
    const url = new URL(req.url, 'http://127.0.0.1');

    if (req.method === 'POST' && url.pathname === '/auth/login') {
      return json(res, 200, {
        access_token: 'tok-access',
        refresh_token: 'tok-refresh',
        user: {
          id: 'u1',
          email: 'partner@defarm.net',
          workspace: {
            id: 'w1',
            name: 'Partner WS',
            slug: 'partner-ws',
            workspace_type: 'partner',
            role: 'owner',
          },
        },
      });
    }

    if (req.method === 'POST' && url.pathname === '/auth/refresh') {
      const parsed = body ? JSON.parse(body) : {};
      if (!parsed.refresh_token) return json(res, 400, { message: 'missing refresh token' });
      return json(res, 200, {
        access_token: 'tok-access-2',
        refresh_token: 'tok-refresh-2',
        user: {
          id: 'u1',
          email: 'partner@defarm.net',
          workspace: {
            id: 'w1',
            name: 'Partner WS',
            slug: 'partner-ws',
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
        email: 'partner@defarm.net',
        workspace: {
          id: 'w1',
          name: 'Partner WS',
          slug: 'partner-ws',
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
        circuits: [{ id: 'c1', name: 'CowPro Demo', visibility: 'public', status: 'active' }],
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/circuits/c1') {
      return json(res, 200, { id: 'c1', name: 'CowPro Demo', visibility: 'public', status: 'active' });
    }

    if (req.method === 'GET' && url.pathname === '/api/circuits/c1/members') {
      return json(res, 200, { members: [{ id: 'u1', role: 'owner' }] });
    }

    if (req.method === 'POST' && url.pathname === '/api/circuits/c1/join-requests') {
      return json(res, 200, { request_id: 'jr1', status: 'pending' });
    }

    if (req.method === 'GET' && url.pathname === '/api/items') {
      const cid = url.searchParams.get('circuit_id');
      return json(res, 200, { items: [{ id: 'i1', dfid: 'DFID-BEEF-BR-2026-000001-abc123', value_chain: 'BEEF', country: 'BR', year: 2026, status: cid ? 'linked' : 'active' }] });
    }

    if (req.method === 'GET' && url.pathname === '/api/items/i1') {
      return json(res, 200, { id: 'i1', dfid: 'DFID-BEEF-BR-2026-000001-abc123', value_chain: 'BEEF', country: 'BR', year: 2026, status: 'active' });
    }

    if (req.method === 'POST' && url.pathname === '/api/items') {
      const parsed = body ? JSON.parse(body) : {};
      return json(res, 200, { id: 'i2', ...parsed });
    }

    if (req.method === 'POST' && url.pathname === '/v1/partner/ingestions') {
      const parsed = body ? JSON.parse(body) : {};
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
            dfid: 'DFID-BEEF-BR-2026-000021-7b1f27',
            url: 'https://defarm.net/i/DFID-BEEF-BR-2026-000021-7b1f27',
            asset_reference: {
              identifier_type: 'chip',
              value: '910264001603161',
            },
            matched_existing_item: true,
            resolution_result: 'enriched',
            merged_fields: ['breed', 'weight_kg'],
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
      const parsed = body ? JSON.parse(body) : {};
      return json(res, 200, { id: 'i2', ...parsed });
    }

    if (req.method === 'GET' && url.pathname === '/api/events') {
      return json(res, 200, { events: [{ id: 'e1', event_type: 'item_weighed', status: 'recorded' }] });
    }

    if (req.method === 'GET' && url.pathname === '/api/events/e1') {
      return json(res, 200, { id: 'e1', event_type: 'item_weighed', status: 'recorded' });
    }

    if (req.method === 'POST' && url.pathname === '/api/events') {
      const parsed = body ? JSON.parse(body) : {};
      return json(res, 200, { id: 'e2', ...parsed });
    }

    if (req.method === 'PUT' && url.pathname === '/api/events/e2/status') {
      const parsed = body ? JSON.parse(body) : {};
      return json(res, 200, { id: 'e2', ...parsed });
    }

    if (req.method === 'GET' && url.pathname === '/api/fail') {
      return json(res, 422, { message: 'invalid payload' });
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

test('SDK acceptance: auth/workspace/circuits/items/events', async () => {
  const server = startMockServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  const base = `http://127.0.0.1:${addr.port}`;

  const sdk = new DefarmSdk({ gatewayBaseUrl: base });

  const login = await sdk.auth.login('partner@defarm.net', 'secret');
  assert.equal(login.user.workspace.workspace_type, 'partner');
  sdk.setAccessToken(login.access_token);

  const me = await sdk.auth.whoami();
  assert.equal(me.email, 'partner@defarm.net');

  const refreshed = await sdk.auth.refresh('tok-refresh');
  assert.equal(refreshed.access_token, 'tok-access-2');

  const circuits = await sdk.circuits.list();
  assert.equal(circuits.length, 1);
  assert.equal(circuits[0].id, 'c1');

  const circuit = await sdk.circuits.show('c1');
  assert.equal(circuit.name, 'CowPro Demo');

  const members = await sdk.circuits.members('c1');
  assert.equal(members.members.length, 1);

  const join = await sdk.circuits.join('c1', 'quero entrar');
  assert.equal(join.status, 'pending');

  const items = await sdk.items.list('c1');
  assert.equal(items.length, 1);
  const item = await sdk.items.show('i1');
  assert.equal(item.id, 'i1');

  const created = await sdk.items.create({ value_chain: 'BEEF', country: 'BR', year: 2026, circuit_id: 'c1', metadata: { canonical_id: 'UY000001' } });
  assert.equal(created.id, 'i2');

  const ingested = await sdk.items.createViaIngestion({
    source_circuit_id: 'c1',
    items: [{ value_chain: 'BEEF', country: 'BR', year: '2026', chip: '910264001603161', weight_kg: 700 }],
  });
  assert.equal(ingested.summary.items_enriched, 1);
  assert.equal(ingested.items[0].resolution_result, 'enriched');
  assert.deepEqual(ingested.items[0].merged_fields, ['breed', 'weight_kg']);

  const updated = await sdk.items.update('i2', { circuit_id: 'c1', metadata: { chip: '900264000000001' } });
  assert.equal(updated.id, 'i2');

  const events = await sdk.events.list('c1');
  assert.equal(events.length, 1);

  const event = await sdk.events.show('e1');
  assert.equal(event.id, 'e1');

  const eventAdded = await sdk.events.add({ event_type: 'item_vaccinated', source_type: 'partner', source_id: 'cowpro', circuit_id: 'c1', item_id: 'i1', payload: { vaccine: 'aftosa' } });
  assert.equal(eventAdded.id, 'e2');

  const eventUpdated = await sdk.events.update('e2', { status: 'recorded' });
  assert.equal(eventUpdated.status, 'recorded');

  await sdk.auth.logout('tok-refresh-2');

  server.close();
});

test('SDK maps API errors to DefarmApiError', async () => {
  const server = startMockServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  const base = `http://127.0.0.1:${addr.port}`;

  const sdk = new DefarmSdk({ gatewayBaseUrl: base });

  await assert.rejects(
    sdk.http.request('GET', '/api/fail'),
    (err) => {
      assert.ok(err instanceof DefarmApiError);
      assert.equal(err.status, 422);
      assert.equal(err.message, 'invalid payload');
      return true;
    },
  );

  server.close();
});

test('SDK supports API key authentication header', async () => {
  const server = startMockServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  const base = `http://127.0.0.1:${addr.port}`;

  const sdk = new DefarmSdk({ gatewayBaseUrl: base, apiKey: 'partner-api-key-1' });
  const me = await sdk.auth.whoami();
  assert.equal(me.email, 'partner@defarm.net');

  server.close();
});

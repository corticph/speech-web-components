import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { CortiClient } from "@corti/sdk";
import config from "./main.js";
import { createLivePlugin, readLiveSettings } from "./live-server.js";

const settings = {
  auth: { clientId: "test-client", clientSecret: "test-secret" },
  tenantName: "test-tenant",
  environment: "eu",
};

function jwt() {
  return [
    Buffer.from('{"alg":"none"}').toString("base64url"),
    Buffer.from(JSON.stringify({
      iss: "https://auth.eu.corti.app/realms/test-tenant",
      exp: Math.floor(Date.now() / 1000) + 300,
    })).toString("base64url"),
    "test-signature",
  ].join(".");
}

async function serve(t, factory) {
  let middleware;
  createLivePlugin(settings, factory).configureServer({
    middlewares: { use(handler) { middleware = handler; } },
  });
  const server = createServer((req, res) => middleware(req, res, () => {
    res.writeHead(404).end();
  }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return (action, options = {}) => new Promise((resolve, reject) => {
    // Node fetch normalizes Host, so use HTTP directly to exercise rebinding protection.
    const request = httpRequest(`${origin}/__storybook/corti/${action}`, {
      method: "POST",
      ...options,
      headers: {
        Origin: origin,
        "Sec-Fetch-Site": "same-origin",
        "X-Storybook-Live": "1",
        ...options.headers,
      },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(new Response(Buffer.concat(chunks), {
        status: response.statusCode,
        headers: { "cache-control": response.headers["cache-control"] },
      })));
    });
    request.on("error", reject);
    request.end();
  });
}

test("fixed env file is optional, validates partial configuration, and respects shell overrides", (t) => {
  const root = mkdtempSync(join(tmpdir(), "storybook-live-test-"));
  t.after(() => rmSync(root, { recursive: true }));
  assert.equal(readLiveSettings(root, {}), undefined);
  writeFileSync(join(root, ".env.local"), "CORTI_CLIENT_SECRET=test-secret\n");
  assert.throws(() => readLiveSettings(root, {}), /missing CORTI_CLIENT_ID, CORTI_TENANT_NAME, CORTI_ENVIRONMENT/);
  assert.deepEqual(readLiveSettings(root, {
    CORTI_CLIENT_ID: "test-client",
    CORTI_TENANT_NAME: "test-tenant",
    CORTI_ENVIRONMENT: "eu",
  }), settings);
});

test("SDK caches and refreshes tokens; endpoint returns remaining lifetime without credentials", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_700_000_000_000 });
  let exchanges = 0;
  const post = await serve(t, (options) => new CortiClient({
    ...options,
    fetch: async () => {
      exchanges++;
      return Response.json({ access_token: jwt(), expires_in: 300, token_type: "Bearer" });
    },
  }));
  const first = await post("token");
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "no-store");
  assert.deepEqual(await first.json(), { accessToken: jwt(), expiresIn: 300 });
  await (await post("token")).json();
  assert.equal(exchanges, 1);
  t.mock.timers.tick(181_000);
  const renewed = await (await post("token")).json();
  assert.equal(exchanges, 2);
  assert.equal(renewed.expiresIn, 300);
  assert.equal(renewed.accessToken, jwt());
});

test("browser SDK renews through the token provider using the returned lifetime", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_700_000_000_000 });
  let requests = 0;
  const client = new CortiClient({
    environment: "eu",
    tenantName: "test-tenant",
    auth: {
      accessToken: jwt(),
      expiresIn: 300,
      refreshAccessToken: async () => {
        requests++;
        return { accessToken: jwt(), expiresIn: 300 };
      },
    },
  });
  await client.getAuthHeaders();
  const initialRequests = requests;
  await client.getAuthHeaders();
  assert.equal(requests, initialRequests);
  t.mock.timers.tick(181_000);
  assert.equal((await client.getAuthHeaders()).get("Authorization"), `Bearer ${jwt()}`);
  assert.equal(requests, initialRequests + 1);
});

test("local endpoints reject cross-origin, rebinding, simple requests, and wrong methods", async (t) => {
  let calls = 0;
  const post = await serve(t, () => ({
    getAuthHeaders() { calls++; return new Headers({ Authorization: `Bearer ${jwt()}` }); },
  }));
  for (const headers of [
    { Origin: "https://evil.example" },
    { "Sec-Fetch-Site": "cross-site" },
    { "X-Storybook-Live": "" },
    { Host: "evil.example" },
  ]) {
    assert.equal((await post("token", { headers })).status, 403, JSON.stringify(headers));
  }
  assert.equal((await post("token", { method: "GET" })).status, 405);
  assert.equal((await post("unknown")).status, 404);
  assert.equal(calls, 0);
});

test("interactions use synthetic metadata, disable retries, and honor a manual token", async (t) => {
  const optionsSeen = [];
  const creations = [];
  const post = await serve(t, (options) => {
    optionsSeen.push(options);
    return {
      interactions: {
        async create(request, requestOptions) {
          creations.push({ request, requestOptions });
          return { interactionId: "created-id" };
        },
      },
    };
  });
  assert.deepEqual(await (await post("interaction")).json(), { interactionId: "created-id" });
  assert.deepEqual(await (await post("interaction", {
    headers: { Authorization: "Bearer manual-token" },
  })).json(), { interactionId: "created-id" });
  assert.deepEqual(optionsSeen[1], { auth: { accessToken: "manual-token" } });
  assert.match(creations[0].request.encounter.identifier, /^storybook-[\da-f-]{36}$/);
  assert.equal(creations[0].request.encounter.status, "planned");
  assert.equal(creations[0].request.encounter.type, "first_consultation");
  assert.equal(creations[0].request.patient, undefined);
  assert.equal(creations[0].requestOptions.maxRetries, 0);
  assert.notEqual(creations[0].request.encounter.identifier, creations[1].request.encounter.identifier);
});

test("SDK failures are sanitized and uncertain interaction creation is explicit", async (t) => {
  const post = await serve(t, () => ({
    getAuthHeaders() { throw new Error("sensitive auth response test-secret"); },
    interactions: { create() { throw new Error("timeout containing test-secret"); } },
  }));
  const token = await post("token");
  assert.equal(token.status, 502);
  assert.doesNotMatch(await token.text(), /test-secret|sensitive auth/);
  const interaction = await post("interaction");
  assert.equal(interaction.status, 502);
  const result = await interaction.json();
  assert.equal(result.creationUncertain, true);
  assert.doesNotMatch(JSON.stringify(result), /test-secret|timeout/);
});

test("static build disables the integration without reading credentials or installing endpoints", async () => {
  const result = await config.viteFinal({}, { configType: "PRODUCTION" });
  assert.equal(result.define.__STORYBOOK_LIVE__, "false");
  assert.equal(result.plugins, undefined);
});

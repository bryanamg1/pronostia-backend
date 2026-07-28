const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  DEFAULT_RETRY_AFTER_FALLBACK_MS,
  createDiscoveryRunner,
  parseRetryAfterMs,
} = require("./validate-api-football");

function createJsonResponse(status, body, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(headers),
    async text() {
      return JSON.stringify(body);
    },
  };
}

function createTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pronostia-discovery-"));
}

test("parseRetryAfterMs falls back when header is missing", () => {
  assert.equal(
    parseRetryAfterMs(undefined, 0),
    DEFAULT_RETRY_AFTER_FALLBACK_MS
  );
});

test("smoke test retries once on 429 and preserves sequential waits", async () => {
  const calls = [];
  const waits = [];
  let now = 0;
  let requestIndex = 0;

  const responses = [
    createJsonResponse(200, { response: { plan: "Free", requests: { current: 10, limit: 100, remaining: 90 } } }),
    createJsonResponse(200, { response: [2024, 2025, 2026] }),
    createJsonResponse(429, { errors: { rate: "Too Many Requests" } }, { "retry-after": "1" }),
    createJsonResponse(200, { response: [{ id: 1, name: "Bet365" }] }),
    createJsonResponse(200, { response: [{ id: 1, name: "Match Winner" }] }),
    createJsonResponse(200, { response: { plan: "Free", requests: { current: 14, limit: 100, remaining: 86 } } }),
  ];

  const fetchImpl = async (url) => {
    calls.push(String(url));
    return responses[requestIndex++];
  };

  const sleepImpl = async (ms) => {
    waits.push(ms);
    now += ms;
  };

  const runner = createDiscoveryRunner({
    apiKey: "test-key",
    baseUrl: "https://example.test",
    smokeTest: true,
    minIntervalMs: 7000,
    rootDir: createTempRoot(),
    fetchImpl,
    sleepImpl,
    nowMs: () => now,
  });

  const output = await runner.run();

  assert.equal(output.smokeTest, true);
  assert.equal(output.httpCallsIssued, 6);
  assert.equal(output.quotaDeltaObserved, 4);
  assert.deepEqual(output.savedCheckpointSteps, ["seasons", "bookmakers", "bets"]);
  assert.deepEqual(waits, [7000, 7000, 1000, 6000, 7000, 7000]);
  assert.equal(output.requestLog[2].status, 429);
  assert.equal(output.requestLog[2].responseHeaders["retry-after"], "1");
  assert.equal(output.requestLog[3].intervalSincePreviousMs, 7000);
  assert.equal(output.references.bookmakers.bet365Available, true);
  assert.equal(output.finalStatus.remaining, 86);
});

test("runner stops in a controlled way after two 429 retries", async () => {
  let now = 0;
  const responses = [
    createJsonResponse(200, { response: { plan: "Free", requests: { current: 10, limit: 100, remaining: 90 } } }),
    createJsonResponse(429, { errors: { rate: "Too Many Requests" } }),
    createJsonResponse(429, { errors: { rate: "Too Many Requests" } }),
    createJsonResponse(429, { errors: { rate: "Too Many Requests" } }),
  ];

  const runner = createDiscoveryRunner({
    apiKey: "test-key",
    baseUrl: "https://example.test",
    smokeTest: true,
    minIntervalMs: 7000,
    rootDir: createTempRoot(),
    fetchImpl: async () => responses.shift(),
    sleepImpl: async (ms) => {
      now += ms;
    },
    nowMs: () => now,
  });

  await assert.rejects(
    runner.run(),
    /HTTP 429 persisted after 2 retries/
  );
});

test("checkpoint avoids repeating successful smoke-test steps", async () => {
  let now = 0;
  const rootDir = createTempRoot();
  const firstRunResponses = [
    createJsonResponse(200, { response: { plan: "Free", requests: { current: 10, limit: 100, remaining: 90 } } }),
    createJsonResponse(200, { response: [2024, 2025] }),
    createJsonResponse(200, { response: [{ id: 1, name: "Betano" }] }),
    createJsonResponse(200, { response: [{ id: 1, name: "Match Winner" }] }),
    createJsonResponse(200, { response: { plan: "Free", requests: { current: 13, limit: 100, remaining: 87 } } }),
  ];

  const secondRunResponses = [
    createJsonResponse(200, { response: { plan: "Free", requests: { current: 13, limit: 100, remaining: 87 } } }),
    createJsonResponse(200, { response: { plan: "Free", requests: { current: 14, limit: 100, remaining: 86 } } }),
  ];

  const firstRunner = createDiscoveryRunner({
    apiKey: "test-key",
    baseUrl: "https://example.test",
    smokeTest: true,
    minIntervalMs: 7000,
    rootDir,
    fetchImpl: async () => firstRunResponses.shift(),
    sleepImpl: async (ms) => {
      now += ms;
    },
    nowMs: () => now,
  });

  await firstRunner.run();

  const secondRunner = createDiscoveryRunner({
    apiKey: "test-key",
    baseUrl: "https://example.test",
    smokeTest: true,
    minIntervalMs: 7000,
    rootDir,
    fetchImpl: async () => secondRunResponses.shift(),
    sleepImpl: async (ms) => {
      now += ms;
    },
    nowMs: () => now,
  });

  const output = await secondRunner.run();

  assert.deepEqual(output.reusedCheckpointSteps, ["seasons", "bookmakers", "bets"]);
  assert.equal(output.httpCallsIssued, 2);
  assert.equal(output.finalStatus.remaining, 86);
});

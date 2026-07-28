const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  BOOKMAKER_AVAILABILITY,
  DEFAULT_RETRY_AFTER_FALLBACK_MS,
  QUOTA_CONFIDENCE,
  STATUS_OBSERVATION,
  buildBookmakerAvailability,
  classifyCompetitionStatus,
  buildPreflightReport,
  buildQuotaObservability,
  createDiscoveryRunner,
  normalizeStatusMetadata,
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

test("normalizeStatusMetadata parses limit_day and computes remaining", () => {
  const metadata = normalizeStatusMetadata({
    response: {
      subscription: { plan: "Free" },
      requests: { current: 10, limit_day: 100 },
    },
  });

  assert.deepEqual(metadata, {
    plan: "Free",
    current: 10,
    limitDay: 100,
    remaining: 90,
    warnings: [],
  });
});

test("normalizeStatusMetadata warns when provider fields are missing", () => {
  const metadata = normalizeStatusMetadata({
    response: {
      subscription: {},
      requests: { current: 10 },
    },
  });

  assert.equal(metadata.plan, null);
  assert.equal(metadata.current, 10);
  assert.equal(metadata.limitDay, null);
  assert.equal(metadata.remaining, null);
  assert.match(metadata.warnings.join(" "), /response\.subscription\.plan/);
  assert.match(metadata.warnings.join(" "), /response\.requests\.limit_day/);
});

test("buildQuotaObservability treats inconsistent headers as secondary evidence", () => {
  const quota = buildQuotaObservability(
    {
      initialStatus: {
        plan: "Free",
        current: 10,
        limitDay: 100,
        remaining: 90,
      },
      finalStatus: {
        plan: "Free",
        current: 10,
        limitDay: 100,
        remaining: 90,
      },
      httpCallsIssued: 5,
      requestLog: [
        { responseHeaders: { "x-ratelimit-requests-remaining": "90", "x-ratelimit-requests-limit": "100" } },
        { responseHeaders: { "x-ratelimit-requests-remaining": "88", "x-ratelimit-requests-limit": "100" } },
        { responseHeaders: { "x-ratelimit-requests-remaining": "87", "x-ratelimit-requests-limit": "100" } },
        { responseHeaders: { "x-ratelimit-requests-remaining": "89", "x-ratelimit-requests-limit": "100" } },
        { responseHeaders: { "x-ratelimit-requests-remaining": "90", "x-ratelimit-requests-limit": "100" } },
      ],
    },
    70
  );

  assert.equal(quota.statusCurrentInitial, 10);
  assert.equal(quota.statusCurrentFinal, 10);
  assert.equal(quota.observedStatusDelta, 0);
  assert.deepEqual(quota.headerRemainingObservations, [90, 88, 87, 89, 90]);
  assert.equal(quota.locallyEstimatedConsumption, 5);
  assert.equal(quota.localConservativeCurrent, 15);
  assert.equal(quota.effectiveEstimatedRemaining, 85);
  assert.equal(quota.quotaObservationStatus, STATUS_OBSERVATION.EVENTUAL_OR_INCONSISTENT);
  assert.equal(quota.quotaConfidence, QUOTA_CONFIDENCE.MEDIUM);
});

test("bookmaker availability differentiates catalog from fixture evidence", () => {
  const bookmaker = buildBookmakerAvailability(true);

  assert.deepEqual(bookmaker, {
    catalogListed: true,
    fixtureAvailability: BOOKMAKER_AVAILABILITY.INCONCLUSIVE,
    competitionAvailability: BOOKMAKER_AVAILABILITY.INCONCLUSIVE,
    mvpMarketAvailability: BOOKMAKER_AVAILABILITY.INCONCLUSIVE,
  });
});

test("classifyCompetitionStatus keeps partial when there is no fixture evidence", () => {
  const status = classifyCompetitionStatus({
    leagueId: 140,
    season: 2026,
    coverage: {
      standings: true,
      odds: true,
      fixtures: {
        statistics_fixtures: true,
      },
    },
    fixturesProbe: { results: 0 },
    teamsProbe: { results: 0 },
    oddsProbe: { results: 0 },
    teamStatisticsProbe: { hasResponse: false },
  });

  assert.equal(status, "PARTIAL");
});

test("dry-run preflight reuses checkpoint and stays below soft limit with smoke-test evidence", () => {
  const preflight = buildPreflightReport({
    checkpointState: {
      steps: {
        seasons: {},
        bookmakers: {},
        bets: {},
      },
    },
    latestOutput: {
      initialStatus: {
        plan: "Free",
        current: 10,
        limitDay: 100,
        remaining: 90,
      },
      finalStatus: {
        plan: "Free",
        current: 10,
        limitDay: 100,
        remaining: 90,
      },
      httpCallsIssued: 5,
      requestLog: [
        { responseHeaders: { "x-ratelimit-requests-remaining": "90", "x-ratelimit-requests-limit": "100" } },
      ],
    },
    softLimitPercent: 70,
  });

  assert.equal(preflight.checkpointSteps, 3);
  assert.equal(preflight.estimatedReusedCalls, 3);
  assert.equal(preflight.estimatedNewCalls, 57);
  assert.equal(preflight.estimatedMaximumCalls, 59);
  assert.equal(preflight.knownDailyLimit, 100);
  assert.equal(preflight.knownCurrentUsage, 10);
  assert.equal(preflight.softLimit, 70);
  assert.equal(preflight.safeToRun, true);
  assert.equal(preflight.marginOfSafety, 1);
});

test("dry-run preflight blocks when the maximum estimate exceeds the soft limit", () => {
  const preflight = buildPreflightReport({
    checkpointState: {
      steps: {
        seasons: {},
      },
    },
    latestOutput: {
      initialStatus: {
        plan: "Free",
        current: 25,
        limitDay: 100,
        remaining: 75,
      },
      finalStatus: {
        plan: "Free",
        current: 25,
        limitDay: 100,
        remaining: 75,
      },
      httpCallsIssued: 5,
      requestLog: [],
    },
    softLimitPercent: 70,
  });

  assert.equal(preflight.safeToRun, false);
  assert.ok(preflight.marginOfSafety < 0);
});

test("smoke test retries once on 429 and preserves sequential waits", async () => {
  const waits = [];
  let now = 0;
  let requestIndex = 0;

  const responses = [
    createJsonResponse(200, {
      response: {
        subscription: { plan: "Free" },
        requests: { current: 10, limit_day: 100 },
      },
    }),
    createJsonResponse(200, { response: [2024, 2025, 2026] }),
    createJsonResponse(429, { errors: { rate: "Too Many Requests" } }, { "retry-after": "1" }),
    createJsonResponse(200, { response: [{ id: 1, name: "Bet365" }, { id: 2, name: "Betano" }] }),
    createJsonResponse(200, { response: [{ id: 1, name: "Match Winner" }] }),
    createJsonResponse(200, {
      response: {
        subscription: { plan: "Free" },
        requests: { current: 10, limit_day: 100 },
      },
    }),
  ];

  const runner = createDiscoveryRunner({
    apiKey: "test-key",
    baseUrl: "https://example.test",
    smokeTest: true,
    minIntervalMs: 7000,
    rootDir: createTempRoot(),
    fetchImpl: async () => responses[requestIndex++],
    sleepImpl: async (ms) => {
      waits.push(ms);
      now += ms;
    },
    nowMs: () => now,
  });

  const output = await runner.run();

  assert.equal(output.httpCallsIssued, 6);
  assert.deepEqual(waits, [7000, 7000, 1000, 6000, 7000, 7000]);
  assert.equal(output.quotaObservability.effectiveEstimatedRemaining, 84);
  assert.equal(output.bookmakersObserved.bet365.catalogListed, true);
  assert.equal(output.bookmakersObserved.bet365.fixtureAvailability, BOOKMAKER_AVAILABILITY.INCONCLUSIVE);
});

test("checkpoint avoids repeating successful smoke-test steps", async () => {
  let now = 0;
  const rootDir = createTempRoot();
  const firstRunResponses = [
    createJsonResponse(200, {
      response: {
        subscription: { plan: "Free" },
        requests: { current: 10, limit_day: 100 },
      },
    }),
    createJsonResponse(200, { response: [2024, 2025] }),
    createJsonResponse(200, { response: [{ id: 1, name: "Betano" }] }),
    createJsonResponse(200, { response: [{ id: 1, name: "Match Winner" }] }),
    createJsonResponse(200, {
      response: {
        subscription: { plan: "Free" },
        requests: { current: 10, limit_day: 100 },
      },
    }),
  ];

  const secondRunResponses = [
    createJsonResponse(200, {
      response: {
        subscription: { plan: "Free" },
        requests: { current: 10, limit_day: 100 },
      },
    }),
    createJsonResponse(200, {
      response: {
        subscription: { plan: "Free" },
        requests: { current: 10, limit_day: 100 },
      },
    }),
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
});

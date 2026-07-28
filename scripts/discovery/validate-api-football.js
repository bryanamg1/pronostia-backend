const fs = require("fs");
const path = require("path");

const DEFAULT_BASE_URL = "https://v3.football.api-sports.io";
const DEFAULT_PROVIDER = "api-football";
const DEFAULT_MIN_INTERVAL_MS = 7000;
const DEFAULT_RETRY_AFTER_FALLBACK_MS = 65000;
const DEFAULT_SOFT_LIMIT_PERCENT = 80;
const MAX_429_RETRIES = 2;

const CHECKPOINT_DIRNAME = ".discovery-checkpoints";
const CHECKPOINT_FILENAME = "validate-api-football.checkpoint.json";
const OUTPUT_DIR = path.join("docs", "discovery-output");
const OUTPUT_FILENAME = "api-football-discovery.latest.json";

const TARGET_COMPETITIONS = [
  {
    key: "laliga",
    displayName: "LaLiga",
    queryName: "La Liga",
    country: "Spain",
    type: "league",
  },
  {
    key: "premier-league",
    displayName: "Premier League",
    queryName: "Premier League",
    country: "England",
    type: "league",
  },
  {
    key: "ligue-1",
    displayName: "Ligue 1",
    queryName: "Ligue 1",
    country: "France",
    type: "league",
  },
  {
    key: "serie-a-italy",
    displayName: "Serie A",
    queryName: "Serie A",
    country: "Italy",
    type: "league",
  },
  {
    key: "bundesliga",
    displayName: "Bundesliga",
    queryName: "Bundesliga",
    country: "Germany",
    type: "league",
  },
  {
    key: "liga-profesional-arg",
    displayName: "Liga Profesional Argentina",
    queryName: "Liga Profesional Argentina",
    country: "Argentina",
    type: "league",
  },
  {
    key: "serie-a-brazil",
    displayName: "Brasileirao Serie A",
    queryName: "Serie A",
    country: "Brazil",
    type: "league",
  },
  {
    key: "uefa-champions-league",
    displayName: "UEFA Champions League",
    queryName: "UEFA Champions League",
    type: "cup",
  },
  {
    key: "uefa-europa-league",
    displayName: "UEFA Europa League",
    queryName: "UEFA Europa League",
    type: "cup",
  },
  {
    key: "conmebol-libertadores",
    displayName: "Copa Libertadores",
    queryName: "CONMEBOL Libertadores",
    type: "cup",
  },
  {
    key: "conmebol-sudamericana",
    displayName: "Copa Sudamericana",
    queryName: "CONMEBOL Sudamericana",
    type: "cup",
  },
];

function parseBooleanEnv(value) {
  return String(value || "").toLowerCase() === "true";
}

function numberEnv(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function assertEnv(apiKey) {
  if (!apiKey) {
    throw new Error(
      "Missing SPORTS_API_KEY. Set it in the local environment before running discovery."
    );
  }
}

function buildUrl(baseUrl, endpoint, params = {}) {
  const url = new URL(endpoint, `${baseUrl.replace(/\/$/, "")}/`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeHeaders(headersLike) {
  const source = headersLike instanceof Headers
    ? Array.from(headersLike.entries())
    : Object.entries(headersLike || {});
  const output = {};

  for (const [rawKey, rawValue] of source) {
    const key = String(rawKey).toLowerCase();
    const value = String(rawValue);
    const sensitive =
      key.includes("authorization") ||
      key.includes("api") ||
      key.includes("token") ||
      key.includes("secret") ||
      key.includes("cookie");

    output[key] = sensitive ? "[REDACTED]" : value;
  }

  return output;
}

function parseRetryAfterMs(value, nowMs = Date.now()) {
  if (!value) {
    return DEFAULT_RETRY_AFTER_FALLBACK_MS;
  }

  const trimmed = String(value).trim();
  const numericSeconds = Number(trimmed);

  if (Number.isFinite(numericSeconds)) {
    return Math.max(0, numericSeconds * 1000);
  }

  const dateValue = Date.parse(trimmed);
  if (Number.isFinite(dateValue)) {
    return Math.max(0, dateValue - nowMs);
  }

  return DEFAULT_RETRY_AFTER_FALLBACK_MS;
}

function getNestedValue(object, paths) {
  for (const dottedPath of paths) {
    const parts = dottedPath.split(".");
    let current = object;

    for (const part of parts) {
      if (current && Object.prototype.hasOwnProperty.call(current, part)) {
        current = current[part];
      } else {
        current = undefined;
        break;
      }
    }

    if (current !== undefined && current !== null) {
      return current;
    }
  }

  return undefined;
}

function findFirstByKey(object, acceptedKeys) {
  if (!object || typeof object !== "object") {
    return undefined;
  }

  const entries = Object.entries(object);

  for (const [key, value] of entries) {
    if (acceptedKeys.includes(key) && typeof value !== "object") {
      return value;
    }
  }

  for (const [, value] of entries) {
    const nested = findFirstByKey(value, acceptedKeys);
    if (nested !== undefined) {
      return nested;
    }
  }

  return undefined;
}

function normalizeStatusMetadata(payload) {
  const source = payload?.response || payload || {};
  const plan =
    getNestedValue(source, [
      "subscription.plan",
      "account.plan",
      "plan",
      "requests.plan",
    ]) || findFirstByKey(source, ["plan"]);
  const currentRaw =
    getNestedValue(source, [
      "requests.current",
      "requests.used",
      "quota.current",
      "quota.used",
      "usage.current",
      "usage.used",
    ]) || findFirstByKey(source, ["current", "used"]);
  const limitRaw =
    getNestedValue(source, [
      "requests.limit",
      "quota.limit",
      "usage.limit",
      "requests.daily",
    ]) || findFirstByKey(source, ["limit", "daily"]);
  const remainingRaw =
    getNestedValue(source, [
      "requests.remaining",
      "quota.remaining",
      "usage.remaining",
    ]) || findFirstByKey(source, ["remaining"]);

  const current = Number(currentRaw);
  const limit = Number(limitRaw);
  const remaining =
    Number.isFinite(Number(remainingRaw)) && Number(remainingRaw) >= 0
      ? Number(remainingRaw)
      : Number.isFinite(current) && Number.isFinite(limit)
        ? Math.max(0, limit - current)
        : null;

  return {
    plan: plan ? String(plan) : null,
    current: Number.isFinite(current) ? current : null,
    limit: Number.isFinite(limit) ? limit : null,
    remaining: Number.isFinite(remaining) ? remaining : null,
  };
}

function loadCheckpoint(checkpointPath) {
  if (!fs.existsSync(checkpointPath)) {
    return {
      version: 1,
      updatedAt: null,
      steps: {},
    };
  }

  return JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
}

function saveCheckpoint(checkpointPath, state) {
  fs.mkdirSync(path.dirname(checkpointPath), { recursive: true });
  fs.writeFileSync(
    checkpointPath,
    `${JSON.stringify(
      {
        ...state,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function pickLeagueCandidate(response, target) {
  const candidates = Array.isArray(response) ? response : [];

  return (
    candidates.find((item) => {
      const leagueName = item?.league?.name?.toLowerCase();
      const countryName = item?.country?.name?.toLowerCase();
      const typeName = item?.league?.type?.toLowerCase();

      if (leagueName !== target.queryName.toLowerCase()) {
        return false;
      }

      if (target.country && countryName !== target.country.toLowerCase()) {
        return false;
      }

      if (target.type && typeName !== target.type.toLowerCase()) {
        return false;
      }

      return true;
    }) || null
  );
}

function pickLatestSeason(seasons) {
  if (!Array.isArray(seasons) || seasons.length === 0) {
    return null;
  }

  return seasons
    .slice()
    .sort((left, right) => right.year - left.year)
    .find(Boolean);
}

function buildRuntimeConfig(overrides = {}) {
  const rootDir = overrides.rootDir || process.cwd();

  return {
    provider: overrides.provider || process.env.SPORTS_API_PROVIDER || DEFAULT_PROVIDER,
    baseUrl:
      overrides.baseUrl || process.env.SPORTS_API_BASE_URL || DEFAULT_BASE_URL,
    apiKey: overrides.apiKey || process.env.SPORTS_API_KEY,
    minIntervalMs: numberEnv(
      overrides.minIntervalMs ?? process.env.SPORTS_API_MIN_INTERVAL_MS,
      DEFAULT_MIN_INTERVAL_MS
    ),
    retryAfterFallbackMs: numberEnv(
      overrides.retryAfterFallbackMs ?? process.env.SPORTS_API_RETRY_AFTER_FALLBACK_MS,
      DEFAULT_RETRY_AFTER_FALLBACK_MS
    ),
    softLimitPercent: numberEnv(
      overrides.softLimitPercent ?? process.env.SPORTS_API_SOFT_LIMIT_PERCENT,
      DEFAULT_SOFT_LIMIT_PERCENT
    ),
    smokeTest:
      overrides.smokeTest ?? parseBooleanEnv(process.env.DISCOVERY_SMOKE_TEST),
    checkpointPath:
      overrides.checkpointPath ||
      path.join(rootDir, CHECKPOINT_DIRNAME, CHECKPOINT_FILENAME),
    outputPath:
      overrides.outputPath || path.join(rootDir, OUTPUT_DIR, OUTPUT_FILENAME),
    rootDir,
  };
}

function createDiscoveryRunner(options = {}) {
  const config = buildRuntimeConfig(options);
  const fetchImpl = options.fetchImpl || global.fetch;
  const sleepImpl = options.sleepImpl || sleep;
  const nowMs = options.nowMs || (() => Date.now());
  const checkpointState =
    options.checkpointState || loadCheckpoint(config.checkpointPath);

  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required to run discovery.");
  }

  const runtime = {
    lastRequestStartedAtMs: null,
    checkpointState,
    quota: {
      plan: null,
      current: null,
      limit: null,
      remaining: null,
    },
    report: {
      generatedAt: null,
      provider: config.provider,
      baseUrl: config.baseUrl,
      smokeTest: config.smokeTest,
      minIntervalMs: config.minIntervalMs,
      retryAfterFallbackMs: config.retryAfterFallbackMs,
      softLimitPercent: config.softLimitPercent,
      requestLog: [],
      reusedCheckpointSteps: [],
      savedCheckpointSteps: [],
      evidence: {
        empiricNotes: [
          "Provider status endpoint returned HTTP 200.",
          "Plan observed: Free.",
          "Observed usage before correction: 10/100 daily requests consumed.",
          "Observed failure mode before correction: HTTP 429 caused by per-minute rate limiting, not by daily quota exhaustion.",
        ],
      },
      statusSnapshots: {
        initial: null,
        final: null,
      },
    },
  };

  function persistCheckpoint() {
    saveCheckpoint(config.checkpointPath, runtime.checkpointState);
  }

  function saveStepToCheckpoint(stepKey, payload) {
    runtime.checkpointState.steps[stepKey] = {
      completedAt: new Date().toISOString(),
      payload,
    };
    runtime.report.savedCheckpointSteps.push(stepKey);
    persistCheckpoint();
  }

  function readStepFromCheckpoint(stepKey) {
    return runtime.checkpointState.steps?.[stepKey] || null;
  }

  async function waitForNextSlot() {
    if (runtime.lastRequestStartedAtMs === null) {
      return 0;
    }

    const elapsed = nowMs() - runtime.lastRequestStartedAtMs;
    const waitMs = Math.max(0, config.minIntervalMs - elapsed);

    if (waitMs > 0) {
      await sleepImpl(waitMs);
    }

    return waitMs;
  }

  function enforceQuotaBeforeRequest(endpoint) {
    if (endpoint === "status") {
      return;
    }

    const { current, limit, remaining } = runtime.quota;
    if (!Number.isFinite(limit)) {
      return;
    }

    if (Number.isFinite(remaining) && remaining <= 0) {
      throw new Error(
        `Daily quota exhausted before calling ${endpoint}. Remaining requests: 0.`
      );
    }

    if (Number.isFinite(current)) {
      const usagePercent = (current / limit) * 100;
      if (usagePercent >= config.softLimitPercent) {
        throw new Error(
          `Soft limit reached before calling ${endpoint}. Current usage ${current}/${limit} (${usagePercent.toFixed(
            2
          )}%).`
        );
      }
    }
  }

  async function apiGet(endpoint, params = {}, context = {}) {
    let attempt = 0;

    while (true) {
      enforceQuotaBeforeRequest(endpoint);
      const waitedBeforeCallMs = await waitForNextSlot();
      const url = buildUrl(config.baseUrl, endpoint, params);
      const startedAtMs = nowMs();
      const intervalSincePreviousMs =
        runtime.lastRequestStartedAtMs === null
          ? null
          : startedAtMs - runtime.lastRequestStartedAtMs;

      runtime.lastRequestStartedAtMs = startedAtMs;

      const requestHeaders = {
        "x-apisports-key": config.apiKey,
      };

      const response = await fetchImpl(url, {
        headers: requestHeaders,
      });
      const endedAtMs = nowMs();
      const responseHeaders = sanitizeHeaders(response.headers);
      const text = await response.text();

      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (error) {
          throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 300)}`);
        }
      }

      const requestLogEntry = {
        endpoint,
        url: url.toString(),
        status: response.status,
        attempt: attempt + 1,
        context: context.stepKey || null,
        startedAt: new Date(startedAtMs).toISOString(),
        durationMs: endedAtMs - startedAtMs,
        waitedBeforeCallMs,
        intervalSincePreviousMs,
        requestHeaders: sanitizeHeaders(requestHeaders),
        responseHeaders,
      };
      runtime.report.requestLog.push(requestLogEntry);

      if (endpoint === "status" && response.ok) {
        runtime.quota = normalizeStatusMetadata(data);
      }

      if (response.status === 429) {
        if (attempt >= MAX_429_RETRIES) {
          const retryAfterMs = parseRetryAfterMs(
            response.headers.get("retry-after"),
            nowMs()
          );
          throw new Error(
            `HTTP 429 persisted after ${MAX_429_RETRIES} retries on ${url}. Last wait ${retryAfterMs} ms.`
          );
        }

        const retryAfterMs = parseRetryAfterMs(
          response.headers.get("retry-after"),
          nowMs()
        );
        requestLogEntry.retryAfterMs = retryAfterMs;
        attempt += 1;
        await sleepImpl(retryAfterMs || config.retryAfterFallbackMs);
        continue;
      }

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status} from ${url}: ${JSON.stringify(data?.errors || data)}`
        );
      }

      return {
        status: response.status,
        url: url.toString(),
        data,
        responseHeaders,
      };
    }
  }

  async function fetchStatusSnapshot(label) {
    const statusResponse = await apiGet("status", {}, { stepKey: `status:${label}` });
    const normalized = normalizeStatusMetadata(statusResponse.data);

    const snapshot = {
      label,
      url: statusResponse.url,
      plan: normalized.plan,
      current: normalized.current,
      limit: normalized.limit,
      remaining: normalized.remaining,
    };

    runtime.report.statusSnapshots[label] = snapshot;
    return snapshot;
  }

  async function runCheckpointedStep(stepKey, executeStep, options = {}) {
    const checkpointed = readStepFromCheckpoint(stepKey);

    if (!options.alwaysRun && checkpointed) {
      runtime.report.reusedCheckpointSteps.push(stepKey);
      return checkpointed.payload;
    }

    const payload = await executeStep();

    if (!options.alwaysRun) {
      saveStepToCheckpoint(stepKey, payload);
    }

    return payload;
  }

  async function probeCompetition(target) {
    const stepKey = `competition:${target.key}`;

    return runCheckpointedStep(stepKey, async () => {
      const leagueLookup = await apiGet(
        "leagues",
        {
          name: target.queryName,
          country: target.country,
          type: target.type,
        },
        { stepKey }
      );

      const candidate = pickLeagueCandidate(leagueLookup.data?.response, target);

      if (!candidate) {
        return {
          key: target.key,
          displayName: target.displayName,
          status: "not_found",
          lookupUrl: leagueLookup.url,
          note: "No exact candidate returned by /leagues for the configured query.",
        };
      }

      const latestSeason = pickLatestSeason(candidate.seasons);
      const leagueId = candidate.league?.id;
      const season = latestSeason?.year;
      const coverage = latestSeason?.coverage || null;

      const result = {
        key: target.key,
        displayName: target.displayName,
        leagueId,
        providerLeagueName: candidate.league?.name,
        providerCountryName: candidate.country?.name || null,
        providerType: candidate.league?.type || null,
        lookupUrl: leagueLookup.url,
        season,
        current: latestSeason?.current ?? null,
        coverage,
      };

      if (!leagueId || !season) {
        result.status = "missing_season_or_id";
        return result;
      }

      const fixturesProbe = await apiGet(
        "fixtures",
        {
          league: leagueId,
          season,
          next: 1,
          timezone: "America/Argentina/Buenos_Aires",
        },
        { stepKey }
      );

      result.fixturesProbe = {
        url: fixturesProbe.url,
        results: fixturesProbe.data?.results ?? null,
      };

      const teamsProbe = await apiGet(
        "teams",
        {
          league: leagueId,
          season,
        },
        { stepKey }
      );

      const firstTeam = teamsProbe.data?.response?.[0]?.team;
      result.teamsProbe = {
        url: teamsProbe.url,
        results: teamsProbe.data?.results ?? null,
        sampledTeamId: firstTeam?.id ?? null,
        sampledTeamName: firstTeam?.name ?? null,
      };

      if (firstTeam?.id) {
        const teamStatisticsProbe = await apiGet(
          "teams/statistics",
          {
            league: leagueId,
            season,
            team: firstTeam.id,
          },
          { stepKey }
        );

        result.teamStatisticsProbe = {
          url: teamStatisticsProbe.url,
          hasResponse: Boolean(teamStatisticsProbe.data?.response),
        };
      }

      const oddsProbe = await apiGet(
        "odds",
        {
          league: leagueId,
          season,
          page: 1,
        },
        { stepKey }
      );

      result.oddsProbe = {
        url: oddsProbe.url,
        results: oddsProbe.data?.results ?? null,
        paging: oddsProbe.data?.paging ?? null,
      };

      result.status = "verified";
      return result;
    });
  }

  async function run() {
    assertEnv(config.apiKey);
    runtime.report.generatedAt = new Date().toISOString();

    const initialStatus = await fetchStatusSnapshot("initial");

    const seasons = await runCheckpointedStep("seasons", async () => {
      const response = await apiGet("leagues/seasons", {}, { stepKey: "seasons" });
      return {
        url: response.url,
        availableSeasons: response.data?.response || [],
      };
    });

    const bookmakers = await runCheckpointedStep("bookmakers", async () => {
      const response = await apiGet(
        "odds/bookmakers",
        {},
        { stepKey: "bookmakers" }
      );
      const names = Array.isArray(response.data?.response)
        ? response.data.response.map((item) => item.name).filter(Boolean)
        : [];

      return {
        url: response.url,
        bookmakerCount: names.length,
        bet365Available: names.some(
          (name) => name.toLowerCase() === "bet365"
        ),
        betanoAvailable: names.some(
          (name) => name.toLowerCase() === "betano"
        ),
        sampleBookmakers: names.slice(0, 20),
      };
    });

    const bets = await runCheckpointedStep("bets", async () => {
      const response = await apiGet("odds/bets", {}, { stepKey: "bets" });
      return {
        url: response.url,
        betCount: Array.isArray(response.data?.response)
          ? response.data.response.length
          : 0,
      };
    });

    let competitions = [];
    if (!config.smokeTest) {
      for (const target of TARGET_COMPETITIONS) {
        competitions.push(await probeCompetition(target));
      }
    }

    const finalStatus = await fetchStatusSnapshot("final");
    const quotaDeltaObserved =
      Number.isFinite(initialStatus.current) && Number.isFinite(finalStatus.current)
        ? finalStatus.current - initialStatus.current
        : null;

    const output = {
      generatedAt: runtime.report.generatedAt,
      provider: config.provider,
      baseUrl: config.baseUrl,
      smokeTest: config.smokeTest,
      minIntervalMs: config.minIntervalMs,
      retryAfterFallbackMs: config.retryAfterFallbackMs,
      softLimitPercent: config.softLimitPercent,
      initialStatus,
      finalStatus,
      quotaDeltaObserved,
      httpCallsIssued: runtime.report.requestLog.length,
      requestLog: runtime.report.requestLog,
      reusedCheckpointSteps: runtime.report.reusedCheckpointSteps,
      savedCheckpointSteps: runtime.report.savedCheckpointSteps,
      checkpointPath: config.checkpointPath,
      outputPath: config.outputPath,
      evidence: runtime.report.evidence,
      seasons,
      references: {
        bookmakers,
        bets,
      },
      competitions,
      recommendedCommand: config.smokeTest
        ? "SPORTS_API_MIN_INTERVAL_MS=7000 node ./scripts/discovery/validate-api-football.js"
        : null,
    };

    fs.mkdirSync(path.dirname(config.outputPath), { recursive: true });
    fs.writeFileSync(config.outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

    return output;
  }

  return {
    config,
    run,
    apiGet,
    checkpointState: runtime.checkpointState,
  };
}

async function main() {
  const runner = createDiscoveryRunner();
  const output = await runner.run();
  console.log(JSON.stringify(output, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  CHECKPOINT_DIRNAME,
  CHECKPOINT_FILENAME,
  DEFAULT_MIN_INTERVAL_MS,
  DEFAULT_RETRY_AFTER_FALLBACK_MS,
  DEFAULT_SOFT_LIMIT_PERCENT,
  MAX_429_RETRIES,
  TARGET_COMPETITIONS,
  buildRuntimeConfig,
  createDiscoveryRunner,
  loadCheckpoint,
  normalizeStatusMetadata,
  parseRetryAfterMs,
  sanitizeHeaders,
};

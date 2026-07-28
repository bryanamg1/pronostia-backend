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
const PREFLIGHT_FILENAME = "api-football-discovery.preflight.json";

const STATUS_OBSERVATION = {
  CONSISTENT: "CONSISTENT",
  EVENTUAL_OR_INCONSISTENT: "EVENTUAL_OR_INCONSISTENT",
  INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
};

const QUOTA_CONFIDENCE = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

const BOOKMAKER_AVAILABILITY = {
  CONFIRMED: "CONFIRMED",
  INCONCLUSIVE: "INCONCLUSIVE",
  NOT_OBSERVED: "NOT_OBSERVED",
};

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

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

function normalizeStatusMetadata(payload) {
  const response = payload?.response || {};
  const warnings = [];

  const plan =
    response?.subscription && Object.prototype.hasOwnProperty.call(response.subscription, "plan")
      ? response.subscription.plan
      : null;
  const current =
    response?.requests && Object.prototype.hasOwnProperty.call(response.requests, "current")
      ? Number(response.requests.current)
      : null;
  const limitDay =
    response?.requests && Object.prototype.hasOwnProperty.call(response.requests, "limit_day")
      ? Number(response.requests.limit_day)
      : null;

  if (plan === null || plan === undefined || plan === "") {
    warnings.push("Missing provider field: response.subscription.plan");
  }

  if (!Number.isFinite(current)) {
    warnings.push("Missing provider field: response.requests.current");
  }

  if (!Number.isFinite(limitDay)) {
    warnings.push("Missing provider field: response.requests.limit_day");
  }

  const currentValue = Number.isFinite(current) ? current : null;
  const limitDayValue = Number.isFinite(limitDay) ? limitDay : null;
  const remaining =
    Number.isFinite(currentValue) && Number.isFinite(limitDayValue)
      ? limitDayValue - currentValue
      : null;

  return {
    plan: plan ? String(plan) : null,
    current: currentValue,
    limitDay: limitDayValue,
    remaining,
    warnings,
  };
}

function normalizeLegacyStatusSnapshot(snapshot) {
  if (!snapshot) {
    return {
      plan: null,
      current: null,
      limitDay: null,
      remaining: null,
      warnings: ["Missing status snapshot."],
    };
  }

  const limitDay =
    snapshot.limitDay !== undefined && snapshot.limitDay !== null
      ? Number(snapshot.limitDay)
      : snapshot.limit !== undefined && snapshot.limit !== null
        ? Number(snapshot.limit)
        : null;

  return {
    plan: snapshot.plan ? String(snapshot.plan) : null,
    current:
      snapshot.current !== undefined &&
      snapshot.current !== null &&
      Number.isFinite(Number(snapshot.current))
        ? Number(snapshot.current)
        : null,
    limitDay: Number.isFinite(limitDay) ? limitDay : null,
    remaining:
      snapshot.remaining !== undefined &&
      snapshot.remaining !== null &&
      Number.isFinite(Number(snapshot.remaining))
        ? Number(snapshot.remaining)
        : null,
    warnings: Array.isArray(snapshot.warnings) ? snapshot.warnings.slice() : [],
  };
}

function getStepCost(stepKey) {
  if (stepKey === "seasons" || stepKey === "bookmakers" || stepKey === "bets") {
    return 1;
  }

  if (stepKey.startsWith("competition:")) {
    return 5;
  }

  return 0;
}

function getAllDiscoveryStepKeys() {
  return [
    "seasons",
    "bookmakers",
    "bets",
    ...TARGET_COMPETITIONS.map((competition) => `competition:${competition.key}`),
  ];
}

function buildBookmakerAvailability(catalogListed) {
  return {
    catalogListed: Boolean(catalogListed),
    fixtureAvailability: BOOKMAKER_AVAILABILITY.INCONCLUSIVE,
    competitionAvailability: BOOKMAKER_AVAILABILITY.INCONCLUSIVE,
    mvpMarketAvailability: BOOKMAKER_AVAILABILITY.INCONCLUSIVE,
  };
}

function extractHeaderQuotaObservations(requestLog) {
  return (Array.isArray(requestLog) ? requestLog : []).map((entry) => ({
    endpoint: entry.endpoint,
    context: entry.context || null,
    remaining: Number.isFinite(Number(entry.responseHeaders?.["x-ratelimit-requests-remaining"]))
      ? Number(entry.responseHeaders["x-ratelimit-requests-remaining"])
      : null,
    limit: Number.isFinite(Number(entry.responseHeaders?.["x-ratelimit-requests-limit"]))
      ? Number(entry.responseHeaders["x-ratelimit-requests-limit"])
      : null,
  }));
}

function isNonIncreasing(values) {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] > values[index - 1]) {
      return false;
    }
  }

  return true;
}

function buildQuotaObservability(reportLike, softLimitPercent) {
  const initialStatus = normalizeLegacyStatusSnapshot(reportLike?.initialStatus);
  const finalStatus = normalizeLegacyStatusSnapshot(reportLike?.finalStatus);
  const requestLog = Array.isArray(reportLike?.requestLog) ? reportLike.requestLog : [];
  const headerObservations = extractHeaderQuotaObservations(requestLog);
  const headerRemainingObservations = headerObservations
    .map((item) => item.remaining)
    .filter((value) => Number.isFinite(value));
  const headerLimitObservations = headerObservations
    .map((item) => item.limit)
    .filter((value) => Number.isFinite(value));

  const warnings = [
    ...initialStatus.warnings,
    ...finalStatus.warnings,
  ];

  const uniqueHeaderLimits = [...new Set(headerLimitObservations)];
  const limitDayFromHeaders =
    uniqueHeaderLimits.length === 1 ? uniqueHeaderLimits[0] : null;
  const statusLimitDay =
    Number.isFinite(finalStatus.limitDay) ? finalStatus.limitDay : initialStatus.limitDay;
  const knownDailyLimit = Number.isFinite(statusLimitDay)
    ? statusLimitDay
    : limitDayFromHeaders;
  const knownDailyLimitSource = Number.isFinite(statusLimitDay)
    ? "status_body"
    : Number.isFinite(limitDayFromHeaders)
      ? "headers_secondary"
      : "unknown";

  if (!Number.isFinite(statusLimitDay) && Number.isFinite(limitDayFromHeaders)) {
    warnings.push(
      "Daily limit could only be inferred from headers because the stored status snapshot did not include response.requests.limit_day."
    );
  }

  const knownCurrentUsage =
    Number.isFinite(finalStatus.current) ? finalStatus.current : initialStatus.current;
  const currentUsageSource =
    Number.isFinite(finalStatus.current) ? "status_body_final" :
    Number.isFinite(initialStatus.current) ? "status_body_initial" :
    "unknown";

  const statusReportedRemaining =
    Number.isFinite(finalStatus.remaining) ? finalStatus.remaining :
    Number.isFinite(initialStatus.remaining) ? initialStatus.remaining :
    Number.isFinite(knownDailyLimit) && Number.isFinite(knownCurrentUsage)
      ? knownDailyLimit - knownCurrentUsage
      : null;

  const locallyEstimatedConsumption = Number.isFinite(Number(reportLike?.httpCallsIssued))
    ? Number(reportLike.httpCallsIssued)
    : requestLog.length;

  const observedStatusDelta =
    Number.isFinite(initialStatus.current) && Number.isFinite(finalStatus.current)
      ? finalStatus.current - initialStatus.current
      : null;

  const localConservativeCurrent =
    Number.isFinite(knownCurrentUsage)
      ? knownCurrentUsage + locallyEstimatedConsumption
      : null;
  const locallyEstimatedRemaining =
    Number.isFinite(knownDailyLimit) && Number.isFinite(localConservativeCurrent)
      ? knownDailyLimit - localConservativeCurrent
      : null;
  const effectiveEstimatedRemaining =
    Number.isFinite(statusReportedRemaining) && Number.isFinite(locallyEstimatedRemaining)
      ? Math.min(statusReportedRemaining, locallyEstimatedRemaining)
      : Number.isFinite(statusReportedRemaining)
        ? statusReportedRemaining
        : Number.isFinite(locallyEstimatedRemaining)
          ? locallyEstimatedRemaining
          : null;

  const headersMonotonic =
    headerRemainingObservations.length <= 1 || isNonIncreasing(headerRemainingObservations);
  const quotaObservationStatus =
    !Number.isFinite(observedStatusDelta)
      ? STATUS_OBSERVATION.INSUFFICIENT_DATA
      : observedStatusDelta !== locallyEstimatedConsumption || !headersMonotonic
        ? STATUS_OBSERVATION.EVENTUAL_OR_INCONSISTENT
        : STATUS_OBSERVATION.CONSISTENT;

  if (!headersMonotonic) {
    warnings.push(
      "Header observations for x-ratelimit-requests-remaining were non-monotonic and are treated as secondary evidence only."
    );
  }

  const quotaConfidence =
    knownDailyLimitSource === "status_body" &&
    quotaObservationStatus === STATUS_OBSERVATION.CONSISTENT
      ? QUOTA_CONFIDENCE.HIGH
      : knownDailyLimitSource === "status_body"
        ? QUOTA_CONFIDENCE.MEDIUM
        : QUOTA_CONFIDENCE.LOW;

  const softLimitAbsolute = Number.isFinite(knownDailyLimit)
    ? Math.floor((knownDailyLimit * softLimitPercent) / 100)
    : null;
  const softLimitRemaining =
    Number.isFinite(softLimitAbsolute) && Number.isFinite(knownCurrentUsage)
      ? softLimitAbsolute - knownCurrentUsage
      : null;

  return {
    plan: finalStatus.plan || initialStatus.plan || null,
    statusCurrentInitial: Number.isFinite(initialStatus.current) ? initialStatus.current : null,
    statusCurrentFinal: Number.isFinite(finalStatus.current) ? finalStatus.current : null,
    knownCurrentUsage: Number.isFinite(knownCurrentUsage) ? knownCurrentUsage : null,
    currentUsageSource,
    knownDailyLimit: Number.isFinite(knownDailyLimit) ? knownDailyLimit : null,
    knownDailyLimitSource,
    reportedRemaining:
      Number.isFinite(statusReportedRemaining) ? statusReportedRemaining : null,
    observedStatusDelta,
    headerRemainingObservations,
    headerLimitObservations,
    headersMonotonic,
    httpCallsIssued: locallyEstimatedConsumption,
    locallyEstimatedConsumption,
    localConservativeCurrent:
      Number.isFinite(localConservativeCurrent) ? localConservativeCurrent : null,
    locallyEstimatedRemaining:
      Number.isFinite(locallyEstimatedRemaining) ? locallyEstimatedRemaining : null,
    effectiveEstimatedRemaining:
      Number.isFinite(effectiveEstimatedRemaining) ? effectiveEstimatedRemaining : null,
    quotaObservationStatus,
    quotaConfidence,
    softLimitAbsolute,
    softLimitRemaining,
    warnings,
  };
}

function buildPreflightReport({
  checkpointState,
  latestOutput,
  softLimitPercent,
  max429Retries = MAX_429_RETRIES,
}) {
  const steps = checkpointState?.steps || {};
  const checkpointStepKeys = Object.keys(steps);
  const allStepKeys = getAllDiscoveryStepKeys();
  const reusedStepKeys = checkpointStepKeys.filter((stepKey) => allStepKeys.includes(stepKey));
  const missingStepKeys = allStepKeys.filter((stepKey) => !reusedStepKeys.includes(stepKey));
  const estimatedReusedCalls = reusedStepKeys.reduce(
    (sum, stepKey) => sum + getStepCost(stepKey),
    0
  );
  const estimatedNewCalls =
    2 + missingStepKeys.reduce((sum, stepKey) => sum + getStepCost(stepKey), 0);
  const estimatedMaximumCalls = estimatedNewCalls + max429Retries;
  const quotaObservability = buildQuotaObservability(latestOutput || {}, softLimitPercent);
  const checkpointReusable = reusedStepKeys.length > 0;
  const marginToSoftLimit =
    Number.isFinite(quotaObservability.softLimitRemaining)
      ? quotaObservability.softLimitRemaining - estimatedMaximumCalls
      : null;
  const marginToEffectiveRemaining =
    Number.isFinite(quotaObservability.effectiveEstimatedRemaining)
      ? quotaObservability.effectiveEstimatedRemaining - estimatedMaximumCalls
      : null;
  const marginOfSafety =
    Number.isFinite(marginToSoftLimit) && Number.isFinite(marginToEffectiveRemaining)
      ? Math.min(marginToSoftLimit, marginToEffectiveRemaining)
      : Number.isFinite(marginToSoftLimit)
        ? marginToSoftLimit
        : Number.isFinite(marginToEffectiveRemaining)
          ? marginToEffectiveRemaining
          : null;
  const safeToRun = Boolean(
    checkpointReusable &&
      Number.isFinite(quotaObservability.knownDailyLimit) &&
      Number.isFinite(quotaObservability.knownCurrentUsage) &&
      Number.isFinite(marginToSoftLimit) &&
      Number.isFinite(marginToEffectiveRemaining) &&
      marginToSoftLimit >= 0 &&
      marginToEffectiveRemaining >= 0
  );

  return {
    generatedAt: new Date().toISOString(),
    checkpointSteps: checkpointStepKeys.length,
    reusedStepKeys,
    checkpointReusable,
    estimatedReusedCalls,
    estimatedNewCalls,
    estimatedMaximumCalls,
    knownDailyLimit: quotaObservability.knownDailyLimit,
    knownCurrentUsage: quotaObservability.knownCurrentUsage,
    statusCurrentInitial: quotaObservability.statusCurrentInitial,
    statusCurrentFinal: quotaObservability.statusCurrentFinal,
    observedStatusDelta: quotaObservability.observedStatusDelta,
    headerRemainingObservations: quotaObservability.headerRemainingObservations,
    locallyEstimatedConsumption: quotaObservability.locallyEstimatedConsumption,
    quotaObservationStatus: quotaObservability.quotaObservationStatus,
    quotaConfidence: quotaObservability.quotaConfidence,
    effectiveEstimatedRemaining: quotaObservability.effectiveEstimatedRemaining,
    softLimit: quotaObservability.softLimitAbsolute,
    softLimitPercent,
    marginOfSafety,
    safeToRun,
    notes: [
      "estimatedNewCalls includes one initial /status call and one final /status call.",
      "estimatedMaximumCalls assumes the run stops after the first request that still returns HTTP 429 after two retries.",
      "effectiveEstimatedRemaining = min(reportedRemaining, knownDailyLimit - (knownCurrentUsage + locallyEstimatedConsumption)).",
    ],
    warnings: quotaObservability.warnings,
  };
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
  const providedSoftLimitPercent =
    overrides.softLimitPercent !== undefined ||
    process.env.SPORTS_API_SOFT_LIMIT_PERCENT !== undefined;

  return {
    provider: overrides.provider || process.env.SPORTS_API_PROVIDER || DEFAULT_PROVIDER,
    baseUrl: overrides.baseUrl || process.env.SPORTS_API_BASE_URL || DEFAULT_BASE_URL,
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
    providedSoftLimitPercent,
    smokeTest:
      overrides.smokeTest ?? parseBooleanEnv(process.env.DISCOVERY_SMOKE_TEST),
    dryRun:
      overrides.dryRun ?? parseBooleanEnv(process.env.DISCOVERY_DRY_RUN),
    checkpointPath:
      overrides.checkpointPath ||
      path.join(rootDir, CHECKPOINT_DIRNAME, CHECKPOINT_FILENAME),
    outputPath:
      overrides.outputPath || path.join(rootDir, OUTPUT_DIR, OUTPUT_FILENAME),
    preflightPath:
      overrides.preflightPath || path.join(rootDir, OUTPUT_DIR, PREFLIGHT_FILENAME),
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

  const runtime = {
    lastRequestStartedAtMs: null,
    checkpointState,
    latestOutput: options.latestOutput || readJsonIfExists(config.outputPath),
    quota: {
      plan: null,
      current: null,
      limitDay: null,
      remaining: null,
      warnings: [],
    },
    report: {
      generatedAt: null,
      provider: config.provider,
      baseUrl: config.baseUrl,
      smokeTest: config.smokeTest,
      dryRun: config.dryRun,
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
          "Observed smoke test after pacing correction: 5 HTTP calls, ~7 second spacing, 0 HTTP 429, checkpoint created, Bet365 and Betano listed in the general catalog.",
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

    const { current, limitDay, remaining } = runtime.quota;
    if (!Number.isFinite(limitDay)) {
      return;
    }

    if (Number.isFinite(remaining) && remaining <= 0) {
      throw new Error(
        `Daily quota exhausted before calling ${endpoint}. Remaining requests: 0.`
      );
    }

    if (Number.isFinite(current)) {
      const usagePercent = (current / limitDay) * 100;
      if (usagePercent >= config.softLimitPercent) {
        throw new Error(
          `Soft limit reached before calling ${endpoint}. Current usage ${current}/${limitDay} (${usagePercent.toFixed(
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
        const retryAfterMs = parseRetryAfterMs(
          response.headers.get("retry-after"),
          nowMs()
        );
        requestLogEntry.retryAfterMs = retryAfterMs;

        if (attempt >= MAX_429_RETRIES) {
          throw new Error(
            `HTTP 429 persisted after ${MAX_429_RETRIES} retries on ${url}. Last wait ${retryAfterMs} ms.`
          );
        }

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
      limitDay: normalized.limitDay,
      remaining: normalized.remaining,
      warnings: normalized.warnings,
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

  async function runDryRun() {
    const softLimitPercent = config.providedSoftLimitPercent
      ? config.softLimitPercent
      : Number.isFinite(Number(runtime.latestOutput?.softLimitPercent))
        ? Number(runtime.latestOutput.softLimitPercent)
        : config.softLimitPercent;

    const preflight = buildPreflightReport({
      checkpointState: runtime.checkpointState,
      latestOutput: runtime.latestOutput,
      softLimitPercent,
    });

    fs.mkdirSync(path.dirname(config.preflightPath), { recursive: true });
    fs.writeFileSync(config.preflightPath, `${JSON.stringify(preflight, null, 2)}\n`, "utf8");

    return preflight;
  }

  async function run() {
    runtime.report.generatedAt = new Date().toISOString();

    if (config.dryRun) {
      return runDryRun();
    }

    assertEnv(config.apiKey);

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

    const competitions = [];
    if (!config.smokeTest) {
      for (const target of TARGET_COMPETITIONS) {
        competitions.push(await probeCompetition(target));
      }
    }

    const finalStatus = await fetchStatusSnapshot("final");

    const output = {
      generatedAt: runtime.report.generatedAt,
      provider: config.provider,
      baseUrl: config.baseUrl,
      smokeTest: config.smokeTest,
      dryRun: false,
      minIntervalMs: config.minIntervalMs,
      retryAfterFallbackMs: config.retryAfterFallbackMs,
      softLimitPercent: config.softLimitPercent,
      initialStatus,
      finalStatus,
      httpCallsIssued: runtime.report.requestLog.length,
      requestLog: runtime.report.requestLog,
      reusedCheckpointSteps: runtime.report.reusedCheckpointSteps,
      savedCheckpointSteps: runtime.report.savedCheckpointSteps,
      checkpointPath: config.checkpointPath,
      outputPath: config.outputPath,
      evidence: runtime.report.evidence,
      quotaObservability: buildQuotaObservability(
        {
          initialStatus,
          finalStatus,
          requestLog: runtime.report.requestLog,
          httpCallsIssued: runtime.report.requestLog.length,
        },
        config.softLimitPercent
      ),
      seasons,
      references: {
        bookmakers,
        bets,
      },
      bookmakersObserved: {
        bet365: buildBookmakerAvailability(bookmakers.bet365Available),
        betano: buildBookmakerAvailability(bookmakers.betanoAvailable),
      },
      competitions,
      recommendedCommand: config.smokeTest
        ? "DISCOVERY_DRY_RUN=true node ./scripts/discovery/validate-api-football.js"
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
  BOOKMAKER_AVAILABILITY,
  CHECKPOINT_DIRNAME,
  CHECKPOINT_FILENAME,
  DEFAULT_MIN_INTERVAL_MS,
  DEFAULT_RETRY_AFTER_FALLBACK_MS,
  DEFAULT_SOFT_LIMIT_PERCENT,
  MAX_429_RETRIES,
  QUOTA_CONFIDENCE,
  STATUS_OBSERVATION,
  TARGET_COMPETITIONS,
  buildBookmakerAvailability,
  buildPreflightReport,
  buildQuotaObservability,
  buildRuntimeConfig,
  createDiscoveryRunner,
  loadCheckpoint,
  normalizeStatusMetadata,
  parseRetryAfterMs,
  sanitizeHeaders,
};

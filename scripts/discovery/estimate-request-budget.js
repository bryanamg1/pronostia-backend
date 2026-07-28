const DAILY_LIMIT = Number(process.env.SPORTS_API_DAILY_REQUEST_LIMIT || 100);
const SOFT_LIMIT_PERCENT = Number(process.env.SPORTS_API_SOFT_LIMIT_PERCENT || 70);
const SOFT_LIMIT_ABSOLUTE = Math.floor((DAILY_LIMIT * SOFT_LIMIT_PERCENT) / 100);
const COMPETITIONS = 11;
const OBSERVED_DISCOVERY_CALLS = 46;
const OBSERVED_STATUS_DELTA = 9;
const OBSERVED_EFFECTIVE_REMAINING = 32;

function buildScenario(name, fixtureCount, options = {}) {
  const statusCalls = options.statusCalls ?? 2;
  const referenceCalls = options.referenceCalls ?? 0;
  const competitionFixtureQueries = options.competitionFixtureQueries ?? COMPETITIONS;
  const standingsRefreshes = options.standingsRefreshes ?? COMPETITIONS;
  const fixtureStatistics = options.fixtureStatistics ?? fixtureCount;
  const teamStatistics = options.teamStatistics ?? fixtureCount * 2;
  const oddsCalls = options.oddsCalls ?? fixtureCount;
  const cacheAvoidedCalls = options.cacheAvoidedCalls ?? 0;
  const retryBuffer = options.retryBuffer ?? 0;

  const requestsFixed = statusCalls + referenceCalls;
  const requestsPerCompetition = competitionFixtureQueries + standingsRefreshes;
  const requestsPerFixture = fixtureStatistics + teamStatistics;
  const totalBeforeRetries =
    requestsFixed + requestsPerCompetition + requestsPerFixture + oddsCalls;
  const totalEstimated = totalBeforeRetries + retryBuffer;

  return {
    name,
    fixtureCount,
    requestsFixed,
    requestsPerCompetition,
    requestsPerFixture,
    requestsForOdds: oddsCalls,
    requestsAvoidedByCache: cacheAvoidedCalls,
    retryBuffer,
    totalEstimated,
    marginVsDailyLimit: DAILY_LIMIT - totalEstimated,
    marginVsSoftLimit: SOFT_LIMIT_ABSOLUTE - totalEstimated,
    withinDailyLimit: totalEstimated <= DAILY_LIMIT,
    withinSoftLimit: totalEstimated <= SOFT_LIMIT_ABSOLUTE,
  };
}

const scenarios = [
  buildScenario("day_without_fixtures", 0, {
    statusCalls: 1,
    referenceCalls: 0,
    competitionFixtureQueries: COMPETITIONS,
    standingsRefreshes: 0,
    fixtureStatistics: 0,
    teamStatistics: 0,
    oddsCalls: 0,
  }),
  buildScenario("development_first_execution_no_cache_10_fixtures", 10, {
    statusCalls: 2,
    referenceCalls: 3,
    competitionFixtureQueries: COMPETITIONS,
    standingsRefreshes: COMPETITIONS,
    fixtureStatistics: 10,
    teamStatistics: 20,
    oddsCalls: 10,
    retryBuffer: 2,
  }),
  buildScenario("subsequent_cached_execution_10_fixtures", 10, {
    statusCalls: 2,
    referenceCalls: 0,
    competitionFixtureQueries: COMPETITIONS,
    standingsRefreshes: 3,
    fixtureStatistics: 10,
    teamStatistics: 6,
    oddsCalls: 10,
    cacheAvoidedCalls: 22,
    retryBuffer: 2,
  }),
  buildScenario("subsequent_cached_execution_20_fixtures", 20, {
    statusCalls: 2,
    referenceCalls: 0,
    competitionFixtureQueries: COMPETITIONS,
    standingsRefreshes: 4,
    fixtureStatistics: 20,
    teamStatistics: 12,
    oddsCalls: 20,
    cacheAvoidedCalls: 40,
    retryBuffer: 2,
  }),
  buildScenario("subsequent_cached_execution_40_fixtures", 40, {
    statusCalls: 2,
    referenceCalls: 0,
    competitionFixtureQueries: COMPETITIONS,
    standingsRefreshes: 6,
    fixtureStatistics: 40,
    teamStatistics: 20,
    oddsCalls: 40,
    cacheAvoidedCalls: 80,
    retryBuffer: 2,
  }),
  buildScenario("naive_daily_execution_40_fixtures", 40, {
    statusCalls: 2,
    referenceCalls: 3,
    competitionFixtureQueries: COMPETITIONS,
    standingsRefreshes: COMPETITIONS,
    fixtureStatistics: 40,
    teamStatistics: 80,
    oddsCalls: 40,
    retryBuffer: 2,
  }),
  buildScenario("optimized_daily_execution_40_fixtures", 40, {
    statusCalls: 2,
    referenceCalls: 0,
    competitionFixtureQueries: COMPETITIONS,
    standingsRefreshes: 6,
    fixtureStatistics: 40,
    teamStatistics: 20,
    oddsCalls: 40,
    cacheAvoidedCalls: 80,
    retryBuffer: 2,
  }),
  buildScenario("maximum_with_retries_40_fixtures", 40, {
    statusCalls: 2,
    referenceCalls: 0,
    competitionFixtureQueries: COMPETITIONS,
    standingsRefreshes: 6,
    fixtureStatistics: 40,
    teamStatistics: 20,
    oddsCalls: 40,
    cacheAvoidedCalls: 80,
    retryBuffer: 6,
  }),
];

const output = {
  generatedAt: new Date().toISOString(),
  assumptions: {
    dailyLimit: DAILY_LIMIT,
    softLimitPercent: SOFT_LIMIT_PERCENT,
    softLimitAbsolute: SOFT_LIMIT_ABSOLUTE,
    competitions: COMPETITIONS,
  },
  observedDiscoveryRun: {
    httpCallsIssued: OBSERVED_DISCOVERY_CALLS,
    observedStatusDelta: OBSERVED_STATUS_DELTA,
    effectiveEstimatedRemaining: OBSERVED_EFFECTIVE_REMAINING,
  },
  scenarios,
  viability: {
    development: "Free plan is usable for discovery and low-volume development with aggressive checkpoint reuse.",
    pilot: "Conditional on cache reuse, fixture prioritization, and reduced per-fixture statistics refresh.",
    dailyNormalOperation: "Free plan is risky once fixture volume grows; optimized caching is mandatory.",
    dailyMax40Fixtures: "Free plan is not viable for consistent 40-fixture operation, even under optimized assumptions.",
  },
  notes: [
    "Scenario estimates model daily analysis, not the one-off provider discovery run.",
    "The optimized scenarios assume standings, team statistics, and bookmaker references are heavily cached.",
    "Odds requests are modeled per fixture because MVP value detection depends on pre-match odds freshness.",
    "A free-plan fit for discovery does not imply free-plan viability for production daily operation.",
  ],
};

console.log(JSON.stringify(output, null, 2));

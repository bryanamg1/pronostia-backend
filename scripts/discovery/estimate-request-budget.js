const TARGET_COMPETITIONS = 11;
const MAX_FIXTURES_PER_RUN = 40;
const MAX_TEAMS_PER_FIXTURE = 2;

function numberEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function buildScenario(name, calls) {
  const total = Object.values(calls).reduce((sum, value) => sum + value, 0);
  return { name, totalRequests: total, calls };
}

const oddsPagesPerRun = numberEnv("DISCOVERY_ODDS_PAGES_PER_RUN", TARGET_COMPETITIONS);
const fixtureQueriesPerRun = numberEnv("DISCOVERY_FIXTURE_QUERIES_PER_RUN", TARGET_COMPETITIONS);
const uniqueTeamsRefreshedPerRun = numberEnv(
  "DISCOVERY_UNIQUE_TEAMS_REFRESHED_PER_RUN",
  MAX_FIXTURES_PER_RUN * MAX_TEAMS_PER_FIXTURE
);

const scenarios = [
  buildScenario("naive_no_cache", {
    referenceDaily: 3,
    fixturesWindow: fixtureQueriesPerRun,
    oddsWindow: oddsPagesPerRun,
    teamStatistics: uniqueTeamsRefreshedPerRun,
  }),
  buildScenario("cached_historical_core", {
    referenceDaily: 3,
    fixturesWindow: fixtureQueriesPerRun,
    oddsWindow: oddsPagesPerRun,
    teamStatistics: 0,
  }),
  buildScenario("discovery_probe_once", {
    seasons: 1,
    bookmakers: 1,
    bets: 1,
    leagueLookups: TARGET_COMPETITIONS,
    fixturesProbe: TARGET_COMPETITIONS,
    teamsProbe: TARGET_COMPETITIONS,
    teamStatisticsProbe: TARGET_COMPETITIONS,
    oddsProbe: TARGET_COMPETITIONS,
  }),
];

const assessment = scenarios.map((scenario) => ({
  ...scenario,
  freePlanCompatible: scenario.totalRequests <= 100,
}));

const output = {
  generatedAt: new Date().toISOString(),
  assumptions: {
    targetCompetitions: TARGET_COMPETITIONS,
    maxFixturesPerRun: MAX_FIXTURES_PER_RUN,
    maxTeamsPerFixture: MAX_TEAMS_PER_FIXTURE,
    oddsPagesPerRun,
    fixtureQueriesPerRun,
    uniqueTeamsRefreshedPerRun,
  },
  notes: [
    "These are modeled estimates, not provider-guaranteed totals.",
    "Odds pagination can increase total calls above the baseline estimate.",
    "A daily run on the free plan is risky without aggressive historical caching.",
    "The final request budget must be recalibrated after authenticated discovery.",
  ],
  scenarios: assessment,
};

console.log(JSON.stringify(output, null, 2));

const fs = require("fs");
const path = require("path");

const BASE_URL =
  process.env.SPORTS_API_BASE_URL || "https://v3.football.api-sports.io";
const API_KEY = process.env.SPORTS_API_KEY;
const PROVIDER = process.env.SPORTS_API_PROVIDER || "api-football";

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

function assertEnv() {
  if (!API_KEY) {
    throw new Error(
      "Missing SPORTS_API_KEY. Set it in the local environment before running discovery."
    );
  }
}

async function apiGet(endpoint, params = {}) {
  const url = new URL(endpoint, `${BASE_URL.replace(/\/$/, "")}/`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      "x-apisports-key": API_KEY,
    },
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 300)}`);
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

async function probeCompetition(target) {
  const leagueLookup = await apiGet("leagues", {
    name: target.queryName,
    country: target.country,
    type: target.type,
  });

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

  const fixturesProbe = await apiGet("fixtures", {
    league: leagueId,
    season,
    next: 1,
    timezone: "America/Argentina/Buenos_Aires",
  });

  result.fixturesProbe = {
    url: fixturesProbe.url,
    results: fixturesProbe.data?.results ?? null,
  };

  const teamsProbe = await apiGet("teams", {
    league: leagueId,
    season,
  });

  const firstTeam = teamsProbe.data?.response?.[0]?.team;
  result.teamsProbe = {
    url: teamsProbe.url,
    results: teamsProbe.data?.results ?? null,
    sampledTeamId: firstTeam?.id ?? null,
    sampledTeamName: firstTeam?.name ?? null,
  };

  if (firstTeam?.id) {
    const teamStatisticsProbe = await apiGet("teams/statistics", {
      league: leagueId,
      season,
      team: firstTeam.id,
    });

    result.teamStatisticsProbe = {
      url: teamStatisticsProbe.url,
      hasResponse: Boolean(teamStatisticsProbe.data?.response),
    };
  }

  const oddsProbe = await apiGet("odds", {
    league: leagueId,
    season,
    page: 1,
  });

  result.oddsProbe = {
    url: oddsProbe.url,
    results: oddsProbe.data?.results ?? null,
    paging: oddsProbe.data?.paging ?? null,
  };

  result.status = "verified";
  return result;
}

async function loadBookmakerReferences() {
  const bookmakers = await apiGet("odds/bookmakers");
  const bets = await apiGet("odds/bets");

  const bookmakerNames = Array.isArray(bookmakers.data?.response)
    ? bookmakers.data.response.map((item) => item.name).filter(Boolean)
    : [];

  return {
    bookmakersUrl: bookmakers.url,
    betsUrl: bets.url,
    bookmakerCount: bookmakerNames.length,
    betCount: Array.isArray(bets.data?.response) ? bets.data.response.length : 0,
    bet365Available: bookmakerNames.some(
      (name) => name.toLowerCase() === "bet365"
    ),
    betanoAvailable: bookmakerNames.some(
      (name) => name.toLowerCase() === "betano"
    ),
    sampleBookmakers: bookmakerNames.slice(0, 20),
  };
}

async function main() {
  assertEnv();

  const seasons = await apiGet("leagues/seasons");
  const references = await loadBookmakerReferences();
  const competitions = [];

  for (const target of TARGET_COMPETITIONS) {
    competitions.push(await probeCompetition(target));
  }

  const output = {
    generatedAt: new Date().toISOString(),
    provider: PROVIDER,
    baseUrl: BASE_URL,
    seasonsUrl: seasons.url,
    availableSeasons: seasons.data?.response || [],
    references,
    competitions,
  };

  const outputDir = path.join(
    process.cwd(),
    "docs",
    "discovery-output"
  );
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, "api-football-discovery.latest.json");
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(output, null, 2));
  console.log(`\nSaved discovery output to ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

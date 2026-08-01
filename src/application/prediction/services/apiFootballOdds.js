import {
  MARKET_SELECTIONS,
  ODDS_SOURCE_TYPES
} from '../../../domain/prediction/constants/scoringDefaults.js'

const BOOKMAKER_PRIORITY = ['Bet365', 'Betano']

const SUPPORTED_BET_DEFINITIONS = [
  {
    names: ['match winner', 'winner'],
    market: 'MATCH_RESULT',
    selectionMap: {
      home: 'HOME',
      draw: 'DRAW',
      away: 'AWAY',
      1: 'HOME',
      x: 'DRAW',
      2: 'AWAY'
    }
  },
  {
    names: ['goals over/under', 'over/under'],
    market: 'OVER_UNDER_2_5',
    selectionMap: {
      'over 2.5': 'OVER_2_5',
      'under 2.5': 'UNDER_2_5'
    }
  },
  {
    names: ['both teams score', 'both teams to score'],
    market: 'BOTH_TEAMS_TO_SCORE',
    selectionMap: {
      yes: 'YES',
      no: 'NO'
    }
  },
  {
    names: ['double chance'],
    market: 'DOUBLE_CHANCE',
    selectionMap: {
      'home/draw': 'HOME_OR_DRAW',
      'draw/away': 'DRAW_OR_AWAY',
      'home/away': 'HOME_OR_AWAY',
      '1x': 'HOME_OR_DRAW',
      x2: 'DRAW_OR_AWAY',
      12: 'HOME_OR_AWAY'
    }
  }
]

function normalizeProviderText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function getBookmakerPriority(name) {
  const index = BOOKMAKER_PRIORITY.findIndex(
    (candidate) => candidate.toLowerCase() === String(name || '').toLowerCase()
  )

  return index === -1 ? BOOKMAKER_PRIORITY.length : index
}

function findBetDefinition(name) {
  const normalizedName = normalizeProviderText(name)

  return (
    SUPPORTED_BET_DEFINITIONS.find((definition) =>
      definition.names.includes(normalizedName)
    ) || null
  )
}

function isSupportedDecimalOdds(value) {
  return Number.isFinite(value) && value > 1
}

function buildOddsRowsForBookmaker({
  fixtureId,
  bookmakerName,
  capturedAt,
  bets
}) {
  const rows = []

  for (const bet of bets || []) {
    const definition = findBetDefinition(bet?.name)

    if (!definition) {
      continue
    }

    for (const rawValue of bet?.values || []) {
      const selection =
        definition.selectionMap[normalizeProviderText(rawValue?.value)]
      const decimalOdds = Number(rawValue?.odd)

      if (!selection || !isSupportedDecimalOdds(decimalOdds)) {
        continue
      }

      rows.push({
        fixtureId,
        bookmaker: bookmakerName,
        market: definition.market,
        selection,
        decimalOdds,
        sourceType: ODDS_SOURCE_TYPES.API,
        capturedAt
      })
    }
  }

  return rows
}

function countCompleteMarkets(rows) {
  const selectionsByMarket = new Map()

  for (const row of rows) {
    if (!selectionsByMarket.has(row.market)) {
      selectionsByMarket.set(row.market, new Set())
    }

    selectionsByMarket.get(row.market).add(row.selection)
  }

  let completedMarkets = 0

  for (const [market, selections] of selectionsByMarket.entries()) {
    const requiredSelections = MARKET_SELECTIONS[market] || []

    if (requiredSelections.every((selection) => selections.has(selection))) {
      completedMarkets += 1
    }
  }

  return completedMarkets
}

export function selectPreferredApiFootballBookmaker(bookmakers = []) {
  const candidates = bookmakers
    .map((candidate) => ({
      ...candidate,
      completedMarkets: countCompleteMarkets(candidate.rows)
    }))
    .filter((candidate) => candidate.rows.length > 0)
    .sort((left, right) => {
      if (right.completedMarkets !== left.completedMarkets) {
        return right.completedMarkets - left.completedMarkets
      }

      const leftPriority = getBookmakerPriority(left.bookmaker)
      const rightPriority = getBookmakerPriority(right.bookmaker)

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
      }

      return left.bookmaker.localeCompare(right.bookmaker)
    })

  return candidates[0] || null
}

export function extractApiFootballOddsRows({
  fixtureId,
  oddsResponseItem,
  fallbackCapturedAt = new Date().toISOString()
}) {
  const bookmakers = Array.isArray(oddsResponseItem?.bookmakers)
    ? oddsResponseItem.bookmakers
    : []
  const capturedAt = oddsResponseItem?.update || fallbackCapturedAt
  const candidates = bookmakers.map((bookmaker) => ({
    bookmaker: bookmaker?.name || 'Unknown bookmaker',
    rows: buildOddsRowsForBookmaker({
      fixtureId,
      bookmakerName: bookmaker?.name || 'Unknown bookmaker',
      capturedAt,
      bets: bookmaker?.bets
    })
  }))
  const preferred = selectPreferredApiFootballBookmaker(candidates)

  return {
    bookmakerCount: bookmakers.length,
    selectedBookmaker: preferred?.bookmaker || null,
    completedMarkets: preferred?.completedMarkets || 0,
    rows: preferred?.rows || []
  }
}

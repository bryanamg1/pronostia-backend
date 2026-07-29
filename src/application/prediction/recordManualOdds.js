import { ValidationError } from '../../shared/errors/AppError.js'
import {
  MARKET_SELECTIONS,
  ODDS_SOURCE_TYPES
} from '../../domain/prediction/constants/scoringDefaults.js'

export function createRecordManualOddsUseCase({
  fixtureRepository,
  oddsRepository,
  manualOddsAuditRepository,
  now = () => new Date()
}) {
  return async function recordManualOdds({
    fixtureId,
    bookmaker,
    market,
    selection,
    decimalOdds,
    enteredBy,
    capturedAt = now().toISOString()
  }) {
    const fixtureIdNumber = Number(fixtureId)
    const oddsNumber = Number(decimalOdds)

    if (!Number.isInteger(fixtureIdNumber) || fixtureIdNumber <= 0) {
      throw new ValidationError('fixtureId must be a positive integer')
    }

    if (!bookmaker || !market || !selection || !enteredBy) {
      throw new ValidationError(
        'bookmaker, market, selection and enteredBy are required'
      )
    }

    if (!MARKET_SELECTIONS[market]?.includes(selection)) {
      throw new ValidationError('market/selection combination is not supported')
    }

    if (!Number.isFinite(oddsNumber) || oddsNumber <= 1) {
      throw new ValidationError('decimalOdds must be greater than 1')
    }

    const fixture = await fixtureRepository.findFixtureById(fixtureIdNumber)

    if (!fixture) {
      throw new ValidationError(
        'fixtureId does not reference an existing fixture'
      )
    }

    const previousOdds = await oddsRepository.findOdds({
      fixtureId: fixtureIdNumber,
      bookmaker,
      market,
      selection,
      sourceType: ODDS_SOURCE_TYPES.MANUAL
    })

    const odds = await oddsRepository.upsertOdds({
      fixtureId: fixtureIdNumber,
      bookmaker,
      market,
      selection,
      decimalOdds: oddsNumber,
      sourceType: ODDS_SOURCE_TYPES.MANUAL,
      capturedAt
    })

    const auditEntry = await manualOddsAuditRepository.createEntry({
      oddsId: odds.id,
      enteredBy,
      previousValue: previousOdds?.decimalOdds ?? null,
      newValue: odds.decimalOdds,
      createdAt: now().toISOString()
    })

    return {
      status: 'ok',
      fixture,
      odds,
      auditEntry
    }
  }
}

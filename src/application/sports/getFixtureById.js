import { NotFoundError, ValidationError } from '../../shared/errors/AppError.js'

export function createGetFixtureByIdUseCase({ fixtureRepository }) {
  return async function getFixtureById(rawId) {
    const fixtureId = Number(rawId)

    if (!Number.isInteger(fixtureId) || fixtureId <= 0) {
      throw new ValidationError('Fixture id must be a positive integer')
    }

    const fixture = await fixtureRepository.findFixtureById(fixtureId)

    if (!fixture) {
      throw new NotFoundError('Fixture not found')
    }

    return fixture
  }
}

import {
  AUTHORIZED_COMPETITIONS,
  COMPETITION_TYPES
} from '../src/domain/sports/competitionCatalog.js'

describe('competition catalog', () => {
  test('contains exactly eighteen authorized competitions with unique keys and provider ids', () => {
    expect(AUTHORIZED_COMPETITIONS).toHaveLength(18)
    expect(
      new Set(AUTHORIZED_COMPETITIONS.map((competition) => competition.key))
        .size
    ).toBe(18)
    expect(
      new Set(
        AUTHORIZED_COMPETITIONS.map((competition) => competition.providerId)
      ).size
    ).toBe(18)
  })

  test('keeps the expected distribution by competition type', () => {
    expect(
      AUTHORIZED_COMPETITIONS.filter(
        (competition) => competition.type === COMPETITION_TYPES.DOMESTIC_LEAGUE
      )
    ).toHaveLength(7)
    expect(
      AUTHORIZED_COMPETITIONS.filter(
        (competition) => competition.type === COMPETITION_TYPES.DOMESTIC_CUP
      )
    ).toHaveLength(7)
    expect(
      AUTHORIZED_COMPETITIONS.filter(
        (competition) => competition.type === COMPETITION_TYPES.CONTINENTAL_CUP
      )
    ).toHaveLength(4)
  })

  test('includes the seven authorized domestic cups with verified provider ids', () => {
    expect(AUTHORIZED_COMPETITIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'copa-del-rey',
          providerId: 143,
          name: 'Copa del Rey'
        }),
        expect.objectContaining({
          key: 'fa-cup',
          providerId: 45,
          name: 'FA Cup'
        }),
        expect.objectContaining({
          key: 'coupe-de-france',
          providerId: 66,
          name: 'Coupe de France'
        }),
        expect.objectContaining({
          key: 'coppa-italia',
          providerId: 137,
          name: 'Coppa Italia'
        }),
        expect.objectContaining({
          key: 'dfb-pokal',
          providerId: 81,
          name: 'DFB-Pokal'
        }),
        expect.objectContaining({
          key: 'copa-argentina',
          providerId: 130,
          name: 'Copa Argentina'
        }),
        expect.objectContaining({
          key: 'copa-do-brasil',
          providerId: 73,
          name: 'Copa do Brasil'
        })
      ])
    )
  })
})

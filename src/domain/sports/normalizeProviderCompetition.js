export function normalizeProviderCompetition({
  target,
  providerPayload,
  season
}) {
  const source = providerPayload || {}
  const latestSeason =
    Array.isArray(source.seasons) &&
    source.seasons.find((entry) => Number(entry?.year) === Number(season))

  return {
    targetKey: target.key,
    providerId: Number(source.league?.id || target.providerId),
    name: source.league?.name || target.name,
    country: source.country?.name || target.country,
    season: Number(latestSeason?.year || season),
    enabled: true,
    coverage: latestSeason?.coverage || null,
    sourceUpdatedAt: source.league?.updated_at || source.league?.update || null
  }
}

function formatDateForTimezone(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  )

  return `${parts.year}-${parts.month}-${parts.day}`
}

export function buildFixtureWindow({ now, lookaheadHours, timezone }) {
  const startsAt = new Date(now)
  const endsAt = new Date(startsAt.getTime() + lookaheadHours * 60 * 60 * 1000)

  return {
    startsAt,
    endsAt,
    fromDate: formatDateForTimezone(startsAt, timezone),
    toDate: formatDateForTimezone(endsAt, timezone)
  }
}

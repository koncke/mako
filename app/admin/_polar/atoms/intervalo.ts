// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/packages/ui/src/components/atoms/FormattedInterval.tsx (la cuenta
// de adentro del `useMemo`). Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: la cuenta de Polar arma el rango en el orden del inglés («Nov 1 – 6, 2026»): con un locale en español salía
// «1 nov – 6, 2026» (Analytics › Costs, 6/11/2026). En español va el orden del español, el mismo que da
// `Intl.DateTimeFormat#formatRange`: «1–6 nov 2026», «5 oct – 6 nov 2026», «5 dic 2025 – 6 nov 2026». Lo armamos a mano
// (día y mes corto) para que no dependa de la versión de ICU del navegador (en es-AR, `formatRange` pone «de»). En
// cualquier otro locale, la cuenta de Polar tal cual. Puro: lo usa la vista (FormattedInterval.tsx) y lo prueba
// tests/admin-polar-arreglos-2.test.ts.

const esEspanol = (locale: string) => /^es\b/i.test(locale)

const mesCorto = (d: Date, locale: string) => d.toLocaleDateString(locale, { month: 'short' }).replace(/\.$/, '')

const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export function formatearIntervalo(
  startDatetime: Date | string,
  endDatetime: Date | string,
  { locale = 'es', hideCurrentYear = true, ahora = new Date() }: { locale?: string; hideCurrentYear?: boolean; ahora?: Date } = {},
): string {
  const startDate = new Date(startDatetime)
  const endDate = new Date(endDatetime)
  const currentYear = ahora.getFullYear()

  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()
  const startMonth = startDate.getMonth()
  const endMonth = endDate.getMonth()

  const separator = '–'

  const shouldHideYear = hideCurrentYear && endYear === currentYear && startYear === endYear

  if (esEspanol(locale)) {
    const anio = (y: number) => (shouldHideYear ? '' : ` ${y}`)
    const diaMes = (d: Date) => `${d.getDate()} ${mesCorto(d, locale)}`
    if (mismoDia(startDate, endDate)) return `${diaMes(endDate)}${anio(endYear)}`
    if (startYear === endYear && startMonth === endMonth) {
      return `${startDate.getDate()}${separator}${endDate.getDate()} ${mesCorto(endDate, locale)}${anio(endYear)}`
    }
    if (startYear === endYear) return `${diaMes(startDate)} ${separator} ${diaMes(endDate)}${anio(endYear)}`
    return `${diaMes(startDate)} ${startYear} ${separator} ${diaMes(endDate)} ${endYear}`
  }

  if (mismoDia(startDate, endDate)) {
    return endDate.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      ...(shouldHideYear ? {} : { year: 'numeric' }),
    })
  }

  if (startYear === endYear && startMonth === endMonth) {
    const startFormatted = startDate.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
    })
    const endFormatted = `${endDate.toLocaleDateString(locale, {
      day: 'numeric',
    })}${shouldHideYear ? '' : `, ${endYear}`}`
    return `${startFormatted} ${separator} ${endFormatted}`
  }

  if (startYear === endYear) {
    const startFormatted = startDate.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
    })
    const endFormatted = endDate.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      ...(shouldHideYear ? {} : { year: 'numeric' }),
    })
    return `${startFormatted} ${separator} ${endFormatted}`
  }

  const startFormatted = startDate.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const endFormatted = endDate.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${startFormatted} ${separator} ${endFormatted}`
}

export const fmt = (n) =>
  (n == null || isNaN(n)) ? '—' : Math.round(n).toLocaleString('en-US')

export const money = (n) => {
  if (n == null || isNaN(n)) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M'
  if (n >= 1e3) return Math.round(n / 1e3) + 'K'
  return '' + Math.round(n)
}

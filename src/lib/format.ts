export function pct(p: number, digits = 1): string {
  return `${(p * 100).toFixed(digits)}%`
}

export function stars(n: number): string {
  return '★'.repeat(n)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** Best-effort Spanish pluralization of the last word (mirrors the backend),
 * used only for the auto-create catalog label hint. The backend is authoritative. */
export function pluralizeEs(name: string): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return ''
  const parts = trimmed.split(' ')
  const w = parts[parts.length - 1]
  const low = w.toLowerCase()
  let plural: string
  if (/[sx]$/.test(low) && w.length > 1) plural = w
  else if (/[aeiouáéíóú]$/.test(low)) plural = w + 's'
  else if (low.endsWith('z')) plural = w.slice(0, -1) + 'ces'
  else plural = w + 'es'
  parts[parts.length - 1] = plural
  return parts.join(' ')
}

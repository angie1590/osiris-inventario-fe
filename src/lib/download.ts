import type { AxiosResponse } from 'axios'

export function downloadBlob(response: AxiosResponse, filename: string) {
  const blob = new Blob([response.data], { type: (response.headers['content-type'] as string | undefined) ?? 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

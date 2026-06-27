import { useEffect, useState } from 'react'
import type { ScannedReceipt } from '../types'

// Downscale to a JPEG data URL on the client: shrinks the upload and, because
// canvas re-encodes, also converts iPhone HEIC/PNG captures to JPEG (which the
// vision API accepts). Returns base64 with no data: prefix.
async function fileToJpegBase64(file: File, maxEdge = 1600): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read the file'))
    reader.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Could not load the image'))
    i.src = dataUrl
  })
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl.split(',')[1] ?? ''
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1] ?? ''
}

export function useReceiptScan() {
  const [configured, setConfigured] = useState(false)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    fetch('/api/scan/status')
      .then((r) => r.json())
      .then((d) => setConfigured(!!d.configured))
      .catch(() => setConfigured(false))
  }, [])

  async function scan(file: File): Promise<{ data?: ScannedReceipt; error?: string }> {
    setScanning(true)
    try {
      const image = await fileToJpegBase64(file)
      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      })
      const body = await res.json()
      if (!res.ok) return { error: body.error || 'Scan failed' }
      return { data: body as ScannedReceipt }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Scan failed' }
    } finally {
      setScanning(false)
    }
  }

  return { configured, scanning, scan }
}

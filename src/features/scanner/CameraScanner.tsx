import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { getDetector, isCameraScanSupported } from '@/features/scanner/camera-support'

/** Escaneo con la cámara del celular. Entrega el código leído a `onCode`. */
export function CameraScanner({
  onCode,
  onClose,
}: {
  onCode: (code: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const supported = isCameraScanSupported()

  useEffect(() => {
    const Detector = getDetector()
    if (!Detector) return
    const detector = new Detector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf'],
    })
    let stream: MediaStream | null = null
    let cancelled = false
    let timer = 0

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        const video = videoRef.current
        if (!video || cancelled) return
        video.srcObject = stream
        await video.play()
        const tick = async () => {
          if (cancelled) return
          try {
            const found = await detector.detect(video)
            const code = found[0]?.rawValue
            if (code) {
              onCode(code)
              return
            }
          } catch {
            // frame sin código: se reintenta
          }
          timer = window.setTimeout(() => {
            void tick()
          }, 250)
        }
        void tick()
      } catch {
        setFailure('No se pudo acceder a la cámara. Revisá los permisos del navegador.')
      }
    }
    void start()

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => {
        t.stop()
      })
    }
  }, [onCode])

  const message = supported ? failure : 'Este navegador no soporta el escaneo con cámara.'
  return (
    <Modal open title="Escanear código" onClose={onClose} size="sm">
      {message ? (
        <p className="text-sm text-red-700">{message}</p>
      ) : (
        <video
          ref={videoRef}
          className="aspect-square w-full rounded-lg bg-ink-950 object-cover"
          muted
          playsInline
        />
      )}
      <p className="mt-2 text-center text-sm text-bronze-600">
        Apuntá al código de barras de la etiqueta.
      </p>
    </Modal>
  )
}

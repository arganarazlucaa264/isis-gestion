import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { CameraScanner } from '@/features/scanner/CameraScanner'
import { isCameraScanSupported } from '@/features/scanner/camera-support'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/cx'

/**
 * Campo único de búsqueda / escaneo.
 *  - Lector USB o Bluetooth (modo teclado): escribe el código y envía Enter → onSubmit(code).
 *  - Cámara del celular: botón opcional que usa BarcodeDetector del navegador (si existe).
 *  - Escritura manual: igual que el lector.
 * No hace falta ningún cambio en el modelo ni en las RPC cuando se conecte hardware real.
 */
export function CodeInput({
  onSubmit,
  onChange,
  placeholder = 'Escaneá o escribí un código, SKU o nombre y presioná Enter',
  autoFocus = false,
  allowCamera = true,
  clearOnSubmit = true,
  className,
}: {
  onSubmit: (value: string) => void
  onChange?: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
  allowCamera?: boolean
  /** false: el texto queda en el campo (uso como filtro). true: se limpia (uso como escáner). */
  clearOnSubmit?: boolean
  className?: string
}) {
  const [value, setValue] = useState('')
  const [camera, setCamera] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  function submit(code: string) {
    const clean = code.trim()
    if (clean === '') return
    onSubmit(clean)
    if (clearOnSubmit) {
      setValue('')
      onChange?.('')
    } else {
      setValue(clean)
      onChange?.(clean)
    }
    ref.current?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit(value)
    }
  }

  return (
    <div className={cx('flex gap-2', className)}>
      <div className="relative flex-1">
        <Icon
          name="barcode"
          size={18}
          className="absolute top-1/2 left-3 -translate-y-1/2 text-bronze-400"
        />
        <input
          ref={ref}
          value={value}
          placeholder={placeholder}
          inputMode="search"
          autoComplete="off"
          onChange={(e) => {
            setValue(e.target.value)
            onChange?.(e.target.value)
          }}
          onKeyDown={onKeyDown}
          className="h-11 w-full rounded-lg border border-sand-300 bg-white pr-3 pl-10 text-sm focus:border-gold-500 focus:ring-2 focus:ring-gold-400/40 focus:outline-none"
        />
      </div>
      {allowCamera && isCameraScanSupported() && (
        <Button
          variant="outline"
          icon="camera"
          aria-label="Escanear con la cámara"
          onClick={() => {
            setCamera(true)
          }}
        />
      )}
      {camera && (
        <CameraScanner
          onCode={(code) => {
            setCamera(false)
            submit(code)
          }}
          onClose={() => {
            setCamera(false)
          }}
        />
      )}
    </div>
  )
}

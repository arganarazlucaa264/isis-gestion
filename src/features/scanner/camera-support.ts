// BarcodeDetector todavía no está en lib.dom de TypeScript.
export interface DetectedCode {
  rawValue: string
}
export interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedCode[]>
}
export interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike
}

export function getDetector(): BarcodeDetectorCtor | null {
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  return ctor ?? null
}

/** ¿Este navegador puede escanear con la cámara? (Chrome/Android y otros con BarcodeDetector) */
export function isCameraScanSupported(): boolean {
  return typeof window !== 'undefined' && getDetector() !== null && 'mediaDevices' in navigator
}

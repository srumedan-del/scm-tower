'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Camera, Barcode, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'

interface BarcodeScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScanSuccess: (scannedText: string) => void
  title?: string
  subtitle?: string
  expectedCode?: string
}

export function BarcodeScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Scan Barcode',
  subtitle = 'Arahkan kamera ke barcode resi / koli / armada',
  expectedCode,
}: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [hasCamera, setHasCamera] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      stopCamera()
      return
    }

    startCamera()

    return () => {
      stopCamera()
    }
  }, [isOpen])

  async function startCamera() {
    setErrorMsg(null)
    setIsScanning(true)

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCamera(false)
        setErrorMsg('Perangkat tidak mendukung akses kamera langsung.')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        await videoRef.current.play()
      }

      // Check if native BarcodeDetector is available
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'ean_8'],
        })

        const scanInterval = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current)
            if (barcodes && barcodes.length > 0) {
              const rawVal = barcodes[0].rawValue?.trim()
              if (rawVal) {
                clearInterval(scanInterval)
                stopCamera()
                onScanSuccess(rawVal)
              }
            }
          } catch {
            // detection frame skip
          }
        }, 300)

        return () => clearInterval(scanInterval)
      }
    } catch (err: any) {
      console.warn('Camera error:', err.message)
      setHasCamera(false)
      setErrorMsg('Izin kamera tidak diberikan atau kamera sedang digunakan.')
    }
  }

  function stopCamera() {
    setIsScanning(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!manualCode.trim()) return
    stopCamera()
    onScanSuccess(manualCode.trim().toUpperCase())
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-t-[32px] sm:rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-mobile-sheet">
        {/* Drag handle */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto" />

        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wide leading-tight">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera()
              onClose()
            }}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewfinder */}
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-slate-200 flex items-center justify-center">
          {hasCamera ? (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />

              {/* Red laser scanner line overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-3/4 h-28 border-2 border-indigo-400/90 rounded-xl relative shadow-lg shadow-indigo-500/20">
                  <div className="w-full h-0.5 bg-rose-500 shadow-sm shadow-rose-400 animate-pulse absolute top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </>
          ) : (
            <div className="p-4 text-center space-y-2">
              <Camera className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-300">{errorMsg || 'Kamera tidak aktif'}</p>
            </div>
          )}
        </div>

        {expectedCode && (
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Target Kode:</span>
            <span className="font-mono font-bold text-indigo-600">{expectedCode}</span>
          </div>
        )}

        {/* Manual Input Fallback */}
        <form onSubmit={handleManualSubmit} className="pt-1 space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Atau Masukkan Nomor Kode Manual:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              placeholder="Ketik PSS / No. Plat / Barcode"
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs uppercase tracking-wide rounded-xl shadow-md transition-all"
            >
              OK
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

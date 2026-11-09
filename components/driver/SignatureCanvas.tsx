'use client'

import React, { useRef, useState, useEffect } from 'react'
import { RotateCcw, Check, PenTool } from 'lucide-react'

interface SignatureCanvasProps {
  onSave: (dataUrl: string) => void
  onClear?: () => void
  height?: number
}

export function SignatureCanvas({ onSave, onClear, height = 180 }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set high-DPI scaling
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.5
    ctx.strokeStyle = '#1e3a8a' // blue-900 crisp ink
  }, [])

  function getCoordinates(e: React.TouchEvent | React.MouseEvent) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()

    if ('touches' in e) {
      const touch = e.touches[0]
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }
    } else {
      return {
        x: (e as React.MouseEvent).clientX - rect.left,
        y: (e as React.MouseEvent).clientY - rect.top,
      }
    }
  }

  function startDrawing(e: React.TouchEvent | React.MouseEvent) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { x, y } = getCoordinates(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  function draw(e: React.TouchEvent | React.MouseEvent) {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { x, y } = getCoordinates(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSignature(true)
  }

  function stopDrawing() {
    if (!isDrawing) return
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas && hasSignature) {
      onSave(canvas.toDataURL('image/png'))
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
    onClear?.()
    onSave('')
  }

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-slate-300 bg-white rounded-2xl overflow-hidden touch-none shadow-xs">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: `${height}px` }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="cursor-crosshair w-full block bg-white"
        />

        {!hasSignature && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-1.5 text-slate-400">
            <PenTool className="w-5 h-5 text-indigo-500/70" />
            <span className="text-xs font-medium">Bubuhi tanda tangan penerima di sini</span>
          </div>
        )}

        <div className="absolute bottom-2 left-3 pointer-events-none">
          <div className="w-24 border-b border-slate-300" />
          <span className="text-[9px] uppercase tracking-wider text-slate-400 block mt-0.5">Area TTD</span>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] text-slate-500">
          {hasSignature ? (
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Tanda tangan tersimpan
            </span>
          ) : (
            'Wajib ditandatangani oleh penerima di lokasi'
          )}
        </span>

        {hasSignature && (
          <button
            type="button"
            onClick={clearCanvas}
            className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 py-1 px-2.5 rounded-lg bg-rose-50 active:scale-95 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Bersihkan</span>
          </button>
        )}
      </div>
    </div>
  )
}

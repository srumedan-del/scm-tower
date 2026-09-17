'use client'
import { useState } from 'react'
import ShipmentEditPanel from './ShipmentEditPanel'

type FleetType = 'Internal' | 'Eksternal'

export function ShipmentAddButton({ vendors }:{ vendors:{vendor_name:string;vendor_code:string}[] }) {
  const [step, setStep] = useState<'select' | 'form'>('select')
  const [fleetType, setFleetType] = useState<FleetType | null>(null)

  return (
    <>
      <button onClick={() => setStep('select')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">
        + TAMBAH SHIPMENT
      </button>

      {step === 'select' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold uppercase mb-4">PILIH JENIS ARMADA</h3>
            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="radio"
                  value="Internal"
                  checked={fleetType === 'Internal'}
                  onChange={() => setFleetType('Internal')}
                  className="w-4 h-4 rounded border-gray-400 focus:ring-indigo-500"
                />
                Internal (Kendaraan milik SRU)
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="radio"
                  value="Eksternal"
                  checked={fleetType === 'Eksternal'}
                  onChange={() => setFleetType('Eksternal')}
                  className="w-4 h-4 rounded border-gray-400 focus:ring-indigo-500"
                />
                Eksternal (Sewa/vendor)
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep('select')}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                onClick={() => { if (fleetType) setStep('form') }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"
                disabled={!fleetType}
              >
                Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'form' && fleetType && (
        <ShipmentEditPanel
          shipment={null}
          vendors={vendors}
          fleetType={fleetType}
          onClose={() => setStep('select')}
          onSaved={() => {
            setStep('select')
            setFleetType(null)
            if (typeof window !== 'undefined') window.location.reload()
          }}
        />
      )}
    </>
  )
}

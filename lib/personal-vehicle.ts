/**
 * Armada "KENDARAAN PRIBADI" di master transport_fleet: pengiriman memakai kendaraan
 * pribadi driver. Tidak ada GPS tracking, tidak ada KM, dan tidak ada klaim BBM/biaya.
 */
export const PERSONAL_VEHICLE_TYPE = 'PRIBADI'

export function isPersonalVehicleType(vehicleType: string | null | undefined) {
  return String(vehicleType ?? '').trim().toUpperCase() === PERSONAL_VEHICLE_TYPE
}

export function vehicleOptionLabel(vehicle: { vehicle_no: string; vehicle_type: string | null }) {
  return isPersonalVehicleType(vehicle.vehicle_type)
    ? 'Kendaraan pribadi driver'
    : `${vehicle.vehicle_no}${vehicle.vehicle_type ? ` · ${vehicle.vehicle_type}` : ''}`
}

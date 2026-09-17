export function displayVendorName(value: string | null | undefined) {
  const name = String(value ?? '').trim()
  if (!name) return name
  if (/^PT\.\s*ADI SARANA ARMADA TBK\s*-\s*MEDAN$/i.test(name)) return 'ASSA'
  if (/^PT\.\s*RIANG SARANA ARTHA$/i.test(name)) return 'RSA'
  return name
}

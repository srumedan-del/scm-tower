'use client'

import { useEffect } from 'react'

function normalizeNumericString(raw: string) {
  if (!raw) return ''

  const trimmed = raw.trim()
  if (!trimmed) return ''

  const sign = trimmed.startsWith('-') ? '-' : ''
  const withoutSign = sign ? trimmed.slice(1) : trimmed
  const digits = withoutSign.replace(/[^\d,\.]/g, '')
  if (!digits) return ''

  const normalized = digits.replace(/\./g, '').replace(',', '.')
  return `${sign}${normalized}`
}

function formatNumericValue(raw: string) {
  const normalized = normalizeNumericString(raw)
  if (!normalized) return ''

  const negative = normalized.startsWith('-')
  const signless = negative ? normalized.slice(1) : normalized
  const [whole, fraction] = signless.split('.')
  const numericWhole = whole.replace(/[^\d]/g, '')
  const strWhole = Number(numericWhole || 0).toLocaleString('id-ID')

  if (fraction !== undefined) {
    const cleanFraction = fraction.replace(/[^\d]/g, '')
    if (!cleanFraction) return `${negative ? '-' : ''}${strWhole}`
    return `${negative ? '-' : ''}${strWhole},${cleanFraction}`
  }

  return `${negative ? '-' : ''}${strWhole}`
}

export default function NumericInputEnhancer() {
  useEffect(() => {
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="number"], input[data-numeric]')

    const applyFormatting = (input: HTMLInputElement) => {
      if (input.dataset.numericHooked === 'true') return
      input.dataset.numericHooked = 'true'
      input.setAttribute('inputmode', 'decimal')
      input.setAttribute('type', 'text')

      const syncFromValue = () => {
        const formatted = formatNumericValue(input.value)
        if (formatted !== input.value) input.value = formatted
      }

      const syncToRaw = () => {
        const raw = normalizeNumericString(input.value)
        input.dataset.rawValue = raw
        input.value = raw
      }

      input.addEventListener('focus', () => {
        syncToRaw()
      })

      input.addEventListener('blur', () => {
        const formatted = formatNumericValue(input.value)
        input.value = formatted
      })

      input.addEventListener('input', () => {
        const raw = normalizeNumericString(input.value)
        if (!raw) {
          input.value = ''
          input.dataset.rawValue = ''
          return
        }

        const next = raw.includes('.') ? raw : raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
        input.dataset.rawValue = raw
        input.value = formatNumericValue(next)
      })

      syncFromValue()
    }

    inputs.forEach(applyFormatting)

    const observer = new MutationObserver(() => {
      const currentInputs = document.querySelectorAll<HTMLInputElement>('input[type="number"], input[data-numeric]')
      currentInputs.forEach(input => {
        if (input.dataset.numericHooked !== 'true') applyFormatting(input)
      })
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  return null
}

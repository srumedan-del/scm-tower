'use client'

import { useEffect } from 'react'

function parseNumericText(value: string) {
  if (!value) return ''

  const cleaned = value.replace(/[^\d,.-]/g, '')
  if (!cleaned) return ''

  const negative = cleaned.startsWith('-')
  const body = negative ? cleaned.slice(1) : cleaned
  const hasComma = body.includes(',')
  const hasDot = body.includes('.')

  if (hasComma && !hasDot) {
    return `${negative ? '-' : ''}${body.replace(',', '.')}`
  }

  if (hasDot) {
    const parts = body.split('.')
    if (parts.length > 2) {
      return `${negative ? '-' : ''}${parts[0]}.${parts.slice(1).join('')}`
    }
    return `${negative ? '-' : ''}${body}`
  }

  return `${negative ? '-' : ''}${body.replace(/[,]/g, '')}`
}

function parseFormattedNumber(value: string) {
  if (!value) return ''
  const cleaned = value.replace(/[^\d,.-]/g, '')
  if (!cleaned) return ''

  const negative = cleaned.startsWith('-')
  const body = negative ? cleaned.slice(1) : cleaned
  const normalized = body.replace(/\./g, '').replace(',', '.')
  return normalized ? `${negative ? '-' : ''}${normalized}` : ''
}

function formatNumber(value: string) {
  const raw = parseNumericText(value)
  if (!raw || raw === '-' || raw === '-0') return ''

  const negative = raw.startsWith('-')
  const signless = negative ? raw.slice(1) : raw
  const [whole, decimal] = signless.split('.')
  const formattedWhole = Number(whole || 0).toLocaleString('id-ID')

  if (decimal !== undefined) {
    const cleanDecimal = decimal.replace(/[^\d]/g, '')
    return `${negative ? '-' : ''}${formattedWhole},${cleanDecimal}`
  }

  return `${negative ? '-' : ''}${formattedWhole}`
}

export default function NumericFieldAdapter() {
  useEffect(() => {
    const applyToInput = (input: HTMLInputElement) => {
      if (input.dataset.numericAdapter === 'true') return
      input.dataset.numericAdapter = 'true'
      input.setAttribute('inputmode', 'decimal')
      input.setAttribute('type', 'text')
      input.setAttribute('step', 'any')

      const formatValue = () => {
        const raw = parseFormattedNumber(input.value ?? '')
        input.dataset.rawValue = raw
        input.value = raw ? formatNumber(raw) : ''
      }

      input.addEventListener('focus', () => {
        const raw = parseFormattedNumber(input.value ?? '')
        input.dataset.rawValue = raw
        input.value = raw || ''
      })

      input.addEventListener('blur', formatValue)

      input.addEventListener('input', () => {
        const raw = parseNumericText(input.value ?? '')
        input.dataset.rawValue = raw
        input.value = raw ? raw : ''
      })

      formatValue()
    }

    const syncInputs = () => {
      document.querySelectorAll<HTMLInputElement>('input[type="number"]').forEach(input => {
        applyToInput(input)
      })
    }

    syncInputs()

    const observer = new MutationObserver(() => {
      syncInputs()
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  return null
}

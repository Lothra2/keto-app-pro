export const isNumberInRange = (value, min, max) => {
  const num = Number(value)
  if (Number.isNaN(num)) return false
  if (min !== undefined && num < min) return false
  if (max !== undefined && num > max) return false
  return true
}

export const validateMetrics = ({ height, weight, age }) => {
  const errors = {}

  if (height !== undefined && height !== '' && !isNumberInRange(height, 120, 230)) {
    errors.height = 'Altura inválida'
  }

  if (weight !== undefined && weight !== '' && !isNumberInRange(weight, 35, 250)) {
    errors.weight = 'Peso inválido'
  }

  if (age !== undefined && age !== '' && !isNumberInRange(age, 16, 90)) {
    errors.age = 'Edad inválida'
  }

  return errors
}

export const isEmpty = (value) =>
  value === undefined || value === null || String(value).trim() === ''

// Helpers de normalización, aceptan coma o punto
export const toNumberOrNull = (value) => {
  if (value === undefined || value === null) return null
  const num = parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(num) ? num : null
}

export const toOneDecimal = (value) => {
  const n = toNumberOrNull(value)
  if (n === null) return null
  return Math.round(n * 10) / 10
}

export const toIntOrNull = (value) => {
  const n = toNumberOrNull(value)
  if (n === null) return null
  return Math.round(n)
}

export const parseDateInput = (value) => {
  if (!value && value !== 0) return null
  const raw = String(value).trim()
  if (!raw) return null

  const parts = raw.split(/[\/\-]/).filter(Boolean)
  const today = new Date()

  if (parts.length >= 2) {
    const day = Number(parts[0])
    const month = Number(parts[1])
    const year = parts[2] ? Number(parts[2]) : today.getFullYear()

    if (Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year)) {
      const parsed = new Date(year, month - 1, day)
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
    }
  }

  const fallback = new Date(raw)
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toISOString()
  }

  return null
}

export default {
  isNumberInRange,
  validateMetrics,
  isEmpty,
  toNumberOrNull,
  toOneDecimal,
  toIntOrNull,
  parseDateInput
}

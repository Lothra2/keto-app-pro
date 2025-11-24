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

export default {
  isNumberInRange,
  validateMetrics,
  isEmpty,
  toNumberOrNull,
  toOneDecimal,
  toIntOrNull
}

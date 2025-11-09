export const isNumberInRange = (value, min, max) => {
  const num = Number(value);
  if (Number.isNaN(num)) return false;
  if (min !== undefined && num < min) return false;
  if (max !== undefined && num > max) return false;
  return true;
};

export const validateMetrics = ({ height, weight, age }) => {
  const errors = {};

  if (height !== undefined && height !== '' && !isNumberInRange(height, 120, 230)) {
    errors.height = 'Altura inválida';
  }

  if (weight !== undefined && weight !== '' && !isNumberInRange(weight, 35, 250)) {
    errors.weight = 'Peso inválido';
  }

  if (age !== undefined && age !== '' && !isNumberInRange(age, 16, 90)) {
    errors.age = 'Edad inválida';
  }

  return errors;
};

export const isEmpty = (value) =>
  value === undefined || value === null || String(value).trim() === '';

export default {
  isNumberInRange,
  validateMetrics,
  isEmpty
};

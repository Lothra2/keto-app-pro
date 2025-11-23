// Small theme utilities
export const withAlpha = (color, alpha = 1) => {
  if (!color) return `rgba(0,0,0,${alpha})`;

  if (color.startsWith('rgb')) {
    const values = color
      .replace(/rgba?\(/, '')
      .replace(/\)/, '')
      .split(',')
      .map((v) => v.trim())
      .slice(0, 3)
      .join(',');
    return `rgba(${values},${alpha})`;
  }

  const hex = color.replace('#', '');
  const normalized = hex.length === 3
    ? hex
        .split('')
        .map((char) => char + char)
        .join('')
    : hex.padEnd(6, '0');

  const intVal = parseInt(normalized, 16);
  const r = (intVal >> 16) & 255;
  const g = (intVal >> 8) & 255;
  const b = intVal & 255;

  return `rgba(${r},${g},${b},${alpha})`;
};

export default { withAlpha };

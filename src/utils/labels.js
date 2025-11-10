export const getDayDisplayName = ({ label, index = 0, language = 'es' }) => {
  const fallback = language === 'en' ? `Day ${index + 1}` : `Día ${index + 1}`;

  if (typeof label !== 'string') {
    return fallback;
  }

  const trimmed = label.trim();
  if (!trimmed) {
    return fallback;
  }

  if (language === 'en') {
    const numberMatch = trimmed.match(/\d+/);
    if (numberMatch) {
      return `Day ${Number(numberMatch[0])}`;
    }

    if (/día/i.test(trimmed)) {
      return trimmed.replace(/día/gi, 'Day');
    }

    return trimmed;
  }

  return trimmed || fallback;
};

export const getDayTag = (index = 0, language = 'es') => {
  const prefix = language === 'en' ? 'D' : 'D';
  return `${prefix}${index + 1}`;
};

export const sanitizeReviewBullet = (text = '') => {
  return text
    .replace(/^[-•\s]+/, '')
    .replace(/^\d+\.\s*/, '')
    .trim();
};

export const stripMarkdownHeadings = (value = '') => {
  return value
    .replace(/###\s*/g, '')
    .replace(/##\s*/g, '')
    .replace(/#\s*/g, '')
    .trim();
};

export const hasLeadingEmoji = (text = '') => {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const emojiRegex = /^(?:[\p{Extended_Pictographic}\u200d\ufe0f]+)/u;
  return emojiRegex.test(trimmed);
};

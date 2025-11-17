import { addDays, format, isValid } from 'date-fns'

const getDateLabel = (startDate, index, language) => {
  if (!startDate) return null

  const base = new Date(startDate)
  if (!isValid(base)) return null

  const computed = addDays(base, index)
  if (!isValid(computed)) return null

  const formatter = language === 'en' ? 'MMM d' : 'dd/MM'
  return format(computed, formatter)
}

export const getDayDisplayName = ({ label, index = 0, language = 'es', startDate }) => {
  const dateLabel = getDateLabel(startDate, index, language)
  const fallback = dateLabel || (language === 'en' ? `Day ${index + 1}` : `Día ${index + 1}`)

  if (typeof label !== 'string') {
    return fallback
  }

  const trimmed = label.trim()
  if (!trimmed) {
    return fallback
  }

  if (dateLabel) {
    return dateLabel
  }

  if (language === 'en') {
    const numberMatch = trimmed.match(/\d+/)
    if (numberMatch) {
      return `Day ${Number(numberMatch[0])}`
    }

    if (/día/i.test(trimmed)) {
      return trimmed.replace(/día/gi, 'Day')
    }

    return trimmed
  }

  return trimmed || fallback
}

export const getDayTag = (index = 0, language = 'es', startDate) => {
  const dateLabel = getDateLabel(startDate, index, language)
  if (dateLabel) return dateLabel

  const prefix = language === 'en' ? 'D' : 'D'
  return `${prefix}${index + 1}`
}

export const sanitizeReviewBullet = (text = '') => {
  return text
    .replace(/^[\-\u2013\u2014•\s]+/, '')
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

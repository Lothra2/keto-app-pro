import React, { useMemo, useState } from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek
} from 'date-fns'

const DatePickerModal = ({
  visible,
  onClose,
  onSelect,
  initialDate,
  theme,
  language = 'es'
}) => {
  const baseDate = initialDate ? new Date(initialDate) : new Date()
  const [monthCursor, setMonthCursor] = useState(startOfMonth(baseDate))

  const dayNames = useMemo(
    () => (language === 'en' ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['L', 'M', 'X', 'J', 'V', 'S', 'D']),
    [language]
  )

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 })

    const days = []
    let cursor = start
    while (cursor <= end) {
      days.push(cursor)
      cursor = new Date(cursor)
      cursor.setDate(cursor.getDate() + 1)
    }
    return days
  }, [monthCursor])

  const handleMonthChange = (delta) => {
    setMonthCursor((prev) => addMonths(prev, delta))
  }

  const handleSelect = (date) => {
    onSelect?.(date)
    onClose?.()
  }

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}> 
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => handleMonthChange(-1)}
              accessibilityLabel={language === 'en' ? 'Previous month' : 'Mes anterior'}
            >
              <Text style={[styles.navText, { color: theme.colors.text }]}>‹</Text>
            </TouchableOpacity>
            <Text style={[styles.monthLabel, { color: theme.colors.text }]}>
              {format(monthCursor, language === 'en' ? 'LLLL yyyy' : 'LLLL yyyy')}
            </Text>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => handleMonthChange(1)}
              accessibilityLabel={language === 'en' ? 'Next month' : 'Mes siguiente'}
            >
              <Text style={[styles.navText, { color: theme.colors.text }]}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {dayNames.map((name, index) => (
              <Text
                key={`${name}-${index}`}
                style={[styles.weekLabel, { color: theme.colors.textMuted }]}
              >
                {name}
              </Text>
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.grid}> 
            {calendarDays.map((day) => {
              const isCurrentMonth = isSameMonth(day, monthCursor)
              const isActive = isSameDay(day, baseDate)
              return (
                <TouchableOpacity
                  key={day.toISOString()}
                  style={[
                    styles.dayCell,
                    isCurrentMonth ? styles.dayCurrentMonth : styles.dayOtherMonth,
                    isActive && {
                      backgroundColor: theme.colors.primarySoft,
                      borderColor: theme.colors.primary
                    }
                  ]}
                  onPress={() => handleSelect(day)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: theme.colors.text },
                      !isCurrentMonth && { color: theme.colors.textMuted },
                      isActive && { color: theme.colors.primary, fontWeight: '700' }
                    ]}
                  >
                    {format(day, 'd')}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={[styles.closeText, { color: theme.colors.text }]}>
              {language === 'en' ? 'Cancel' : 'Cerrar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  navText: {
    fontSize: 20,
    fontWeight: '700'
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '600'
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 4
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: '600'
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  dayCurrentMonth: {
    backgroundColor: 'rgba(148,163,184,0.05)'
  },
  dayOtherMonth: {
    backgroundColor: 'transparent'
  },
  dayText: {
    fontSize: 15
  },
  closeButton: {
    marginTop: 8,
    alignSelf: 'center'
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600'
  }
})

export default DatePickerModal

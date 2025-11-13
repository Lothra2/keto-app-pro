// MultiMetricChart.js
import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native'
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle, Text as SvgText } from 'react-native-svg'

const { width: screenWidth } = Dimensions.get('window')

// ===== helpers =====
const createSmoothPath = (points) => {
  if (!points.length) return ''
  if (points.length === 1) {
    const { x, y } = points[0]
    return `M ${x} ${y}`
  }
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    const midX = (a.x + b.x) / 2
    d += ` C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`
  }
  return d
}

const movingAverage = (arr, k = 7) => {
  const out = []
  const q = []
  let sum = 0
  for (let i = 0; i < arr.length; i += 1) {
    const v = typeof arr[i] === 'number' ? arr[i] : null
    q.push(v)
    if (q.length > k) {
      const first = q.shift()
      if (first !== null) sum -= first
    }
    if (v !== null) sum += v
    const valids = q.filter(n => n !== null)
    out.push(valids.length ? sum / valids.length : null)
  }
  return out
}

// ===== componente =====
const MultiMetricChart = ({
  data = [],                 // [{ date, label, weight, bodyFat, energy }]
  metric = 'weight',         // viene de tu selector externo, puede ser "Peso", "% Grasa", "Energía", etc
  height = 240,
  width = screenWidth - 32,
  theme,
  language = 'es',
  showValueBadges = true,    // muestra solo el último valor
  weightTargetMin = null,
  weightTargetMax = null,
  showWeightMA = true
}) => {
  const padding = 24
  const innerWidth = Math.max(width, data.length > 1 ? data.length * 64 : width)
  const usableWidth = innerWidth - padding * 2
  const usableHeight = height - padding * 2

  const t = {
    card: theme?.colors?.card || '#ffffff',
    bg: theme?.colors?.bg || '#0f172a',
    border: theme?.colors?.border || 'rgba(148,163,184,0.35)',
    text: theme?.colors?.text || '#0f172a',
    textMuted: theme?.colors?.textMuted || '#64748b',
    primary: theme?.colors?.primary || '#0f766e',
    accent: theme?.colors?.accent || '#0ea5e9',
    purple: '#7c3aed',
    blue: '#2563eb',
    green: '#10b981'
  }

  const labels = {
    es: { noData: 'No hay datos aún', helper: 'Registra peso, energía o % de grasa para ver la gráfica', weight: 'Peso', bodyFat: '% Grasa', energy: 'Energía' },
    en: { noData: 'No data yet', helper: 'Track weight, energy or body fat to unlock the chart', weight: 'Weight', bodyFat: 'Body Fat %', energy: 'Energy' }
  }[language === 'en' ? 'en' : 'es']

  // Normaliza lo que venga del selector externo
  const normalizeMetric = (m) => {
    const s = String(m || '').toLowerCase()
    if (s.includes('fat') || s.includes('grasa')) return 'bodyFat'
    if (s.includes('ener')) return 'energy'
    if (s.includes('peso') || s.includes('weight')) return 'weight'
    return 'weight'
  }
  const metricKey = normalizeMetric(metric)

  // configuración por métrica
  const active = useMemo(() => {
    if (metricKey === 'bodyFat') {
      return { key: 'bodyFat', label: labels.bodyFat, color: t.purple, floor: null, ceil: null, yPad: 0.12, fmt: v => `${Number(v).toFixed(1)} %`, area: false }
    }
    if (metricKey === 'energy') {
      return { key: 'energy', label: labels.energy, color: t.blue, floor: 0, ceil: 10, yPad: 0.05, fmt: v => `${Number(v).toFixed(1)}`, area: false }
    }
    return { key: 'weight', label: labels.weight, color: t.green, floor: null, ceil: null, yPad: 0.10, fmt: v => `${Number(v).toFixed(1)} kg`, area: true }
  }, [metricKey, labels, t])

  const xStep = data.length > 1 ? usableWidth / (data.length - 1) : 0

  const series = useMemo(() => {
    const values = data.map(p => {
      const raw = p?.[active.key]
      if (raw === null || raw === undefined || raw === '') return null
      const n = Number(raw)
      return Number.isNaN(n) ? null : n
    })
    const filtered = values.filter(v => v !== null)
    if (!filtered.length) return { values, min: 0, max: 1, latest: null, delta: null }

    let min = active.floor !== null ? active.floor : Math.min(...filtered)
    let max = active.ceil !== null ? active.ceil : Math.max(...filtered)
    if (min === max) { min -= 1; max += 1 }

    const range = max - min
    const pad = range * active.yPad
    if (active.floor === null) min -= pad
    if (active.ceil === null) max += pad
    if (min > max) { const tmp = min; min = max; max = tmp }

    const latestIndex = [...values].reverse().findIndex(v => v !== null)
    const latest = latestIndex === -1 ? null : values[values.length - 1 - latestIndex]
    const prevIndex = [...values].reverse().slice(latestIndex + 1).findIndex(v => v !== null)
    const prev = prevIndex === -1 ? null : values[values.length - 1 - latestIndex - 1 - prevIndex]
    const delta = latest !== null && prev !== null ? latest - prev : null

    return { values, min, max, latest, delta }
  }, [data, active])

  const scaleY = (v) => {
    const n = Number(v)
    const clamped = Math.max(series.min, Math.min(series.max, n))
    const tY = (clamped - series.min) / (series.max - series.min)
    return padding + (1 - tY) * usableHeight
  }

  const points = useMemo(() => {
    return series.values.map((v, i) => {
      if (v === null) return null
      const x = padding + i * xStep
      const y = scaleY(v)
      return { x, y, v, i }
    }).filter(Boolean)
  }, [series, xStep])

  const maPoints = useMemo(() => {
    if (active.key !== 'weight' || !showWeightMA) return []
    const ma = movingAverage(series.values, 7)
    return ma.map((v, i) => {
      if (v === null) return null
      const x = padding + i * xStep
      const y = scaleY(v)
      return { x, y, v, i }
    }).filter(Boolean)
  }, [series, xStep, active, showWeightMA])

  if (!data.length) {
    return (
      <View style={[styles.empty, { borderColor: t.border, backgroundColor: t.card }]}>
        <Text style={[styles.emptyTitle, { color: t.text }]}>{labels.noData}</Text>
        <Text style={[styles.emptySub, { color: t.textMuted }]}>{labels.helper}</Text>
      </View>
    )
  }

  const latestStr = series.latest !== null ? active.fmt(series.latest) : '–'
  const deltaStr = series.delta !== null ? `${series.delta >= 0 ? '+' : ''}${series.delta.toFixed(1)}` : null
  const showTargetBand = active.key === 'weight' && weightTargetMin !== null && weightTargetMax !== null
  const gridY = [0, 0.33, 0.66, 1].map(tick => padding + tick * usableHeight)

  return (
    <View>
      {/* Leyenda compacta, sin botones internos */}
      <View style={styles.legend}>
        <View style={styles.legendLeft}>
          <View style={[styles.dot, { backgroundColor: active.color }]} />
          <Text style={[styles.legendLabel, { color: t.text }]}>{active.label}</Text>
        </View>
        <View style={styles.legendRight}>
          <Text style={[styles.legendValue, { color: t.text }]}>{latestStr}</Text>
          {deltaStr !== null ? (
            <Text style={[styles.legendDelta, { color: series.delta >= 0 ? t.accent : '#ef4444' }]}>{deltaStr}</Text>
          ) : null}
        </View>
      </View>

      {/* Chart diario */}
      <View style={[styles.chartWrapper, { borderColor: t.border, backgroundColor: t.card }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 0 }}>
          <Svg width={innerWidth} height={height}>
            <Defs>
              <LinearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor={t.bg} stopOpacity="0.06" />
                <Stop offset="100%" stopColor={t.bg} stopOpacity="0" />
              </LinearGradient>
              <LinearGradient id="metricFill" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor={active.color} stopOpacity="0.20" />
                <Stop offset="100%" stopColor={active.color} stopOpacity="0" />
              </LinearGradient>
            </Defs>

            <Rect x={0} y={0} width={innerWidth} height={height} fill="url(#bgGrad)" rx={18} ry={18} />

            {/* Grid */}
            {gridY.map((y, idx) => (
              <Path
                key={`grid-${idx}`}
                d={`M ${padding} ${y} H ${innerWidth - padding}`}
                stroke={t.border}
                strokeWidth={0.5}
                strokeDasharray="4 7"
              />
            ))}

            {/* Banda objetivo para peso */}
            {showTargetBand ? (() => {
              const yTop = scaleY(Math.min(weightTargetMin, weightTargetMax))
              const yBot = scaleY(Math.max(weightTargetMin, weightTargetMax))
              const h = Math.max(0, yBot - yTop)
              return (
                <Rect
                  x={padding}
                  y={yTop}
                  width={innerWidth - padding * 2}
                  height={h}
                  fill="rgba(16,185,129,0.16)"
                  rx={10}
                  ry={10}
                />
              )
            })() : null}

            {/* Área solo para peso */}
            {active.area && points.length > 1 ? (() => {
              const areaPath = `${createSmoothPath(points)} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
              return <Path d={areaPath} fill="url(#metricFill)" opacity={0.9} />
            })() : null}

            {/* Línea principal */}
            {points.length > 1 ? (
              <Path
                d={createSmoothPath(points)}
                stroke={active.color}
                strokeWidth={3.5}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}

            {/* Promedio móvil 7d para peso */}
            {active.key === 'weight' && showWeightMA && maPoints.length > 1 ? (
              <Path
                d={createSmoothPath(maPoints)}
                stroke={t.accent}
                strokeWidth={2}
                fill="none"
                strokeDasharray="6 6"
                strokeLinecap="round"
              />
            ) : null}

            {/* Puntos */}
            {points.map((p, idx) => (
              <Circle key={`dot-${idx}`} cx={p.x} cy={p.y} r={4.5} fill={t.card} stroke={active.color} strokeWidth={2.5} />
            ))}

            {/* Solo etiqueta del último punto */}
            {showValueBadges && points.length ? (() => {
              const last = points[points.length - 1]
              const text = active.fmt(last.v)
              const ly = Math.max(padding + 14, last.y - 8)
              return (
                <>
                  <SvgText
                    x={last.x}
                    y={ly}
                    fontSize={12}
                    fontWeight="600"
                    fill={t.text}
                    textAnchor="middle"
                    stroke={t.card}
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    {text}
                  </SvgText>
                  <SvgText x={last.x} y={ly} fontSize={12} fontWeight="600" fill={t.text} textAnchor="middle">
                    {text}
                  </SvgText>
                </>
              )
            })() : null}

            {/* Labels X */}
            {data.map((row, i) => (
              <SvgText
                key={`lbl-${i}-${row.label}`}
                x={padding + i * xStep}
                y={height - padding + 16}
                fontSize={12}
                fill={t.textMuted}
                textAnchor="middle"
              >
                {row.label}
              </SvgText>
            ))}
          </Svg>
        </ScrollView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  chartWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 14
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  legendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: '600'
  },
  legendValue: {
    fontSize: 13,
    fontWeight: '700'
  },
  legendDelta: {
    fontSize: 12,
    fontWeight: '700'
  },
  empty: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18
  }
})

export default MultiMetricChart

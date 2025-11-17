import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Path,
  Circle,
  Text as SvgText
} from 'react-native-svg';

const { width: screenWidth } = Dimensions.get('window');

const createSmoothPath = (points) => {
  if (!points.length) return '';
  if (points.length === 1) {
    const { x, y } = points[0];
    return `M ${x} ${y}`;
  }
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.x + next.x) / 2;
    path += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
  }
  return path;
};

const buildMetricSegments = ({ data, metricKey, scaleY }) => {
  const segments = [];
  let current = [];

  data.forEach((point, index) => {
    const value = point[metricKey];
    if (value === null || value === undefined || Number.isNaN(value)) {
      if (current.length) {
        segments.push(current);
        current = [];
      }
      return;
    }
    const { x, y } = scaleY(value, index);
    current.push({ x, y, value, index });
  });

  if (current.length) {
    segments.push(current);
  }
  return segments;
};

const MultiMetricChart = ({
  data = [],
  metrics = [],
  height = 220,
  width = screenWidth - 48,
  theme,
  language = 'es',
  showValueBadges = false
}) => {
  const padding = 20;
  const innerWidth = Math.max(width, data.length > 1 ? data.length * 56 : width);
  const usableWidth = innerWidth - padding * 2;
  const usableHeight = height - padding * 2;
  const xStep = data.length > 1 ? usableWidth / (data.length - 1) : 0;

  const formatForMetric = (metric, v) => {
    if (v === null || v === undefined) return '';
    if (typeof metric.formatter === 'function') return metric.formatter(Number(v));
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(1) : String(v);
  };

  const labelY = (y) => {
    // Si el punto está muy arriba, empujamos la etiqueta hacia abajo para que no se corte
    const topSafe = padding + 12;
    return y < topSafe ? y + 16 : y - 8;
  };

  const scaledMetrics = useMemo(() => {
    return metrics
      .map((metric) => {
        const values = data
          .map((point) => {
            const value = point[metric.key];
            return value === undefined || value === null || value === '' ? null : Number(value);
          })
          .map((value) => (Number.isNaN(value) ? null : value));

        const filteredValues = values.filter((value) => value !== null);
        if (!filteredValues.length) return null;

        const min = Math.min(...filteredValues);
        const max = Math.max(...filteredValues);
        const range = max - min || 1;
        const chartType = metric.chartType || 'line';

        const scaleY = (value, index) => {
          const safeValue = Number(value);
          const normalized = (safeValue - min) / range;
          const clamped = Math.max(0, Math.min(1, normalized));
          const x = padding + index * xStep;
          const y = padding + (1 - clamped) * usableHeight;
          return { x, y };
        };

        const segments = buildMetricSegments({
          data: data.map((point, index) => ({
            ...point,
            [metric.key]: values[index]
          })),
          metricKey: metric.key,
          scaleY
        });

        const latestIndex = [...values].reverse().findIndex((value) => value !== null);
        const latestValue = latestIndex === -1 ? null : values[values.length - 1 - latestIndex];

        return {
          ...metric,
          chartType,
          values,
          min,
          max,
          segments: chartType === 'bar' ? [] : segments,
          latestValue,
          scaleY
        };
      })
      .filter(Boolean);
  }, [metrics, data, padding, usableHeight, xStep, usableWidth]);

  if (!data.length || !scaledMetrics.length) {
    const emptyTitle = language === 'en' ? 'No data yet' : 'No hay datos aún';
    const emptySubtitle =
      language === 'en'
        ? 'Track your weight, energy or body fat to unlock this chart.'
        : 'Registra peso, energía o % de grasa para activar esta gráfica.';
    return (
      <View style={[styles.emptyState, { backgroundColor: theme?.colors?.bgSoft || '#f3f4f6' }]}>
        <Text style={[styles.emptyTitle, { color: theme?.colors?.textMuted || '#64748b' }]}>{emptyTitle}</Text>
        <Text style={[styles.emptySubtitle, { color: theme?.colors?.textMuted || '#64748b' }]}>
          {emptySubtitle}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View
        style={[
          styles.chartWrapper,
          {
            backgroundColor: theme?.colors?.card || '#fff',
            borderColor: theme?.colors?.border || 'rgba(148, 163, 184, 0.3)'
          }
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 0 }}
        >
          <Svg width={innerWidth} height={height}>
            <Defs>
              <LinearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor={theme?.colors?.bg || '#0f172a'} stopOpacity="0.08" />
                <Stop offset="100%" stopColor={theme?.colors?.bg || '#0f172a'} stopOpacity="0" />
              </LinearGradient>
              {scaledMetrics.map((metric) => (
                <LinearGradient
                  key={`gradient-${metric.key}`}
                  id={`gradient-${metric.key}`}
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <Stop offset="0%" stopColor={metric.color} stopOpacity="0.25" />
                  <Stop offset="100%" stopColor={metric.color} stopOpacity="0" />
                </LinearGradient>
              ))}
            </Defs>

            <Rect
              x={0}
              y={0}
              width={innerWidth}
              height={height}
              fill="url(#bgGradient)"
              rx={18}
              ry={18}
            />

            {Array.from({ length: 4 }).map((_, index) => {
              const y = padding + (usableHeight / 3) * index;
              return (
                <Path
                  key={`grid-${index}`}
                  d={`M ${padding} ${y} H ${innerWidth - padding}`}
                  stroke={theme?.colors?.border || 'rgba(148, 163, 184, 0.35)'}
                  strokeWidth={0.5}
                  strokeDasharray="4 6"
                />
              );
            })}

            {/* Barras */}
            {scaledMetrics
              .filter((metric) => metric.chartType === 'bar')
              .map((metric) => (
                <React.Fragment key={metric.key}>
                  {metric.values.map((value, index) => {
                    if (value === null || value === undefined) return null;
                    const { x, y } = metric.scaleY(value, index);
                    const baseY = height - padding;
                    const barHeight = Math.max(8, baseY - y);
                    const barWidth = Math.max(16, xStep ? Math.min(36, xStep * 0.5) : 28);
                    const centeredX = data.length === 1 ? innerWidth / 2 - barWidth / 2 : x - barWidth / 2;
                    return (
                      <Rect
                        key={`${metric.key}-bar-${index}`}
                        x={centeredX}
                        y={baseY - barHeight}
                        width={barWidth}
                        height={barHeight}
                        fill={metric.color}
                        opacity={0.7}
                        rx={8}
                        ry={8}
                      />
                    );
                  })}

                  {/* Labels sobre barras */}
                  {showValueBadges &&
                    metric.values.map((value, index) => {
                      if (value === null || value === undefined) return null;
                      const { x, y } = metric.scaleY(value, index);
                      const text = formatForMetric(metric, value);
                      const lx = data.length === 1 ? innerWidth / 2 : x;
                      const ly = labelY(y);
                      return (
                        <React.Fragment key={`${metric.key}-bar-label-${index}`}>
                          {/* Trazo para contraste */}
                          <SvgText
                            x={lx}
                            y={ly - 4}
                            fontSize={12}
                            fontWeight="600"
                            fill={theme?.colors?.text || '#0f172a'}
                            textAnchor="middle"
                            stroke={theme?.colors?.card || '#ffffff'}
                            strokeWidth={3}
                            paintOrder="stroke"
                          >
                            {text}
                          </SvgText>
                          <SvgText
                            x={lx}
                            y={ly - 4}
                            fontSize={12}
                            fontWeight="600"
                            fill={theme?.colors?.text || '#0f172a'}
                            textAnchor="middle"
                          >
                            {text}
                          </SvgText>
                        </React.Fragment>
                      );
                    })}
                </React.Fragment>
              ))}

            {/* Líneas + puntos */}
            {scaledMetrics
              .filter((metric) => metric.chartType !== 'bar')
              .map((metric) => (
                <React.Fragment key={metric.key}>
                  {metric.segments.map((segment, idx) => {
                    const path = createSmoothPath(segment);
                    if (!path) return null;
                    return (
                      <Path
                        key={`${metric.key}-segment-${idx}`}
                        d={path}
                        stroke={metric.color}
                        strokeWidth={3}
                        fill="none"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    );
                  })}

                  {metric.segments.map((segment, idx) => {
                    if (!segment.length) return null;
                    const areaPath = `${createSmoothPath(segment)} L ${
                      segment[segment.length - 1].x
                    } ${height - padding} L ${segment[0].x} ${height - padding} Z`;
                    return (
                      <Path
                        key={`${metric.key}-fill-${idx}`}
                        d={areaPath}
                        fill={`url(#gradient-${metric.key})`}
                        opacity={0.22}
                      />
                    );
                  })}

                  {metric.segments.map((segment, idx) => (
                    <React.Fragment key={`${metric.key}-dots-${idx}`}>
                      {segment.map((point, pointIndex) => (
                        <Circle
                          key={`${metric.key}-dot-${idx}-${pointIndex}`}
                          cx={point.x}
                          cy={point.y}
                          r={4.5}
                          fill={theme?.colors?.card || '#fff'}
                          stroke={metric.color}
                          strokeWidth={2.5}
                        />
                      ))}
                    </React.Fragment>
                  ))}

                  {/* Labels sobre puntos */}
                  {showValueBadges &&
                    metric.segments.map((segment, idx) => (
                      <React.Fragment key={`${metric.key}-labels-${idx}`}>
                        {segment.map((point, pointIndex) => {
                          const text = formatForMetric(metric, point.value);
                          const ly = labelY(point.y);
                          return (
                            <React.Fragment key={`${metric.key}-label-${idx}-${pointIndex}`}>
                              {/* Halo para contraste */}
                              <SvgText
                                x={point.x}
                                y={ly - 4}
                                fontSize={12}
                                fontWeight="600"
                                fill={theme?.colors?.text || '#0f172a'}
                                textAnchor="middle"
                                stroke={theme?.colors?.card || '#ffffff'}
                                strokeWidth={3}
                                paintOrder="stroke"
                              >
                                {text}
                              </SvgText>
                              <SvgText
                                x={point.x}
                                y={ly - 4}
                                fontSize={12}
                                fontWeight="600"
                                fill={theme?.colors?.text || '#0f172a'}
                                textAnchor="middle"
                              >
                                {text}
                              </SvgText>
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    ))}
                </React.Fragment>
              ))}

            {/* Labels del eje X */}
            {data.map((point, index) => (
              <SvgText
                key={`label-${point.label}-${index}`}
                x={padding + index * xStep}
                y={height - padding + 16}
                fontSize={12}
                fill={theme?.colors?.textMuted || '#94a3b8'}
                textAnchor="middle"
              >
                {point.label}
              </SvgText>
            ))}
          </Svg>
        </ScrollView>
      </View>

      <View style={styles.legendContainer}>
        {scaledMetrics.map((metric) => (
          <View key={metric.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: metric.color }]} />
            <View>
              <Text style={[styles.legendLabel, { color: theme?.colors?.text || '#0f172a' }]}>
                {metric.label}
              </Text>
              {metric.latestValue !== null && metric.latestValue !== undefined ? (
                <Text style={[styles.legendValue, { color: theme?.colors?.textMuted || '#475569' }]}>
                  {typeof metric.formatter === 'function'
                    ? metric.formatter(metric.latestValue)
                    : Number(metric.latestValue).toFixed(1)}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chartWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 16
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 8
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: '600'
  },
  legendValue: {
    fontSize: 12
  },
  emptyState: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)'
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18
  }
});

export default MultiMetricChart;

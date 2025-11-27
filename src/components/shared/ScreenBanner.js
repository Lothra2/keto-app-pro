import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { withAlpha } from '../../theme/utils';

const ScreenBanner = ({
  theme,
  icon,
  title,
  subtitle,
  description,
  badge,
  badgeTone = 'light',
  rightSlot,
  children,
  footnote,
  gradientColors,
  style
}) => {
  const styles = getStyles(theme);

  const computedGradient =
    gradientColors ||
    theme.colors.primaryGradient ||
    (theme.mode === 'dark'
      ? ['#67e8f9', theme.colors.primary, '#0b1224']
      : ['#67e8f9', theme.colors.primary, '#b7dcff']);

  const toneMap = {
    success: {
      backgroundColor: withAlpha(theme.colors.success, 0.2),
      color: 'rgba(240,253,244,0.95)',
      borderColor: withAlpha(theme.colors.success, 0.45)
    },
    warning: {
      backgroundColor: withAlpha(theme.colors.warning, 0.25),
      color: 'rgba(255,247,237,0.92)',
      borderColor: withAlpha(theme.colors.warning, 0.5)
    },
    info: {
      backgroundColor: withAlpha(theme.colors.info, 0.28),
      color: 'rgba(236,254,255,0.95)',
      borderColor: withAlpha(theme.colors.info, 0.5)
    },
    light: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      color: 'rgba(255,255,255,0.92)',
      borderColor: 'rgba(255,255,255,0.25)'
    },
    muted: {
      backgroundColor: 'rgba(15,23,42,0.2)',
      color: 'rgba(226,232,240,0.95)',
      borderColor: 'rgba(30,41,59,0.4)'
    }
  };

  const badgeStyle = toneMap[badgeTone] || toneMap.light;

  return (
    <LinearGradient
      colors={computedGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, style]}
    >
      <View style={styles.overlay}>
        <View style={styles.headerRow}>
          <View style={styles.titleColumn}>
            {title ? (
              <Text style={styles.title} numberOfLines={2}>
                {icon ? `${icon} ` : ''}
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
            {description ? (
              <Text style={styles.description} numberOfLines={3}>
                {description}
              </Text>
            ) : null}
          </View>

          {badge || rightSlot ? (
            <View style={styles.rightColumn}>
              {badge ? (
                <View style={[styles.badge, badgeStyle]}>
                  <Text style={[styles.badgeText, { color: badgeStyle.color }]} numberOfLines={2}>
                    {badge}
                  </Text>
                </View>
              ) : null}
              {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
            </View>
          ) : null}
        </View>

        {children ? <View style={styles.children}>{children}</View> : null}

        {footnote ? (
          <Text style={styles.footnote} numberOfLines={2}>
            {footnote}
          </Text>
        ) : null}
      </View>
    </LinearGradient>
  );
};

const getStyles = (theme) =>
  StyleSheet.create({
    container: {
      borderRadius: theme.radius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.glassBorder, 0.4),
      shadowColor: theme.colors.glow || theme.colors.primary,
      shadowOpacity: 0.35,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 16 },
      elevation: 10,
    },
    overlay: {
      padding: theme.spacing.xl,
      gap: theme.spacing.md,
      backgroundColor: theme.mode === 'dark' ? 'rgba(4,7,18,0.45)' : 'rgba(255,255,255,0.4)'
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.md
    },
    titleColumn: {
      flex: 1,
      gap: theme.spacing.xs
    },
    title: {
      ...theme.typography.h1,
      color: 'rgba(248,250,252,0.98)',
      fontWeight: '800',
      letterSpacing: -0.3
    },
    subtitle: {
      ...theme.typography.h3,
      color: 'rgba(226,232,240,0.94)',
      letterSpacing: -0.1
    },
    description: {
      ...theme.typography.body,
      color: 'rgba(226,232,240,0.9)',
      lineHeight: 22
    },
    rightColumn: {
      alignItems: 'flex-end',
      gap: theme.spacing.sm
    },
    badge: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 8,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      maxWidth: 180,
      backgroundColor: withAlpha(theme.colors.glassBg, 0.9)
    },
    badgeText: {
      ...theme.typography.caption,
      fontWeight: '600',
      textAlign: 'center'
    },
    rightSlot: {
      alignSelf: 'flex-end'
    },
    children: {
      gap: theme.spacing.md
    },
    footnote: {
      ...theme.typography.caption,
      color: 'rgba(241,245,249,0.86)'
    }
  });

export default ScreenBanner;

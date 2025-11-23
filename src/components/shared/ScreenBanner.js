import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
    (theme.mode === 'dark'
      ? ['#5ad4ff', theme.colors.primary, '#0b1224']
      : ['#5ad4ff', theme.colors.primary, '#b7dcff']);

  const toneMap = {
    success: {
      backgroundColor: 'rgba(34,197,94,0.22)',
      color: 'rgba(240,253,244,0.95)',
      borderColor: 'rgba(34,197,94,0.5)'
    },
    warning: {
      backgroundColor: 'rgba(249,115,22,0.25)',
      color: 'rgba(255,247,237,0.92)',
      borderColor: 'rgba(249,115,22,0.55)'
    },
    info: {
      backgroundColor: 'rgba(14,165,233,0.28)',
      color: 'rgba(236,254,255,0.95)',
      borderColor: 'rgba(14,165,233,0.5)'
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
      overflow: 'hidden'
    },
    overlay: {
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
      backgroundColor: theme.mode === 'dark' ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.32)'
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.md
    },
    titleColumn: {
      flex: 1,
      gap: 4
    },
    title: {
      ...theme.typography.h2,
      color: 'rgba(248,250,252,0.98)',
      fontWeight: '700',
      letterSpacing: -0.2
    },
    subtitle: {
      ...theme.typography.body,
      color: 'rgba(226,232,240,0.88)'
    },
    description: {
      ...theme.typography.caption,
      color: 'rgba(226,232,240,0.76)',
      lineHeight: 18
    },
    rightColumn: {
      alignItems: 'flex-end',
      gap: theme.spacing.sm
    },
    badge: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 6,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      maxWidth: 140
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
      gap: theme.spacing.sm
    },
    footnote: {
      ...theme.typography.caption,
      color: 'rgba(241,245,249,0.8)'
    }
  });

export default ScreenBanner;

import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ActivityIndicator, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';

const Button = ({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
  textStyle
}) => {
  const { theme: themeMode } = useApp();
  const theme = getTheme(themeMode);
  const scale = useRef(new Animated.Value(1)).current;

  const styles = getStyles(theme);
  const variants = {
    primary: styles.primary,
    secondary: styles.secondary,
    ghost: styles.ghost,
    glass: styles.glass,
  };

  const textVariants = {
    primary: styles.primaryText,
    secondary: styles.secondaryText,
    ghost: styles.ghostText,
    glass: styles.glassText,
  };

  const buttonStyle = [styles.base, variants[variant] || styles.primary, disabled && styles.disabled, style];

  const labelStyle = [styles.text, textVariants[variant] || styles.primaryText, textStyle];

  const animateTo = (value) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      friction: 6,
      tension: 140
    }).start();
  };

  return (
    <Animated.View style={[styles.shadow, { transform: [{ scale }] }] }>
      <TouchableOpacity
        style={buttonStyle}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.9}
        onPressIn={() => animateTo(0.97)}
        onPressOut={() => animateTo(1)}
      >
        {variant === 'primary' ? (
          <LinearGradient
            colors={theme.colors.primaryGradient || ['#34d399', theme.colors.primary, '#0ea5e9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientFill}
          />
        ) : null}
        {variant === 'glass' ? <View style={styles.glassFill} /> : null}
        {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? '#fff' : theme.colors.primary}
          />
        ) : (
          <Text style={labelStyle}>{title}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const getStyles = (theme) =>
  StyleSheet.create({
    shadow: {
      shadowColor: theme.colors.glow || theme.colors.primary,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.28,
      shadowRadius: 20,
      elevation: 10,
      borderRadius: theme.radius.full,
    },
    base: {
      borderRadius: theme.radius.full,
      paddingVertical: theme.spacing.md + 2,
      paddingHorizontal: theme.spacing.xl,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      overflow: 'hidden',
      position: 'relative',
    },
    primary: {
      backgroundColor: theme.colors.primary,
    },
    secondary: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.glassBorder,
      shadowOpacity: 0.12
    },
    ghost: {
      backgroundColor: 'transparent'
    },
    glass: {
      backgroundColor: theme.colors.glassBg,
      borderWidth: 1,
      borderColor: theme.colors.glassBorder
    },
    text: {
      ...theme.typography.body,
      fontWeight: '600'
    },
    primaryText: {
      color: '#fff'
    },
    secondaryText: {
      color: theme.colors.text
    },
    ghostText: {
      color: theme.colors.text
    },
    glassText: {
      color: theme.colors.text
    },
    iconContainer: {
      marginRight: theme.spacing.xs
    },
    disabled: {
      opacity: 0.65
    },
    gradientFill: {
      ...StyleSheet.absoluteFillObject,
      opacity: theme.mode === 'dark' ? 0.95 : 1
    },
    glassFill: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'
    }
  });

export default Button;

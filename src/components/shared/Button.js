import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ActivityIndicator } from 'react-native';
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

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.88}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={['#34d399', theme.colors.primary, '#0ea5e9']}
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
  );
};

const getStyles = (theme) =>
  StyleSheet.create({
    base: {
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      overflow: 'hidden',
      position: 'relative',
      shadowColor: '#0ea5e9',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.18,
      shadowRadius: 20,
      elevation: 6
    },
    primary: {
      backgroundColor: theme.colors.primary
    },
    secondary: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowOpacity: 0.08
    },
    ghost: {
      backgroundColor: 'transparent'
    },
    glass: {
      backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
      borderWidth: 1,
      borderColor: theme.colors.border
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

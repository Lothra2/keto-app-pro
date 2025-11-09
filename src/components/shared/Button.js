import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ActivityIndicator } from 'react-native';
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
    ghost: styles.ghost
  };

  const textVariants = {
    primary: styles.primaryText,
    secondary: styles.secondaryText,
    ghost: styles.ghostText
  };

  const buttonStyle = [
    styles.base,
    variants[variant] || styles.primary,
    disabled && styles.disabled,
    style
  ];

  const labelStyle = [
    styles.text,
    textVariants[variant] || styles.primaryText,
    textStyle
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
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
      gap: theme.spacing.xs
    },
    primary: {
      backgroundColor: theme.colors.primary
    },
    secondary: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    ghost: {
      backgroundColor: 'transparent'
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
    iconContainer: {
      marginRight: theme.spacing.xs
    },
    disabled: {
      opacity: 0.6
    }
  });

export default Button;

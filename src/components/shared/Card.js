import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';

const Card = ({ children, style, outlined = false }) => {
  const { theme: themeMode } = useApp();
  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  return (
    <View
      style={[
        styles.base,
        outlined ? styles.outlined : styles.filled,
        style
      ]}
    >
      {children}
    </View>
  );
};

const getStyles = (theme) =>
  StyleSheet.create({
    base: {
      borderRadius: theme.radius.md,
      padding: theme.spacing.md
    },
    filled: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    outlined: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.border
    }
  });

export default Card;

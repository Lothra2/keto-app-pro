import React from 'react';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';

const LoadingSpinner = ({ label, color }) => {
  const { theme: themeMode } = useApp();
  const theme = getTheme(themeMode);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={color || theme.colors.primary} />
      {label ? <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  label: {
    fontSize: 14,
    fontWeight: '500'
  }
});

export default LoadingSpinner;

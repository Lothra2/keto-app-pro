import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';

const WelcomeScreen = ({ navigation }) => {
  const { user, theme: themeMode, language, isOnboarded } = useApp();
  const theme = getTheme(themeMode);

  useEffect(() => {
    const target = isOnboarded ? 'Main' : 'Onboarding';
    const timer = setTimeout(() => {
      navigation.replace(target);
    }, 1200);

    if (isOnboarded && user.name) {
      clearTimeout(timer);
      navigation.replace('Main');
    }

    return () => clearTimeout(timer);
  }, [isOnboarded, user.name, navigation]);

  return (
    <View style={[styles.welcomeContainer, { backgroundColor: theme.colors.bg }]}>
      <Text style={styles.welcomeEmoji}>🥑</Text>
      <Text style={[styles.welcomeTitle, { color: theme.colors.text }]}>Keto Pro App</Text>
      <Text style={[styles.welcomeSubtitle, { color: theme.colors.textMuted }]}>
        {language === 'en' ? 'Your personalized keto plan' : 'Tu plan keto personalizado'}
      </Text>
      <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 20 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  welcomeEmoji: {
    fontSize: 80,
    marginBottom: 20
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5
  },
  welcomeSubtitle: {
    fontSize: 16,
    textAlign: 'center'
  }
});

export default WelcomeScreen;

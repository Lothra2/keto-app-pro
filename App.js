import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/context/AppContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { getTheme } from './src/theme';
import MainNavigator from './src/navigation/AppNavigator';
import WelcomeScreen from './src/screens/auth/WelcomeScreen';
import OnboardingScreen from './src/screens/auth/OnboardingScreen';
import LoadingSpinner from './src/components/shared/LoadingSpinner';

const Stack = createStackNavigator();

// Navegación raíz
const RootNavigator = () => {
  const { loading, theme: themeMode, language } = useApp();
  const theme = getTheme(themeMode);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.bg }]}>
        <View style={[styles.loadingCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.loadingTitle, { color: theme.colors.text }]}>
            {language === 'en' ? 'Syncing your plan…' : 'Sincronizando tu plan…'}
          </Text>
          <Text style={[styles.loadingSubtitle, { color: theme.colors.textMuted }]}>
            {language === 'en'
              ? 'Loading your data and preferences to start fresh.'
              : 'Cargando tus datos y preferencias para comenzar sin ruido.'}
          </Text>
          <LoadingSpinner color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.bg }]}
      edges={['top', 'left', 'right']}
    >
      <NavigationContainer>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Main" component={MainNavigator} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaView>
  );
};

// App principal
export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppProvider>
          <RootNavigator />
        </AppProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingCard: {
    width: '82%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center'
  },
  loadingSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 6
  }
});
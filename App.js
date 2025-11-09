import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { AppProvider, useApp } from './src/context/AppContext';
import { getTheme } from './src/theme';
import MainNavigator from './src/navigation/AppNavigator';

const Stack = createStackNavigator();

// Pantalla de bienvenida
const WelcomeScreen = ({ navigation }) => {
  const { user, theme: themeMode, language } = useApp();
  const theme = getTheme(themeMode);

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Main');
    }, 2000);

    if (user.name) {
      clearTimeout(timer);
      navigation.replace('Main');
    }

    return () => clearTimeout(timer);
  }, [user.name, navigation]);

  return (
    <View style={[styles.welcomeContainer, { backgroundColor: theme.colors.bg }]}>
      <Text style={styles.welcomeEmoji}>🥑</Text>
      <Text style={[styles.welcomeTitle, { color: theme.colors.text }]}>
        Keto Pro App
      </Text>
      <Text style={[styles.welcomeSubtitle, { color: theme.colors.textMuted }]}>
        {language === 'en' ? 'Your personalized keto plan' : 'Tu plan keto personalizado'}
      </Text>
      <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 20 }} />
    </View>
  );
};

// Navegación raíz
const RootNavigator = () => {
  const { loading, theme: themeMode } = useApp();
  const theme = getTheme(themeMode);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.bg }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Main" component={MainNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// App principal
export default function App() {
  return (
    <AppProvider>
      <RootNavigator />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
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
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/context/AppContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { getTheme } from './src/theme';
import MainNavigator from './src/navigation/AppNavigator';
import WelcomeScreen from './src/screens/auth/WelcomeScreen';
import LoadingSpinner from './src/components/shared/LoadingSpinner';

const Stack = createStackNavigator();

// Navegación raíz
const RootNavigator = () => {
  const { loading, theme: themeMode } = useApp();
  const theme = getTheme(themeMode);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.bg }]}>
        <LoadingSpinner color={theme.colors.primary} />
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
  }
});
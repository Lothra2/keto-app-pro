import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';
import { getTheme } from '../theme';

// Screens
import HomeScreen from '../screens/main/HomeScreen';
import ShoppingScreen from '../screens/main/ShoppingScreen';
import ProgressScreen from '../screens/main/ProgressScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import WorkoutScreen from '../screens/main/WorkoutScreen';

const Tab = createBottomTabNavigator();

// Iconos simples con emojis
const TabIcon = ({ emoji, focused, label }) => {
  const { theme: themeMode } = useApp();
  const theme = getTheme(themeMode);

  return (
    <View style={styles.iconContainer}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[
        styles.label,
        { color: focused ? theme.colors.primary : theme.colors.textMuted }
      ]}>
        {label}
      </Text>
    </View>
  );
};

const TabNavigator = () => {
  const { theme: themeMode, language } = useApp();
  const theme = getTheme(themeMode);

  const labels = {
    menu: language === 'en' ? 'Menu' : 'Menú',
    shopping: language === 'en' ? 'Shopping' : 'Compras',
    workout: language === 'en' ? 'Workouts' : 'Entrenos',
    progress: language === 'en' ? 'Progress' : 'Progreso',
    settings: language === 'en' ? 'Settings' : 'Ajustes'
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          height: 70,
          paddingBottom: 10,
          paddingTop: 5
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarShowLabel: false
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🍽" focused={focused} label={labels.menu} />
          )
        }}
      />

      <Tab.Screen
        name="Shopping"
        component={ShoppingScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🛒" focused={focused} label={labels.shopping} />
          )
        }}
      />

      <Tab.Screen
        name="Workouts"
        component={WorkoutScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏋️" focused={focused} label={labels.workout} />
          )
        }}
      />

      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📈" focused={focused} label={labels.progress} />
          )
        }}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="⚙️" focused={focused} label={labels.settings} />
          )
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2
  },
  emoji: {
    fontSize: 22,
    marginBottom: 2
  },
  label: {
    fontSize: 10,
    fontWeight: '500'
  }
});

export default TabNavigator;
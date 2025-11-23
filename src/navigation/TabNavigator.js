import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../context/AppContext';
import { getTheme } from '../theme';

// Screens
import HomeScreen from '../screens/main/HomeScreen';
import ShoppingScreen from '../screens/main/ShoppingScreen';
import ProgressScreen from '../screens/main/ProgressScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import WorkoutScreen from '../screens/main/WorkoutScreen';
import ConsultorScreen from '../screens/main/ConsultorScreen'; // 👈 nuevo

const Tab = createBottomTabNavigator();

// Iconos simples con emojis
const TabIcon = ({ emoji, focused }) => {
  const { theme: themeMode } = useApp();
  const theme = getTheme(themeMode);

  return (
    <View
      style={[
        styles.iconContainer,
        {
          backgroundColor: focused
            ? theme.mode === 'dark'
              ? `${theme.colors.accent}24`
              : `${theme.colors.primary}14`
            : 'transparent',
          borderColor: focused ? theme.colors.accent || theme.colors.primary : 'transparent',
        },
      ]}
    >
      <LinearGradient
        colors={
          focused
            ? [
                `${theme.colors.accent}d9`,
                theme.colors.primary,
              ]
            : ['transparent', 'transparent']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconGlow}
      />
      <Text style={styles.emoji}>{emoji}</Text>
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
    settings: language === 'en' ? 'Settings' : 'Ajustes',
    consultor: language === 'en' ? 'Coach' : 'Consultor',
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 10,
          height: 68,
          paddingBottom: 10,
          paddingTop: 10,
          borderTopWidth: 0,
          borderRadius: 22,
          overflow: 'hidden',
          backgroundColor: theme.mode === 'dark' ? 'rgba(10,16,30,0.82)' : 'rgba(255,255,255,0.9)',
          shadowColor: theme.colors.accent || theme.colors.primary,
          shadowOpacity: 0.22,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          elevation: 12,
        },
        tabBarActiveTintColor: theme.colors.accent || theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarShowLabel: false,
        tabBarBackground: () => (
          <BlurView
            tint={theme.mode === 'dark' ? 'dark' : 'light'}
            intensity={65}
            style={StyleSheet.absoluteFill}
          >
            <LinearGradient
              colors={
                theme.mode === 'dark'
                  ? [`${theme.colors.accent}0f`, 'rgba(11,17,32,0.6)']
                  : [`${theme.colors.primary}14`, 'rgba(255,255,255,0.5)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </BlurView>
        ),
        tabBarItemStyle: { paddingVertical: 6 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🍽" focused={focused} />,
          tabBarAccessibilityLabel: labels.menu,
        }}
      />

      <Tab.Screen
        name="Shopping"
        component={ShoppingScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🛒" focused={focused} />,
          tabBarAccessibilityLabel: labels.shopping,
        }}
      />

      <Tab.Screen
        name="Workouts"
        component={WorkoutScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏋️" focused={focused} />,
          tabBarAccessibilityLabel: labels.workout,
        }}
      />

      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📈" focused={focused} />,
          tabBarAccessibilityLabel: labels.progress,
        }}
      />

      {/* Coach tab */}
      <Tab.Screen
        name="Consultor"
        component={ConsultorScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🤖" focused={focused} />,
          tabBarAccessibilityLabel: labels.consultor,
        }}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} />,
          tabBarAccessibilityLabel: labels.settings,
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    minWidth: 52,
  },
  iconGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.8,
  },
  emoji: {
    fontSize: 22,
  },
});

export default TabNavigator;

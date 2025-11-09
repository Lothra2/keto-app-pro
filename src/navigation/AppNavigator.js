import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import TabNavigator from './TabNavigator';
import WorkoutScreen from '../screens/main/WorkoutScreen';
import MealGeneratorModal from '../screens/modals/MealGeneratorModal';
import WorkoutModal from '../screens/modals/WorkoutModal';

const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="Workout" component={WorkoutScreen} />
      <Stack.Screen
        name="MealGenerator"
        component={MealGeneratorModal}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="WorkoutModal"
        component={WorkoutModal}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
};

export default AppNavigator;

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import TabNavigator from './TabNavigator';
import MealGeneratorModal from '../screens/modals/MealGeneratorModal';
import WorkoutModal from '../screens/modals/WorkoutModal';
import HelpScreen from '../screens/main/HelpScreen';
import ManualMealModal from '../screens/modals/ManualMealModal';

const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen
        name="MealGenerator"
        component={MealGeneratorModal}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="ManualMeal"
        component={ManualMealModal}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="WorkoutModal"
        component={WorkoutModal}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="Help" component={HelpScreen} />
    </Stack.Navigator>
  );
};

export default AppNavigator;

import React from 'react';
import { View } from 'react-native';
import MealCard from './MealCard';

const MealList = ({ meals = [], style }) => {
  return (
    <View style={style}>
      {meals.map((meal) => (
        <MealCard
          key={meal.key}
          title={meal.title}
          icon={meal.icon}
          mealData={meal.data}
          isCompleted={meal.isCompleted}
          onToggleComplete={meal.onToggle}
          onGenerateAI={meal.onGenerateAI}
          showAIButton={meal.showAIButton}
        />
      ))}
    </View>
  );
};

export default MealList;

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import Button from '../../components/shared/Button';
import Card from '../../components/shared/Card';
import { parseDateInput } from '../../utils/validation';

const OnboardingScreen = ({ navigation }) => {
  const {
    theme: themeMode,
    language,
    updateUser,
    updateSettings,
    updateMetrics,
    metrics,
    gender,
    completeOnboarding,
    planWeeks
  } = useApp();

  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  const [name, setName] = useState('');
  const [selectedGender, setSelectedGender] = useState(gender || 'male');
  const [height, setHeight] = useState(metrics.height ? String(metrics.height) : '');
  const [weight, setWeight] = useState(metrics.startWeight ? String(metrics.startWeight) : '');
  const [age, setAge] = useState(metrics.age ? String(metrics.age) : '');
  const [waterGoal, setWaterGoal] = useState(metrics.waterGoal ? String(metrics.waterGoal) : '2400');
  const [selectedWeeks, setSelectedWeeks] = useState(planWeeks || 2);
  const [startDateInput, setStartDateInput] = useState(() => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}/${month}/${year}`;
  });
  const [saving, setSaving] = useState(false);

  const tips = useMemo(() => {
    if (language === 'en') {
      return [
        'These values help us calculate calories and body fat.',
        'You can change them later in Settings.',
        'Tap continue when everything looks good.'
      ];
    }

    return [
      'Estos datos nos ayudan a calcular calorías y % de grasa.',
      'Podrás cambiarlos después en Ajustes.',
      'Toca continuar cuando todo esté listo.'
    ];
  }, [language]);

  const handleSelectGender = async (value) => {
    setSelectedGender(value);
    await updateSettings('gender', value);
  };

  const handleSelectWeeks = async (value) => {
    setSelectedWeeks(value);
    await updateSettings('plan-weeks', value);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !height.trim() || !weight.trim() || !age.trim()) {
      Alert.alert(
        language === 'en' ? 'Missing data' : 'Faltan datos',
        language === 'en'
          ? 'Please complete your name, height, weight and age to continue.'
          : 'Completa nombre, estatura, peso y edad para continuar.'
      );
      return;
    }

    setSaving(true);
    try {
      const parsedStartDate = parseDateInput(startDateInput) || new Date().toISOString();
      await updateUser({ name: name.trim(), startDate: parsedStartDate });
      await updateMetrics({
        height: height.trim(),
        startWeight: weight.trim(),
        age: age.trim(),
        waterGoal: waterGoal.trim() || '2400'
      });
      await updateSettings('plan-weeks', selectedWeeks);
      completeOnboarding();
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error) {
      console.error('Onboarding error:', error);
      Alert.alert(
        language === 'en' ? 'Unexpected error' : 'Error inesperado',
        language === 'en'
          ? 'We could not save your data. Try again.'
          : 'No pudimos guardar tus datos. Inténtalo de nuevo.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.bg }]} contentContainerStyle={styles.content}>
      <Text style={styles.emoji}>🥑</Text>
      <Text style={styles.title}>
        {language === 'en' ? 'Personalize your plan' : 'Personaliza tu plan'}
      </Text>
      <Text style={styles.subtitle}>
        {language === 'en'
          ? 'We use these basics to tailor your meals and workouts.'
          : 'Usamos estos datos para ajustar tus comidas y entrenos.'}
      </Text>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>{language === 'en' ? 'About you' : 'Sobre ti'}</Text>
        <TextInput
          style={styles.input}
          placeholder={language === 'en' ? 'Your name' : 'Tu nombre'}
          placeholderTextColor={theme.colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <View style={styles.genderRow}>
          <TouchableOpacity
            style={[styles.genderButton, selectedGender === 'male' && styles.genderButtonActive]}
            onPress={() => handleSelectGender('male')}
          >
            <Text
              style={[styles.genderText, selectedGender === 'male' && styles.genderTextActive]}
            >
              {language === 'en' ? 'Male' : 'Hombre'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.genderButton, selectedGender === 'female' && styles.genderButtonActive]}
            onPress={() => handleSelectGender('female')}
          >
            <Text
              style={[styles.genderText, selectedGender === 'female' && styles.genderTextActive]}
            >
              {language === 'en' ? 'Female' : 'Mujer'}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Plan duration' : 'Duración del plan'}
        </Text>
        <Text style={styles.sectionDescription}>
          {language === 'en'
            ? 'Choose how many weeks you want to follow this guide.'
            : 'Elige cuántas semanas quieres seguir esta guía.'}
        </Text>
        <View style={styles.weeksRow}>
          {[2, 3, 4].map((weeksOption) => {
            const active = selectedWeeks === weeksOption;
            return (
              <TouchableOpacity
                key={weeksOption}
                style={[styles.weekOption, active && styles.weekOptionActive]}
                onPress={() => handleSelectWeeks(weeksOption)}
              >
                <Text style={[styles.weekOptionLabel, active && styles.weekOptionLabelActive]}>
                  {weeksOption} {language === 'en' ? 'weeks' : 'semanas'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.weeksHint}>
          {language === 'en'
            ? 'You can adjust this anytime from Settings.'
            : 'Podrás ajustarlo cuando quieras desde Ajustes.'}
        </Text>

        <Text style={styles.label}>
          {language === 'en' ? 'Plan start date (dd/mm)' : 'Fecha de inicio (dd/mm)'}
        </Text>
        <TextInput
          style={styles.input}
          value={startDateInput}
          onChangeText={setStartDateInput}
          placeholder={language === 'en' ? '12/03/2025' : '12/03/2025'}
          placeholderTextColor={theme.colors.textMuted}
        />
        <Text style={styles.weeksHint}>
          {language === 'en'
            ? 'We will replace Day 1 with this date across the app.'
            : 'Usaremos esta fecha en lugar de "Día 1" en toda la app.'}
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>{language === 'en' ? 'Key metrics' : 'Métricas clave'}</Text>
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>{language === 'en' ? 'Height (cm)' : 'Estatura (cm)'}</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={height}
              onChangeText={setHeight}
              placeholder="170"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>{language === 'en' ? 'Weight (kg)' : 'Peso (kg)'}</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={weight}
              onChangeText={setWeight}
              placeholder="70"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>{language === 'en' ? 'Age' : 'Edad'}</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={age}
              onChangeText={setAge}
              placeholder="30"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>{language === 'en' ? 'Water goal (ml)' : 'Meta de agua (ml)'}</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={waterGoal}
              onChangeText={setWaterGoal}
              placeholder="2400"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>{language === 'en' ? 'Tips' : 'Tips'}</Text>
        {tips.map((tip, index) => (
          <View key={tip} style={styles.tipRow}>
            <Text style={styles.tipBullet}>•</Text>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </Card>

      <Button
        title={language === 'en' ? 'Continue' : 'Continuar'}
        onPress={handleSubmit}
        loading={saving}
        style={styles.continueButton}
      />
    </ScrollView>
  );
};

const getStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1
    },
    content: {
      padding: theme.spacing.lg,
      paddingBottom: 120,
      alignItems: 'stretch',
      gap: theme.spacing.lg
    },
    emoji: {
      fontSize: 64,
      textAlign: 'center'
    },
    title: {
      ...theme.typography.h1,
      textAlign: 'center',
      color: theme.colors.text
    },
    subtitle: {
      ...theme.typography.body,
      textAlign: 'center',
      color: theme.colors.textMuted,
      marginTop: -8
    },
    card: {
      gap: theme.spacing.md
    },
    sectionTitle: {
      ...theme.typography.h3,
      color: theme.colors.text
    },
    sectionDescription: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted
    },
    input: {
      ...theme.typography.body,
      backgroundColor: theme.colors.cardSoft,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    row: {
      flexDirection: 'row',
      gap: theme.spacing.md
    },
    field: {
      flex: 1,
      gap: theme.spacing.xs
    },
    label: {
      ...theme.typography.caption,
      color: theme.colors.textMuted
    },
    genderRow: {
      flexDirection: 'row',
      gap: theme.spacing.md
    },
    genderButton: {
      flex: 1,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center'
    },
    genderButtonActive: {
      backgroundColor: theme.colors.primarySoft,
      borderColor: theme.colors.primary
    },
    genderText: {
      ...theme.typography.body,
      color: theme.colors.text
    },
    genderTextActive: {
      color: theme.colors.primary,
      fontWeight: '600'
    },
    tipRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm
    },
    tipBullet: {
      color: theme.colors.primary,
      fontSize: 16,
      lineHeight: 20
    },
    tipText: {
      ...theme.typography.bodySmall,
      color: theme.colors.text
    },
    weeksRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm
    },
    weekOption: {
      flex: 1,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.cardSoft,
      paddingVertical: theme.spacing.md,
      alignItems: 'center'
    },
    weekOptionActive: {
      backgroundColor: theme.colors.primary,
      borderColor: 'rgba(15,118,110,0.6)'
    },
    weekOptionLabel: {
      ...theme.typography.body,
      color: theme.colors.text
    },
    weekOptionLabelActive: {
      color: '#f8fafc',
      fontWeight: '600'
    },
    weeksHint: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      textAlign: 'center'
    },
    continueButton: {
      marginTop: theme.spacing.md
    }
  });

export default OnboardingScreen;

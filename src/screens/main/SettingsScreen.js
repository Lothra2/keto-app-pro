import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert
} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import ScreenBanner from '../../components/shared/ScreenBanner';
import DatePickerModal from '../../components/shared/DatePickerModal';
import { format } from 'date-fns';

const SettingsScreen = ({ navigation }) => {
  const {
    theme: themeMode,
    language,
    user,
    gender,
    planWeeks,
    updateUser,
    updateSettings,
    updateFoodPrefs,
    updateApiCredentials,
    resetApp,
    foodPrefs,
    apiCredentials,
    updateMetrics,
    metrics
  } = useApp();

  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  // Estados locales
  const [name, setName] = useState(user.name || '');
  const [likeFoods, setLikeFoods] = useState(foodPrefs.like || '');
  const [dislikeFoods, setDislikeFoods] = useState(foodPrefs.dislike || '');
  const [apiUser, setApiUser] = useState(apiCredentials.user || '');
  const [apiPass, setApiPass] = useState(apiCredentials.pass || '');
  const [waterGoal, setWaterGoal] = useState(
    metrics?.waterGoal ? String(metrics.waterGoal) : '2400'
  );
  const [planStartDate, setPlanStartDate] = useState(
    user?.startDate ? new Date(user.startDate) : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    setName(user.name || '');
  }, [user?.name]);

  useEffect(() => {
    setPlanStartDate(user?.startDate ? new Date(user.startDate) : new Date());
  }, [user?.startDate]);

  useEffect(() => {
    setLikeFoods(foodPrefs.like || '');
    setDislikeFoods(foodPrefs.dislike || '');
  }, [foodPrefs.like, foodPrefs.dislike]);

  useEffect(() => {
    setApiUser(apiCredentials.user || '');
    setApiPass(apiCredentials.pass || '');
  }, [apiCredentials.user, apiCredentials.pass]);

  useEffect(() => {
    setWaterGoal(metrics?.waterGoal ? String(metrics.waterGoal) : '2400');
  }, [metrics?.waterGoal]);

  const formattedStartDate = useMemo(
    () => format(planStartDate, language === 'en' ? 'MMM d, yyyy' : 'dd/MM/yyyy'),
    [planStartDate, language]
  );

  const handleSaveName = async () => {
    if (name.trim()) {
      await updateUser({ name: name.trim() });
      Alert.alert(
        language === 'en' ? 'Saved' : 'Guardado',
        language === 'en' ? 'Name updated successfully' : 'Nombre actualizado correctamente'
      );
    }
  };

  const handleChangeLanguage = async (lang) => {
    await updateSettings('lang', lang);
  };

  const handleChangeGender = async (gen) => {
    await updateSettings('gender', gen);
  };

  const handleChangePlanWeeks = async (weeks) => {
    await updateSettings('plan-weeks', weeks);
  };

  const handleChangeTheme = async (newTheme) => {
    await updateSettings('theme', newTheme);
  };

  const handleSaveFoodPrefs = async () => {
    await updateFoodPrefs(likeFoods, dislikeFoods);
    Alert.alert(
      language === 'en' ? 'Saved' : 'Guardado',
      language === 'en' ? 'Food preferences saved' : 'Preferencias guardadas'
    );
  };

  const handleSaveApiCredentials = async () => {
    await updateApiCredentials(apiUser, apiPass);
    Alert.alert(
      language === 'en' ? 'Saved' : 'Guardado',
      language === 'en' ? 'API credentials saved' : 'Credenciales guardadas'
    );
  };

  const handleSaveWaterGoal = async () => {
    const numericGoal = Number(waterGoal);
    if (!Number.isFinite(numericGoal) || numericGoal <= 0) {
      Alert.alert(
        language === 'en' ? 'Check the value' : 'Revisa el valor',
        language === 'en'
          ? 'Enter your daily goal in milliliters, e.g. 2000.'
          : 'Ingresa tu meta diaria en mililitros, por ejemplo 2000.'
      );
      return;
    }

    const normalizedGoal = Math.max(500, Math.round(numericGoal));
    await updateMetrics({ waterGoal: normalizedGoal });
    setWaterGoal(String(normalizedGoal));

    Alert.alert(
      language === 'en' ? 'Saved' : 'Guardado',
      language === 'en'
        ? 'Hydration goal updated across your plan.'
        : 'Meta de hidratación actualizada en todo tu plan.'
    );
  };

  const handleChangeStartDate = async (date) => {
    const normalized = date ? new Date(date).toISOString() : new Date().toISOString();
    setPlanStartDate(date || new Date());
    await updateUser({ startDate: normalized });
    Alert.alert(
      language === 'en' ? 'Saved' : 'Guardado',
      language === 'en'
        ? 'Plan start date updated. Day labels now use this date.'
        : 'Fecha de inicio actualizada. Los días usarán esta fecha.'
    );
  };

  const handleResetApp = () => {
    Alert.alert(
      language === 'en' ? 'Reset App' : 'Reiniciar App',
      language === 'en' 
        ? 'This will delete all your data. Are you sure?'
        : 'Esto borrará todos tus datos. ¿Estás seguro?',
      [
        {
          text: language === 'en' ? 'Cancel' : 'Cancelar',
          style: 'cancel'
        },
        {
          text: language === 'en' ? 'Reset' : 'Reiniciar',
          style: 'destructive',
          onPress: async () => {
            await resetApp();
            setName('');
            setLikeFoods('');
            setDislikeFoods('');
            setApiUser('');
            setApiPass('');

            Alert.alert(
              language === 'en' ? 'Done' : 'Listo',
              language === 'en' ? 'App reset successfully' : 'App reiniciada correctamente'
            );

            const stackNavigator = navigation.getParent();
            const rootNavigation = stackNavigator?.getParent?.() ?? stackNavigator;

            rootNavigation?.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Welcome' }]
              })
            );
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenBanner
        theme={theme}
        icon="⚙️"
        title={language === 'en' ? 'Settings' : 'Ajustes'}
        subtitle={
          language === 'en'
            ? 'Customize your plan, AI access and preferences.'
            : 'Personaliza tu plan, acceso IA y preferencias.'
        }
        description={
          language === 'en'
            ? `Language: ${language === 'en' ? 'English' : 'Español'} · Theme: ${
                themeMode === 'dark' ? 'Dark' : 'Light'
              }`
            : `Idioma: ${language === 'en' ? 'English' : 'Español'} · Tema: ${
                themeMode === 'dark' ? 'Oscuro' : 'Claro'
              }`
        }
        badge={
          user?.name
            ? `${language === 'en' ? 'User' : 'Usuario'}: ${user.name}`
            : language === 'en'
            ? 'Add your name'
            : 'Agrega tu nombre'
        }
        badgeTone={user?.name ? 'success' : 'warning'}
        footnote={
          language === 'en'
            ? 'Changes are saved automatically.'
            : 'Los cambios se guardan automáticamente.'
        }
        style={styles.banner}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Need some guidance?' : '¿Necesitas ayuda?'}
        </Text>
        <Text style={styles.sectionDescription}>
          {language === 'en'
            ? 'Read the quick guide to understand meals, progress and AI tools.'
            : 'Consulta la guía rápida para entender comidas, progreso y herramientas IA.'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Help')}>
          <Text style={styles.buttonText}>
            {language === 'en' ? 'Open help guide' : 'Abrir guía de ayuda'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Name */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Name' : 'Nombre'}
        </Text>
        <Text style={styles.sectionDescription}>
          {language === 'en' 
            ? 'This will be shown in the header and messages.'
            : 'Se mostrará arriba y en algunos mensajes.'}
        </Text>
        <TextInput
          style={styles.input}
          placeholder={language === 'en' ? 'Your name' : 'Tu nombre'}
          placeholderTextColor={theme.colors.textMuted}
          value={name}
          onChangeText={setName}
        />
        <TouchableOpacity style={styles.button} onPress={handleSaveName}>
          <Text style={styles.buttonText}>
            {language === 'en' ? 'Save Name' : 'Guardar Nombre'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Language / Idioma' : 'Idioma / Language'}
        </Text>
        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={[styles.option, language === 'es' && styles.optionActive]}
            onPress={() => handleChangeLanguage('es')}
          >
            <Text style={[styles.optionText, language === 'es' && styles.optionTextActive]}>
              Español
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.option, language === 'en' && styles.optionActive]}
            onPress={() => handleChangeLanguage('en')}
          >
            <Text style={[styles.optionText, language === 'en' && styles.optionTextActive]}>
              English
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Gender */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Gender' : 'Género'}
        </Text>
        <Text style={styles.sectionDescription}>
          {language === 'en' 
            ? 'Used to adjust calories and estimate body fat.'
            : 'Lo usamos para ajustar calorías y estimar % de grasa.'}
        </Text>
        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={[styles.option, gender === 'male' && styles.optionActive]}
            onPress={() => handleChangeGender('male')}
          >
            <Text style={[styles.optionText, gender === 'male' && styles.optionTextActive]}>
              {language === 'en' ? 'Male' : 'Hombre'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.option, gender === 'female' && styles.optionActive]}
            onPress={() => handleChangeGender('female')}
          >
            <Text style={[styles.optionText, gender === 'female' && styles.optionTextActive]}>
              {language === 'en' ? 'Female' : 'Mujer'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Plan Duration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Plan Duration' : 'Duración del Plan'}
        </Text>
        <Text style={styles.sectionDescription}>
          {language === 'en' 
            ? 'Choose between 2 and 4 weeks.'
            : 'Elige entre 2 y 4 semanas.'}
        </Text>
        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={[styles.option, planWeeks === 2 && styles.optionActive]}
            onPress={() => handleChangePlanWeeks(2)}
          >
            <Text style={[styles.optionText, planWeeks === 2 && styles.optionTextActive]}>
              2 {language === 'en' ? 'weeks' : 'semanas'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.option, planWeeks === 3 && styles.optionActive]}
            onPress={() => handleChangePlanWeeks(3)}
          >
            <Text style={[styles.optionText, planWeeks === 3 && styles.optionTextActive]}>
              3 {language === 'en' ? 'weeks' : 'semanas'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.option, planWeeks === 4 && styles.optionActive]}
            onPress={() => handleChangePlanWeeks(4)}
          >
            <Text style={[styles.optionText, planWeeks === 4 && styles.optionTextActive]}>
              4 {language === 'en' ? 'weeks' : 'semanas'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Plan start date */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Plan start date' : 'Fecha de inicio'}
        </Text>
        <Text style={styles.sectionDescription}>
          {language === 'en'
            ? 'We will label D1, D2, and reports using this date.'
            : 'Usaremos esta fecha para etiquetar D1, D2 y los reportes.'}
        </Text>
        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateValue}>{formattedStartDate}</Text>
            <Text style={styles.dateHelper}>
              {language === 'en'
                ? 'Tap to adjust if you started another day.'
                : 'Toca para ajustar si empezaste otro día.'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.dateButtonText}>{language === 'en' ? 'Change' : 'Cambiar'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Water Goal */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Water goal' : 'Meta de agua'}
        </Text>
        <Text style={styles.sectionDescription}>
          {language === 'en'
            ? 'Update your daily hydration target. Home, Day and Progress screens will follow this value.'
            : 'Actualiza tu meta diaria de hidratación. Inicio, Día y Progreso usarán este valor.'}
        </Text>
        <View style={styles.inlineRow}>
          <TextInput
            style={[styles.input, styles.inlineInput]}
            keyboardType="numeric"
            placeholder="2000"
            placeholderTextColor={theme.colors.textMuted}
            value={waterGoal}
            onChangeText={setWaterGoal}
          />
          <Text style={styles.inlineSuffix}>ml</Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={handleSaveWaterGoal}>
          <Text style={styles.buttonText}>
            {language === 'en' ? 'Save hydration goal' : 'Guardar meta de agua'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Theme */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Theme' : 'Tema'}
        </Text>
        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={[styles.option, themeMode === 'dark' && styles.optionActive]}
            onPress={() => handleChangeTheme('dark')}
          >
            <Text style={[styles.optionText, themeMode === 'dark' && styles.optionTextActive]}>
              🌙 {language === 'en' ? 'Dark' : 'Oscuro'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.option, themeMode === 'light' && styles.optionActive]}
            onPress={() => handleChangeTheme('light')}
          >
            <Text style={[styles.optionText, themeMode === 'light' && styles.optionTextActive]}>
              ☀️ {language === 'en' ? 'Light' : 'Claro'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Food Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Food Preferences (AI)' : 'Preferencias de Comidas (IA)'}
        </Text>
        <Text style={styles.sectionDescription}>
          {language === 'en' 
            ? 'AI will use this for breakfast, lunch, and dinner.'
            : 'La IA usará esto para desayuno, almuerzo y cena.'}
        </Text>
        <TextInput
          style={styles.input}
          placeholder={language === 'en' ? 'I like (chicken, beef, eggs)' : 'Me gusta (pollo, res, huevos)'}
          placeholderTextColor={theme.colors.textMuted}
          value={likeFoods}
          onChangeText={setLikeFoods}
        />
        <TextInput
          style={styles.input}
          placeholder={language === 'en' ? 'I dislike (shrimp, salmon)' : 'No me gusta (camarón, salmón)'}
          placeholderTextColor={theme.colors.textMuted}
          value={dislikeFoods}
          onChangeText={setDislikeFoods}
        />
        <TouchableOpacity style={styles.button} onPress={handleSaveFoodPrefs}>
          <Text style={styles.buttonText}>
            {language === 'en' ? 'Save Preferences' : 'Guardar Preferencias'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* API Access */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Secure API Access' : 'Acceso API Seguro'}
        </Text>
        <Text style={styles.sectionDescription}>
          {language === 'en' 
            ? 'User and key sent to Netlify endpoint to use your AI.'
            : 'Usuario y clave que se envían al endpoint de Netlify para usar tu IA.'}
        </Text>
        <TextInput
          style={styles.input}
          placeholder={language === 'en' ? 'User' : 'Usuario'}
          placeholderTextColor={theme.colors.textMuted}
          value={apiUser}
          onChangeText={setApiUser}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder={language === 'en' ? 'Password / Token' : 'Clave / Token'}
          placeholderTextColor={theme.colors.textMuted}
          value={apiPass}
          onChangeText={setApiPass}
          secureTextEntry
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.button} onPress={handleSaveApiCredentials}>
          <Text style={styles.buttonText}>
            {language === 'en' ? 'Save Access' : 'Guardar Acceso'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Reset */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Reset Everything' : 'Reiniciar Todo'}
        </Text>
        <Text style={styles.sectionDescription}>
          {language === 'en' 
            ? 'This deletes your name, progress, dates and completed days.'
            : 'Esto borra tu nombre, progreso, fechas y días completados.'}
        </Text>
        <TouchableOpacity style={[styles.button, styles.buttonDanger]} onPress={handleResetApp}>
          <Text style={styles.buttonText}>
            {language === 'en' ? 'Delete All' : 'Borrar Todo'}
          </Text>
        </TouchableOpacity>
      </View>

      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={handleChangeStartDate}
        initialDate={planStartDate}
        theme={theme}
        language={language}
      />

      <Text style={styles.version}>Keto Pro v1.0.0</Text>
    </ScrollView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: 100
  },
  banner: {
    marginBottom: theme.spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  section: {
    marginBottom: theme.spacing.xl
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs
  },
  sectionDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm
  },
  input: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    ...theme.typography.body
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center'
  },
  buttonDanger: {
    backgroundColor: theme.colors.danger
  },
  buttonText: {
    ...theme.typography.body,
    color: '#fff',
    fontWeight: '600'
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm
  },
  inlineInput: {
    flex: 1,
    marginBottom: 0
  },
  inlineSuffix: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '500'
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md
  },
  dateValue: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600'
  },
  dateHelper: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: 2
  },
  dateButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary
  },
  dateButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.primary,
    fontWeight: '700'
  },
  optionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm
  },
  option: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center'
  },
  optionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  optionText: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '500'
  },
  optionTextActive: {
    color: '#fff',
    fontWeight: '600'
  },
  version: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.xl
  }
});

export default SettingsScreen;
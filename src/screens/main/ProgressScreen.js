import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Dimensions
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import {
  getProgressData,
  saveProgressData,
  getCompletedDaysCount,
  getWaterState
} from '../../storage/storage';
import {
  estimateBodyFat,
  calculateBMR,
  calculateBMI,
  getBMICategory
} from '../../utils/calculations';
import storage, { KEYS } from '../../storage/storage';

const ProgressScreen = () => {
  const {
    theme: themeMode,
    language,
    derivedPlan,
    gender
  } = useApp();

  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  const [completedDays, setCompletedDays] = useState(0);
  const [showBaseDataModal, setShowBaseDataModal] = useState(false);
  
  const [height, setHeight] = useState('');
  const [startWeight, setStartWeight] = useState('');
  const [age, setAge] = useState('');
  const [hasBaseData, setHasBaseData] = useState(false);

  const [bodyFat, setBodyFat] = useState(null);
  const [bmr, setBmr] = useState(null);
  const [bmi, setBmi] = useState(null);
  const [bmiCategory, setBmiCategory] = useState(null);

  const [progressByDay, setProgressByDay] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);

  const [dayForm, setDayForm] = useState({
    peso: '',
    cintura: '',
    energia: '',
    exkcal: '',
    notas: ''
  });

  const [hydration, setHydration] = useState({ daysWithWater: 0, totalMl: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const completed = await getCompletedDaysCount(derivedPlan.length);
    setCompletedDays(completed);

    const h = await storage.get(KEYS.HEIGHT, '');
    const w = await storage.get(KEYS.START_WEIGHT, '');
    const a = await storage.get(KEYS.AGE, '');
    
    if (h && w && a) {
      setHeight(h);
      setStartWeight(w);
      setAge(a);
      setHasBaseData(true);
      calculateStats(h, w, a);
    }

    await loadAllProgress();
    const hydraStats = await hydrationStats();
    setHydration(hydraStats);
  };

  const loadAllProgress = async () => {
    const data = [];
    for (let i = 0; i < derivedPlan.length; i++) {
      const dayProgress = await getProgressData(i);
      if (Object.keys(dayProgress).length > 0) {
        data.push({ dayIndex: i, ...dayProgress });
      }
    }
    setProgressByDay(data);
  };

  const calculateStats = (h, w, a) => {
    const bf = estimateBodyFat(h, w, a, gender);
    const bmrVal = calculateBMR(h, w, a, gender !== 'female');
    const bmiVal = calculateBMI(h, w);
    const category = getBMICategory(bmiVal, language);

    setBodyFat(bf);
    setBmr(bmrVal);
    setBmi(bmiVal);
    setBmiCategory(category);
  };

  const handleSaveBaseData = async () => {
    if (height && startWeight && age) {
      await storage.set(KEYS.HEIGHT, height);
      await storage.set(KEYS.START_WEIGHT, startWeight);
      await storage.set(KEYS.AGE, age);
      
      setHasBaseData(true);
      calculateStats(height, startWeight, age);
      setShowBaseDataModal(false);
    }
  };

  const handleOpenDayModal = (dayIndex) => {
    setSelectedDay(dayIndex);
    loadDayData(dayIndex);
    setShowDayModal(true);
  };

  const loadDayData = async (dayIndex) => {
    const data = await getProgressData(dayIndex);
    setDayForm({
      peso: data.peso || '',
      cintura: data.cintura || '',
      energia: data.energia || '',
      exkcal: data.exkcal || '',
      notas: data.notas || ''
    });
  };

  const handleSaveDayProgress = async () => {
    if (selectedDay !== null) {
      await saveProgressData(selectedDay, dayForm);
      setShowDayModal(false);
      await loadAllProgress();
      
      if (dayForm.peso && height && age) {
        calculateStats(height, dayForm.peso, age);
      }
    }
  };

  const hydrationStats = async () => {
    let daysWithWater = 0;
    let totalMl = 0;
    
    for (let i = 0; i < derivedPlan.length; i++) {
      const water = await getWaterState(i);
      totalMl += water.ml;
      if (water.ml >= water.goal * 0.8) {
        daysWithWater++;
      }
    }
    
    return { daysWithWater, totalMl };
  };

  // Preparar datos para gráfica
  const getChartData = () => {
    const labels = [];
    const weights = [];
    
    // Peso inicial
    if (startWeight) {
      labels.push('Inicio');
      weights.push(parseFloat(startWeight));
    }

    // Pesos registrados
    progressByDay.forEach((p) => {
      if (p.peso) {
        labels.push(`D${p.dayIndex + 1}`);
        weights.push(parseFloat(p.peso));
      }
    });

    // Si no hay datos, mostrar placeholder
    if (weights.length === 0) {
      return {
        labels: ['Sin datos'],
        datasets: [{ data: [0] }]
      };
    }

    return {
      labels,
      datasets: [{ data: weights, color: () => theme.colors.primary }]
    };
  };

  const screenWidth = Dimensions.get('window').width;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {language === 'en' ? '📈 Progress' : '📈 Progreso'}
        </Text>
        <Text style={styles.subtitle}>
          {language === 'en' 
            ? `${completedDays} of ${derivedPlan.length} days completed`
            : `${completedDays} de ${derivedPlan.length} días completados`}
        </Text>
      </View>

      {/* Base Data */}
      {hasBaseData ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {language === 'en' ? 'Base Data' : 'Datos Base'}
          </Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{language === 'en' ? 'Height' : 'Estatura'}</Text>
              <Text style={styles.statValue}>{height} cm</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{language === 'en' ? 'Start' : 'Peso Inicial'}</Text>
              <Text style={styles.statValue}>{startWeight} kg</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{language === 'en' ? 'Age' : 'Edad'}</Text>
              <Text style={styles.statValue}>{age}</Text>
            </View>
          </View>
          
          {bodyFat && (
            <View style={styles.calculatedStats}>
              <Text style={styles.calculatedStat}>
                {language === 'en' ? 'Body Fat' : '% Grasa'}: {bodyFat}%
              </Text>
              <Text style={styles.calculatedStat}>BMR: {bmr} kcal/día</Text>
              <Text style={styles.calculatedStat}>BMI: {bmi} ({bmiCategory})</Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => setShowBaseDataModal(true)}
          >
            <Text style={styles.editButtonText}>{language === 'en' ? 'Edit' : 'Editar'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.addBaseDataButton}
          onPress={() => setShowBaseDataModal(true)}
        >
          <Text style={styles.addBaseDataText}>
            {language === 'en' 
              ? '+ Add base data (height, weight, age)'
              : '+ Agregar datos base (estatura, peso, edad)'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Gráfica de Peso */}
      {progressByDay.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>
            {language === 'en' ? 'Weight Progress' : 'Progreso de Peso'}
          </Text>
          <LineChart
            data={getChartData()}
            width={screenWidth - 48}
            height={220}
            chartConfig={{
              backgroundColor: theme.colors.card,
              backgroundGradientFrom: theme.colors.card,
              backgroundGradientTo: theme.colors.card,
              decimalPlaces: 1,
              color: (opacity = 1) => theme.colors.primary,
              labelColor: (opacity = 1) => theme.colors.text,
              style: { borderRadius: 16 },
              propsForDots: {
                r: '6',
                strokeWidth: '2',
                stroke: theme.colors.primary
              }
            }}
            bezier
            style={styles.chart}
          />
        </View>
      )}

      {/* Hydration */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {language === 'en' ? '💧 Hydration' : '💧 Hidratación'}
        </Text>
        <Text style={styles.statText}>
          {language === 'en' 
            ? `Days with goal: ${hydration.daysWithWater} / ${derivedPlan.length}`
            : `Días con meta: ${hydration.daysWithWater} / ${derivedPlan.length}`}
        </Text>
        <Text style={styles.statText}>
          {language === 'en' 
            ? `Total water: ${hydration.totalMl} ml`
            : `Agua total: ${hydration.totalMl} ml`}
        </Text>
      </View>

      {/* Daily Progress */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {language === 'en' ? 'Daily Progress' : 'Progreso Diario'}
        </Text>
        {derivedPlan.map((day, index) => {
          const hasData = progressByDay.find(p => p.dayIndex === index);
          return (
            <TouchableOpacity
              key={index}
              style={[styles.dayCard, hasData && styles.dayCardWithData]}
              onPress={() => handleOpenDayModal(index)}
            >
              <Text style={styles.dayTitle}>{day.dia}</Text>
              {hasData ? (
                <Text style={styles.dayData}>
                  {hasData.peso ? `${hasData.peso} kg` : ''}
                  {hasData.energia ? ` • Energía: ${hasData.energia}/10` : ''}
                </Text>
              ) : (
                <Text style={styles.dayDataEmpty}>
                  {language === 'en' ? 'Tap to add data' : 'Toca para agregar'}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Modals */}
      <Modal visible={showBaseDataModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {language === 'en' ? 'Base Data' : 'Datos Base'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={language === 'en' ? 'Height (cm)' : 'Estatura (cm)'}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
              value={height}
              onChangeText={setHeight}
            />
            <TextInput
              style={styles.input}
              placeholder={language === 'en' ? 'Weight (kg)' : 'Peso (kg)'}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
              value={startWeight}
              onChangeText={setStartWeight}
            />
            <TextInput
              style={styles.input}
              placeholder={language === 'en' ? 'Age' : 'Edad'}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
              value={age}
              onChangeText={setAge}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowBaseDataModal(false)}
              >
                <Text style={styles.modalButtonText}>
                  {language === 'en' ? 'Cancel' : 'Cancelar'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleSaveBaseData}>
                <Text style={styles.modalButtonText}>
                  {language === 'en' ? 'Save' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDayModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedDay !== null && derivedPlan[selectedDay]?.dia}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={language === 'en' ? 'Weight (kg)' : 'Peso (kg)'}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
              value={dayForm.peso}
              onChangeText={(text) => setDayForm({...dayForm, peso: text})}
            />
            <TextInput
              style={styles.input}
              placeholder={language === 'en' ? 'Waist (cm)' : 'Cintura (cm)'}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
              value={dayForm.cintura}
              onChangeText={(text) => setDayForm({...dayForm, cintura: text})}
            />
            <TextInput
              style={styles.input}
              placeholder={language === 'en' ? 'Energy (1-10)' : 'Energía (1-10)'}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
              value={dayForm.energia}
              onChangeText={(text) => setDayForm({...dayForm, energia: text})}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={language === 'en' ? 'Notes' : 'Notas'}
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={3}
              value={dayForm.notas}
              onChangeText={(text) => setDayForm({...dayForm, notas: text})}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowDayModal(false)}
              >
                <Text style={styles.modalButtonText}>
                  {language === 'en' ? 'Cancel' : 'Cancelar'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleSaveDayProgress}>
                <Text style={styles.modalButtonText}>
                  {language === 'en' ? 'Save' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  header: {
    marginBottom: theme.spacing.lg
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.text,
    marginBottom: 4
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted
  },
  card: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  cardTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm
  },
  statItem: {
    flex: 1,
    alignItems: 'center'
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginBottom: 4
  },
  statValue: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600'
  },
  calculatedStats: {
    backgroundColor: theme.colors.bgSoft,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    gap: 4
  },
  calculatedStat: {
    ...theme.typography.bodySmall,
    color: theme.colors.text
  },
  statText: {
    ...theme.typography.body,
    color: theme.colors.text,
    marginBottom: 4
  },
  editButton: {
    backgroundColor: theme.colors.bgSoft,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    alignItems: 'center',
    marginTop: theme.spacing.sm
  },
  editButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.text,
    fontWeight: '600'
  },
  addBaseDataButton: {
    backgroundColor: theme.colors.card,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.md
  },
  addBaseDataText: {
    ...theme.typography.body,
    color: theme.colors.primary,
    fontWeight: '600'
  },
  chartCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    alignItems: 'center'
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16
  },
  section: {
    marginTop: theme.spacing.md
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm
  },
  dayCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm
  },
  dayCardWithData: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(15,118,110,0.05)'
  },
  dayTitle: {
    ...theme.typography.body,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: 4
  },
  dayData: {
    ...theme.typography.bodySmall,
    color: theme.colors.text
  },
  dayDataEmpty: {
    ...theme.typography.bodySmall,
    color: theme.colors.textMuted,
    fontStyle: 'italic'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: theme.spacing.lg
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg
  },
  modalTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: 'center'
  },
  input: {
    backgroundColor: theme.colors.bgSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    ...theme.typography.body
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top'
  },
  modalButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md
  },
  modalButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center'
  },
  modalButtonSecondary: {
    backgroundColor: theme.colors.bgSoft
  },
  modalButtonText: {
    ...theme.typography.body,
    color: '#fff',
    fontWeight: '600'
  }
});

export default ProgressScreen;
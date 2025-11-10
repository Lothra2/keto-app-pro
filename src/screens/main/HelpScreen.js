import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import Card from '../../components/shared/Card';
import Button from '../../components/shared/Button';

const HelpScreen = ({ navigation }) => {
  const { theme: themeMode, language } = useApp();
  const theme = getTheme(themeMode);
  const styles = getStyles(theme);

  const sections = language === 'en'
    ? [
        {
          title: 'Daily flow',
          points: [
            'Tap Menu to see today\'s meals, water tracker and AI extras.',
            'Log water and mark meals as completed to keep your progress chart up to date.',
            'Use “Full day with AI” to refresh every meal with one tap.'
          ]
        },
        {
          title: 'AI tools',
          points: [
            'Ask the AI to review your day for quick feedback.',
            'Generate a weekly recap to spot wins and adjustments.',
            'Create a smart shopping list each week grouped by sections.'
          ]
        },
        {
          title: 'Progress & workouts',
          points: [
            'Track your weight, energy, body fat and water to unlock the charts.',
            'The Workouts tab stores every AI routine plus a collapsible local plan.',
            'Update your base data anytime from the Progress screen.'
          ]
        }
      ]
    : [
        {
          title: 'Flujo diario',
          points: [
            'Entra a Menú para ver las comidas del día, agua y extras IA.',
            'Registra agua y marca comidas completadas para que el progreso se actualice.',
            'Usa “Día completo IA” para refrescar todas las comidas de una vez.'
          ]
        },
        {
          title: 'Herramientas IA',
          points: [
            'Pídele a la IA que revise tu día para recibir feedback rápido.',
            'Genera un resumen semanal para ver avances y ajustes.',
            'Crea una lista inteligente de compras cada semana por secciones.'
          ]
        },
        {
          title: 'Progreso y entrenos',
          points: [
            'Registra peso, energía, % de grasa y agua para activar las gráficas.',
            'La pestaña Entrenos guarda cada rutina IA y el plan local plegable.',
            'Actualiza tus datos base cuando quieras desde la pantalla de Progreso.'
          ]
        }
      ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.emoji}>🧭</Text>
        <Text style={styles.title}>
          {language === 'en' ? 'How to use the app' : 'Cómo usar la app'}
        </Text>
        <Text style={styles.subtitle}>
          {language === 'en'
            ? 'Quick tips so you and the AI stay in sync every day.'
            : 'Tips rápidos para que tú y la IA se mantengan sincronizados cada día.'}
        </Text>
      </View>

      {sections.map((section) => (
        <Card key={section.title} style={styles.card}>
          <Text style={styles.cardTitle}>{section.title}</Text>
          {section.points.map((point) => (
            <View key={point} style={styles.pointRow}>
              <Text style={styles.pointBullet}>•</Text>
              <Text style={styles.pointText}>{point}</Text>
            </View>
          ))}
        </Card>
      ))}

      <Button
        title={language === 'en' ? 'Back to settings' : 'Volver a ajustes'}
        variant="secondary"
        onPress={() => navigation.goBack()}
        style={styles.backButton}
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
      gap: theme.spacing.lg
    },
    header: {
      alignItems: 'center',
      gap: theme.spacing.sm
    },
    emoji: {
      fontSize: 48
    },
    title: {
      ...theme.typography.h1,
      textAlign: 'center',
      color: theme.colors.text
    },
    subtitle: {
      ...theme.typography.body,
      textAlign: 'center',
      color: theme.colors.textMuted
    },
    card: {
      gap: theme.spacing.sm
    },
    cardTitle: {
      ...theme.typography.h3,
      color: theme.colors.text
    },
    pointRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm
    },
    pointBullet: {
      color: theme.colors.primary,
      fontSize: 18,
      lineHeight: 20
    },
    pointText: {
      ...theme.typography.bodySmall,
      color: theme.colors.text,
      flex: 1
    },
    backButton: {
      alignSelf: 'center',
      paddingHorizontal: 32
    }
  });

export default HelpScreen;

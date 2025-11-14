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
            'Open Menu to review meals, your hydration goal and the daily AI shortcuts.',
            'Use the new meal toggles to mark portions as done and watch calories update instantly.',
            'Need a refresh? “Full day with AI” rewrites every meal keeping your macros aligned.'
          ]
        },
        {
          title: 'AI superpowers',
          points: [
            'Consultor or Coach now shows clearer bubbles, so you never lose track of the conversation.',
            'Shopping list and AI workout cards are collapsible—expand only what you need.',
            'Export a beautiful weekly PDF from the Menu to share or print your plan.'
          ]
        },
        {
          title: 'Progress & data',
          points: [
            'Track weight, energy, water and workouts to unlock the charts and summaries.',
            'Base data now suggests daily calories tailored to your age, weight and intensity.',
            'Adjust preferences, language, theme or credentials from Settings at any time.'
          ]
        }
      ]
    : [
        {
          title: 'Flujo diario',
          points: [
            'Entra al Menú para ver comidas, meta de agua y accesos directos IA del día.',
            'Usa los nuevos toggles de comida para marcar avances y ver calorías al instante.',
            '¿Necesitas ideas frescas? “Día completo IA” reescribe todo manteniendo tus macros.'
          ]
        },
        {
          title: 'Superpoderes IA',
          points: [
            'El chat Consultor luce burbujas más claras para seguir cada respuesta.',
            'La lista de compras y el entreno IA ahora son plegables: abre solo lo que necesitas.',
            'Exporta un PDF elegante de la semana desde el Menú para compartir tu plan.'
          ]
        },
        {
          title: 'Progreso y datos',
          points: [
            'Registra peso, energía, agua y entrenos para desbloquear gráficas y resúmenes.',
            'Los datos base ahora sugieren calorías ideales según tu edad, peso e intensidad.',
            'Ajusta preferencias, idioma, tema o credenciales en Ajustes cuando quieras.'
          ]
        }
      ];

  const quickActions = language === 'en'
    ? [
        {
          label: 'Generate weekly PDF',
          description: 'In Menu tap “Share weekly PDF” to download or send every meal with notes and macros.'
        },
        {
          label: 'Refine shopping',
          description: 'Collapse the base list to focus on AI suggestions, then reopen to double-check staples.'
        },
        {
          label: 'Tune hydration',
          description: 'Water goals from onboarding auto-fill every day—adjust from Settings if your needs change.'
        }
      ]
    : [
        {
          label: 'Generar PDF semanal',
          description: 'En Menú toca “Compartir PDF semanal” para descargar o enviar cada comida con notas y macros.'
        },
        {
          label: 'Afina tus compras',
          description: 'Pliega la lista base para enfocarte en la IA y vuelve a abrirla para repasar básicos.'
        },
        {
          label: 'Ajusta tu hidratación',
          description: 'La meta de agua del onboarding se aplica a cada día; modifícala en Ajustes si cambia tu rutina.'
        }
      ];

  const faq = language === 'en'
    ? [
        {
          q: 'How do I share my plan with someone?',
          a: 'From Menu tap the new PDF button, wait a few seconds and pick your favourite sharing app.'
        },
        {
          q: 'Why do calories change when I toggle meals?',
          a: 'Each toggle updates your adherence using the meal distribution (25/10/35/10/20).'
        },
        {
          q: 'Can I customise the AI prompts?',
          a: 'Yes! Use the quick chips to start and then continue typing your own questions to the coach.'
        }
      ]
    : [
        {
          q: '¿Cómo comparto mi plan con alguien?',
          a: 'Desde Menú toca el nuevo botón de PDF, espera unos segundos y elige la app para enviarlo.'
        },
        {
          q: '¿Por qué cambian las calorías al activar comidas?',
          a: 'Cada toggle actualiza tu adherencia usando la distribución 25/10/35/10/20 del plan.'
        },
        {
          q: '¿Puedo personalizar las preguntas a la IA?',
          a: '¡Claro! Usa los chips rápidos como base y sigue escribiendo lo que necesites del coach.'
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

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>
          {language === 'en' ? 'Quick actions' : 'Acciones rápidas'}
        </Text>
        {quickActions.map((item) => (
          <View key={item.label} style={styles.actionRow}>
            <View style={styles.actionTag}>
              <Text style={styles.actionTagText}>{item.label}</Text>
            </View>
            <Text style={styles.actionDescription}>{item.description}</Text>
          </View>
        ))}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>{language === 'en' ? 'FAQ' : 'Preguntas frecuentes'}</Text>
        {faq.map((item) => (
          <View key={item.q} style={styles.faqItem}>
            <Text style={styles.faqQuestion}>{item.q}</Text>
            <Text style={styles.faqAnswer}>{item.a}</Text>
          </View>
        ))}
      </Card>

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
      color: theme.colors.text,
      letterSpacing: 0.2
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
    actionRow: {
      gap: theme.spacing.xs
    },
    actionTag: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.primarySoft,
      borderRadius: theme.radius.full,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    actionTagText: {
      ...theme.typography.caption,
      color: theme.colors.primary,
      fontWeight: '600'
    },
    actionDescription: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted,
      lineHeight: 18
    },
    faqItem: {
      gap: 4,
      paddingVertical: 4
    },
    faqQuestion: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600'
    },
    faqAnswer: {
      ...theme.typography.bodySmall,
      color: theme.colors.textMuted,
      lineHeight: 18
    },
    backButton: {
      alignSelf: 'center',
      paddingHorizontal: 32
    }
  });

export default HelpScreen;

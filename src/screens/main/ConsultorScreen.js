import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import aiService from '../../api/aiService';
import ScreenBanner from '../../components/shared/ScreenBanner';
import { stripMarkdownHeadings } from '../../utils/labels';

const QUICK = [
  { id: 'q1', textEs: 'Plan keto 1800 kcal', textEn: 'Keto plan 1800 kcal' },
  { id: 'q2', textEs: 'Rutina calistenia 30 min', textEn: 'Calisthenics routine 30 min' },
  { id: 'q3', textEs: 'Receta con atún y aguacate', textEn: 'Recipe with tuna and avocado' },
  { id: 'q4', textEs: 'Analiza mi día, proteína baja', textEn: 'Review my day, low protein' },
];

const MODES = [{ id: 'auto', labelEs: 'Auto', labelEn: 'Auto' }];

const getWelcomeMessage = (language) => ({
  id: 'welcome',
  role: 'assistant',
  text:
    language === 'en'
      ? 'Hi, I am your keto and calisthenics coach. Ask me for meal plans, recipes, or bodyweight workouts.'
      : 'Hola, soy tu consultor de dieta keto y calistenia. Pídeme planes, recetas o entrenos con peso corporal.',
});

const ConsultorScreen = () => {
  const { theme: themeMode, language, apiCredentials } = useApp();
  const theme = getTheme(themeMode);
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([getWelcomeMessage(language)]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('auto'); // único modo activo
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const creds = useMemo(() => apiCredentials || { user: '', pass: '' }, [apiCredentials]);
  const hasCredentials = Boolean(creds.user && creds.pass);

  const cleanAssistantText = useCallback((value) => {
    if (!value) return '';

    return stripMarkdownHeadings(value)
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/\u2022/g, '•')
      .replace(/^\s*[-*]\s+/gm, '• ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }, []);

  const push = useCallback((msg) => {
    const normalized =
      msg.role === 'assistant' && typeof msg.text === 'string'
        ? { ...msg, text: cleanAssistantText(msg.text) }
        : msg;

    setMessages((prev) => [...prev, normalized]);
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [cleanAssistantText]);

  const handleResetChat = useCallback(() => {
    setMessages([getWelcomeMessage(language)]);
  }, [language]);

  const handleQuick = useCallback((text) => setInput(text), []);

  const onSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg = { id: String(Date.now()), role: 'user', text: trimmed };
    push(userMsg);
    setInput('');
    setLoading(true);

    try {
      if (!hasCredentials) {
        push({
          id: String(Date.now() + 1),
          role: 'assistant',
          text:
            language === 'en'
              ? 'Add your API credentials in Settings to talk with the consultant.'
              : 'Agrega tus credenciales API en Ajustes para usar el consultor.',
        });
        return;
      }

      if (mode === 'image') {
        const img = await aiService.generateImage({
          prompt: trimmed,
          language,
          credentials: creds,
          size: '1024x1024',
        });

        if (img?.error) {
          push({
            id: String(Date.now() + 2),
            role: 'assistant',
            text: img.error,
          });
        } else if (img?.imageUrl || img?.base64) {
          push({
            id: String(Date.now() + 1),
            role: 'assistant',
            text: language === 'en' ? 'Image generated' : 'Imagen generada',
            imageUri: img.imageUrl || `data:image/png;base64,${img.base64}`,
          });
        }
      } else {
        const res = await aiService.chat({
          prompt: trimmed,
          mode,
          language,
          credentials: creds,
          context: { domain: 'keto-calisthenics', experienceYears: 20 },
        });

        const text =
          res?.text ||
          (language === 'en' ? 'I could not answer right now.' : 'No pude responder ahora.');

        push({ id: String(Date.now() + 3), role: 'assistant', text });
      }
    } catch (e) {
      push({
        id: String(Date.now() + 4),
        role: 'assistant',
        text: language === 'en' ? 'There was an error. Try again.' : 'Hubo un error. Intenta de nuevo.',
      });
    } finally {
      setLoading(false);
    }
  }, [input, loading, mode, language, creds, push]);

  const bubblePalette = useMemo(() => {
    const isDark = theme.mode === 'dark';

    return {
      userBg: isDark ? 'rgba(14,165,233,0.2)' : 'rgba(14,165,233,0.12)',
      userBorder: isDark ? 'rgba(125,211,252,0.45)' : 'rgba(14,165,233,0.35)',
      assistantBg: isDark ? 'rgba(15,23,42,0.72)' : theme.colors.surface,
      assistantBorder: isDark ? 'rgba(148,163,184,0.35)' : theme.colors.border,
      meta: isDark ? 'rgba(226,232,240,0.65)' : 'rgba(15,23,42,0.55)'
    };
  }, [theme]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (event) => {
      const height = event?.endCoordinates?.height || 0;
      setKeyboardOffset(Math.max(height - insets.bottom, 0));
    };

    const onHide = () => {
      setKeyboardOffset(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom]);

  const renderItem = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? bubblePalette.userBg : bubblePalette.assistantBg,
            alignSelf: isUser ? 'flex-end' : 'flex-start',
            borderColor: isUser ? bubblePalette.userBorder : bubblePalette.assistantBorder,
            shadowOpacity: theme.mode === 'dark' ? 0.18 : 0.08,
            shadowColor: isUser ? '#0ea5e9' : '#0f172a',
          },
        ]}
      >
        <Text
          style={[
            styles.metaLabel,
            { color: bubblePalette.meta, alignSelf: isUser ? 'flex-end' : 'flex-start' },
          ]}
        >
          {isUser
            ? language === 'en'
              ? 'You'
              : 'Tú'
            : language === 'en'
            ? 'Coach'
            : 'Coach'}
        </Text>
        {!!item.imageUri && (
          <Image source={{ uri: item.imageUri }} style={styles.image} resizeMode="cover" />
        )}
        <Text style={[styles.msg, { color: theme.colors.onSurface }]}>{item.text}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <View style={styles.bannerWrapper}>
        <ScreenBanner
          theme={theme}
          icon="🤖"
          title={language === 'en' ? 'AI Consultant' : 'Consultor IA'}
          subtitle={
            language === 'en'
              ? 'Ask for keto plans, calisthenics or recipes.'
              : 'Pide planes keto, calistenia o recetas.'
          }
          description={
            language === 'en'
              ? 'Ask anything about keto plans, recipes or calisthenics.'
              : 'Pregunta lo que necesites de planes keto, recetas o calistenia.'
          }
          badge={
            hasCredentials
              ? language === 'en'
                ? 'Connected'
                : 'Conectado'
              : language === 'en'
              ? 'Missing credentials'
              : 'Faltan credenciales'
          }
          badgeTone={hasCredentials ? 'success' : 'warning'}
          footnote={
            language === 'en'
              ? 'Use the quick prompts or type your own question below.'
              : 'Usa los atajos rápidos o escribe tu pregunta abajo.'
          }
          style={styles.banner}
        >
          <View style={styles.bannerModes}>
            <Text style={styles.bannerLabel}>
              {language === 'en' ? 'Active mode' : 'Modo activo'}
            </Text>
            <Text style={styles.bannerModeValue}>
              {
                MODES.find((m) => m.id === mode)?.[language === 'en' ? 'labelEn' : 'labelEs'] ||
                mode
              }
            </Text>
          </View>
        </ScreenBanner>
      </View>

      {/* chips rápidos */}
      <View style={[styles.quickRow, { backgroundColor: theme.colors.bgSoft }]}>
        <FlatList
          horizontal
          data={QUICK}
          keyExtractor={(q) => q.id}
          contentContainerStyle={styles.quickContent}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => {
            const label = language === 'en' ? item.textEn : item.textEs;
            return (
              <TouchableOpacity
                onPress={() => handleQuick(label)}
                style={[
                  styles.quickChip,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                    shadowColor: '#000',
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 2,
                  },
                ]}
              >
                <Text style={{ color: theme.colors.onSurface }}>{label}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* selector de modo */}
      {MODES.length > 1 && (
        <View style={styles.modeRow}>
          {MODES.map((m) => {
            const active = m.id === mode;
            const label = language === 'en' ? m.labelEn : m.labelEs;
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => setMode(m.id)}
                style={[
                  styles.modeChip,
                  {
                    backgroundColor: active ? theme.colors.primary : 'transparent',
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <Text style={{ color: active ? theme.colors.onPrimary : theme.colors.textMuted }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* chat */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 120 + insets.bottom + keyboardOffset },
        ]}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      />

      {/* input */}
      <LinearGradient
        colors={
          theme.mode === 'dark'
            ? ['rgba(15,23,42,0.92)', 'rgba(15,23,42,0.86)']
            : ['rgba(255,255,255,0.97)', 'rgba(248,250,252,0.92)']
        }
        style={[
          styles.inputBar,
          {
            borderTopColor: theme.colors.border,
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: -6 },
            elevation: 10,
            paddingBottom: 12 + insets.bottom,
            bottom: keyboardOffset,
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              color: theme.colors.onSurface,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
          placeholder={language === 'en' ? 'Ask your coach...' : 'Pregunta a tu consultor...'}
          placeholderTextColor={theme.colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          onFocus={() =>
            requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
          }
        />
        <TouchableOpacity
          onPress={handleResetChat}
          disabled={loading || messages.length <= 1}
          style={[
            styles.resetBtn,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            },
            (loading || messages.length <= 1) && styles.resetBtnDisabled,
          ]}
        >
          <Text style={[styles.resetTxt, { color: theme.colors.textMuted }]}>↺</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSend}
          disabled={loading || input.trim().length === 0}
          style={[
            styles.sendBtn,
            {
              backgroundColor: loading ? theme.colors.textMuted : theme.colors.primary,
              shadowColor: '#0f766e',
              shadowOpacity: loading ? 0 : 0.35,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
              elevation: loading ? 0 : 8,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.onPrimary} />
          ) : (
            <Text style={[styles.sendTxt, { color: theme.colors.onPrimary }]}>➤</Text>
          )}
        </TouchableOpacity>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  bannerWrapper: {
    padding: 16,
    paddingBottom: 4,
  },
  banner: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  bannerModes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerLabel: {
    fontSize: 13,
    color: 'rgba(241,245,249,0.8)',
    fontWeight: '600',
  },
  bannerModeValue: {
    fontSize: 14,
    color: 'rgba(248,250,252,0.95)',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  quickRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  quickContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  modeRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    paddingVertical: 4,
    flexWrap: 'wrap',
  },
  modeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  bubble: {
    maxWidth: '88%',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    marginVertical: 6,
    gap: 6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  msg: { fontSize: 15, lineHeight: 22 },
  image: { width: 240, height: 240, borderRadius: 14, marginBottom: 4 },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    paddingTop: 12,
  },
  inputBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  resetBtn: {
    height: 40,
    minWidth: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  resetBtnDisabled: {
    opacity: 0.4,
  },
  resetTxt: {
    fontSize: 14,
    fontWeight: '600',
  },
  sendBtn: {
    height: 42,
    minWidth: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  sendTxt: { fontSize: 16, fontWeight: '600' },
});

export default ConsultorScreen;

import React, { useCallback, useMemo, useRef, useState } from 'react';
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
} from 'react-native';
import { useApp } from '../../context/AppContext';
import { getTheme } from '../../theme';
import aiService from '../../api/aiService';

const QUICK = [
  { id: 'q1', text: 'Plan keto 1800 kcal' },
  { id: 'q2', text: 'Rutina calistenia 30 min' },
  { id: 'q3', text: 'Receta con atún y aguacate' },
  { id: 'q4', text: 'Analiza mi día, proteína baja' },
];

const MODES = [
  { id: 'auto', labelEs: 'Auto', labelEn: 'Auto' },
  { id: 'diet', labelEs: 'Dieta', labelEn: 'Diet' },
  { id: 'calis', labelEs: 'Calistenia', labelEn: 'Calisthenics' },
  { id: 'recipes', labelEs: 'Recetas', labelEn: 'Recipes' },
  { id: 'image', labelEs: 'Imagen', labelEn: 'Image' },
];

const ConsultorScreen = () => {
  const { theme: themeMode, language, apiUser, apiPass } = useApp();
  const theme = getTheme(themeMode);

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text:
        language === 'en'
          ? 'Hi, I am your keto and calisthenics coach. Ask me for meal plans, recipes, or bodyweight workouts.'
          : 'Hola, soy tu consultor de dieta keto y calistenia. Pídeme planes, recetas o entrenos con peso corporal.',
    },
  ]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('auto'); // auto | diet | calis | recipes | image
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  const creds = useMemo(() => ({ user: apiUser, pass: apiPass }), [apiUser, apiPass]);

  const push = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const handleQuick = useCallback((text) => setInput(text), []);

  const onSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg = { id: String(Date.now()), role: 'user', text: trimmed };
    push(userMsg);
    setInput('');
    setLoading(true);

    try {
      if (mode === 'image') {
        const img = await aiService.generateImage({
          prompt: trimmed,
          language,
          credentials: creds,
          size: '1024x1024',
        });

        if (img?.imageUrl || img?.base64) {
          push({
            id: String(Date.now() + 1),
            role: 'assistant',
            text: language === 'en' ? 'Image generated' : 'Imagen generada',
            imageUri: img.imageUrl || `data:image/png;base64,${img.base64}`,
          });
        } else {
          push({
            id: String(Date.now() + 2),
            role: 'assistant',
            text: language === 'en' ? 'I could not create the image.' : 'No pude crear la imagen.',
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

  const renderItem = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? theme.colors.primarySoft : theme.colors.card,
            alignSelf: isUser ? 'flex-end' : 'flex-start',
            borderColor: isUser ? theme.colors.primary : theme.colors.border,
          },
        ]}
      >
        {!!item.imageUri && (
          <Image source={{ uri: item.imageUri }} style={styles.image} resizeMode="cover" />
        )}
        <Text style={[styles.msg, { color: theme.colors.text }]}>{item.text}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* chips rápidos */}
      <View style={styles.quickRow}>
        <FlatList
          horizontal
          data={QUICK}
          keyExtractor={(q) => q.id}
          contentContainerStyle={{ paddingHorizontal: 12 }}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleQuick(item.text)}
              style={[
                styles.quickChip,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
              ]}
            >
              <Text style={{ color: theme.colors.text }}>{item.text}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* selector de modo */}
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

      {/* chat */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      {/* input */}
      <View
        style={[
          styles.inputBar,
          { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border },
        ]}
      >
        <TextInput
          style={[styles.input, { color: theme.colors.text }]}
          placeholder={language === 'en' ? 'Ask your coach...' : 'Pregunta a tu consultor...'}
          placeholderTextColor={theme.colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
        />
        <TouchableOpacity
          onPress={onSend}
          disabled={loading || input.trim().length === 0}
          style={[
            styles.sendBtn,
            { backgroundColor: loading ? theme.colors.textMuted : theme.colors.primary },
          ]}
        >
          {loading ? (
            <ActivityIndicator />
          ) : (
            <Text style={[styles.sendTxt, { color: theme.colors.onPrimary }]}>➤</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  quickRow: { paddingVertical: 8 },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
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
    maxWidth: '85%',
    borderWidth: 1,
    padding: 10,
    borderRadius: 12,
    marginVertical: 6,
  },
  msg: { fontSize: 14, lineHeight: 20 },
  image: { width: 220, height: 220, borderRadius: 12, marginBottom: 8 },
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
  input: { flex: 1, minHeight: 40, maxHeight: 120, padding: 10 },
  sendBtn: {
    height: 42,
    minWidth: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  sendTxt: { fontSize: 16, fontWeight: '600' },
});

export default ConsultorScreen;

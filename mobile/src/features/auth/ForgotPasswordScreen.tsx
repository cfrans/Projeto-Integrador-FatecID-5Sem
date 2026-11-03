import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AuthBackground } from '@/components/ui/AuthBackground';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PenguinLogo } from '@/components/ui/PenguinLogo';
import { securityQuestion } from '@/features/auth/securityQuestion';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';
import { fonts, radius, spacing, typography, type ColorPalette } from '@/theme';

const MIN_PASSWORD_LENGTH = 8;
const MAX_ATTEMPTS = 5;

type Step = 'email' | 'answer' | 'password' | 'done';

export function ForgotPasswordScreen() {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; answer?: string; next?: string; confirm?: string }>({});
  const [busy, setBusy] = useState(false);

  async function findQuestion() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrors({ email: t('auth.validEmail') });
      return;
    }
    setBusy(true);
    try {
      const found = await securityQuestion.getQuestion(email);
      if (!found) {
        setErrors({ email: t('recover.noQuestion') });
        return;
      }
      setQuestion(found);
      setErrors({});
      setStep('answer');
    } catch {
      setErrors({ email: t('recover.storageError') });
    } finally {
      setBusy(false);
    }
  }

  async function checkAnswer() {
    if (attempts >= MAX_ATTEMPTS) {
      setErrors({ answer: t('recover.blocked') });
      return;
    }
    setBusy(true);
    try {
      if (await securityQuestion.verify(email, answer)) {
        setErrors({});
        setAnswer('');
        setStep('password');
        return;
      }
      const used = attempts + 1;
      setAttempts(used);
      setErrors({ answer: used >= MAX_ATTEMPTS ? t('recover.blocked') : t('recover.wrongAnswer', { count: MAX_ATTEMPTS - used }) });
    } catch {
      setErrors({ answer: t('recover.storageError') });
    } finally {
      setBusy(false);
    }
  }

  function savePassword() {
    const next: { next?: string; confirm?: string } = {};
    if (newPassword.length < MIN_PASSWORD_LENGTH) next.next = t('auth.passwordMin', { count: MIN_PASSWORD_LENGTH });
    if (confirmPassword !== newPassword) next.confirm = t('auth.passwordMismatch');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setNewPassword('');
    setConfirmPassword('');
    setStep('done');
  }

  return (
    <AuthBackground>
      <View style={styles.topBar} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
          <View style={styles.page}>
            <View style={styles.main}>
              <View style={styles.header}>
                <View style={styles.brand}>
                  <PenguinLogo size={36} />
                  <Text style={styles.brandName}>PIPLUP</Text>
                </View>
                <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
                  <Text style={styles.backText}>← {t('auth.back')}</Text>
                </Pressable>
              </View>
              <Text style={styles.eyebrow}>{t('recover.eyebrow')}</Text>
              <Text style={styles.title}>{t('recover.title')}</Text>
            {step === 'email' ? (
              <>
                <Text style={styles.description}>{t('recover.emailStep')}</Text>
                <View style={styles.field}>
                  <Text style={styles.label}>{t('common.email')}</Text>
                  <Input
                    accessibilityLabel={t('common.email')}
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    invalid={Boolean(errors.email)}
                    keyboardType="email-address"
                    onChangeText={(value) => { setEmail(value); setErrors({}); }}
                    placeholder={t('auth.emailPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={email}
                  />
                  {errors.email ? <Text accessibilityRole="alert" style={styles.error}>{errors.email}</Text> : null}
                </View>
                <Button label={t('recover.continue')} variant="solid" loading={busy} onPress={() => void findQuestion()} />
              </>
            ) : null}

            {step === 'answer' ? (
              <>
                <View style={styles.questionBox}>
                  <Text style={styles.questionLabel}>{t('settings.securityQuestionLabel')}</Text>
                  <Text style={styles.question}>{question}</Text>
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>{t('settings.securityAnswerLabel')}</Text>
                  <Input
                    accessibilityLabel={t('settings.securityAnswerLabel')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={attempts < MAX_ATTEMPTS}
                    invalid={Boolean(errors.answer)}
                    onChangeText={(value) => { setAnswer(value); setErrors({}); }}
                    value={answer}
                  />
                  {errors.answer ? <Text accessibilityRole="alert" style={styles.error}>{errors.answer}</Text> : null}
                </View>
                <Button
                  label={t('recover.verify')}
                  variant="solid"
                  loading={busy}
                  disabled={attempts >= MAX_ATTEMPTS}
                  onPress={() => void checkAnswer()}
                />
              </>
            ) : null}

            {step === 'password' ? (
              <>
                <Text style={styles.description}>{t('recover.passwordStep')}</Text>
                <View style={styles.field}>
                  <Text style={styles.label}>{t('settings.newPassword')}</Text>
                  <Input
                    accessibilityLabel={t('settings.newPassword')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    invalid={Boolean(errors.next)}
                    onChangeText={(value) => { setNewPassword(value); setErrors((c) => ({ ...c, next: undefined })); }}
                    placeholder={t('auth.passwordHint', { count: MIN_PASSWORD_LENGTH })}
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                    value={newPassword}
                  />
                  {errors.next ? <Text style={styles.error}>{errors.next}</Text> : null}
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>{t('auth.confirmPassword')}</Text>
                  <Input
                    accessibilityLabel={t('auth.confirmPassword')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    invalid={Boolean(errors.confirm)}
                    onChangeText={(value) => { setConfirmPassword(value); setErrors((c) => ({ ...c, confirm: undefined })); }}
                    secureTextEntry
                    value={confirmPassword}
                  />
                  {errors.confirm ? <Text style={styles.error}>{errors.confirm}</Text> : null}
                </View>
                <Button label={t('recover.save')} variant="solid" onPress={savePassword} />
              </>
            ) : null}

            {step === 'done' ? (
              <View style={styles.questionBox}>
                <Text accessibilityLiveRegion="polite" style={styles.question}>{t('recover.done')}</Text>
              </View>
            ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthBackground>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  topBar: { height: 4, backgroundColor: colors.accent },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  page: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xl },
  main: { alignSelf: 'center', gap: spacing.lg, maxWidth: 420, width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  brand: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  brandName: { color: colors.textPrimary, fontSize: 20, fontFamily: fonts.title, letterSpacing: 3 },
  backButton: { minHeight: 44, justifyContent: 'center' },
  backText: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '500' },
  eyebrow: { color: colors.accentText, fontSize: typography.label, fontWeight: '700', letterSpacing: 1.6, marginTop: spacing.md },
  title: { color: colors.textPrimary, fontSize: 40, lineHeight: 44, fontFamily: fonts.title, letterSpacing: -1 },
  description: { color: colors.textSecondary, fontSize: typography.body, lineHeight: 20 },
  field: { gap: spacing.sm },
  label: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  error: { color: colors.accentText, fontSize: typography.label, lineHeight: 18 },
  questionBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  questionLabel: { color: colors.textSecondary, fontSize: typography.label },
  question: { color: colors.textPrimary, fontSize: typography.body + 1, fontWeight: '600', lineHeight: 22 },
});

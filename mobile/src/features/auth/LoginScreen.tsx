import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInput as TextInputType,
} from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { EyeIcon } from '@/components/ui/EyeIcon';
import { LockIcon, MailIcon } from '@/components/ui/FieldIcons';
import { Input } from '@/components/ui/Input';
import { AuthBackground } from '@/components/ui/AuthBackground';
import { PenguinLogo } from '@/components/ui/PenguinLogo';
import { useSession } from '@/features/auth/SessionProvider';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { fonts, spacing, typography, type ColorPalette } from '@/theme';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';

type FieldErrors = {
  email?: string;
  password?: string;
};

export default function LoginScreen() {
  const emailInput = useRef<TextInputType>(null);
  const passwordInput = useRef<TextInputType>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState('');
  const { busy, canRetryRestore, clearError, error, retryRestore, signIn } = useSession();
  const { t, localize } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  function updateEmail(value: string) {
    setEmail(value);
    setErrors((current) => ({ ...current, email: undefined }));
    setNotice('');
    clearError();
  }

  function updatePassword(value: string) {
    setPassword(value);
    setErrors((current) => ({ ...current, password: undefined }));
    setNotice('');
    clearError();
  }

  async function submit() {
    if (busy) return;

    const nextErrors: FieldErrors = {};
    const normalizedEmail = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = t('auth.validEmail');
    }

    if (password.length === 0) {
      nextErrors.password = t('auth.requiredPassword');
    }

    setErrors(nextErrors);
    setNotice('');

    if (Object.keys(nextErrors).length > 0) {
      if (nextErrors.email) {
        emailInput.current?.focus();
      } else if (nextErrors.password) {
        passwordInput.current?.focus();
      }
      return;
    }

    const submittedEmail = normalizedEmail;
    setPassword('');
    await signIn(submittedEmail, password);
  }

  return (
    <AuthBackground>
      <View style={styles.topBar} />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.page}>
            <View style={styles.content}>
              <View style={styles.brand}>
                <PenguinLogo size={58} />
                <View style={styles.brandText}>
                  <Text style={styles.brandName}>PIPLUP</Text>
                  <Text style={styles.tagline}>{t('auth.tagline')}</Text>
                </View>
              </View>

              <Text style={styles.eyebrow}>{t('auth.eyebrow')}</Text>
              <Text style={styles.title}>{t('auth.welcome')}</Text>
              <Text style={styles.description}>{t('auth.loginDescription')}</Text>

              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.label}>{t('common.email')}</Text>
                  <View style={styles.passwordRow}>
                  <View pointerEvents="none" style={styles.fieldIcon}>
                    <MailIcon color={colors.textSecondary} />
                  </View>
                  <Input
                    ref={emailInput}
                    style={styles.iconInput}
                    accessibilityLabel={t('common.email')}
                    accessibilityHint={errors.email ? localize(errors.email) : undefined}
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    editable={!busy}
                    invalid={Boolean(errors.email)}
                    keyboardType="email-address"
                    onChangeText={updateEmail}
                    onSubmitEditing={() => passwordInput.current?.focus()}
                    placeholder={t('auth.emailPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="next"
                    textContentType="emailAddress"
                    value={email}
                  />
                  </View>
                  {errors.email ? (
                    <Text accessibilityLiveRegion="polite" style={styles.error}>
                      {localize(errors.email)}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{t('common.password')}</Text>
                  <View style={styles.passwordRow}>
                    <View pointerEvents="none" style={styles.fieldIcon}>
                      <LockIcon color={colors.textSecondary} />
                    </View>
                    <Input
                      ref={passwordInput}
                      accessibilityLabel={t('common.password')}
                      accessibilityHint={errors.password ? localize(errors.password) : undefined}
                      autoCapitalize="none"
                      autoComplete="current-password"
                      autoCorrect={false}
                      editable={!busy}
                      invalid={Boolean(errors.password)}
                      onChangeText={updatePassword}
                      onSubmitEditing={submit}
                      placeholder={t('auth.passwordPlaceholder')}
                      placeholderTextColor={colors.textSecondary}
                      returnKeyType="done"
                      secureTextEntry={!showPassword}
                      style={styles.passwordInput}
                      textContentType="password"
                      value={password}
                    />
                    <Pressable
                      accessibilityLabel={showPassword ? `${t('common.hide')} ${t('common.password').toLocaleLowerCase()}` : `${t('common.show')} ${t('common.password').toLocaleLowerCase()}`}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: busy, expanded: showPassword }}
                      disabled={busy}
                      hitSlop={8}
                      onPress={() => setShowPassword((current) => !current)}
                      style={styles.passwordToggle}
                    >
                      <EyeIcon color={colors.textSecondary} slashed={showPassword} />
                    </Pressable>
                  </View>
                  {errors.password ? (
                    <Text accessibilityLiveRegion="polite" style={styles.error}>
                      {localize(errors.password)}
                    </Text>
                  ) : null}
                </View>
              </View>

              {notice ? (
                <Text accessibilityLiveRegion="polite" style={styles.notice}>
                  {notice}
                </Text>
              ) : null}

              {error ? (
                <Text accessibilityLiveRegion="polite" style={styles.notice}>
                  {localize(error)}
                </Text>
              ) : null}

              <Button
                label={busy ? t('auth.signingIn') : t('auth.signIn')}
                variant="solid"
                loading={busy}
                disabled={busy}
                onPress={submit}
                style={styles.submitButton}
              />

              {canRetryRestore ? (
                <Button label={t('auth.retryConnection')} disabled={busy} onPress={() => void retryRestore()} />
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={busy}
                hitSlop={12}
                onPress={() => router.push('/register')}
                style={[styles.linkButton, styles.registerButton]}
              >
                <Text style={styles.registerQuestion}>
                  {t('auth.registerQuestion')} <Text style={styles.registerText}>{t('auth.registerAction')}</Text>
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                hitSlop={12}
                onPress={() => router.push('/forgot-password')}
                style={[styles.linkButton, styles.forgotButton]}
              >
                <Text style={styles.forgotText}>{t('auth.forgot')}</Text>
              </Pressable>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthBackground>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  topBar: { height: 4, backgroundColor: colors.accent },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  page: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  content: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brandText: { flexShrink: 1 },
  brandName: { color: colors.textPrimary, fontSize: 26, fontFamily: fonts.title, letterSpacing: 4 },
  tagline: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: typography.label,
    lineHeight: typography.label + spacing.xs,
  },
  eyebrow: {
    marginTop: spacing.xxl,
    color: colors.accentText,
    fontSize: typography.label,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  title: {
    marginTop: spacing.sm,
    color: colors.textPrimary,
    fontSize: 40,
    lineHeight: 42,
    fontFamily: fonts.title,
    letterSpacing: -1,
  },
  description: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: typography.input,
    lineHeight: typography.input + spacing.sm,
  },
  form: { marginTop: spacing.xl, gap: spacing.md },
  field: { gap: spacing.sm },
  passwordRow: { justifyContent: 'center' },
  iconInput: { paddingLeft: 48 },
  passwordInput: { paddingLeft: 48, paddingRight: 52 },
  fieldIcon: { position: 'absolute', left: 16, top: 0, bottom: 0, zIndex: 1, justifyContent: 'center' },
  passwordToggle: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 48,
  },
  label: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '700' },
  error: { color: colors.accentText, fontSize: typography.label },
  notice: {
    marginTop: spacing.md,
    color: colors.accentText,
    fontSize: typography.label,
    lineHeight: typography.label + spacing.xs,
  },
  submitButton: { marginTop: spacing.xl, alignSelf: 'center', minWidth: 220 },
  linkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  forgotButton: { paddingTop: 0 },
  forgotText: { color: colors.textSecondary, fontSize: typography.label, borderBottomWidth: 1, borderBottomColor: colors.textMuted },
  registerButton: { marginTop: spacing.xs, paddingBottom: 0 },
  registerQuestion: { color: colors.textSecondary, fontSize: 13 },
  registerText: { color: colors.accentText, fontWeight: '700' },
});

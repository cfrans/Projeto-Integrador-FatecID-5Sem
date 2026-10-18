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
import { Baloo2_800ExtraBold, useFonts } from '@expo-google-fonts/baloo-2';
import { router } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthBackground } from '@/components/ui/AuthBackground';
import { PenguinLogo } from '@/components/ui/PenguinLogo';
import { useSession } from '@/features/auth/SessionProvider';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { spacing, typography, type ColorPalette } from '@/theme';
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
  const [fontsLoaded] = useFonts({ Baloo2_800ExtraBold });
  const { busy, canRetryRestore, clearError, error, retryRestore, signIn } = useSession();
  const { t } = useLanguage();
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
                  <Text style={[styles.brandName, fontsLoaded && styles.brandNameRounded]}>piplup</Text>
                  <View style={styles.brandUnderline} />
                  <Text style={styles.tagline}>{t('auth.tagline')}</Text>
                </View>
              </View>

              <Text style={styles.title}>{t('auth.welcome')}</Text>
              <Text style={styles.description}>{t('auth.loginDescription')}</Text>

              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.label}>{t('common.email')}</Text>
                  <Input
                    ref={emailInput}
                    accessibilityLabel={t('common.email')}
                    accessibilityHint={errors.email}
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
                  {errors.email ? (
                    <Text accessibilityLiveRegion="polite" style={styles.error}>
                      {errors.email}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{t('common.password')}</Text>
                  <View style={styles.passwordRow}>
                    <Input
                      ref={passwordInput}
                      accessibilityLabel={t('common.password')}
                      accessibilityHint={errors.password}
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
                      <Text style={styles.passwordToggleText}>{showPassword ? t('common.hide') : t('common.show')}</Text>
                    </Pressable>
                  </View>
                  {errors.password ? (
                    <Text accessibilityLiveRegion="polite" style={styles.error}>
                      {errors.password}
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
                  {error}
                </Text>
              ) : null}

              <Button
                label={busy ? t('auth.signingIn') : t('auth.signIn')}
                variant="solid"
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
                <Text style={styles.registerText}>{t('auth.registerPrompt')}</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                hitSlop={12}
                onPress={() => setNotice(t('auth.forgotUnavailable'))}
                style={styles.linkButton}
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
  brandName: { color: colors.textPrimary, fontSize: typography.brand, fontWeight: '600', textTransform: 'uppercase' },
  brandNameRounded: {
    fontFamily: 'Baloo2_800ExtraBold',
    fontSize: typography.brand + spacing.md,
    fontWeight: 'normal',
    includeFontPadding: false,
    lineHeight: typography.brand + spacing.md,
    marginBottom: -spacing.xs,
  },
  brandUnderline: {
    width: 26,
    height: 2,
    marginTop: spacing.xs,
    backgroundColor: colors.accent,
  },
  tagline: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: typography.label,
    lineHeight: typography.label + spacing.xs,
  },
  title: {
    marginTop: spacing.xxl,
    color: colors.textPrimary,
    fontSize: typography.title - spacing.xs,
    lineHeight: typography.title,
    fontWeight: '500',
  },
  description: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: typography.body + spacing.sm,
    maxWidth: 320,
  },
  form: { marginTop: spacing.xl, gap: spacing.md },
  field: { gap: spacing.sm },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1 },
  passwordToggle: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  passwordToggleText: { color: colors.accentText, fontSize: typography.label },
  label: { color: colors.textSecondary, fontSize: typography.label },
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
  forgotText: { color: colors.textSecondary, fontSize: typography.label },
  registerButton: { marginTop: spacing.xs },
  registerText: { color: colors.accentText, fontSize: typography.label },
});

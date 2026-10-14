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
import { colors, spacing, typography } from '@/theme';

type FieldErrors = {
  email?: string;
  password?: string;
};

const TAGLINE = 'Parental Insight Platform for Lux User Protection';

export default function LoginScreen() {
  const emailInput = useRef<TextInputType>(null);
  const passwordInput = useRef<TextInputType>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState('');
  const [fontsLoaded] = useFonts({ Baloo2_800ExtraBold });
  const { busy, canRetryRestore, clearError, error, retryRestore, signIn } = useSession();

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
      nextErrors.email = 'Informe um e-mail válido.';
    }

    if (password.length === 0) {
      nextErrors.password = 'Informe sua senha.';
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
                  <Text style={styles.tagline}>{TAGLINE}</Text>
                </View>
              </View>

              <Text style={styles.title}>Bem-vindo de volta</Text>
              <Text style={styles.description}>
                Entre com sua conta de responsável para gerenciar os computadores da família.
              </Text>

              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.label}>E-mail</Text>
                  <Input
                    ref={emailInput}
                    accessibilityLabel="E-mail"
                    accessibilityHint={errors.email}
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    editable={!busy}
                    invalid={Boolean(errors.email)}
                    keyboardType="email-address"
                    onChangeText={updateEmail}
                    onSubmitEditing={() => passwordInput.current?.focus()}
                    placeholder="responsavel@email.com"
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
                  <Text style={styles.label}>Senha</Text>
                  <Input
                    ref={passwordInput}
                    accessibilityLabel="Senha"
                    accessibilityHint={errors.password}
                    autoCapitalize="none"
                    autoComplete="current-password"
                    autoCorrect={false}
                    editable={!busy}
                    invalid={Boolean(errors.password)}
                    onChangeText={updatePassword}
                    onSubmitEditing={submit}
                    placeholder="Digite sua senha"
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="done"
                    secureTextEntry
                    textContentType="password"
                    value={password}
                  />
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
                label={busy ? 'Entrando…' : 'Entrar'}
                variant="solid"
                disabled={busy}
                onPress={submit}
                style={styles.submitButton}
              />

              {canRetryRestore ? (
                <Button label="Tentar conexão novamente" disabled={busy} onPress={() => void retryRestore()} />
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={busy}
                hitSlop={12}
                onPress={() => router.push('/register')}
                style={[styles.linkButton, styles.registerButton]}
              >
                <Text style={styles.registerText}>Não tem conta? Cadastre-se</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                hitSlop={12}
                onPress={() => setNotice('Recuperação de senha indisponível no momento.')}
                style={styles.linkButton}
              >
                <Text style={styles.forgotText}>Esqueci minha senha</Text>
              </Pressable>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
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

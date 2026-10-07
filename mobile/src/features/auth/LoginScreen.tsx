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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors, radius, spacing, typography } from '@/theme';

type FieldErrors = {
  email?: string;
  password?: string;
};

export default function LoginScreen() {
  const emailInput = useRef<TextInputType>(null);
  const passwordInput = useRef<TextInputType>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState('');

  function updateEmail(value: string) {
    setEmail(value);
    setErrors((current) => ({ ...current, email: undefined }));
    setNotice('');
  }

  function updatePassword(value: string) {
    setPassword(value);
    setErrors((current) => ({ ...current, password: undefined }));
    setNotice('');
  }

  function submit() {
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

    router.replace('/home');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
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
                <View style={styles.brandMark}>
                  <Text style={styles.brandMarkText}>p</Text>
                </View>
                <View>
                  <Text style={styles.brandName}>piplup</Text>
                  <View style={styles.brandUnderline} />
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

              <Button label="Entrar" onPress={submit} style={styles.submitButton} />

              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setNotice('Recuperação de senha indisponível na demonstração.')}
                style={styles.forgotButton}
              >
                <Text style={styles.forgotText}>Esqueci minha senha</Text>
              </Pressable>
            </View>

            <View style={styles.demoNotice}>
              <View style={styles.demoDot} />
              <Text style={styles.demoText}>
                Modo demonstração. Use dados fictícios; as credenciais não são conferidas nem enviadas.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
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
  brandMark: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { color: colors.accentText, fontSize: typography.title, fontWeight: '600' },
  brandName: { color: colors.textPrimary, fontSize: typography.brand, fontWeight: '600' },
  brandUnderline: {
    width: 26,
    height: 2,
    marginTop: spacing.xs,
    backgroundColor: colors.accent,
  },
  title: {
    marginTop: spacing.xxl,
    color: colors.textPrimary,
    fontSize: typography.title,
    lineHeight: typography.title + spacing.xs,
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
  submitButton: { marginTop: spacing.lg },
  forgotButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  forgotText: { color: colors.textSecondary, fontSize: typography.label },
  demoNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
  },
  demoDot: {
    width: spacing.sm,
    height: spacing.sm,
    marginTop: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  demoText: {
    flexShrink: 1,
    color: colors.textSecondary,
    fontSize: typography.label,
    lineHeight: typography.label + spacing.xs,
    textAlign: 'center',
  },
});

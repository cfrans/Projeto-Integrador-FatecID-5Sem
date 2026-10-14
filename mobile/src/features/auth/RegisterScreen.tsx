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
import { AuthBackground } from '@/components/ui/AuthBackground';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors, spacing, typography } from '@/theme';

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterScreen() {
  const emailInput = useRef<TextInputType>(null);
  const passwordInput = useRef<TextInputType>(null);
  const confirmInput = useRef<TextInputType>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState(false);

  function change(field: keyof FieldErrors, setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  function submit() {
    const nextErrors: FieldErrors = {};

    if (name.trim().length === 0) {
      nextErrors.name = 'Informe seu nome.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = 'Informe um e-mail válido.';
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `A senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'As senhas não coincidem.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setPassword('');
      setConfirmPassword('');
      setDone(true);
    }
  }

  if (done) {
    return (
      <AuthBackground>
        <View style={styles.page}>
          <View style={styles.content}>
            <Text style={styles.title}>Cadastro concluído</Text>
            <Text style={styles.description}>
              Conta simulada: nenhum dado foi salvo ou enviado, pois ainda não há backend. Volte ao login para
              continuar.
            </Text>
            <Button label="Ir para o login" onPress={() => router.replace('/')} style={styles.submitButton} />
          </View>
        </View>
      </AuthBackground>
    );
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
              <Text style={styles.title}>Criar conta</Text>
              <Text style={styles.description}>
                Cadastre-se como responsável para gerenciar os computadores da família.
              </Text>

              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.label}>Nome</Text>
                  <Input
                    accessibilityLabel="Nome"
                    autoCapitalize="words"
                    autoComplete="name"
                    invalid={Boolean(errors.name)}
                    onChangeText={change('name', setName)}
                    onSubmitEditing={() => emailInput.current?.focus()}
                    placeholder="Seu nome"
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="next"
                    textContentType="name"
                    value={name}
                  />
                  {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>E-mail</Text>
                  <Input
                    ref={emailInput}
                    accessibilityLabel="E-mail"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    invalid={Boolean(errors.email)}
                    keyboardType="email-address"
                    onChangeText={change('email', setEmail)}
                    onSubmitEditing={() => passwordInput.current?.focus()}
                    placeholder="responsavel@email.com"
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="next"
                    textContentType="emailAddress"
                    value={email}
                  />
                  {errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Senha</Text>
                  <Input
                    ref={passwordInput}
                    accessibilityLabel="Senha"
                    autoCapitalize="none"
                    autoCorrect={false}
                    invalid={Boolean(errors.password)}
                    onChangeText={change('password', setPassword)}
                    onSubmitEditing={() => confirmInput.current?.focus()}
                    placeholder="Crie uma senha"
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="next"
                    secureTextEntry
                    textContentType="newPassword"
                    value={password}
                  />
                  {errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Confirmar senha</Text>
                  <Input
                    ref={confirmInput}
                    accessibilityLabel="Confirmar senha"
                    autoCapitalize="none"
                    autoCorrect={false}
                    invalid={Boolean(errors.confirmPassword)}
                    onChangeText={change('confirmPassword', setConfirmPassword)}
                    onSubmitEditing={submit}
                    placeholder="Repita a senha"
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="done"
                    secureTextEntry
                    textContentType="newPassword"
                    value={confirmPassword}
                  />
                  {errors.confirmPassword ? <Text style={styles.error}>{errors.confirmPassword}</Text> : null}
                </View>
              </View>

              <Button label="Cadastrar" variant="solid" onPress={submit} style={styles.submitButton} />

              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => router.back()}
                style={styles.linkButton}
              >
                <Text style={styles.linkText}>Já tenho conta</Text>
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
    paddingVertical: spacing.xl,
  },
  content: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  title: {
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
  submitButton: { marginTop: spacing.xl, alignSelf: 'center', minWidth: 220 },
  linkButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  linkText: { color: colors.textSecondary, fontSize: typography.label },
});

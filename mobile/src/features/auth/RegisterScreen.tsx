import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
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
import { radius, spacing, typography, type ColorPalette } from '@/theme';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';

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
  const { t, localize } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  function change(field: keyof FieldErrors, setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  function submit() {
    const nextErrors: FieldErrors = {};

    if (name.trim().length === 0) {
      nextErrors.name = t('auth.namePlaceholder');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = t('auth.validEmail');
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = t('auth.passwordMin', { count: MIN_PASSWORD_LENGTH });
    }
    if (confirmPassword !== password) {
      nextErrors.confirmPassword = t('auth.passwordMismatch');
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setPassword('');
      setConfirmPassword('');
      setDone(true);
    }
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
              <Text style={styles.title}>{t('auth.createAccount')}</Text>
              <Text style={styles.description}>{t('auth.registerDescription')}</Text>

              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.label}>{t('common.name')}</Text>
                  <Input
                    accessibilityLabel={t('common.name')}
                    autoCapitalize="words"
                    autoComplete="name"
                    invalid={Boolean(errors.name)}
                    onChangeText={change('name', setName)}
                    onSubmitEditing={() => emailInput.current?.focus()}
                    placeholder={t('auth.namePlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="next"
                    textContentType="name"
                    value={name}
                  />
                  {errors.name ? <Text style={styles.error}>{localize(errors.name)}</Text> : null}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{t('common.email')}</Text>
                  <Input
                    ref={emailInput}
                    accessibilityLabel={t('common.email')}
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    invalid={Boolean(errors.email)}
                    keyboardType="email-address"
                    onChangeText={change('email', setEmail)}
                    onSubmitEditing={() => passwordInput.current?.focus()}
                    placeholder={t('auth.emailPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="next"
                    textContentType="emailAddress"
                    value={email}
                  />
                  {errors.email ? <Text style={styles.error}>{localize(errors.email)}</Text> : null}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{t('common.password')}</Text>
                  <Input
                    ref={passwordInput}
                    accessibilityLabel={t('common.password')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    invalid={Boolean(errors.password)}
                    onChangeText={change('password', setPassword)}
                    onSubmitEditing={() => confirmInput.current?.focus()}
                    placeholder={t('auth.createPassword')}
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="next"
                    secureTextEntry
                    textContentType="newPassword"
                    value={password}
                  />
                  {errors.password ? <Text style={styles.error}>{localize(errors.password)}</Text> : null}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{t('auth.confirmPassword')}</Text>
                  <Input
                    ref={confirmInput}
                    accessibilityLabel={t('auth.confirmPassword')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    invalid={Boolean(errors.confirmPassword)}
                    onChangeText={change('confirmPassword', setConfirmPassword)}
                    onSubmitEditing={submit}
                    placeholder={t('auth.confirmPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="done"
                    secureTextEntry
                    textContentType="newPassword"
                    value={confirmPassword}
                  />
                  {errors.confirmPassword ? <Text style={styles.error}>{localize(errors.confirmPassword)}</Text> : null}
                </View>
              </View>

              <Button label={t('auth.createAccount')} variant="solid" onPress={submit} style={styles.submitButton} />

              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => router.back()}
                style={styles.linkButton}
              >
                <Text style={styles.linkText}>{t('auth.haveAccount')}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={done} transparent animationType="fade" onRequestClose={() => router.replace('/')}>
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.dialog}>
            <Text accessibilityRole="header" style={styles.dialogTitle}>{t('auth.completed')}</Text>
            <Text style={styles.dialogText}>{t('auth.completedDescription')}</Text>
            <Button label={t('auth.goLogin')} variant="solid" onPress={() => router.replace('/')} style={styles.dialogButton} />
          </View>
        </View>
      </Modal>
    </AuthBackground>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)', flex: 1, justifyContent: 'center', padding: spacing.xl },
  dialog: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.md, maxWidth: 380, padding: spacing.xl, width: '100%' },
  dialogTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  dialogText: { color: colors.textSecondary, fontSize: typography.body, lineHeight: typography.body + spacing.sm },
  dialogButton: { alignSelf: 'stretch', marginTop: spacing.sm },
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

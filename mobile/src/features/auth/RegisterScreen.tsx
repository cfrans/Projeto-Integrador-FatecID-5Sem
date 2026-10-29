import { useRef, useState, type ReactNode } from 'react';
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
import { EyeIcon } from '@/components/ui/EyeIcon';
import { CheckIcon, LockIcon, MailIcon, UserIcon } from '@/components/ui/FieldIcons';
import { Input } from '@/components/ui/Input';
import { PenguinLogo } from '@/components/ui/PenguinLogo';
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
const STRENGTH_LEVELS = [0, 1, 2, 3];

function passwordStrength(value: string) {
  return [
    value.length >= MIN_PASSWORD_LENGTH,
    /[a-z]/.test(value) && /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;
}

export default function RegisterScreen() {
  const emailInput = useRef<TextInputType>(null);
  const passwordInput = useRef<TextInputType>(null);
  const confirmInput = useRef<TextInputType>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState(false);
  const { t, localize } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const strength = passwordStrength(password);

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

  function field(icon: ReactNode) {
    return (
      <View pointerEvents="none" style={styles.fieldIcon}>
        {icon}
      </View>
    );
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
              <View style={styles.header}>
                <View style={styles.brand}>
                  <PenguinLogo size={36} />
                  <Text style={styles.brandName}>PIPLUP</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={12}
                  onPress={() => router.back()}
                  style={styles.backButton}
                >
                  <Text style={styles.backText}>← {t('auth.back')}</Text>
                </Pressable>
              </View>

              <Text style={styles.eyebrow}>{t('auth.registerEyebrow')}</Text>
              <Text style={styles.title}>{t('auth.registerTitle')}</Text>
              <Text style={styles.description}>{t('auth.registerDescription')}</Text>

              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.label}>{t('common.name')}</Text>
                  <View style={styles.inputRow}>
                    {field(<UserIcon color={colors.textSecondary} />)}
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
                      style={styles.iconInput}
                      textContentType="name"
                      value={name}
                    />
                  </View>
                  {errors.name ? <Text style={styles.error}>{localize(errors.name)}</Text> : null}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{t('common.email')}</Text>
                  <View style={styles.inputRow}>
                    {field(<MailIcon color={colors.textSecondary} />)}
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
                      style={styles.iconInput}
                      textContentType="emailAddress"
                      value={email}
                    />
                  </View>
                  {errors.email ? <Text style={styles.error}>{localize(errors.email)}</Text> : null}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{t('common.password')}</Text>
                  <View style={styles.inputRow}>
                    {field(<LockIcon color={colors.textSecondary} />)}
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
                      secureTextEntry={!showPassword}
                      style={styles.passwordInput}
                      textContentType="newPassword"
                      value={password}
                    />
                    <Pressable
                      accessibilityLabel={`${t(showPassword ? 'common.hide' : 'common.show')} ${t('common.password').toLocaleLowerCase()}`}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: showPassword }}
                      hitSlop={8}
                      onPress={() => setShowPassword((current) => !current)}
                      style={styles.passwordToggle}
                    >
                      <EyeIcon color={colors.textSecondary} slashed={showPassword} />
                    </Pressable>
                  </View>
                  <View style={styles.strengthRow}>
                    <View style={styles.strengthBars}>
                      {STRENGTH_LEVELS.map((level) => (
                        <View key={level} style={[styles.strengthBar, level < strength && styles.strengthBarFilled]} />
                      ))}
                    </View>
                    <Text style={styles.hint}>{t('auth.passwordHint', { count: MIN_PASSWORD_LENGTH })}</Text>
                  </View>
                  {errors.password ? <Text style={styles.error}>{localize(errors.password)}</Text> : null}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{t('auth.confirmPassword')}</Text>
                  <View style={styles.inputRow}>
                    {field(<CheckIcon color={colors.textSecondary} />)}
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
                      secureTextEntry={!showPassword}
                      style={styles.iconInput}
                      textContentType="newPassword"
                      value={confirmPassword}
                    />
                  </View>
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
                <Text style={styles.linkText}>
                  {t('auth.haveAccountQuestion')} <Text style={styles.linkAction}>{t('auth.signIn')}</Text>
                </Text>
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
  topBar: { height: 4, backgroundColor: colors.accent },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  page: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  content: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  brand: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  brandName: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', letterSpacing: 3 },
  backButton: { minHeight: 44, justifyContent: 'center' },
  backText: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '500' },
  eyebrow: {
    marginTop: spacing.xl,
    color: colors.accentText,
    fontSize: typography.label,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  title: {
    marginTop: spacing.sm,
    color: colors.textPrimary,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '800',
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
  label: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '700' },
  inputRow: { justifyContent: 'center' },
  fieldIcon: { position: 'absolute', left: 16, top: 0, bottom: 0, zIndex: 1, justifyContent: 'center' },
  iconInput: { paddingLeft: 48 },
  passwordInput: { paddingLeft: 48, paddingRight: 52 },
  passwordToggle: { alignItems: 'center', bottom: 0, justifyContent: 'center', position: 'absolute', right: 0, top: 0, width: 48 },
  strengthRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  strengthBars: { flex: 1, flexDirection: 'row', gap: spacing.xs + 2 },
  strengthBar: { backgroundColor: colors.border, borderRadius: 2, flex: 1, height: 3 },
  strengthBarFilled: { backgroundColor: colors.accent },
  hint: { color: colors.textSecondary, fontSize: typography.label },
  error: { color: colors.accentText, fontSize: typography.label },
  submitButton: { marginTop: spacing.xl, alignSelf: 'center', minWidth: 220 },
  linkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
  },
  linkText: { color: colors.textSecondary, fontSize: 13 },
  linkAction: { color: colors.accentText, fontWeight: '700' },
});

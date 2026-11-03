import { useEffect, useState, type ReactNode } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { LockIcon, MailIcon } from '@/components/ui/FieldIcons';
import { Input } from '@/components/ui/Input';
import { BedtimePicker } from './BedtimePicker';
import { useSession } from '@/features/auth/SessionProvider';
import { MIN_ANSWER_LENGTH, MIN_QUESTION_LENGTH, normalizeAnswer } from '@/features/auth/security-question-store';
import { auth } from '@/features/auth/services/auth';
import { formatBedtime, parseBedtime, setBedtime, useBedtimeState, reloadBedtime } from '@/features/settings/bedtime';
import { useLanguage, type Language } from '@/features/i18n/LanguageProvider';
import { apiErrorMessage } from '@/lib/api';
import { radius, spacing, typography, type ColorPalette } from '@/theme';
import { useTheme, useThemedStyles, type ThemePreference } from '@/features/theme/ThemeProvider';
import { interfaceImages } from '@/lib/image-assets';

const MIN_PASSWORD_LENGTH = 8;

type Section = 'email' | 'password' | 'security' | 'bedtime';

const securityQuestionOptions = [
  'settings.securityQ1',
  'settings.securityQ2',
  'settings.securityQ3',
  'settings.securityQ4',
  'settings.securityQ5',
  'settings.securityQ6',
  'settings.securityQ7',
  'settings.securityQ8',
] as const;

const themeIcons ={ system: interfaceImages.system, light: interfaceImages.light, dark: interfaceImages.dark };

export function SettingsScreen() {
  const { language, setLanguage, t, localize } = useLanguage();
  const { guardian, updateGuardian } = useSession();
  const { colors, preference, setPreference } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState<Section | null>(null);
  const [busySection, setBusySection] = useState<Section | null>(null);
  const [notice, setNotice] = useState<{ section: Section; text: string } | null>(null);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [savedQuestion, setSavedQuestion] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [questionMenuOpen, setQuestionMenuOpen] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [securityErrors, setSecurityErrors] = useState<{ question?: string; answer?: string }>({});
  const bedtimeState = useBedtimeState();
  const bedtime = bedtimeState.value;
  const [bedtimeText, setBedtimeText] = useState(() => formatBedtime(bedtime));
  const [bedtimeError, setBedtimeError] = useState('');

  function reset(section: Section) {
    if (section === 'email') {
      setEmail('');
      setEmailError('');
    } else if (section === 'password') {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordErrors({});
    } else if (section === 'security') {
      setQuestionText(savedQuestion ?? '');
      setQuestionMenuOpen(false);
      setAnswerText('');
      setSecurityErrors({});
    } else {
      setBedtimeText(formatBedtime(bedtime));
      setBedtimeError('');
    }
  }

  useEffect(() => {
    let active = true;
    if (!guardian?.id) return;
    auth.getSecurityQuestion()
      .then((question) => {
        if (!active) return;
        setSavedQuestion(question);
        setQuestionText(question ?? '');
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [guardian?.id]);

  async function saveSecurity() {
    if (busySection) return;
    const errors: { question?: string; answer?: string } = {};
    if (questionText.trim().length < MIN_QUESTION_LENGTH) errors.question = t('settings.securityQuestionMin', { count: MIN_QUESTION_LENGTH });
    if (normalizeAnswer(answerText).length < MIN_ANSWER_LENGTH) errors.answer = t('settings.securityAnswerMin', { count: MIN_ANSWER_LENGTH });
    setSecurityErrors(errors);
    if (Object.keys(errors).length > 0 || !guardian?.id) return;

    setBusySection('security');
    try {
      const saved = await auth.setSecurityQuestion(questionText.trim(), answerText);
      setSavedQuestion(saved);
      setAnswerText('');
      finish('security', t('settings.securitySaved'));
    } catch (error) {
      setSecurityErrors({ answer: localize(apiErrorMessage(error)) });
    } finally {
      setBusySection(null);
    }
  }

  function cancel(section: Section) {
    reset(section);
    setOpen(null);
  }

  function toggle(section: Section) {
    setNotice(null);
    if (open === section) {
      cancel(section);
      return;
    }
    if (open) reset(open);
    reset(section);
    setOpen(section);
  }

  function finish(section: Section, text: string) {
    setOpen(null);
    setNotice({ section, text });
  }

  async function saveBedtime() {
    const parsed = parseBedtime(bedtimeText);
    if (!parsed) {
      setBedtimeError(t('settings.bedtimeInvalid'));
      return;
    }
    if (!(await setBedtime(parsed))) {
      setBedtimeError(t('settings.bedtimeSaveError'));
      return;
    }
    setBedtimeText(formatBedtime(parsed));
    setBedtimeError('');
    finish('bedtime', t('settings.bedtimeSaved'));
  }

  async function saveEmail() {
    if (busySection) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError(t('auth.validEmail'));
      return;
    }

    setBusySection('email');
    try {
      const updated = await auth.updateEmail(email.trim());
      await updateGuardian(updated);
      reset('email');
      finish('email', t('settings.emailSaved'));
    } catch (error) {
      setEmailError(localize(apiErrorMessage(error)));
    } finally {
      setBusySection(null);
    }
  }

  async function savePassword() {
    if (busySection) return;
    const errors: { current?: string; next?: string; confirm?: string } = {};
    if (currentPassword.length === 0) errors.current = t('auth.requiredPassword');
    if (newPassword.length < MIN_PASSWORD_LENGTH) errors.next = t('auth.passwordMin', { count: MIN_PASSWORD_LENGTH });
    if (confirmPassword !== newPassword) errors.confirm = t('auth.passwordMismatch');
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setBusySection('password');
    try {
      await auth.updatePassword(currentPassword, newPassword);
      reset('password');
      finish('password', t('settings.passwordSaved'));
    } catch (error) {
      setPasswordErrors({ current: localize(apiErrorMessage(error)) });
    } finally {
      setBusySection(null);
    }
  }

  const rowProps = (section: Section) => ({
    open: open === section,
    notice: notice?.section === section ? notice.text : '',
    onToggle: () => toggle(section),
    styles,
    t,
  });

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.main}>
            <Text style={styles.sectionLabel}>{t('settings.account')}</Text>
            <View style={styles.card}>
              <SettingRow
                icon={<MailIcon color={colors.textSecondary} />}
                label={t('settings.email')}
                value={guardian?.email ?? '—'}
                {...rowProps('email')}
              >
                <View style={styles.field}>
                  <Text style={styles.label}>{t('settings.newEmail')}</Text>
                  <Input
                    accessibilityLabel={t('settings.newEmail')}
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    invalid={Boolean(emailError)}
                    keyboardType="email-address"
                    onChangeText={(value) => { setEmail(value); setEmailError(''); }}
                    placeholder={t('auth.emailPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={email}
                  />
                  {emailError ? <Text style={styles.error}>{emailError}</Text> : null}
                </View>
                <FormActions saveLabel={t('settings.saveEmail')} disabled={busySection === 'email'} onCancel={() => cancel('email')} onSave={() => void saveEmail()} styles={styles} t={t} />
              </SettingRow>

              <View style={styles.rowDivider} />

              <SettingRow
                icon={<LockIcon color={colors.textSecondary} />}
                label={t('settings.password')}
                value="••••••••"
                {...rowProps('password')}
              >
                <View style={styles.field}>
                  <Text style={styles.label}>{t('settings.currentPassword')}</Text>
                  <Input
                    accessibilityLabel={t('settings.currentPassword')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    invalid={Boolean(passwordErrors.current)}
                    onChangeText={(value) => { setCurrentPassword(value); setPasswordErrors((c) => ({ ...c, current: undefined })); }}
                    secureTextEntry
                    value={currentPassword}
                  />
                  {passwordErrors.current ? <Text style={styles.error}>{passwordErrors.current}</Text> : null}
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>{t('settings.newPassword')}</Text>
                  <Input
                    accessibilityLabel={t('settings.newPassword')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    invalid={Boolean(passwordErrors.next)}
                    onChangeText={(value) => { setNewPassword(value); setPasswordErrors((c) => ({ ...c, next: undefined })); }}
                    placeholder={t('auth.passwordHint', { count: MIN_PASSWORD_LENGTH })}
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                    value={newPassword}
                  />
                  {passwordErrors.next ? <Text style={styles.error}>{passwordErrors.next}</Text> : null}
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>{t('auth.confirmPassword')}</Text>
                  <Input
                    accessibilityLabel={t('auth.confirmPassword')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    invalid={Boolean(passwordErrors.confirm)}
                    onChangeText={(value) => { setConfirmPassword(value); setPasswordErrors((c) => ({ ...c, confirm: undefined })); }}
                    secureTextEntry
                    value={confirmPassword}
                  />
                  {passwordErrors.confirm ? <Text style={styles.error}>{passwordErrors.confirm}</Text> : null}
                </View>
                <FormActions saveLabel={t('settings.savePassword')} disabled={busySection === 'password'} onCancel={() => cancel('password')} onSave={() => void savePassword()} styles={styles} t={t} />
              </SettingRow>

              <View style={styles.rowDivider} />

              <SettingRow
                icon={<Text style={styles.rowGlyph}>?</Text>}
                label={t('settings.securityQuestion')}
                value={savedQuestion ?? t('settings.securityNotSet')}
                {...rowProps('security')}
              >
                <Text style={styles.hint}>{t('settings.securityHint')}</Text>
                <View style={styles.field}>
                  <Text style={styles.label}>{t('settings.securityQuestionLabel')}</Text>
                  <Pressable
                    accessibilityLabel={t('settings.securityQuestionLabel')}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: questionMenuOpen }}
                    onPress={() => setQuestionMenuOpen((current) => !current)}
                    style={[styles.select, securityErrors.question ? styles.selectInvalid : null]}
                  >
                    <Text style={[styles.selectText, !questionText && styles.selectPlaceholder]} numberOfLines={2}>
                      {questionText || t('settings.securityQuestionPlaceholder')}
                    </Text>
                    <Text style={styles.selectChevron}>{questionMenuOpen ? '▲' : '▼'}</Text>
                  </Pressable>
                  {questionMenuOpen ? (
                    <View style={styles.selectMenu}>
                      {securityQuestionOptions.map((key) => {
                        const label = t(key);
                        const selected = label === questionText;
                        return (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            key={key}
                            onPress={() => {
                              setQuestionText(label);
                              setQuestionMenuOpen(false);
                              setSecurityErrors((c) => ({ ...c, question: undefined }));
                            }}
                            style={({ pressed }) => [styles.selectItem, selected && styles.optionSelected, pressed && styles.pressed]}
                          >
                            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                  {securityErrors.question ? <Text style={styles.error}>{securityErrors.question}</Text> : null}
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>{t('settings.securityAnswerLabel')}</Text>
                  <Input
                    accessibilityLabel={t('settings.securityAnswerLabel')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    invalid={Boolean(securityErrors.answer)}
                    onChangeText={(value) => { setAnswerText(value); setSecurityErrors((c) => ({ ...c, answer: undefined })); }}
                    value={answerText}
                  />
                  {securityErrors.answer ? <Text style={styles.error}>{securityErrors.answer}</Text> : null}
                </View>
                <FormActions saveLabel={t('settings.saveSecurity')} disabled={busySection === 'security'} onCancel={() => cancel('security')} onSave={() => void saveSecurity()} styles={styles} t={t} />
              </SettingRow>
            </View>

            <Text style={styles.sectionLabel}>{t('settings.bedtime')}</Text>
            <View style={styles.card}>
              <SettingRow
                icon={<Image accessible={false} fadeDuration={0} source={themeIcons.dark} style={styles.rowImage} />}
                label={t('settings.bedtimeRow')}
                value={formatBedtime(bedtime)}
                {...rowProps('bedtime')}
              >
                <Text style={styles.hint}>{t('settings.bedtimeDescription')}</Text>
                {bedtimeState.error === 'load' ? (
                  <View style={styles.field}>
                    <Text accessibilityRole="alert" style={styles.error}>{t('settings.bedtimeLoadError')}</Text>
                    <Button label={t('common.retry')} onPress={() => void reloadBedtime()} />
                  </View>
                ) : null}
                <View style={styles.field}>
                  <Text style={styles.label}>{t('settings.bedtimeLabel')}</Text>
                  <BedtimePicker label={t('settings.bedtimeLabel')} value={bedtimeText} onChange={(value) => { setBedtimeText(value); setBedtimeError(''); }} />
                  {bedtimeError ? <Text style={styles.error}>{bedtimeError}</Text> : null}
                </View>
                <FormActions saveLabel={t('settings.saveBedtime')} onCancel={() => cancel('bedtime')} onSave={() => void saveBedtime()} disabled={bedtimeState.busy} styles={styles} t={t} />
              </SettingRow>
            </View>

            <Text style={styles.sectionLabel}>{t('language.title')}</Text>
            <View style={styles.options}>
              {(['pt-BR', 'en', 'es'] as const).map((option: Language) => (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: language === option }}
                  onPress={() => setLanguage(option)}
                  style={[styles.option, language === option && styles.optionSelected]}
                >
                  <Text style={[styles.optionText, language === option && styles.optionTextSelected]}>
                    {option === 'pt-BR' ? t('language.portuguese') : option === 'en' ? t('language.english') : t('language.spanish')}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>{t('about.theme.title')}</Text>
            <View style={styles.options}>
              {(['system', 'light', 'dark'] as const).map((option: ThemePreference) => (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: preference === option }}
                  onPress={() => setPreference(option)}
                  style={[styles.option, styles.themeOption, preference === option && styles.optionSelected]}
                >
                  <Image
                    accessible={false}
                    source={themeIcons[option]}
                    fadeDuration={0}
                    style={[styles.themeIcon, { tintColor: preference === option ? colors.textPrimary : colors.textSecondary }]}
                  />
                  <Text style={[styles.optionText, preference === option && styles.optionTextSelected]}>
                    {t(`about.theme.${option}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type RowStyles = ReturnType<typeof createStyles>;
type Translate = ReturnType<typeof useLanguage>['t'];

function SettingRow({ icon, label, value, open, notice, onToggle, children, styles, t }: {
  icon: ReactNode;
  label: string;
  value: string;
  open: boolean;
  notice: string;
  onToggle: () => void;
  children: ReactNode;
  styles: RowStyles;
  t: Translate;
}) {
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.rowIcon}>{icon}</View>
        <View style={styles.rowCopy}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text numberOfLines={1} style={styles.rowValue}>{value}</Text>
          {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={onToggle}
          style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}
        >
          <Text style={styles.rowActionText}>{t(open ? 'settings.close' : 'settings.change')}</Text>
        </Pressable>
      </View>
      {open ? <View style={styles.form}>{children}</View> : null}
    </View>
  );
}

function FormActions({ saveLabel, onCancel, onSave, disabled = false, styles, t }: {
  saveLabel: string;
  disabled?: boolean;
  onCancel: () => void;
  onSave: () => void;
  styles: RowStyles;
  t: Translate;
}) {
  return (
    <View style={styles.formActions}>
      <Pressable accessibilityRole="button" onPress={onCancel} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
        <Text style={styles.cancelText}>{t('common.cancel')}</Text>
      </Pressable>
      <Button label={saveLabel} variant="solid" disabled={disabled} onPress={onSave} />
    </View>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxl },
  main: { alignSelf: 'center', gap: spacing.md, maxWidth: 440, width: '100%' },
  sectionLabel: { color: colors.textPrimary, fontSize: typography.label, fontWeight: '700', letterSpacing: 2, marginTop: spacing.sm, textTransform: 'uppercase' },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  rowIcon: { alignItems: 'center', backgroundColor: colors.surfaceRaised, borderRadius: radius.md, height: 40, justifyContent: 'center', width: 40 },
  rowGlyph: { color: colors.textSecondary, fontSize: 18, fontWeight: '700' },
  rowImage: { height: 18, tintColor: colors.textSecondary, width: 18 },
  rowCopy: { flex: 1, gap: 2 },
  rowLabel: { color: colors.textSecondary, fontSize: typography.label },
  rowValue: { color: colors.textPrimary, fontSize: typography.body + 1, fontWeight: '700' },
  rowAction: { justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.sm },
  rowActionText: { color: colors.accentText, fontSize: typography.body, fontWeight: '700' },
  rowDivider: { backgroundColor: colors.border, height: 1, marginLeft: 40 + spacing.md * 2 },
  form: { gap: spacing.md, paddingBottom: spacing.md, paddingHorizontal: spacing.md },
  field: { gap: spacing.sm },
  label: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  hint: { color: colors.textSecondary, fontSize: typography.label, lineHeight: 18 },
  error: { color: colors.accentText, fontSize: typography.label },
  notice: { color: colors.textSecondary, fontSize: typography.label, lineHeight: 18 },
  formActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  cancel: { justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md },
  cancelText: { color: colors.textSecondary, fontSize: typography.button, fontWeight: '600' },
  pressed: { opacity: 0.72 },
  options: { flexDirection: 'row', gap: spacing.sm },
  option: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.xs,
  },
  themeOption: { gap: spacing.xs, minHeight: 64, paddingVertical: spacing.sm },
  themeIcon: { height: 20, width: 20 },
  select: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectInvalid: { borderColor: colors.accent },
  selectText: { color: colors.textPrimary, flex: 1, fontSize: typography.body },
  selectPlaceholder: { color: colors.textMuted },
  selectChevron: { color: colors.textSecondary, fontSize: 10 },
  selectMenu: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  selectItem: {
    borderColor: 'transparent',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  optionText: { color: colors.textSecondary, fontSize: typography.label },
  optionTextSelected: { color: colors.textPrimary, fontWeight: '700' },
});

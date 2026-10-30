import { useState, type ReactNode } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { LockIcon, MailIcon } from '@/components/ui/FieldIcons';
import { Input } from '@/components/ui/Input';
import { useSession } from '@/features/auth/SessionProvider';
import { formatBedtime, parseBedtime, setBedtime, useBedtime } from '@/features/settings/bedtime';
import { useLanguage, type Language } from '@/features/i18n/LanguageProvider';
import { radius, spacing, typography, type ColorPalette } from '@/theme';
import { useTheme, useThemedStyles, type ThemePreference } from '@/features/theme/ThemeProvider';

const MIN_PASSWORD_LENGTH = 8;

type Section = 'email' | 'password' | 'bedtime';

const themeIcons: Record<ThemePreference, ImageSourcePropType> = {
  system: require('../../../assets/icons/monitor.png'),
  light: require('../../../assets/icons/sun.png'),
  dark: require('../../../assets/icons/moon.png'),
};

export function SettingsScreen() {
  const { language, setLanguage, t } = useLanguage();
  const { guardian } = useSession();
  const { colors, preference, setPreference } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState<Section | null>(null);
  const [notice, setNotice] = useState<{ section: Section; text: string } | null>(null);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const bedtime = useBedtime();
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
    } else {
      setBedtimeText(formatBedtime(bedtime));
      setBedtimeError('');
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
    setOpen(section);
  }

  function finish(section: Section, text: string) {
    setOpen(null);
    setNotice({ section, text });
  }

  function saveBedtime() {
    const parsed = parseBedtime(bedtimeText);
    if (!parsed) {
      setBedtimeError(t('settings.bedtimeInvalid'));
      return;
    }
    setBedtime(parsed);
    setBedtimeText(formatBedtime(parsed));
    setBedtimeError('');
    finish('bedtime', t('settings.bedtimeSaved'));
  }

  function saveEmail() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError(t('auth.validEmail'));
      return;
    }
    reset('email');
    finish('email', t('settings.notSaved'));
  }

  function savePassword() {
    const errors: { current?: string; next?: string; confirm?: string } = {};
    if (currentPassword.length === 0) errors.current = t('auth.requiredPassword');
    if (newPassword.length < MIN_PASSWORD_LENGTH) errors.next = t('auth.passwordMin', { count: MIN_PASSWORD_LENGTH });
    if (confirmPassword !== newPassword) errors.confirm = t('auth.passwordMismatch');
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;
    reset('password');
    finish('password', t('settings.notSaved'));
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
                <FormActions saveLabel={t('settings.saveEmail')} onCancel={() => cancel('email')} onSave={saveEmail} styles={styles} t={t} />
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
                <FormActions saveLabel={t('settings.savePassword')} onCancel={() => cancel('password')} onSave={savePassword} styles={styles} t={t} />
              </SettingRow>
            </View>

            <Text style={styles.sectionLabel}>{t('settings.bedtime')}</Text>
            <View style={styles.card}>
              <SettingRow
                icon={<Image accessible={false} source={themeIcons.dark} style={styles.rowImage} />}
                label={t('settings.bedtimeRow')}
                value={formatBedtime(bedtime)}
                {...rowProps('bedtime')}
              >
                <Text style={styles.hint}>{t('settings.bedtimeDescription')}</Text>
                <View style={styles.field}>
                  <Text style={styles.label}>{t('settings.bedtimeLabel')}</Text>
                  <Input
                    accessibilityLabel={t('settings.bedtimeLabel')}
                    invalid={Boolean(bedtimeError)}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    onChangeText={(value) => { setBedtimeText(value); setBedtimeError(''); }}
                    placeholder="21:30"
                    placeholderTextColor={colors.textMuted}
                    value={bedtimeText}
                  />
                  {bedtimeError ? <Text style={styles.error}>{bedtimeError}</Text> : null}
                </View>
                <FormActions saveLabel={t('settings.saveBedtime')} onCancel={() => cancel('bedtime')} onSave={saveBedtime} styles={styles} t={t} />
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

function FormActions({ saveLabel, onCancel, onSave, styles, t }: {
  saveLabel: string;
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
      <Button label={saveLabel} variant="solid" onPress={onSave} />
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
  optionSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  optionText: { color: colors.textSecondary, fontSize: typography.label },
  optionTextSelected: { color: colors.textPrimary, fontWeight: '700' },
});

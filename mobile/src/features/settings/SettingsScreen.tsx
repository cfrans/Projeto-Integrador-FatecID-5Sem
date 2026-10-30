import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatBedtime, parseBedtime, setBedtime, useBedtime } from '@/features/settings/bedtime';
import { useLanguage, type Language } from '@/features/i18n/LanguageProvider';
import { radius, spacing, typography, type ColorPalette } from '@/theme';
import { useTheme, useThemedStyles, type ThemePreference } from '@/features/theme/ThemeProvider';

const MIN_PASSWORD_LENGTH = 8;

export function SettingsScreen() {
  const { language, setLanguage, t } = useLanguage();
  const { colors, preference, setPreference } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailNotice, setEmailNotice] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [passwordNotice, setPasswordNotice] = useState('');
  const bedtime = useBedtime();
  const [bedtimeText, setBedtimeText] = useState(() => formatBedtime(bedtime));
  const [bedtimeError, setBedtimeError] = useState('');
  const [bedtimeNotice, setBedtimeNotice] = useState('');

  function saveBedtime() {
    setBedtimeNotice('');
    const parsed = parseBedtime(bedtimeText);
    if (!parsed) {
      setBedtimeError(t('settings.bedtimeInvalid'));
      return;
    }
    setBedtimeError('');
    setBedtime(parsed);
    setBedtimeText(formatBedtime(parsed));
    setBedtimeNotice(t('settings.bedtimeSaved'));
  }

  function saveEmail() {
    setEmailNotice('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError(t('auth.validEmail'));
      return;
    }
    setEmailError('');
    setEmailNotice(t('settings.notSaved'));
  }

  function savePassword() {
    setPasswordNotice('');
    const errors: { current?: string; next?: string; confirm?: string } = {};
    if (currentPassword.length === 0) errors.current = t('auth.requiredPassword');
    if (newPassword.length < MIN_PASSWORD_LENGTH) errors.next = t('auth.passwordMin', { count: MIN_PASSWORD_LENGTH });
    if (confirmPassword !== newPassword) errors.confirm = t('auth.passwordMismatch');
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordNotice(t('settings.notSaved'));
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.main}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('settings.account')}</Text>

              <View style={styles.group}>
                <Text style={styles.groupTitle}>{t('settings.changeEmail')}</Text>
                <View style={styles.field}>
                  <Text style={styles.label}>{t('settings.newEmail')}</Text>
                  <Input
                    accessibilityLabel={t('settings.newEmail')}
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    invalid={Boolean(emailError)}
                    keyboardType="email-address"
                    onChangeText={(value) => { setEmail(value); setEmailError(''); setEmailNotice(''); }}
                    placeholder={t('auth.emailPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={email}
                  />
                  {emailError ? <Text style={styles.error}>{emailError}</Text> : null}
                </View>
                {emailNotice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{emailNotice}</Text> : null}
                <Button label={t('settings.saveEmail')} onPress={saveEmail} />
              </View>

              <View style={styles.divider} />

              <View style={styles.group}>
                <Text style={styles.groupTitle}>{t('settings.changePassword')}</Text>
                <View style={styles.field}>
                  <Text style={styles.label}>{t('settings.currentPassword')}</Text>
                  <Input
                    accessibilityLabel={t('settings.currentPassword')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    invalid={Boolean(passwordErrors.current)}
                    onChangeText={(value) => { setCurrentPassword(value); setPasswordErrors((c) => ({ ...c, current: undefined })); setPasswordNotice(''); }}
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
                    onChangeText={(value) => { setNewPassword(value); setPasswordErrors((c) => ({ ...c, next: undefined })); setPasswordNotice(''); }}
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
                    onChangeText={(value) => { setConfirmPassword(value); setPasswordErrors((c) => ({ ...c, confirm: undefined })); setPasswordNotice(''); }}
                    secureTextEntry
                    value={confirmPassword}
                  />
                  {passwordErrors.confirm ? <Text style={styles.error}>{passwordErrors.confirm}</Text> : null}
                </View>
                {passwordNotice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{passwordNotice}</Text> : null}
                <Button label={t('settings.savePassword')} onPress={savePassword} />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('settings.bedtime')}</Text>
              <Text style={styles.notice}>{t('settings.bedtimeDescription')}</Text>
              <View style={styles.field}>
                <Text style={styles.label}>{t('settings.bedtimeLabel')}</Text>
                <Input
                  accessibilityLabel={t('settings.bedtimeLabel')}
                  invalid={Boolean(bedtimeError)}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  onChangeText={(value) => { setBedtimeText(value); setBedtimeError(''); setBedtimeNotice(''); }}
                  placeholder="21:30"
                  placeholderTextColor={colors.textSecondary}
                  value={bedtimeText}
                />
                {bedtimeError ? <Text style={styles.error}>{bedtimeError}</Text> : null}
              </View>
              {bedtimeNotice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{bedtimeNotice}</Text> : null}
              <Button label={t('settings.saveBedtime')} onPress={saveBedtime} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('language.title')}</Text>
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
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('about.theme.title')}</Text>
              <View style={styles.options}>
                {(['system', 'light', 'dark'] as const).map((option: ThemePreference) => (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: preference === option }}
                    onPress={() => setPreference(option)}
                    style={[styles.option, styles.themeOption, preference === option && styles.optionSelected]}
                  >
                    <Text style={[styles.optionText, preference === option && styles.optionTextSelected]}>
                      {t(`about.theme.${option}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxl },
  main: { alignSelf: 'center', gap: spacing.lg, maxWidth: 440, width: '100%' },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '600' },
  group: { gap: spacing.md },
  groupTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  divider: { backgroundColor: colors.border, height: 1 },
  field: { gap: spacing.sm },
  label: { color: colors.textSecondary, fontSize: typography.label },
  error: { color: colors.accentText, fontSize: typography.label },
  notice: { color: colors.textSecondary, fontSize: typography.label, lineHeight: 18 },
  options: { flexDirection: 'row', gap: spacing.sm },
  option: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  themeOption: { alignItems: 'center', flex: 1, paddingHorizontal: spacing.xs },
  optionSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  optionText: { color: colors.textSecondary, fontSize: typography.label },
  optionTextSelected: { color: colors.accentText, fontWeight: '600' },
});

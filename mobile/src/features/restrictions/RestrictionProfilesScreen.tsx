import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/features/auth/SessionProvider';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';
import { useRestrictionComputer } from './RestrictionDeviceProvider';
import { useOptionalSimulation } from './SimulationProvider';
import { profileStorage } from './profile-storage';
import { addProfile, deleteProfile, loadProfiles, MAX_PROFILES, profileSettings, type ProfileSettings, type RestrictionProfile } from './services/profiles';
import { managementStyles } from './management-styles';

type Confirmation = { type: 'delete'; profile: RestrictionProfile } | {
  type: 'apply'; profile: RestrictionProfile; deviceId: string; associationId: string; revision: number; computerName: string;
};

function ProfileSummary({ settings }: { settings: ProfileSettings }) {
  const { t } = useLanguage();
  const styles = useThemedStyles(managementStyles);
  const names: Record<string, string> = { firefox: 'Firefox', chromium: 'Chromium', brave: 'Brave', 'gnome-web': 'GNOME Web' };
  const allowed = Object.entries(settings.allowedBrowsers).filter(([, value]) => value).map(([id]) => names[id]).join(', ');
  return <View style={{ gap: 4 }}>
    <Text style={styles.body}>{t(settings.blockBrowsers ? 'profiles.browsersRestricted' : 'profiles.browsersFree')}</Text>
    {settings.blockBrowsers ? <Text style={styles.body}>{t('profiles.exceptions', { names: allowed || t('profiles.noExceptions') })}</Text> : null}
    <Text style={styles.body}>{t(settings.blockInstallation ? 'profiles.installBlocked' : 'profiles.installAllowed')}</Text>
    <Text style={styles.body}>{t('profiles.age', { age: settings.ageRating === 'L' ? t('profiles.allAges') : settings.ageRating })}</Text>
  </View>;
}

export function RestrictionProfilesScreen() {
  const { guardian } = useSession();
  const guardianId = guardian?.id ?? null;
  const computer = useRestrictionComputer();
  const simulation = useOptionalSimulation();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(managementStyles);
  const [profiles, setProfiles] = useState<RestrictionProfile[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const generation = useRef(0);
  const working = useRef(false);

  const reload = useCallback(async () => {
    const request = ++generation.current;
    setReady(false);
    setError('');
    if (!guardianId) return;
    try {
      const next = await loadProfiles(profileStorage, guardianId);
      if (request === generation.current) { setProfiles(next); setReady(true); }
    } catch {
      if (request === generation.current) setError('profiles.loadError');
    }
  }, [guardianId]);

  useFocusEffect(useCallback(() => {
    setProfiles([]);
    setName('');
    setConfirmation(null);
    setNotice('');
    void reload();
    return () => { generation.current += 1; };
  }, [reload]));

  async function saveCurrent() {
    if (!guardianId || !simulation || !computer || computer.associationId !== simulation.snapshot.associationId || !ready || working.current) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 40) { setError('profiles.nameRequired'); return; }
    if (profiles.length >= MAX_PROFILES) { setError('profiles.limit'); return; }
    if (profiles.some((profile) => profile.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) { setError('profiles.duplicate'); return; }
    const request = generation.current;
    working.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    Keyboard.dismiss();
    try {
      const next = await addProfile(profileStorage, guardianId, {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
        name: trimmed,
        settings: profileSettings(simulation.snapshot.settings),
      });
      if (request === generation.current) { setProfiles(next); setName(''); setNotice('profiles.saved'); }
    } catch {
      if (request === generation.current) setError('profiles.saveError');
    } finally { working.current = false; setBusy(false); }
  }

  const targetChanged = confirmation?.type === 'apply' && (!computer || !simulation
    || computer.id !== confirmation.deviceId || computer.associationId !== confirmation.associationId || simulation.snapshot.associationId !== confirmation.associationId
    || simulation.snapshot.revision !== confirmation.revision);

  async function confirm() {
    if (!confirmation || !guardianId || working.current || targetChanged || simulation?.busy) return;
    const request = generation.current;
    working.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (confirmation.type === 'delete') {
        const next = await deleteProfile(profileStorage, guardianId, confirmation.profile.id);
        if (request === generation.current) { setProfiles(next); setNotice('profiles.deleted'); }
      } else if (simulation) {
        const { ageRating, ...withoutAge } = profileSettings(confirmation.profile.settings);
        const saved = await simulation.save(computer?.isDemo ? { ...withoutAge, ageRating } : withoutAge);
        if (request === generation.current) {
          if (saved) setNotice('profiles.sent');
          else setError('profiles.applyError');
        }
      }
    } catch {
      if (request === generation.current) setError('profiles.saveError');
    } finally {
      working.current = false;
      setBusy(false);
      if (request === generation.current) setConfirmation(null);
    }
  }

  return <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.title}>{t('profiles.title')}</Text>
      <Text style={styles.body}>{t('profiles.description')}</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{t(error)}</Text> : null}
      {ready && error === 'profiles.saveError' ? <Button label={t('common.retry')} disabled={busy} onPress={() => void reload()} /> : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.success}>{t(notice)}</Text> : null}
      {!ready ? error ? <Button label={t('common.retry')} onPress={() => void reload()} /> : <ActivityIndicator color={colors.accent} /> : <>
        {computer && simulation && computer.associationId === simulation.snapshot.associationId ? <View style={styles.card}>
          <Text style={styles.heading}>{t('profiles.saveCurrent', { name: computer.name })}</Text>
          {!computer.isDemo ? <Text style={styles.body}>{t('profiles.realAgeNote')}</Text> : null}
          <ProfileSummary settings={simulation.snapshot.settings} />
          <Text style={styles.label}>{t('profiles.name')}</Text>
          <TextInput accessibilityLabel={t('profiles.name')} placeholder={t('profiles.namePlaceholder')} placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} maxLength={40} editable={!busy} style={styles.input} />
          <Button label={t('profiles.save')} disabled={busy || simulation.busy || profiles.length >= MAX_PROFILES} onPress={() => void saveCurrent()} />
          {profiles.length >= MAX_PROFILES ? <Text style={styles.body}>{t('profiles.limit')}</Text> : null}
        </View> : <Text style={styles.body}>{t('profiles.selectDemo')}</Text>}
        <Text style={styles.heading}>{t('profiles.savedList', { count: profiles.length })}</Text>
        {!profiles.length ? <Text style={styles.body}>{t('profiles.empty')}</Text> : null}
        {profiles.map((profile) => <View key={profile.id} style={styles.card}>
          <Text style={styles.heading}>{profile.name}</Text>
          <ProfileSummary settings={profile.settings} />
          <View style={styles.actions}>
            <Button label={t('profiles.apply')} disabled={busy || !computer || !simulation || computer.associationId !== simulation.snapshot.associationId || simulation.busy} onPress={() => {
              if (computer && simulation && computer.associationId === simulation.snapshot.associationId) setConfirmation({ type: 'apply', profile, deviceId: computer.id, associationId: simulation.snapshot.associationId, revision: simulation.snapshot.revision, computerName: computer.name });
            }} />
            <Button label={t('profiles.delete')} disabled={busy} onPress={() => setConfirmation({ type: 'delete', profile })} />
          </View>
        </View>)}
      </>}
    </ScrollView>
    <Modal visible={confirmation !== null} transparent animationType="fade" onRequestClose={() => { if (!busy) setConfirmation(null); }}>
      <SafeAreaView style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.dialog}>
          <ScrollView contentContainerStyle={styles.dialogContent}>
            <Text accessibilityRole="header" style={styles.heading}>{t(confirmation?.type === 'delete' ? 'profiles.deleteTitle' : 'profiles.applyTitle')}</Text>
            <Text style={styles.body}>{confirmation?.type === 'apply'
              ? t('profiles.applyConfirm', { profile: confirmation.profile.name, computer: confirmation.computerName })
              : t('profiles.deleteConfirm', { name: confirmation?.profile.name ?? '' })}</Text>
            {confirmation?.type === 'apply' ? <><ProfileSummary settings={confirmation.profile.settings} /><Text style={styles.body}>{t('profiles.excluded')}</Text></> : null}
            {targetChanged ? <Text accessibilityRole="alert" style={styles.error}>{t('profiles.targetChanged')}</Text> : null}
            <View style={styles.actions}>
              <Button label={t('common.cancel')} disabled={busy} onPress={() => setConfirmation(null)} />
              <Button label={t(confirmation?.type === 'delete' ? 'profiles.delete' : 'profiles.apply')} variant="solid" loading={busy} disabled={busy || !!targetChanged || !!simulation?.busy} onPress={() => void confirm()} />
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}

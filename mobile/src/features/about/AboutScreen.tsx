import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PenguinLogo } from '@/components/ui/PenguinLogo';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { fonts, radius, spacing, typography, type ColorPalette } from '@/theme';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';
import { teamImages } from '@/lib/image-assets';

type TeamMember = {
  initials: string;
  name: string;
  username: string;
  githubUrl: string;
  avatar: ImageSourcePropType;
};

const REPOSITORY_URL = 'https://github.com/cfrans/Projeto-Integrador-FatecID-5Sem';

const TEAM_MEMBERS: readonly TeamMember[] = [
  {
    initials: 'CF',
    name: 'Caio Franson da Silva',
    username: 'cfrans',
    githubUrl: 'https://github.com/cfrans',
    avatar: teamImages.cfrans,
  },
  {
    initials: 'CB',
    name: 'Camila Barcaro Corrêa',
    username: 'camilabarcaro',
    githubUrl: 'https://github.com/camilabarcaro',
    avatar: teamImages.camilabarcaro,
  },
  {
    initials: 'GT',
    name: 'Gabriel Tamarossi',
    username: 'TamaGab',
    githubUrl: 'https://github.com/TamaGab',
    avatar: teamImages.TamaGab,
  },
  {
    initials: 'PO',
    name: 'Pedro de Oliveira Silva',
    username: 'pxdrui',
    githubUrl: 'https://github.com/pxdrui',
    avatar: teamImages.pxdrui,
  },
  {
    initials: 'VF',
    name: 'Vitória Caroline da Silva Farias Faturi',
    username: 'vitoriafaturi',
    githubUrl: 'https://github.com/vitoriafaturi',
    avatar: teamImages.vitoriafaturi,
  },
];

const INTEGRATED_COURSES = ['about.course0', 'about.course1', 'about.course2', 'about.course3', 'about.course4'];

export function AboutScreen() {
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});
  const { t } = useLanguage();
  const { colors, scheme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const onAccent = scheme === 'dark' ? colors.background : colors.textPrimary;

  function openExternalUrl(url: string) {
    void Linking.openURL(url).catch(() => undefined);
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.main}>
          <View style={styles.hero}>
            <PenguinLogo size={44} />
            <View style={styles.heroText}>
              <Text style={styles.eyebrow}>{t('about.eyebrow')}</Text>
              <Text style={styles.title}>{t('about.title')}</Text>
              <Text style={styles.description}>{t('about.description')}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>{t('about.members')}</Text>
            <View style={styles.membersCard}>
              {TEAM_MEMBERS.map((member, index) => {
                const showImage = !failedAvatars[member.username];

                return (
                  <Pressable
                    key={member.username}
                    accessibilityHint={t('about.profileHint', { name: member.name })}
                    accessibilityLabel={`${member.name}, @${member.username}`}
                    accessibilityRole="link"
                    onPress={() => openExternalUrl(member.githubUrl)}
                    style={({ pressed }) => [styles.memberRow, index > 0 && styles.memberDivider, pressed && styles.pressed]}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{member.initials}</Text>
                      {showImage ? (
                        <Image
                          accessibilityIgnoresInvertColors
                          fadeDuration={0}
                          onError={() =>
                            setFailedAvatars((current) => ({ ...current, [member.username]: true }))
                          }
                          source={member.avatar}
                          style={styles.avatarImage}
                        />
                      ) : null}
                    </View>

                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberUsername}>@{member.username}</Text>
                    </View>

                    <Text style={styles.externalArrow}>↗</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            accessibilityHint={t('about.repositoryHint')}
            accessibilityLabel={t('about.github')}
            accessibilityRole="link"
            onPress={() => openExternalUrl(REPOSITORY_URL)}
            style={({ pressed }) => [styles.repoButton, pressed && styles.pressed]}
          >
            <Text style={[styles.repoButtonText, { color: onAccent }]}>{t('about.github')}</Text>
            <Text style={[styles.repoButtonText, { color: onAccent }]}>↗</Text>
          </Pressable>

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>{t('about.courses')}</Text>
            <View style={styles.coursesWrap}>
              {INTEGRATED_COURSES.map((course) => (
                <View key={course} style={styles.coursePill}>
                  <Text style={styles.coursePillText}>{t(course)}</Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={styles.footerText}>
            {t('about.footer')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  main: {
    alignSelf: 'center',
    gap: spacing.xl,
    maxWidth: 440,
    width: '100%',
  },
  hero: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg + 4,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  heroText: {
    gap: spacing.sm,
  },
  eyebrow: {
    fontFamily: fonts.groteskBold,
    color: colors.accent,
    fontSize: 11,
    letterSpacing: 1,
  },
  title: {
    fontFamily: fonts.groteskBold,
    color: colors.textPrimary,
    fontSize: 26,
    letterSpacing: -0.5,
    lineHeight: 31,
  },
  description: {
    fontFamily: fonts.groteskRegular,
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 21,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    fontFamily: fonts.groteskBold,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1,
  },
  membersCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  memberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  memberDivider: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  pressed: {
    opacity: 0.72,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 42,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 42,
  },
  avatarText: {
    fontFamily: fonts.groteskBold,
    color: colors.textPrimary,
    fontSize: typography.label,
  },
  avatarImage: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.pill,
    height: '100%',
    width: '100%',
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontFamily: fonts.groteskBold,
    color: colors.textPrimary,
    fontSize: typography.body,
  },
  memberUsername: {
    fontFamily: fonts.groteskRegular,
    color: colors.textMuted,
    fontSize: typography.label,
  },
  externalArrow: {
    fontFamily: fonts.groteskMedium,
    color: colors.textMuted,
    fontSize: 14,
  },
  repoButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.md + 2,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: spacing.lg,
  },
  repoButtonText: {
    fontFamily: fonts.groteskBold,
    fontSize: typography.button,
  },
  coursesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  coursePill: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  coursePillText: {
    fontFamily: fonts.groteskMedium,
    color: colors.textPrimary,
    fontSize: typography.label,
  },
  footerText: {
    fontFamily: fonts.groteskRegular,
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 18,
  },
});

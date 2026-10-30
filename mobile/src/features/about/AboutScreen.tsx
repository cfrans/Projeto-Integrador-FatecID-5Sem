import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { fonts, radius, spacing, typography, type ColorPalette } from '@/theme';
import { useTheme, useThemedStyles } from '@/features/theme/ThemeProvider';

type TeamMember = {
  initials: string;
  name: string;
  username: string;
  githubUrl: string;
  avatarUrl: string;
};

const REPOSITORY_URL = 'https://github.com/cfrans/Projeto-Integrador-FatecID-5Sem';

const TEAM_MEMBERS: readonly TeamMember[] = [
  {
    initials: 'CF',
    name: 'Caio Franson da Silva',
    username: 'cfrans',
    githubUrl: 'https://github.com/cfrans',
    avatarUrl: 'https://avatars.githubusercontent.com/u/84992079?s=120&v=4',
  },
  {
    initials: 'CB',
    name: 'Camila Barcaro Corrêa',
    username: 'camilabarcaro',
    githubUrl: 'https://github.com/camilabarcaro',
    avatarUrl: 'https://avatars.githubusercontent.com/u/199844388?s=120&v=4',
  },
  {
    initials: 'GT',
    name: 'Gabriel Tamarossi',
    username: 'TamaGab',
    githubUrl: 'https://github.com/TamaGab',
    avatarUrl: 'https://avatars.githubusercontent.com/u/167652764?s=120&v=4',
  },
  {
    initials: 'PO',
    name: 'Pedro de Oliveira Silva',
    username: 'pxdrui',
    githubUrl: 'https://github.com/pxdrui',
    avatarUrl: 'https://avatars.githubusercontent.com/u/199849281?s=120&v=4',
  },
  {
    initials: 'VC',
    name: 'Vitória Caroline da Silva Farias Faturi',
    username: 'vitoriafaturi',
    githubUrl: 'https://github.com/vitoriafaturi',
    avatarUrl: 'https://avatars.githubusercontent.com/u/199849555?s=120&v=4',
  },
];

let avatarsPrefetched = false;

export function prefetchTeamAvatars() {
  if (avatarsPrefetched) return;
  avatarsPrefetched = true;
  for (const member of TEAM_MEMBERS) {
    void Image.prefetch(member.avatarUrl).catch(() => {
      avatarsPrefetched = false;
    });
  }
}

const INTEGRATED_COURSES = ['about.course0', 'about.course1', 'about.course2', 'about.course3', 'about.course4'];

function GitHubLogo({ size = 18, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const logoColor = color ?? colors.textPrimary;
  const headSize = size * 0.56;
  const earSize = size * 0.2;
  const bodyWidth = size * 0.44;
  const bodyHeight = size * 0.28;

  return (
    <View
      accessible={false}
      style={[
        styles.ghCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: logoColor,
        },
      ]}
    >
      <View
        style={[
          styles.ghEarLeft,
          {
            width: earSize,
            height: earSize,
            top: size * 0.16,
            left: size * 0.23,
          },
        ]}
      />
      <View
        style={[
          styles.ghEarRight,
          {
            width: earSize,
            height: earSize,
            top: size * 0.16,
            right: size * 0.23,
          },
        ]}
      />
      <View
        style={[
          styles.ghHead,
          {
            width: headSize,
            height: headSize * 0.82,
            borderRadius: headSize / 2,
            top: size * 0.22,
          },
        ]}
      />
      <View
        style={[
          styles.ghBody,
          {
            width: bodyWidth,
            height: bodyHeight,
            borderTopLeftRadius: bodyWidth / 2,
            borderTopRightRadius: bodyWidth / 2,
          },
        ]}
      />
    </View>
  );
}

export function AboutScreen() {
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  useEffect(() => {
    prefetchTeamAvatars();
  }, []);

  function openExternalUrl(url: string) {
    void Linking.openURL(url).catch(() => undefined);
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.main}>
          <View style={styles.intro}>
            <Text style={styles.eyebrow}>{t('about.eyebrow')}</Text>
            <Text style={styles.title}>{t('about.title')}</Text>
            <Text style={styles.description}>{t('about.description')}</Text>
          </View>

          <View style={styles.membersList}>
            {TEAM_MEMBERS.map((member) => {
              const showImage = !failedAvatars[member.username];

              return (
                <Pressable
                  key={member.username}
                  accessibilityHint={t('about.profileHint', { name: member.name })}
                  accessibilityLabel={`${member.name}, @${member.username}`}
                  accessibilityRole="link"
                  onPress={() => openExternalUrl(member.githubUrl)}
                  style={({ pressed }) => [styles.memberCard, pressed && styles.pressed]}
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
                        source={{ uri: member.avatarUrl, cache: 'force-cache' }}
                        style={styles.avatarImage}
                      />
                    ) : null}
                  </View>

                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <View style={styles.memberHandleRow}>
                      <GitHubLogo color={colors.textSecondary} size={13} />
                      <Text style={styles.memberUsername}>@{member.username}</Text>
                    </View>
                  </View>

                  <Text style={styles.externalArrow}>↗</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityHint={t('about.repositoryHint')}
            accessibilityLabel={t('about.github')}
            accessibilityRole="link"
            onPress={() => openExternalUrl(REPOSITORY_URL)}
            style={({ pressed }) => [styles.repoButton, pressed && styles.pressed]}
          >
            <GitHubLogo color={colors.accentText} size={18} />
            <Text style={styles.repoButtonText}>{t('about.github')}</Text>
            <Text style={styles.repoButtonArrow}>↗</Text>
          </Pressable>

          <View style={styles.coursesSection}>
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
  intro: {
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.accentText,
    fontSize: typography.label,
    fontWeight: '600',
    letterSpacing: 1.1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontFamily: fonts.title,
    letterSpacing: -0.5,
  },
  description: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 21,
  },
  membersList: {
    gap: spacing.sm,
  },
  memberCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  pressed: {
    opacity: 0.72,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: 42,
  },
  avatarText: {
    color: colors.accentText,
    fontSize: typography.label,
    fontWeight: '700',
  },
  avatarImage: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.pill,
    height: '100%',
    width: '100%',
  },
  memberInfo: {
    flex: 1,
    gap: 3,
  },
  memberName: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: '600',
  },
  memberHandleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  memberUsername: {
    color: colors.textSecondary,
    fontSize: typography.label,
  },
  externalArrow: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  repoButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.accent,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  repoButtonText: {
    color: colors.accentText,
    fontSize: typography.button,
    fontWeight: '600',
  },
  repoButtonArrow: {
    color: colors.accentText,
    fontSize: 14,
    fontWeight: '700',
  },
  ghCircle: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
  },
  ghEarLeft: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 2,
    position: 'absolute',
    transform: [{ rotate: '-18deg' }],
  },
  ghEarRight: {
    backgroundColor: colors.background,
    borderTopRightRadius: 2,
    position: 'absolute',
    transform: [{ rotate: '18deg' }],
  },
  ghHead: {
    backgroundColor: colors.background,
    position: 'absolute',
  },
  ghBody: {
    backgroundColor: colors.background,
  },
  coursesSection: {
    gap: spacing.sm,
  },
  sectionHeader: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
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
    color: colors.textSecondary,
    fontSize: typography.label,
    fontWeight: '500',
  },
  footerText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 18,
  },
});

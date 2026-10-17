import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/theme';

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
    avatarUrl: 'https://github.com/cfrans.png?size=120',
  },
  {
    initials: 'CB',
    name: 'Camila Barcaro Corrêa',
    username: 'camilabarcaro',
    githubUrl: 'https://github.com/camilabarcaro',
    avatarUrl: 'https://github.com/camilabarcaro.png?size=120',
  },
  {
    initials: 'GT',
    name: 'Gabriel Tamarossi',
    username: 'TamaGab',
    githubUrl: 'https://github.com/TamaGab',
    avatarUrl: 'https://github.com/TamaGab.png?size=120',
  },
  {
    initials: 'PO',
    name: 'Pedro de Oliveira Silva',
    username: 'pxdrui',
    githubUrl: 'https://github.com/pxdrui',
    avatarUrl: 'https://github.com/pxdrui.png?size=120',
  },
  {
    initials: 'VC',
    name: 'Vitória Caroline da Silva Farias Faturi',
    username: 'vitoriafaturi',
    githubUrl: 'https://github.com/vitoriafaturi',
    avatarUrl: 'https://github.com/vitoriafaturi.png?size=120',
  },
];

const INTEGRATED_COURSES: readonly string[] = [
  'Engenharia de Software III',
  'Laboratório de Banco de Dados',
  'Segurança da Informação',
  'Sistemas Operacionais II',
  'Programação para Dispositivos Móveis',
];

function GitHubLogo({ size = 18, color = colors.textPrimary }: { size?: number; color?: string }) {
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
          backgroundColor: color,
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

  function openExternalUrl(url: string) {
    void Linking.openURL(url).catch(() => undefined);
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.main}>
          <View style={styles.intro}>
            <Text style={styles.eyebrow}>GRUPO 2 · FATEC INDAIATUBA</Text>
            <Text style={styles.title}>Projeto Integrador · 5º trimestre</Text>
            <Text style={styles.description}>
              Sistema mobile de controle parental para o Lux, com pareamento por QR Code e
              comunicação via Web Service.
            </Text>
          </View>

          <View style={styles.membersList}>
            {TEAM_MEMBERS.map((member) => {
              const showImage = !failedAvatars[member.username];

              return (
                <Pressable
                  key={member.username}
                  accessibilityHint={`Abre o perfil do GitHub de ${member.name}`}
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
                        onError={() =>
                          setFailedAvatars((current) => ({ ...current, [member.username]: true }))
                        }
                        source={{ uri: member.avatarUrl }}
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
            accessibilityHint="Abre o repositório oficial do projeto no GitHub"
            accessibilityLabel="Ver projeto no GitHub"
            accessibilityRole="link"
            onPress={() => openExternalUrl(REPOSITORY_URL)}
            style={({ pressed }) => [styles.repoButton, pressed && styles.pressed]}
          >
            <GitHubLogo color={colors.accentText} size={18} />
            <Text style={styles.repoButtonText}>Ver projeto no GitHub</Text>
            <Text style={styles.repoButtonArrow}>↗</Text>
          </Pressable>

          <View style={styles.coursesSection}>
            <Text style={styles.sectionHeader}>DISCIPLINAS INTEGRADAS</Text>
            <View style={styles.coursesWrap}>
              {INTEGRATED_COURSES.map((course) => (
                <View key={course} style={styles.coursePill}>
                  <Text style={styles.coursePillText}>{course}</Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={styles.footerText}>
            Fatec Indaiatuba Dr. Archimedes Lammoglia · 2026 · versão 0.9.0 (camada simulada)
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    fontWeight: '700',
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

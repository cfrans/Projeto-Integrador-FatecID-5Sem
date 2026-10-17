import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/Card';
import { colors, radius, spacing, typography } from '@/theme';

type TeamMember = {
  initials: string;
  name: string;
};

const TEAM_MEMBERS: readonly TeamMember[] = [
  { initials: 'CF', name: 'Caio Franson da Silva' },
  { initials: 'CB', name: 'Camila Barcaro Corrêa' },
  { initials: 'GT', name: 'Gabriel Tamarossi' },
  { initials: 'PO', name: 'Pedro de Oliveira Silva' },
  { initials: 'VC', name: 'Vitória Caroline da Silva Farias Faturi' },
];

const INTEGRATED_COURSES: readonly string[] = [
  'Engenharia de Software III',
  'Laboratório de Banco de Dados',
  'Segurança da Informação',
  'Sistemas Operacionais II',
  'Programação para Dispositivos Móveis',
];

export function AboutScreen() {
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
            {TEAM_MEMBERS.map((member) => (
              <Card key={member.initials} style={styles.memberCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{member.initials}</Text>
                </View>
                <Text style={styles.memberName}>{member.name}</Text>
              </Card>
            ))}
          </View>

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
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  avatarText: {
    color: colors.accentText,
    fontSize: typography.label,
    fontWeight: '700',
  },
  memberName: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '600',
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

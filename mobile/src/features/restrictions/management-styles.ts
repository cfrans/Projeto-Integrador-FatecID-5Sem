import { StyleSheet } from 'react-native';
import { fonts, radius, spacing, type ColorPalette } from '@/theme';

export const managementStyles = (colors: ColorPalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { fontFamily: fonts.title, fontSize: 24, color: colors.textPrimary },
  heading: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  body: { fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, minHeight: 48, paddingHorizontal: spacing.md, color: colors.textPrimary, backgroundColor: colors.surfaceRaised },
  error: { fontSize: 14, lineHeight: 21, color: colors.danger },
  success: { fontSize: 14, lineHeight: 21, color: colors.success },
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)', padding: spacing.lg },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, maxHeight: '90%' },
  dialogContent: { gap: spacing.md },
});

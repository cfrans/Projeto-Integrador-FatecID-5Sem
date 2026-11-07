import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ApplicationBrand } from '@/features/restrictions/services/application-brand';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/features/i18n/LanguageProvider';
import { useThemedStyles } from '@/features/theme/ThemeProvider';
import { fonts, radius, spacing, typography, type ColorPalette } from '@/theme';
import { fetchCatalogDetails, type CatalogDetails } from './services/flathub';

type Props = { brand: ApplicationBrand; name: string };

export function ApplicationCatalogCard({ brand, name }: Props) {
  const { language, t } = useLanguage();
  const styles = useThemedStyles(createStyles);
  const [details, setDetails] = useState<CatalogDetails | null>(null);
  const [failed, setFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const [showIndicators, setShowIndicators] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    void fetchCatalogDetails(brand, language, controller.signal)
      .then((entry) => { if (active) setDetails(entry); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [brand, language, attempt]);

  const rating = details?.rating;
  const colors = rating?.system === 'DJCTQ' && rating.label ? ageColors[rating.label] : undefined;

  return (
    <View style={styles.card}>
      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.identity}>
            <Text style={styles.source}>{t('access.flathubSource')}</Text>
            <Text accessibilityRole="header" style={styles.title}>{name}</Text>
            {details?.version ? <Text style={styles.meta}>{t('access.catalogVersion', { version: details.version })}</Text> : null}
          </View>
          {rating?.label ? (
            <View accessible accessibilityLabel={`${t('access.contentRating')}: ${rating.label} ${rating.system ?? ''}`} style={styles.rating}>
              <View style={[styles.badge, colors && { backgroundColor: colors[0] }]}>
                <Text style={[styles.badgeText, rating.label.length > 3 && styles.longRating, colors && { color: colors[1] }]}>{rating.label}</Text>
              </View>
              {rating.system ? <Text style={styles.ratingSystem}>{rating.system}</Text> : null}
            </View>
          ) : null}
        </View>
        <Text style={styles.summary}>{details?.summary ?? t(failed ? 'access.catalogUnavailable' : 'access.catalogLoading')}</Text>
        {failed ? <Button label={t('common.retry')} onPress={() => { setFailed(false); setAttempt((value) => value + 1); }} /> : null}
        {details?.screenshot && !imageFailed ? (
          <View style={styles.preview}>
            <Image
              alt={t('access.catalogScreenshot', { name })}
              onError={() => setImageFailed(true)}
              resizeMode="contain"
              source={{ uri: details.screenshot.uri }}
              style={styles.image}
            />
            {details.screenshot.caption ? <Text style={styles.caption}>{details.screenshot.caption}</Text> : null}
          </View>
        ) : null}
      </View>
      {rating && rating.indicators.length > 0 ? (
        <View style={styles.section}>
          <Disclosure label={t('access.contentIndicators')} expanded={showIndicators} onPress={() => setShowIndicators(!showIndicators)} />
          {showIndicators ? (
            <View style={styles.detailBody}>
              {rating.indicators.map((indicator, index) => <Text key={index} style={styles.detail}>•  {indicator}</Text>)}
            </View>
          ) : null}
        </View>
      ) : null}
      {details && details.description.length > 0 ? (
        <View style={styles.section}>
          <Disclosure label={t(expanded ? 'access.hideDescription' : 'access.showDescription')} expanded={expanded} onPress={() => setExpanded(!expanded)} />
          {expanded ? (
            <View style={styles.detailBody}>
              {details.description.map((paragraph, index) => <Text key={index} style={styles.detail}>{paragraph}</Text>)}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Disclosure({ label, expanded, onPress }: { label: string; expanded: boolean; onPress: () => void }) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded }} onPress={onPress}
      style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
      <Text style={styles.link}>{label}</Text>
      <View accessible={false} style={[styles.chevron, expanded && styles.chevronOpen]} />
    </Pressable>
  );
}

const ageColors: Record<string, [string, string]> = {
  L: ['#14753D', '#FFFFFF'], '6': ['#AF2D76', '#FFFFFF'], '10': ['#1967AC', '#FFFFFF'],
  '12': ['#F1C84B', '#231D0E'], '14': ['#ED943E', '#241A11'],
  '16': ['#B93239', '#FFFFFF'], '18': ['#171719', '#FFFFFF'],
};

const createStyles = (colors: ColorPalette) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  body: { gap: spacing.md, padding: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.lg },
  identity: { flex: 1, gap: spacing.xs },
  source: { color: colors.textSecondary, fontSize: typography.label, fontWeight: '600' },
  title: { color: colors.textPrimary, fontFamily: fonts.title, fontSize: 24, lineHeight: 30 },
  summary: { color: colors.textPrimary, fontSize: typography.body, lineHeight: 21 },
  meta: { color: colors.textSecondary, fontSize: typography.label },
  rating: { alignItems: 'center', gap: spacing.xs },
  badge: { minWidth: 52, minHeight: 52, maxWidth: 96, padding: spacing.xs, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised, borderRadius: radius.sm },
  badgeText: { color: colors.textPrimary, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  longRating: { fontSize: typography.label },
  ratingSystem: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  preview: { gap: spacing.xs },
  image: { alignSelf: 'stretch', width: '100%', height: 172, backgroundColor: colors.surfaceRaised, borderRadius: radius.sm },
  caption: { color: colors.textSecondary, fontSize: typography.label, lineHeight: 17 },
  section: { borderTopColor: colors.border, borderTopWidth: 1 },
  toggle: { minHeight: 48, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  pressed: { backgroundColor: colors.surfaceRaised },
  link: { flexShrink: 1, color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  chevron: { width: 9, height: 9, borderRightWidth: 2, borderBottomWidth: 2, borderColor: colors.accentText, transform: [{ rotate: '45deg' }] },
  chevronOpen: { transform: [{ rotate: '225deg' }] },
  detailBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
  detail: { color: colors.textSecondary, fontSize: typography.body, lineHeight: 21 },
});

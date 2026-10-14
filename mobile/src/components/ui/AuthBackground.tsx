import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Penguin } from '@/components/ui/PenguinLogo';
import { colors } from '@/theme';

function mixColors(from: string, to: string, amount: number) {
  const t = Math.min(1, Math.max(0, amount));
  const channel = (hex: string, index: number) => parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  const mixed = [0, 1, 2].map((index) =>
    Math.round(channel(from, index) + (channel(to, index) - channel(from, index)) * t)
      .toString(16)
      .padStart(2, '0'),
  );
  return `#${mixed.join('')}`;
}

export function AuthBackground({ children }: { children: ReactNode }) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const penguinWidth = screenWidth * 0.9;
  const penguinHeight = penguinWidth * 1.5;
  const safeHeight = screenHeight - insets.top - insets.bottom;
  const eyeY = insets.top + safeHeight * 0.12 + penguinHeight * 0.2 + penguinWidth * 0.04;
  const eyeColor = mixColors(colors.background, colors.backgroundGlow, eyeY / screenHeight);

  return (
    <LinearGradient colors={[colors.background, colors.backgroundGlow]} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <View pointerEvents="none" style={styles.backdrop}>
          <View style={[styles.penguin, { right: -penguinWidth * 0.35 }]}>
            <Penguin
              width={penguinWidth}
              height={penguinHeight}
              facing="left"
              color={colors.backgroundTint}
              eyeColor={eyeColor}
            />
          </View>
        </View>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  penguin: { position: 'absolute', top: '12%' },
});

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { useTheme } from '@/features/theme/ThemeProvider';

type PenguinProps = { width: number; height: number; facing?: 'left' | 'right'; color: string; eyeColor: string; blink?: Animated.Value };

export function Penguin({ width, height, facing = 'right', color, eyeColor, blink }: PenguinProps) {
  const left = facing === 'left';
  const beak = width * 0.2;
  const eye = width * 0.14;

  return (
    <View
      style={{
        width,
        height,
        backgroundColor: color,
        borderTopLeftRadius: width / 2,
        borderTopRightRadius: width / 2,
        borderBottomLeftRadius: width * 0.4,
        borderBottomRightRadius: width * 0.4,
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: height * 0.2,
          [left ? 'left' : 'right']: -beak * 1.1,
          width: 0,
          height: 0,
          borderTopWidth: beak * 0.55,
          borderBottomWidth: beak * 0.55,
          [left ? 'borderRightWidth' : 'borderLeftWidth']: beak * 1.3,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          [left ? 'borderRightColor' : 'borderLeftColor']: color,
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          top: height * 0.2 + beak * 0.55 - eye / 2,
          [left ? 'left' : 'right']: width * 0.2,
          width: eye,
          height: eye,
          borderRadius: eye / 2,
          backgroundColor: eyeColor,
          transform: [{ scaleY: blink ?? 1 }],
        }}
      />
    </View>
  );
}

const HEIGHT_RATIO = 1.15;
const LARGE_SCALE = 0.8;

type PenguinLogoProps = { size?: number; color?: string; eyeColor?: string };

export function PenguinLogo({ size = 46, color, eyeColor }: PenguinLogoProps) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.accent;
  const resolvedEyeColor = eyeColor ?? colors.background;
  const height = size * HEIGHT_RATIO;
  const largeHeight = height * LARGE_SCALE;
  const [large] = useState(() => new Animated.Value(0));
  const [small] = useState(() => new Animated.Value(0));
  const [blink] = useState(() => new Animated.Value(1));
  const [hop] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let cancelled = false;
    const native = Platform.OS !== 'web';
    const run = (value: Animated.Value, toValue: number, duration: number) =>
      Animated.timing(value, { toValue, duration, easing: Easing.linear, useNativeDriver: native });

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (cancelled) return;
        if (reduceMotion) {
          large.setValue(1);
          small.setValue(1);
          return;
        }
        Animated.sequence([
          Animated.parallel([run(large, 1, 700), Animated.sequence([Animated.delay(220), run(small, 1, 700)])]),
          Animated.delay(120),
          run(blink, 0.1, 90),
          run(blink, 1, 110),
          run(hop, 1, 420),
          run(blink, 0.1, 90),
          run(blink, 1, 110),
        ]).start();
      });
    return () => {
      cancelled = true;
    };
  }, [blink, hop, large, small]);

  const drop = (value: Animated.Value, distance: number) =>
    value.interpolate({ inputRange: [0, 0.45, 0.6, 0.75, 0.9, 1], outputRange: [-distance, 0, -distance * 0.2, 0, -distance * 0.05, 0] });
  const squashY = (value: Animated.Value) =>
    value.interpolate({ inputRange: [0, 0.4, 0.45, 0.6, 0.75, 1], outputRange: [1.18, 1.18, 0.78, 1.08, 0.97, 1] });
  const squashX = (value: Animated.Value) =>
    value.interpolate({ inputRange: [0, 0.4, 0.45, 0.6, 0.75, 1], outputRange: [0.86, 0.86, 1.2, 0.95, 1.03, 1] });
  const appear = (value: Animated.Value) => value.interpolate({ inputRange: [0, 0.15], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View accessible={false} style={[styles.row, { height: largeHeight, gap: size * 0.28 }]}>
      <Animated.View
        style={{
          opacity: appear(large),
          transformOrigin: 'bottom',
          transform: [{ translateY: drop(large, size * 1.2) }, { scaleX: squashX(large) }, { scaleY: squashY(large) }],
        }}
      >
        <Penguin width={size * 0.64 * LARGE_SCALE} height={largeHeight} color={resolvedColor} eyeColor={resolvedEyeColor} blink={blink} />
      </Animated.View>
      <Animated.View
        style={{
          opacity: appear(small),
          transformOrigin: 'bottom',
          transform: [
            { translateY: drop(small, size * 1.2) },
            { translateY: hop.interpolate({ inputRange: [0, 0.35, 0.7, 1], outputRange: [0, -size * 0.22, 0, 0] }) },
            { rotate: hop.interpolate({ inputRange: [0, 0.35, 0.7, 1], outputRange: ['0deg', '-14deg', '10deg', '0deg'] }) },
            { scaleX: squashX(small) },
            { scaleY: squashY(small) },
          ],
        }}
      >
        <Penguin width={size * 0.42} height={height * 0.66} facing="left" color={resolvedColor} eyeColor={resolvedEyeColor} blink={blink} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
});

import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/features/theme/ThemeProvider';

type PenguinProps = { width: number; height: number; facing?: 'left' | 'right'; color: string; eyeColor: string };

export function Penguin({ width, height, facing = 'right', color, eyeColor }: PenguinProps) {
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
      <View
        style={{
          position: 'absolute',
          top: height * 0.2 + beak * 0.55 - eye / 2,
          [left ? 'left' : 'right']: width * 0.2,
          width: eye,
          height: eye,
          borderRadius: eye / 2,
          backgroundColor: eyeColor,
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

  return (
    <View accessible={false} style={[styles.row, { height: largeHeight, gap: size * 0.28 }]}>
      <Penguin width={size * 0.64 * LARGE_SCALE} height={largeHeight} color={resolvedColor} eyeColor={resolvedEyeColor} />
      <Penguin width={size * 0.42} height={height * 0.66} facing="left" color={resolvedColor} eyeColor={resolvedEyeColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
});

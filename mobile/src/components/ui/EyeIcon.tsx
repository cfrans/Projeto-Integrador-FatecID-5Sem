import { StyleSheet, View } from 'react-native';

type EyeIconProps = { color: string; slashed?: boolean };

export function EyeIcon({ color, slashed = false }: EyeIconProps) {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.box}>
      <View style={[styles.lens, { borderColor: color }]} />
      <View style={[styles.pupil, { borderColor: color }]} />
      {slashed ? <View style={[styles.slash, { backgroundColor: color }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', height: 26, justifyContent: 'center', width: 26 },
  lens: {
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 4,
    borderWidth: 1.8,
    height: 17,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 17,
  },
  pupil: { borderRadius: 4, borderWidth: 1.8, height: 8, position: 'absolute', width: 8 },
  slash: { borderRadius: 1, height: 2, position: 'absolute', transform: [{ rotate: '-45deg' }], width: 26 },
});

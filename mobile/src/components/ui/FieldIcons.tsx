import { StyleSheet, View } from 'react-native';

const STROKE = 1.6;

export function MailIcon({ color }: { color: string }) {
  return (
    <View accessible={false} style={[styles.mail, { borderColor: color }]}>
      <View style={[styles.mailFlap, { borderColor: color }]} />
    </View>
  );
}

export function LockIcon({ color }: { color: string }) {
  return (
    <View accessible={false} style={styles.lock}>
      <View style={[styles.lockShackle, { borderColor: color }]} />
      <View style={[styles.lockBody, { borderColor: color }]}>
        <View style={[styles.lockKeyhole, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function UserIcon({ color }: { color: string }) {
  return (
    <View accessible={false} style={styles.user}>
      <View style={[styles.userHead, { borderColor: color }]} />
      <View style={[styles.userBody, { borderColor: color }]} />
    </View>
  );
}

export function CheckIcon({ color }: { color: string }) {
  return (
    <View accessible={false} style={styles.check}>
      <View style={[styles.checkMark, { borderColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  user: { width: 16, height: 18, alignItems: 'center', justifyContent: 'space-between' },
  userHead: { width: 8, height: 8, borderWidth: STROKE, borderRadius: 4 },
  userBody: {
    width: 16,
    height: 7,
    borderWidth: STROKE,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  check: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  checkMark: {
    width: 6,
    height: 11,
    marginTop: -2,
    borderRightWidth: STROKE + 0.2,
    borderBottomWidth: STROKE + 0.2,
    transform: [{ rotate: '45deg' }],
  },
  mail: { width: 18, height: 14, borderWidth: STROKE, borderRadius: 3, overflow: 'hidden' },
  mailFlap: {
    position: 'absolute',
    left: 2.2,
    top: -5.5,
    width: 10,
    height: 10,
    borderRightWidth: STROKE,
    borderBottomWidth: STROKE,
    transform: [{ rotate: '45deg' }],
  },
  lock: { width: 16, height: 18, alignItems: 'center' },
  lockShackle: {
    width: 10,
    height: 10,
    borderWidth: STROKE,
    borderBottomWidth: 0,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  lockBody: {
    width: 16,
    height: 10,
    marginTop: -1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: STROKE,
    borderRadius: 3,
  },
  lockKeyhole: { width: 2.4, height: 2.4, borderRadius: 1.2 },
});

import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { DeviceCard } from '@/features/devices/DeviceCard';
import { devices, devicesErrorMessage, type PairedComputer } from '@/features/devices/services/devices';
import { colors, radius, spacing, typography } from '@/theme';

type ComputersState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; computers: PairedComputer[] };

export function ComputersScreen() {
  const [state, setState] = useState<ComputersState>({ status: 'loading' });
  const requestId = useRef(0);

  const loadComputers = useCallback(() => {
    const request = ++requestId.current;
    setState({ status: 'loading' });
    devices.listPairedComputers()
      .then((computers) => {
        if (request === requestId.current) setState({ status: 'loaded', computers });
      })
      .catch((error: unknown) => {
        if (request === requestId.current) setState({ status: 'error', message: devicesErrorMessage(error) });
      });
  }, []);

  useFocusEffect(useCallback(() => {
    loadComputers();
    return () => {
      requestId.current += 1;
    };
  }, [loadComputers]));

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    loadComputers();
  }, [loadComputers]);

  const computers = state.status === 'loaded' ? state.computers : [];

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={computers}
        ItemSeparatorComponent={ItemSeparator}
        keyExtractor={(computer) => computer.id}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {state.status === 'loading' ? (
              <>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.stateText}>Carregando computadores…</Text>
              </>
            ) : null}
            {state.status === 'error' ? (
              <>
                <Text style={styles.stateTitle}>Não foi possível carregar</Text>
                <Text style={styles.stateText}>{state.message}</Text>
                <Button label="Tentar novamente" onPress={retry} />
              </>
            ) : null}
            {state.status === 'loaded' ? (
              <>
                <Text style={styles.stateTitle}>Nenhum computador associado</Text>
                <Text style={styles.stateText}>O pareamento seguro ainda não está disponível.</Text>
              </>
            ) : null}
          </View>
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.description}>
              Confira os computadores associados à sua conta.
            </Text>
            <Button
              label="Simular pareamento"
              onPress={() => router.push('/qr-scan')}
            />
          </View>
        }
        renderItem={({ item }) => <DeviceCard computer={item} />}
      />
    </SafeAreaView>
  );
}

function ItemSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxl },
  listHeader: { gap: spacing.md, marginBottom: spacing.lg },
  description: { color: colors.textSecondary, fontSize: typography.body, lineHeight: 21 },
  separator: { height: spacing.sm },
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xl,
  },
  stateTitle: { color: colors.textPrimary, fontSize: typography.body, fontWeight: '600' },
  stateText: { color: colors.textSecondary, fontSize: typography.label, textAlign: 'center' },
});

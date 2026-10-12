import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
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
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removalError, setRemovalError] = useState<string | null>(null);
  const requestId = useRef(0);
  const removeOperation = useRef(0);
  const removalPromptOpen = useRef(false);

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
    setRemovingId(null);
    loadComputers();
    return () => {
      requestId.current += 1;
      removeOperation.current += 1;
      removalPromptOpen.current = false;
      setRemovingId(null);
    };
  }, [loadComputers]));

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    loadComputers();
  }, [loadComputers]);

  const computers = state.status === 'loaded' ? state.computers : [];

  const removeAssociation = useCallback((computer: PairedComputer) => {
    if (!computer.isPaired || removingId || removalPromptOpen.current) return;
    removalPromptOpen.current = true;

    Alert.alert(
      'Remover vínculo?',
      `“${computer.name}” deixará de aparecer entre os computadores associados à sua conta.`,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => { removalPromptOpen.current = false; } },
        {
          text: 'Remover vínculo',
          style: 'destructive',
          onPress: async () => {
            removalPromptOpen.current = false;
            const operation = ++removeOperation.current;
            setRemovingId(computer.id);
            setRemovalError(null);
            try {
              await devices.removeAssociation(computer.id);
              if (operation === removeOperation.current) loadComputers();
            } catch (error) {
              if (operation === removeOperation.current) setRemovalError(devicesErrorMessage(error));
            } finally {
              if (operation === removeOperation.current) setRemovingId(null);
            }
          },
        },
      ],
      { cancelable: false },
    );
  }, [loadComputers, removingId]);

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
                <Text style={styles.stateText}>Leia o QR Code temporário exibido no computador para criar um vínculo.</Text>
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
              label="Adicionar computador"
              onPress={() => router.push('/qr-scan')}
            />
            {removalError ? <Text accessibilityRole="alert" style={styles.error}>{removalError}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <DeviceCard
            computer={item}
            onRemove={() => removeAssociation(item)}
            removing={removingId === item.id}
          />
        )}
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
  error: { color: colors.accentText, fontSize: typography.label, lineHeight: 18 },
});

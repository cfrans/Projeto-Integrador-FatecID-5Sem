type SelectableComputer = { id: string; isPaired: boolean };

export function selectRestrictionComputer<T extends SelectableComputer>(
  computers: readonly T[],
  requestedId: string | null,
): T | null {
  const paired = computers.filter((computer) => computer.isPaired);
  if (requestedId !== null) return paired.find((computer) => computer.id === requestedId) ?? null;
  return paired.length === 1 ? paired[0] : null;
}

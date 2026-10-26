export const SIMULATION_PRESENCE_TTL_MS = 15000;

export function simulationPresence(lastSeenAt: Date | null, now = Date.now()) {
  return {
    status:
      lastSeenAt === null
        ? ('unverified' as const)
        : now - lastSeenAt.getTime() <= SIMULATION_PRESENCE_TTL_MS
          ? ('online' as const)
          : ('offline' as const),
    lastSeen: lastSeenAt?.toISOString() ?? null,
  };
}

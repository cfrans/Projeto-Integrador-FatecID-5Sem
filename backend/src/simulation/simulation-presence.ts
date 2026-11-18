export const SIMULATION_PRESENCE_TTL_MS = 15000;
export const AGENT_PRESENCE_TTL_MS = 60000;
export const AGENT_PRESENCE_WRITE_INTERVAL_MS = 10000;

export function simulationPresence(
  lastSeenAt: Date | null,
  now = Date.now(),
  ttlMs = SIMULATION_PRESENCE_TTL_MS,
) {
  return {
    status:
      lastSeenAt === null
        ? ('unverified' as const)
        : now - lastSeenAt.getTime() <= ttlMs
          ? ('online' as const)
          : ('offline' as const),
    lastSeen: lastSeenAt?.toISOString() ?? null,
  };
}

export function agentPresence(lastSeenAt: Date | null, now = Date.now()) {
  return simulationPresence(lastSeenAt, now, AGENT_PRESENCE_TTL_MS);
}

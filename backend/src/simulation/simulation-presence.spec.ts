import {
  simulationPresence,
  SIMULATION_PRESENCE_TTL_MS,
} from './simulation-presence.js';

describe('Simulated client presence', () => {
  it('requires actual contact and expires independently from configuration acknowledgement', () => {
    const contact = new Date('2026-10-25T12:00:00.000Z');
    expect(simulationPresence(null)).toEqual({
      status: 'unverified',
      lastSeen: null,
    });
    expect(
      simulationPresence(
        contact,
        contact.getTime() + SIMULATION_PRESENCE_TTL_MS,
      ),
    ).toEqual({ status: 'online', lastSeen: contact.toISOString() });
    expect(
      simulationPresence(
        contact,
        contact.getTime() + SIMULATION_PRESENCE_TTL_MS + 1,
      ),
    ).toEqual({ status: 'offline', lastSeen: contact.toISOString() });
  });
});

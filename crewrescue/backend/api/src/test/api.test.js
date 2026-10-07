import { describe, it, expect } from 'vitest';

describe('Backend API', () => {
  it('should have shared constants accessible', async () => {
    const { ALGORITHMS, ROLES, SKILLS } = await import('@crewrescue/shared');
    expect(ALGORITHMS.GREEDY).toBe('GREEDY');
    expect(ALGORITHMS.SA).toBe('SIMULATED_ANNEALING');
    expect(ALGORITHMS.GA).toBe('GENETIC_ALGORITHM');
    expect(ROLES.SUPER_ADMIN).toBe('SUPER_ADMIN');
    expect(SKILLS.length).toBeGreaterThan(0);
  });

  it('haversine distance should calculate correctly', async () => {
    const { haversineKm } = await import('../solvers/costFunction.js');
    const dist = haversineKm([90.4125, 23.8103], [90.4125, 23.8103]);
    expect(dist).toBeCloseTo(0, 1);
  });
});

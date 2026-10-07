import { describe, it, expect } from 'vitest';

describe('PWA Field App', () => {
  it('should have correct environment config', () => {
    expect(import.meta.env.MODE).toBeDefined();
  });

  it('math operations work', () => {
    expect(2 + 2).toBe(4);
  });
});

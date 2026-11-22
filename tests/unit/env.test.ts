import { describe, expect, it } from 'vitest';
import { detectServingMode } from '../../src/app/env';

describe('detectServingMode', () => {
  it('GitHub Pages en HTTPS → pas d’impression possible', () => {
    expect(detectServingMode({ protocol: 'https:', hostname: 'mvtax.github.io' })).toBe('https');
  });
  it('servie par la passerelle sur le réseau de la boutique', () => {
    expect(detectServingMode({ protocol: 'http:', hostname: '192.168.1.122' })).toBe('bridge');
  });
  it('localhost = développement', () => {
    expect(detectServingMode({ protocol: 'http:', hostname: 'localhost' })).toBe('dev');
  });
});

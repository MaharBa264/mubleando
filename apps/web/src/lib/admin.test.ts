import { describe, expect, it } from 'vitest';
import { parseEmails } from './admin';

describe('parseEmails', () => {
  it('separa por líneas, comas, punto y coma o espacios; pasa a minúsculas y no repite', () => {
    expect(parseEmails('Ana@Example.com\nbea@example.com, ana@example.com; <carla@ejemplo.com.ar>  ')).toEqual({
      valid: ['ana@example.com', 'bea@example.com', 'carla@ejemplo.com.ar'],
      invalid: [],
    });
  });

  it('devuelve aparte lo que no parece un mail', () => {
    expect(parseEmails('ana@example.com sin-arroba x@y')).toEqual({ valid: ['ana@example.com'], invalid: ['sin-arroba', 'x@y'] });
  });

  it('texto vacío: nada', () => {
    expect(parseEmails('  \n ')).toEqual({ valid: [], invalid: [] });
  });
});

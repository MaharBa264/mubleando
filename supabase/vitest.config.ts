import { defineConfig } from 'vitest/config';

// Cada prueba de borrado crea una base de datos Postgres entera en memoria (PGlite): tarda unos segundos.
export default defineConfig({ test: { testTimeout: 60_000, hookTimeout: 60_000 } });

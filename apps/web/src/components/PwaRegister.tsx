'use client';

import { useEffect } from 'react';

/** Registra el service worker solo en producción (en desarrollo estorba a la recarga en caliente). */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* sin SW la app sigue funcionando, solo pierde el modo sin conexión */
    });
  }, []);
  return null;
}

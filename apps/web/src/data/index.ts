import { cloudEnabled } from '@/lib/supabase';
import { cloudData } from './cloud';
import { localData } from './local';

export * from './types';
export { storageAvailable } from './local';

/**
 * La capa de datos que usa toda la app.
 * - Con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY: la nube (cuentas, sincroniza entre dispositivos).
 * - Sin ellas: el navegador (localStorage), como en la fase 1.
 */
export const data = cloudEnabled ? cloudData : localData;
export const dataMode: 'cloud' | 'local' = cloudEnabled ? 'cloud' : 'local';

// Configuración del adaptador OpenNext, que convierte la app de Next.js en un Worker de Cloudflare.
// Por ahora, la configuración por defecto (sin caché incremental: todas las páginas son de cliente).
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig();

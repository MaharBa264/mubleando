// Arranca la app en modo local (sin nube), aunque exista .env.local: para probar pantallas sin entrar.
//   node scripts/dev-local.mjs [puerto]
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const port = process.argv[2] ?? '3101';
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '' };
spawn('npx', ['next', 'dev', '-p', port], { stdio: 'inherit', shell: true, env, cwd: fileURLToPath(new URL('..', import.meta.url)) });

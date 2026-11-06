// =============================================================================
// desplegar-ya — compila producción AHORA, con el último commit de main (6/11/2026)
// =============================================================================
// Un push a main no compila: lo hace un cron una vez por día (lib/desplegar-main-reglas.ts). Esto es para lo que no puede esperar,
// como un cliente roto. Cada compilación cuesta entre US$0,33 y US$0,42. Desde la PC:
//
//   node --env-file=C:/dev/mako-api/.env.local scripts/desplegar-ya.mjs
// =============================================================================

import { execFileSync } from 'node:child_process';

const token = process.env.VERCEL_API_TOKEN;
if (!token) { console.error('Falta VERCEL_API_TOKEN.'); process.exit(1); }
const equipo = process.env.VERCEL_TEAM_SLUG || 'mbustos-4239s-projects';
const sha = execFileSync('git', ['ls-remote', 'origin', 'refs/heads/main'], { encoding: 'utf8' }).split(/\s/)[0];
if (!/^[0-9a-f]{40}$/.test(sha)) { console.error('No pude leer el último commit de main.'); process.exit(1); }
// El despliegue diario no compila con main rojo (lib/desplegar-main-reglas.ts). Esto sí, porque es la emergencia: pero lo dice.
const rojo = execFileSync('git', ['ls-remote', 'origin', 'refs/heads/ci-rojo/main'], { encoding: 'utf8' }).trim();
if (rojo) console.warn('⚠ main está ROJO (ci-rojo/main): estás compilando algo que el chequeo sobre main no aprobó.');
const r = await fetch(`https://api.vercel.com/v13/deployments?forceNew=1&slug=${encodeURIComponent(equipo)}`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'mako', project: 'mako', target: 'production', gitSource: { type: 'github', repoId: 1248884951, ref: 'main', sha } }),
});
const j = await r.json().catch(() => ({}));
if (!r.ok) { console.error(`Vercel contestó ${r.status}: ${JSON.stringify(j).slice(0, 300)}`); process.exit(1); }
console.log(`Compilando ${sha.slice(0, 9)}: ${j.id}. Tarda unos 4 minutos.`);

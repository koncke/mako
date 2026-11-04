#!/usr/bin/env node
// =============================================================================
// agencia-equipo-a-grupos.mts — quienes administran una agencia, en los grupos de MaKo que YA existen de sus clientes
// =============================================================================
// Uso (desde la raíz de un worktree con el código desplegado):
//   Ver qué haría, SIN TOCAR NADA:
//     node --conditions=react-server --env-file=C:/dev/mako-api/.env.local --import tsx scripts/agencia-equipo-a-grupos.mts --agencia=13
//   Hacerlo, con el sí de Martín (agrega gente a grupos de clientes y escribe en esos grupos):
//     ... scripts/agencia-equipo-a-grupos.mts --agencia=13 --aplicar
//   Uno solo:  --cliente=23
//
// POR QUÉ (3/11/2026, Martín): el grupo nuevo de un cliente de agencia ya nace con su equipo adentro (`asegurarGrupoMaKo`); los que ya
// existen no se tocan solos, porque entrar a un grupo de un cliente lo ve el cliente y lo decide Martín.
//
// Sin `--aplicar` sólo LEE: la base y `GET /group/participants`. Los teléfonos salen enmascarados. El tope de la línea es de 5 contactos
// nuevos por cliente y por hora (lib/mako-linea-tope.ts): si alguno queda sin cupo, se vuelve a correr y toma sólo a los que faltan.
// =============================================================================
import { clientesAprobados } from '../lib/agencia-cartera';
import { carteraDeAgencia } from '../lib/agencia';
import { getWorkspace } from '../lib/workspace';
import { aplicarEquipoDeAgencia, planEquipoDeAgencia } from '../lib/mako-grupo';

const arg = (n: string) => process.argv.slice(2).find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const AGENCIA = Number(arg('agencia'));
const SOLO = arg('cliente') ? Number(arg('cliente')) : null;
const APLICAR = process.argv.includes('--aplicar');
if (!Number.isInteger(AGENCIA) || AGENCIA <= 0) { console.error('Falta --agencia=<ws>'); process.exit(2); }

const tel = (t: string) => (t.length > 6 ? `${t.slice(0, 3)}…${t.slice(-3)}` : '…');
// La cartera APROBADA de ESTA agencia: un `--cliente` que no sea suyo no se toca.
const cartera = clientesAprobados(AGENCIA, await carteraDeAgencia(AGENCIA));
if (SOLO != null && !cartera.includes(SOLO)) { console.error(`El ws ${SOLO} no está en la cartera aprobada de la agencia ${AGENCIA}.`); process.exit(2); }

console.log(APLICAR ? `APLICANDO en la agencia ${AGENCIA}` : `Sólo lectura, agencia ${AGENCIA} (con --aplicar se hace)`);
let tocan = 0;
for (const ws of SOLO != null ? [SOLO] : cartera) {
  const nombre = (await getWorkspace(ws).catch(() => null))?.nombre ?? '?';
  const plan = await planEquipoDeAgencia(ws);
  const equipo = [...new Set(plan.agencias.flatMap((a) => a.telefonos))];
  const estado = !plan.jid ? 'sin grupo: entra solo cuando se cree'
    : !plan.adentro ? 'NO PUDE LEER el grupo: no se toca'
      : plan.faltan.length ? `faltan ${plan.faltan.map(tel).join(' ')}` : 'ya están todos';
  console.log(`· ws ${ws} ${nombre} — ${plan.adentro?.length ?? '?'} en el grupo · equipo ${equipo.map(tel).join(' ') || 'nadie con teléfono'} · ${estado}`);
  if (plan.jid && plan.adentro && plan.faltan.length) tocan++;
  if (!APLICAR || !plan.jid || !plan.adentro || !plan.faltan.length) continue;
  const r = await aplicarEquipoDeAgencia(ws);
  if ('ok' in r) { console.log(`    no se aplicó: ${r.error}`); continue; }
  console.log(`    entraron ${r.entraron.map(tel).join(' ') || '—'} · invitados ${r.invitados.map(tel).join(' ') || '—'}${r.fallaron.length ? ` · fallaron ${r.fallaron.map((f) => `${tel(f.telefono)}: ${f.motivo}`).join(' | ')}` : ''}`);
}
console.log(APLICAR ? `Listo: ${tocan} grupo(s) tocados.` : `${tocan} grupo(s) para tocar.`);
process.exit(0);

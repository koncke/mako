// Lo que dibuja /agency de UNA agencia, leído de PRODUCCIÓN y SIN ESCRIBIR: un guardia corta cualquier pedido que no sea GET/HEAD.
// Deja un JSON FUERA del repo (trae nombres y emails de clientes reales: no se commitea).
// Uso, desde el worktree:
//   npx tsx --conditions=react-server --env-file=C:/dev/mako-api/.env.local scripts/banco-agency/leer-prod.mts 13 <salida.json>
import { writeFileSync } from 'node:fs';

const real = globalThis.fetch.bind(globalThis);
const escrituras: string[] = [];
globalThis.fetch = (async (u: RequestInfo | URL, i?: RequestInit) => {
  const m = (i?.method ?? (u instanceof Request ? u.method : 'GET')).toUpperCase();
  if (m !== 'GET' && m !== 'HEAD') { escrituras.push(`${m} ${String(u).slice(0, 120)}`); throw new Error(`escritura bloqueada: ${m}`); }
  return real(u, i);
}) as typeof fetch;

const ws = Number(process.argv[2]);
const salida = process.argv[3];
if (!Number.isSafeInteger(ws) || ws <= 0 || !salida) throw new Error('uso: leer-prod.mts <agenciaWs> <salida.json>');
const { cuentasDePartner } = await import('../../lib/partners');
const { mensualidadDeAgencia, paraLaPantalla } = await import('../../lib/agencia-mes');
const [cartera, m] = await Promise.all([cuentasDePartner(ws), mensualidadDeAgencia(ws)]);
const mensualidad = paraLaPantalla(m);
const enPausa = m.ok ? m.clientes.filter((c) => c.enPausa).map((c) => c.ws) : [];
writeFileSync(salida, JSON.stringify({ leido: new Date().toISOString(), ws, cartera, mensualidad, enPausa }, null, 1));
console.log(JSON.stringify({
  cartera: cartera.ok ? cartera.cuentas.map((c) => `${c.ws} ${c.nombre} · ${c.estado}`) : cartera,
  mensualidad: m.ok ? { prendida: !!m.config, clientes: m.clientes.map((c) => `${c.ws} ${c.nombre} · ${c.situacion.tipo}${c.enPausa ? ' · EN PAUSA' : ''}`) } : m,
  enPausa, escriturasBloqueadas: escrituras,
}, null, 1));
process.exit(0);

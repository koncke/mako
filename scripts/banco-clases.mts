// =============================================================================
// scripts/banco-clases.mts — el banco de casos REALES de los grupos contra el clasificador del grupo (29/10/2026)
// =============================================================================
// Martín: «Que sepa cuándo es un ticket, cuándo es una pregunta, o una acción dentro de MaKo». El banco
// (tests/fixtures/banco-grupos-2910.json) son 76 mensajes reales de 9 grupos más 8 derivados de hechos reales para DEBUG, cada uno con
// su clase a mano. Esto corre, caso por caso, lo MISMO que el turno del grupo:
//   1. la capa 0 por código (la respuesta al equipo, lo que es para otra persona, el acuse, el «sí» a una pendiente);
//   2. las reglas (`clasificarIntencion` + `enElGrupoSinSenal`), que son el piso;
//   3. la IA (`clasificarConIA`, lib/mako-intencion-ia.ts) con el MISMO prompt y el MISMO modelo que producción, llamando a la API de
//      Anthropic con la clave del crédito de los grupos del .env.local (nunca se imprime). No lee la base.
// Mide, como la guía de clasificación de Anthropic: el acierto general, el del 40 % RETENIDO (la partición es por el id, fija), el de
// los difíciles, la matriz de confusión por clase, las herramientas de ESCRITURA entregadas a la clase equivocada (tolerancia cero)
// y, con `--corridas 3`, la consistencia de lo que pasa por IA. Lo que gasta, también.
//
//   node --env-file=<.env.local del clon> --import tsx --conditions=react-server scripts/banco-clases.mts [--corridas 3] [--modelo claude-haiku-4-5] [--sin-ia] [--salida <archivo.json>]
//
// ⚠️ Gasta crédito: el banco entero son ~84 llamadas por corrida (de 1 a 2 mil tokens cada una). Se corre antes de cambiar el prompt
// del clasificador, no en el pre-push.
// =============================================================================

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { clasificarIntencion, sinPrefijoDeLote, type VeredictoIntencion } from '../lib/mako-intencion';
import { enElGrupoSinSenal } from '../lib/doer-hilo';
import { noEsParaMaKo } from '../lib/doer-para-quien';
import { esSoloUnPedidoAMaKo } from '../lib/doer-equipo';
import { clasificarConIA, type ClaseDelModelo, type EntradaDeClase } from '../lib/mako-intencion-ia';

type Caso = {
  // ⚠️ `ws` viene como TEXTO en el fixture («9»): se compara con `Number(c.ws)`. La primera corrida con Haiku (29/10) lo comparaba con
  // el número y el grupo de SuperAdmin entraba como el de un cliente (el DEBUG de conv:1710 salía negado).
  id: string; ws: number | string; texto: string; historial: Array<{ rol: 'persona' | 'mako' | 'equipo'; texto: string }>; quien?: string | null;
  reenviado: boolean; pendiente?: boolean; preguntaDelEquipo?: string | null; clase: string; tambien: string[]; derivado?: boolean; dificil?: boolean;
  /** Las @menciones de WhatsApp (mentionedJid). Sin el campo, se toman del texto; los @ de Instagram de un informe no lo son. */
  menciones?: string[];
};
const CLASES_ORO = ['PREGUNTA', 'ACCION', 'TICKET', 'DEBUG', 'CHARLA', 'OTRO'] as const;

const args = process.argv.slice(2);
const valor = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const CORRIDAS = Math.max(1, Math.min(3, Number(valor('--corridas', '1')) || 1));
const MODELO = valor('--modelo', process.env.MODELO_BANCO || 'claude-haiku-4-5');
const SIN_IA = args.includes('--sin-ia');
const SALIDA = valor('--salida', '');
const CLAVE = process.env.ANTHROPIC_CREDITO_CUENTA1 || process.env.ANTHROPIC_CREDITO_CUENTA2 || '';
if (!SIN_IA && !CLAVE) { console.error('Falta ANTHROPIC_CREDITO_CUENTA1 (o la 2) en el entorno: corre con --env-file del .env.local del clon.'); process.exit(2); }

const { casos: todos } = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'tests', 'fixtures', 'banco-grupos-2910.json'), 'utf8')) as { casos: Caso[] };
/** `--solo conv:1728,conv:1712`: sólo esos casos (un caso nuevo se mide con UNA llamada, sin volver a correr el banco). */
const SOLO = valor('--solo', '').split(',').map((s) => s.trim()).filter(Boolean);
const casos = SOLO.length ? todos.filter((c) => SOLO.includes(c.id)) : todos;
if (SOLO.length && casos.length !== SOLO.length) { console.error(`--solo: no están ${SOLO.filter((id) => !casos.some((c) => c.id === id)).join(', ')}`); process.exit(2); }

/** La partición fija: 40 % retenido por el hash del id (no se toca al ajustar el prompt). */
const retenido = (id: string): boolean => parseInt(createHash('sha256').update(id).digest('hex').slice(0, 8), 16) % 10 < 4;

/** El veredicto llevado a las clases del banco. `no_reply` y lo que la capa 0 deja para otro son OTRO. */
const aOro = (v: VeredictoIntencion | 'OTRO' | 'CHARLA'): string => {
  if (typeof v === 'string') return v;
  switch (v.intencion) {
    case 'charlar': return 'CHARLA';
    case 'no_reply': return 'OTRO';
    case 'ticket': return 'TICKET';
    case 'debug': return 'DEBUG';
    case 'consultar': case 'pensar': return 'PREGUNTA';
    default: return 'ACCION';
  }
};
const ESCRIBE = new Set(['ACCION']);

let tokensIn = 0;
let tokensOut = 0;
let llamadas = 0;
/** El TOPE: una llamada por caso y por corrida, nunca más (con `max_tokens` 200, la corrida entera de Haiku cuesta centavos). */
const TOPE_LLAMADAS = casos.length * CORRIDAS;
async function llamar(system: string, usuario: string): Promise<string> {
  if (llamadas >= TOPE_LLAMADAS) throw new Error(`tope de ${TOPE_LLAMADAS} llamadas`);
  llamadas++;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': CLAVE, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODELO, max_tokens: 200, system, messages: [{ role: 'user', content: usuario }] }),
    signal: AbortSignal.timeout(60_000),
  });
  const j = await r.json() as { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number }; stop_reason?: string; error?: { message?: string } };
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${j.error?.message ?? 'sin detalle'}`);
  tokensIn += j.usage?.input_tokens ?? 0;
  tokensOut += j.usage?.output_tokens ?? 0;
  if (j.stop_reason === 'refusal') throw new Error('refusal');
  return (j.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
}

type Fila = { id: string; oro: string; tambien: string[]; pred: string[]; capa: '0' | 'reglas' | 'ia'; clase: ClaseDelModelo | null; reglas: string; retenido: boolean; dificil: boolean; derivado: boolean };
const filas: Fila[] = [];

for (const c of casos) {
  const texto = c.reenviado ? `(REENVIADO: esto lo escribió OTRA persona y quien te lo manda te lo pasó.)\n${c.texto}` : c.texto;
  const propio = sinPrefijoDeLote(c.texto);
  const base = { id: c.id, oro: c.clase, tambien: c.tambien ?? [], retenido: retenido(c.id), dificil: !!c.dificil, derivado: !!c.derivado };
  // 1. La capa 0, por código.
  const otro = noEsParaMaKo({ texto: propio, menciones: c.menciones ?? [...propio.matchAll(/@(\w+)/g)].map((m) => m[1]), nombraAMaKo: /\bmako\b/i.test(propio), makoPregunto: false, hayPendientes: !!c.pendiente });
  if (c.preguntaDelEquipo && !esSoloUnPedidoAMaKo(propio)) { filas.push({ ...base, pred: ['OTRO'], capa: '0', clase: null, reglas: 'respuesta al equipo' }); continue; }
  if (otro === 'a-otro') { filas.push({ ...base, pred: ['OTRO'], capa: '0', clase: null, reglas: 'a-otro' }); continue; }
  if (otro === 'acuse') { filas.push({ ...base, pred: ['CHARLA'], capa: '0', clase: null, reglas: 'acuse' }); continue; }
  // 2. Las reglas: el piso.
  const reglas = enElGrupoSinSenal(clasificarIntencion(texto, { hayPendientes: !!c.pendiente }), texto);
  if (SIN_IA) { filas.push({ ...base, pred: [aOro(reglas)], capa: 'reglas', clase: null, reglas: `${reglas.intencion}${reglas.dudosa ? '?' : ''}` }); continue; }
  // 3. La IA, con el contexto del turno.
  const entrada: EntradaDeClase = {
    texto, historial: c.historial ?? [], esSuperAdmin: Number(c.ws) === 9, escribeElDueno: Number(c.ws) === 9, pendiente: !!c.pendiente,
    preguntaDelEquipo: c.preguntaDelEquipo ?? null, quien: c.quien ?? null,
  };
  const pred: string[] = [];
  let ultima: ClaseDelModelo | null = null;
  for (let i = 0; i < CORRIDAS; i++) {
    const r = await clasificarConIA(entrada, reglas, llamar).catch(() => null);
    pred.push(r ? aOro(r.veredicto) : aOro(reglas));
    ultima = r?.clase ?? ultima;
  }
  filas.push({ ...base, pred, capa: ultima ? 'ia' : 'reglas', clase: ultima, reglas: `${reglas.intencion}${reglas.dudosa ? '?' : ''}` });
  process.stdout.write('.');
}
process.stdout.write('\n');

// ── Las métricas ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
const bien = (f: Fila) => f.pred[0] === f.oro || f.tambien.includes(f.pred[0]);
const pct = (xs: Fila[]) => (xs.length ? `${xs.filter(bien).length}/${xs.length} (${Math.round((100 * xs.filter(bien).length) / xs.length)} %)` : '—');
const reales = filas.filter((f) => !f.derivado);
console.log(`\nMODELO ${SIN_IA ? '(sin IA: sólo reglas)' : MODELO} · corridas ${CORRIDAS}`);
console.log(`  reales:     ${pct(reales)}`);
console.log(`  retenido:   ${pct(reales.filter((f) => f.retenido))}   (ajuste: ${pct(reales.filter((f) => !f.retenido))})`);
console.log(`  difíciles:  ${pct(filas.filter((f) => f.dificil))}`);
console.log(`  derivados:  ${pct(filas.filter((f) => f.derivado))}`);
console.log('  por clase (reales):');
for (const k of CLASES_ORO) { const xs = reales.filter((f) => f.oro === k); if (xs.length) console.log(`    ${k.padEnd(9)} ${pct(xs)}`); }
// La matriz: fila = la clase de verdad, columna = la que salió.
console.log('  matriz (reales; fila = verdad, columna = salió):');
console.log(`    ${''.padEnd(9)} ${CLASES_ORO.map((k) => k.slice(0, 6).padStart(7)).join('')}`);
for (const k of CLASES_ORO) {
  const xs = reales.filter((f) => f.oro === k);
  if (xs.length) console.log(`    ${k.padEnd(9)} ${CLASES_ORO.map((p) => String(xs.filter((f) => f.pred[0] === p).length).padStart(7)).join('')}`);
}
const escrituraMal = filas.filter((f) => ESCRIBE.has(f.pred[0]) && !ESCRIBE.has(f.oro) && !f.tambien.some((t) => ESCRIBE.has(t)));
console.log(`  escrituras a la clase equivocada: ${escrituraMal.length}${escrituraMal.length ? ` (${escrituraMal.map((f) => f.id).join(', ')})` : ''}`);
if (CORRIDAS > 1) {
  const ia = filas.filter((f) => f.capa === 'ia');
  const estables = ia.filter((f) => f.pred.every((p) => p === f.pred[0]));
  console.log(`  consistencia (${CORRIDAS} corridas): ${estables.length}/${ia.length} iguales`);
}
if (!SIN_IA) console.log(`  gasto: ${llamadas} llamadas · ${tokensIn} tokens de entrada · ${tokensOut} de salida`);
console.log('  errores:');
for (const f of filas.filter((x) => !bien(x))) console.log(`    ✗ ${f.id}${f.retenido ? ' [ret]' : ''}${f.dificil ? ' [dif]' : ''} oro=${f.oro} salió=${f.pred.join('/')} (capa ${f.capa}; reglas ${f.reglas}${f.clase ? `; IA ${f.clase.clase}${f.clase.secundaria ? `+${f.clase.secundaria}` : ''} «${f.clase.resumen.slice(0, 60)}»` : ''})`);
if (SALIDA) writeFileSync(SALIDA, JSON.stringify({ modelo: SIN_IA ? null : MODELO, corridas: CORRIDAS, filas }, null, 1));

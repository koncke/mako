// =============================================================================
// «Sin cobro» (#747): un becado es CLIENTE y no es VENTA
// =============================================================================
// Decisión de Martín (06/10/2026): «un tipo de venta "Sin cobro" en el CRM, que da el
// monto por contestado y queda fuera del ticket promedio». Tres cosas que se prueban
// por separado, porque cada una vive en otro archivo y fallan distinto:
//
//   1. El CRM no le pide monto, plan ni comprobante (lib/stage-requirements.ts, y los
//      CUATRO caminos que arman sus valores). Sin eso, un becado quedaba para siempre en
//      «Datos sin marcar».
//   2. Su monto es NULL, nunca 0 (lib/lead-desenlace.ts).
//   3. Las métricas que suman lo vendido no lo cuentan (un ganado de US$0 baja el ticket),
//      pero la cartera de Customer Success sí (sigue siendo cliente).
//
// Lo de la función se EJECUTA; lo de los callers (server-only, no se pueden importar) se
// lee del fuente sin comentarios — y el barrido de las métricas pregunta por TODA
// lectura que sume `monto_cierre_usd` de ganados, no por las que había hoy.
//
// Probado ROMPIÉNDOLO (07/10/2026), una rotura por vez, restaurando de memoria. Con el
// código como está: 16 pases, 0 fallos. Rota (pases / fallos):
//   · stepsForStage sin el corte de `sinCobro` en el monto                      → 14 / 2
//   · stepsForStage sin el corte en el plan                                     → 15 / 1
//   · desenlaceAlGuardar sin la línea de sin cobro                              → 15 / 1
//   · cuentaComoVenta devuelve true siempre                                     → 15 / 1
//   · faltantesDeLead sin `ventaTipo: lead.venta_tipo`                          → 15 / 1
//   · getRevenuePeriod sin el `.neq` (lib/queries.ts)                           → 15 / 1
//   · _getRevenueBreakdowns sin el `.neq` (lib/pagos.ts)                        → 15 / 1
//   · metricas-negocio sin `&& cuentaComoVenta(r)`                              → 15 / 1
//   · el KPI «Cierres» sin el filtro de venta_tipo (objectives-fuentes)         → 15 / 1
//   · el wizard empuja el paso del monto aunque sea sin cobro                   → 15 / 1
//   · crearClienteAction sin escribir venta_tipo                                → 15 / 1
//   · clientes-ganados sin `sinCobro` (la ficha no lo diría)                    → 15 / 1
// (07/10/2026, arreglos de la revisión: el archivo pasa a 18 tests. Las roturas de los dos
// nuevos —los cuatro constructores de MoveLeadInfo y «Quitar» en las tres superficies—
// están en el comentario de cada uno.)
// Correr: npx tsx --test tests/venta-sin-cobro.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { stepsForStage, funnelReqInfo, type StageReqValues } from '../lib/stage-requirements';
import { desenlaceAlGuardar, type Desenlace } from '../lib/lead-desenlace';
import { VENTA_TIPOS, VENTA_SIN_COBRO, cuentaComoVenta, esSinCobro, ventaTipoDe } from '../lib/venta-tipo';
import { FUNNEL_TEMPLATES } from '../lib/pipeline';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md): un `/*` adentro de un `//` se
// comería el código hasta el próximo `*/`.
const sinComentarios = (s: string) => s
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
const fuente = (p: string) => sinComentarios(leer(p));

/** El cuerpo de una función: desde su firma hasta el `}` en columna 0 que la cierra. */
function bloque(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const fin = src.indexOf('\n}\n', i);
  assert.ok(fin > i, `«${firma}» no cierra`);
  return src.slice(i, fin);
}

const ids = (stage: string, v: StageReqValues) => stepsForStage(stage, v).map((s) => s.id);

// ── 1. El CRM da por contestado monto, plan y comprobante ─────────────────────

/** Un Ganado sin monto, sin plan y con dos cuotas pagadas sin comprobante. */
const GANADO_SIN_NADA: StageReqValues = {
  hoyISO: '2026-10-06',
  fechaJ1: '2026-09-01', asistioJ1: true, calificado: true, hasFathomUrl: true,
  fechaJ2: '2026-09-08', asistioJ2: true,
  monto: null, tienePlan: false, comprobantesFaltantes: 2,
  dealServicioOk: false,
};

test('Ganado SIN el tipo: pide monto, plan y comprobante (lo de siempre)', () => {
  const got = ids('ganado', GANADO_SIN_NADA);
  for (const id of ['monto', 'plan', 'comprobante'] as const) assert.ok(got.includes(id), `falta ${id}: ${got.join(',')}`);
  // 'unico' explícito es lo mismo que no saberlo.
  assert.deepEqual(ids('ganado', { ...GANADO_SIN_NADA, ventaTipo: 'unico' }), got);
});

test('Ganado «sin cobro»: monto, plan y comprobante quedan contestados', () => {
  const got = ids('ganado', { ...GANADO_SIN_NADA, ventaTipo: VENTA_SIN_COBRO });
  assert.ok(!got.includes('monto'), `pidió monto: ${got.join(',')}`);
  assert.ok(!got.includes('plan'), `pidió plan: ${got.join(',')}`);
  assert.ok(!got.includes('comprobante'), `pidió comprobante: ${got.join(',')}`);
  // Lo que NO exime: el servicio se entrega igual, y eso se sigue pidiendo.
  assert.ok(got.includes('dealServicio'), 'un becado igual tiene servicio');
});

test('«sin cobro» también en un funnel sin reuniones (la venta la decide el funnel)', () => {
  const directa = FUNNEL_TEMPLATES.find((t) => t.id === 'directa')!.pipeline;
  const info = funnelReqInfo(directa, 'ganado');
  assert.ok(ids('ganado', { hoyISO: '2026-10-06', monto: null, ...info }).includes('monto'));
  assert.ok(!ids('ganado', { hoyISO: '2026-10-06', monto: null, ventaTipo: VENTA_SIN_COBRO, ...info }).includes('monto'));
});

test('los CUATRO caminos que arman los valores pasan el tipo de venta', () => {
  // Una regla en stepsForStage que un caller no alimenta es una regla que no existe para
  // esa pantalla (docs/hallazgos-crm.md, «El worklist no bajaba la columna»).
  const leads = fuente('lib/leads.ts');
  assert.match(bloque(leads, 'export function faltantesParaMover('), /ventaTipo:\s*lead\.venta_tipo/, 'faltantesParaMover (MaKo, crons)');
  assert.match(bloque(leads, 'export function faltantesDeLead('), /ventaTipo:\s*lead\.venta_tipo/, 'faltantesDeLead («Datos sin marcar»)');
  // El wizard: el tipo EFECTIVO, lo recién elegido gana sobre lo guardado.
  assert.match(bloque(fuente('app/crm/actions.ts'), 'function valoresDeRequisitos('),
    /ventaTipo:\s*d\.ventaTipo \?\? before\?\.venta_tipo/, 'valoresDeRequisitos (lo que el server exige)');
  // El placeholder del diálogo entra en la UNIÓN con el server: si pidiera monto, el
  // wizard lo preguntaría aunque el server no.
  const dlg = fuente('app/crm/StageMoveDialog.tsx');
  const ph = dlg.slice(dlg.indexOf('const [placeholder]'), dlg.indexOf('const [reqServer'));
  assert.ok(ph.length > 200 && ph.length < 4000, `recorte del placeholder: ${ph.length}`);
  assert.match(ph, /ventaTipo:\s*lead\.ventaTipo/, 'el placeholder del StageMoveDialog');
  // Y PENDIENTES_COLS (el worklist) baja la columna: sin ella llega undefined.
  assert.match(fuente('lib/queries.ts'), /const PENDIENTES_COLS =[\s\S]{0,900}venta_tipo/);
});

/** Desde el `{` que abre en `desde` hasta el `}` que lo cierra (las llaves de estos
 *  literales no viven adentro de strings ni de templates: se cuenta sin más). */
function hastaQueCierra(src: string, desde: number): string {
  const ini = src.indexOf('{', desde);
  let prof = 0;
  for (let i = ini; i < src.length; i++) {
    if (src[i] === '{') prof++;
    else if (src[i] === '}' && --prof === 0) return src.slice(ini, i + 1);
  }
  throw new Error(`no cierra la llave de ${desde}`);
}

test('los CUATRO constructores de MoveLeadInfo pasan el tipo de venta, y el tablero lo baja', () => {
  // El placeholder lee `lead.ventaTipo`: el test de arriba fija eso. Lo que no fijaba es QUIÉN
  // lo llena. Medido el 07/10/2026: `leadToMoveInfo` (el tablero: «Completar ahora», el «¿Qué
  // hacer ahora?» y Solucionar sin faltantes) y el de GeneratedInsightCard no lo pasaban. A un
  // becado ya marcado el wizard le volvía a pedir el monto con «Pago único» elegido, y
  // «Guardar y completar después» escribía `venta_tipo = 'unico'` (el becado volvía a contar
  // como venta de US$0). La bitácora de products-offers ya lo advertía: «cablear los 4
  // constructores de MoveLeadInfo».
  //
  // EL BARRIDO, no la lista de hoy: un quinto constructor sin el tipo falla acá con su archivo.
  // Probado ROMPIÉNDOLO (07/10/2026), una rotura por vez, restaurando de memoria (pases /
  // fallos de ESTE archivo, que con todo en su lugar da 18 / 0):
  //   · `leadToMoveInfo` sin `ventaTipo: l.ventaTipo`                        → 17 / 1
  //   · GeneratedInsightCard sin `ventaTipo: lead.venta_tipo ?? null`        → 17 / 1
  //   · LeadSheet sin su `ventaTipo` (el constructor que ya estaba)          → 17 / 1
  //   · el mapper del tablero (crm-map) sin `ventaTipo: l.venta_tipo`        → 17 / 1
  //     (y además el typecheck: TS2741, `CrmLead.ventaTipo` es obligatorio a propósito)
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter((f) => /\.tsx?$/.test(f));
  const sinTipo: string[] = [];
  const vistos: string[] = [];
  for (const f of archivos) {
    const src = fuente(f);
    // Los dos moldes: `const x: MoveLeadInfo = { … }` y `function f(…): MoveLeadInfo { return { … } }`.
    const re = /:\s*MoveLeadInfo\s*(=\s*)?\{/g;
    for (let m = re.exec(src); m; m = re.exec(src)) {
      const cuerpo = hastaQueCierra(src, m.index);
      const donde = `${f}:${src.slice(0, m.index).split('\n').length}`;
      vistos.push(donde);
      if (!/\bventaTipo:/.test(cuerpo)) sinTipo.push(donde);
    }
  }
  assert.deepEqual(sinTipo, [], `arman el wizard sin el tipo de venta: ${sinTipo.join(' · ')}`);
  // Si baja de cuatro, el barrido dejó de ver lo que tiene que ver.
  assert.ok(vistos.length >= 4, `vio ${vistos.length}: ${vistos.join(' · ')}`);
  // El del tablero lee `CrmLead`, que lo arma el mapper desde LISTA_COLS.
  assert.match(bloque(fuente('app/crm/crm-map.ts'), 'export function mapToCrmLead('), /ventaTipo:\s*l\.venta_tipo/, 'el mapper del tablero');
  assert.match(fuente('lib/leads.ts'), /const LISTA_COLS =[\s\S]{0,600}\bventa_tipo\b/, 'LISTA_COLS baja la columna');
});

test('el wizard ofrece «Sin cobro» y saltea el monto y el plan', () => {
  const dlg = fuente('app/crm/StageMoveDialog.tsx');
  assert.match(dlg, /setVentaTipo\('sin_cobro'\)/, 'el botón de la opción');
  assert.match(dlg, /if \(ventaTipo !== 'sin_cobro'\) p\.push\('monto'\)/, 'el paso del monto se saltea');
  assert.match(dlg, /requeridos\.has\('plan'\) && ventaTipo !== 'suscripcion' && ventaTipo !== 'sin_cobro'\) p\.push\('plan'\)/);
  // Sin paso de monto, el tipo tiene que viajar igual (por su propio paso) y con monto null.
  assert.match(dlg, /pide\('monto'\) \|\| pide\('ventaTipo'\) \? \{\s*monto: esSuscripcion \|\| sinCobro \? null/);
  // El server, al pasar a sin cobro, limpia un monto viejo y lo deja en el historial.
  const mover = bloque(fuente('app/crm/actions.ts'), 'export async function completeStageMoveAction(');
  assert.match(mover, /if \(esSinCobro\(d\.ventaTipo\)\) sub\.monto_cierre_usd = null;/);
  assert.match(mover, /logLeadEvent\(id, 'Tipo de venta'/);
});

// ── 2. Su monto es NULL, nunca 0 ─────────────────────────────────────────────

const GANADO: Desenlace = { estado_lead: 'ganado', cerro: true, motivo_perdida: null, monto_cierre_usd: null, fecha_cierre: '2026-10-01' };

test('desenlace: un 0 de un becado se guarda NULL y no tira', () => {
  const m = desenlaceAlGuardar(GANADO, { monto_cierre_usd: 0 }, '2026-10-06', VENTA_SIN_COBRO);
  assert.equal(m.monto_cierre_usd, null);
  // El movimiento a Ganado (lo que manda setPipelineStage) también.
  const abierto: Desenlace = { ...GANADO, estado_lead: 'abierto', cerro: null, fecha_cierre: null };
  const mov = desenlaceAlGuardar(abierto, { estado_lead: 'ganado', monto_cierre_usd: 0 }, '2026-10-06', VENTA_SIN_COBRO);
  assert.equal(mov.monto_cierre_usd, null);
  assert.equal(mov.cerro, true);
  assert.equal(mov.fecha_cierre, '2026-10-06');
});

test('desenlace: sin el tipo, un 0 sigue tirando (pago único: el 0 es un error)', () => {
  assert.throws(() => desenlaceAlGuardar(GANADO, { monto_cierre_usd: 0 }, '2026-10-06'), /positivo/);
  assert.throws(() => desenlaceAlGuardar(GANADO, { monto_cierre_usd: 0 }, '2026-10-06', 'unico'), /positivo/);
});

test('desenlace: un monto POSITIVO en un becado no se borra en silencio', () => {
  // Lo tipeó alguien: borrarlo sería un «guardado» que no guardó. Las métricas igual
  // excluyen la fila entera por el tipo.
  assert.equal(desenlaceAlGuardar(GANADO, { monto_cierre_usd: 500 }, '2026-10-06', VENTA_SIN_COBRO).monto_cierre_usd, 500);
});

test('updateLead le pasa al desenlace el tipo de venta del lead', () => {
  assert.match(bloque(fuente('lib/leads.ts'), 'export async function updateLead('),
    /desenlaceAlGuardar\(actual, input, [^;]*actual\.venta_tipo\)/);
});

// ── 3. Las métricas de venta no lo cuentan; la cartera sí ─────────────────────

test('el tipo: la lista, el predicado y lo desconocido', () => {
  assert.deepEqual([...VENTA_TIPOS], ['unico', 'suscripcion', 'sin_cobro']);
  assert.equal(esSinCobro('sin_cobro'), true);
  assert.equal(esSinCobro(null), false);
  assert.equal(ventaTipoDe('sin_cobro'), 'sin_cobro');
  assert.equal(ventaTipoDe('cualquiera'), 'unico');
  assert.equal(ventaTipoDe(undefined), 'unico');
});

test('el ticket promedio no baja por un becado', () => {
  // Lo que hace cualquiera que lea `ingreso_usd / ganados` (metricas-negocio) o
  // «Sold · N cierres» (/comercial): el becado, contado, es una venta de US$0.
  const ganados = [
    { venta_tipo: 'unico', monto_cierre_usd: 1000 },
    { venta_tipo: 'unico', monto_cierre_usd: 3000 },
    { venta_tipo: 'sin_cobro', monto_cierre_usd: null },
    // Una fila que no bajó la columna cuenta como venta, como antes del tipo.
    { monto_cierre_usd: 2000 },
  ];
  const ventas = ganados.filter(cuentaComoVenta);
  const ticket = ventas.reduce((s, v) => s + Number(v.monto_cierre_usd ?? 0), 0) / ventas.length;
  assert.equal(ventas.length, 3);
  assert.equal(ticket, 2000);
});

test('toda lectura que suma `monto_cierre_usd` de ganados excluye los «sin cobro»', () => {
  // EL BARRIDO, no la lista de hoy: una métrica nueva que sume lo vendido sin el filtro
  // falla acá con su archivo y su línea. La sentencia va desde el `.select(` hasta el
  // primer `)` que cierra la cadena (`),` · `);`).
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter((f) => /\.tsx?$/.test(f));
  assert.ok(archivos.length > 500, `git ls-files devolvió ${archivos.length}`);
  const malos: string[] = [];
  const vistos: string[] = [];
  for (const f of archivos) {
    const src = fuente(f);
    const re = /\.select\('[^']*\bmonto_cierre_usd\b[^']*'\)/g;
    for (let m = re.exec(src); m; m = re.exec(src)) {
      const resto = src.slice(m.index);
      const fin = resto.search(/\)\s*[,;]/);
      const sentencia = resto.slice(0, fin === -1 ? 800 : fin + 1);
      if (!/\.eq\('cerro', true\)|\.eq\('estado_lead', 'ganado'\)/.test(sentencia)) continue;
      const linea = src.slice(0, m.index).split('\n').length;
      vistos.push(`${f}:${linea}`);
      if (!/\.neq\('venta_tipo', VENTA_SIN_COBRO\)/.test(sentencia)) malos.push(`${f}:${linea}`);
    }
  }
  assert.deepEqual(malos, [], `suman lo vendido contando a los becados: ${malos.join(' · ')}`);
  // Si esto baja, el barrido dejó de ver lo que tiene que ver (Sold del período, la
  // serie mensual, el objetivo, el desglose del Sold y el KPI «Firmado»).
  assert.ok(vistos.length >= 5, `vio ${vistos.length}: ${vistos.join(' · ')}`);
});

test('las métricas que cuentan en JS o por conteo también lo excluyen', () => {
  const neg = bloque(fuente('lib/metricas-negocio.ts'), 'export async function reporteMetricas(');
  assert.match(neg, /'id, created_at,[^']*\bventa_tipo'/, 'la lectura baja venta_tipo');
  assert.match(neg, /r\.cerro === true && cuentaComoVenta\(r\)/, 'ganados / ingreso_usd');
  const obj = fuente('lib/objectives-fuentes.ts');
  assert.match(obj, /cierres: \(desde, hasta\) => contar\('leads', \[[^\]]*\{ col: 'venta_tipo', op: 'neq', val: VENTA_SIN_COBRO \}/, 'el KPI «Cierres»');
  assert.match(obj, /f\.op === 'neq'\) q = q\.neq\(/, '`contar` sabe hacer un neq');
  // El aviso de recorte cuenta el MISMO universo que la lectura que vigila.
  const run = fuente('lib/api-mako/areas/metricas.run.ts');
  const conteos = run.match(/contarFilas\('leads', \(q\) => q\.eq\('cerro', true\)[^\n]*/g) ?? [];
  assert.ok(conteos.length >= 2, `conteos de cierres: ${conteos.length}`);
  for (const c of conteos) assert.match(c, /\.neq\('venta_tipo', VENTA_SIN_COBRO\)/, c);
});

test('la cartera de Customer Success SÍ lo cuenta, y la ficha lo dice', () => {
  const cartera = bloque(fuente('lib/clientes-ganados.ts'), 'export async function clientesGanados(');
  assert.doesNotMatch(cartera, /VENTA_SIN_COBRO|neq\(/, 'un becado sigue siendo cliente');
  assert.match(cartera, /fecha_cierre, venta_tipo'/, 'la lectura baja venta_tipo');
  assert.match(cartera, /sinCobro: esSinCobro\(l\.venta_tipo\)/);
  assert.match(fuente('app/customer-success/FichaCliente.tsx'), /\{c\.sinCobro && <span className="id"> · Sin cobro<\/span>\}/);
});

test('el alta de Customer Success acepta el flag y lo escribe DESPUÉS de ganarlo', () => {
  const alta = bloque(fuente('app/customer-success/actions.ts'), 'export async function crearClienteAction(');
  assert.match(alta, /sinCobro\?: boolean/);
  const gana = alta.indexOf("updateLead(lead.id, { estado_lead: 'ganado' })");
  const marca = alta.search(/if \(datos\.sinCobro === true\) \{[\s\S]{0,200}update\(\{ venta_tipo: VENTA_SIN_COBRO \}\)/);
  assert.ok(gana > 0 && marca > gana, `orden: ganado ${gana} · sin cobro ${marca}`);
  const nuevo = fuente('app/customer-success/NuevoCliente.tsx');
  assert.match(nuevo, /crearClienteAction\(\{[^}]*\bsinCobro\b[^}]*\}\)/, 'el modal manda el flag');
  assert.match(nuevo, /<Checkbox checked=\{sinCobro\}/, 'y lo pregunta');
});

test('un «sin cobro» marcado por error tiene salida (la tarjeta del Deal)', () => {
  // El wizard ofrece el tipo sólo cuando falta el monto, y a un becado nunca le falta.
  const acc = bloque(fuente('app/crm/[id]/deal-actions.ts'), 'export async function quitarSinCobroAction(');
  assert.match(acc, /\.eq\('venta_tipo', VENTA_SIN_COBRO\)/, 'compare-and-set sobre el tipo');
  assert.match(fuente('app/crm/[id]/DealDetailsCard.tsx'), /esSinCobro\(ventaTipo\) && \([\s\S]{0,600}onClick=\{quitarSinCobro\}/);
});

test('«Quitar "Sin cobro"» se ve en las TRES superficies, no sólo donde el refresh llega', () => {
  // Medido el 07/10/2026: la tarjeta sólo hacía `router.refresh()`, y en dos de sus tres
  // montajes el lead es estado de cliente leído por una action (LeadSheet vía
  // getLeadFullAction, y la pestaña Pagos de CS vía pagosDeClienteAction). Tras un clic que
  // SÍ escribió, la tarjeta seguía diciendo «Sin cobro»; el segundo clic chocaba con el
  // compare-and-set (0 filas, sin error) y el botón parecía muerto. Y «Completar datos» en
  // esa ficha volvía a escribir `sin_cobro` desde el lead viejo.
  //
  // Probado ROMPIÉNDOLO (07/10/2026), una rotura por vez, restaurando de memoria (pases /
  // fallos; entero: 18 / 0):
  //   · la action no devuelve el tipo (`Promise<{ cambio: boolean }>`)        → 17 / 1
  //   · con 0 filas no relee el tipo DE ESE lead                              → 17 / 1
  //   · la tarjeta pinta con `esSinCobro(lead.venta_tipo)` (sin lo devuelto)  → 16 / 2
  //   · la tarjeta no guarda lo devuelto (`setTipoLeido`)                     → 17 / 1
  //   · un clic que no escribió no dice nada                                  → 17 / 1
  //   · la tarjeta no llama a `onCambio`                                      → 17 / 1
  //   · LeadSheet monta la tarjeta sin `onCambio`                             → 17 / 1
  //   · la ficha de CS no le pasa `onCambio` a PagosCliente                   → 17 / 1
  const acc = bloque(fuente('app/crm/[id]/deal-actions.ts'), 'export async function quitarSinCobroAction(');
  assert.match(acc, /Promise<\{ cambio: boolean; ventaTipo: VentaTipo \| null \}>/, 'devuelve si escribió y el tipo que quedó');
  assert.match(acc, /return \{ cambio: true, ventaTipo: 'unico' \}/);
  // Con 0 filas, el tipo se LEE: «ya no era sin cobro» puede ser cualquier otro.
  assert.match(acc, /\.select\('venta_tipo'\)\.eq\('id', leadId\)\.maybeSingle\(\)[\s\S]*return \{ cambio: false, ventaTipo: ventaTipoDe\(/);

  const card = fuente('app/crm/[id]/DealDetailsCard.tsx');
  // La tarjeta se pinta con lo DEVUELTO mientras el prop no cambie; cuando el prop trae el
  // dato nuevo, gana el prop.
  assert.match(card, /const ventaTipo = tipoLeido && tipoLeido\.sobre === \(lead\.venta_tipo \?\? null\) \? tipoLeido\.es : \(lead\.venta_tipo \?\? null\);/);
  assert.doesNotMatch(card, /esSinCobro\(lead\.venta_tipo\)|lead\.venta_tipo === 'suscripcion'/, 'ninguna línea del tipo lee el prop pelado');
  const quitar = card.slice(card.indexOf('const quitarSinCobro = () => {'), card.indexOf('const undoPagoToast'));
  assert.ok(quitar.length > 100 && quitar.length < 1500, `recorte de quitarSinCobro: ${quitar.length}`);
  assert.match(quitar, /setTipoLeido\(\{ sobre, es: r\.ventaTipo \}\)/, 'pinta lo devuelto');
  assert.match(quitar, /if \(!r\.cambio\) setFeedback\(/, 'un clic que no escribió lo dice');
  assert.match(quitar, /onCambio\?\.\(\{ venta_tipo: r\.ventaTipo \}\)/, 'avisa al contenedor');

  // Los montajes con el lead en estado de cliente le pasan `onCambio` y lo aplican.
  assert.match(fuente('app/crm/LeadSheet.tsx'), /<DealDetailsCard lead=\{lead\} pagos=\{pagos\} onCambio=\{\(patch\) => \{\s*setFresca\(\{ \.\.\.vigente, lead: \{ \.\.\.vigente\.lead, \.\.\.patch \} \}\)/);
  assert.match(fuente('app/customer-success/FichaPestanas.tsx'), /<DealDetailsCard lead=\{datos\.lead\} pagos=\{datos\.pagos\} onCambio=\{onCambio\} \/>/);
  assert.match(fuente('app/customer-success/FichaCliente.tsx'), /<PagosCliente datos=\{crm \?\? 'cargando'\}\s*onCambio=\{\(patch\) => setCrm\(/);
  // Y la ruta /crm/[id] NO lo necesita: su lead viene del server (el refresh lo trae). Si
  // aparece un montaje nuevo, decide acá en cuál de las dos listas va.
  const montajes = execFileSync('git', ['ls-files', 'app'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter((f) => /\.tsx$/.test(f) && /<DealDetailsCard\b/.test(fuente(f))).sort();
  assert.deepEqual(montajes, [
    'app/crm/LeadSheet.tsx',               // estado de cliente → onCambio
    'app/crm/[id]/EditarDeal.tsx',         // ruta /crm/[id]: props del server
    'app/crm/[id]/page.tsx',               // ruta /crm/[id]: server component
    'app/customer-success/FichaPestanas.tsx', // estado de cliente → onCambio
  ]);
});

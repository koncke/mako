// =============================================================================
// Ganado: el wizard PREGUNTA el monto, la tarjeta MUESTRA lo guardado y una
// suscripción se puede CORREGIR (08/10/2026)
// =============================================================================
// Pedido de Leila (ws11), sobre el «Revisa y confirma» que mostraba «Suscripción:
// $4,235.29/mes · 12 meses»: «aquí no me preguntó cuánto es, puso el monto que se le
// cantó», y con la tarjeta de Ganado en $0: «y ni siquiera lo guardó».
//
// Eran cuatro fallas encadenadas, y ninguna era que se perdiera el dato:
//   1. Leer el contrato hacía `setMonto(total)` + `ok.add('monto')`: el paso del monto
//      salía de la lista y nunca se preguntaba. El número era el TOTAL del contrato
//      (72.000 MXN / 17 = 4.235,29); al elegir «Suscripción» después, quedó como MENSUALIDAD.
//   2. La suscripción se guarda en `suscripcion_monto_usd`, y la tarjeta leía
//      `monto_cierre_usd ?? 0` → «$0». Fabi tenía 444 guardados.
//   3. Ni la mensualidad ni el plazo estaban en AUDIT_FIELDS: el historial no lo decía.
//   4. Deal Details mostraba «USD X/mes» sin dejar editarlo, y reabrir el wizard sobre una
//      suscripción ya guardada pedía el monto vacío (el placeholder no pasaba
//      `suscripcionMonto`, los constructores tampoco) y GUARDABA NULL encima.
//
// Lo puro se EJECUTA (el helper de la tarjeta, y el mapper del tablero en un hijo con
// --conditions=react-server, porque importa lib/queries). Lo de los componentes y las
// actions (server-only) se lee del fuente sin comentarios.
//
// Probado ROMPIÉNDOLO (08/10/2026), una rotura por vez, restaurando de memoria. Con el
// código como está: 8 pases, 0 fallos. Rota (pases / fallos):
//   · montoDeTarjeta sin la rama de suscripción (cae al monto de cierre)        → 6 / 2
//   · montoDeTarjeta sin la rama de «sin cobro»                                 → 7 / 1
//   · crm-map sin `...suscripcionDeFila(l)` (además: TS2739 en el typecheck)    → 6 / 2
//   · buscarDealAuto vuelve a hacer `ok.add('monto')`                           → 7 / 1
//   · la precarga del monto sin el corte `pideMonto` (= requeridos.has)         → 7 / 1
//   · elegir «Suscripción» no vacía el total del contrato                       → 7 / 1
//   · el placeholder sin `suscripcionMonto`                                     → 7 / 1
//   · LeadSheet sin `...suscripcionDeFila(lead)` (además: TS2739)               → 7 / 1
//   · AUDIT_FIELDS sin `suscripcion_monto_usd`                                  → 7 / 1
//   · REVERTIBLES sin CAMPO_SUS_MESES                                           → 7 / 1
//   · saveDealSectionsAction sin el compare-and-set sobre venta_tipo            → 7 / 1
//   · DealDetailsCard sin el campo «Mensualidad (USD)»                          → 7 / 1
//   · la lista del tablero vuelve a dibujar `'$' + l.monto`                     → 7 / 1
// Correr: npx tsx --test tests/ganado-monto.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { montoDeTarjeta, suscripcionDeFila } from '../lib/venta-tipo';
import { stepsForStage, type StageReqValues } from '../lib/stage-requirements';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md): un `/*` adentro de un `//` se
// comería el código hasta el próximo `*/`.
const sinComentarios = (s: string) => s
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
const fuente = (p: string) => sinComentarios(leer(p));

/** El tramo entre dos marcas. Tira si alguna no está, o si el recorte es absurdo. */
function tramo(src: string, desde: string, hasta: string, max = 8000): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  const t = src.slice(i, j);
  assert.ok(t.length < max, `recorte de «${desde}»: ${t.length}`);
  return t;
}

/** Desde el `{` que abre en `desde` hasta el `}` que lo cierra. */
function hastaQueCierra(src: string, desde: number): string {
  const ini = src.indexOf('{', desde);
  let prof = 0;
  for (let i = ini; i < src.length; i++) {
    if (src[i] === '{') prof++;
    else if (src[i] === '}' && --prof === 0) return src.slice(ini, i + 1);
  }
  throw new Error(`no cierra la llave de ${desde}`);
}

// ── 1. La tarjeta de Ganado ───────────────────────────────────────────────────

test('la tarjeta dibuja la mensualidad de una suscripción, «Sin cobro» de un becado y el monto del resto', () => {
  // Fabi (ws11): 444/mes guardados, monto de cierre NULL → la tarjeta decía «$0».
  assert.deepEqual(montoDeTarjeta({ ventaTipo: 'suscripcion', monto: 0, suscripcionMonto: 444 }), { texto: '$444/mes', valor: 444 });
  assert.equal(montoDeTarjeta({ ventaTipo: 'suscripcion', monto: 0, suscripcionMonto: 4235.29 }).texto, '$4,235.29/mes');
  // Una suscripción sin mensualidad dice que falta, no inventa el monto de cierre.
  assert.deepEqual(montoDeTarjeta({ ventaTipo: 'suscripcion', monto: 40, suscripcionMonto: null }), { texto: '$0/mes', valor: 0 });
  assert.deepEqual(montoDeTarjeta({ ventaTipo: 'sin_cobro', monto: 0, suscripcionMonto: null }), { texto: 'Sin cobro', valor: 0 });
  // El resto, igual que antes (y una mensualidad vieja colgada no cuenta).
  assert.deepEqual(montoDeTarjeta({ ventaTipo: 'unico', monto: 1500, suscripcionMonto: 99 }), { texto: '$1,500', valor: 1500 });
  assert.deepEqual(montoDeTarjeta({ ventaTipo: null, monto: 0, suscripcionMonto: null }), { texto: '$0', valor: 0 });
});

test('suscripcionDeFila sólo devuelve la plata si la fila ES una suscripción', () => {
  assert.deepEqual(suscripcionDeFila({ venta_tipo: 'suscripcion', suscripcion_monto_usd: 444, suscripcion_meses: null }), { suscripcionMonto: 444, suscripcionMeses: null });
  // PostgREST puede devolver numeric como texto.
  assert.deepEqual(suscripcionDeFila({ venta_tipo: 'suscripcion', suscripcion_monto_usd: '4235.29', suscripcion_meses: '12' }), { suscripcionMonto: 4235.29, suscripcionMeses: 12 });
  // Una mensualidad vieja de cuando era suscripción no reabre el wizard dando el monto por cargado.
  assert.deepEqual(suscripcionDeFila({ venta_tipo: 'unico', suscripcion_monto_usd: 444, suscripcion_meses: 6 }), { suscripcionMonto: null, suscripcionMeses: null });
});

test('el mapper del tablero + el helper dan la mensualidad (el caso de Fabi, ejecutado)', () => {
  const crmMap = JSON.stringify(resolve(RAIZ, 'app/crm/crm-map.ts'));
  const ventaTipo = JSON.stringify(resolve(RAIZ, 'lib/venta-tipo.ts'));
  const codigo = `
    import { pathToFileURL } from 'node:url';
    const { mapToCrmLead } = await import(pathToFileURL(${crmMap}).href);
    const { montoDeTarjeta } = await import(pathToFileURL(${ventaTipo}).href);
    const base = { id: 2606, nombre: 'Prueba', estado_lead: 'ganado', created_at: '2026-10-08T00:00:00Z' };
    const fabi = mapToCrmLead({ ...base, venta_tipo: 'suscripcion', suscripcion_monto_usd: 444, suscripcion_meses: null, monto_cierre_usd: null }, {});
    const unico = mapToCrmLead({ ...base, venta_tipo: 'unico', monto_cierre_usd: 1500, suscripcion_monto_usd: 444 }, {});
    console.log(JSON.stringify({
      fabi: { monto: fabi.monto, suscripcionMonto: fabi.suscripcionMonto, suscripcionMeses: fabi.suscripcionMeses, texto: montoDeTarjeta(fabi).texto },
      unico: { suscripcionMonto: unico.suscripcionMonto, texto: montoDeTarjeta(unico).texto },
    }));
  `;
  const out = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', timeout: 170_000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const linea = out.trim().split('\n').filter((x) => x.startsWith('{')).pop();
  assert.ok(linea, `el hijo no devolvió JSON:\n${out}`);
  const r = JSON.parse(linea) as { fabi: { monto: number; suscripcionMonto: number | null; suscripcionMeses: number | null; texto: string }; unico: { suscripcionMonto: number | null; texto: string } };
  // El monto de cierre sigue en 0 (la columna es NULL a propósito): la plata viaja aparte.
  assert.deepEqual(r.fabi, { monto: 0, suscripcionMonto: 444, suscripcionMeses: null, texto: '$444/mes' });
  assert.deepEqual(r.unico, { suscripcionMonto: null, texto: '$1,500' });
  // Y los tres lugares del tablero dibujan / ordenan con el helper, no con el monto pelado.
  const board = fuente('app/crm/CrmBoard.tsx');
  assert.equal((board.match(/isGanado \? montoDeTarjeta\(l\)\.texto/g) ?? []).length, 2, 'la tarjeta y la lista');
  assert.match(board, /case 'monto':\s*return signo \* \(montoDeTarjeta\(a\)\.valor - montoDeTarjeta\(b\)\.valor\)/, 'el orden por monto');
  assert.doesNotMatch(board, /isGanado \? fmt\(l\.monto\)/);
});

// ── 2. El wizard PREGUNTA el monto ────────────────────────────────────────────

test('leer el contrato PRECARGA el monto y deja el paso a la vista (sin ok.add), sólo si se pide', () => {
  const dlg = fuente('app/crm/StageMoveDialog.tsx');
  const leerContrato = tramo(dlg, 'const buscarDealAuto = async', 'const subirFiscalDoc = async');
  // El paso del monto no se da por contestado: es lo que lo hacía desaparecer.
  assert.doesNotMatch(leerContrato, /ok\.add\(\s*'monto'\s*\)/, 'el contrato no puede resolver el paso del monto');
  // Precargar SÓLO si el monto se pide: si no, pisaba una suscripción ya cargada con el total.
  assert.match(leerContrato, /const pideMonto = requeridos\.has\('monto'\);/);
  assert.match(leerContrato, /if \(pideMonto && j\.total_usd != null && total > 0\) \{[\s\S]{0,600}setMonto\(String\(total\)\)/);
  // El total no entra al campo de una suscripción: «Guardar y completar después» lo guardaría
  // como mensualidad sin que nadie viera el paso.
  assert.match(leerContrato, /if \(!monto\.trim\(\) && ventaTipo !== 'suscripcion'\) setMonto\(String\(total\)\);/);
  // Y elegir «Suscripción» con el total intacto lo vacía (el contrato se lee ANTES del tipo).
  const elegir = tramo(dlg, 'const elegirTipoConContrato = (t: VentaTipo) => {', '};', 600);
  assert.match(elegir, /if \(t === 'suscripcion' && monto\.trim\(\) === total\) setMonto\(''\);/);
  assert.match(dlg, /onClick=\{\(\) => elegirTipoConContrato\('suscripcion'\)\}/, 'el botón de la suscripción');
  assert.match(dlg, /onClick=\{\(\) => elegirTipoConContrato\('unico'\)\}/, 'el botón del pago único');
  // El reporte no dice «Se completó» de un monto que todavía no se guardó.
  assert.doesNotMatch(leerContrato, /rell\.push\(\s*['`]monto/);
  // Los meses del contrato NO se precargan como plazo («6 meses» era la implementación).
  assert.doesNotMatch(leerContrato, /setSusMeses\(/);
  // Y el plan de cuotas conserva su comportamiento (mostrarlo trababa «Siguiente»).
  assert.match(leerContrato, /ok\.add\('plan'\)/);
  // El paso del monto muestra lo que dijo el contrato y sugiere total/meses como botón.
  const pasoMonto = tramo(dlg, "case 'monto': {", "case 'susPlazo':");
  assert.match(pasoMonto, /Del contrato: US\$\{delContrato\.total/);
  assert.match(pasoMonto, /delContrato\.total \/ delContrato\.meses/);
  assert.match(pasoMonto, /onClick=\{\(\) => setMonto\(String\(sugerida\)\)\}/);
});

test('reabrir una suscripción guardada: el placeholder pasa la mensualidad igual que el server', () => {
  // Medido con stepsForStage sobre una suscripción ya guardada (Fabi: 444/mes, sin pagos).
  // Sin la mensualidad el wizard vuelve a pedir el monto —vacío— y guardar escribe NULL.
  const base: StageReqValues = { hoyISO: '2026-10-08', fechaJ1: '2026-10-01', asistioJ1: true, calificado: true, hasFathomUrl: true, sinR2: true, monto: null, ventaTipo: 'suscripcion', tienePlan: true };
  assert.ok(stepsForStage('ganado', base).some((s) => s.id === 'monto'), 'sin la mensualidad pide el monto');
  assert.ok(!stepsForStage('ganado', { ...base, suscripcionMonto: 444 }).some((s) => s.id === 'monto'), 'con la mensualidad, no');

  const dlg = fuente('app/crm/StageMoveDialog.tsx');
  const ph = tramo(dlg, 'const [placeholder]', 'const [reqServer', 4000);
  assert.match(ph, /suscripcionMonto:\s*ventaTipoDe\(lead\.ventaTipo\) === 'suscripcion' \? lead\.suscripcionMonto : null/, 'la regla del server (valoresDeRequisitos)');
  assert.match(fuente('app/crm/actions.ts'), /suscripcionMonto: \(d\.ventaTipo \?\? before\?\.venta_tipo\) === 'suscripcion'/, 'la regla que copia');
  // El campo arranca con la mensualidad, no con el monto de cierre (null en una suscripción).
  assert.match(dlg, /const m = ventaTipoDe\(lead\.ventaTipo\) === 'suscripcion' \? lead\.suscripcionMonto : lead\.monto;/);
});

test('los CUATRO constructores de MoveLeadInfo pasan la mensualidad y el plazo', () => {
  // Mismo barrido que el del tipo de venta (tests/venta-sin-cobro.test.ts): un quinto
  // constructor sin la plata de la suscripción falla acá con su archivo. Los campos además
  // son OBLIGATORIOS en el tipo, así que el typecheck también lo dice.
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter((f) => /\.tsx?$/.test(f));
  const sinPlata: string[] = [];
  const vistos: string[] = [];
  for (const f of archivos) {
    const src = fuente(f);
    const re = /:\s*MoveLeadInfo\s*(=\s*)?\{/g;
    for (let m = re.exec(src); m; m = re.exec(src)) {
      const cuerpo = hastaQueCierra(src, m.index);
      const donde = `${f}:${src.slice(0, m.index).split('\n').length}`;
      vistos.push(donde);
      const ok = /\.\.\.suscripcionDeFila\(lead\)/.test(cuerpo)
        || (/\bsuscripcionMonto:\s*l\.suscripcionMonto\b/.test(cuerpo) && /\bsuscripcionMeses:\s*l\.suscripcionMeses\b/.test(cuerpo));
      if (!ok) sinPlata.push(donde);
    }
  }
  assert.deepEqual(sinPlata, [], `arman el wizard sin la mensualidad: ${sinPlata.join(' · ')}`);
  assert.ok(vistos.length >= 4, `vio ${vistos.length}: ${vistos.join(' · ')}`);
  // El del tablero lee CrmLead, que lo arma el mapper.
  assert.match(tramo(fuente('app/crm/crm-map.ts'), 'export function mapToCrmLead(', '\n}\n', 12000), /\.\.\.suscripcionDeFila\(l\)/);
});

// ── 3. El historial ───────────────────────────────────────────────────────────

test('AUDIT_FIELDS registra la mensualidad y el plazo, y las dos líneas se pueden revertir', () => {
  const audit = tramo(fuente('lib/leads.ts'), 'const AUDIT_FIELDS', '];');
  assert.match(audit, /\{ k: 'suscripcion_monto_usd', label: 'Suscripción \(USD\/mes\)' \}/);
  assert.match(audit, /\{ k: 'suscripcion_meses', label: 'Plazo de la suscripción' \}/);
  const acc = fuente('app/crm/actions.ts');
  // Las etiquetas de lo revertible son LAS MISMAS: si divergen, la fila deja de ser revertible callada.
  assert.match(acc, /const CAMPO_SUS_MONTO = 'Suscripción \(USD\/mes\)';/);
  assert.match(acc, /const CAMPO_SUS_MESES = 'Plazo de la suscripción';/);
  assert.match(tramo(acc, 'const REVERTIBLES = new Set([', ']);'), /CAMPO_SUS_MONTO, CAMPO_SUS_MESES/);
  // Antes del Set (es un const: si va después, el módulo tira al cargar).
  assert.ok(acc.indexOf('const CAMPO_SUS_MONTO') < acc.indexOf('const REVERTIBLES'), 'las constantes antes del Set');
  // Los DOS caminos de revertir saben escribir la columna.
  assert.match(tramo(acc, 'export async function revertAuditChangeAction(', 'export async function revertMoveAction(', 12000), /case CAMPO_SUS_MONTO:\s*case CAMPO_SUS_MESES: \{[\s\S]{0,300}columnaSuscripcion\(row\.campo, v\)/);
  const grupo = tramo(acc, 'export async function revertMoveAction(', 'alinearEtapaVista', 12000);
  assert.match(grupo, /case CAMPO_SUS_MONTO: case CAMPO_SUS_MESES: suscripcion = \{ \.\.\.suscripcion, \.\.\.columnaSuscripcion\(r\.campo, v\) \}/);
  assert.match(grupo, /if \(Object\.keys\(suscripcion\)\.length\) \{[\s\S]{0,200}\.update\(suscripcion\)/);
});

// ── 4. Deal Details corrige una suscripción ───────────────────────────────────

test('Deal Details edita la mensualidad y el plazo, sólo sobre una suscripción, y deja el valor en el historial', () => {
  const acc = tramo(fuente('app/crm/[id]/deal-actions.ts'), 'export type DealSectionsInput', 'export async function quitarSinCobroAction(', 12000);
  assert.match(acc, /suscripcion_monto_usd\?: number \| null;/);
  assert.match(acc, /suscripcion_meses\?: number \| null;/);
  // Compare-and-set: una pantalla vieja no le cuelga una mensualidad a un pago único.
  assert.match(acc, /\.update\(sus\)\.eq\('id', leadId\)\.eq\('venta_tipo', 'suscripcion'\)/);
  // El valor (de cuánto a cuánto) y no sólo «Guardó: mensualidad».
  assert.match(acc, /logLeadChanges\(leadId, before, await getLead\(leadId\)/);

  const card = fuente('app/crm/[id]/DealDetailsCard.tsx');
  assert.match(card, /ventaTipo === 'suscripcion' \? \(\s*<>\s*<Field label="Mensualidad \(USD\)">[\s\S]{0,400}<Field label="Plazo \(meses\)">/);
  assert.match(card, /\.\.\.\(ventaTipo === 'suscripcion' \? \{\s*suscripcion_monto_usd: draft\.mensualidad/);
  // El save se re-arma cuando cambia el tipo (si no, guarda con el de la primera vez).
  assert.match(card, /\}\), \[lead\.id, lead\.deal_fiscal, ventaTipo\]\);/);
});

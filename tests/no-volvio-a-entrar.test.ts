// =============================================================================
// «No volvió a entrar a …», dicho a la PERSONA que movió al lead (23/10/2026)
// =============================================================================
// #289 «Sprint · apertura» del ws1: Martín llevó su lead a la etapa del CRON y no pasó nada. Ya tenía su inscripción
// (reentrada «Una sola vez», y viva), y `enrolarPorEvento` la salteaba con un `continue` sin decirlo. Ahora, si lo movió
// una PERSONA (el CRM, con sesión), queda una línea en el historial firmada por ella y vuelve el informe del movimiento
// (`automatizaciones`: en cuáles entró y en cuáles no, con su porqué) para que la pantalla lo diga. El motor, MaKo y los
// lotes NO lo mandan: el evento de etapa solo no dice quién fue.
//
// Correr: node --import tsx --test tests/no-volvio-a-entrar.test.ts
// Probado rompiéndolo (23/10/2026, base 7/0): ver el pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { motivoNoVuelve, lineaNoVolvio, leerNoVolvio, type PorQueNoVuelve } from '../lib/reentrada';

const leer = (p: string): string => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, abre: string, cierra: string, tope: number): string => {
  const ini = src.indexOf(abre);
  assert.ok(ini >= 0, `no encontré «${abre}»`);
  const fin = src.indexOf(cierra, ini + abre.length);
  assert.ok(fin > ini, `no encontré el cierre de «${abre}»`);
  const b = src.slice(ini, fin);
  assert.ok(b.length < tope, `el recorte mide ${b.length}: está mirando otra cosa`);
  return b;
};

test('el motivo, en el orden en que corta el motor: la reentrada primero, después la fila', () => {
  const viva = { estado: 'activa', desenlace: null };
  // La #289: «Una sola vez» Y viva. Corta la reentrada (reusaInscripciones), no «todavía la está haciendo».
  assert.deepEqual(motivoNoVuelve('una_vez', viva), { porque: 'una_sola_vez', texto: 'ya entró una vez y su reentrada es «Una sola vez»' });
  assert.equal(motivoNoVuelve('siempre', viva).porque, 'en_curso');
  assert.equal(motivoNoVuelve('siempre', { estado: 'cancelada', desenlace: null }).porque, 'cancelada');
  assert.equal(motivoNoVuelve('siempre', { estado: 'respondio', desenlace: null, proximo_envio_at: null }).porque, 'respondio');
  assert.match(motivoNoVuelve('otra_reunion', { estado: 'completada', desenlace: null }).texto, /reentrada «Otra vez si es otra reunión»/);
});

test('la línea del historial se lee de vuelta: nombre y porqué (el bloque de la ficha la usa)', () => {
  const filas: Array<[string, { estado: string; desenlace: string | null }]> = [
    ['una_vez', { estado: 'activa', desenlace: null }], ['siempre', { estado: 'activa', desenlace: null }],
    ['siempre', { estado: 'cancelada', desenlace: null }], ['siempre', { estado: 'respondio', desenlace: null }],
    ['otra_reunion', { estado: 'completada', desenlace: null }],
  ];
  for (const [modo, fila] of filas) {
    const m = motivoNoVuelve(modo as 'una_vez', fila);
    const l = lineaNoVolvio('Sprint · apertura', m.texto);
    assert.deepEqual(leerNoVolvio(l), { nombre: 'Sprint · apertura', porque: m.porque as PorQueNoVuelve, texto: m.texto }, l);
  }
  assert.equal(leerNoVolvio('Entró a «Sprint · apertura».'), null);
  assert.equal(leerNoVolvio('No volvió a entrar a «X»: algo que no dijo el motor.'), null, 'un texto desconocido no se inventa un porqué');
});

test('`enrolarPorEvento` dice por qué no volvió, sólo con una persona, y ANTES del `return 0`', () => {
  const ev = sinComentarios(bloque(leer('lib/nutricion.ts'), 'export async function enrolarPorEvento(', '\nasync function decirQueNoVolvio(', 20_000));
  assert.match(ev, /if \(!r\) \{\s*if \(ctx\?\.persona\) noVolvio\.push\(\{ secuenciaId: s\.id, nombre: s\.nombre, at: decididoAt, quien: ctx\.persona, \.\.\.motivoNoVuelve\(reentradaDeSecuencia\(s\), previa\) \}\);\s*continue;/);
  const decir = ev.indexOf('await decirQueNoVolvio(leadId, noVolvio, ctx);');
  const entro = ev.indexOf('ctx.informe.entro.push({ secuenciaId: s.id, nombre: s.nombre })');
  const corte = ev.indexOf('if (!arrancadas) return 0;');
  assert.ok(decir > 0 && decir < corte, 'el porqué se dice después del corte: un lead que no entró a NINGUNA no lo vería');
  assert.ok(entro > 0 && entro < corte, 'el informe no dice en cuáles entró');
  const d = sinComentarios(bloque(leer('lib/nutricion.ts'), 'async function decirQueNoVolvio(', '\n}\n', 900));
  assert.match(d, /if \(!ctx\?\.persona \|\| !noVolvio\.length\) return;/);
  assert.match(d, /ctx\.informe\?\.noEntro\.push\(\.\.\.noVolvio\);/);
  assert.match(d, /logLeadEvent\(leadId, 'Automatización', lineaNoVolvio\(n\.nombre, n\.texto\), ctx\.persona\)/, 'la línea no la firma la persona');
});

test('`setPipelineStage` y `moverEtapaEnProducto` piden la persona sólo con `porPersona`, y devuelven el informe', () => {
  const sp = sinComentarios(bloque(leer('lib/leads.ts'), 'export async function setPipelineStage(', '\n}\n', 12_000));
  assert.match(sp, /const informe: InformeMovimiento \| null = opts\?\.porPersona \? \{ entro: \[\], noEntro: \[\] \} : null;/);
  assert.match(sp, /informe \? \{ persona: autor, informe \} : undefined/);
  assert.match(sp, /return \{ automatizaciones: informe \};/);
  const mv = sinComentarios(bloque(leer('lib/lead-funnel.ts'), 'export async function moverEtapaEnProducto(', '\n}\n', 5_000));
  assert.match(mv, /opts\?\.porPersona \? \{ entro: \[\], noEntro: \[\] \} : null/);
  assert.match(mv, /return \{ antes: fila\.etapa, automatizaciones: informe \};/);
});

test('los caminos de una PERSONA en el CRM lo piden y devuelven `automatizaciones`', () => {
  const act = sinComentarios(leer('app/crm/actions.ts'));
  const mover = bloque(act, 'export async function setLeadStageAction(', '\n}\n', 4_000);
  assert.match(mover, /await exigirSesion\(\);/);
  assert.match(mover, /setPipelineStage\(id, stageKey, \{ \.\.\.opts, autor, porPersona: true \}\)/);
  assert.match(mover, /\.\.\.conInforme\(automatizaciones\)/);
  const completar = bloque(act, 'export async function completeStageMoveAction(', '\n}\n', 16_000);
  assert.match(completar, /porPersona: true/);
  assert.match(completar, /\.\.\.conInforme\(informe\)/);
  assert.match(act, /automatizaciones\?: InformeMovimiento \}/, 'StageMoveResultado no lo trae');
  const agregado = sinComentarios(leer('app/crm/lead-funnel-actions.ts'));
  assert.match(agregado, /moverEtapaEnProducto\(leadId, await resolverProducto\(funnelId\), etapa, \{ porPersona: true \}\)/);
});

test('el motor, MaKo y los lotes NO firman como persona', () => {
  for (const f of ['lib/mako-doer-acciones.ts', 'lib/mako-confirmaciones.ts', 'lib/api-mako/areas/crm.run.ts', 'lib/cobros.ts', 'lib/landing-gracias.ts', 'lib/agenda-evento-etapa-server.ts', 'lib/etiquetas.ts', 'lib/cobro-etapa-server.ts']) {
    assert.doesNotMatch(leer(f), /porPersona/, `${f} se hace pasar por una persona`);
  }
  // El lote de agregados va sin la persona (y sin la vía rápida).
  assert.match(sinComentarios(leer('app/crm/actions.ts')), /await moverEtapaEnProducto\(id, real, stageKey, \{ enLote: true \}\);/);
});

test('un lote del CRM sigue llamando a `setLeadStageAction` de a uno (la persona que tildó)', () => {
  assert.match(sinComentarios(leer('app/crm/actions.ts')), /const r = await setLeadStageAction\(id, stageKey\);/);
});

// ── Probado rompiéndolo (23/10/2026), de a una y restaurando. Base 7/0 ──
// R1 `enrolarPorEvento` sin el push (sólo `if (!r) continue;`)                      → 6/1
// R2 `decirQueNoVolvio` después del `if (!arrancadas) return 0;`                    → 6/1
// R3 `setLeadStageAction` sin `porPersona: true`                                    → 6/1
// R4 `leerNoVolvio` sin buscar el porqué entre los textos conocidos                 → 6/1

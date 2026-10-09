// =============================================================================
// Poner y sacar una etiqueta del CRM: idempotencia, espaciado, lote sin disparo y el espejo
// con la etapa sin bucle (lib/etiquetas-motor.ts, con un supabase de mentira)
// =============================================================================
// Pedido de Martín (08/10/2026, punto 12 del rediseño de /chatbot): etiquetas con CRUD, vinculadas
// a etapas del CRM, que disparen automatizaciones y se pongan también en WhatsApp. El contrato
// está en docs/chatbot-flujo-ramas-diseno.md (§3 y §5).
//
// Lo que se fija acá, y por qué cada cosa:
//   · IDEMPOTENTE: poner dos veces es UNA fila, el segundo contesta `yaEstaba` y no deja historial,
//     ni dispara, ni le pega a WhatsApp. Es lo que corta el eco de WhatsApp y el bucle del espejo.
//   · ESPACIADO: la misma (etiqueta, lead) no dispara dos veces en 30 s (poner, sacar, poner).
//   · LOTE: NO dispara automatizaciones ni mueve de etapa (un envío masivo por la línea NO oficial).
//   · ESPEJO: poner una etiqueta vinculada mueve a la etapa, y el gancho de la etapa vuelve a
//     pedir ponerla — eso tiene que terminar en UNA vuelta, no en un bucle. Entrar a la etapa por
//     otro lado la pone (sin disparar: el evento de ese movimiento es la etapa), y salir la saca.
//   · LA ÚNICA PUERTA: nadie más escribe `crm_lead_etiquetas` (barrido de lib/ y app/).
//
// Correr: node --import tsx --test tests/etiquetas-motor.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (08/10/2026), una rotura por vez, restaurando de memoria (arnés en el
// scratchpad de la sesión, E-romper.py). Con todo puesto: 9 pass / 0 fail. Seis roturas, las seis
// cazadas:
//   1. el insert sin su `return nada(true)` (sigue de largo aunque ya estaba) → 2 fallos
//      (idempotencia y espejo sin bucle).
//   2. sacar el `o.origen !== 'etapa'` del paso 3 (mover aunque la puso la etapa) → 1 fallo
//      (entrar por la etapa). El espejo sin bucle NO cae: lo corta igual la idempotencia, que es
//      el primero de los dos cortes — por eso hay un test para cada uno.
//   3. sacar el `o.origen !== 'etapa'` del paso 4 (disparar aunque la puso la etapa) → 1 fallo.
//   4. ponerLoteCon llamando a `p.disparar` por cada uno → 1 fallo (lote).
//   5. reclamarDisparo ignorado (dispara siempre) → 1 fallo (espaciado).
//   6. un `.from('crm_lead_etiquetas').insert(` en app/api/crm/etiquetas/route.ts → 1 fallo
//      (la única puerta).
//
// ⚠️ Y LA REVISIÓN ADVERSARIAL DEL 08/10/2026 (parte E, etiquetas-4/datos-3: el lote de etapa
// sincronizaba lead por lead). Con todo puesto: 11 pass / 0 fail. Tres roturas más, con el arnés
// del scratchpad (romper-E.mjs, restaura de memoria), las tres cazadas (10 pass / 1 fail cada una):
//   7. `espejarEtapaCon` sincronizando aunque le pidan que no (`const sincronizar = true`);
//   8. el tope de `syncGrupos` sin compartir entre grupos (sin `quedan -= ahora.length`);
//   9. lo que no tiene destino gastando el tope (sin el `if (!destinos.length) continue`).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  ponerEtiquetaCon, sacarEtiquetaCon, espejarEtapaCon, ponerLoteCon, sacarLoteCon, sincronizarDiferidos,
  type PuertosEtiquetas, type EtiquetaMotor, type ResultadoSync, type CambioEtiqueta,
} from '../lib/etiquetas-motor';
import { SYNC_LOTE_MAX } from '../lib/etiquetas-reglas';

type Fila = EtiquetaMotor & { wa: boolean };

/** Un negocio de mentira: etiquetas, leads con su etapa, y lo que se llamó afuera. */
function negocio(opts?: { etapaDe?: Record<number, string>; leads?: number[] }) {
  const etiquetas = new Map<number, Fila>([
    [1, { id: 1, nombre: 'Seguimiento', funnel_id: null, etapa_key: null, archivada_at: null, wa: true }],
    [2, { id: 2, nombre: 'Cualificado', funnel_id: null, etapa_key: 'calificado', archivada_at: null, wa: false }],
    [3, { id: 3, nombre: 'Agendó', funnel_id: null, etapa_key: 'agenda', archivada_at: null, wa: false }],
    // Vinculadas Y mapeadas al celular: las que hacen caro un lote de etapa.
    [4, { id: 4, nombre: 'Llamar', funnel_id: null, etapa_key: 'llamar', archivada_at: null, wa: true }],
    [5, { id: 5, nombre: 'Frío', funnel_id: null, etapa_key: 'frio', archivada_at: null, wa: true }],
    [9, { id: 9, nombre: 'Vieja', funnel_id: null, etapa_key: null, archivada_at: '2026-10-01', wa: false }],
  ]);
  const leads = new Set(opts?.leads ?? [10, 11, 12]);
  const filas = new Set<string>();                      // `${lead}:${etiqueta}`
  const etapa = new Map<number, string>(Object.entries(opts?.etapaDe ?? { 10: 'nuevo', 11: 'nuevo', 12: 'nuevo' }).map(([k, v]) => [Number(k), v]));
  const reloj = { ahora: 0 };
  const ultimoDisparo = new Map<string, number>();
  // `disparos` = los de PONER (lo de siempre); `quitadas` = los de SACAR (sexta tanda, CRON punto 3).
  const log = { historial: [] as string[], disparos: [] as string[], quitadas: [] as string[], movimientos: [] as string[], sync: [] as string[] };

  const p: PuertosEtiquetas<Fila> = {
    etiqueta: async (id) => etiquetas.get(id) ?? null,
    leadExiste: async (id) => leads.has(id),
    insertar: async (l, e) => { const k = `${l}:${e}`; if (filas.has(k)) return false; filas.add(k); return true; },
    insertarLote: async (ids, e) => ids.filter((l) => leads.has(l) && !filas.has(`${l}:${e}`)).map((l) => { filas.add(`${l}:${e}`); return l; }),
    borrar: async (l, e) => filas.delete(`${l}:${e}`),
    borrarLote: async (ids, e) => ids.filter((l) => filas.delete(`${l}:${e}`)),
    historial: async (l, t) => { log.historial.push(`${l}:${t}`); },
    historialLote: async (ids, t) => { for (const l of ids) log.historial.push(`${l}:${t}`); },
    reclamarDisparo: async (e, l, min, accion = 'poner') => {
      const k = `${accion}:${e}:${l}`;
      const prev = ultimoDisparo.get(k);
      if (prev != null && reloj.ahora - prev < min * 60_000) return false;
      ultimoDisparo.set(k, reloj.ahora);
      return true;
    },
    disparar: async (l, e, accion = 'poner') => { (accion === 'sacar' ? log.quitadas : log.disparos).push(`${l}:${e}`); },
    // El movimiento llama al gancho de la etapa, como setBoardStageOverride en producción. Con un
    // tope: si el espejo entrara en bucle, el test lo dice en vez de colgarse.
    moverAEtapa: async (l, f, k, autor) => {
      log.movimientos.push(`${l}:${k}`);
      if (log.movimientos.length > 5) throw new Error('BUCLE: el espejo no termina');
      const desde = etapa.get(l) ?? null;
      if (desde === k) return { movio: false };
      etapa.set(l, k);
      await espejarEtapaCon(p, l, f, desde, k, autor);
      return { movio: true, etapa: k };
    },
    etiquetasDeEtapa: async (f, k) => [...etiquetas.values()].filter((e) => !e.archivada_at && e.etapa_key === k && (e.funnel_id ?? null) === (f ?? null)),
    destinos: async (e) => (e.wa ? ['WhatsApp'] : []),
    sincronizar: async (l, e, accion): Promise<ResultadoSync[]> => {
      if (!e.wa) return [];
      log.sync.push(`${accion}:${l}:${e.id}`);
      return [{ destino: 'WhatsApp', ok: true }];
    },
  };
  return { p, filas, etapa, reloj, log };
}

const O = { autor: 'Martín' };

test('poner es IDEMPOTENTE: la segunda vez contesta yaEstaba y no hace nada más', async () => {
  const n = negocio();
  const a = await ponerEtiquetaCon(n.p, 10, 1, O);
  assert.deepEqual(a.ok && { ya: a.yaEstaba, disparo: a.disparo }, { ya: false, disparo: 'si' });
  const b = await ponerEtiquetaCon(n.p, 10, 1, O);
  assert.ok(b.ok && b.yaEstaba, 'la segunda vez tiene que decir que ya estaba');
  assert.equal(n.filas.size, 1);
  assert.equal(n.log.historial.length, 1, 'el historial no se duplica');
  assert.equal(n.log.disparos.length, 1, 'no dispara dos veces');
  assert.equal(n.log.sync.length, 1, 'no le pega dos veces a WhatsApp (el eco de su propio cambio)');
});

// Sexta tanda (09/10/2026, CRON punto 3: «Se elimina etiqueta a un lead»): sacar DISPARA su propio
// evento, con los mismos cortes que poner (no en lote, no si la sacó salir de la etapa, espaciado).
// Rotura: `sacarEtiquetaCon` sin el disparo → 10 / 1 (éste); sin el corte de `origen: 'etapa'` en el
// sacar → 10 / 1 (el del espejo, que ahora cuenta las quitadas).
test('sacar también es idempotente, DISPARA «Se elimina etiqueta» una vez y saca de WhatsApp', async () => {
  const n = negocio();
  await ponerEtiquetaCon(n.p, 10, 1, O);
  const a = await sacarEtiquetaCon(n.p, 10, 1, O);
  assert.ok(a.ok && !a.yaEstaba && a.disparo === 'si');
  const b = await sacarEtiquetaCon(n.p, 10, 1, O);
  assert.ok(b.ok && b.yaEstaba, 'sacar la que ya no tiene es yaEstaba');
  assert.deepEqual(n.log.sync, ['poner:10:1', 'sacar:10:1']);
  assert.equal(n.log.disparos.length, 1, 'sólo el poner disparó «se le puso»');
  assert.deepEqual(n.log.quitadas, ['10:1'], 'sacar no disparó «se elimina etiqueta» (o lo disparó dos veces)');
});

test('ESPACIADO: poner, sacar y poner en menos de 30 s dispara UNA vez; pasado el tiempo, otra', async () => {
  const n = negocio();
  await ponerEtiquetaCon(n.p, 10, 1, O);
  n.reloj.ahora = 10_000;
  await sacarEtiquetaCon(n.p, 10, 1, O);
  const r = await ponerEtiquetaCon(n.p, 10, 1, O);
  assert.ok(r.ok && r.disparo === 'espaciado', 'a los 10 s el disparo tiene que quedar espaciado');
  assert.equal(n.log.disparos.length, 1);
  n.reloj.ahora = 45_000;
  await sacarEtiquetaCon(n.p, 10, 1, O);
  const r2 = await ponerEtiquetaCon(n.p, 10, 1, O);
  assert.ok(r2.ok && r2.disparo === 'si', 'a los 45 s vuelve a disparar');
  assert.equal(n.log.disparos.length, 2);
});

test('LOTE: pone a todos, deja historial, NO dispara ni mueve de etapa, y cuenta los que ya estaban', async () => {
  const n = negocio();
  await ponerEtiquetaCon(n.p, 11, 2, O);           // el 11 ya la tiene (y se movió: 1 movimiento)
  const disparosAntes = n.log.disparos.length;
  const movAntes = n.log.movimientos.length;
  const r = await ponerLoteCon(n.p, [10, 11, 12, 999], 2, O.autor);
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.cambiados, [10, 12]);
  assert.equal(r.ok && r.yaEstaban, 2, 'el 11 ya la tenía y el 999 no es de este negocio');
  assert.equal(n.log.disparos.length, disparosAntes, 'un lote NO dispara automatizaciones');
  assert.equal(n.log.movimientos.length, movAntes, 'un lote NO mueve de etapa');
  assert.equal(n.etapa.get(10), 'nuevo');
  // Y el deshacer del lote saca sólo los que el lote puso.
  const d = await sacarLoteCon(n.p, [10, 12], 2, O.autor);
  assert.deepEqual(d.ok && d.cambiados, [10, 12]);
  assert.ok(n.filas.has('11:2'), 'el que ya la tenía antes del lote la conserva');
  assert.equal(n.log.quitadas.length, 0, 'sacar en lote tampoco dispara «Se elimina etiqueta a un lead»');
});

test('ESPEJO sin bucle: poner una vinculada mueve a la etapa UNA vez, y el gancho no la vuelve a poner', async () => {
  const n = negocio();
  const r = await ponerEtiquetaCon(n.p, 10, 2, O);
  assert.ok(r.ok && r.movio, 'ponerla tenía que moverlo a su etapa');
  assert.equal(n.etapa.get(10), 'calificado');
  assert.deepEqual(n.log.movimientos, ['10:calificado'], 'un solo movimiento: el espejo no rebota');
  assert.equal(n.filas.size, 1);
  assert.equal(n.log.disparos.length, 1, 'dispara una vez (por el poner directo)');
  assert.equal(n.log.historial.filter((h) => h.includes('Se puso')).length, 1);
});

test('ESPEJO desde la etapa: entrar la pone (sin disparar), salir la saca', async () => {
  const n = negocio();
  const e = await espejarEtapaCon(n.p, 10, null, 'nuevo', 'agenda', 'MaKo');
  assert.deepEqual({ puestas: e.puestas, sacadas: e.sacadas }, { puestas: 1, sacadas: 0 });
  assert.ok(n.filas.has('10:3'));
  assert.equal(n.log.disparos.length, 0, 'la que pone una etapa no dispara: el evento es la etapa');
  assert.equal(n.log.movimientos.length, 0, 'y no vuelve a mover');
  const s = await espejarEtapaCon(n.p, 10, null, 'agenda', 'calificado', 'MaKo');
  assert.deepEqual({ puestas: s.puestas, sacadas: s.sacadas }, { puestas: 1, sacadas: 1 });
  assert.deepEqual(s.cambios, [{ leadId: 10, etiquetaId: 3, accion: 'sacar' }, { leadId: 10, etiquetaId: 2, accion: 'poner' }]);
  assert.ok(!n.filas.has('10:3') && n.filas.has('10:2'));
  // La que SACA salir de la etapa tampoco dispara (sexta tanda): mover 200 leads de etapa en la
  // barra del CRM sacaría 200 espejadas, un envío masivo por la puerta de atrás.
  assert.equal(n.log.quitadas.length, 0, 'la que saca una etapa dispara «Se elimina etiqueta»');
  // Una etapa de OTRO producto con la misma key no toca las del negocio.
  const otro = await espejarEtapaCon(n.p, 11, 77, 'nuevo', 'agenda', 'MaKo');
  assert.deepEqual({ puestas: otro.puestas, sacadas: otro.sacadas, cambios: otro.cambios }, { puestas: 0, sacadas: 0, cambios: [] });
});

test('LOTE DE ETAPA: el espejo no le pega a WhatsApp lead por lead; al final se sincroniza con UN tope y rastro', async () => {
  // Revisión del 08/10/2026 (etiquetas-4/datos-3): mover 200 leads a una etapa vinculada esperaba
  // WhatsApp (y entonces Chatwoot) por cada uno adentro de una action de 60 s.
  const n = negocio({ etapaDe: { 10: 'frio', 11: 'frio', 12: 'frio' } });
  for (const l of [10, 11, 12]) n.filas.add(`${l}:5`);          // los tres tienen «Frío», de su etapa
  const porSincronizar: CambioEtiqueta[] = [];
  for (const l of [10, 11, 12]) {
    const r = await espejarEtapaCon(n.p, l, null, 'frio', 'llamar', 'Martín', { sincronizar: false });
    porSincronizar.push(...r.cambios);
  }
  assert.equal(n.log.sync.length, 0, 'en el lote nadie le pega a WhatsApp adentro de la vuelta');
  assert.ok([10, 11, 12].every((l) => n.filas.has(`${l}:4`) && !n.filas.has(`${l}:5`)), 'la base sí quedó espejada');
  assert.equal(porSincronizar.length, 6, 'tres sacadas y tres puestas por sincronizar');
  // Tope 4 para TODO el conjunto: las tres sacadas y una puesta; las otras dos dejan rastro.
  const s = await sincronizarDiferidos(n.p, porSincronizar, 4);
  assert.deepEqual(s, { sincronizados: 4, sinSincronizar: 2 });
  assert.deepEqual(n.log.sync, ['sacar:10:5', 'sacar:11:5', 'sacar:12:5', 'poner:10:4']);
  const rastro = n.log.historial.filter((h) => h.includes('eran más de 4 a la vez'));
  assert.deepEqual(rastro, ['11:«Llamar» no se puso en WhatsApp: eran más de 4 a la vez', '12:«Llamar» no se puso en WhatsApp: eran más de 4 a la vez']);
});

test('lo que no tiene a dónde ir no gasta el tope, y el lote de etiquetas topa por el MISMO camino', async () => {
  const n = negocio();
  const sinDestino: CambioEtiqueta[] = [10, 11, 12].map((leadId) => ({ leadId, etiquetaId: 3, accion: 'poner' }));
  const conDestino: CambioEtiqueta[] = [{ leadId: 10, etiquetaId: 1, accion: 'poner' }];
  const s = await sincronizarDiferidos(n.p, [...sinDestino, ...conDestino], 1);
  assert.deepEqual(s, { sincronizados: 1, sinSincronizar: 0 }, '«Agendó» no está en el celular: no consume el único lugar');
  // El lote de la barra (ponerLoteCon) pasa por el mismo tope.
  const muchos = Array.from({ length: SYNC_LOTE_MAX + 5 }, (_, i) => 100 + i);
  const m = negocio({ leads: muchos });
  const r = await ponerLoteCon(m.p, muchos, 1, 'Martín');
  assert.ok(r.ok && r.sinSincronizar === 5, JSON.stringify(r));
  assert.equal(m.log.sync.length, SYNC_LOTE_MAX);
});

test('no se pone una archivada, ni a un lead de otro negocio, ni una que no existe', async () => {
  const n = negocio();
  assert.deepEqual(await ponerEtiquetaCon(n.p, 10, 9, O), { ok: false, error: '«Vieja» está archivada.' });
  assert.equal((await ponerEtiquetaCon(n.p, 999, 1, O)).ok, false);
  assert.equal((await ponerEtiquetaCon(n.p, 10, 404, O)).ok, false);
  assert.equal(n.filas.size, 0);
  // Pero una archivada SÍ se puede sacar (es la forma de limpiarla de un lead).
  n.filas.add('10:9');
  const r = await sacarEtiquetaCon(n.p, 10, 9, O);
  assert.ok(r.ok && !r.yaEstaba);
});

test('lo que falla afuera queda en el historial del lead, con el destino', async () => {
  const n = negocio();
  n.p.sincronizar = async () => [{ destino: 'WhatsApp', ok: false, error: 'WhatsApp no confirmó el cambio' }];
  const r = await ponerEtiquetaCon(n.p, 10, 1, O);
  assert.ok(r.ok);
  assert.ok(n.log.historial.some((h) => h.includes('no se puso en WhatsApp: WhatsApp no confirmó el cambio')), n.log.historial.join(' | '));
});

// ── La única puerta ──────────────────────────────────────────────────────────

test('nadie más escribe crm_lead_etiquetas: sólo lib/etiquetas.ts', () => {
  const raiz = join(__dirname, '..');
  const culpables: string[] = [];
  const recorrer = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const ruta = join(dir, f);
      if (statSync(ruta).isDirectory()) { if (f !== 'node_modules' && !f.startsWith('.')) recorrer(ruta); continue; }
      if (!/\.(ts|tsx)$/.test(f)) continue;
      const rel = ruta.slice(raiz.length + 1).replace(/\\/g, '/');
      if (rel === 'lib/etiquetas.ts') continue;
      const src = readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n');
      if (/from\(['"]crm_lead_etiquetas['"]\)\s*\.\s*(insert|upsert|update|delete)\(/.test(src)) culpables.push(rel);
    }
  };
  recorrer(join(raiz, 'lib'));
  recorrer(join(raiz, 'app'));
  assert.deepEqual(culpables, [], `escriben crm_lead_etiquetas por fuera de lib/etiquetas.ts (se saltean historial, disparo y WhatsApp): ${culpables.join(', ')}`);
});

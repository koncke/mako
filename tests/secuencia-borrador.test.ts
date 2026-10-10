// =============================================================================
// El borrador del lienzo de /automations: lo incompleto SOBREVIVE sin publicarse (sexta tanda)
// =============================================================================
// Pedido de Martín (09/10/2026, punto 7 de «General»): «Que se elimine una flecha no significa que
// se elimine la tarjeta posterior, sino que queda "flotando". Lo que no se puede es publicar o probar
// una automatización incompleta».
//
// Lo que fija este archivo (lib/secuencia-borrador.ts + mig 0240):
//   1. el borrador pasa con lo INCOMPLETO (una tarjeta suelta, una condición sin filas) y no pasa con
//      lo que rompe el dato (ids repetidos, una flecha a una tarjeta que no existe);
//   2. la `base` es la huella de lo PUBLICADO de ahora: un borrador armado sobre otro publicado no se
//      abre, y uno igual a lo publicado se guarda como null;
//   2b. (revisión, 10/10/2026) la base la pone la PESTAÑA, con lo que abrió: si ya no es lo publicado,
//      no se escribe nada (`desactualizado`). Guardar con la base de AHORA abría el borrador viejo encima
//      de lo nuevo; descartar devuelve la base que quedó, para la pestaña que acaba de publicar;
//   3. la columna que falta degrada (lectura null, escritura `sin_columna`) y cualquier otro error
//      NO se traga;
//   4. guardar un borrador no toca `pasos` ni `updated_at`.
//
// PROBADO ROMPIÉNDOLO (09/10/2026): ver el pie.
//
// Correr: npx tsx --test tests/secuencia-borrador.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanearBorrador, firmaPublicado, borradorVigente, leerBorradoresSecuencias,
  guardarBorradorSecuencia, descartarBorradorSecuencia, type DbBorrador,
} from '../lib/secuencia-borrador';
import { validarGrafo, type PasoGrafo } from '../lib/flujo-grafo';

const ini = (siguiente: string | null): PasoGrafo => ({ id: 'entrada', nodo: 'inicio', siguiente } as PasoGrafo);
const msg = (id: string, siguiente: string | null = null, cuerpo = `hola ${id}`): PasoGrafo =>
  ({ id, canal: 'whatsapp', tipo: 'texto', cuerpo, delay_horas: 0, siguiente } as PasoGrafo);

// Publicado: CRON → a → b. Borrador: además una tarjeta SUELTA «c».
const PUBLICADO: PasoGrafo[] = [msg('a', 'b'), msg('b'), ini('a')];
const CON_SUELTA: PasoGrafo[] = [msg('a', 'b'), msg('b'), msg('c'), ini('a')];
/** Lo que el GET le dio a la pestaña que abrió PUBLICADO. */
const BASE = firmaPublicado(PUBLICADO);

type Err = { code?: string; message?: string } | null;
type Fila = { id: number; pasos: unknown; pasos_borrador: unknown };

function dbFalsa(o: { filas?: Fila[]; errLista?: Err; errLeer?: Err; errUpdate?: Err } = {}) {
  const filas = o.filas ?? [];
  const updates: Array<{ id: number; fila: Record<string, unknown> }> = [];
  const db: DbBorrador = {
    from: () => ({
      select: () => ({
        is: () => Promise.resolve({ data: o.errLista ? null : filas, error: o.errLista ?? null }),
        eq: (_c: string, v: number) => ({
          maybeSingle: () => Promise.resolve({
            data: o.errLeer ? null : (filas.find((f) => f.id === v) ? { id: v, pasos: filas.find((f) => f.id === v)!.pasos } : null),
            error: o.errLeer ?? null,
          }),
        }),
      }),
      update: (fila: Record<string, unknown>) => ({
        eq: (_c: string, v: number) => ({
          select: () => {
            if (o.errUpdate) return Promise.resolve({ data: null, error: o.errUpdate });
            const f = filas.find((x) => x.id === v);
            if (!f) return Promise.resolve({ data: [], error: null });
            updates.push({ id: v, fila });
            f.pasos_borrador = fila.pasos_borrador;
            return Promise.resolve({ data: [{ id: v, pasos: f.pasos }], error: null });
          },
        }),
      }),
    }),
  };
  return { db, updates, filas };
}

test('⚠️ el borrador pasa con una tarjeta SUELTA, que Publicar rechaza nombrándola', () => {
  const s = sanearBorrador(CON_SUELTA);
  assert.equal(s.ok, true);
  assert.ok(validarGrafo(CON_SUELTA).some((e) => /tarjetas sueltas: c/.test(e)), 'Publicar tiene que nombrar la suelta');
  // Y una condición a medias también se guarda (le falta la rama).
  const aMedias = [msg('a', 'k'), { id: 'k', nodo: 'condicion', ramas: [], si_no: null } as PasoGrafo, ini('a')];
  assert.equal(sanearBorrador(aMedias).ok, true);
  assert.ok(validarGrafo(aMedias).length > 0);
});

test('⚠️ el borrador NO pasa con lo que rompe el dato: una flecha a una tarjeta que no existe', () => {
  // Un id repetido no llega a rechazarse: `normalizar` lo desempata (el segundo toma `a_2`), así que
  // lo que se guarda nunca tiene dos tarjetas con el mismo id.
  const rep = sanearBorrador([msg('a', 'a'), msg('a', null), ini('a')]);
  assert.equal(rep.ok, true);
  assert.deepEqual((rep as { pasos: PasoGrafo[] }).pasos.map((p) => p.id), ['a', 'a_2', 'entrada']);
  const nada = sanearBorrador([msg('a', 'zz'), ini('a')]);
  assert.equal(nada.ok, false);
  assert.match((nada as { error: string }).error, /no existe/);
  assert.equal(sanearBorrador('no soy una lista').ok, false);
  assert.equal(sanearBorrador(Array.from({ length: 80 }, (_, i) => msg(`n${i}`))).ok, false, 'pasa el tope de tarjetas');
});

test('el HTML de un email del borrador pasa por la lista blanca (el borrador se vuelve a DIBUJAR)', () => {
  const s = sanearBorrador([{ ...msg('a'), canal: 'email', cuerpo_html: '<p>hola</p><script>alert(1)</script>' } as PasoGrafo, ini('a')]);
  assert.equal(s.ok, true);
  const html = String(((s as { pasos: PasoGrafo[] }).pasos[0] as Record<string, unknown>).cuerpo_html);
  assert.doesNotMatch(html, /<script/i);
  assert.match(html, /hola/);
});

test('⚠️ la firma de lo publicado es la MISMA de los dos lados: orden del array y `orden` no la mueven', () => {
  const conOrden = PUBLICADO.map((p, i) => ({ ...p, orden: i + 1 }));
  const desordenado = [conOrden[2], conOrden[0], conOrden[1]];
  assert.equal(firmaPublicado(conOrden), firmaPublicado(desordenado), 'el GET ordena por `orden`: la firma también');
  assert.notEqual(firmaPublicado(PUBLICADO), firmaPublicado(CON_SUELTA));
});

test('⚠️ un borrador se abre SÓLO si se armó sobre lo publicado de hoy, y no si es igual a lo publicado', () => {
  const base = firmaPublicado(PUBLICADO);
  const col = { pasos: CON_SUELTA, base, guardado_at: '2026-10-09T20:00:00.000Z' };
  assert.deepEqual(borradorVigente(col, PUBLICADO)?.pasos, CON_SUELTA);
  // Se publicó otra cosa después (otra pestaña, la API, «Crear con IA»): no se abre.
  const otroPublicado = [msg('a', 'b', 'otro texto'), msg('b'), ini('a')];
  assert.equal(borradorVigente(col, otroPublicado), null);
  // Igual a lo publicado: no queda nada sin publicar.
  assert.equal(borradorVigente({ pasos: PUBLICADO, base, guardado_at: 'x' }, PUBLICADO), null);
  // Lo que no tiene la forma, no se abre.
  assert.equal(borradorVigente({ pasos: 'x', base }, PUBLICADO), null);
  assert.equal(borradorVigente(null, PUBLICADO), null);
});

test('⚠️ guardar escribe SÓLO pasos_borrador (ni pasos ni updated_at) con la base de lo que se ABRIÓ', async () => {
  const { db, updates, filas } = dbFalsa({ filas: [{ id: 7, pasos: PUBLICADO, pasos_borrador: null }] });
  const r = await guardarBorradorSecuencia(db, 7, CON_SUELTA, BASE);
  assert.equal(r.ok, true);
  assert.equal(updates.length, 1);
  assert.deepEqual(Object.keys(updates[0].fila), ['pasos_borrador']);
  const guardado = filas[0].pasos_borrador as { base: string; pasos: PasoGrafo[] };
  assert.equal(guardado.base, firmaPublicado(PUBLICADO));
  assert.equal(guardado.pasos.length, 4);
  // Y lo que se guardó se abre.
  const m = await leerBorradoresSecuencias(db);
  assert.equal(m?.get(7)?.pasos.length, 4);
});

test('⚠️ un borrador armado sobre lo publicado de ANTES no se guarda: `desactualizado`, sin escribir nada', async () => {
  // El caso del verificador (10/10/2026): la pestaña A abrió X; mientras tanto se publicó Y por otro lado
  // (MaKo corrigió el texto de «a» y un hand-off le sumó la tarjeta «c»). A manda X + su cambio con la
  // base de X. Antes se guardaba con la base de Y y se abría encima de Y al recargar: Publicar revertía Y.
  const X = PUBLICADO;
  const Y: PasoGrafo[] = [msg('a', 'b', 'Hola, corregido'), msg('b', 'c'), msg('c'), ini('a')];
  const D: PasoGrafo[] = [msg('a', 'b', 'Hola!!'), msg('b', null, 'Chau'), ini('a')];
  const { db, updates, filas } = dbFalsa({ filas: [{ id: 212, pasos: Y, pasos_borrador: null }] });
  assert.deepEqual(await guardarBorradorSecuencia(db, 212, D, firmaPublicado(X)), { ok: false, motivo: 'desactualizado' });
  // Sin base (una pestaña de antes del arreglo) tampoco: no se sabe sobre qué se armó.
  assert.deepEqual(await guardarBorradorSecuencia(db, 212, D, undefined), { ok: false, motivo: 'desactualizado' });
  assert.equal(updates.length, 0, 'escribió un borrador armado sobre otro publicado');
  assert.equal(filas[0].pasos_borrador, null);
  assert.equal((await leerBorradoresSecuencias(db))?.has(212), false, 'el borrador viejo se abriría encima de Y');
  // Con la base de Y (una pestaña que abrió Y), sí.
  assert.equal((await guardarBorradorSecuencia(db, 212, D, firmaPublicado(Y))).ok, true);
});

test('descartar devuelve la base de lo publicado que quedó (la toma la pestaña que acaba de publicar)', async () => {
  const { db, filas } = dbFalsa({ filas: [{ id: 7, pasos: CON_SUELTA, pasos_borrador: { pasos: PUBLICADO, base: 'x', guardado_at: 'y' } }] });
  assert.deepEqual(await descartarBorradorSecuencia(db, 7), { ok: true, base: firmaPublicado(CON_SUELTA) });
  assert.equal(filas[0].pasos_borrador, null);
});

test('un borrador IGUAL a lo publicado se guarda como null (guardado_at null)', async () => {
  const { db, filas } = dbFalsa({ filas: [{ id: 7, pasos: PUBLICADO, pasos_borrador: { pasos: CON_SUELTA, base: 'x', guardado_at: 'y' } }] });
  const r = await guardarBorradorSecuencia(db, 7, PUBLICADO, BASE);
  assert.deepEqual(r, { ok: true, guardado_at: null });
  assert.equal(filas[0].pasos_borrador, null);
});

test('⚠️ la columna que falta degrada; cualquier otro error NO se traga', async () => {
  const sinCol = { code: '42703', message: 'column nutricion_secuencias.pasos_borrador does not exist' };
  assert.equal(await leerBorradoresSecuencias(dbFalsa({ errLista: sinCol }).db), null, 'sin columna: null, no «ninguno»');
  assert.equal(await leerBorradoresSecuencias(dbFalsa({ errLista: { code: '57014', message: 'timeout' } }).db), null);
  assert.deepEqual(await guardarBorradorSecuencia(dbFalsa({ filas: [{ id: 1, pasos: PUBLICADO, pasos_borrador: null }], errUpdate: sinCol }).db, 1, CON_SUELTA, BASE), { ok: false, motivo: 'sin_columna' });
  await assert.rejects(guardarBorradorSecuencia(dbFalsa({ filas: [{ id: 1, pasos: PUBLICADO, pasos_borrador: null }], errUpdate: { code: '57014', message: 'timeout' } }).db, 1, CON_SUELTA, BASE), /timeout/);
  assert.deepEqual(await descartarBorradorSecuencia(dbFalsa({ errUpdate: sinCol }).db, 1), { ok: false, motivo: 'sin_columna' });
});

test('una automatización que no existe (o de otro negocio) contesta no_existe', async () => {
  const { db } = dbFalsa({ filas: [] });
  assert.deepEqual(await guardarBorradorSecuencia(db, 99, CON_SUELTA, BASE), { ok: false, motivo: 'no_existe' });
  assert.deepEqual(await descartarBorradorSecuencia(db, 99), { ok: false, motivo: 'no_existe' });
  const inval = await guardarBorradorSecuencia(db, 99, [msg('a', 'zz'), ini('a')], BASE);
  assert.equal(inval.ok, false);
  assert.equal((inval as { motivo: string }).motivo, 'invalido');
});

// ── Roturas (09/10/2026) ─────────────────────────────────────────────────────────────────────
// Una por vez, restaurada DE MEMORIA (arnés en el scratchpad). Base: 9 / 0.
//   B1. `sanearBorrador` valida con `validarGrafo` en vez de `validarParaGuardar` → 4 / 5
//   B2. `borradorVigente` no compara la base                                     → 8 / 1
//   B3. `firmaPublicado` sin ordenar por `orden`                                  → 8 / 1
//   B4. `guardarBorradorSecuencia` guarda también `updated_at`                    → 8 / 1
//   B5. la escritura se traga cualquier error como `sin_columna`                  → 8 / 1
//   B6. sin sanear el HTML del email                                              → 8 / 1
// Revisión del 10/10/2026 (la base la pone la pestaña). Base: 11 / 0.
//   B7. `guardarBorradorSecuencia` no compara la base del cliente (guarda con la de AHORA) → 10 / 1
//   B8. `descartarBorradorSecuencia` no devuelve la base de lo publicado               → 10 / 1

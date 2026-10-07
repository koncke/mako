// =============================================================================
// scripts/curso-aplicar-694.mjs — sus funciones puras, EJECUTADAS contra la semilla de este árbol
// =============================================================================
// El script lleva #694 de la semilla (lib/curso-programa-nqe.ts) a curso_clases del ws1: el
// cargador saltea las clases que ya existen, así que cambiar la semilla no cambia lo cargado.
// Lo que escribe sale de `cambioM4c3` y `cambioM6c3`. Acá se corren sobre lo que quedó CARGADO
// el 06/10 —la semilla sin la columna de la MCI, con la ayuda vieja y sin el puente— y se exige
// que el resultado sea IGUAL a la semilla y sobreviva a `sanearCampos`.
//
// El import es DINÁMICO y va después de poner APLICAR_694_SOLO_IMPORTAR=1: esa variable es lo
// único que impide que el script corra `main()` (que lee .env.local y abre la base de
// PRODUCCIÓN). Un import estático se resolvería antes que cualquier línea de este archivo.
//
// PROBADO ROMPIÉNDOLO (06/10/2026, arnés que muta de a una cosa y restaura de memoria), con el
// archivo entero corriendo (6 tests):
//   · la columna de la MCI insertada PRIMERO en vez de al final (cambioM4c3)  → 5 / 1
//   · la ayuda vieja no se corrige (`campo.ayuda = t.ayuda`)                    → 5 / 1
//   · m6c3 sin la salida «ya» (correrlo dos veces duplica el puente)           → 5 / 1
//   · cambioM4c3 acepta columnas editadas (sin el chequeo contra la semilla)  → 5 / 1
//   · la semilla renombra «enunciado-de-la-palanca» y el script no se entera  → 5 / 1
// (pasan / caen). Restaurado todo: 6 / 0.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { programaNqe } from '../lib/curso-programa-nqe';
import { sanearCampos, type Campo } from '../lib/curso';

process.env.APLICAR_694_SOLO_IMPORTAR = '1';

type Resultado = { estado: 'aplicar' | 'ya' | 'rechazo'; nuevos?: Campo[]; motivo?: string; avisos: string[] };
type Script = {
  AYUDA_M4C3_ORIGINAL: string;
  cambioM4c3: (campos: unknown, o: { colsSemilla: string[]; ayudaSemilla?: string }) => Resultado;
  cambioM6c3: (campos: unknown, puente: Campo) => Resultado;
};
const cargar = async () => (await import('../scripts/curso-aplicar-694.mjs')) as unknown as Script;

const P = programaNqe();
const m4 = P.find((c) => c.origen === 'catalogo:m4c3')!;
const m6 = P.find((c) => c.origen === 'catalogo:m6c3')!;
const tabla = m4.campos.find((c) => c.id === 'objetivo-por-area')!;
const puente = m6.campos[0];
const cols = tabla.columnas ?? [];
const opts = { colsSemilla: cols, ayudaSemilla: tabla.ayuda };

/** Lo que quedó CARGADO el 06/10 (antes de #694): sin la columna, con la ayuda vieja, sin puente. */
const cargado = (S: Script) => ({
  m4: m4.campos.map((c) => (c.id === 'objetivo-por-area' ? { ...c, columnas: cols.slice(0, -1), ayuda: S.AYUDA_M4C3_ORIGINAL } : c)),
  m6: m6.campos.slice(1),
});

test('la semilla de este árbol trae #694 (si no, el resto no prueba nada)', () => {
  assert.equal(cols.at(-1), '¿A qué MCI sube? (1, 2 o las dos)');
  assert.equal(puente.id, 'palancas-candidatas-por-objetivo');
});

test('sobre lo cargado el 06/10, aplica y deja m4c3 y m6c3 IGUALES a la semilla', async () => {
  const S = await cargar();
  const { m4: c4, m6: c6 } = cargado(S);
  const r4 = S.cambioM4c3(c4, opts);
  assert.equal(r4.estado, 'aplicar', r4.motivo);
  assert.deepEqual(r4.nuevos, m4.campos, 'm4c3: la columna va al final y la ayuda vieja se corrige');
  assert.ok(isDeepStrictEqual(sanearCampos(r4.nuevos), r4.nuevos), 'm4c3 no sobrevive intacto a sanearCampos');
  const r6 = S.cambioM6c3(c6, puente);
  assert.equal(r6.estado, 'aplicar', r6.motivo);
  assert.deepEqual(r6.avisos, [], 'm6c3 avisa sobre el formulario de la semilla: el script supone otro primer campo');
  assert.deepEqual(r6.nuevos, m6.campos, 'm6c3: el puente va primero');
  assert.ok(isDeepStrictEqual(sanearCampos(r6.nuevos), r6.nuevos), 'm6c3 no sobrevive intacto a sanearCampos');
});

test('correrlo dos veces no duplica nada: sobre lo ya aplicado contesta «ya»', async () => {
  const S = await cargar();
  assert.equal(S.cambioM4c3(m4.campos, opts).estado, 'ya');
  assert.equal(S.cambioM6c3(m6.campos, puente).estado, 'ya');
});

test('una ayuda que alguien editó se respeta, y se avisa', async () => {
  const S = await cargar();
  const editada = cargado(S).m4.map((c) => (c.id === 'objetivo-por-area' ? { ...c, ayuda: 'Mi ayuda' } : c));
  const r = S.cambioM4c3(editada, opts);
  assert.equal(r.estado, 'aplicar');
  assert.equal(r.nuevos?.find((c) => c.id === 'objetivo-por-area')?.ayuda, 'Mi ayuda');
  assert.equal(r.avisos.length, 1);
});

test('se niega a adivinar: columnas editadas, la columna en el medio, campos que no son un array, sin la tabla', async () => {
  const S = await cargar();
  const base = cargado(S).m4;
  const conCols = (columnas: string[]) => base.map((c) => (c.id === 'objetivo-por-area' ? { ...c, columnas } : c));
  const viejas = cols.slice(0, -1);
  assert.equal(S.cambioM4c3(conCols([...viejas.slice(0, 3), 'Otra']), opts).estado, 'rechazo', 'columnas editadas');
  assert.equal(S.cambioM4c3(conCols([...viejas.slice(0, 3), cols.at(-1)!, ...viejas.slice(3)]), opts).estado, 'rechazo', 'la columna en el medio');
  assert.equal(S.cambioM4c3('[]', opts).estado, 'rechazo', 'campos como string (doble codificación)');
  assert.equal(S.cambioM6c3('[]', puente).estado, 'rechazo', 'm6c3 con campos como string');
  assert.equal(S.cambioM4c3(base.filter((c) => c.id !== 'objetivo-por-area'), opts).estado, 'rechazo', 'sin la tabla');
});

test('m6c3 editado (otro primer campo): el puente igual va primero, con aviso; y no muta la entrada', async () => {
  const S = await cargar();
  const { m4: c4, m6: c6 } = cargado(S);
  const r = S.cambioM6c3(c6.slice(1), puente);
  assert.equal(r.estado, 'aplicar');
  assert.equal(r.nuevos?.[0].id, puente.id);
  assert.equal(r.avisos.length, 1);
  const copia = JSON.parse(JSON.stringify(c4));
  S.cambioM4c3(c4, opts);
  assert.deepEqual(c4, copia, 'cambioM4c3 mutó lo que recibió');
});

// =============================================================================
// «Duplicar» de los tres puntos de la lista de /chatbot (lib/secuencia-duplicar.ts)
// =============================================================================
// Tercera tanda (09/10/2026), punto 6 / decisión 6: Duplicar crea una automatización PAUSADA con los
// mismos pasos y el mismo disparador. La función recibe la base y los setters por parámetro, así que
// acá se EJECUTA entera contra una base de mentira que anota cada llamada.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  duplicarSecuencia, filaDeCopia, nombreDeCopia, COPIA, NO_SE_COPIA, type DbDuplicar, type FilaOriginal,
} from '../lib/secuencia-duplicar';

/** Las 18 columnas de `nutricion_secuencias`, medidas el 09/10/2026 contra information_schema, más el emoji (mig 0229). */
const COLUMNAS = ['id', 'clave', 'nombre', 'etapa', 'etapas', 'trigger_tipo', 'activa', 'pasos', 'created_at', 'updated_at', 'workspace_id', 'estrategia', 'archivada_at', 'funnel_id', 'producto_id', 'cron', 'cron_proxima_at', 'instance_name', 'etiqueta_id', 'emoji'];

const ORIGINAL: FilaOriginal = {
  id: 198, clave: 'bienvenida', nombre: 'Bienvenida para quien agenda una llamada', etapa: 'agendado', etapas: ['agendado', 'facturando'], trigger_tipo: 'etapa',
  activa: true, pasos: [{ id: 'a', orden: 1, canal: 'whatsapp', cuerpo: 'Hola' }], created_at: '2026-10-01', updated_at: '2026-10-08',
  workspace_id: 1, estrategia: { objetivo: 'agendar' }, archivada_at: null, funnel_id: 3, producto_id: 9,
  cron: { unidad: 'dia', cada: 1, hora: 9, minuto: 0 }, cron_proxima_at: '2026-01-01T15:00:00Z', instance_name: 'linea-2', etiqueta_id: null, emoji: '🎯',
};

type Llamada = { op: string; args: unknown[] };

function baseDeMentira(o: { original?: FilaOriginal | null; errIns?: string } = {}) {
  const llamadas: Llamada[] = [];
  const db: DbDuplicar = {
    from: () => ({
      select: (cols) => ({
        eq: (c, v) => ({
          is: (c2, v2) => ({
            maybeSingle: async () => { llamadas.push({ op: 'select', args: [cols, c, v, c2, v2] }); return { data: o.original === undefined ? ORIGINAL : o.original, error: null }; },
          }),
        }),
      }),
      insert: (fila) => ({
        select: () => ({
          single: async () => {
            llamadas.push({ op: 'insert', args: [fila] });
            return o.errIns ? { data: null, error: { message: o.errIns } } : { data: { id: 500 }, error: null };
          },
        }),
      }),
      delete: () => ({ eq: async (c, v) => { llamadas.push({ op: 'delete', args: [c, v] }); return { data: null, error: null }; } }),
    }),
  };
  return { db, llamadas };
}

test('la copia nace PAUSADA, con los mismos pasos (por su puerta) y el mismo disparador', async () => {
  const { db, llamadas } = baseDeMentira();
  const pasos: Array<[number, unknown]> = [];
  const crones: Array<[number, unknown]> = [];
  const r = await duplicarSecuencia(198, {
    db, clave: () => 'copia-x',
    setPasos: async (id, p) => { pasos.push([id, p]); },
    setCron: async (id, c) => { crones.push([id, c]); },
  });
  assert.deepEqual(r, { id: 500, nombre: 'Copia de Bienvenida para quien agenda un' });
  // Lee la original VIGENTE.
  assert.deepEqual(llamadas[0], { op: 'select', args: ['*', 'id', 198, 'archivada_at', null] });
  const fila = llamadas[1].args[0] as Record<string, unknown>;
  assert.equal(fila.activa, false, 'una copia prendida le manda todo dos veces a cada lead');
  assert.equal(fila.clave, 'copia-x');
  assert.deepEqual(fila.pasos, [], 'los pasos no van crudos en el insert: entran por setSecuenciaPasos');
  assert.equal(fila.cron, null, 'el horario entra por setCronSecuencia, que siembra la próxima');
  for (const k of ['etapa', 'trigger_tipo', 'estrategia', 'funnel_id', 'producto_id', 'instance_name', 'etiqueta_id', 'emoji']) {
    assert.deepEqual(fila[k], ORIGINAL[k], `no copió ${k}`);
  }
  for (const k of ['id', 'workspace_id', 'archivada_at', 'created_at', 'updated_at', 'cron_proxima_at']) {
    assert.ok(!(k in fila), `copió ${k}`);
  }
  assert.deepEqual(pasos, [[500, ORIGINAL.pasos]]);
  assert.deepEqual(crones, [[500, ORIGINAL.cron]]);
});

test('si algo falla después de crearla, la copia a medias se BORRA y el motivo sube tal cual', async () => {
  const { db, llamadas } = baseDeMentira();
  await assert.rejects(
    duplicarSecuencia(198, { db, setPasos: async () => { throw new Error('No se guardó: el paso 2 es un archivo y no tiene el archivo elegido.'); }, setCron: async () => {} }),
    /No se guardó: el paso 2/,
  );
  assert.deepEqual(llamadas.at(-1), { op: 'delete', args: ['id', 500] });
  // Y el horario también: una copia sin su horario no es «el mismo disparador».
  const b = baseDeMentira();
  await assert.rejects(duplicarSecuencia(198, { db: b.db, setPasos: async () => {}, setCron: async () => { throw new Error('Ese horario no se entiende'); } }), /horario/);
  assert.deepEqual(b.llamadas.at(-1), { op: 'delete', args: ['id', 500] });
});

test('lo que no se puede duplicar no crea nada', async () => {
  const sin = baseDeMentira({ original: null });
  await assert.rejects(duplicarSecuencia(1, { db: sin.db, setPasos: async () => {}, setCron: async () => {} }), /ya no está/);
  assert.ok(!sin.llamadas.some((l) => l.op === 'insert'), 'una archivada o de otro negocio no se copia');
  const mal = baseDeMentira({ errIns: 'duplicate key' });
  let pasos = 0;
  await assert.rejects(duplicarSecuencia(198, { db: mal.db, setPasos: async () => { pasos++; }, setCron: async () => {} }), /duplicate key/);
  assert.equal(pasos, 0);
});

test('sin pasos ni horario no llama a sus puertas (una vacía se copia vacía)', async () => {
  const { db } = baseDeMentira({ original: { id: 5, nombre: 'Vacía', pasos: [], cron: null, trigger_tipo: 'manual', etapa: 'manual' } });
  let llamadas = 0;
  const r = await duplicarSecuencia(5, { db, clave: () => 'k', setPasos: async () => { llamadas++; }, setCron: async () => { llamadas++; } });
  assert.equal(r.nombre, 'Copia de Vacía');
  assert.equal(llamadas, 0);
});

test('el nombre: «Copia de …» con el tope de la lista, cortando el FINAL y no la marca', () => {
  assert.equal(nombreDeCopia('  Bienvenida   VSL '), 'Copia de Bienvenida VSL');
  assert.equal(nombreDeCopia(''), 'Copia de una automatización');
  const largo = nombreDeCopia('x'.repeat(60));
  assert.equal(largo.length, 40);
  assert.ok(largo.startsWith('Copia de '));
});

test('cada columna medida está decidida: o se copia, o no (y la fila que se inserta sólo trae las copiables)', () => {
  const decididas = new Set<string>([...COPIA, ...NO_SE_COPIA]);
  assert.deepEqual(COLUMNAS.filter((c) => !decididas.has(c)), [], 'una columna sin decidir');
  assert.deepEqual([...decididas].filter((c) => !COLUMNAS.includes(c)), [], 'una columna que ya no existe');
  const fila = filaDeCopia(ORIGINAL, 'k');
  assert.deepEqual(Object.keys(fila).sort(), ['activa', 'clave', 'cron', 'nombre', 'pasos', ...COPIA].sort());
  // Sin la columna en la original (antes de la mig 0229), no la inventa.
  const sinEmoji = { ...ORIGINAL };
  delete sinEmoji.emoji;
  assert.ok(!('emoji' in filaDeCopia(sinEmoji, 'k')));
});

test('el módulo no importa nada del servidor (lo enchufa la ruta): el test lo ejecuta entero', () => {
  const src = readFileSync(new URL('../lib/secuencia-duplicar.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.doesNotMatch(src, /^import 'server-only'/m);
  assert.deepEqual([...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]), ['./setting-estrategia']);
});

test('la ruta ENCHUFA la acción con las puertas de verdad (sin esto, el «⋯» contesta «action inválida»)', () => {
  // Integración de la tercera tanda: la función es de la parte E y la ruta de la parte B. Una función
  // con cero call sites compila y pasa sus tests (AGENTS.md, «Escribir la salida no es ofrecerla»).
  // Rotura (sacar el bloque `duplicar` de la ruta): 1 fallo.
  const ruta = readFileSync(new URL('../app/api/chat-agent/secuencias/route.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(ruta, /if \(body\.action === 'duplicar'\) \{[\s\S]{0,400}await duplicarSecuencia\(id, \{ db: \(await getTenantDb\(\)\) as unknown as DbDuplicar, setPasos: setSecuenciaPasos, setCron: setCronSecuencia \}\)/);
  assert.match(ruta, /if \(e instanceof PasosInvalidosError\) return Response\.json\(\{ ok: false, error: e\.message \}, \{ status: 400 \}\);/);
  assert.match(ruta, /\{ action:'duplicar', secuenciaId \}/, 'la cabecera de la ruta no la nombra');
});

// ROTURAS (09/10/2026), una por vez sobre lib/secuencia-duplicar.ts, con un arnés que rompe, corre este
// archivo y restaura DE MEMORIA (nunca con git checkout) verificando con md5. Sin romper: 7 / 0. Las 5
// cayeron:
//   · D1 la copia nace prendida: 6 pass / 1 fail.
//   · D2 los pasos no pasan por `setSecuenciaPasos`: 5 / 2.
//   · D3 la copia a medias se queda: 6 / 1.
//   · D4 copia `cron_proxima_at` de la original: 6 / 1.
//   · D5 el nombre «… (copia)», que al cortar pierde la marca: 4 / 3.

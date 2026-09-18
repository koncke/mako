// Guarda de lib/email-marketing.ts contra el corte silencioso de PostgREST.
//
// PostgREST devuelve como mucho 1.000 filas y NO avisa. En este módulo eso no es
// una hipótesis: un solo broadcast al segmento «activos» de ws1 son 1.044 filas en
// email_broadcast_envios, y leads «activos» son 1.044. Cada `.select()` suelto
// sobre esas tablas era un número más chico que el real (KPIs, stats por paso) o,
// peor, una guarda que deja pasar de más: el anti-spam de 20h y el «ya se le
// envió» de la reanudación, que con 1.000 filas le mandan el MISMO email dos veces
// a los que quedaron afuera del corte.
//
// El módulo importa `server-only` (vía lib/workspace), así que no se puede
// ejecutar desde un test. Se mira el FUENTE: toda cadena `.from('<tabla que
// crece>')` tiene que ser una escritura, un conteo (`head: true`) o una lectura de
// UNA fila. Las lecturas de muchas filas van por leerTodo / leerPorPaginas, que no
// escriben `.from(` en este archivo.
//
// Verificado rompiéndolo: devolviendo la reanudación de enviarBroadcast a
// `supabase.from('email_broadcast_envios').select('lead_id').eq('broadcast_id', id);`
// el test falla (1 fallo, 0 pases) y nombra esa cadena; restaurado, 1 pase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TABLAS_QUE_CRECEN = ['leads', 'nutricion_envios', 'email_broadcast_envios', 'nutricion_inscripciones'];

// Una cadena es segura si no LEE muchas filas: escribe, cuenta, o lee una sola.
const SEGURA = [/\.update\(/, /\.insert\(/, /\.upsert\(/, /\.delete\(/, /head:\s*true/, /\.single\(\)/, /\.maybeSingle\(\)/, /\.limit\(1\)/];

test('lib/email-marketing.ts no lee tablas que crecen con un .select() sin paginar', () => {
  const src = readFileSync(resolve(__dirname, '../lib/email-marketing.ts'), 'utf8')
    // Sin comentarios: un `.from(` citado en un comentario no es una lectura.
    .replace(/^\s*\/\/.*$/gm, '');
  const re = /\.from\(\s*(['"`])([\w]+)\1\s*\)/g;
  const sueltas: string[] = [];
  let vistas = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const tabla = m[2];
    if (!TABLAS_QUE_CRECEN.includes(tabla)) continue;
    vistas += 1;
    // La cadena llega hasta el `;` o hasta la coma de fin de elemento de un
    // Promise.all — lo que venga primero. Alcanza para ver sus métodos.
    const resto = src.slice(m.index);
    const fin = resto.search(/;|,\s*\n/);
    const cadena = fin === -1 ? resto : resto.slice(0, fin);
    if (!/\.select\(/.test(cadena)) continue;
    if (SEGURA.some((r) => r.test(cadena))) continue;
    sueltas.push(cadena.replace(/\s+/g, ' ').slice(0, 160));
  }
  // Si el regex dejara de encontrar cadenas, el test pasaría sin mirar nada.
  assert.ok(vistas >= 5, `se esperaban varias cadenas .from() sobre tablas que crecen y se vieron ${vistas}: el test dejó de mirar el archivo`);
  assert.deepEqual(sueltas, [], 'lectura sin paginar: usá leerTodo/leerPorPaginas (lib/supabase-paginado.ts) ordenando por una columna única');
});

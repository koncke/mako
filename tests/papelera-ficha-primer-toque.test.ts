// =============================================================================
// papelera-ficha-primer-toque — «Mandar a la papelera» de una ficha responde al primer toque y se ve mientras trabaja
// =============================================================================
// Visto el 21/11/2026 limpiando la prueba de «Asignar fuentes» en el ws 3, en /crm/<id>: «Mandar a la papelera» no hizo
// nada visible y el lead seguía en la base unos segundos después; un segundo toque «lo arregló».
//
// ⚠️ EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO. El primer clic SÍ entró (el segundo no hizo nada: el tacho ya estaba apagado).
// Lo que pasaba:
//   1. el cartel se cerraba en el acto y lo único que cambiaba era el tacho del fondo, gris: ninguna señal;
//   2. el borrado era una server action, y Next las despacha DE A UNA: esperaba detrás de las que la ficha manda al abrir
//      (medido en el ws 4: cinco en serie entre los 4,9 y los 9,3 s, otra a los 13 s);
//   3. con `redirect`, la respuesta traía además el tablero entero dibujado antes de que cambiara la pantalla.
//
// Lo que se fija acá, leyendo el fuente sin comentarios:
//   1. las dos fichas dejan el cartel ABIERTO con su spinner (`loading`) y no lo cierran antes de terminar;
//   2. las dos van por la RUTA (`mandarAPapeleraDesdeFicha` → /api/crm/papelera), no por una server action;
//   3. la ruta tiene la misma puerta (`exigirSesion`) y la misma escritura (`mandarLeadsAPapelera`) que las acciones, y no
//      redirige (la pantalla navega con `router.push`, que en la fila de Next pasa adelante).
//
// Roto el 21/11/2026, de a una y restaurado:
//   · el `doDelete`/`borrar` de antes (cierra el cartel y llama a la action)   → 2 fallos («1: …», «2: …»)
//   · sin `loading={borrando}` en el cartel de la ficha de página completa     → 1 fallo («1: …»)
//   · la ruta sin `exigirSesion`                                                → 1 fallo («3: …»)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const FICHAS = [
  { ruta: 'app/crm/[id]/LeadDetailBody.tsx', fn: 'const borrar = async () => {' },
  { ruta: 'app/crm/LeadSheet.tsx', fn: 'const doDelete = async () => {' },
] as const;

/** El cuerpo de la función de borrar: desde su `const` hasta el `};` que la cierra (primero a su sangría). */
function cuerpo(src: string, fn: string): string {
  const ini = src.indexOf(fn);
  assert.ok(ini >= 0, `no encontré «${fn}»`);
  return src.slice(ini, src.indexOf('\n  };', ini));
}

test('1: el cartel queda abierto, con su spinner, hasta que termina', () => {
  for (const { ruta, fn } of FICHAS) {
    const src = leer(ruta);
    const f = cuerpo(src, fn);
    assert.match(f, /if \(borrando\) return;\s*setBorrando\(true\);/, `${ruta}: un segundo toque vuelve a mandar, o no se prende la señal`);
    const espera = f.indexOf('await mandarAPapeleraDesdeFicha(lead.id)');
    assert.ok(espera > 0, `${ruta}: no espera el borrado`);
    const cierra = f.indexOf('setConfirmDelete(false)');
    assert.ok(cierra === -1 || cierra > espera, `${ruta}: cierra el cartel ANTES de terminar: no queda nada que se vea mientras trabaja`);
    const cartel = src.slice(src.indexOf('confirmLabel="Mandar a la papelera"'));
    assert.match(cartel.slice(0, 300), /loading=\{borrando\}/, `${ruta}: el cartel no muestra que está trabajando`);
    assert.match(src, /disabled=\{borrando\}/, `${ruta}: el tacho no se apaga mientras trabaja`);
  }
});

test('2: las dos fichas van por la ruta, no por una server action que hace fila', () => {
  for (const { ruta } of FICHAS) {
    const src = leer(ruta);
    assert.match(src, /import \{ mandarAPapeleraDesdeFicha \} from '\.\.?\/(\.\.\/)?papelera-ficha';/, `${ruta}: no usa el ayudante de la ruta`);
    assert.doesNotMatch(src, /deleteLeadAction|deleteLeadInlineAction/, `${ruta}: vuelve a la server action, que espera detrás de las de la ficha`);
  }
  const ayudante = leer('app/crm/papelera-ficha.ts');
  assert.doesNotMatch(ayudante, /'use server'/);
  assert.match(ayudante, /fetch\('\/api\/crm\/papelera', \{ method: 'POST'/);
  // La ficha de página completa navega al terminar (la ruta no redirige) y no apaga la señal en el éxito: la página se va.
  const borrar = cuerpo(leer('app/crm/[id]/LeadDetailBody.tsx'), FICHAS[0].fn);
  const exito = borrar.slice(borrar.indexOf('await mandarAPapeleraDesdeFicha'), borrar.indexOf('} catch'));
  assert.match(exito, /router\.push\('\/crm'\);/);
  assert.doesNotMatch(exito, /setBorrando\(false\)/);
});

test('3: la ruta tiene la misma puerta y la misma escritura que las acciones, y no redirige', () => {
  const src = leer('app/api/crm/papelera/route.ts');
  const post = src.slice(src.indexOf('export async function POST('));
  assert.match(post, /^export async function POST\(req: Request\) \{\s*try \{ await exigirSesion\(\); \} catch \{ return err\(401, SIN_SESION\); \}/,
    'la sesión va primero, como en deleteLeadAction');
  assert.match(post, /await mandarLeadsAPapelera\(\[id\], \{ por, hasta: Date\.now\(\) \+ PRESUPUESTO_LOTE_MS \}\)/);
  assert.match(post, /if \(!r\.hechos\.length\) return err\(400,/, 'un «no» de la base tiene que volver como error, no como ok');
  assert.match(post, /revalidateTag\(TAG\.leads, \{ expire: 0 \}\);/);
  assert.doesNotMatch(src, /redirect\(|'use server'/);
});

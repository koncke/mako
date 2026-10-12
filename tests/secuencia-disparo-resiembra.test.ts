// =============================================================================
// Los CRON se vuelven a sembrar cuando el server cambia la lista (app/automations/EditorDisparadores.tsx)
// =============================================================================
// Revisión de la segunda tanda del Chatbot (09/10/2026). «Crear con IA» crea la automatización con
// `trigger_tipo: 'manual'` (`crearSecuenciaVacia`) y después guarda el disparador que eligió el
// modelo (`setTriggerSecuencia`, app/api/chat-agent/secuencias/ia/route.ts). El lienzo no se remonta
// (SimuladorWhatsApp lo monta con `key={sel.id}` y el id es el mismo), y lo que pinta el CRON era un
// `useState` sembrado UNA vez: la tarjeta seguía diciendo «A mano» y «Probar» recibía el `trigger_tipo`
// viejo. La cura es comparar la FIRMA de la prop en el render y volver a sembrar cuando cambia.
//
// SEXTA TANDA (09/10/2026, «más de un CRON»): lo que se siembra ya no es UN disparador sino la LISTA
// (`useDisparadores`), y la firma es la de la lista (`firmaLista`, lib/disparadores.ts). Este archivo
// se mudó con la pieza: antes leía `disparoDeSecuencia` y `firmaDisparo` de SecuenciaPerfil, que se
// fueron con el CRON único.
//
// No hay DOM en los tests de esta casa (sin jsdom): un `renderToStaticMarkup` siembra siempre de la
// prop y no puede ver una prop que cambia entre dos renders. Por eso son dos capas: la función pura
// que decide si cambió (`firmaLista` sobre `disparadoresDeSecuencia`) y el guard del cableado.
//
// PROBADO ROMPIÉNDOLO (09/10/2026, base 6/6 en verde): quitar el bloque `if (firmaProp !== firmaVista)
// {…}` de `useDisparadores` → 1 fallo, 5 pases; volver a sembrar con un guardado en camino (sacar el
// `if (!guardando)`) → 1 fallo, 5 pases; `firmaDisparador` sin `trigger_tipo` → 1 fallo, 5 pases (cae
// «manual» contra un disparador por evento, que deja la etapa igual); `disparadoresDeSecuencia` sin
// mirar la lista del server → 1 fallo, 5 pases; `SecuenciaPerfil` leyendo `disparo` de la prop en vez
// de la lista → 1 fallo, 5 pases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { disparadoresDeSecuencia, type SecuenciaConDisparadores } from '../app/automations/EditorDisparadores';
import { firmaLista } from '../lib/disparadores';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** La lista de CRON de una fila como la manda el GET (sólo los campos que importan acá). */
const lista = (o: Record<string, unknown>) => disparadoresDeSecuencia({ id: 1, nombre: 'x', pasos: [], ...o } as unknown as SecuenciaConDisparadores);
const firma = (o: Record<string, unknown>) => firmaLista(lista(o));

/** El cuerpo de `useDisparadores`: desde su firma hasta la función que le sigue. */
function cuerpoDelHook(): string {
  const src = sinComentarios(leer('app/automations/EditorDisparadores.tsx'));
  const ini = src.indexOf('export function useDisparadores(');
  assert.ok(ini >= 0, 'no está useDisparadores');
  const fin = src.indexOf('\nexport function useTextoDisparador(', ini);
  assert.ok(fin > ini, 'no está lo que le sigue a useDisparadores');
  const cuerpo = src.slice(ini, fin);
  assert.ok(cuerpo.length < 4000, `el recorte mide ${cuerpo.length}: está mirando otra cosa`);
  return cuerpo;
}

/** El cuerpo de SecuenciaPerfil hasta el `return (` que dibuja. */
function cuerpoDelPerfil(): string {
  const src = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));
  const ini = src.indexOf('export function SecuenciaPerfil(');
  assert.ok(ini >= 0, 'no está el componente');
  const fin = src.indexOf('\n  return (', ini);
  assert.ok(fin > ini, 'no está el return del componente');
  return src.slice(ini, fin);
}

test('«manual» (crear_vacia) y el disparador que eligió la IA tienen firmas distintas', () => {
  const vacia = { trigger_tipo: 'manual', etapa: 'nuevo' };
  assert.notEqual(firma(vacia), firma({ trigger_tipo: 'etapa_actual', etapa: 'agendado', funnel_id: 3 }));
  // Un disparador por EVENTO deja la etapa como estaba: sólo cambia `trigger_tipo`.
  assert.notEqual(firma(vacia), firma({ trigger_tipo: 'agendo', etapa: 'nuevo' }));
  // Y cambiar sólo la etiqueta (dos «Se le puso…») también es otro disparador.
  assert.notEqual(
    firma({ trigger_tipo: 'etiqueta_puesta', etapa: 'nuevo', etiqueta_id: 1 }),
    firma({ trigger_tipo: 'etiqueta_puesta', etapa: 'nuevo', etiqueta_id: 2 }),
  );
});

test('ausente y null son lo mismo: una relectura con los campos en null no re-siembra de gusto', () => {
  assert.equal(
    firma({ trigger_tipo: 'etapa', etapa: 'nuevo' }),
    firma({ trigger_tipo: 'etapa', etapa: 'nuevo', funnel_id: null, producto_id: null, etiqueta_id: null, cron: null, disparadores: null }),
  );
});

test('la lista del server manda; sin ella (un server de antes de la 0241), la de las columnas', () => {
  const delServer = [
    { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'agendado', funnel_id: 3 },
    { id: 'd2', trigger_tipo: 'etiqueta_agregada', ignorar: [7] },
  ];
  const l = lista({ trigger_tipo: 'etapa_actual', etapa: 'agendado', funnel_id: 3, disparadores: delServer });
  assert.deepEqual(l.map((d) => [d.id, d.trigger_tipo]), [['d1', 'etapa_actual'], ['d2', 'etiqueta_agregada']]);
  // Sin la lista: UN CRON, el de las columnas, con su ámbito.
  const cols = lista({ trigger_tipo: 'entrega_actual', etapa: 'onboarding', producto_id: 9 });
  assert.equal(cols.length, 1);
  assert.equal(cols[0].trigger_tipo, 'entrega_actual');
  assert.equal(cols[0].producto_id, 9);
  assert.equal(cols[0].etapa, 'onboarding');
});

test('VARIAS etapas: otra lista es otro CRON, y la lista cruda vacía y null son lo mismo (cuarta tanda, punto 14)', () => {
  const una = { trigger_tipo: 'entrega_actual', etapa: 'onb', producto_id: 9 };
  const dos = { trigger_tipo: 'entrega_actual', etapa: 'onb', etapas: ['onb', 'hito1'], producto_id: 9 };
  assert.notEqual(firma(una), firma(dos), 'sumar una etapa no volvería a sembrar el CRON');
  // La relectura trae `[]` y lo pintado al elegir una sola trae `null`: el mismo CRON, sin re-siembra de gusto.
  assert.equal(firma(una), firma({ ...una, etapas: [] }));
  // Una lista vieja que ya no coincide con `etapa` (la cambió un escritor viejo) no cuenta: firma de UNA etapa.
  assert.equal(firma({ trigger_tipo: 'entrega_actual', etapa: 'hito2', etapas: ['onb', 'hito1'], producto_id: 9 }),
    firma({ trigger_tipo: 'entrega_actual', etapa: 'hito2', producto_id: 9 }));
});

test('el render compara la firma de la PROP y vuelve a sembrar la lista cuando cambia, salvo con un guardado en camino', () => {
  const cuerpo = cuerpoDelHook();
  assert.match(cuerpo, /const firmaProp = firmaLista\(disparadoresDeSecuencia\(secuencia\)\);/);
  assert.match(cuerpo, /useState\(firmaProp\)/);
  // A nivel del hook (dos espacios), no adentro de un efecto: un efecto pintaría primero lo viejo. Y
  // mientras haya un guardado en camino NO se siembra (la relectura traería la lista de antes del
  // último toque y le borraría a la persona lo que acaba de elegir). La firma vista se actualiza igual.
  assert.match(cuerpo, /\n {2}if \(firmaProp !== firmaVista\) \{\n {4}setFirmaVista\(firmaProp\);\n {4}if \(!guardando\) setLista\(disparadoresDeSecuencia\(secuencia\)\);\n {2}\}/);
  // Y el «guardando» se apaga recién cuando vuelve el ÚLTIMO pedido.
  assert.match(cuerpo, /if \(pendiente\.current\) return;\n {4}setGuardando\(false\);/);
});

test('lo que recibe «Probar» y el catálogo de condiciones sale del PRIMERO de la lista, la que se re-siembra', () => {
  const cuerpo = cuerpoDelPerfil();
  assert.match(cuerpo, /const crons = useDisparadores\(secuencia as SecuenciaConDisparadores,/);
  assert.match(cuerpo, /const disparo = disparoActualDe\(crons\.primero\);/);
  assert.match(cuerpo, /trigger_tipo: disparo\.trigger_tipo/);
  // Lo que eligió «Crear con IA» se pinta en el primero (el server ya lo guardó).
  // Duodécima tanda: entero, con `disparadorDeValorIA` (un evento de Instagram lleva su subtipo).
  assert.match(cuerpo, /crons\.sembrarPrimero\(puesto\)/);
  assert.match(cuerpo, /disparadorDeValorIA\(r\.disparador\)\[0\]/);
});

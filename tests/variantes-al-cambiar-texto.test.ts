// =============================================================================
// Cambiar el texto de un mensaje suelta las variantes del viejo, también en la PANTALLA y en «Editar con IA» (25/10/2026)
// =============================================================================
// La revisión del tren-k (el Cerebro): las variantes («↻ N») son otras formas de decir UN texto, y el motor sortea entre el
// cuerpo y ellas (`textoDelPaso`, sólo el WhatsApp no oficial). Si el texto cambia y ellas quedan, a 4 de cada 5 leads les
// llega lo que el mensaje ya no dice, y «Probar» muestra el bueno. Por la API ya se soltaban (lib/botones-api.ts); por la
// pantalla y por Editar con IA, no. Fija:
//   · `variantesTrasCambio` (lib/mensaje-partes.ts, puro): otra cosa que un texto → `[]`; un texto que CAMBIA → `[]`; el mismo
//     texto → la clave no se toca; el «Deshacer» del 🗑 repone las del paso de antes;
//   · los dos editores (WhatsApp e Instagram/Messenger) y cada camino que cambia el cuerpo pasan por ella, y el «Deshacer» del
//     🗑 devuelve las variantes (desde el `[]` explícito del guardado ya no se reponían solas);
//   · «Editar con IA» (`parcheMensaje`, lib/flujo-ia.ts) suelta las del texto viejo y conserva las del mismo texto.
// Correr: node --import tsx --test tests/variantes-al-cambiar-texto.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { variantesTrasCambio } from '../lib/mensaje-partes';
import { deIAEdicion, type CtxIA } from '../lib/flujo-ia';
import { catalogosDe } from '../lib/condiciones-catalogos';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const V = ['Hola {{nombre}}, ¿cómo va?', '¡Ey {{nombre}}!', 'Buenas, {{nombre}}', '¿Qué tal, {{nombre}}?'];

test('la regla: otra cosa o un texto nuevo sueltan las variantes; el mismo texto no; «Deshacer» las repone', () => {
  const antes = { cuerpo: 'Hola {{nombre}}', variantes: V };
  assert.deepEqual(variantesTrasCambio(antes, true, 'La clase es a las 19'), { variantes: [] }, 'un texto nuevo con las variantes del viejo');
  assert.deepEqual(variantesTrasCambio(antes, true, '  Hola {{nombre}} '), {}, 'el mismo texto conserva las suyas');
  assert.deepEqual(variantesTrasCambio(antes, false, ''), { variantes: [] }, 'una nota de voz o varias partes no sortean un texto');
  assert.deepEqual(variantesTrasCambio({ cuerpo: 'Hola', variantes: [] }, true, 'Chau'), {}, 'sin variantes no hay nada que soltar');
  // El 🗑 dejó el paso sin texto y con `[]`; «Deshacer» vuelve a poner el texto y las variantes que tenía.
  assert.deepEqual(variantesTrasCambio({ cuerpo: '', variantes: [] }, true, 'Hola {{nombre}}', V), { variantes: V });
  assert.deepEqual(variantesTrasCambio({ cuerpo: '', variantes: [] }, false, '', V), { variantes: [] }, 'devolverlas a algo que no es un texto, no');
});

test('los editores: cada camino que cambia el cuerpo pasa por la regla, y el «Deshacer» del 🗑 devuelve las variantes', () => {
  const wa = leer('app/automations/EditorMensajeWhatsApp.tsx');
  assert.match(wa, /const aplicarPartes = \(lista: readonly ParteMensaje\[\], devolver\?: readonly string\[\] \| null\) => \{/);
  assert.match(wa, /\.\.\.variantesTrasCambio\(antes, esUnTexto\(lista\), f\.cuerpo \?\? '', devolver\),/);
  assert.match(wa, /show\('Mensaje borrado', \(\) => \{ if \(mismoPaso\(pasoVivo\.current, deQuien\)\) aplicarPartes\(antes, deQuien\.variantes\); \}\);/);
  assert.match(wa, /onChange\(\{ cuerpo: r\.cuerpo, \.\.\.variantesTrasCambio\(pasoVivo\.current, true, r\.cuerpo\) \}\);/, '➤ con un solo mensaje');
  assert.match(wa, /v\.onChange\(\{ cuerpo: r\.cuerpo, \.\.\.variantesTrasCambio\(pasoVivo\.current, true, r\.cuerpo\) \}\);/, 'al salir del editor');
  assert.match(wa, /onChange\(\{ cuerpo, \.\.\.variantesTrasCambio\(pasoVivo\.current, true, cuerpo\) \}\);/, '«Usar» lo que propone el ✦');
  assert.doesNotMatch(wa, /onChange\(\{ cuerpo: r\.cuerpo \}\)/, 'quedó un camino que cambia el texto sin mirar las variantes');
  const social = leer('app/automations/EditorMensajeSocial.tsx');
  assert.match(social, /\.\.\.variantesTrasCambio\(antes, esUnTexto\(lista\), f\.cuerpo \?\? '', devolver\),/);
  assert.match(social, /aplicarPartes\(antes, deQuien\.variantes\); \}\);/);
  for (const s of [wa, social]) assert.doesNotMatch(s, /\.\.\.\(esUnTexto\(lista\) \? \{\} : \{ variantes: \[\] \}\)/, 'la regla vieja: sólo miraba si era un texto');
});

const ctx: CtxIA = {
  etiquetas: [], productos: [], disparadores: [], audios: [], archivos: [], acciones: [], links: {},
  catalogoCondicion: catalogosDe({ etapas: [], productos: [], remotos: null }), pedido: 'cambia el texto del primer mensaje', perfil: 'Fiesta Music.',
} as unknown as CtxIA;
const BASE: PasoGrafo[] = [
  { id: 'w1', canal: 'whatsapp', cuerpo: 'Hola {{nombre}}', variantes: V, siguiente: 'w2', orden: 0, delay_horas: 0 } as unknown as PasoGrafo,
  { id: 'w2', canal: 'whatsapp', cuerpo: 'Te espero el jueves', siguiente: null, orden: 1, delay_horas: 24 } as unknown as PasoGrafo,
];
const variantesDe = (pasos: readonly PasoGrafo[], id: string) => (pasos.find((p) => p.id === id) as PasoGrafo & { variantes?: string[] } | undefined)?.variantes;

test('«Editar con IA»: un texto nuevo suelta las variantes del viejo; sin tocar el texto, se quedan', () => {
  const nuevo = deIAEdicion({ cambiar: [{ id: 'w1', texto: 'Hola {{nombre}}, la clase es a las 19' }] }, BASE, ctx, () => 0.5);
  const w1 = nuevo.pasos.find((p) => p.id === 'w1')!;
  assert.equal(w1.cuerpo, 'Hola {{nombre}}, la clase es a las 19', JSON.stringify(nuevo.avisos));
  assert.deepEqual(variantesDe(nuevo.pasos, 'w1'), [], 'las variantes del texto viejo siguieron en el paso');
  const mismo = deIAEdicion({ cambiar: [{ id: 'w1', texto: 'Hola {{nombre}}' }] }, BASE, ctx, () => 0.5);
  assert.deepEqual(variantesDe(mismo.pasos, 'w1'), V, 'el mismo texto las perdió');
});

// ROTURAS (25/10/2026, harness del scratchpad `roturas-variantes.cjs`, una por vez y restaurada; base 3 / 0): un texto nuevo
// no las suelta → 1 / 2; «Deshacer» no las repone (la regla) · «Deshacer» de WhatsApp sin las variantes · «Deshacer» de
// Instagram sin las variantes · ➤ de un solo mensaje sin la regla · Editar con IA no las suelta → 2 / 1 cada una.

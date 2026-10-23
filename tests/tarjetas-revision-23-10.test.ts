// =============================================================================
// La revisión de las TARJETAS de Automations (23/10/2026): lo que estaba roto o confundía, y no vuelve
// =============================================================================
// Martín, al ver la tarjeta «MaKo en WhatsApp» con tres desplegables sueltos: «Te había pedido que no rompas el
// diseño de las tarjetas... Por qué agregar email si para eso ya tenemos una tarjeta de EMAIL... Revisá las otras
// tarjetas si no hay cosas rotas así». La revisión (12 confirmados por un escéptico) está en
// docs/hallazgos-chatbot.md → «Las tarjetas ganan controles de a uno». Acá, los de «Automations › Limpieza»: el
// número es el de la revisión.
//
// La regla: UNA TARJETA NO GANA CONTROLES; cada canal es su tarjeta. Lo que haga falta va por CONDITION, DELAY o
// Configuraciones. Ningún arreglo de éstos suma un control: todos sacan o corrigen.
//
// ⚠️ PROBADOS ROMPIÉNDOLOS (23/10/2026, base en verde: 7 de 7), una rotura por vez, y el número es el del test:
//   · sacar `invitar_cliente_curso_cs` de FUERA_DEL_FLUJO → 1 fallo (test 4);
//   · volver a `if (url && esImagen)` en ArchivoSocial → 1 fallo (test 2);
//   · el chip de medio escribiendo sólo `{ medio }` (sin `cambioDeMedio`) → 1 fallo (test 3b);
//   · `audio: !!p.audio || …` sin mirar el medio en resumenPasoIA → 1 fallo (test 3a);
//   · el ensayo con `ChatHilo` siempre → 1 fallo (test 9);
//   · `label="Producto"` de vuelta en SelectorEtapa → 1 fallo (test 10);
//   · el `<span>{motivo}</span>` sin la condición de Pagos → 1 fallo (test 5).
//   (El 6 y el 12 los fijan tests/disparadores.test.ts y tests/cron-de-antes.test.ts.)
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { porId } from '../lib/api-mako/registro';
import { FUERA_DEL_FLUJO, LLENA_EL_FLUJO, sinLoDeFueraDelFlujo } from '../lib/api-mako/flujo-params';
import { repartoDelFormulario } from '../lib/editor-acciones';
import { cambioDeMedio, erroresDelPasoIA, type PasoGrafo } from '../lib/flujo-grafo';
import { resumenPasoIA } from '../lib/flujo-conversacion';
import { ArchivoSocial } from '../app/automations/social-ui';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

test('4 · «Invitar al curso» en un flujo: sólo el curso (ni email a mano, ni canales, ni reenviar)', () => {
  const def = porId('invitar_cliente_curso_cs');
  assert.ok(def, 'la acción existe');
  // Lo que esconde el editor (`ocultosDe`, EditorAccionMako.tsx) es LLENA_EL_FLUJO + FUERA_DEL_FLUJO.
  const ocultos = new Set([...Object.keys(LLENA_EL_FLUJO[def.id] ?? {}), ...(FUERA_DEL_FLUJO[def.id] ?? [])]);
  for (const n of FUERA_DEL_FLUJO[def.id] ?? []) assert.ok(def.parametros.some((p) => p.nombre === n), `«${n}» ya no es un parámetro: la lista quedó vieja`);
  const r = repartoDelFormulario(def.parametros, true, ocultos, { accionId: def.id, params: {} });
  const visibles = [...r.obligatorios, ...r.opcionales].map((p) => p.nombre).sort();
  assert.deepEqual(visibles, ['productoId'], 'la ACTION no hace de tarjeta EMAIL ni WHATSAPP');
  assert.match(leer('app/_components/EditorAccionMako.tsx'), /FUERA_DEL_FLUJO\[operacion\]/, 'el editor lee la lista');
  // El motor tampoco los manda: un valor guardado antes no actúa sin verse.
  assert.deepEqual(sinLoDeFueraDelFlujo(def.id, { leadId: 'evento', productoId: 3, email: 'x@y.z', canales: ['email', 'whatsapp'], reenviar: true }),
    { leadId: 'evento', productoId: 3 });
  assert.deepEqual(sinLoDeFueraDelFlujo('mover_lead_etapa', { email: 'x' }), { email: 'x' }, 'a otra acción no le toca nada');
  assert.match(leer('lib/api-mako/flujo.ts'), /unaPorEtiqueta\(operacion, sinLoDeFueraDelFlujo\(operacion, params\)\)/);
});

test('2 · en la cara de la tarjeta de Instagram/Messenger una foto va como chip, no como foto', () => {
  const html = renderToStaticMarkup(createElement(ArchivoSocial, { canal: 'instagram', compacta: true, url: 'https://x/y.jpg', mime: 'image/jpeg', nombre: 'flyer.jpg' }));
  assert.doesNotMatch(html, /<img/, 'una foto de hasta 90 px no entra en el alto de 34 px del chip y corta la tarjeta');
  assert.match(html, /flyer\.jpg/);
  const sinNombre = renderToStaticMarkup(createElement(ArchivoSocial, { canal: 'messenger', compacta: true, url: 'https://x/y.png', mime: 'image/png', nombre: null }));
  assert.match(sinNombre, /Imagen/);
  // En el editor y en «Probar» la foto se sigue viendo.
  assert.match(renderToStaticMarkup(createElement(ArchivoSocial, { canal: 'instagram', url: 'https://x/y.jpg', mime: 'image/jpeg', nombre: 'f' })), /<img/);
});

const ia = (x: Partial<PasoGrafo>): PasoGrafo => ({
  id: 'r1', canal: 'whatsapp', tipo: 'respuesta', paso_ia: true, objetivo: 'agendar',
  casos: [{ id: 'c1', titulo: 'Precio', cuando: 'pregunta el precio', audio: { voz: 'propia' } }, { id: 'c2', cualquiera: true }],
  audio: { voz: 'propia' }, ...x,
} as unknown as PasoGrafo);

test('3a · la tarjeta no dibuja el 🎙 de un AI Step de Instagram o Messenger', () => {
  assert.equal(resumenPasoIA(ia({})).audio, true, 'por WhatsApp sí');
  assert.equal(resumenPasoIA(ia({ medio: 'instagram' })).audio, false);
  assert.equal(resumenPasoIA(ia({ medio: 'messenger' })).audio, false);
});

test('3b · pasar un AI Step a Instagram saca el audio (de la tarjeta y de cada escenario) en la misma escritura', () => {
  const antes = ia({});
  const despues = { ...antes, ...cambioDeMedio(antes, 'instagram') } as PasoGrafo;
  assert.equal(despues.medio, 'instagram');
  assert.equal(despues.audio, undefined);
  assert.ok((despues.casos ?? []).every((c) => !c.audio));
  assert.deepEqual(erroresDelPasoIA(despues, 'r1', true).filter((e) => /audio/.test(e)), [], 'Publicar ya no frena por un audio que no se ve');
  assert.deepEqual(cambioDeMedio(antes, 'whatsapp'), { medio: undefined }, 'volver a WhatsApp no toca nada más');
  assert.match(leer('app/automations/EditorPasoIA.tsx'), /onClick=\{\(\) => cambiar\(cambioDeMedio\(paso, m\), true\)\}/, 'el chip de medio pasa por cambioDeMedio');
});

test('9 · el Ensayo de un AI Step de Instagram o Messenger tiene la piel de su medio', () => {
  const s = leer('app/automations/ModalEnsayoAIStep.tsx');
  assert.match(s, /medio === 'whatsapp' \? \(\s*<ChatHilo/, 'WhatsApp sigue con su chat');
  assert.match(s, /<SimuladorSocial canal=\{medio\}/, 'Instagram y Messenger con SimuladorSocial, como «Probar»');
  assert.match(s, /soloLectura=\{!!desenlace \|\| modo === 'mako'\}/, 'se cierra igual que el de WhatsApp');
});

test('10 · el selector del CRM de «Mover de etapa» dice Funnel, no Producto', () => {
  const s = leer('app/_components/CamposAccion.tsx');
  assert.doesNotMatch(s, /label="Producto"|Elige el producto|ariaLabel="Producto"|`Producto \$\{puesto\}/, '«Producto» es sólo el catálogo con precio (Martín, 11/10)');
  assert.match(s, /<Select label="Funnel"/);
});

test('5 · Pagos sin conectar no dice dos veces «Conecta Stripe o Mercado Pago»', () => {
  const s = leer('app/automations/EditorDisparadores.tsx');
  assert.match(s, /\{!\(ofrecerConectar && clase === 'pagos'\) && <span>\{motivo\}<\/span>\}/);
});

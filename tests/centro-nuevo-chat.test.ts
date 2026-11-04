// =============================================================================
// «Nuevo chat» sin modal: con el primer mensaje, MaKo decide dónde va y cómo se llama (Ops Center, 17/10/2026)
// =============================================================================
// Martín (22:50): «Nuevo chat jamás debe abrir un modal... Que simplemente abra el chat y que el usuario al comenzar a escribir
// la IA vaya entendiendo dónde lo debe colocar, si debe ser un jefe o un empleado, qué nombre ponerle».
//
// Lo que se fija:
//   1. lo que contesta la IA se VALIDA: una acción inventada, un empleado sin jefe, el Cerebro o el Runner como destino, o un nombre con
//      signos que la PC rechaza no llegan a un trabajo firmado; un jefe o un empleado que YA existen no se crean otra vez;
//   2. sin IA deciden las reglas: el jefe cuyo nombre aparece en el mensaje (el más largo gana) o las primeras palabras;
//   3. nunca se le pregunta nada: toda decisión trae un nombre que pasa la lista blanca de `problemaDeNombreNuevo`;
//   4. «Nuevo chat» ya no abre un modal ni una hoja con formulario, en la computadora ni en el teléfono; abre un chat con su caja;
//   5. el chat vacío invita a escribir, y con la decisión la muestra arriba con «Cambiar»; sale solo a los 4 segundos.
//
// Probado ROMPIÉNDOLO (17/10/2026), una rotura por vez contra la base en verde de 5 pases:
//   · `decisionDeRespuesta` sin buscar el empleado que ya existe (lo crea otra vez) → cae 1;
//   · `candidatos` sin sacar al Cerebro y al Runner → caen 1 y 3;
//   · `limpiarNombre` sin la lista blanca → cae 3;
//   · `decisionPorReglas` con el primero de los jefes en vez del más largo → cae 2;
//   · `NuevoChatCentro` con su <Modal> de vuelta → cae 4;
//   · la acción sin `decisionPorReglas` de respaldo → cae 4;
//   · la decisión sin su «Cambiar» → cae 5.
// Lo que el test NO ve: el chat pintado ni la espera de 4 segundos corriendo (no hay navegador); tampoco la IA real: lo que contesta
// se simula con lo que la validación tiene que aceptar o rechazar.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  cuentaParaChatNuevo, decisionConNombre, decisionDeRespuesta, decisionPorReglas, frasePorDonde, jefesConocidos, limpiarNombre, nombreDeTexto,
  promptChatNuevo, type ContextoChatNuevo,
} from '../lib/centro-chat-nuevo';
import { NOMBRE_NUEVO_RE, problemaDeNombreNuevo } from '../lib/operaciones-reglas';
import { CuerpoChatNuevo, TituloChatNuevo, type ChatNuevo } from '../app/admin/operaciones/ChatNuevoPiezas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const codigo = (r: string) => leer(r).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const texto = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const ctx: ContextoChatNuevo = {
  tabs: ['CRM', 'Automations', 'Ads', 'Ads Manager', 'Video Editor'],
  chats: [
    { clave: 'local_crm', titulo: 'CRM' }, { clave: 'local_crm_leads', titulo: 'CRM › Lead Detail' }, { clave: 'local_ads', titulo: 'Ads Manager' },
    { clave: 'local_cerebro', titulo: 'Cerebro' }, { clave: 'local_runner', titulo: 'Runner' },
  ],
};

test('1: lo que contesta la IA se valida, y lo que ya existe no se crea otra vez', () => {
  // Un empleado nuevo debajo de un jefe que existe.
  assert.deepEqual(decisionDeRespuesta({ accion: 'empleado', jefe: 'crm', sub: 'Funnels' }, ctx), { accion: 'empleado', nombre: 'CRM › Funnels', jefe: 'CRM', clave: null, origen: 'ia' });
  // Si ese empleado ya existe, el mensaje va a él (nunca duplicar).
  const ya = decisionDeRespuesta({ accion: 'empleado', jefe: 'CRM', sub: 'Lead Detail' }, ctx);
  assert.equal(ya?.accion, 'existente');
  assert.equal(ya?.clave, 'local_crm_leads');
  // «Jefe» de uno que ya tiene su chat: va a ese chat.
  assert.equal(decisionDeRespuesta({ accion: 'jefe', jefe: 'CRM' }, ctx)?.clave, 'local_crm');
  assert.equal(decisionDeRespuesta({ accion: 'existente', nombre: 'Ads Manager' }, ctx)?.clave, 'local_ads');
  // Un jefe nuevo de una tab que todavía no tiene chat.
  assert.deepEqual(decisionDeRespuesta({ accion: 'jefe', jefe: 'Automations' }, ctx), { accion: 'jefe', nombre: 'Automations', jefe: 'Automations', clave: null, origen: 'ia' });
  // Lo que no vale: una acción inventada, un empleado sin jefe ni tema, un chat «existente» que no existe.
  assert.equal(decisionDeRespuesta({ accion: 'borrar', jefe: 'CRM' }, ctx), null);
  assert.equal(decisionDeRespuesta({ accion: 'empleado', jefe: '', sub: 'Funnels' }, ctx), null);
  assert.equal(decisionDeRespuesta({ accion: 'empleado', jefe: 'CRM' }, ctx), null);
  assert.equal(decisionDeRespuesta({ accion: 'existente', nombre: 'Un chat que no está' }, ctx), null);
  assert.equal(decisionDeRespuesta('hola', ctx), null);
  // El Cerebro y el Runner no reciben un tema nuevo.
  assert.equal(decisionDeRespuesta({ accion: 'existente', nombre: 'Cerebro' }, ctx), null);
  assert.equal(decisionDeRespuesta({ accion: 'existente', nombre: 'Runner' }, ctx), null);
  assert.ok(!jefesConocidos(ctx).some((j) => /cerebro|runner/i.test(j)));
});

test('2: sin IA decide el jefe que el mensaje nombra (el más largo gana) o las primeras palabras', () => {
  const ads = decisionPorReglas('Hay que ajustar el Ads Manager con los nuevos presupuestos', ctx);
  assert.equal(ads.accion, 'existente');
  assert.equal(ads.clave, 'local_ads', '«Ads Manager» gana sobre «Ads»');
  assert.deepEqual(decisionPorReglas('Quiero que Automations avise cuando un lead no contesta', ctx), { accion: 'jefe', nombre: 'Automations', jefe: 'Automations', clave: null, origen: 'reglas' });
  const nuevo = decisionPorReglas('Arreglá el filtro de leads del tablero que sale vacío', ctx);
  assert.equal(nuevo.accion, 'jefe');
  assert.equal(nuevo.jefe, null);
  assert.equal(nuevo.nombre, 'Arreglá el filtro de leads');
  assert.equal(decisionPorReglas('', ctx).nombre, 'Chat nuevo', 'aun sin nada hay un nombre: nunca se pregunta');
  // «CRM» dentro de otra palabra no cuenta.
  assert.equal(decisionPorReglas('Revisá el pcrmx', ctx).accion, 'jefe');
  assert.equal(decisionPorReglas('Revisá el pcrmx', ctx).jefe, null);
});

test('3: todo nombre que sale pasa la lista blanca que verifica la PC', () => {
  for (const sucio of ['**Fun/nels** ¿qué?', 'Chat "con" comillas & símbolos %$#', '  ...Empieza mal', `${'palabra '.repeat(30)}`, 'Ñandú ‘raro’ — con emoji 🚀']) {
    const n = limpiarNombre(sucio);
    assert.ok(n && NOMBRE_NUEVO_RE.test(n) && n.length <= 80 && problemaDeNombreNuevo(n) == null, `«${sucio}» → «${n}»`);
  }
  assert.equal(limpiarNombre('🚀🚀'), null, 'sin letras ni números no hay nombre');
  for (const t of ['Ayudame con https://hola-mako.com/x?a=1 por favor', '**Ya está** `codigo` [link](x)', 'a'.repeat(300), '¿Qué pasó con el CRM?']) {
    const n = nombreDeTexto(t);
    assert.ok(problemaDeNombreNuevo(n) == null, `«${t.slice(0, 30)}» → «${n}»`);
  }
  assert.deepEqual(decisionConNombre('CRM > Funnels', ctx), { accion: 'empleado', nombre: 'CRM › Funnels', jefe: 'CRM', clave: null, origen: 'reglas' });
  assert.equal(decisionConNombre('CRM', ctx).clave, 'local_crm', 'si escribe el nombre de uno que existe, va a ese');
  assert.equal(decisionConNombre('Algo suelto', ctx).accion, 'jefe');
  assert.equal(cuentaParaChatNuevo(['claude1', 'claude2', 'claude3'], (c) => ({ claude1: 97, claude2: 20, claude3: null } as Record<string, number | null>)[c]), 'claude2', 'la que menos gastó');
  assert.equal(cuentaParaChatNuevo([], () => 0), null);
  const p = promptChatNuevo('Hola', ctx);
  assert.match(p.system, /JSON/);
  assert.match(p.user, /CRM › Lead Detail/);
  assert.doesNotMatch(p.user, /Cerebro|Runner/, 'al modelo no se le ofrecen ni el Cerebro ni el Runner');
  assert.equal(frasePorDonde({ accion: 'empleado', nombre: 'CRM › Funnels', jefe: 'CRM', clave: null, origen: 'ia' }), 'Lo abro como «CRM › Funnels», debajo de CRM');
});

test('4: «Nuevo chat» ya no abre un modal ni una hoja de formulario; abre un chat con su caja', () => {
  const fila = codigo('app/admin/operaciones/PiezasCentro.tsx');
  const nuevoCentro = fila.slice(fila.indexOf('export function NuevoChatCentro'));
  assert.doesNotMatch(nuevoCentro, /<Modal\b|<NuevoChat\b|Copiar comando/, 'la computadora: sin modal');
  assert.match(leer('app/second-brain/ChatSecondBrain.tsx'), /<ChatNuevoCentro centro=\{centro\}/, 'el panel del chat nuevo');
  const movil = codigo('app/m/operaciones/ChatsMovil.tsx');
  assert.doesNotMatch(movil, /<NuevoChat\b|sePuedeAbrir|comandoNuevoChat/, 'el teléfono: sin el formulario');
  assert.match(movil, /<CuerpoChatNuevo n=\{chatNuevo\} alPie=\{<GaleriaDeGurus onElegir=\{onGuru\} \/>\} \/>/);
  assert.match(movil, /<CajaChatNuevo n=\{chatNuevo\} movil \/>/);
  // La acción: la IA barata, validada, con las reglas de respaldo; y la guarda de la Ops Center en la primera línea.
  const acc = codigo('app/admin/operaciones/acciones.ts');
  const cuerpo = acc.slice(acc.indexOf('export async function decidirChatNuevoAction'));
  assert.match(cuerpo, /^export async function decidirChatNuevoAction[\s\S]{0,300}?\{\s*const admin = await getSesionAdmin\(\);\s*if \(!puedeOperar\(admin, await wsSuperAdmin\(\)\)\) return/, 'puedeOperar primero');
  assert.match(cuerpo, /chatCheap\(\{[^}]*feature: 'centro-chat-nuevo'/);
  assert.match(cuerpo, /decisionDeRespuesta\(JSON\.parse\(json\), ctx\)/);
  assert.match(cuerpo, /return \{ ok: true, decision: decisionPorReglas\(texto, ctx\) \};/, 'sin IA, las reglas');
  // El pedido sale por el camino firmado de siempre.
  const comp = codigo('app/admin/operaciones/ChatNuevo.tsx');
  assert.match(comp, /k\.abrirChat\(\{ nombre: d\.nombre, cuenta, texto: enviado, archivos: fs \}\)/);
  assert.match(comp, /k\.mandarTextoA\(c, enviado, fs\)/, 'a un chat que ya existe, también firmado (con sus archivos, 28/10/2026)');
  assert.match(comp, /window\.setTimeout\(\(\) => \{ void salirRef\.current\(decision\); \}, ESPERA_PARA_CAMBIAR_MS\)/, 'sale solo');
  assert.match(codigo('app/admin/operaciones/useCentro.ts'), /async function mandarTextoA\(c: ChatCentro, texto: string, archivos: readonly File\[\] = \[\]\): Promise<boolean> \{[\s\S]*firma\.mandar\(/);
});

test('5: el chat vacío invita a escribir, y con la decisión la muestra arriba con «Cambiar»', () => {
  const base = { texto: '', enviado: null, fase: 'escribiendo', decision: null, editando: null, puedeCambiar: false, apertura: null, archivos: [] } as unknown as ChatNuevo;
  const vacio = texto(renderToStaticMarkup(createElement(CuerpoChatNuevo, { n: base })));
  assert.match(vacio, /Nuevo chat Escribe lo que necesitas\. Yo decido dónde va\./);
  assert.equal(texto(renderToStaticMarkup(createElement(TituloChatNuevo, { n: base }))), 'Nuevo chat');
  const decision = { accion: 'empleado', nombre: 'CRM › Funnels', jefe: 'CRM', clave: null, origen: 'ia' } as const;
  const decidido = { ...base, enviado: 'Arreglá los funnels del CRM', fase: 'confirmando', decision, puedeCambiar: true } as unknown as ChatNuevo;
  const html = renderToStaticMarkup(createElement(CuerpoChatNuevo, { n: decidido }));
  assert.match(texto(html), /Arreglá los funnels del CRM Lo abro como «CRM › Funnels», debajo de CRM Cambiar/);
  assert.match(renderToStaticMarkup(createElement(TituloChatNuevo, { n: decidido })), /<button[^>]*co-cab__nombre[^>]*>CRM › Funnels<\/button>/, 'la cabecera se toca para cambiarlo');
  const abriendo = texto(renderToStaticMarkup(createElement(CuerpoChatNuevo, { n: { ...decidido, fase: 'abriendo', puedeCambiar: false, apertura: 'Se abre en la PC' } as unknown as ChatNuevo })));
  assert.match(abriendo, /Se abre en la PC$/);
  assert.doesNotMatch(abriendo, /Cambiar/, 'ya salió: no se cambia');
});

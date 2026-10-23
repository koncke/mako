// =============================================================================
// El sexto Ops Center (17/10/2026, 19:31 a 19:45): lo que Martín pidió al mirar el Ops Center en su Android
// =============================================================================
// Lo que se fija, por pedido:
//   1. «Preguntas de los chats» ya no es una pestaña de la Ticketera (computadora ni teléfono); un link viejo abre los tickets;
//   2. el Uso nunca dice «Su uso aparece cuando su Runner esté conectado» de una cuenta con el Runner conectado;
//   3. el super admin no ve «Second Brain» en la barra ni en More (vive dentro del Ops Center) y su /second-brain lleva al grafo;
//      el cliente y su equipo siguen con su chat con MaKo;
//   4. la cabecera del chat: la criatura al lado del título, sin chips de cuenta ni estado, el título se renombra en el lugar,
//      y la foto de perfil de Martín ya no se cambia desde ahí;
//   6. el logo de Claude del Uso es el SVG oficial de simple-icons, no un dibujo;
//   7. el chat del Runner no está en la lista;
//   8. un «Completado» sin ver avisa IGUAL que «Espera tu respuesta» (mismo renglón, mismo globito en la criatura).
//   (el 9, «Trabajando…» desplegable, está en tests/centro-pasos.test.ts)
//
// Probado ROMPIÉNDOLO (17/10/2026), una rotura por vez, restaurando la copia de cada archivo (no de memoria). Base: 7 pases en
// este archivo. Cada rotura cae donde dice (entre paréntesis, los pases y fallos de los archivos que se corrieron):
//   · TicketeraCentro con el «Preguntas de los chats» de vuelta                     → cae 1 (6 / 1)
//   · textoSinMedicion siempre con el texto de «sin Runner»                          → cae 2 (6 / 1)
//   · arribaDe dejando a «Second Brain» en la barra del super admin                  → cae 3, y también sidebar-nueva y movil-toda-tab (17 / 3)
//   · masCompleto sin sacar a 'mako' para el super admin                             → cae 3 y movil-toda-tab (10 / 2)
//   · /second-brain sin el redirect del super admin                                  → cae 3 (6 / 1)
//   · rutaDelSecondBrainEnOpsCenter sin el `panel=mapa` por defecto                  → cae 3 (6 / 1)
//   · LogoClaude con otra ruta                                                       → cae 6 (6 / 1)
//   · useCentro sin `sinElRunner`                                                    → cae 7 (11 / 1, con centro-runner-nube)
//   · `segundoRenglon` sin el caso `revisar`                                         → cae 8 (6 / 1)
//   · la fila sin el globito de `avisos`                                             → cae 8 (6 / 1)
//   · Conversacion con los chips de cuenta otra vez                                  → cae 4 (6 / 1)
//   · el teléfono con «Tu foto de perfil» otra vez                                   → cae 4 y el 10 de centro-ops5 (17 / 2)
//   · el título del teléfono sin su onClick de renombrar                             → cae 4 (6 / 1)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SiClaude } from 'react-icons/si';
import { avisosDe, esChatDelRunner, segundoRenglon, sinElRunner, type ChatCentro } from '../lib/centro-chats';
import { cuentasDeUso } from '../lib/centro-uso';
import { ListaUso, LogoClaude, textoSinMedicion } from '../app/admin/operaciones/Uso';
import { ARRIBA, MAKO_NAV, OPS_CENTER, arribaDe } from '../app/_components/nav';
import { puedeVerItem } from '../lib/nav-visibilidad';
import { barraMovil, masCompleto } from '../lib/movil-rutas';
import { RUTA_GRAFO_OPS_CENTER, rutaDelSecondBrainEnOpsCenter } from '../lib/ops-center-ruta';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const codigo = (r: string) => leer(r).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1: «Preguntas de los chats» ya no es una pestaña de la Ticketera, y un link viejo abre los tickets', () => {
  const centro = codigo('app/admin/operaciones/TicketeraCentro.tsx');
  assert.doesNotMatch(centro, /Preguntas de los chats|MazoDecisiones|TableroDecisiones|ticketera-vistas/, 'la computadora');
  assert.match(centro, /<BandejaTickets cerebro=\{cerebro\} \/>/, 'sólo los tickets de los usuarios');
  const fila = codigo('app/m/operaciones/CentroAppMovil.tsx');
  assert.doesNotMatch(fila, /Preguntas de los chats|ticketera=tarjetas/, 'el teléfono: sin la fila');
  assert.match(fila, /titulo="Ticketera"[^>]*ticketera=tickets/, 'la Ticketera de los tickets sigue');
  const pagina = codigo('app/m/operaciones/page.tsx');
  assert.match(pagina, /ticketera === 'tickets' \|\| ticketera === 'tarjetas' \|\| ticketera === 'lista'/, 'un link viejo del teléfono abre los tickets');
  assert.doesNotMatch(pagina, /<TicketeraMovil|Preguntas de los chats/);
  // La computadora: `?ticketera=tarjetas|lista` (las puertas de antes) abre los tickets, nunca el mazo.
  assert.match(codigo('app/second-brain/pagina.tsx'), /esVistaTicketera\(q\.ticketera\) \? 'tickets' : null/);
  assert.match(codigo('app/second-brain/ChatSecondBrain.tsx'), /esVistaTicketera\(qTicketera\) \? 'tickets' : null/);
  // Las preguntas se siguen contestando desde el chat que las hizo.
  assert.match(codigo('app/admin/operaciones/PiezasCentro.tsx'), /responder=\{k\.responderAca\}/);
});

test('2: el Uso no se contradice: sin medición dice lo que pasa con su Runner (el estado de arriba), no una frase escrita aparte', () => {
  const ahora = Date.UTC(2026, 9, 17, 21);
  const visto = new Date(ahora - 30_000).toISOString();
  // La cuenta 2 con su Runner conectado y sin ninguna medición; la 3 sin Runner ni número.
  const cuentas = cuentasDeUso([{ cuenta: 'claude2', vistoAt: visto }]);
  const texto = renderToStaticMarkup(createElement(ListaUso, { cuentas, ahora })).split('<section').slice(1).map((s) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
  assert.match(texto[1], /Runner activo/);
  assert.match(texto[1], /Sin medir: su terminal no tiene Runner abierto$/, 'recorrida por otro Runner y sin medir: lo dice (no «Runner conectado»)');
  assert.doesNotMatch(texto[1], /Su uso aparece|Runner conectado/, 'ni el texto de «sin Runner» ni una conexión que no es de esa cuenta');
  assert.match(texto[2], /Sin Runner todavía Su uso aparece cuando su Runner esté conectado$/, 'sin Runner: el de siempre');
  // En ninguna cuenta conviven «Runner activo» y el texto de «sin Runner».
  for (const t of texto) assert.ok(!(/Runner activo/.test(t) && /Su uso aparece/.test(t)), t);
  assert.equal(textoSinMedicion('sin_terminal'), 'Sin medir: su terminal no tiene Runner abierto');
  assert.equal(textoSinMedicion('apagado'), 'Su uso aparece cuando su Runner esté conectado');
});

test('3: el super admin no ve «Second Brain» en la barra ni en More; el cliente y su equipo, sí', () => {
  const todo = (it: (typeof ARRIBA)[number]) => puedeVerItem(it, { adminShell: false, rolWs: 'admin', capa: 'completo' });
  // Barra de escritorio.
  assert.deepEqual(arribaDe(true, () => true).map((i) => i.key), [OPS_CENTER.key], 'el super admin: sólo el Ops Center');
  assert.deepEqual(arribaDe(false, todo).map((i) => i.key), [MAKO_NAV[0].key], 'el cliente: su Second Brain, sin Ops Center');
  assert.deepEqual(arribaDe(false, () => false), [], 'quien no tiene MaKo no ve nada arriba');
  assert.deepEqual(ARRIBA.map((i) => i.key), [OPS_CENTER.key, MAKO_NAV[0].key], 'la lista completa no cambia: lo decide quien mira');
  assert.match(codigo('app/_components/Sidebar.tsx'), /const arriba = arribaDe\(adminShell, puedeVer\);/);
  // More del teléfono: sin la fila 'mako' para nadie desde el 20/10/2026, porque es el lugar del medio de la barra: el chat
  // del cliente para los demás, el Centro para el super admin.
  const arriba = (adminShell: boolean) => masCompleto('admin', 'completo', adminShell).find((g) => g.id === 'arriba')?.filas.map((f) => f.key) ?? [];
  assert.deepEqual(arriba(true), [], 'el super admin: nada de Second Brain en More');
  assert.deepEqual(arriba(false), [], 'el cliente: su Second Brain está en la barra');
  assert.equal(barraMovil('admin', 'completo').find((b) => b.id === 'mako')?.href, '/m/second-brain', 'el cliente: su Second Brain');
  assert.equal(barraMovil('admin', 'completo', true).find((b) => b.id === 'mako')?.href, '/m/operaciones', 'el super admin: el Centro');
  // /second-brain: el super admin va al grafo del Ops Center, y la puerta va DESPUÉS de la del chat.
  const page = codigo('app/second-brain/page.tsx');
  const cuerpo = page.slice(page.indexOf('export default async function'));
  assert.ok(cuerpo.indexOf('requireRolWs(') < cuerpo.indexOf('quienOpera()'), 'primero la puerta del chat');
  assert.match(cuerpo, /if \(await quienOpera\(\)\) redirect\(await rutaConWs\(rutaDelSecondBrainEnOpsCenter\(q\)\)\);/);
  assert.ok(cuerpo.indexOf('quienOpera()') < cuerpo.indexOf('datosDelCentroSiOpera()'), 'antes de leer la cola del Centro');
  // El teléfono (20/10/2026, el Ops Center es la tab principal): el grafo sólo si se pide; si no, quien opera va al Centro.
  assert.match(codigo('app/m/second-brain/page.tsx'), /if \(veMapa && \(uno\(sp\.panel\) === 'mapa' \|\| uno\(sp\.area\)\)\)/, 'el teléfono: al grafo si lo pide');
  assert.match(codigo('app/m/second-brain/page.tsx'), /if \(ctx\.sesion\.rol === 'admin' && !ctx\.impersonando\) redirect\(await rutaConWs\(RUTA_CENTRO_M\)\);/, 'el teléfono: si no, al Centro');
  // El destino: el grafo sin pedir nada; lo que pide la URL se respeta; `ws` lo vuelve a poner la puerta.
  assert.equal(RUTA_GRAFO_OPS_CENTER, '/admin/operaciones?panel=mapa');
  assert.equal(rutaDelSecondBrainEnOpsCenter({}), '/admin/operaciones?panel=mapa');
  assert.equal(rutaDelSecondBrainEnOpsCenter({ ws: '9' }), '/admin/operaciones?panel=mapa', 'sin el ws');
  assert.equal(rutaDelSecondBrainEnOpsCenter({ chat: '12' }), '/admin/operaciones?chat=12', 'un chat pedido se respeta');
  assert.equal(rutaDelSecondBrainEnOpsCenter({ area: ['oferta', 'x'], vista: 'v' }), '/admin/operaciones?area=oferta&area=x&vista=v');
  assert.equal(rutaDelSecondBrainEnOpsCenter({ ticketera: 'tickets' }), '/admin/operaciones?ticketera=tickets');
});

test('4: la cabecera del chat: criatura al lado del título, sin chips, el título se renombra en el lugar, sin foto de perfil', () => {
  // Desde el 21/10/2026 la cabecera es la del panel de TODOS los Ops Center (PanelChat.tsx), y Conversacion.tsx la monta.
  assert.match(codigo('app/admin/operaciones/Conversacion.tsx'), /<PanelDeChat hilo=\{hilo\} adjuntos=\{adjuntos\}/);
  const pc = codigo('app/admin/operaciones/PanelChat.tsx');
  assert.doesNotMatch(pc, /co-chip-cuenta|co-cab__meta|nombreCuenta\(c\)/, 'la computadora: sin chips de cuenta ni estado');
  assert.match(pc, /className="co-cab__muneco"[\s\S]{0,400}<div className="co-cab__texto">[\s\S]{0,200}<h1 className="co-cab__titulo"/, 'la criatura a la izquierda del título');
  assert.match(pc, /onRenombrar \? \(\s*<button type="button" className="co-cab__nombre"/, 'tocar el título lo renombra');
  assert.match(pc, /if \(e\.key === 'Enter' && !e\.nativeEvent\.isComposing\) \{ e\.preventDefault\(\); void guardarNombre\(\); \}/);
  assert.match(pc, /if \(e\.key === 'Escape'\)/, 'Escape lo deja como estaba');
  assert.match(codigo('app/admin/operaciones/PiezasCentro.tsx'), /onRenombrar=\{chat\.sesiones\.length \? \(nombre\) => k\.renombrarChat\(chat, nombre\) : undefined\}/);
  const movil = codigo('app/m/operaciones/ChatsMovil.tsx');
  assert.doesNotMatch(movil, /nombreCuenta\(x\)|m-operaciones-cabeza__texto/, 'el teléfono: sin chips de cuenta ni estado en la cabecera');
  assert.doesNotMatch(movil, /setOpciones|Tu foto de perfil|MiFoto|achicarImagen/, 'sin desplegable de opciones ni foto de perfil');
  assert.match(movil, /onMuneco=\{esCriaturaDeMako\(elegido\.titulo\) \? undefined : abrirMuneco\}/, 'tocar la criatura la cambia (menos la del Cerebro)');
  assert.match(movil, /<button type="button" className="m-operaciones-titulo__nombre" onClick=\{onRenombrar\}/, 'tocar el nombre lo renombra');
  assert.match(movil, /await centro\.renombrarChat\(elegido, renombre\.texto\)/, 'el mismo camino firmado que la computadora');
  assert.match(codigo('app/admin/operaciones/useCentro.ts'), /async function renombrarChat\(c: ChatCentro, texto: string\): Promise<string \| null>/);
  // El título de la hoja puede ser la criatura con el nombre (SheetM lo aceptaba sólo como texto).
  assert.match(codigo('app/m/_ui/SheetM.tsx'), /titulo: ReactNode;/);
});

test('6: el logo de Claude del Uso es el SVG oficial de simple-icons', () => {
  const oficial = /<path d="([^"]+)"/.exec(renderToStaticMarkup(createElement(SiClaude)))?.[1];
  assert.ok(oficial && oficial.length > 1000, 'simple-icons trae la ruta de «claude»');
  const nuestro = renderToStaticMarkup(createElement(LogoClaude));
  assert.equal(/ d="([^"]+)"/.exec(nuestro)?.[1], oficial, 'la misma ruta, tal cual');
  assert.match(nuestro, /fill="#D97757"/, 'en el terracota de Anthropic');
  assert.doesNotMatch(nuestro, /<line/, 'ya no son doce rayos dibujados a mano');
});

test('7: el chat del Runner no está en la lista del Ops Center', () => {
  const chat = (titulo: string, extra: Partial<ChatCentro> = {}) => ({ clave: `nombre:${titulo}`, titulo, ...extra }) as ChatCentro;
  const lista = [chat('CRM'), chat('Runner', { esRunner: true }), chat('Cerebro'), chat('Centro de Operaciones › Runner'), chat('Cartero'), chat('Runners app'), chat('Corredor')];
  assert.deepEqual(sinElRunner(lista).map((c) => c.titulo), ['CRM', 'Cerebro', 'Runners app', 'Corredor'], 'sale el Runner, por la marca de la PC o por su nombre');
  assert.equal(esChatDelRunner(chat('Offer › Runner de pruebas')), false, 'un sub-chat de otro jefe no es el Runner');
  assert.equal(esChatDelRunner(chat('Runner de pruebas')), false, 'ni uno que sólo empieza igual');
  assert.equal(esChatDelRunner(chat('Cualquiera', { esRunner: true })), true, 'la marca de la PC manda');
  // La pantalla lo saca; `completarChats` lo sigue devolviendo marcado (de ahí sale que no se le entrega nada).
  // Desde el 23/10/2026 con el reloj al minuto y cada chat que vale lo mismo, el de antes (tests/ops-center-refresco-estable.test.ts).
  assert.match(codigo('app/admin/operaciones/useCentro.ts'), /estabilizarLista\(chatsAntes\.current, sinElRunner\(completarChats\(base, \{ carteros, trabajos, ahora: ahoraLista, pasos \}\)\), \(c\) => c\.clave\)/);
});

test('8: un «Completado» sin ver avisa IGUAL que «Espera tu respuesta»: el mismo renglón y el mismo globito', () => {
  const quieto = { estado: 'abierto' as const, viejo: false };
  // 20/10/2026 (tests/centro-subtitulo.test.ts): la fila dice «Trabajando…», «Espera tu respuesta» o nada; un «Completado»
  // ya visto no lleva subtítulo.
  assert.equal(segundoRenglon(quieto, 0, true), 'revisar', 'sin su ✓: espera tu respuesta');
  assert.equal(segundoRenglon(quieto, 0, false), null, 'con su ✓: sin subtítulo');
  assert.equal(segundoRenglon(quieto, 0), null, 'sin saber si se vio, no avisa');
  assert.equal(segundoRenglon(quieto, 1, true), 'espera', 'lo que pregunta el chat va primero');
  assert.equal(segundoRenglon({ estado: 'trabajando', viejo: false }, 0, true), 'vivo', 'mientras trabaja, «Trabajando…»');
  // El globito de la criatura y el orden de la lista cuentan las dos cosas.
  assert.equal(avisosDe(0, true), 1);
  assert.equal(avisosDe(2, true), 3);
  assert.equal(avisosDe(2, false), 2);
  assert.equal(avisosDe(0, false), 0);
  // Las dos listas lo dibujan con el estilo de «Espera tu respuesta», y ya no hay un globito verde aparte.
  const pc = codigo('app/admin/operaciones/PiezasCentro.tsx');
  assert.match(pc, /\{TEXTO_SEGUNDO_RENGLON\[r\]\}/, 'las mismas palabras (18/10/2026; la regla, en lib/centro-chats.ts)');
  assert.match(pc, /espera=\{k\.avisos\(c\)\}/, 'computadora: el globito de la criatura');
  const movil = codigo('app/m/operaciones/ChatsMovil.tsx');
  assert.match(movil, /\{TEXTO_SEGUNDO_RENGLON\[renglon\]\}/);
  assert.match(movil, /espera=\{avisosDe\(espera, nuevo\)\}/, 'teléfono: el globito de la criatura');
  assert.match(movil, /const avisos = centro\.avisos;/, 'y el orden de la lista');
  assert.doesNotMatch(pc + movil, /co-aviso-ya|co-fila__hace--nuevo/, 'sin el globito verde de antes');
  assert.match(codigo('app/admin/operaciones/useCentro.ts'), /const avisos = useMemo\(\(\) => \(c: ChatCentro\) => avisosDe\(esperaDe\(c, esperasConVigia\), yaSinVer\.has\(c\.clave\)\), \[esperasConVigia, yaSinVer\]\);/);
});

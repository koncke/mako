// =============================================================================
// El séptimo Ops Center (17/10/2026, el pedido de Martín de las 21:17)
// =============================================================================
//   1. «El + y el emoji están desalineados»: el «+», la carita, el campo y el botón de mandar miden LO MISMO y van alineados
//      abajo (centro.css → `--caja-toque`), en la computadora y en el teléfono;
//   2. «Los mensajes de "Completo" tienen 3 puntos al final y no llego a leer todo, esos son los mensajes más importantes»:
//      un «Completado» se dibuja ENTERO. La causa no era CSS: la tarjeta usaba el título de la FILA de la lista
//      (`tituloDeTexto`: 72 caracteres y «…») y el resto del primer renglón no se dibujaba en ningún lado;
//   3. el ícono del Ops Center es la estrella de MaKo, y el de «Nuevo chat» un círculo;
//   5. «MaKo en WhatsApp» (el vigía, que dice «Sin incidentes nuevos» cada rato) sale de la lista mientras está callado y
//      vuelve, avisando, con un incidente de verdad;
//   7. el aviso del «Completado» sin ver no salía: los turnos viajaban sólo del chat abierto, así que la fila de uno que no se
//      abrió no sabía que su último mensaje era un «Ya está» (medido con los turnos reales: 4 chats con «Ya está» hoy);
//   9. «Runner conectado, todavía sin medir» era falso: la cuenta la recorre OTRO Runner y no tiene el suyo.
//
// Probado ROMPIÉNDOLO (17/10/2026), una rotura por vez contra la base en verde de 7 pases (se restauró de la copia, no con git):
//   · Avance.tsx con el título de la FILA (`n.titulo`, 72 caracteres y «…») y el cuerpo sin su primer renglón, que es el bug
//     de Martín → caen 3 («2a», «2b» y «2c»);
//   · `partirPendiente` devolviendo siempre null, o con la cola vacía (lo pendiente dentro del pliegue) → cae «2b»;
//   · `.co-ya__titulo` con `-webkit-line-clamp` (o un `text-overflow` en cualquier regla `.co-ya`) → cae «2c»;
//   · la tarjeta de cierre sin «Decidido» (la de antes: `hecho || decidido`) → cae «2d»;
//   · la carita del teléfono con 36×42 en vez de `var(--caja-toque)`, el campo de la computadora con `align-self: center`
//     (como estaba) y el textarea del teléfono con `line-height: 1.35` (el renglón deja de sumar 44) → cae «1», cada una;
//   · `estrella` sin pasarse en el Sidebar → cae «3a»; el <CirculoNuevo /> otra vez con el muñeco → cae «3b».
// Y de lo que sumó el Cerebro a las 21:30 (base en verde de 10 pases):
//   · `turnosParaLaLista` sin mirar lo último que trajo el refresco (como estaba: sólo `turnos[c.clave]`) → cae «7»;
//   · `resumirTurnos` sin el tope de 3 turnos, o sin recortar el texto → cae «7»;
//   · `incidenteDelVigia` tomando el primer turno en vez del último, o `vigiaCallado` sin mirar `espera` → cae «5»;
//   · `chats` de useCentro sin el filtro `vigiaCallado` → cae «5»;
//   · `textoSinMedicion` con el «Runner conectado, todavía sin medir» de antes → cae «9».
// Lo que el test NO ve: la pantalla pintada (no hay navegador acá). Las medidas salen del CSS, no de un layout real.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CUERPO_PLEGABLE, TITULO_YA_ESTA, avisaYaEsta, cortadoPorLaPC, esChatVigia, esSinIncidentes, historialDelChat, incidenteDelVigia, incidenteSinVer,
  partesDeYaEsta, partirPendiente, turnosParaLaLista, vigiaCallado, vistaPrevia, type ChatCentro, type LineaChat, type VistosDeChats,
} from '../lib/centro-chats';
import { TOPE_TURNO, ULTIMOS_POR_CHAT, ULTIMOS_TEXTO, resumirTurnos, type TurnoChat } from '../lib/operaciones-reglas';
import { cuentasDeUso } from '../lib/centro-uso';
import { ListaUso, textoSinMedicion } from '../app/admin/operaciones/Uso';
import { YaEstaMensaje } from '../app/admin/operaciones/Avance';
import { Hilo } from '../app/admin/operaciones/Hilo';
import { CirculoNuevo } from '../app/admin/operaciones/NuevoChat';
import { Criatura } from '../app/_components/Criatura';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const LOCAL = 'local_0b1c2d3e-4f50-4a61-8b72-9c83d4e5f601';
const AT = '2026-10-17T21:00:00Z';
const ya = (texto: string): TurnoChat => ({ local: LOCAL, uuid: 'u-chat-0777', rol: 'el', de: null, texto, at: AT, trabajo: null });
const tarjeta = (texto: string) => renderToStaticMarkup(createElement(YaEstaMensaje, { t: ya(texto) }));
/** Lo que se lee en pantalla: sin etiquetas, con los espacios juntos. */
const texto = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

// Un primer renglón de verdad: largo, como los que escriben los chats (más de 72 caracteres, que era donde se cortaba).
const RENGLON = 'alineé el «+», la carita, el campo y el botón de mandar de la caja del teléfono y de la computadora, con el mismo tamaño de toque';
const parrafo = (rotulo: string, n: number) => `**${rotulo}:** ${'Esto es lo que pasó con este punto del trabajo y por qué se hizo así. '.repeat(n)}`.trim();

test('2a: un «Completado» con el primer renglón largo se lee ENTERO, sin «…» ni 72 caracteres', () => {
  assert.ok(RENGLON.length > 72 && RENGLON.length > TITULO_YA_ESTA, 'el ejemplo es de los que se cortaban');
  // El renglón entero llega al cuerpo (no cabe como título) y nada lo corta.
  const p = partesDeYaEsta(`Ya está: ${RENGLON}\nPruébalo en /admin/operaciones`);
  assert.equal(p.titulo, null);
  assert.ok(p.cuerpo.startsWith(RENGLON), 'el primer renglón, completo, primero');
  assert.ok(p.cuerpo.endsWith('Pruébalo en /admin/operaciones'));
  const pantalla = texto(tarjeta(`Ya está: ${RENGLON}\nPruébalo en /admin/operaciones`));
  assert.ok(pantalla.includes(RENGLON), 'en la tarjeta, el renglón entero');
  assert.ok(!pantalla.includes('…'), 'ningún «…»');
  // Uno corto sigue siendo el título, tal cual; y «Ya está» solo no repite lo que dice el rótulo.
  assert.deepEqual(partesDeYaEsta('**Ya está:** el filtro del CRM\nPruébalo en /crm'), { titulo: 'el filtro del CRM', cuerpo: 'Pruébalo en /crm' });
  assert.deepEqual(partesDeYaEsta('Ya está\nPruébalo en /crm'), { titulo: null, cuerpo: 'Pruébalo en /crm' }, 'sin título repetido en el cuerpo');
  // Lo que la PC corta al subir (TOPE_TURNO) se avisa: es la única parte que no llega, y no dejaba rastro.
  assert.equal(cortadoPorLaPC('x'.repeat(TOPE_TURNO)), true);
  assert.equal(cortadoPorLaPC('x'.repeat(TOPE_TURNO - 1)), false);
  assert.match(tarjeta(`Ya está: algo\n${'y'.repeat(TOPE_TURNO)}`), /Cortado a los 4000 caracteres/);
  assert.doesNotMatch(tarjeta('Ya está: algo corto\nPruébalo en /crm'), /Cortado a los/);
});

test('2b: un cierre muy largo pliega SÓLO su detalle; lo que sigue pendiente y la prueba quedan a la vista', () => {
  const detalle = [parrafo('Decidido', 4), parrafo('Hecho', 14), parrafo('Comprobado', 6)].join('\n\n');
  const cola = '**Sigue:** falta mirarlo en el Android de Martín.\n\n**Prueba:** Pruébalo en /admin/operaciones';
  const largo = `Ya está: ${RENGLON}\n\n${detalle}\n\n${cola}`;
  const cuerpo = partesDeYaEsta(largo).cuerpo;
  assert.ok(cuerpo.length > CUERPO_PLEGABLE, 'es de los largos');
  const partes = partirPendiente(cuerpo);
  assert.ok(partes, 'se pliega');
  assert.ok(partes.cola.startsWith('**Sigue:**'), 'la cola arranca en lo pendiente');
  assert.ok(partes.cola.includes('Pruébalo en /admin/operaciones'), 'y trae la prueba');
  assert.ok(!partes.detalle.includes('Sigue'), 'lo pendiente no queda en el pliegue');
  const html = tarjeta(largo);
  assert.match(html, /co-ya__detalle co-ya__detalle--plegado/);
  assert.match(html, />Ver todo</, 'el botón para desplegar');
  // Plegar es CSS: el detalle completo está en la página, nada se saca. Y la cola va DESPUÉS del botón, fuera del pliegue.
  const [antes, despues] = html.split('co-ya__cola');
  assert.ok(texto(antes).includes('Hecho:') && texto(antes).includes('Comprobado:'), 'el detalle entero, plegado');
  assert.ok(texto(despues).includes('falta mirarlo en el Android de Martín'), 'lo pendiente, a la vista');
  assert.ok(!texto(html).includes('…'));
  // Corto no se pliega, aunque tenga «Sigue»; y largo sin pendiente reconocible tampoco, si es un solo párrafo.
  assert.equal(partirPendiente(`${parrafo('Hecho', 2)}\n\n${cola}`), null, 'corto: entero');
  assert.equal(partirPendiente(parrafo('Hecho', 40)), null, 'un solo párrafo largo: entero, sin esconder nada');
  // Sin «Sigue» ni «Prueba», la cola es el último párrafo (por convención lo último es lo que queda).
  const sinMarca = partirPendiente(`${parrafo('Hecho', 20)}\n\n${parrafo('Comprobado', 3)}`);
  assert.ok(sinMarca && sinMarca.cola.startsWith('**Comprobado:**'));
  // Un «Sigue» adentro de un bloque de código no corta el cuerpo en dos.
  const conCodigo = partirPendiente(`${parrafo('Hecho', 20)}\n\n\`\`\`\nSigue: esto es código\n\`\`\`\n\n${parrafo('Prueba', 1)}`);
  assert.ok(conCodigo && conCodigo.detalle.includes('Sigue: esto es código') && conCodigo.cola.startsWith('**Prueba:**'));
});

test('2c: ninguna regla de la tarjeta «Completado» corta con «…» ni con líneas máximas', () => {
  const css = leer('app/admin/operaciones/centro.css');
  const reglas = [...css.matchAll(/^([^{}\n@][^{}]*?)\s*\{([^}]*)\}/gm)].filter((m) => /\.co-ya|\.co-el--especial/.test(m[1]));
  assert.ok(reglas.length >= 8, `se encontraron las reglas de la tarjeta (${reglas.length})`);
  for (const [, sel, cuerpo] of reglas) {
    assert.doesNotMatch(cuerpo, /line-clamp|text-overflow|-webkit-box/, `«${sel.trim()}» corta el texto`);
  }
  assert.match(css, /\.co-ya__detalle--plegado \{[^}]*max-height: 15em; overflow: hidden;/, 'el pliegue es de alto, con su desvanecido');
  // La tarjeta no usa el título corto de la fila para dibujar.
  const av = sinComentarios(leer('app/admin/operaciones/Avance.tsx'));
  assert.match(av, /const \{ titulo: tituloEntero, cuerpo \} = partesDeYaEsta\(t\.texto\);/);
  assert.match(av, /\{tituloEntero && <p className="co-ya__titulo">\{tituloEntero\}<\/p>\}/);
});

test('2d: el cierre estructurado del chat también se ve entero, con lo «decidido»', () => {
  const trabajo: LineaChat = {
    tipo: 'trabajo', instante: Date.parse(AT), trabajo: {
      id: 'bbbbbbbb-1111-4222-8333-444444444444', destino: LOCAL, destino_titulo: 'CRM', destino_cuenta: 'claude1', created_at: AT,
      texto: 'Arreglá el filtro', estado: 'comprobado', motivo: null, cerrado_at: AT,
      cierre: { decidido: 'Decidí dejarlo en la lista', hecho: 'Hice el filtro del CRM', comprobado: 'Lo probé con 3 leads', sigue: 'Falta el Android', prueba: 'Abrí /crm' },
    },
  } as LineaChat;
  const pantalla = texto(renderToStaticMarkup(createElement(Hilo, {
    lineas: [trabajo], pushes: [], ahora: Date.parse(AT) + 60_000, vacio: '', quien: { titulo: 'CRM', animo: 'despierto' },
  })));
  for (const frase of ['Decidí dejarlo en la lista', 'Hice el filtro del CRM', 'Lo probé con 3 leads', 'Falta el Android', 'Abrí /crm']) {
    assert.ok(pantalla.includes(frase), `«${frase}» se ve`);
  }
});

// La CAJA: se lee del CSS lo que mide cada pieza, porque no hay navegador en estos tests.
const css = leer('app/admin/operaciones/centro.css');
const movil = leer('app/m/operaciones/operaciones.css');
const px = (s: string | undefined) => Number((s ?? '').replace('px', ''));

test('1: el «+», la carita, el campo y mandar miden lo mismo y van alineados abajo, en la computadora y el teléfono', () => {
  // La medida: 40 con mouse (44 con el dedo) en la computadora; 44 en el teléfono. Una sola, definida en la fila.
  assert.match(css, /\.co-caja__fila \{ --caja-toque: 40px; display: flex; align-items: flex-end;/);
  assert.match(css, /@media \(pointer: coarse\) \{ \.co-caja__fila \{ --caja-toque: 44px; \} \}/);
  assert.match(movil, /\[data-m\] \.m-operaciones-caja__fila \{ --caja-toque: 44px; display: flex; align-items: flex-end;/);
  // Las tres piezas redondas con ESA medida (también el «+» del teléfono, que medía 34, y la carita, que medía 36×42).
  assert.match(css, /:is\(\.co-caja__fila, \.m-operaciones-caja__fila\) :is\(\.ch-adjuntar, \.co-emojis__boton, \.co-enviar\) \{[^}]*width: var\(--caja-toque, 44px\); height: var\(--caja-toque, 44px\);/);
  assert.match(css, /\.co-emojis__boton \{ width: var\(--caja-toque, 44px\); height: var\(--caja-toque, 44px\); \}/);
  assert.match(movil, /\.co-enviar \{ width: var\(--caja-toque, 44px\); height: var\(--caja-toque, 44px\);/);
  assert.match(movil, /\.co-mic \{ width: var\(--caja-toque, 44px\); height: var\(--caja-toque, 44px\);/);
  assert.doesNotMatch(css + movil, /\.co-emojis__boton \{ width: 36px/, 'la carita de 36×42 se fue');
  // Alineados ABAJO cuando el campo crece: el campo de la computadora ya no se centra.
  assert.match(css, /\.co-caja__fila > \.co-caja__campo \{[^}]*align-self: flex-end;/);
  assert.doesNotMatch(css, /\.co-caja__fila > \.co-caja__campo \{[^}]*align-self: center/);
  assert.match(css, /\.(?:co-mas-caja, \.co-emojis)\) \{ flex: none; align-self: flex-end; \}/);
  // El campo de UN renglón mide la misma medida. Teléfono: renglón + relleno + borde = 44, en el campo y en su capa de links.
  const caja = movil.match(/\[data-m\] \.m-operaciones-caja textarea \{([^}]*)\}/)?.[1] ?? '';
  const renglon = px(caja.match(/line-height: (\d+px)/)?.[1]);
  const relleno = px(caja.match(/padding: (\d+px) \d+px/)?.[1]);
  const borde = px(caja.match(/border: (\d+px) solid/)?.[1]);
  assert.match(caja, /min-height: var\(--caja-toque, 44px\)/);
  assert.equal(renglon + 2 * relleno + 2 * borde, px(movil.match(/m-operaciones-caja__fila \{ --caja-toque: (\d+px)/)?.[1]), `renglón ${renglon} + relleno ${relleno}×2 + borde ${borde}×2`);
  assert.match(movil, /\.co-caja__resalte \{ padding: 11px 15px; font-size: 16px; line-height: 22px; \}/, 'la capa de links, con el mismo renglón que el campo');
  // Computadora: el relleno sale de la medida y del renglón (letra × 1,5), y la capa de links lo comparte.
  assert.match(css, /\.co-caja__fila textarea, \.co-caja__fila \.co-caja__resalte \{\s*--renglon: calc\(var\(--fs-md\) \* 1\.5\); padding: calc\(\(var\(--caja-toque\) - var\(--renglon\)\) \/ 2\) 4px; line-height: var\(--renglon\);/);
});

test('3a: el ícono del Ops Center es la estrella de MaKo (la del Cerebro), en la barra y en More', () => {
  const estrella = renderToStaticMarkup(createElement(Criatura, { nombre: 'Ops Center', estrella: true }));
  const delCerebro = renderToStaticMarkup(createElement(Criatura, { nombre: 'Cerebro' }));
  const porSuNombre = renderToStaticMarkup(createElement(Criatura, { nombre: 'Ops Center' }));
  assert.equal(estrella, delCerebro, 'la misma criatura que el Cerebro');
  assert.notEqual(estrella, porSuNombre, 'y no la que sale del nombre');
  assert.match(sinComentarios(leer('app/_components/Sidebar.tsx')), /<Criatura nombre=\{item\.criatura\} estrella=\{item\.key === OPS_CENTER\.key\}/, 'la barra');
  assert.match(sinComentarios(leer('app/m/mas/page.tsx')), /leading=\{criatura\('Ops Center', true\)\}/, 'More');
  // Second Brain conserva la suya (por su nombre): la estrella no se reparte.
  assert.doesNotMatch(sinComentarios(leer('app/m/mas/page.tsx')), /criatura\(f\.label, true\)/);
});

test('3b: «Nuevo chat» lleva un círculo, no el muñeco gris; en el Centro, el teléfono y el Second Brain', () => {
  const html = renderToStaticMarkup(createElement(CirculoNuevo, { size: 40 }));
  assert.match(html, /class="co-circulo-nuevo"[^>]*width:40px;height:40px/);
  assert.doesNotMatch(html, /mun-cuerpo|co-muneco-nuevo/, 'ningún muñeco');
  assert.match(css, /\.co-circulo-nuevo \{[^}]*border-radius: 50%; background: var\(--good\);/);
  for (const f of ['app/admin/operaciones/PiezasCentro.tsx', 'app/m/operaciones/ChatsMovil.tsx', 'app/second-brain/ChatSecondBrain.tsx']) {
    const s = sinComentarios(leer(f));
    assert.match(s, /<CirculoNuevo/, `${f}: el círculo`);
    assert.doesNotMatch(s, /MunecoNuevo/, `${f}: sin el muñeco`);
  }
});

// ── Lo que sumó el Cerebro a las 21:30 ────────────────────────────────────────────────────────────────────────────────────
const AHORA = Date.UTC(2026, 9, 17, 22);
const chatDe = (titulo: string, sesion = LOCAL): ChatCentro => ({
  clave: sesion, porNombre: false, titulo, cuenta: 'claude4', estado: 'idle', vistoAt: AHORA, viejo: false, actividad: AHORA, pedidos: [], pidioAca: [],
  trabajos: [], miembros: [sesion], sesiones: [],
} as unknown as ChatCentro);
let n = 0;
const dice = (texto: string, hace: number, rol: TurnoChat['rol'] = 'el'): TurnoChat =>
  ({ local: LOCAL, uuid: `u-turno-${String(++n).padStart(4, '0')}`, rol, de: null, texto, at: new Date(AHORA - hace).toISOString(), trabajo: null });
const H = 3_600_000;

test('7: la fila de un chat que NO se abrió avisa su «Completado» (lo último de cada chat viaja con el refresco)', () => {
  // Como en los datos reales (17/10): un chat con 60 turnos, el último un «Ya está» largo de hace 20 minutos.
  const historia = Array.from({ length: 57 }, (_, i) => dice(`Voy a trabajar en el punto ${i}`, (80 - i) * H));
  const turnos = [...historia, dice('Ya está.', 2 * H), dice(`**Ya está:** ${'las tres partes del Plan están en producción y se prueban en /plan. '.repeat(30)}`, 20 * 60_000)];
  const ultimos = { [LOCAL]: resumirTurnos(turnos, AHORA) };
  assert.ok(ultimos[LOCAL].length <= ULTIMOS_POR_CHAT, 'sólo lo último, no los 60');
  assert.ok(ultimos[LOCAL].every((u) => u.texto.length <= ULTIMOS_TEXTO), 'recortado: es para la fila, no para la conversación');
  assert.ok(!ultimos[LOCAL].some((u) => u.texto.includes('en el punto 3')), 'lo de hace más de 3 días no viaja');
  const chat = chatDe('CRM');
  const lineas = historialDelChat(chat, new Map(), [], [], turnosParaLaLista(chat, {}, ultimos, false) ?? []);
  const previa = vistaPrevia(lineas);
  assert.equal(previa?.ya, true, 'la fila sabe que lo último es un «Ya está»');
  const vistos: VistosDeChats = { desde: AHORA - 5 * H, chats: {} };
  assert.equal(avisaYaEsta(previa, vistos, chat.clave), true, 'y avisa: llegó después de la primera vez que se abrió el Ops Center');
  assert.equal(avisaYaEsta(previa, { ...vistos, chats: { [chat.clave]: AHORA } }, chat.clave), false, 'abierto después: no');
  // Sin lo que trajo el refresco (como estaba), no hay nada que avisar: ése era el bug.
  assert.equal(turnosParaLaLista(chat, {}, {}, false), undefined);
  assert.equal(vistaPrevia(historialDelChat(chat, new Map(), [], [], [])), null);
  // El chat que se mira nunca usa lo recortado (su conversación espera los turnos enteros), y los enteros ganan siempre.
  assert.equal(turnosParaLaLista(chat, {}, ultimos, true), undefined);
  assert.equal(turnosParaLaLista(chat, { [chat.clave]: turnos }, ultimos, false), turnos);
  // Cableado: el motor trae lo último en cada refresco y lo usa para dibujar la fila; el teléfono y la computadora lo reciben al abrir.
  const motor = sinComentarios(leer('app/admin/operaciones/useCentro.ts'));
  assert.match(motor, /turnosParaLaLista\(c, turnos, ultimos, mirando === c\.clave\), preguntas\[c\.clave\]\)/);
  assert.match(motor, /if \(f\.ultimos\) \{/, 'cada refresco');
  assert.match(sinComentarios(leer('app/admin/operaciones/acciones.ts')), /leerUltimosTurnos\(\)\]\);\s*return \{ ok: true, pedidos, carteros, decisiones, preguntasAbiertas, cuentas, pasos, ultimos \}/);
  for (const f of ['app/admin/operaciones/datos.ts', 'app/m/operaciones/page.tsx']) assert.match(sinComentarios(leer(f)), /ultimosIniciales: ultimos/, f);
});

test('5: «MaKo en WhatsApp» sale de la lista mientras dice «Sin incidentes nuevos», y vuelve avisando con un incidente', () => {
  assert.equal(esChatVigia({ titulo: 'MaKo en WhatsApp' }), true);
  assert.equal(esChatVigia({ titulo: 'MaKo en WhatsApp › Vigía' }), false, 'un sub-chat tiene trabajo real');
  assert.equal(esChatVigia({ titulo: 'Mako en whatsapp ' }), true, 'sin mayúsculas ni espacios de más');
  for (const x of ['Sin incidentes nuevos.', 'sin incidentes nuevos', '**Sin incidentes nuevos**', '✅ Sin incidentes nuevos!']) assert.equal(esSinIncidentes(x), true, x);
  for (const x of ['Sin incidentes nuevos, pero Pablo no recibe nada', 'Hay un incidente nuevo en el ws18', '']) assert.equal(esSinIncidentes(x), false, x);
  const vigia = chatDe('MaKo en WhatsApp', 'local_aaaaaaaa-1111-2222-3333-444444444444');
  // Como en los datos reales: 44 de sus 60 turnos son «Sin incidentes nuevos» y el último también.
  const callado = [
    dice('Arreglé el ws18 y ya está en producción', 5 * H),
    ...Array.from({ length: 6 }, (_, i) => dice('Sin incidentes nuevos.', (6 - i) * 15 * 60_000)),
    dice('Cerebro → MaKo en WhatsApp: tus puntas ya están en producción', 10 * 60_000, 'otro'),
  ];
  assert.equal(incidenteDelVigia(callado), null, 'el último suyo es «Sin incidentes nuevos» (lo que le escribe otro chat no cuenta)');
  assert.equal(vigiaCallado(vigia, callado, 0, false), true, 'callado: afuera de la lista');
  assert.equal(vigiaCallado(vigia, undefined, 0, false), true, 'sin saber nada de él, también');
  assert.equal(vigiaCallado(vigia, callado, 1, false), false, 'si espera una respuesta, se ve');
  assert.equal(vigiaCallado(vigia, callado, 0, true), false, 'el que se está mirando no desaparece de abajo de los dedos');
  assert.equal(vigiaCallado(chatDe('CRM'), callado, 0, false), false, 'sólo el vigía: un chat cualquiera no se esconde');
  // Un incidente de verdad lo hace aparecer, y avisa si no se vio; abierto, ya no avisa (pero sigue hasta el próximo «Sin incidentes»).
  const incidente = [...callado, dice('Incidente: el grupo del ws18 no recibió la confirmación de la reunión de Pablo. Lo reviso.', 60_000)];
  assert.equal(incidenteDelVigia(incidente)?.texto.startsWith('Incidente'), true);
  assert.equal(vigiaCallado(vigia, incidente, 0, false), false, 'con un incidente se ve');
  assert.equal(incidenteSinVer(vigia, incidente, AHORA - 5 * 60_000), true, 'sin ver: avisa como «Espera tu respuesta»');
  assert.equal(incidenteSinVer(vigia, incidente, AHORA), false, 'visto: no');
  assert.equal(incidenteSinVer(chatDe('CRM'), incidente, 0), false, 'sólo el vigía');
  const vuelveACallar = [...incidente, dice('Sin incidentes nuevos.', 10_000)];
  assert.equal(vigiaCallado(vigia, vuelveACallar, 0, false), true, 'el siguiente «Sin incidentes nuevos» lo vuelve a esconder');
  // Cableado: la lista sale filtrada, y el incidente cuenta como una respuesta que espera (el mismo globito y renglón).
  const motor = sinComentarios(leer('app/admin/operaciones/useCentro.ts'));
  assert.match(motor, /conVigia\.filter\(\(c\) => !vigiaCallado\(c, turnosParaLaLista\(c, turnos, ultimos, false\), esperaDe\(c, esperasConVigia\), mirando === c\.clave\)\)/);
  assert.match(motor, /if \(local && incidenteSinVer\(c,/);
  assert.match(motor, /esperas: esperasConVigia,/, 'las dos pantallas leen las esperas con el incidente');
});

test('9: una cuenta recorrida por otro Runner y sin medir no dice «Runner conectado»', () => {
  const visto = new Date(AHORA - 30_000).toISOString();
  const cuentas = cuentasDeUso([{ cuenta: 'claude2', vistoAt: visto }]);
  const pantalla = texto(renderToStaticMarkup(createElement(ListaUso, { cuentas, ahora: AHORA })));
  assert.match(pantalla, /Sin medir: su terminal no tiene Runner abierto/);
  assert.doesNotMatch(pantalla, /Runner conectado|todavía sin medir/);
  assert.equal(textoSinMedicion('apagado'), 'Su uso aparece cuando su Runner esté conectado', 'sin nadie que la recorra: el de siempre');
});

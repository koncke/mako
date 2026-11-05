// =============================================================================
// El bloque de decisiones, como lo pidió Martín al usarlo, y el estado honesto de cada chat (22/10/2026)
// =============================================================================
// Martín, ya usando el bloque, con captura: «Que no se ponga con el fondo blanco, que sea un bloque flotante… Falta un
// desplegable, una flecha o algo para ocultarlo… Tienes que ser capaz de poner links… al final salió como un resumen de todo.
// No debería, pero sí debería poder ver unos botones o algo para volver a la pregunta anterior». Y: «hay muchos chats que
// dicen "Espera tu respuesta" y cuando entro, no veo el mensaje de "Completado" o el bloque de preguntas».
//   1. el bloque flota sobre el fondo del chat, se pliega con una flecha (recordado por chat y por sus preguntas);
//   2. los links se tocan, también los que vienen sin https, y abrir uno no elige la opción;
//   3. con varias, «‹ Anterior», los puntos y «Siguiente ›»; sin pantalla de resumen: con la última, salen todas;
//   4. «Espera tu respuesta» sólo con una pregunta; un «Ya está» sin su ✓ dice «Completado» y el hilo va a él;
//   5. lo que el chat le escribió a OTRO chat va plegado en una línea, «Avance: …»;
//   6. la criatura de la cabecera cuenta con el MISMO número que la fila (Martín, 22/10, 18:45: la fila del «Cerebro» avisaba y
//      la criatura de arriba dormía, «No se entiende»): con un «Completado» sin ✓ está despierta en los dos lugares;
//   7. las decisiones de la Ticketera (Pregunta.tsx, la de «Cuesta dinero» del chat Infra) tienen los MISMOS ajustes que las
//      preguntas de un chat, con las mismas piezas: flotan, se pliegan y sus links se tocan (verificado en producción, 22/10);
//   8. UN SOLO BLOQUE (el Cerebro, midiéndolo en producción: «Martín pide unificar siempre»): la Ticketera, lo que pregunta el chat
//      y lo de la app en UNA tarjeta, con una flecha y una navegación para todas, en la computadora y en el teléfono;
//   9. lo que una TAB le pregunta a la persona (las sugerencias del CRM) entra por el MISMO bloque, en la estrella de cada tab:
//      una por vez, con «Hacerlo» y «Ahora no» como opciones (Martín con captura del /crm: «Mira lo mal que se ve esto»);
//  10. la cabecera del panel de la estrella es el Cerebro con su estrella desde el primer cuadro (decía «Chat nuevo»).
//
// Correr: node --import tsx --test tests/ops-center-bloque-y-estado.test.ts
// PROBADO ROMPIÉNDOLO (base 10/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conDominiosComoLinks } from '../lib/links-texto';
import { TEXTO_SEGUNDO_RENGLON, avisosDe, lineasDeConversacion, primeraOracion, segundoRenglon, turnosParaOtro, ultimoYaEsta, yaEstaSinVer, type LineaChat } from '../lib/centro-chats';
import { animoDe } from '../app/admin/operaciones/Muneco';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BloqueDePreguntas, CuerpoDeLaTab, itemsDelBloque } from '../app/admin/operaciones/PreguntasDelChat';
import type { Decision } from '../app/admin/runway/decisiones';
import type { PreguntaChat } from '../lib/centro-preguntas-chat';
import { esCriaturaDeMako } from '../lib/centro-munecos';
import { JEFE_SECOND_BRAIN, SIN_TITULO } from '../lib/chat-mako-reglas';
import type { TurnoChat } from '../lib/operaciones-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const bloque = () => sinComentarios(leer('app/admin/operaciones/PreguntasDelChat.tsx'));

test('1. flota sobre el fondo del chat y se pliega con una flecha, recordado por chat y por sus preguntas', () => {
  const css = leer('app/admin/operaciones/centro.css');
  assert.match(css, /\.co-caja-wrap \{ background: var\(--bg\); \}/, 'el pie de la caja, con el fondo del chat (no la franja blanca)');
  assert.match(css, /\.co-preg--arriba \{ margin: 0 auto 10px; box-shadow: [^}]*0 10px 30px/, 'una tarjeta flotante, con su sombra');
  const b = bloque();
  assert.match(b, /\{tiraDePreguntas && \(\n\s*<Plegada n=\{preguntas\.length\} onAbrir=\{\(\) => \{ setVerSugerencias\(false\); setPlegado\(false\); \}\}/);
  assert.match(b, /const esperando = \(n: number\) => \(n === 1 \? '1 pregunta esperando' : `\$\{n\} preguntas esperando`\);/);
  assert.match(b, /<Plegar onPlegar=\{\(\) => setPlegado\(true\)\} \/>/);
  // Por chat Y por las preguntas que espera: una nueva lo abre solo.
  assert.match(b, /window\.localStorage\.getItem\(CLAVE_PLEGADO \+ chat\) === firma/);
  for (const f of ['app/admin/operaciones/Conversacion.tsx', 'app/m/operaciones/ChatsMovil.tsx']) {
    assert.match(sinComentarios(leer(f)), /<BloqueDePreguntas key=\{`b-\$\{[a-z.]+\}`\} chat=\{[a-z]+\.clave\}/, `${f}: le dice de qué chat es`);
  }
});

test('2. los links se tocan, también sin https, y abrir uno no elige la opción', () => {
  assert.equal(conDominiosComoLinks('1) Entrá a aistudio.google.com/apikey con la cuenta.'), '1) Entrá a [aistudio.google.com/apikey](https://aistudio.google.com/apikey) con la cuenta.');
  assert.equal(conDominiosComoLinks('hola-mako.com/integraciones, y listo'), '[hola-mako.com/integraciones](https://hola-mako.com/integraciones), y listo');
  for (const igual of ['mirá https://aistudio.google.com/apikey ya', '[acá](https://x.com/a)', 'Next.js, hilo.ts y la v1.2', 'escribime a ana@mako.com']) {
    assert.equal(conDominiosComoLinks(igual), igual, igual);
  }
  const b = bloque();
  assert.match(leer('app/admin/operaciones/bloque-texto.tsx'), /export const conLinks = \(texto: string, k: string\): ReactNode => conFormato\(conDominiosComoLinks\(texto\), k\);/);
  for (const campo of ['p.pregunta', 'p.contexto', 'o.detalle']) assert.ok(b.includes(`conLinks(${campo},`), campo);
  assert.match(b, /onClick=\{\(e\) => \{ if \(!enviando && !\(e\.target as HTMLElement\)\.closest\('a'\)\) tocar\(o\.i\); \}\}/, 'el link no elige');
  assert.match(b, /<div role="button" tabIndex=/, 'la opción no es un <button>: un link adentro de un botón no se abre');
});

test('3. con varias, «‹ Anterior», los puntos y «Siguiente ›»; sin resumen: con la última, salen todas', () => {
  const b = bloque();
  assert.doesNotMatch(b, /repaso|Tus respuestas|Repasar/, 'sin pantalla de resumen');
  // Las flechas solas (Martín, 22/10/2026: «alcanza con las flechas»), con su rótulo para quien no ve; apagadas en las puntas.
  assert.match(b, /disabled=\{enviando \|\| pos === 0\} onClick=\{\(\) => ir\(pos - 1\)\} aria-label="Anterior" title="Anterior">‹<\/button>/);
  assert.match(b, /disabled=\{enviando \|\| pos \+ 1 >= items\.length\} onClick=\{\(\) => ir\(pos \+ 1\)\} aria-label="Siguiente" title="Siguiente">›<\/button>/);
  assert.doesNotMatch(b, /‹ Anterior|Siguiente ›|Elige con|salen todas'|para moverte/, 'sin el texto de las flechas ni la ayuda');
  assert.match(b, /className="co-preg__punto"/);
  // Las del chat salen TODAS cuando están todas contestadas; si no, a la siguiente que falta (de cualquier fuente).
  assert.match(b, /if \(delChatAbiertas\.every\(\(q\) => todo\[q\.id\]\)\) \{ void enviar\(todo\); return; \}\n\s*aLaSiguiente\(hechos\(it\.id\)\);/);
});

const LOCAL = 'local_22222222-2222-4222-8222-222222222222';
const t = (uuid: string, rol: TurnoChat['rol'], texto: string, at: string): LineaChat =>
  ({ tipo: 'turno', instante: Date.parse(at), turno: { local: LOCAL, uuid, rol, de: rol === 'otro' ? 'Cerebro' : null, texto, at, trabajo: null } });
// Lo de la captura del chat «CRM»: Martín le pide algo, el chat dice «Ya está», y después le escribe al Cerebro lo del tren.
const CRM: LineaChat[] = [
  t('a', 'yo', 'arreglá el filtro del CRM', '2026-10-22T10:00:00Z'),
  t('b', 'el', 'Voy a trabajar en el filtro del CRM.', '2026-10-22T10:01:00Z'),
  t('c', 'el', 'Ya está: el filtro del CRM anda. Pruébalo en /crm.', '2026-10-22T10:30:00Z'),
  t('d', 'otro', 'Cerebro: el tren 2 está armado, mergeá main', '2026-10-22T11:00:00Z'),
  t('e', 'el', '**Mergeé main en crm-2210.** Corrí los tests afectados: 120/0. Paso el sha a Integración.', '2026-10-22T11:05:00Z'),
];

test('4. «Espera tu respuesta» sólo con una pregunta; un «Ya está» sin su ✓ dice «Completado», y el hilo va a él', () => {
  const quieto = { estado: 'abierto' as const, viejo: false };
  assert.equal(TEXTO_SEGUNDO_RENGLON[segundoRenglon(quieto, 1)!], 'Espera tu respuesta', 'una pregunta abierta');
  assert.equal(TEXTO_SEGUNDO_RENGLON[segundoRenglon(quieto, 0, true)!], 'Completado', 'su «Ya está» sin ✓: no pide nada');
  assert.equal(segundoRenglon(quieto, 0, false), null, 'quieto, sin pregunta ni «Ya está»: tranquilo, sin subtítulo');
  assert.match(sinComentarios(leer('app/admin/operaciones/PiezasCentro.tsx')), /r === 'revisar' \? 'co-fila__l2--ok'/, 'en verde, no en el color que pide algo');
  assert.match(sinComentarios(leer('app/m/operaciones/ChatsMovil.tsx')), /renglon === 'espera' \? 'm-operaciones-espera' : 'm-operaciones-vivo'/, 'y en el teléfono');
  // Sigue hasta su ✓ aunque el chat haya escrito después (la regla del 18/10, tests/centro-ya-visto.test.ts)…
  assert.equal(ultimoYaEsta(CRM), Date.parse('2026-10-22T10:30:00Z'));
  // …y al abrir el chat, el hilo va a ESE turno (no al último).
  assert.equal(yaEstaSinVer(CRM, null), 'c');
  assert.equal(yaEstaSinVer(CRM, Date.parse('2026-10-22T10:30:00Z')), null, 'con su ✓, no');
  assert.match(sinComentarios(leer('app/admin/operaciones/Conversacion.tsx')), /const sinVer = useMemo\(\(\) => yaEstaSinVer\(lineas, yaVisto\), \[lineas, yaVisto\]\);[\s\S]{0,300}?window\.setTimeout\(\(\) => irAlTurno\(sinVer\), 120\);/);
});

test('5. lo que el chat le escribió a OTRO chat va plegado en una línea («Avance: …»); su «Ya está», a la vista', () => {
  assert.deepEqual([...turnosParaOtro(CRM)], ['e']);
  const vista = lineasDeConversacion(CRM);
  assert.deepEqual(vista.filter((l) => l.tipo === 'turno' && l.plegado).map((l) => l.tipo === 'turno' && l.turno.uuid), ['e']);
  assert.ok(!vista.some((l) => l.tipo === 'turno' && l.turno.rol === 'otro'), 'lo del otro chat no se dibuja (la regla de siempre)');
  // Un «Ya está» que pidió otro chat es para Martín: no se pliega.
  const conYa = [...CRM, t('f', 'otro', 'Cerebro: subilo', '2026-10-22T12:00:00Z'), t('g', 'el', 'Ya está: en producción.', '2026-10-22T12:30:00Z')];
  assert.ok(!turnosParaOtro(conYa).has('g'));
  // Lo que vuelve a decir Martín corta: lo de después es para él.
  assert.ok(!turnosParaOtro([...CRM, t('h', 'yo', 'gracias', '2026-10-22T13:00:00Z'), t('i', 'el', 'De nada.', '2026-10-22T13:01:00Z')]).has('i'));
  assert.equal(primeraOracion('**Mergeé main en crm-2210.** Corrí los tests afectados: 120/0.'), 'Mergeé main en crm-2210.');
  assert.match(sinComentarios(leer('app/admin/operaciones/Hilo.tsx')), /if \(t\.rol === 'el' && l\.tipo === 'turno' && l\.plegado\) \{[\s\S]{0,200}?<Avance texto=\{t\.texto\} \/>/);
  assert.match(sinComentarios(leer('app/admin/operaciones/Hilo.tsx')), /\{`Avance: \$\{primeraOracion\(texto\)\}`\}/);
});

test('6. la criatura de la cabecera y la de la fila salen del MISMO número: con un «Completado» sin ✓, despiertas las dos', () => {
  const quieto = { estado: 'abierto' as const, viejo: false };
  // Lo de la captura: ninguna pregunta, un «Completado» sin ver. La fila lo dice; la criatura, despierta.
  assert.equal(TEXTO_SEGUNDO_RENGLON[segundoRenglon(quieto, 0, true)!], 'Completado');
  assert.equal(animoDe(quieto, avisosDe(0, true)), 'despierto');
  // Duerme sólo con la fila en gris (la regla del 17/10).
  assert.equal(segundoRenglon(quieto, 0, false), null);
  assert.equal(animoDe(quieto, avisosDe(0, false)), 'dormido');
  // El número es UNO: `avisos` de useCentro.ts (las esperas con el vigía, más el «Completado» sin ✓)…
  assert.match(sinComentarios(leer('app/admin/operaciones/useCentro.ts')), /const avisos = useMemo\(\(\) => \(c: ChatCentro\) => avisosDe\(esperaDe\(c, esperasConVigia\), yaSinVer\.has\(c\.clave\)\)/);
  // …y lo usan la fila y la cabecera, en la computadora…
  const piezas = sinComentarios(leer('app/admin/operaciones/PiezasCentro.tsx'));
  assert.match(piezas, /const animo = animoDe\(c, k\.avisos\(c\)\);/, 'la fila');
  assert.match(piezas, /espera=\{k\.avisos\(chat\)\}\n\s*preguntas=\{preguntasDelChat\(chat,/, 'la conversación');
  assert.match(sinComentarios(leer('app/admin/operaciones/Conversacion.tsx')), /const animo = animoDe\(chat, espera\);/);
  // …y en el teléfono (la fila suma lo mismo: `avisosDe(espera, nuevo)` con `nuevo` = `yaSinVer`).
  const movil = sinComentarios(leer('app/m/operaciones/ChatsMovil.tsx'));
  assert.match(movil, /const animoAbierto = elegido \? animoDe\(elegido, centro\.avisos\(elegido\)\) : 'despierto';/);
  assert.match(movil, /<TituloDeChat chat=\{elegido\} aspecto=\{aspectoAbierto\} avisos=\{centro\.avisos\(elegido\)\}/);
  assert.match(movil, /const animo = animoDe\(c, avisosDe\(espera, nuevo\)\);/);
  assert.match(movil, /nuevo=\{centro\.yaSinVer\.has\(f\.c\.clave\)\}/);
  assert.doesNotMatch(movil, /esperaDe\(elegido,/, 'la cabecera del teléfono no cuenta aparte');
});

test('7. las decisiones de la Ticketera flotan, se pliegan y sus links se tocan, con las piezas de las preguntas del chat', () => {
  const d: Decision = {
    id: 41, ref: 'd-41', chat: 'Infra', pregunta: '¿Le ponemos tarjeta a GitHub con un tope?',
    opciones: [{ clave: 'A', texto: 'Tarjeta con tope', detalle: 'Se pone en github.com/settings/billing en 2 minutos.' }, { clave: 'B', texto: 'Nada' }],
    destraba: null, contexto: 'Van 835 de 2.000 minutos.', recomendada: 'A', urgencia: 'criterio', href: null, orden: 100,
    respuesta: null, respuestaTexto: null, respondidaAt: null, recogidaAt: null, creadaAt: '2026-10-22T16:00:00Z',
  };
  const html = renderToStaticMarkup(createElement(BloqueDePreguntas, { chat: 'local_infra', ticketera: [d], responderTicketera: async () => ({ error: null, ok: true }) }));
  assert.match(html, /class="co-preg co-preg--arriba"/, 'la tarjeta flotante');
  assert.match(html, /class="co-preg__plegar"[^>]*aria-label="Ocultar las preguntas"/, 'la flecha');
  assert.match(html, /<a [^>]*href="https:\/\/github\.com\/settings\/billing"[^>]*>github\.com\/settings\/billing<\/a>/, 'el link sin https, tocable');
  assert.match(html, /<div role="button" tabindex="0"[^>]*data-op="0" class="co-preg__op"/, 'la opción no es un <button>');
  const src = sinComentarios(leer('app/admin/operaciones/Pregunta.tsx'));
  assert.match(src, /import \{ conLinks \} from '\.\/bloque-texto';/, 'los mismos links, no una copia');
  assert.match(src, /onClick=\{\(e\) => \{ if \(!guardando && !\(e\.target as HTMLElement\)\.closest\('a'\)\) void elegir\(o\.clave\); \}\}/, 'el link no elige');
  assert.match(src, /if \(clave === OTRA && hayClave\(texto\)\) \{ setError\(AVISO_CLAVE_EN_EL_CENTRO\); return; \}/, 'una clave en «Otra» no se guarda');
  assert.doesNotMatch(src, /className="co-preg[ "]|usePlegado|Plegar/, 'la tarjeta, la flecha y el plegado son del bloque, no de acá');
});

test('8. UN solo bloque: la Ticketera, lo que pregunta el chat y lo de la app, en una tarjeta con una flecha y una navegación', () => {
  const t: Decision = {
    id: 42, ref: 'd-42', chat: 'Infra', pregunta: '¿Tarjeta a GitHub?', opciones: [{ clave: 'A', texto: 'Sí' }, { clave: 'B', texto: 'No' }],
    destraba: null, contexto: null, recomendada: 'A', urgencia: 'cuesta', href: null, orden: 100,
    respuesta: null, respuestaTexto: null, respondidaAt: null, recogidaAt: null, creadaAt: '2026-10-22T16:00:00Z',
  };
  const q = (id: string, origen?: 'ask') => ({
    id, local: 'local_22222222-2222-4222-8222-222222222222', pregunta: `¿Pregunta ${id.slice(0, 4)}?`, contexto: null,
    opciones: [{ titulo: 'Uno', detalle: null }, { titulo: 'Dos', detalle: null }], recomendada: 0, varias: false,
    at: '2026-10-22T16:01:00Z', respuesta: null, ...(origen ? { origen } : {}),
  }) as unknown as PreguntaChat;
  const chat = q('aaaaaaaa-1111-4222-8333-444444444444');
  const app = q('bbbbbbbb-1111-4222-8333-444444444444', 'ask');
  // Una lista, LA MÁS NUEVA PRIMERO (5/11/2026, Martín: «Las más nuevas primero, y que lo viejo no tape a lo de hoy»; hasta ese día
  // iba la Ticketera primero), a igual fecha en el orden de siempre, y cada id dice de qué fuente es (no se pisan). El orden por
  // fecha, con su caso viejo de días, en tests/ops-center-ignorar.test.ts.
  assert.deepEqual(itemsDelBloque([t], [chat], [app]).map((x) => x.id), [`c:${chat.id}`, `a:${app.id}`, 't:42']);
  const html = renderToStaticMarkup(createElement(BloqueDePreguntas, {
    chat: 'local_infra', ticketera: [t], responderTicketera: async () => ({ error: null, ok: true }),
    delChat: [chat], onResponder: async () => null, deLaApp: [app],
  }));
  assert.equal((html.match(/class="co-preg co-preg--arriba/g) ?? []).length, 1, 'UNA tarjeta, no tres');
  assert.equal((html.match(/class="co-preg__plegar"/g) ?? []).length, 1, 'una flecha');
  // Sin «1 de 3» a la vista (Martín, 24/10/2026: «Si ya aparecen los puntitos en las preguntas, no hace falta "1 de 3"»):
  // lo dicen los puntos, y el lector de pantalla lo oye en su rótulo. PROBADO ROMPIÉNDOLO (25/10): con el texto de vuelta → rojo.
  assert.match(html, /class="co-preg__puntos" role="group" aria-label="1 de 3"/, 'una navegación para las tres, con su rótulo');
  assert.doesNotMatch(html, />\s*1 de 3\s*</, '«1 de 3» volvió a la vista');
  assert.equal((html.match(/class="co-preg__punto"/g) ?? []).length, 3);
  assert.match(html, /¿Pregunta aaaa\?/, 'abre en la primera: la más nueva (la del chat, un minuto después de la Ticketera)');
  // Montado UNA vez, en las dos pantallas, con las tres fuentes.
  for (const f of ['app/admin/operaciones/Conversacion.tsx', 'app/m/operaciones/ChatsMovil.tsx']) {
    const src = sinComentarios(leer(f));
    assert.equal((src.match(/<BloqueDePreguntas /g) ?? []).length, 1, `${f}: un bloque`);
    assert.match(src, /ticketera=\{preguntas\} responderTicketera=\{responder\}\n\s*delChat=\{bloque\}[^\n]*deLaApp=\{deLaApp\}/, `${f}: las tres fuentes`);
    assert.doesNotMatch(src, /<Pregunta |<PreguntasDelChat |<PreguntasDeLaApp /, `${f}: sin las tarjetas sueltas`);
  }
});

test('9. lo que una tab le pregunta (las sugerencias del CRM) va en EL bloque: una por vez, con «Hacerlo» y «Ahora no»', () => {
  const cuota = { id: 'cuota', pregunta: '1 cuota vencida sin cobrar. ¿Te aviso cuando venza una?', opciones: [{ titulo: 'Hacerlo', recomendada: true, onElegir: () => {} }, { titulo: 'Ahora no', onElegir: () => {} }] };
  const html = renderToStaticMarkup(createElement(BloqueDePreguntas, {
    chat: 'tab:CRM',
    deLaTab: [cuota, { id: 'r1', pregunta: 'Escribirle para reagendar a quien cae en «Nutrición No Show R1»', opciones: [{ titulo: 'Hacerlo', href: '/automations?ws=1' }] }],
  }));
  // Plegadas en su tira (Martín, 22/10/2026: «muy invasivas»): tests/ops-center-sugerencias-plegadas.test.ts.
  assert.equal((html.match(/class="co-preg co-preg--arriba/g) ?? []).length, 1, 'una tira, no una lista');
  assert.doesNotMatch(html, /1 cuota vencida sin cobrar|Nutrición No Show R1/, 'plegadas: ninguna a la vista');
  // Abierta, una por vez, con «Hacerlo» y «Ahora no» como sus opciones.
  const abierta = renderToStaticMarkup(createElement(CuerpoDeLaTab, { q: cuota }));
  assert.match(abierta, /1 cuota vencida sin cobrar/);
  assert.match(abierta, /Hacerlo<span class="co-preg__rec"> \(Recomendada\)<\/span>/);
  assert.match(abierta, />Ahora no</);
  assert.match(bloque(), /\{visibles\.length > 1 && <Pasos items=\{visibles\} pos=\{pos\} ir=\{ir\} contestada=\{contestada\} nombre="Sugerencia" \/>\}/, 'una por vez, con ‹ ›');
  // La estrella lo monta arriba de la caja, y el CRM ya no dibuja su lista suelta arriba del hilo.
  const pieza = sinComentarios(leer('app/_chat/MakoEnLaTab.tsx'));
  assert.match(pieza, /\{preguntas && preguntas\.length > 0 && <BloqueDePreguntas chat=\{`tab:\$\{tab\}`\} deLaTab=\{preguntas\} \/>\}\n\s*<div className="co-caja">/);
  const crm = sinComentarios(leer('app/crm/mako-crm/PanelMakoCrm.tsx'));
  assert.match(crm, /return <MakoEnLaTab tab="CRM"[^>]* arriba=\{sugerencias\} preguntas=\{preguntas\} aviso=\{n\} pedido=\{pedido\} \/>;/);
  assert.match(crm, /titulo: 'Hacerlo', recomendada: true, \.\.\.\(s\.tipo === 'link' && s\.href \? \{ href: s\.href \} : \{ onElegir: \(\) => hacer\(s\) \}\)/);
  assert.match(crm, /titulo: 'Ahora no', onElegir: \(\) => void pedirAlServer\('ahora_no', s\)/);
  assert.doesNotMatch(crm, /maxHeight: '42%'|>Hacerlo<\/(Button|ButtonLink)>/, 'la lista suelta, con su scroll, volvió');
});

test('10. la cabecera de la estrella es el Cerebro desde el primer cuadro, con su estrella (no «Chat nuevo» y una redonda)', () => {
  assert.equal(esCriaturaDeMako(JEFE_SECOND_BRAIN), true, 'el Cerebro se dibuja con la estrella');
  assert.equal(esCriaturaDeMako(SIN_TITULO), false, '«Chat nuevo» era la redonda');
  const hook = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.match(hook, /const vaAlCerebro = !filaAbierta && elegido == null && entrarAlCerebro && chatInicial == null;/);
  assert.match(hook, /const nombre = quien\?\.nombre \?\? filaAbierta\?\.titulo \?\? \(vaAlCerebro \? NOMBRE_JEFE\n/);
  assert.match(hook, /const nombreMuneco = quien\?\.nombre \?\? filaAbierta\?\.criatura \?\? \(vaAlCerebro \? JEFE_SECOND_BRAIN : idOffer != null \? criaturaDeOffer\(nombre\) : nombre\);/, 'el nombre ya no da la estrella: se pide');
  // La estrella y el Ops Center del cliente entran al Cerebro: los dos lo dibujan así desde el principio.
  assert.match(sinComentarios(leer('app/_chat/MakoEnLaTab.tsx')), /useChatCliente\(\{ elegido, setElegido, activo: true, entrarAlCerebro: true,/);
  assert.match(sinComentarios(leer('app/_chat/MakoEnLaTab.tsx')), /cabecera=\{\{ clave: 'cerebro', titulo: k\.nombre, criatura: k\.nombreMuneco,/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 5/0):
//   · el pie vuelve al fondo blanco                       → 4/1 (1)
//   · sin recordar el plegado                             → 4/1 (1)
//   · un dominio sin https no es link                     → 4/1 (2)
//   · el link elige la opción                             → 4/1 (2)
//   · la última no manda todas                            → 4/1 (3)
//   · «Completado» vuelve a pedir respuesta               → 4/1 (4)
//   · el hilo no va al «Ya está»                          → 4/1 (4)
//   · se pliega el «Ya está» que pidió otro chat          → 4/1 (5)
// Y el 6 (22/10/2026, base 6/0):
//   · la cabecera de la computadora con `esperaDe`        → 5/1 (6)
//   · la criatura del teléfono con `esperaDe`             → 5/1 (6)
//   · el título del teléfono con `esperaDe`               → 5/1 (6)
//   · `avisos` sin el «Completado» sin ✓                  → 5/1 (6)
// Y el 7 (22/10/2026, base 7/0):
//   · la tarjeta de la Ticketera sin flotar               → 6/1 (7)
//   · sin la flecha                                       → 6/1 (7)
//   · el detalle sin sus links                         → 6/1 (7)
//   · la opción vuelve a ser un <button>                  → 6/1 (7)
// Y el 8 (22/10/2026, base 8/0):
//   · la Ticketera fuera del bloque en la computadora     → 7/1 (8)
//   · la Ticketera fuera de la lista                      → 6/2 (7, 8)
//   · la navegación sólo para las del chat                → 7/1 (8)
// Y el 9 y el 10 (22/10/2026, base 10/0):
//   · la estrella sin el bloque (las sugerencias, sueltas) → 9/1 (9)
//   · la tab fuera de la lista del bloque                 → 9/1 (9)
//   · la cabecera vuelve a «Chat nuevo» mientras llega   → 9/1 (10)

// =============================================================================
// EL ONBOARDING V2 CONTRA LO ACORDADO: la tarjeta del código, la del teléfono y los recuadros (20/11/2026)
// =============================================================================
// La auditoría del Cerebro (side-session-notes/…/auditoria-onboarding-reto-20-11.md, tramo «onboarding-antes»). OA-01 a OA-05 ya
// estaban (la cuarta ronda, a8187496b). Aquí:
//   · OA-06: «Confirmar» siempre activo; de lo pegado, el grupo de 6 números seguidos; un teléfono en la caja no es un código;
//   · OA-07: con los 6 números, se confirma solo a los 0,9 s;
//   · OA-08: con el código vencido, «Abrir WhatsApp» sigue (sin «Pedir otro»);
//   · OA-05 (el resto): el error de la caja ya no dice «Pega aquí el código»;
//   · OA-15: «Seguir» siempre activo, y con menos dígitos el error de la maqueta;
//   · OA-14, OA-18, OA-F2: «Escribe otra cosa» en el contacto, «¿Cómo llegaste a MaKo?» sin el nombre, «Ya lo guardé» en la caja;
//   · OA-F1: el WhatsApp de la burbuja, con la lada y en grupos;
//   · OA-11 / OD-F3: «Sigamos en tu computadora» con la estrellita, el correo y el nombre del chat.
//   · OA-16: en el V2 no se siembra el origen (la pregunta se hace siempre); OD-13: «Entrar a MaKo» pausa los videos (no flotan).
// Probado rompiéndolo (20/11/2026, una rotura por vez y restaurada): 9 roturas, y cada una tumba su test.
// Y la tanda del cierre (19 a 21: OD-09, OD-10 y la marca de la foto de OD-11), con sus roturas: la marca al reto sin esperar el
// mensaje cae el 19; el mensaje sin esperar a que empiece el reto, el 19; el motor esperando el clic sólo en el último paso, el 20; el
// clic de un paso del medio que termina el tutorial, el 20; el Second Brain sin `clic`, el 20; el botón de la foto sin su marca, el 21.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { E_TELEFONO_INCOMPLETO, codigoDeLoEscrito, mensajesDeArranque, telefonoVisible, type HechosArranque } from '../lib/onboarding-arranque';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const v2 = () => sinComentarios(leer('app/onboarding/ChatArranqueV2.tsx'));
const H: HechosArranque = { modo: 'oferta', v2: true, nombreCuenta: '', nombreWorkspace: '', faseGuardada: false, canalNegocio: null, loQueVende: false, conCrm: true, conTelefono: true, terminado: false };
const VERIFICADO = { nombre: 'Valentina', telefono: 'verificado' as const, telefonoNumero: '+5491155550101' };

test('1. OA-06: de lo pegado, el grupo de 6 números; «Confirmar» siempre activo; un teléfono en la caja no es un código', () => {
  assert.equal(codigoDeLoEscrito('Hola Valentina, soy MaKo. Tu código para confirmar tu WhatsApp es 482913. 21:30'), '482913', 'el mensaje entero');
  assert.equal(codigoDeLoEscrito('48 29 13'), '482913');
  assert.equal(codigoDeLoEscrito('4829'), '4829', 'incompleto: el servidor dice «Faltan números»');
  const t = v2();
  assert.match(t, /onChange=\{\(e\) => setCodigo\(codigoDeLoEscrito\(e\.target\.value\)\)\}/);
  assert.match(t, /<Button variant="primary" size="sm" disabled=\{ocupado\} loading=\{ocupado\} onClick=\{confirmar\}>Confirmar<\/Button>/, 'sin apagarse por el largo');
  const ruta = leer('app/api/onboarding/arranque/route.ts');
  // La caja, con `codigoEnLaCaja` desde la verificación (20/11): «482 913» como lo manda MaKo; un teléfono no entra; vacía, sí
  // (wa-12). tests/onboarding-v2-verificacion.test.ts, 1.
  assert.match(ruta, /codigoEnLaCaja\(texto\)/);
});

test('2. OA-07: con los 6 números, el código se confirma solo a los 0,9 s, una vez por código', () => {
  const t = v2();
  assert.match(t, /const MS_CODIGO_SOLO = 900;/);
  assert.match(t, /if \(codigo\.length !== 6 \|\| ocupado \|\| solo\.current === codigo\) return;\n\s*const t = window\.setTimeout\(\(\) => \{ solo\.current = codigo; confirmar\(\); \}, MS_CODIGO_SOLO\);/);
});

test('3. OA-08: con el código vencido, «Abrir WhatsApp» sigue en la tarjeta (sin «Pedir otro»)', () => {
  const t = v2();
  assert.doesNotMatch(t, /Pedir otro|Pasó mucho tiempo/);
  assert.match(t, /const sinLink = !w \|\| !w\.link;/, 'sólo sin el link no hay «Abrir WhatsApp»');
  assert.doesNotMatch(t, /w\.estado === 'vencido'/);
});

test('4. OA-05 y OA-15: los textos de error de la caja y del teléfono', () => {
  const lib = leer('lib/onboarding-arranque.ts');
  assert.doesNotMatch(lib, /'Pega aquí el código/, 'sin «Pega aquí»: la tarjeta no tiene ese rótulo');
  assert.match(lib, /if \(etapa === 'codigo'\) return \{ ok: false, error: 'Escribe el código de 6 números que te mandé por WhatsApp\.' \};/);
  assert.equal(E_TELEFONO_INCOMPLETO, 'A ese número le faltan dígitos. Revísalo y toca «Seguir».');
  const t = v2();
  assert.match(t, /if \(numero\.replace\(\/\\D\/g, ''\)\.length < 6\) \{ onIncompleto\(\); return; \}/);
  assert.match(t, /<Button variant="primary" size="sm" full disabled=\{ocupado\} loading=\{ocupado\} onClick=\{seguir\}>Seguir<\/Button>/, '«Seguir» siempre activo');
  assert.match(leer('app/api/onboarding/arranque/route.ts'), /if \(digitos\.length < 8\) return no\(422, h\.v2 \? E_TELEFONO_INCOMPLETO :/);
});

test('5. OA-14, OA-18 y OA-F2: «Escribe otra cosa» en el contacto, la pregunta sin el nombre y «Ya lo guardé»', () => {
  const agendado = mensajesDeArranque({ ...VERIFICADO }, H).antes.at(-1)!;
  assert.equal(agendado.id, 'arr-agendado');
  assert.equal(agendado.recuadro?.libre, true, 'OA-14');
  const agendadoNo = mensajesDeArranque({ ...VERIFICADO, agendado: 'no' }, H).antes.at(-1)!;
  assert.equal(agendadoNo.id, 'arr-agendado-no');
  assert.equal(agendadoNo.recuadro?.libre, true);
  const origen = mensajesDeArranque({ ...VERIFICADO, agendado: 'si', negocio: 'Nutri Vale' }, H).antes.at(-1)!;
  assert.equal(origen.recuadro?.pregunta, '¿Cómo llegaste a MaKo?', 'OA-18: el recuadro sin el nombre');
  assert.match(origen.texto, /Valentina/, 'el mensaje sí lo nombra');
  const t = v2();
  assert.match(t, /const pregunta = q\.pregunta \?\? m\.texto;/);
  assert.match(t, /<p className="co-preg__texto">\{pregunta\}<\/p>/);
  assert.match(t, /const enAgendadoNo = etapa === 'agendado' && mensajes\.some\(\(m\) => m\.id === 'arr-agendado-no'\);/);
  assert.match(t, /: enAgendadoNo \? 'Ya lo guardé' : PH\[etapa\]/, 'OA-F2');
});

test('6. OA-F1: el WhatsApp de la burbuja, con la lada y en grupos (nunca pegado)', () => {
  assert.equal(telefonoVisible('+5491155550101'), '+54 911 5555 0101');
  assert.equal(telefonoVisible('5491155550101'), '+54 911 5555 0101');
  const r = mensajesDeArranque({ ...VERIFICADO }, H).antes.find((m) => m.id === 'arr-telefono-r');
  assert.equal(r?.texto, '+54 911 5555 0101', 'la respuesta guardada');
  assert.match(v2(), /onSeguir=\{\(tel, visible\) => void accion\(\{ action: 'telefono', telefono: tel, visible \}, visible\)\}/, 'la que espera, como la escribió (y se guarda así: verificación de OA-F1)');
});

test('7. OA-11 / OD-F3: «Sigamos en tu computadora» con la estrellita, el correo y el nombre del chat', () => {
  // En su archivo desde el 20/11 (R57-F5: el reto usa el mismo); ChatArranque lo re-exporta.
  const s = sinComentarios(leer('app/onboarding/SeguirEnPc.tsx'));
  assert.match(s, /\{maqueta && <span aria-hidden="true" data-seguir-criatura=""><CriaturaMako size=\{64\} reaccion="contenta" \/><\/span>\}/);
  // Con su sobre, y «tu correo» sin email (20/11, la verificación de OA-11): tests/onboarding-v2-verificacion.test.ts, 5.
  assert.match(s, /Te mandamos el link a <b[^>]*>\{email \|\| 'tu correo'\}<\/b>\./);
  assert.match(v2(), /<SeguirEnPc nombre=\{primerNombre\(vista\.nombre \|\| persona\?\.nombre \|\| ''\)\} email=\{persona\?\.email \?\? ''\} maqueta \/>/);
});

test('8. OA-16: en el V2 no se siembra el origen: «¿Cómo llegaste a MaKo?» se pregunta siempre y la contesta ella', () => {
  const p = sinComentarios(leer('app/onboarding/page.tsx'));
  assert.match(p, /const v2 = !!sesion && veOnboardingV2\(\{ email: sesion\.email, ws: wsOrigen \}\);\n\s*if \(wsOrigen != null && !v2\) await sembrarArranqueDesdeOrigen\(wsOrigen\);/);
});

test('9. OD-13: «Entrar a MaKo» pausa los videos del onboarding (no pasan flotando), y la primera vez vuelve a mirar con el motor libre', () => {
  assert.match(v2(), /for \(const v of Array\.from\(document\.querySelectorAll<HTMLVideoElement>\('\.arr-v2 video'\)\)\) v\.pause\(\);/);
  const m = sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx'));
  assert.match(m, /const ocupadoElMotor = !!useSenal\(\);/);
  assert.match(m, /\}, \[abierto, onCerrar, t, ocupadoElMotor\]\);/);
});

test('10. OD-08: con el V2, la lista del Ops Center va Ops Center, Onboarding, Reto, los coaches, el resto y «Nuevo chat» al final', () => {
  const c = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(c, /const filaOnboarding = retoV2 && hiloOnboarding != null \? filasDeLaLista\.find\(\(f\) => 'id' in f\.elegido && f\.elegido\.id === hiloOnboarding\) \?\? null : null;/);
  assert.match(c, /f\.origen !== 'offer' && !f\.guru && f !== filaOnboarding/, 'sale de la lista por actividad');
  const orden = ['{fila(cerebroFila)}', '{!retoV2 && coaches}', '{filaOnboarding && <div className="co-cuenta">{fila(filaOnboarding)}</div>}', 'marca="sb-reto-chat"', '{retoV2 && coaches}', '<GruposPorJefe', "{retoV2 && <NuevoChatCentro"];
  const pos = orden.map((x) => c.indexOf(x));
  assert.ok(pos.every((p) => p > 0), `están todos: ${pos.join(', ')}`);
  assert.deepEqual([...pos].sort((a, b) => a - b), pos, 'en ese orden');
  assert.match(c, /\{!retoV2 && <NuevoChatCentro onNuevo=\{\(\) => elegir\(\{ virtual: 'nuevo' \}\)\}/, 'sin el V2, «Nuevo chat» arriba como siempre');
  // El id del chat se LEE (sin armarlo): la página no crea nada al cargar.
  const srv = leer('lib/onboarding-arranque-server.ts');
  const lee = srv.slice(srv.indexOf('export async function hiloOnboardingGuardado'), srv.indexOf('export async function hiloDelOnboarding'));
  assert.doesNotMatch(lee, /guardarEstadoArranque|insert|crear/i, 'sólo lee');
  assert.match(leer('app/second-brain/page.tsx'), /const hiloOnboarding = retoV2 \? await hiloOnboardingGuardado\(\) : null;/);
});

test('11. OD-03: «Tu panel» abre la barra ENTERA mientras dura el paso, y al pasar se vuelve a plegar', () => {
  const b = sinComentarios(leer('app/_ui/tutorial/barra-oculta.ts'));
  assert.match(b, /export const EVENTO_BARRA_ENTERA = 'mk-barra-entera';/);
  assert.match(b, /window\.dispatchEvent\(new CustomEvent<boolean>\(EVENTO_BARRA_ENTERA, \{ detail: si \}\)\)/);
  const s = sinComentarios(leer('app/_components/Sidebar.tsx'));
  assert.match(s, /const alPedir = \(e: Event\) => setAbiertaAca\(\(e as CustomEvent<boolean>\)\.detail === true\);\n\s*window\.addEventListener\(EVENTO_BARRA_ENTERA, alPedir\);/);
  const m = sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx'));
  assert.match(m, /const abreLaBarra = presentaLaBarra\(paso\.sel\);\n\s*if \(abreLaBarra\) barraEntera\(true\);/);
  assert.match(m, /if \(abreLaBarra\) barraEntera\(false\); \};\n\s*\}, \[paso, senal\.tipo, siguiente, modoVideo\]\);/, 'al pasar, plegada');
});

test('12. OA-10 / OD-12: en el teléfono, «Sigamos en tu computadora» se queda hasta ver el recorrido en la PC', () => {
  // En el módulo chico desde el 20/11 (el guard lo importa el layout raíz: tests/seguir-en-pc-liviano.test.ts).
  const srv = leer('lib/seguir-en-pc.ts');
  const f = srv.slice(srv.indexOf('export async function seguirEnPcPendiente'));
  assert.match(f, /if \(!veOnboardingV2\(/, 'sólo con el V2');
  assert.match(f, /if \(await estaImpersonando\(\)\.catch\(\(\) => true\)\) return false;/, 'mirando a un cliente, nunca');
  assert.match(f, /return !Object\.prototype\.hasOwnProperty\.call\(vistosDePerfil\([^)]*\)\?\.perfil\), ID_RECORRIDO_PC\);/);
  assert.match(srv, /const ID_RECORRIDO_PC = 'tutorial-ops-center';/, 'el id con que lo anota el motor');
  assert.match(sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx')), /const id = `tutorial-\$\{t\.pestana\}`;/, 'el motor anota `tutorial-<pestaña>`');
  const onb = sinComentarios(leer('app/onboarding/page.tsx'));
  assert.match(onb, /if \(\(await esTelefono\(\)\.catch\(\(\) => false\)\) && \(await seguirEnPcPendiente\(\)\)\) \{[\s\S]{0,300}return <SeguirEnPc [^>]*maqueta \/>;/);
  assert.ok(onb.indexOf('seguirEnPcPendiente()') < onb.indexOf('redirect(await rutaConWs(destinoDeTabVieja(tab)))'), 'antes de mandarlo a la app');
  const ini = sinComentarios(leer('app/inicio/page.tsx'));
  assert.match(ini, /if \(MOBILE_AL_ENTRAR && !!sesion && \(await esTelefono\(\)\) && \(await seguirEnPcPendiente\(\)\)\) redirect\(await rutaConWs\(RUTA_SEGUIR_EN_PC\)\);\n\s*if \(telefono\) redirect\(await rutaConWs\(ENTRADA_MOVIL\)\);/);
});

test('13. OA-12: el sol y la luna también en la entrada («Hola, soy MaKo»), y su clic no la empieza', () => {
  const e = sinComentarios(leer('app/onboarding/EntradaMako.tsx'));
  assert.match(e, /<span className="en-modo" role="presentation" onClick=\{\(e\) => e\.stopPropagation\(\)\}><InterruptorModo variante="sitio" \/><\/span>/);
  assert.match(e, /\.en-modo \{ position: absolute; top: 27px; right: max\(16px, calc\(\(100% - 960px\) \/ 2\)\); z-index: 1; \}/, 'alineado al bloque de 960, como la cabecera del chat');
});

test('14. V10 y F1: el manifiesto de los videos, fresco en cada visita; y «Todavía no está grabado» sólo con el manifiesto ya leído', () => {
  const h = sinComentarios(leer('app/_ui/tutorial/useVideoTutorial.ts'));
  assert.doesNotMatch(h, /force-cache/, 'un navegador que ya lo tenía no veía los videos nuevos');
  assert.match(h, /fetch\(RUTA_MANIFIESTO, \{ cache: 'no-cache' \}\)/);
  assert.match(h, /export function useManifiestoListo\(\): boolean \{/);
  assert.match(sinComentarios(leer('app/_ui/tutorial/VideoDelMomento.tsx')), /if \(!v\) \{\n\s*return revision && listo\n/);
  assert.match(sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx')), /if \(cerrado \|\| \(!video && !\(revision && manifiestoListo\)\)\) return null;/);
});

test('15. F2: el video que pasó a la esquina vuelve al chat cuando su mensaje se ve otra vez, desde el segundo en que iba', async () => {
  const { reproducirFlotante, volverAlChat, anotarTiempoFlotante, senalAhora } = await import('../app/_ui/tutorial/store');
  reproducirFlotante('onboarding-bienvenida', 'Bienvenida', 3);
  anotarTiempoFlotante(7.5);
  assert.equal(volverAlChat('otro-video'), null, 'otro video no lo cierra');
  assert.equal(volverAlChat('onboarding-bienvenida'), 7.5, 'el segundo en que iba');
  assert.equal(senalAhora(), null, 'el flotante se cerró');
  assert.equal(volverAlChat('onboarding-bienvenida'), null, 'ya no flota');
  const h = sinComentarios(leer('app/_ui/tutorial/useVideoQueFlota.ts'));
  assert.match(h, /if \(!e\.isIntersecting\) \{ flotar\(\); continue; \}\n\s*const t = volverAlChat\(clave\);/);
  // El de la esquina es el reproductor de la maqueta desde la verificación de F2 (app/_ui/tutorial/VideoEnLaEsquina.tsx): anota igual.
  assert.match(sinComentarios(leer('app/_ui/tutorial/VideoEnLaEsquina.tsx')), /anotarTiempoFlotante\(e\.currentTarget\.currentTime\);/);
  assert.match(sinComentarios(leer('app/_ui/tutorial/VideoDelMomento.tsx')), /\{flotando && <span className="mk-vmom__esquina" role="status">Se está viendo en la esquina ↘<\/span>\}/);
});

test('16. OD-05 y V9: en el chat «Onboarding», MaKo escribe y manda el video del recorrido con «Dale play…»; su play lo arranca', async () => {
  const { textoLlegada, ID_RECORRIDO, MS_ESCRIBE_LLEGADA } = await import('../lib/onboarding-v2/llegada');
  assert.equal(textoLlegada('Valentina'), 'Te doy la bienvenida a tu Ops Center, Valentina. Dale play: te muestro dónde está cada cosa.');
  assert.equal(ID_RECORRIDO, 'tutorial-ops-center');
  assert.equal(MS_ESCRIBE_LLEGADA, 1800, 'como la pantalla oscura del onboarding');
  const b = sinComentarios(leer('app/second-brain/BienvenidaOpsCenter.tsx'));
  assert.match(b, /const toca = ensayo\.activo \? !vistoEnEnsayo\(ID_RECORRIDO\) : r\.visto === false;/, 'sólo mientras no vio el recorrido (también en el ensayo)');
  assert.match(b, /const alTerminar = ensayo\.activo \? \(\) => marcarVistoEnEnsayo\(ID_RECORRIDO\) : r\.onCerrar;/);
  assert.match(b, /const empezar = \(\) => mostrarTutorial\(TUTORIAL_RECORRIDO, \{ alTerminar \}\);/, 'el play lo arranca y lo anota como visto');
  assert.match(b, /chatPresentaRecorrido\(true\);\n\s*return \(\) => chatPresentaRecorrido\(false\);/);
  assert.match(b, /createPortal\(\n\s*<div className="sbl-capa" aria-hidden="true">/, 'el velo, en un portal');
  // El motor no lo arranca solo mientras el chat lo presenta.
  const m = sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx'));
  assert.match(m, /if \(t\.pestana === 'ops-center' && elChatPresentaElRecorrido\(\)\) \{ window\.setTimeout\(mirar, 500\); return; \}/);
  const c = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(c, /\{enElOnboarding && <BienvenidaOpsCenter nombre=\{nombrePersona\} retoEmpezo=\{!!datosReto\.d\?\.estado\} \/>\}/);
  assert.match(c, /\.\.\.\(enElOnboarding \? \{ acciones: <VideosDelChat videos=\{VIDEOS_DEL_ONBOARDING\} \/> \} : \{\}\),/, 'V9: los videos del onboarding en su chat');
  for (const k of ['onboarding-bienvenida', 'onboarding-bienvenida-whatsapp', 'recorrido']) assert.match(c, new RegExp(`clave: '${k}'`));
});

test('17. OA-13: la pantalla oscura entra con el barrido del sol y la luna (un círculo que se cierra hacia MaKo escribiendo)', () => {
  const t = v2();
  assert.match(t, /@property --arr-iris \{ syntax: '<length>'; inherits: false; initial-value: 0px; \}/);
  assert.match(t, /mask: radial-gradient\(circle at var\(--iris-x, 50%\) var\(--iris-y, 50%\), transparent var\(--arr-iris\), #000 calc\(var\(--arr-iris\) \+ 1px\)\);/);
  assert.match(t, /animation: arr-v2-iris \.72s cubic-bezier\(\.65, 0, \.35, 1\) both;/);
  assert.match(t, /@keyframes arr-v2-iris \{ from \{ --arr-iris: 150vmax; \} to \{ --arr-iris: 0px; \} \}/);
  assert.doesNotMatch(t, /arr-v2-velo \.45s/, 'sin el fundido de antes');
  assert.match(t, /const fila = document\.querySelector<HTMLElement>\('\.arr-v2 \.arr-v2__resalte'\);/, 'centrado en la fila de MaKo escribiendo');
  assert.match(t, /@media \(prefers-reduced-motion: reduce\) \{ \.arr-v2__velo,/, 'con menos movimiento, sin animación');
});

test('18. OA-17: la bienvenida presenta el reto, y su portada lleva el play donde no tapa nada', async () => {
  const { videoDe } = await import('../lib/tutoriales/videos');
  const m = JSON.parse(leer('public/tutoriales/manifiesto.json'));
  const v = videoDe(m, 'onboarding-bienvenida');
  assert.ok(v, 'está la bienvenida');
  const texto = (v?.frases ?? []).map((f) => f.texto).join(' ');
  assert.match(texto, /Muchas gracias por sumarte\./);
  assert.match(texto, /no quiero que sea como tantas otras que activaste y no aprovechaste/);
  assert.match(texto, /Por eso creé un reto de siete días: cada día, un paso, con un video mío/);
  assert.match(texto, /Primero, unas preguntas cortas para conocerte: contéstalas en el chat, debajo de este video\./, 'antes de la pregunta del nombre');
  assert.doesNotMatch(texto, /equipo entero/, 'sin lo que no estaba acordado');
  assert.equal(v?.play, 'abajo-derecha', 'el centro de todos sus cuadros es la cabeza o el texto');
  assert.match(sinComentarios(leer('app/_ui/tutorial/VideoDelMomento.tsx')), /className=\{`mk-vmom__pantalla\$\{v\.play === 'abajo-derecha' \? ' mk-vmom__pantalla--abajo-derecha' : ''\}`\}/);
  assert.match(leer('app/_ui/tutorial/VideoDelMomento.tsx'), /\.mk-vmom__pantalla--abajo-derecha \{ place-items: end end;/);
});

test('19. OD-09: visto el recorrido, MaKo presenta el chat del reto en «Onboarding», y recién después se marca', async () => {
  const { textoRetoEnSuChat, MS_ESCRIBE_RETO } = await import('../lib/onboarding-v2/llegada');
  assert.equal(textoRetoEnSuChat('Valentina'), '¡Listo tu onboarding, Valentina! Tu reto de 7 días tiene su propio chat: ahí te escribo cada día, con su video.', 'la maqueta, RETO_EN_SU_CHAT');
  assert.ok(MS_ESCRIBE_RETO > 0);
  const { chatPresentaReto, elChatPresentaElReto } = await import('../app/_ui/tutorial/store');
  chatPresentaReto(true); assert.equal(elChatPresentaElReto(), true); chatPresentaReto(false); assert.equal(elChatPresentaElReto(), false);
  const b = sinComentarios(leer('app/second-brain/BienvenidaOpsCenter.tsx'));
  assert.match(b, /const cierra = visto && !retoEmpezo;/, 'con el reto empezado, no hace falta');
  assert.match(b, /chatPresentaReto\(true\);\s*const t = window\.setTimeout\(\(\) => \{ setCierre\('listo'\); chatPresentaReto\(false\); \}, MS_ESCRIBE_RETO\);/);
  assert.match(b, /<p>\{textoRetoEnSuChat\(nombre\)\}<\/p>/);
  const m = sinComentarios(leer('app/second-brain/reto/MarcaAlReto.tsx'));
  assert.match(m, /if \(!listo \|\| empezo \|\| marcado\.current \|\| senal \|\| presenta \|\| opsVisto !== true\) return;/);
  assert.match(m, /if \(senalAhora\(\) \|\| elChatPresentaElReto\(\) \|\| marcado\.current\) return;/);
});

test('20. OD-10: sin video, el Second Brain y la flecha del recorrido esperan el clic, y el clic pasa al paso siguiente', async () => {
  const { TUTORIAL_RECORRIDO } = await import('../lib/onboarding-v2/recorrido');
  const paso = (sel: string) => TUTORIAL_RECORRIDO.pasos.find((p) => p.sel.includes(sel));
  assert.equal(paso('sb-second-brain')?.clic, true);
  assert.equal(paso('sb-brain-volver')?.clic, true);
  const m = sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx'));
  assert.match(m, /: modoVideo \? \(cierre \? !!pasoCierre\?\.clic : !!frase\?\.espera_clic\) : !!paso\?\.clic;/, 'cualquier paso con `clic`, no sólo el último');
  assert.match(m, /window\.setTimeout\(\(\) => \(modoVideo && !cierre \? seguirVideo\('persona', navega, url\) : siguiente\(\)\), 0\);/, 'un paso del medio no termina el tutorial');
  // Ningún otro tutorial cambia: fuera del recorrido, `clic` sólo en el último paso.
  const { TUTORIALES } = await import('../lib/tutoriales');
  for (const t of TUTORIALES) {
    const medio = t.pasos.slice(0, -1).filter((p) => p.clic);
    assert.equal(medio.length, 0, `${t.pestana}: un paso del medio con clic cambia cómo se recorre sin video`);
  }
});

test('21. OD-11 (la marca): el botón de la foto de Settings › Perfil lleva su lugar, para la última marca del perfil del día 2', async () => {
  const { MARCA } = await import('../lib/tutoriales/marcas');
  assert.equal(MARCA.settingsFoto, 'tour-settings-foto');
  assert.match(sinComentarios(leer('app/perfil/InformacionPersonal.tsx')), /<button type="button" className="aj-foto aj-foto--grande"[^>]*\n\s*data-recorrido=\{MARCA\.settingsFoto\}/);
});

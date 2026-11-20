// =============================================================================
// LA VERIFICACIÓN DE LA AUDITORÍA DEL ONBOARDING, LOS TUTORIALES Y LOS VIDEOS (20/11/2026, el Cerebro sobre el main 526f32e59)
// =============================================================================
// Un revisor miró el código de cada punto «resuelto» y otro intentó refutarlo. Lo que quedó pendiente o a medias (la nota
// verificacion-pendientes-20-11.md) se arregló así; cada test nombra el punto. Lo de pantalla se miró además en el navegador.
// Probado rompiéndolo (20/11/2026, una rotura por vez y restaurada): sin el grupo de 3 y 3 (el mensaje de MaKo pegado con la hora
// de WhatsApp) cae el 1; `fin` mostrando la barra con la marca «dale play», el 7; retener en el acto (sin `retenerAlFin`), el 12; la
// entrada guardada sólo en la página, el 14; `esRevision` sin mirar el email, el 16; el texto del recorrido arriba del video, el 18.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. OA-06: la caja lee el código como lo manda MaKo («482 913») o su mensaje pegado; vacío, según si MaKo ya contestó', async () => {
  const { codigoEnLaCaja } = await import('../lib/onboarding-arranque');
  const { decidirCodigoV2, mensajeDelCodigoV2, E_SIN_CODIGO_V2, E_ESCRIBE_CODIGO_V2, E_CODIGO_LARGO_V2 } = await import('../lib/verificacion-entrante');
  assert.equal(codigoEnLaCaja('482 913'), '482913', 'en dos grupos, como lo escribe MaKo');
  assert.equal(codigoEnLaCaja('482913'), '482913');
  assert.equal(codigoEnLaCaja(mensajeDelCodigoV2('Juan', '482913')), '482913', 'el mensaje de MaKo entero');
  assert.equal(codigoEnLaCaja('48 29 13'), '482913');
  assert.equal(codigoEnLaCaja('[10:30] MaKo: Tu código para confirmar tu WhatsApp es 482 913.'), '482913', 'pegado con la hora de WhatsApp: el grupo de 3 y 3');
  assert.equal(codigoEnLaCaja('482'), '482', 'los menos: «Faltan números»');
  assert.equal(codigoEnLaCaja('+54 9 11 5555 0101'), null, 'un teléfono no es un código');
  assert.equal(codigoEnLaCaja('¿y ahora qué hago?'), null, 'un texto sin números tampoco');
  // La segunda verificación (20/11, tarde): con letras y sin grupo de código es una pregunta, y un teléfono local sin «+» no es un
  // código. Ninguno de los dos llega a decidirCodigoV2 con números: no da «Faltan números» ni gasta un intento.
  assert.equal(codigoEnLaCaja('no me llegó, esperé 5 minutos'), null, 'una pregunta con un número no es un código');
  assert.equal(codigoEnLaCaja('11 5555 0101'), null, 'un teléfono local sin «+» no es un código');
  assert.equal(codigoEnLaCaja('011 555 123'), null, 'ni con un 3 y 3 adentro');
  assert.equal(codigoEnLaCaja('4829133'), '4829133', 'sólo números, uno de más: un código equivocado');
  const v = { telefono: '5491155550101', codigo: '482913', expira: Date.now() + 60_000, verificado: false, v2: true, entrante: true } as const;
  assert.equal((decidirCodigoV2({ ...v, respondido: false }, '', Date.now()) as { error: string }).error, E_SIN_CODIGO_V2, 'sin respuesta de MaKo: todavía no lo tiene');
  assert.equal((decidirCodigoV2({ ...v, respondido: true }, '', Date.now()) as { error: string }).error, E_ESCRIBE_CODIGO_V2, 'con la respuesta de MaKo: que lo escriba (wa-12, del chat de WhatsApp)');
  assert.equal((decidirCodigoV2({ ...v, respondido: true }, '48', Date.now()) as { error: string }).error, E_CODIGO_LARGO_V2);
  assert.deepEqual(decidirCodigoV2({ ...v, respondido: true }, codigoEnLaCaja('482 913')!, Date.now()), { ok: true });
  const ruta = sinComentarios(leer('app/api/onboarding/arranque/route.ts'));
  assert.match(ruta, /const codigoEscrito = h\.v2 && etapa === 'codigo' && opcion === undefined && texto !== undefined \? \(codigoEnLaCaja\(texto\) \?\? \(telefonoEscrito\(texto\) \? null : ''\)\) : null;/);
  assert.match(ruta, /if \(codigoEscrito !== null\) \{\n\s*const r = await verificarCodigoV2\(g\.ws, codigoEscrito\);/);
});

test('2. OA-02: quien vuelve con el nombre sin contestar ve el video solo; pausarlo o no darle play también suelta la pregunta', () => {
  const v2 = sinComentarios(leer('app/onboarding/ChatArranqueV2.tsx'));
  // Desde el 20/11 (tarde), con useMensajeDelVideo: pausarlo, que termine o que falle la suelta, y sin play a los MS_SIN_PLAY (lo prueba
  // con un video de mentira tests/onboarding-mensaje-del-video.test.ts).
  assert.match(v2, /lugar: filaBienvenida, activo: fase === 'chat', inicial: inicial\.etapa === 'nombre' \? 'espera' : 'listo',\n\s*clave: VIDEO_BIENVENIDA, dice: MOMENTO_NOMBRE\.dice, esperaPlay: MS_SIN_PLAY,/);
  const h = sinComentarios(leer('app/_ui/tutorial/useMensajeDelVideo.ts'));
  assert.match(h, /oir\('pause', \(\) => \{ if \(!video\.ended && !pausaPorFlotar\(video\)\) listo\(\); \}\);/, 'la pausa por pasar a la esquina no la suelta (videos-1)');
  assert.match(h, /sinPlay = reloj\.poner\(\(\) => listo\(\), o\.esperaPlay\);/);
});

test('3. OA-18: el recuadro de «¿Cómo llegaste?» va sin el nombre también plegado y en su aria-label', () => {
  const v2 = sinComentarios(leer('app/onboarding/ChatArranqueV2.tsx'));
  assert.match(v2, /const pregunta = q\.pregunta \?\? m\.texto;/);
  assert.match(v2, /<span>\{pregunta\}<\/span><span className="co-preg__flecha"/);
  assert.match(v2, /aria-label=\{`Pregunta: \$\{pregunta\}`\}/);
  assert.doesNotMatch(v2, /<span>\{m\.texto\}<\/span><span className="co-preg__flecha"/);
});

test('4. OA-F1: el WhatsApp se dibuja como lo escribió («+54 9 11 5555 0101»), no reagrupado', async () => {
  const { telefonoComoLoEscribio } = await import('../lib/onboarding-arranque');
  assert.equal(telefonoComoLoEscribio('+54 9 11 5555 0101', '5491155550101'), '+54 9 11 5555 0101');
  assert.equal(telefonoComoLoEscribio('+34  612 345 678', '34612345678'), '+34 612 345 678');
  assert.equal(telefonoComoLoEscribio('+54 9 11 5555 0102', '5491155550101'), undefined, 'otros dígitos: no');
  assert.equal(telefonoComoLoEscribio('<b>+5491155550101</b>', '5491155550101'), undefined, 'sólo el número');
  const lib = sinComentarios(leer('lib/onboarding-arranque.ts'));
  assert.match(lib, /yo\('telefono', e\.telefonoVisto \|\| \(e\.telefonoNumero \? telefonoVisible\(e\.telefonoNumero\) : 'Mi WhatsApp'\)\);/);
  const ruta = sinComentarios(leer('app/api/onboarding/arranque/route.ts'));
  assert.match(ruta, /telefonoNumero: `\+\$\{digitos\}`, telefonoVisto: visto,/);
  assert.match(ruta, /return await pedirCodigo\(e, h, confirmado, digitos, undefined, telefonoComoLoEscribio\(body\.visible, digitos\)\);/);
  assert.match(sinComentarios(leer('app/onboarding/ChatArranqueV2.tsx')), /accion\(\{ action: 'telefono', telefono: tel, visible \}, visible\)/);
});

test('5. OA-11: «Sigamos en tu computadora» con el sobre delante de «Te mandamos el link» y «tu correo» sin email', () => {
  // En su archivo desde el 20/11 (R57-F5: el reto usa el mismo); ChatArranque lo re-exporta.
  const s = sinComentarios(leer('app/onboarding/SeguirEnPc.tsx'));
  assert.match(s, /<p data-seguir-correo=""[^>]*>\s*<svg[^>]*aria-hidden="true"[^>]*><rect x="3" y="5" width="18" height="14" rx="2\.5" \/><path d="m4 7 8 6 8-6" \/><\/svg>/);
  assert.match(s, /Te mandamos el link a <b style=\{\{ color: 'var\(--ink\)' \}\}>\{email \|\| 'tu correo'\}<\/b>\./);
});

test('6. OA-10 y OD-12: el teléfono va a «Sigamos en tu computadora» desde cualquier /m y con la «Versión completa»', () => {
  const guard = sinComentarios(leer('lib/movil-guard.ts'));
  // Del módulo chico, nunca del servidor del arranque: el guard lo importa el layout raíz (tests/seguir-en-pc-liviano.test.ts).
  assert.match(guard, /if \(opts\.onboarding !== false && \(await seguirEnPcPendiente\(\)\.catch\(\(\) => false\)\)\) redirect\(await rutaConWs\(RUTA_SEGUIR_EN_PC\)\);/);
  assert.match(guard, /import \{ RUTA_SEGUIR_EN_PC, seguirEnPcPendiente \} from '\.\/seguir-en-pc';/);
  assert.match(leer('lib/seguir-en-pc.ts'), /export const RUTA_SEGUIR_EN_PC = '\/onboarding';/, 'donde se dibuja «Sigamos en tu computadora»');
  assert.match(guard, /export async function esTelefono\(\): Promise<boolean> \{\n\s*const h = await headers\(\);\n\s*return tipoDeDispositivo\(h\.get\('user-agent'\), h\.get\('sec-ch-ua-mobile'\)\) === 'telefono';/);
  assert.match(sinComentarios(leer('app/inicio/page.tsx')), /if \(MOBILE_AL_ENTRAR && !!sesion && \(await esTelefono\(\)\) && \(await seguirEnPcPendiente\(\)\)\) redirect\(await rutaConWs\(RUTA_SEGUIR_EN_PC\)\);/);
  const onb = sinComentarios(leer('app/onboarding/page.tsx'));
  assert.match(onb, /if \(\(await esTelefono\(\)\.catch\(\(\) => false\)\) && \(await seguirEnPcPendiente\(\)\)\) \{/);
  assert.doesNotMatch(onb, /prefiereMovil/, 'la cookie «Versión completa» no lo deja entrar antes');
  assert.match(sinComentarios(leer('app/second-brain/page.tsx')), /if \(\(await esTelefono\(\)\.catch\(\(\) => false\)\) && \(await seguirEnPcPendiente\(\)\)\) redirect\(await rutaConWs\(RUTA_SEGUIR_EN_PC\)\);/);
});

test('6b. OA-10, segunda verificación (20/11, tarde): «Sigamos en tu computadora» sólo a quien EMPEZÓ el V2', async () => {
  // Decidido por el Cerebro (en la memoria): hasta ver el recorrido en la PC, y sólo a quien empezó por el onboarding V2. Con el
  // interruptor para todos, un cliente de MaKo Mobile que nunca pasó por el V2 no tiene la marca y no queda trabado en /onboarding.
  const { empezoElV2, CLAVE_EMPEZO_V2, perfilConVisto } = await import('../lib/recorridos');
  assert.equal(empezoElV2({ recorridos: { 'tutorial-ops-center': '2026-11-20' } }), false, 'un cliente de siempre, sin la marca');
  assert.equal(empezoElV2(null), false);
  assert.equal(empezoElV2({ [CLAVE_EMPEZO_V2]: true }), false, 'sólo la fecha');
  assert.equal(empezoElV2({ [CLAVE_EMPEZO_V2]: '2026-11-20T15:00:00.000Z' }), true);
  assert.equal(empezoElV2(perfilConVisto({ [CLAVE_EMPEZO_V2]: '2026-11-20T15:00:00.000Z' }, 'tutorial-ops-center', 'x')), true, 'marcar lo visto no la borra');
  const sep = sinComentarios(leer('lib/seguir-en-pc.ts'));
  const f = sep.slice(sep.indexOf('export async function seguirEnPcPendiente'), sep.indexOf('export async function anotarQueEmpezoElV2'));
  // El perfil, leído una vez por pedido (`perfilDe`, 20/11: el layout también pregunta por el reinicio del onboarding); sin poder leerlo, no.
  assert.match(f, /const perfil = await perfilDe\(email\);\n\s*if \(perfil === undefined\) return false;\n\s*if \(!empezoElV2\(perfil\)\) return false;\n\s*return !Object\.prototype\.hasOwnProperty\.call\(vistosDePerfil\(perfil\), ID_RECORRIDO_PC\);/);
  // La marca: la primera respuesta del V2, de la persona de la sesión (nunca mirando a un cliente), conservando el resto del jsonb.
  const a = sep.slice(sep.indexOf('export async function anotarQueEmpezoElV2'));
  // En la fila de la persona del onboarding: mirando un negocio como administrador, su dueño (Martín, 20/11: lo mismo que el cliente).
  assert.match(a, /const p = await personaDelOnboarding\(\);\n\s*if \(!p \|\| \(p\.mirando && !escribeComoElCliente\(p\.ws\)\)\) return;\n\s*const \{ email \} = p;/,
    'y mirando, sólo en los negocios de prueba (la D7, 20/11)');
  assert.match(a, /if \(empezoElV2\(fila\.perfil\)\) return;/, 'sólo la primera vez');
  assert.match(a, /update\(\{ perfil: \{ \.\.\.base, \[CLAVE_EMPEZO_V2\]: ahora \}, updated_at: ahora \}\)/);
  assert.match(a, /q = fila\.updated_at == null \? q\.is\('updated_at', null\) : q\.eq\('updated_at', fila\.updated_at\);/, 'compare-and-set, como /api/recorridos');
  const ruta = sinComentarios(leer('app/api/onboarding/arranque/route.ts'));
  assert.match(ruta, /if \(h\.v2\) await anotarQueEmpezoElV2\(\);\n\s*const codigoEscrito = /, 'con cada respuesta del V2, antes del código');
});

test('7. OD-03: la barra sigue oculta con el «dale play», al recargar y al volver al Ops Center, hasta «Tu panel»', () => {
  const m = sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx'));
  assert.match(m, /const invita = senal\.tipo === 'marca' && !!senal\.invita;\n\s*const fin = useCallback\(\(como: 'fin' \| 'omitido' \| 'hecho'\) => \{ if \(!invita\) mostrarLaBarra\(\); terminar\(senal\.id, como\); \}, \[senal\.id, invita\]\);/);
  assert.match(m, /const t = window\.setTimeout\(\(\) => \{ if \(!elChatPresentaElRecorrido\(\)\) mostrarLaBarra\(\); \}, ESPERA_BARRA_MS\);/);
  assert.match(sinComentarios(leer('app/second-brain/LlegadaAlReto.tsx')), /useLayoutEffect\(\(\) => \{ if \(toca && !senalAhora\(\)\) esconderLaBarra\(\); \}, \[toca\]\);/);
  // Al recargar (la segunda verificación de OD-03, 20/11, tarde): en el <html> del layout raíz, del server, y no un <script> de la
  // página, que llega después de loading.tsx con el riel ya pintado. Del módulo chico (tests/seguir-en-pc-liviano.test.ts).
  const lay = sinComentarios(leer('app/layout.tsx'));
  assert.match(lay, /import \{ reinicioDelOnboarding, seguirEnPcPendiente \} from '@\/lib\/seguir-en-pc';/);
  // (Entre las dos, el reinicio del onboarding: tests/reiniciar-onboarding.test.ts.)
  assert.match(lay, /const barraOculta = veV2 && \(await seguirEnPcPendiente\(\)\);\n\s*const reinicio = veV2 && !vista \? await reinicioDelOnboarding\(\) : null;\n\s*return \(\n\s*<html [^>]*\{\.\.\.\(barraOculta \? \{ \[ATTR_BARRA_OCULTA\]: '' \} : \{\}\)\}>/);
  const page = sinComentarios(leer('app/second-brain/page.tsx'));
  assert.doesNotMatch(page, /ATTR_BARRA_OCULTA|<script/, 'una sola fuente: el layout');
});

test('8. OD-08: con el V2, nada arriba del Ops Center: el grupo de WhatsApp (y su esqueleto) va después de los coaches', () => {
  const c = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(c, /\{!retoV2 && <FilasDelGrupo g=\{grupos\} abierto=\{!verMapa && !ticketera \? grupo : null\} onElegir=\{abrirGrupo\} \/>\}\n\s*\{k\.errorLista/);
  assert.match(c, /\{retoV2 && coaches\}\n\s*\{retoV2 && <FilasDelGrupo g=\{grupos\} abierto=\{!verMapa && !ticketera \? grupo : null\} onElegir=\{abrirGrupo\} \/>\}/);
});

test('9. OD-09: el chat del reto carga con MaKo escribiendo, sin «Cargando tu reto…» ni «Empezando tu reto…»', () => {
  const r = sinComentarios(leer('app/second-brain/reto/ChatDelReto.tsx'));
  assert.doesNotMatch(r, /Cargando tu reto|Empezando tu reto/);
  // Sólo la primera vez, con nada visto todavía (auditoría de chats, reto-11; decidido por el Cerebro el 20/11).
  assert.match(r, /: !d \|\| !e \? \(primeraVez \? <Burbuja><span className="co-escribiendo" role="status" aria-label="MaKo está escribiendo" data-reto-carga="">/);
});

test('10. OD-10: sin video, el paso que sigue a un clic no vuelve a tocar su `antes` (el Second Brain alterna) y espera la carga', () => {
  const m = sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx'));
  assert.match(m, /const recienTocado = trasSuClic\.current === paso && typeof paso\.antes === 'string';\n\s*if \(paso\.antes && !modoVideo && !lugarDe\(paso\.sel\) && !recienTocado\) tocarAntes/);
  assert.match(m, /if \(!modoVideo\) trasSuClic\.current = pasos\[i \+ 1\] \?\? null;/);
  assert.match(m, /if \(senal\.tipo === 'tutorial' && espera > ESPERA_PASO_MS && !\(cargandoAhora\(\) && espera < TOPE_CARGA_MS\)\)/);
});

test('11. OD-F2: el velo de la llegada al Ops Center entra con el barrido, no con un fundido', () => {
  const b = sinComentarios(leer('app/second-brain/LlegadaAlReto.tsx'));
  assert.match(b, /if \(!hayHueco \|\| !nodo \|\| menosMovimiento\(\)\) return;\n\s*return barrer\(nodo\);/);
  // El hueco con la forma de la píldora de MaKo escribiendo, no de la fila (la fila se estira al ancho del chat: una franja clara).
  assert.match(b, /\{hc && <div ref=\{hueco\} className="sbl-velo" style=\{\{ left: hc\.x, top: hc\.y, width: hc\.w, height: hc\.h \}\} \/>\}/);
  assert.match(b, /<div ref=\{pildora\} className="co-el">/);
  assert.doesNotMatch(b, /@keyframes sbl-velo/, 'sin el fundido de opacidad');
});

test('12. motor-2/b y motor-3/c: un clic durante la voz no la corta; se retiene en el t_fin de la frase tocada (tope 8 s)', async () => {
  const { retenerAlFin, TOPE_RETENCION_MS } = await import('../app/_ui/tutorial/pausas');
  assert.equal(retenerAlFin(16, 18.68), true, 'recorrido-4: tocado a los 16 s, sigue hasta 18,68');
  assert.equal(retenerAlFin(18.65, 18.68), false, 'ya en el silencio');
  assert.equal(TOPE_RETENCION_MS, 8000, 'la auditoría pidió ~8 s (recorrido-5)');
  const m = sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx'));
  assert.match(m, /if \(f && retenerAlFin\(v\.currentTime, f\.t_fin\)\) \{/);
  assert.match(m, /if \(!retenerAlFin\(v\.currentTime, tFin\)\) \{ quieto\(\); return; \}/);
  assert.doesNotMatch(m, /\{ v\.pause\(\); retener\(\{ desde: Date\.now\(\), url: url \?\? urlAhora\(\), navega, destino \}\); return; \}/, 'la pausa en el acto');
});

test('13. las marcas: calendar-5, classroom-5, classroom-clients-5, offer-5, video-3/4/5 y settings-integraciones-4/5', async () => {
  const { tutorialDe } = await import('../lib/tutoriales');
  const { MARCA } = await import('../lib/tutoriales/marcas');
  const cal = tutorialDe('calendar')!;
  assert.equal(cal.pasos.at(-1)!.antes, 'a[href^="/calendario?vista=semana"]', 'desde Llamadas, vuelve a la semana');
  const cls = tutorialDe('classroom')!;
  assert.equal(cls.pasos.at(-1)!.antes, 'a[href^="/classroom?producto="]', 'desde la vista del alumno, «Volver a editar»');
  const cc = tutorialDe('classroom-clients')!;
  assert.equal(cc.pasos[0]!.antes, 'button[aria-label^="Opciones de la etapa"]');
  assert.match(sinComentarios(leer('app/customer-success/KanbanEntrega.tsx')), /options=\{\[\{ value: 'nuevo', label: 'Nuevo cliente', icono: 'persona-mas' as const, marca: MARCA\.classroomClientsCargar \}\]\}/);
  assert.equal(MARCA.classroomClientsCargar, 'tour-classroom-clients-cargar');
  const crear = sinComentarios(leer('app/_crear/PantallaCrear.tsx'));
  assert.match(crear, /const enLista = cara === 'lista' \|\| listaEnPortada;/);
  assert.match(crear, /setListaEnPortada\(false\);\n\s*alChat\(\);/, 'Escape vuelve al chat (offer-5)');
  const ve = sinComentarios(leer('app/video-editor/VideoEditorCliente.tsx'));
  assert.match(ve, /const tutorialVisto = ensayo\.activo \? vistoEnEnsayo\(ID_TUTORIAL_VIDEO\) : tutoVideo\.visto === true;/);
  assert.match(ve, /if \(alEntrar !== 'editor' \|\| !tutorialVisto \|\| editor/);
  const integ = tutorialDe('settings-integraciones')!;
  assert.equal(integ.pasos[0]!.clicSoloComputadora, true);
  assert.match(sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx')), /return fs\.map\(\(f\) => \(f\.espera_clic && f\.sel && sinClic\.some\(\(p\) => mismoLugar\(f\.sel!, p\.sel\)\) \? \{ \.\.\.f, espera_clic: false \} : f\)\);/);
});

test('14. V5: la entrada de un día y su «dale play» se guardan en el navegador (no vuelven en cada recarga)', async () => {
  const guardado = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => { guardado.set(k, v); } };
  try {
    const { yaEntro, anotarEntrada, dalePlayCerrado, cerrarDalePlay } = await import('../app/_ui/tutorial/entrada');
    guardado.set('mk-entrada:reto-dia-7', '1');
    assert.equal(yaEntro('reto-dia-7'), true, 'de una visita anterior');
    assert.equal(yaEntro('reto-dia-3'), false);
    anotarEntrada('reto-dia-3');
    assert.equal(guardado.get('mk-entrada:reto-dia-3'), '1');
    cerrarDalePlay('reto-dia-7');
    assert.equal(guardado.get('mk-dale-play:reto-dia-7'), '1');
    guardado.set('mk-dale-play:offer-coach', '1');
    assert.equal(dalePlayCerrado('offer-coach'), true);
  } finally { delete (globalThis as { localStorage?: unknown }).localStorage; }
  assert.match(sinComentarios(leer('app/_ui/tutorial/VideoDelMomento.tsx')), /onPlay=\{\(e\) => \{ delete e\.currentTarget\.dataset\[BANDERA_FLOTA\]; setEstado\('reproduciendo'\); if \(dalePlay\) cerrarDalePlay\(clave\); onEmpieza\?\.\(\); \}\}/);
  // Desde el 20/11, tarde (V4), el play del día corre por verVideoDelDia: lo anota visto y cierra el «dale play» antes del motor.
  // (Con la clave de ESTE reto, `delReto`, para el video con marcas: 20/11, ~13:00.)
  assert.match(sinComentarios(leer('app/second-brain/reto/ChatDelReto.tsx')), /anotarVisto\(`video:\$\{dia\.n\}`\);\n\s*cerrarDalePlay\(conMarcas \? delReto\(dia\.video\) : dia\.video\);\n\s*if \(conMarcas\) \{\n[^\n]*\n\s*mostrarTutorial\(tutorialDelDia\(dia\)/);
  // (Y el `visto` del chat del reto, d712c72df: el «dale play» del día sólo si ese video no se vio en este navegador.)
  assert.match(sinComentarios(leer('app/second-brain/reto/ChatDelReto.tsx')), /activo: dalePlay && conMarcas && !visto && !corre \}\);/);
  assert.match(sinComentarios(leer('app/_ui/tutorial/useDalePlay.ts')), /cerrado: cerrado \|\| dalePlayCerrado\(clave\)/);
  // El del WhatsApp sigue SIN «dale play» (la verificación lo anotó como detalle; la decisión está en tests/tutorial-entrada.test.ts, 4:
  // llega junto a la tarjeta del código, y las tapas de la marca no dejarían escribirlo).
  // El del WhatsApp, con su «dale play» desde el 20/11 (tarde): la tarjeta del código ya no sale junto al video, así que sus tapas no tapan nada.
  assert.match(sinComentarios(leer('app/onboarding/ChatArranqueV2.tsx')), /<VideoDelMomento clave=\{VIDEO_WHATSAPP\} titulo="Tu WhatsApp con MaKo" revision=\{false\} dalePlay \/>/);
});

test('15. V9: en «Onboarding», el recorrido de la lista de videos se ve con sus marcas', () => {
  assert.match(sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx')), /\{ clave: 'recorrido', titulo: 'Tu recorrido por MaKo', tutorial: TUTORIAL_RECORRIDO \}/);
  assert.match(sinComentarios(leer('app/_ui/tutorial/VideosDelChat.tsx')), /if \(v\.tutorial\) mostrarTutorial\(v\.tutorial, \{ directo: true \}\); else if \(!verEnSuMensaje\(v\.clave\)\) reproducirFlotante/);
});

test('16. V10 y F1: «Todavía no está grabado» sólo en las cuentas de Martín, y nunca mientras carga el manifiesto', async () => {
  const { esRevision, EMAILS_REVISION } = await import('../lib/onboarding-v2/revision');
  // Sin escribir un mail real (tests/sin-mails-reales.test.ts): los de la revisión, por su constante.
  const [martin, otra] = EMAILS_REVISION;
  assert.equal(esRevision(true, martin), true);
  assert.equal(esRevision(true, ` ${otra!.toUpperCase()} `), true, 'sin importar mayúsculas ni espacios');
  assert.equal(esRevision(true, 'cliente.de.prueba@gmail.com'), false, 'el Cliente de Prueba (ws 3) lo ve como un cliente');
  assert.equal(esRevision(false, martin), false);
  assert.match(sinComentarios(leer('app/layout.tsx')), /<MotorTutorial revision=\{esRevision\(veV2, sesion\.email\)\} \/>/);
  assert.match(sinComentarios(leer('app/second-brain/VideoDelCoach.tsx')), /const revision = useEsRevision\(\) && dosCoaches;/);
  assert.match(sinComentarios(leer('app/second-brain/reto/ChatDelReto.tsx')), /if \(PARA_TODOS \|\| !revision \|\| !listo\) return null;/);
  const h = sinComentarios(leer('app/_ui/tutorial/useVideoTutorial.ts'));
  assert.match(h, /const m = useSyncExternalStore\(suscribir, leidoAhora, nadaEnElServidor\);/, 'leído, el video sale en el mismo dibujo');
  assert.doesNotMatch(h, /useState/);
});

test('17. F2: el video de la esquina es el reproductor de la maqueta, con «Agrandar/Achicar» y la X', () => {
  const p = sinComentarios(leer('app/_ui/tutorial/VideoEnLaEsquina.tsx'));
  assert.match(p, /export const pipChico = \(manual: 'chico' \| 'grande' \| null, corre: boolean\): boolean => \(manual \? manual === 'chico' : !corre\);/);
  assert.match(p, /aria-label=\{chico \? 'Agrandar el video' : 'Achicar el video'\}/);
  assert.match(p, /aria-label="Cerrar el video"/);
  assert.match(p, /onTimeUpdate=\{\(e\) => \{ setT\(e\.currentTarget\.currentTime\); anotarTiempoFlotante\(e\.currentTarget\.currentTime\); \}\}/);
  assert.doesNotMatch(p, /<video[^>]* controls/, 'no el del navegador');
  assert.match(sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx')), /function VideoFlotante\(\{ senal \}: \{ senal: Extract<Senal, \{ tipo: 'video' \}> \}\) \{\n\s*return <VideoEnLaEsquina senal=\{senal\} \/>;/);
});

test('18. F4: en la llegada al Ops Center, el video va arriba y el texto debajo', () => {
  const b = sinComentarios(leer('app/second-brain/LlegadaAlReto.tsx'));
  const video = b.indexOf('data-recorrido="sb-llegada-play"');
  const texto = b.indexOf('<div className="ch-md"><p>{textoLlegada(nombre)}</p></div>');
  assert.ok(video > 0 && texto > 0 && video < texto);
});

test('19. V1 y V9: en el catálogo «Tutoriales de MaKo», «Tu WhatsApp con MaKo» es el video del V2, no el de la pantalla vieja', async () => {
  const { VIDEOS_PARA_EMPEZAR } = await import('../lib/reto/dias');
  assert.deepEqual(VIDEOS_PARA_EMPEZAR.map(([k]) => k), ['onboarding-bienvenida', 'onboarding-bienvenida-whatsapp', 'recorrido']);
});

test('20. wa-04: la tarjeta del código dice el aviso cuando su mensaje llegó y MaKo no pudo contestar (debajo de «Abrir WhatsApp»)', async () => {
  const { avisoDelPedidoV2, AVISO_SIN_LINEA_V2 } = await import('../lib/verificacion-entrante');
  const v = { telefono: '5491155550101', codigo: '482913', expira: Date.now() + 60_000, verificado: false, v2: true, entrante: true } as const;
  assert.equal(avisoDelPedidoV2({ ...v, sinLineaAt: Date.now() }), AVISO_SIN_LINEA_V2, 'el servidor es del chat de WhatsApp');
  assert.equal(avisoDelPedidoV2({ ...v, sinLineaAt: Date.now(), respondido: true }), null, 'se va cuando MaKo le contesta');
  const t = sinComentarios(leer('app/onboarding/ChatArranqueV2.tsx'));
  assert.match(t, /\{w\?\.aviso && <p className="arr-v2__aviso-wa" role="status" data-aviso-wa="">\{w\.aviso\}<\/p>\}/);
  assert.ok(t.indexOf('Abrir WhatsApp</a>}') < t.indexOf('data-aviso-wa') && t.indexOf('data-aviso-wa') < t.indexOf('<div className="arr-v2__cod-fila">'), 'entre «Abrir WhatsApp» y el campo');
});

test('21. OD-05, segunda verificación (20/11, tarde): al volver de Second Brain, la llegada no redibuja el velo en medio del recorrido', () => {
  const b = sinComentarios(leer('app/second-brain/LlegadaAlReto.tsx'));
  assert.match(b, /^let llegadaEscrita = false;$/m, 'en el módulo: sobrevive al desmontaje del chat');
  assert.match(b, /const \[fase, setFase\] = useState<'espera' \| 'escribe' \| 'listo'>\(\(\) => \(llegadaEscrita \|\| senalAhora\(\) \? 'listo' : 'espera'\)\);/);
  // Y por persona, también al recargar (ops-center-3: tests/onboarding-llegada-al-reto.test.ts).
  assert.match(b, /const anotarMostrada = \(quien: string \| null\): void => \{\n\s*llegadaEscrita = true;/);
  // El velo y los puntitos salen sólo con `fase === 'escribe'`.
  assert.match(b, /\{fase === 'escribe' && typeof document !== 'undefined' && createPortal\(/);
});

test('22. OD-13, segunda verificación (20/11, tarde): «Entrar a MaKo» cierra también el video que ya flotaba en la esquina', async () => {
  const c = sinComentarios(leer('app/onboarding/ChatArranqueV2.tsx'));
  const e = c.slice(c.indexOf('const entrar = useCallback('), c.indexOf('router.push(RUTA_AL_RETO);'));
  assert.match(e, /v\.pause\(\);\n\s*const flotando = senalAhora\(\);\n\s*if \(flotando\?\.tipo === 'video'\) soltarSenal\(flotando\.id\);/);
  // La señal del video de la esquina se suelta (y un tutorial no se toca: sólo la del video).
  const { reproducirFlotante, senalAhora, soltarSenal } = await import('../app/_ui/tutorial/store');
  reproducirFlotante('onboarding-bienvenida', 'x', 3);
  const s = senalAhora();
  assert.equal(s?.tipo, 'video');
  soltarSenal(s!.id);
  assert.equal(senalAhora(), null);
});

test('23. motor-7 y offer-5, segunda verificación (20/11, tarde): lo que abrió `cierra_despues` se cierra al empezar la frase siguiente, tenga o no marca', async () => {
  const { cierraYa } = await import('../lib/tutoriales/videos');
  const fr = (id: string, t_inicio: number, t_fin: number, sel: string | null) => ({ id, t_inicio, t_fin, sel, espera_clic: !!sel, cierra_despues: id === 'offer-4' });
  // offer-5 SIN marca: la lista que abrió offer-4 se cierra al empezar su voz, no al final del video.
  const frases = [fr('offer-4', 15, 21, 'button.lista'), fr('offer-5', 21.84, 27.98, null)] as never;
  assert.equal(cierraYa(frases, 'offer-4', 21), false, 'durante el silencio de offer-4, todavía no');
  assert.equal(cierraYa(frases, 'offer-4', 21.9), true, 'apenas empieza offer-5');
  assert.equal(cierraYa(frases, 'offer-5', 30), false, 'sin frase que le siga: lo cierra el final del video');
  const m = sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx'));
  const av = m.slice(m.indexOf('const alAvanzar = () => {'), m.indexOf('const alTerminar = () =>'));
  // Antes de buscar la próxima frase CON marca (fraseParaMarcar salta las que no tienen).
  // Y la frase siguiente se marca con el panel ya cerrado (MS_CIERRE, lo mismo que espera el cierre del video).
  assert.match(av, /if \(porCerrar\.current && cierraYa\(frases, porCerrar\.current, t\)\) \{ porCerrar\.current = null; cerrarLoAbierto\(\); cerrandoHasta\.current = Date\.now\(\) \+ MS_CIERRE; return; \}\n\s*if \(Date\.now\(\) < cerrandoHasta\.current\) return;\n/);
  // Entre la guarda del cierre y la frase que se marca, sólo el salto de «toca aquí» sin su marca (20/11, la llamada con Leila:
  // tests/tutorial-toca-aqui.test.ts), que tampoco corre mientras se cierra.
  const guarda = av.indexOf('if (Date.now() < cerrandoHasta.current) return;');
  assert.ok(guarda > 0 && guarda < av.indexOf('const q = fraseQueSuena(frases, t, hechas.current);') && av.indexOf('const q = fraseQueSuena(frases, t, hechas.current);') < av.indexOf('const f = fraseParaMarcar(frases, t, hechas.current);'));
  assert.match(m, /if \(f\.cierra_despues\) porCerrar\.current = f\.id;/);
});

// =============================================================================
// La voz de MaKo muerta seis días diciendo «open»
// =============================================================================
// 08/09/2026. Martín: «MaKo en WhatsApp NO está funcionando». Medido:
//
//   · mako_doer_conv, últimas 48 h ............ 0 mensajes
//   · último entrante de cualquier cliente .... 2026-09-02
//   · connectionState mako_superadmin ........ "state": "open"
//   · operación REAL sobre ese socket ........ HTTP 428, Connection Closed
//
// Seis días sin entrar NI SALIR un mensaje. Los avisos que los crons generaron
// esos días se escribieron, se pagó la IA que los redactó, y ninguno llegó.
//
// 11/09/2026. La voz se volvió a caer y el aviso de este archivo no le llegó a nadie:
// iba a una lista de destinatarios vacía. Martín pidió una alerta gigante en admin y
// mails a su dirección; una revisión adversarial le encontró después tres huecos más
// (una lectura fallida que alarmaba sobre la línea de un cliente, un Evolution caído
// que no avisaba nunca, un reinicio que mandaba «re-escaneá» y «volvió» seguidos).
//
// PROBADO ROMPIÉNDOLO contra la versión desplegada antes de la revisión (2ae26f80):
// fallan 5 de 9, justo los cinco nuevos; pasan los cuatro que esa versión ya cumplía.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
const sinComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('La vigilancia pregunta HABLANDO, no leyendo connectionState', () => {
  // El campo mintió: mako_superadmin daba `open` con toda operación real en 428.
  // «open» no prueba que ande.
  const src = leer('../lib/canal-vigilante.ts');
  // ⚠️ LA SONDA SE MUDÓ: el 08/09 a `sondearSocket` (TRES respuestas: vivo / muerto /
  // sin_respuesta, porque `vozViva` hacía `.catch(() => false)` y un corte de red se leía
  // como sesión caída), y el 11/09 a `sondearSocketDetalle`, que además trae el status y el
  // mensaje de Evolution. Sin el `\)` de cierre: la alerta de admin le pasa un tope.
  // Lo que este test protege sigue igual: que se pregunte HABLANDO.
  assert.match(src, /(?:socketVivo|sondearSocket|sondearSocketDetalle)\(instancia/,
    'la vigilancia dejó de hacer una operación real: vuelve a creerle al campo que mintió');
  // Y que «no pude preguntar» no dispare la alarma de caída.
  assert.match(src, /sin_respuesta/,
    'la vigilancia volvió a tratar «no pude preguntar» como «está caída»');

  // ⚠️ REMEDIDO EL 08/09/2026, unas horas después de la medición de acá arriba:
  //   mako_ws1         connectionState=close → operación real 500 «Connection Closed»
  //   mako_ws11        connectionState=open  → operación real 200 (grupos reales)
  //   mako_superadmin  connectionState=open  → operación real 500 «Connection Closed»
  // La conclusión no cambia y se refuerza — `open` sigue sin probar nada.
  // Sobre el CÓDIGO: la prosa nombra `connectionState` justamente para explicar por qué
  // NO se usa, así que se sacan los DOS tipos de comentario antes de buscar.
  const codigo = sinComentarios(src);
  assert.ok(!/connectionState/.test(codigo),
    'volvió a leer connectionState como prueba de vida');
});

test('⚠️ El aviso NO viaja por el canal que se rompió', () => {
  // Es lo que hace que este aviso exista. Mandar «tu WhatsApp está caído» por
  // WhatsApp es no mandar nada.
  const codigo = sinComentarios(leer('../lib/canal-vigilante.ts'));
  assert.match(codigo, /sendEmail\(/, 'el aviso dejó de salir por email');
  assert.ok(!/enviarAlGrupo|emitirAviso|enviarAGrupoJid/.test(codigo),
    'el aviso de "WhatsApp caído" volvió a mandarse por WhatsApp');
});

test('Sabe decir «ya está», no solo «se rompió»', () => {
  // Una alarma que no sabe cerrar obliga a adivinar si se arregló o si se rompió
  // el aviso. Mismo criterio que la alerta crítica de Meta.
  const src = leer('../lib/canal-vigilante.ts');
  assert.match(src, /aviso: 'recuperada'/, 'no avisa cuando la voz vuelve');
  assert.match(src, /setSetting\(KEY_ULTIMO_AVISO, ''\)/, 'no limpia la marca al recuperarse');
});

test('Alguien la MIRA: va en un cron, no solo en un panel', () => {
  // La detección ya existía (socketVivo + estadoCanalMaKo, con el comentario del
  // 16/08 explicando exactamente esto) y tenía UN consumidor: la ruta del panel
  // /agencia. Un estado correcto que solo se calcula cuando alguien abre una
  // pantalla no es un control, es un dato disponible.
  const cron = leer('../app/api/cron/alerta-critica/route.ts');
  assert.match(cron, /vigilarVozMaKo\(\)/, 'la vigilancia volvió a no tener quién la corra');
  // Y nunca puede tumbar el cron: si falla la vigilancia, el resto corre igual.
  assert.match(cron, /vigilarVozMaKo\(\)\.catch\(/, 'la vigilancia dejó de ser best-effort');
  // Va ANTES del try del resto: es lo primero que hay que saber.
  const iVoz = cron.indexOf('vigilarVozMaKo');
  const iTry = cron.indexOf('const cuentasYaAvisadas');
  assert.ok(iVoz > 0 && iVoz < iTry, 'la vigilancia de la voz quedó después del resto del cron');
});

test('⚠️ El aviso le LLEGA a alguien, con remitente de plataforma, y se lee si salió', () => {
  // 11/09/2026: iba a los destinatarios del ws SuperAdmin (9), que eran
  // `{"telefonos":[],"emails":[]}`. La voz estuvo días caída sin un solo mail.
  const codigo = sinComentarios(leer('../lib/canal-vigilante.ts'));
  assert.match(codigo, /EMAILS_ALERTA_VOZ = \['martinkoncke@gmail\.com'\]/,
    'se perdió la dirección que pidió Martín');
  // Se USA la lista, no solo se declara: con `para = dest?.emails ?? []` el literal seguía
  // ahí, el mail no le llegaba a nadie y el test pasaba (revisión del 11/09/2026).
  const avisar = codigo.slice(codigo.indexOf('async function avisarPorEmail'));
  assert.match(avisar, /\[\.\.\.EMAILS_ALERTA_VOZ\b/,
    'el aviso volvió a depender de que el ws SuperAdmin tenga mails cargados');
  // `sendEmail` sin `from` usa el remitente del workspace actual, y acá no hay cliente.
  assert.match(avisar, /from: REMITENTE_MAKO/, 'el aviso volvió a salir con el remitente de un workspace');
  // La marca de «ya avisé» va DESPUÉS del envío, y solo si salió: antes se ponía antes de
  // mandar, y un mail que no salía callaba el reintento.
  const iAsunto = codigo.indexOf("'🚨 MaKo no puede hablar por WhatsApp'");
  const iMarca = codigo.indexOf('setSetting(KEY_ULTIMO_AVISO, ahora)');
  assert.ok(iAsunto > 0 && iMarca > iAsunto, 'la marca de «ya avisé» volvió a ponerse antes de mandar');
  assert.match(codigo, /if \(envio\.enviadoA\) await runWithWorkspace\(ws, \(\) => setSetting\(KEY_ULTIMO_AVISO, ahora\)\)/,
    'la marca de «ya avisé» volvió a ponerse sin saber si el mail salió');
});

test('La primera medición «muerta» no manda mail: un reinicio de Evolution no es una caída', () => {
  // Evolution reiniciando deja las instancias unos segundos sin socket. Con un solo «muerto»
  // salían «re-escaneá el QR» y a los diez minutos «volvió».
  const codigo = sinComentarios(leer('../lib/canal-vigilante.ts'));
  const iPrimera = codigo.indexOf('setSetting(KEY_CAIDA_DESDE, ahora)');
  const iAsunto = codigo.indexOf("'🚨 MaKo no puede hablar por WhatsApp'");
  assert.ok(iPrimera > 0 && iPrimera < iAsunto, 'la caída se avisa sin haberla medido dos veces');
  assert.match(codigo.slice(iPrimera, iAsunto), /return \{ viva: false, aviso: 'ninguno' \}/,
    'la primera medición de la caída sigue de largo hasta el mail');
});

test('Si Evolution no contesta media hora, también avisa, sin mandar a re-escanear', () => {
  // Con el servidor caído o la key rotada la voz está igual de muda, y esto salía cada
  // 10 minutos para siempre sin avisar nada (revisión del 11/09/2026).
  const src = leer('../lib/canal-vigilante.ts');
  const codigo = sinComentarios(src);
  assert.match(codigo, /SIN_RESPUESTA_MIN \* 60_000/, 'el «no puedo comprobar» volvió a no avisar nunca');
  assert.match(codigo, /aviso: 'sin_confirmar'/, 'se perdió el aviso de «no puedo comprobar»');
  // Y no afirma una caída: re-escanear una línea sana la tumba.
  assert.match(src, /NO hace falta re-escanear el QR/, 'el aviso de «no puedo comprobar» manda a re-escanear');
});

test('Un error leyendo la base no se convierte en «la voz es mako_ws1»', () => {
  // `getSetting` devuelve null ante un error, e `instanciaVoz()` lo completaba con mako_ws1,
  // la línea de un cliente, hoy cerrada: barra roja y mail falsos por un 5xx de Supabase.
  const codigo = sinComentarios(leer('../lib/canal-vigilante.ts'));
  assert.match(codigo, /instanciaVoz\(\{ estricto: true \}\)/, 'la vigilancia volvió a leer la voz con el default');
  assert.match(codigo, /getSettingEstricto\(KEY_ULTIMO_AVISO\)/,
    'las marcas volvieron a leerse tolerantes: una lectura fallida manda el mail dos veces');
});

test('La caída se ve arriba de TODAS las pantallas de admin, y roja solo si está medida', () => {
  // Martín, 11/09: «sería bueno que haya una alerta gigante en admin cuando eso pase».
  const layout = leer('../app/layout.tsx');
  assert.match(layout, /esAdmin && <AlertaVozMaKo \/>/, 'la alerta dejó de montarse para admin en el layout');
  const codigo = sinComentarios(leer('../lib/canal-vigilante.ts'));
  // Roja solo con 'muerto': «no pude comprobarlo» enciende a lo sumo la ámbar, y recién a la media hora.
  assert.match(codigo, /if \(sondeo === 'muerto'\) \{[\s\S]{0,300}?caida: true/, 'la alerta roja dejó de depender de la caída medida');
  assert.equal((codigo.match(/caida: true/g) ?? []).length, 1, 'apareció otro camino que enciende la alerta roja');
  // Y no cuesta una consulta a WhatsApp por pestaña (revisión del 11/09/2026).
  assert.match(codigo, /MEMO_MS/, 'la alerta volvió a sondear WhatsApp en cada pedido');
  const alerta = leer('../app/_components/AlertaVozMaKo.tsx');
  assert.match(alerta, /visibilityState === 'hidden'/, 'las pestañas en segundo plano volvieron a sondear');
});

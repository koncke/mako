// =============================================================================
// «Ya estoy de vuelta»: un cartel de fallo guardado como turno se vuelve biografía
// =============================================================================
// EL CASO (30/09/2026). Después de que MaKo le dijera «⚠️ Probé tus 4 cuentas de IA y
// las 4 me rebotaron por límite», el dueño volvió a escribir y MaKo arrancó con **«Ya
// estoy de vuelta»**. Lo reportó así: «revisa que es aún más raro».
//
// Nadie escribió esa frase y el modelo no estaba inventando: estaba siendo COHERENTE.
// El cartel se había guardado en `mako_doer_conv` como un turno `assistant`, o sea
// como algo que MaKo dijo, así que en el turno siguiente leyó en su propio historial
// que se había caído — y la continuación natural de una ausencia propia es anunciar
// que volvió. Le enseñamos una caída que nunca tuvo y después se la hicimos narrar.
//
// Un cartel de «no pude» es un aviso de la PLATAFORMA sobre su propia capacidad: se
// manda (la persona tiene que leerlo) y no entra al historial. El incidente queda
// donde se audita. Es la regla de la casa: diagnóstico y conversación son dos trabajos
// y no comparten campo.
//
// VERIFICADO ROMPIÉNDOLO (ver cada caso): quitando el `if (avisoDeSistema)` del
// guardado → 1 fallo; quitando UNA de las tres marcas → 1 fallo.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../lib/mako-doer-in.ts', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');
/** Sin comentarios: este archivo explica el bug en prosa y el guard se acusaría solo. */
const sinComentarios = (src: string): string =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const LINEAS = sinComentarios(SRC).split('\n');

test('⚠️ EL CARTEL DE FALLO NO SE GUARDA COMO TURNO DE MaKo', () => {
  // Verificado rompiéndolo: con `await guardarTurno(...)` incondicional, 1 fallo.
  const i = LINEAS.findIndex((l) => l.includes("guardarTurno(wsData, jid, 'assistant'"));
  assert.ok(i > 0, 'se fue el guardado del turno de MaKo');
  const alrededor = LINEAS.slice(Math.max(0, i - 3), i + 1).join('\n');
  assert.match(alrededor, /avisoDeSistema/,
    `el turno de MaKo se guarda sin mirar si es un cartel de plataforma:\n${alrededor}`);
  // Y el `user` se sigue guardando SIEMPRE: lo que la persona escribió es conversación
  // pase lo que pase, y sin eso el próximo turno arranca de cero.
  assert.match(sinComentarios(SRC), /guardarTurno\(wsData, jid, 'user', texto, msgId\)/,
    'se dejó de guardar lo que escribió la persona');
});

test('⚠️ LAS TRES SALIDAS QUE ESCRIBEN UN CARTEL LO MARCAN', () => {
  // Son tres y están lejos entre sí: el `catch` del modelo, la guarda de «ningún
  // proveedor dejó respuesta» y el bloqueo por respuesta inválida. Verificado
  // rompiéndolo: quitando la marca de cualquiera de las tres, 1 fallo.
  //
  // No se buscan las TRES por su texto: así el guard también caza la CUARTA, el día
  // que alguien escriba otro cartel. Se excluyen dos cosas, y las dos por su motivo:
  // el `import` (nombra las funciones y no asigna nada) y el aviso del AUDIO, que
  // cierra con un `return` sin tocar `respuesta` ni guardar turno — tiene su test
  // propio acá abajo.
  const carteles = LINEAS
    .map((l, n) => ({ l, n }))
    .filter(({ l }) => /avisoNoPude\(|AVISO_NO_PUDE|textoFalloIA\(/.test(l))
    .filter(({ l }) => !/^import /.test(l.trim()) && !/const aviso/.test(l));
  assert.ok(carteles.length >= 3, `esperaba las asignaciones de cartel y encontré ${carteles.length}`);
  for (const { l, n } of carteles) {
    // El `catch` arma el texto en tres líneas (ternario), así que la marca puede caer
    // un par de renglones abajo. Cinco alcanza y no se come la asignación siguiente.
    const sigue = LINEAS.slice(n, n + 5).join('\n');
    assert.match(sigue, /avisoDeSistema = true/,
      `este cartel vuelve a entrar al historial como algo que MaKo dijo:\n${l.trim()}`);
  }
});

test('El camino del AUDIO ya lo hacía bien, y sigue', () => {
  // Es el precedente que delató al otro: ante un fallo de transcripción manda el aviso
  // y vuelve con `return` SIN guardar turno. El del texto era el único que lo guardaba.
  const src = sinComentarios(SRC);
  const i = src.indexOf('Me llegó tu audio pero no lo pude escuchar');
  assert.ok(i > 0, 'se fue el aviso de la nota de voz');
  const hasta = src.indexOf('return { engaged: true, reply: aviso };', i);
  assert.ok(hasta > i, 'el aviso del audio dejó de cerrar con un return');
  assert.ok(!/guardarTurno/.test(src.slice(i, hasta)),
    'el aviso del audio empezó a guardarse como un turno de MaKo');
});

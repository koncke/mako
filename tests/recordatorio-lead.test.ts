// =============================================================================
// recordatorio-lead — los recordatorios de la reunión AL LEAD (24 h, 1 h y 15 min, con link)
// =============================================================================
// Ejecuta la parte pura (lib/recordatorio-lead.ts: cuándo vence cada toque, la marca, el link,
// los textos y la configuración) y fija con guards, sobre el fuente SIN comentarios y por bloque,
// lo que vive en archivos server-only y no se ve en una pantalla: que el emisor manda SÓLO con el
// interruptor del negocio y el envío prendidos, que marca después del envío ok, que el setting no
// se hereda del dueño, que el webhook guarda y limpia el link sin tocar `junta_X_at`, y que el
// cron recorre todos los workspaces y tiene su `?dry=1`.
//
// ⚠️ LOS LEADS DE MAURICIO SON MEXICANOS: el detector de voseo corre sobre los textos ARMADOS.
//
// Probado ROMPIÉNDOLO (06/10/2026) con un arnés que rompe, corre y restaura DE MEMORIA (nunca con
// git checkout), verificando que cada archivo volviera idéntico. Sin romper: 26 pass / 0 fail.
// Las 24 roturas cayeron, cada una en el test que la persigue (25 / 1 salvo donde se dice):
//   · `toquesVencidos` sin el `if (t <= p.ahora) continue` (reunión empezada).
//   · `toquesVencidos` sin `!j.fecha` (la cancelación).
//   · la ventana con `<=` en vez de `<`; y aparte, la tolerancia en 14 (fuera de ventana).
//   · `claveToque` con el ISO crudo en vez del canónico (mismo instante, dos claves).
//   · `estadoDeLaMarca` devolviendo 'reintento' para `reclamado:`.
//   · `linkDeReunion` aceptando http.
//   · `textoDelToque` sin el filtro de renglones con link; sin juntar la coma; con la hora en
//     una zona fija (America/Tijuana) en vez de la del negocio.
//   · «Entra aquí» → «Entrá acá» en el texto de fábrica → 24 / 2 (el voseo y el texto exacto).
//   · `configDeRecordatorio` con `Boolean(obj.activo)` (nace apagado).
//   · el emisor sin el `if (!cfg.activo && !opts.dry) return res`; sin `envioWhatsappHabilitado()`;
//     marcando `enviado:` ANTES de `enviarYEspejar`; sin el reclamo con `cambiarSettingSi`.
//   · `leerConfigRecordatorio` sin el `.eq('workspace_id', ws)` (la herencia); y la clave sumada
//     a los settings que lib/clonar-config.ts copia del dueño a otro negocio.
//   · el aviso al dueño con `getSetting(key)` otra vez.
//   · el webhook sin `guardarLinkDeReunion` en la R1; `cancelarJuntaEnLead` poniendo `junta_1_at: null`.
//   · el cron sacando los workspaces del lead de `correrPorWorkspace('calendly'`.
//   · la tarjeta sin montar en ChatAgentApp; la ruta sin el guard de admin.
//   ⚠️ MUDADO EL 08/10/2026 (el recordatorio pasó a ser un ítem de la lista, RecordatorioFlujo):
//   tres roturas del guard nuevo, 30 / 1 cada una — el ítem también para el setter, visible para
//   todos, y la pantalla escribiendo por otra ruta.
//
// REVISIÓN ADVERSARIAL (06/10/2026): cinco agujeros más, con su test. Sin romper: 31 pass / 0
// fail. Las 15 roturas cayeron, cada una en el test que la persigue (30 / 1 todas):
//   · `toquesVencidos` sin `fechaCoincide` (la hora vieja tras editar la fecha a mano);
//     `fechaCoincide` sin la zona del negocio.
//   · `juntaACancelar` sin comparar el instante (la reagenda del mismo día); y cortando en la R2
//     de otro horario en vez de seguir a la R1.
//   · `envioIncierto` siempre false; el emisor marcando `fallo:` (reintentable) para todo.
//   · el emisor sin pasarle `tz` a `toquesVencidos`.
//   · `cancelarJuntaEnLead` sin la fecha o sin la hora en el WHERE; escribiendo la hora en null.
//   · `guardarLinkDeReunion` sin `soloSiInicio`; el webhook borrando el link sin condición.
//   · Calendly y Cal.com sin pasarle el instante a `cancelarJuntaEnLead`.
//   · la ruta de /automations con el `envioWhatsappHabilitado` que se come el error.
//
// EL NÚMERO DE CADA TOQUE (10/10/2026, grupo «recordatorio»), con el mismo tipo de arnés (restaura de
// memoria y verifica md5). Sin romper: 34 pass / 0 fail. Las 9 roturas cayeron, 33 / 1 cada una:
//   · el emisor sin pasarle `linea` a `enviarYEspejar`; la ruta guardando una línea sin `elegirLinea`;
//     el GET sin el número de cada toque; «Activar» (un POST sin `lineas`) borrándole el número a todos.
//   · la ruta con su propia validación del texto en vez de `problemaDelTexto`.
//   · `configDeRecordatorio` leyendo la línea después del `continue` del texto (el de fábrica la pierde);
//     `serializarConfig` sin guardar un toque que sólo cambió de número; una línea de cualquier largo.
//   · `problemaDelTexto` sin el tope de caracteres.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  TOQUES, TOLERANCIA_MIN, TEXTO_DEFAULT, KEY_RECORDATORIO, toquesVencidos, juntasDe, leadAbierto, claveToque,
  isoCanonico, estadoDeLaMarca, linkDeReunion, juntaQueSeCancela, configDeRecordatorio, serializarConfig,
  variablesDesconocidas, textoDelToque, faltanTexto, fechaEnZona, fechaCoincide, juntaACancelar, envioIncierto,
  problemaDelTexto, TOPE_TEXTO, TOPE_LINEA, TZ_FECHA_AGENDA, type Junta,
} from '../lib/recordatorio-lead';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque de una función: desde su firma hasta la próxima declaración de primer nivel. */
function bloque(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const resto = src.slice(i + firma.length);
  const fin = resto.search(/\n(export |async function |function |const [A-Z_]+ =)/);
  return firma + (fin >= 0 ? resto.slice(0, fin) : resto);
}

const MIN = 60_000;
const AHORA = Date.parse('2026-10-07T15:00:00Z');
const LINK = 'https://meet.google.com/abc-defg-hij';
// La fecha por default es la del DÍA de la reunión en la zona de los webhooks, como la escribe
// `isoToFechaTijuana`: una fecha de otro día es una hora vieja y no se manda (`fechaCoincide`).
const junta = (p: Partial<Junta> & { enMin: number }): Junta => {
  const inicio = p.inicio ?? new Date(AHORA + p.enMin * MIN).toISOString();
  return {
    cual: p.cual ?? 'R1',
    inicio,
    fecha: p.fecha === undefined ? fechaEnZona(inicio, TZ_FECHA_AGENDA) : p.fecha,
    asistio: p.asistio ?? null,
    link: p.link === undefined ? LINK : p.link,
  };
};
const vencen = (j: Junta, tolMin?: number, toques?: number[]) =>
  toquesVencidos({ leadId: 7, juntas: [j], ahora: AHORA, tolMin, toques }).map((v) => v.min);

// ── Cuándo ───────────────────────────────────────────────────────────────────

test('los tres toques: 24 h, 1 h y 15 min antes, cada uno en su momento', () => {
  assert.deepEqual([...TOQUES], [1440, 60, 15]);
  assert.deepEqual(vencen(junta({ enMin: 1440 })), [1440]);
  assert.deepEqual(vencen(junta({ enMin: 60 })), [60]);
  assert.deepEqual(vencen(junta({ enMin: 15 })), [15]);
  // Entre toques no sale nada.
  assert.deepEqual(vencen(junta({ enMin: 30 })), []);
  assert.deepEqual(vencen(junta({ enMin: 16 })), []);   // el de 15 todavía no llegó
  assert.deepEqual(vencen(junta({ enMin: 600 })), []);
});

test('tarde dentro de la tolerancia sale; pasada, el toque se PIERDE (no se manda tarde)', () => {
  assert.equal(TOLERANCIA_MIN, 12);
  assert.deepEqual(vencen(junta({ enMin: 15 - 5 })), [15]);                 // 5 min tarde
  assert.deepEqual(vencen(junta({ enMin: 60 - 11 })), [60]);                // 11 min tarde
  assert.deepEqual(vencen(junta({ enMin: 60 - 12 })), [], 'a los 12 ya está fuera de ventana');
  assert.deepEqual(vencen(junta({ enMin: 1440 - 13 })), [], 'agendado tarde: el de 24 h se perdió');
});

test('con la reunión empezada no sale nada, aunque un toque caiga en la ventana', () => {
  // Con los toques reales no se puede dar (el menor es 15 y la tolerancia 12); con uno de 5 sí.
  assert.deepEqual(vencen(junta({ enMin: -1 }), 12, [5]), []);
  assert.deepEqual(vencen(junta({ enMin: 2 }), 12, [5]), [5]);
});

test('cancelada (fecha null), con la asistencia marcada o sin hora: no sale nada', () => {
  assert.deepEqual(vencen(junta({ enMin: 60, fecha: null })), [], 'la cancelación pone fecha_junta_X en null y NO junta_X_at');
  assert.deepEqual(vencen(junta({ enMin: 60, asistio: false })), []);
  assert.deepEqual(vencen(junta({ enMin: 60, asistio: true })), []);
  assert.deepEqual(vencen({ cual: 'R1', inicio: null, fecha: '2026-10-07', asistio: null }), []);
  assert.deepEqual(vencen({ cual: 'R1', inicio: 'no es una fecha', fecha: '2026-10-07', asistio: null }), []);
});

test('una HORA VIEJA (la fecha se editó a mano y junta_X_at no) no sale; la fecha del negocio sí vale', () => {
  // AHORA = 07/10 15:00Z; la reunión «vieja» es 08/10 15:00Z (08/10 08:00 en Tijuana). El setter
  // la movió a mano al 09/10: `fecha_junta_1` dice 09/10 y `junta_1_at` sigue en la del 08/10.
  assert.deepEqual(vencen(junta({ enMin: 1440, fecha: '2026-10-09' })), [], 'recordaría una reunión que ya no existe');
  assert.deepEqual(vencen(junta({ enMin: 1440, fecha: '2026-10-08' })), [1440]);
  // El «reagendar» del CRM escribe la fecha en la zona del NEGOCIO: 08/10 03:30Z es el 07/10 en
  // Tijuana y el 08/10 en Buenos Aires. Con la zona del negocio vale; sin ella, no.
  const inicio = '2026-10-08T03:30:00.000Z';
  assert.equal(fechaEnZona(inicio, TZ_FECHA_AGENDA), '2026-10-07');
  assert.equal(fechaCoincide('2026-10-08', inicio, 'America/Argentina/Buenos_Aires'), true);
  assert.equal(fechaCoincide('2026-10-08', inicio, null), false);
  assert.equal(fechaCoincide('2026-10-07', inicio, null), true);
  const ahora = Date.parse(inicio) - 60 * MIN;
  const j: Junta = { cual: 'R1', inicio, fecha: '2026-10-08', asistio: null, link: null };
  assert.deepEqual(toquesVencidos({ leadId: 7, juntas: [j], ahora, tz: 'America/Argentina/Buenos_Aires' }).map((v) => v.min), [60]);
  assert.deepEqual(toquesVencidos({ leadId: 7, juntas: [j], ahora, tz: 'America/Tijuana' }).map((v) => v.min), []);
  // Una zona que no existe no tira: no coincide.
  assert.equal(fechaEnZona(inicio, 'No/Existe'), null);
});

test('la R2 tiene sus toques y su clave; R1 y R2 del mismo lead son independientes', () => {
  const r1 = junta({ enMin: 60, cual: 'R1' });
  const r2 = junta({ enMin: 15, cual: 'R2' });
  const v = toquesVencidos({ leadId: 7, juntas: [r1, r2], ahora: AHORA });
  assert.deepEqual(v.map((x) => `${x.cual}:${x.min}`), ['R1:60', 'R2:15']);
  assert.match(v[1].clave, /^mako\.recordatorio-lead\.7\.R2\./);
  assert.notEqual(v[0].clave, v[1].clave);
  // `juntasDe` arma las dos desde la fila, con su link.
  const js = juntasDe({
    junta_1_at: r1.inicio, junta_2_at: r2.inicio, fecha_junta_1: '2026-10-07', fecha_junta_2: '2026-10-07',
    asistio_j1: null, asistio_j2: null, junta_1_url: LINK, junta_2_url: null,
  });
  assert.deepEqual(js.map((j) => [j.cual, j.link]), [['R1', LINK], ['R2', null]]);
});

test('una REAGENDA da claves nuevas; el mismo instante escrito de dos formas, la misma', () => {
  const a = claveToque(7, 'R1', '2026-10-08T15:00:00+00:00', 60);
  const b = claveToque(7, 'R1', '2026-10-08T15:00:00.000000Z', 60);
  const c = claveToque(7, 'R1', '2026-10-09T15:00:00Z', 60);
  assert.equal(a, b, 'la base devuelve +00:00 y Calendly Z: si fueran dos claves, el toque sale dos veces');
  assert.notEqual(a, c);
  assert.equal(a, 'mako.recordatorio-lead.7.R1.2026-10-08T15:00:00.000Z.60');
  assert.equal(isoCanonico('basura'), null);
});

test('sólo se le recuerda a un lead abierto', () => {
  assert.equal(leadAbierto('abierto'), true);
  assert.equal(leadAbierto(null), true);
  assert.equal(leadAbierto('ganado'), false);
  assert.equal(leadAbierto('perdido'), false);
});

// ── La marca ─────────────────────────────────────────────────────────────────

test('la marca: libre se reclama, un fallo se reintenta, lo demás no se toca', () => {
  assert.equal(estadoDeLaMarca(null), 'libre');
  assert.equal(estadoDeLaMarca('fallo:2026-10-07T15:00:00Z'), 'reintento');
  assert.equal(estadoDeLaMarca('enviado:2026-10-07T15:00:00Z'), 'tomada');
  assert.equal(estadoDeLaMarca('reclamado:2026-10-07T15:00:00Z'), 'tomada', 'un reclamo viejo no se recupera: sería mandar dos veces');
  assert.equal(estadoDeLaMarca('incierto:2026-10-07T15:00:00Z'), 'tomada', 'un envío que pudo haber salido no se reintenta');
  assert.equal(estadoDeLaMarca(''), 'tomada');
});

test('un envío cortado por TIEMPO pudo haber salido: incierto, no se reintenta; un rechazo sí', () => {
  // Lo que devuelve evFetch cuando el AbortSignal.timeout(30 s) corta, y cuando la conexión cae.
  assert.equal(envioIncierto('The operation was aborted due to timeout'), true);
  assert.equal(envioIncierto('fetch failed'), true);
  assert.equal(envioIncierto('socket hang up'), true);
  // Evolution CONTESTÓ con un error, o ni se salió de acá: eso no viajó y se puede reintentar.
  assert.equal(envioIncierto('["Connection Closed"]'), false);
  assert.equal(envioIncierto('teléfono inválido'), false);
  assert.equal(envioIncierto('Evolution 500'), false);
  assert.equal(envioIncierto(undefined), false);
});

test('una cancelación anula la reunión de esa FECHA, y si las dos tienen hora, la de ese INSTANTE', () => {
  const hoy = '2026-10-07';
  const R1 = { fecha_junta_1: '2026-10-08', fecha_junta_2: null, junta_1_at: '2026-10-08T17:00:00+00:00', junta_2_at: null };
  assert.deepEqual(juntaACancelar(R1, '2026-10-08', hoy, '2026-10-08T17:00:00.000000Z'), { cual: 'R1', inicio: '2026-10-08T17:00:00.000000Z' });
  // REAGENDA EN EL MISMO DÍA, con la reserva nueva (23:00) llegada antes que la cancelación de
  // la vieja (17:00): la fila ya dice el día de las dos, y borrar la fecha borraba la NUEVA.
  const nueva = { ...R1, junta_1_at: '2026-10-08T23:00:00+00:00' };
  assert.deepEqual(juntaACancelar(nueva, '2026-10-08', hoy, '2026-10-08T17:00:00Z'), { motivo: 'la reunión vigente es otro horario (reagenda) — sin cambios' });
  // Sin hora en la fila (leads viejos) o sin instante en el pedido: por fecha, como siempre, y
  // sin exigir la hora en el UPDATE.
  assert.deepEqual(juntaACancelar({ ...R1, junta_1_at: null }, '2026-10-08', hoy, '2026-10-08T17:00:00Z'), { cual: 'R1', inicio: null });
  assert.deepEqual(juntaACancelar(R1, '2026-10-08', hoy), { cual: 'R1', inicio: null });
  // La R2 primero; ya pasó; no coincide.
  const ambas = { fecha_junta_1: '2026-10-08', fecha_junta_2: '2026-10-08', junta_1_at: '2026-10-08T15:00:00Z', junta_2_at: '2026-10-08T20:00:00Z' };
  assert.deepEqual(juntaACancelar(ambas, '2026-10-08', hoy, '2026-10-08T20:00:00Z'), { cual: 'R2', inicio: '2026-10-08T20:00:00Z' });
  assert.deepEqual(juntaACancelar(ambas, '2026-10-08', hoy, '2026-10-08T15:00:00Z'), { cual: 'R1', inicio: '2026-10-08T15:00:00Z' }, 'la R2 del mismo día no tapa a la R1 cancelada');
  assert.deepEqual(juntaACancelar(R1, '2026-10-06', hoy), { motivo: 'reunión ya pasó — sin cambios' });
  assert.deepEqual(juntaACancelar(R1, '2026-10-09', hoy), { motivo: 'fecha cancelada no coincide con R1/R2 — sin cambios' });
});

// ── El link ──────────────────────────────────────────────────────────────────

test('el link sale del join_url y sólo si es https', () => {
  assert.equal(linkDeReunion({ type: 'google_conference', status: 'pushed', join_url: LINK }), LINK);
  assert.equal(linkDeReunion({ type: 'zoom', join_url: 'https://us02web.zoom.us/j/123?pwd=x' }), 'https://us02web.zoom.us/j/123?pwd=x');
  assert.equal(linkDeReunion({ type: 'physical', location: 'Av. Siempre Viva 742' }), null);
  assert.equal(linkDeReunion({ type: 'custom', join_url: 'javascript:alert(1)' }), null);
  assert.equal(linkDeReunion({ join_url: 'http://meet.google.com/x' }), null);
  assert.equal(linkDeReunion(null), null);
  assert.equal(linkDeReunion('https://meet.google.com/x'), null, 'location es un objeto, no un string');
});

test('la cancelación limpia el link de ESA reunión, comparando el instante', () => {
  const fila = { junta_1_at: '2026-10-08T15:00:00+00:00', junta_2_at: '2026-10-12T18:00:00+00:00' };
  assert.equal(juntaQueSeCancela(fila, '2026-10-08T15:00:00.000000Z'), 'R1');
  assert.equal(juntaQueSeCancela(fila, '2026-10-12T18:00:00Z'), 'R2');
  // La reserva nueva de una reagenda llegó primero: la fila ya tiene el horario nuevo.
  assert.equal(juntaQueSeCancela(fila, '2026-10-08T13:00:00Z'), null);
  assert.equal(juntaQueSeCancela(fila, null), null);
});

// ── Los textos ───────────────────────────────────────────────────────────────

const TZ_MX = 'America/Mexico_City';
const armar = (min: 1440 | 60 | 15, p: { link?: string | null; nombre?: string | null; tardeMin?: number; tz?: string } = {}) => {
  const ahora = new Date(AHORA);
  const inicio = new Date(AHORA + (min - (p.tardeMin ?? 0)) * MIN);
  return textoDelToque({
    plantilla: TEXTO_DEFAULT[min], nombre: p.nombre === undefined ? 'Ana Pérez' : p.nombre,
    inicio, ahora, tz: p.tz ?? TZ_MX, link: p.link === undefined ? LINK : p.link,
  });
};

test('con link: el nombre, la hora en la zona del negocio y el link', () => {
  // 07/10 15:00Z + 24 h = 08/10 09:00 en CDMX (UTC-6).
  assert.equal(armar(1440), `Hola Ana, te recuerdo tu reunión mañana a las 9:00 a. m.\nPara entrar: ${LINK}`);
  assert.equal(armar(60), `Hola Ana, tu reunión empieza en 1 hora, a las 10:00 a. m.\nPara entrar: ${LINK}`);
  assert.equal(armar(15), `Hola Ana, empezamos en 15 minutos.\nEntra aquí: ${LINK}`);
  // La zona es la del NEGOCIO: el mismo instante en Buenos Aires (UTC-3) es otra hora.
  assert.match(armar(60, { tz: 'America/Argentina/Buenos_Aires' }) ?? '', /a las 1:00 p\. m\./);
});

test('sin link: el renglón del link NO sale, y nunca un placeholder crudo', () => {
  for (const min of TOQUES) {
    const t = armar(min, { link: null }) ?? '';
    assert.ok(t.length > 10, `el de ${min} quedó vacío`);
    assert.doesNotMatch(t, /\{\{|\}\}/, `placeholder crudo en el de ${min}: ${t}`);
    assert.doesNotMatch(t, /Para entrar|Entra aquí|https?:/, `quedó el renglón del link en el de ${min}: ${t}`);
  }
  // Un link que no es https tampoco se manda.
  assert.doesNotMatch(armar(15, { link: 'javascript:alert(1)' }) ?? '', /javascript|Entra aquí/);
});

test('sin nombre, el saludo no queda «Hola ,»; y la hora no termina en «m..»', () => {
  assert.match(armar(15, { nombre: null }) ?? '', /^Hola, empezamos/);
  assert.match(armar(60, { nombre: '   ' }) ?? '', /^Hola, tu reunión/);
  for (const min of TOQUES) assert.doesNotMatch(armar(min) ?? '', /m\.\./);
});

test('lo que falta se calcula AL SALIR: un toque que salió tarde no dice «en 1 hora»', () => {
  assert.match(armar(60, { tardeMin: 8 }) ?? '', /empieza en 52 minutos/);
  assert.match(armar(15, { tardeMin: 11 }) ?? '', /empezamos en 4 minutos/);
  assert.equal(faltanTexto(1), 'en 1 minuto');
  assert.equal(faltanTexto(0.2), 'ahora');
  assert.equal(faltanTexto(60), 'en 1 hora');
  assert.equal(faltanTexto(1440), 'en 24 horas');
});

test('los textos armados van de TÚ, sin voseo', () => {
  for (const min of TOQUES) {
    for (const link of [LINK, null]) {
      const t = armar(min, { link }) ?? '';
      assert.deepEqual(marcasDeVoseo(t), [], `voseo en: ${t}`);
      assert.doesNotMatch(t, /(?<!\p{L})(entrá|tenés|podés|fijate|acá)(?!\p{L})/iu, `voseo en: ${t}`);
    }
  }
});

test('una variable desconocida se RECHAZA al guardar y se BORRA si igual llega', () => {
  assert.deepEqual(variablesDesconocidas('Hola {{nombre}} de {{negocio}} {{ link }}'), ['negocio']);
  assert.deepEqual(variablesDesconocidas(TEXTO_DEFAULT[1440] + TEXTO_DEFAULT[60] + TEXTO_DEFAULT[15]), []);
  const t = textoDelToque({ plantilla: 'Hola {{nombre}}, te escribe {{negocio}}.', nombre: 'Ana', inicio: new Date(AHORA + 60 * MIN), ahora: new Date(AHORA), tz: TZ_MX, link: null });
  assert.doesNotMatch(t ?? '', /\{\{/);
});

// ── La configuración ─────────────────────────────────────────────────────────

test('nace APAGADO: sólo un `true` literal lo prende', () => {
  assert.equal(KEY_RECORDATORIO, 'chatbot.recordatorio_reunion');
  assert.equal(configDeRecordatorio(null).activo, false);
  assert.equal(configDeRecordatorio('{roto').activo, false);
  assert.equal(configDeRecordatorio('{"activo":"true"}').activo, false);
  assert.equal(configDeRecordatorio('{"activo":1}').activo, false);
  assert.equal(configDeRecordatorio('{"activo":true}').activo, true);
  assert.deepEqual(configDeRecordatorio(null).textos, TEXTO_DEFAULT);
});

test('los textos propios se conservan; los vacíos, iguales al de fábrica o de un toque que no existe, no', () => {
  const raw = JSON.stringify({ activo: true, toques: [
    { min: 60, texto: '  Hola {{nombre}}, en una hora.  ' },
    { min: 15, texto: '' },
    { min: 1440, texto: TEXTO_DEFAULT[1440] },
    { min: 30, texto: 'no existe este toque' },
  ] });
  const c = configDeRecordatorio(raw);
  assert.equal(c.textos[60], 'Hola {{nombre}}, en una hora.');
  assert.equal(c.textos[15], TEXTO_DEFAULT[15]);
  assert.deepEqual(c.propios, [60]);
  // Lo que se guarda: sólo lo propio, así una mejora del de fábrica le llega a quien no lo tocó.
  const s = serializarConfig({ activo: true, textos: { 1440: TEXTO_DEFAULT[1440], 60: c.textos[60], 15: '' } });
  assert.deepEqual(JSON.parse(s), { activo: true, toques: [{ min: 60, texto: 'Hola {{nombre}}, en una hora.' }] });
  assert.deepEqual(configDeRecordatorio(s), c);
});

// 10/10/2026: el número de cada toque (sexta tanda, WhatsApp 2 sobre el recordatorio).
test('el NÚMERO de cada toque se guarda aunque su texto sea el de fábrica, y sin elegir es la de por default', () => {
  // Un setting de antes (sin `linea`) no cambia: todos por la de por default.
  assert.deepEqual(configDeRecordatorio(JSON.stringify({ activo: true, toques: [{ min: 60, texto: 'Hola' }] })).lineas, {});
  const s = serializarConfig({
    activo: true,
    textos: { 1440: TEXTO_DEFAULT[1440], 60: 'Hola {{nombre}}', 15: '' },
    lineas: { 1440: 'mako_ws9_b', 60: null, 15: '   ' },
  });
  // El de 1440 viaja SIN texto (es el de fábrica) y CON su número; el de 60, con su texto y sin número.
  assert.deepEqual(JSON.parse(s), { activo: true, toques: [{ min: 1440, linea: 'mako_ws9_b' }, { min: 60, texto: 'Hola {{nombre}}' }] });
  const c = configDeRecordatorio(s);
  assert.deepEqual(c.lineas, { 1440: 'mako_ws9_b' });
  assert.equal(c.textos[1440], TEXTO_DEFAULT[1440]);
  assert.deepEqual(c.propios, [60]);
  // Una línea rara (no un texto, o más larga que cualquier nombre de la casa) no se guarda.
  const raro = configDeRecordatorio(JSON.stringify({ activo: true, toques: [{ min: 15, linea: 7 }, { min: 60, linea: 'x'.repeat(TOPE_LINEA + 1) }] }));
  assert.deepEqual(raro.lineas, {});
});

test('un texto que no se puede publicar dice por qué; uno vacío sí se puede (vuelve al de fábrica)', () => {
  assert.equal(problemaDelTexto(''), null);
  assert.equal(problemaDelTexto(TEXTO_DEFAULT[1440]), null);
  assert.equal(problemaDelTexto('Hola {{negocio}} y {{x}}'), 'No existe: {{negocio}}, {{x}}');
  assert.equal(problemaDelTexto('x'.repeat(TOPE_TEXTO + 1)), `Máximo ${TOPE_TEXTO} caracteres.`);
});

// ── Guards sobre lo server-only ──────────────────────────────────────────────

const EMISOR = sinComentarios(leer('lib/reunion-recordatorio.ts'));

test('CABLEADO: el emisor manda sólo con el interruptor del negocio Y el envío prendidos', () => {
  const b = bloque(EMISOR, 'export async function mandarRecordatoriosAlLead(');
  assert.match(b, /return runWithWorkspace\(ws, async \(\) =>/, 'envioWhatsappHabilitado lee el contexto: tiene que ir adentro del runWithWorkspace');
  // Desde la mudanza (10/10/2026) el interruptor y los toques salen de `toquesDelNegocio`: la automatización del
  // recordatorio si el negocio la tiene, y si no la configuración de antes (tests/recordatorio-automatizacion.test.ts).
  assert.match(b, /try \{ fuente = await toquesDelNegocio\(ws\); \}\s*catch \(e\) \{ res\.errores\.push\(msgErr\(e\)\); return res; \}/, 'una lectura que falla no puede caer a otra fuente');
  assert.match(b, /if \(!fuente\.activo && !opts\.dry\) return res;/, 'apagado tiene que cortar ANTES de mirar los leads');
  assert.match(b, /res\.envio = await envioWhatsappHabilitado\(\)/);
  assert.match(b, /if \(!res\.envio && !opts\.dry\) return res;/);
  assert.match(b, /await estaBloqueado\(telefono\)/, 'un contacto bloqueado no recibe nada');
  assert.match(b, /if \(opts\.dry\) \{ res\.enSeco!\.push\([^\n]*\); continue; \}/, 'en seco no se reclama ni se manda');
  assert.ok(b.indexOf('if (opts.dry)') < b.indexOf('cambiarSettingSi(v.clave'), 'el corte en seco va ANTES del reclamo');
});

test('CABLEADO: reclamo con compare-and-set ANTES de mandar, y `enviado:` DESPUÉS del envío ok', () => {
  const b = bloque(EMISOR, 'export async function mandarRecordatoriosAlLead(');
  const iReclamo = b.indexOf('cambiarSettingSi(v.clave');
  const iEnvio = b.indexOf('enviarYEspejar(');
  const iEnviado = b.indexOf('setSetting(v.clave, `enviado:');
  assert.ok(iReclamo > 0 && iEnvio > iReclamo, 'sin el reclamo antes, dos corridas del mismo tick mandan las dos');
  assert.ok(iEnviado > iEnvio, 'la marca de enviado va DESPUÉS del envío ok, nunca antes');
  assert.match(b.slice(iEnvio, iEnviado), /if \(r\.ok\) \{/);
  assert.match(b, /getSettingEstricto\(v\.clave\)/, 'con getSetting un error de lectura se lee como «no hay marca» y manda otra vez');
  // El fallo que pudo haber salido no vuelve a `fallo:` (que se reintenta).
  const rama = b.slice(b.indexOf('} else {', iEnviado));
  assert.match(rama, /const marcaFallo = envioIncierto\(r\.error\) \? 'incierto' : 'fallo';/);
  assert.match(rama, /cambiarSettingSi\(v\.clave, reclamo, `\$\{marcaFallo\}:/);
});

test('CABLEADO: el emisor le pasa la zona del negocio a toquesVencidos (la hora vieja no sale)', () => {
  const b = bloque(EMISOR, 'export async function mandarRecordatoriosAlLead(');
  assert.match(b, /toquesVencidos\(\{ leadId: lead\.id, juntas: juntasDe\(lead\), ahora: t, tz, toques: \[\.\.\.toquePorMin\.keys\(\)\] \}\)/);
  assert.ok(b.indexOf('const tz = ') >= 0 && b.indexOf('const tz = ') < b.indexOf('toquesVencidos('), 'la zona se resuelve ANTES de decidir');
});

test('CABLEADO: cada toque sale por SU número', () => {
  const b = bloque(EMISOR, 'export async function mandarRecordatoriosAlLead(');
  assert.match(b, /enviarYEspejar\(\{ telefono, texto, leadId: lead\.id, linea: toque\.linea \}\)/,
    'sin `linea`, el número elegido en la tarjeta se guarda y el toque sale por la de por default');
  // (La ruta que guardaba el número de cada toque se fue con el lienzo de antes, el 10/10/2026: el número
  // es la `linea` del paso de la automatización, que valida `setSecuenciaPasos` como en cualquier otra.)
});

test('CABLEADO: el setting no se hereda del dueño — se lee con el workspace_id explícito', () => {
  const b = bloque(EMISOR, 'export async function leerConfigRecordatorio(');
  assert.match(b, /\.eq\('workspace_id', ws\)\.eq\('key', KEY_RECORDATORIO\)/);
  assert.doesNotMatch(b, /getSetting\(/, 'getSetting lee el contexto y fuera de uno cae al dueño');
  assert.match(b, /if \(error\) throw/, '«no pude leer» no es «apagado»');
  // Y los dos caminos que COPIAN settings del dueño a otro workspace (clonar la configuración,
  // traer los datos de Mau) no lo pueden llevar: le prenderían el recordatorio a otro negocio.
  for (const r of ['lib/clonar-config.ts', 'lib/datos-mau.ts']) {
    assert.doesNotMatch(sinComentarios(leer(r)), /automations\.recordatorio_reunion|KEY_RECORDATORIO/, `${r} copiaría el interruptor de otro negocio`);
  }
});

test('CABLEADO: el aviso al dueño lee su marca con el estricto', () => {
  const b = bloque(EMISOR, 'export async function mandarRecordatoriosDeReunion(');
  assert.match(b, /getSettingEstricto\(key\)\.catch\(\(\) => 'error'\)/, 'con getSetting el catch no corre nunca: getSetting se come el error');
});

test('CABLEADO: el webhook guarda el link al agendar y lo limpia al cancelar, sin tocar junta_X_at', () => {
  const wh = sinComentarios(leer('app/api/webhooks/calendly/route.ts'));
  assert.match(wh, /guardarLinkDeReunion\(lead\.id, 'R1', linkDeReunion\(payload\.scheduled_event\?\.location\)\)/);
  assert.match(wh, /guardarLinkDeReunion\(lead\.id, 'R2', linkDeReunion\(payload\.scheduled_event\?\.location\)\)/);
  assert.match(wh, /const cualLink = juntaQueSeCancela\(lead, startTimeIso\);\s*if \(cualLink\) await guardarLinkDeReunion\(lead\.id, cualLink, null, \{ soloSiInicio: startTimeIso \}\);/,
    'el link se borra sólo si la fila sigue en la reunión cancelada: si no, una reagenda simultánea pierde el link nuevo');
  const leads = sinComentarios(leer('lib/leads.ts'));
  const cancelar = bloque(leads, 'export async function cancelarJuntaEnLead(');
  // Lo que el UPDATE ESCRIBE: sólo la fecha. La hora va al WHERE, nunca al payload.
  assert.match(cancelar, /\.update\(\{ \[campo\]: null \}\)/);
  assert.doesNotMatch(cancelar, /junta_[12]_at['"]?\s*:\s*null|\[campoHora\]\s*:/, 'en null, la regla T1 del CRM propone No Show sobre la R1 cancelada (refutador del #17)');
  const guardar = bloque(leads, 'export async function guardarLinkDeReunion(');
  assert.match(guardar, /try \{[\s\S]*\} catch/, 'guardar el link NUNCA puede tumbar la reserva');
  assert.match(guardar, /if \(opts\.soloSiInicio\) q = q\.eq\(/);
  assert.doesNotMatch(bloque(leads, 'export async function upsertLeadFromCalendly('), /junta_[12]_url/,
    'el link va en un update APARTE: en el upsert, sin la migración ninguna reserva entra');
});

test('CABLEADO: la cancelación decide con juntaACancelar y su UPDATE exige lo que comparó', () => {
  const cancelar = bloque(sinComentarios(leer('lib/leads.ts')), 'export async function cancelarJuntaEnLead(');
  assert.match(cancelar, /const d = juntaACancelar\(lead, fechaCancelada, hoy, inicioCancelado\);/);
  assert.match(cancelar, /\.eq\(campo, fechaCancelada\);/, 'si la reserva nueva escribió entre medio, el WHERE no calza');
  assert.match(cancelar, /if \(d\.inicio\) q = q\.eq\(campoHora, d\.inicio\);/);
  // Y los DOS webhooks le pasan el instante cancelado.
  assert.match(sinComentarios(leer('app/api/webhooks/calendly/route.ts')),
    /cancelarJuntaEnLead\(lead, fechaCancelada, hoyEnTijuana\(\), startTimeIso\)/);
  assert.match(sinComentarios(leer('app/api/webhooks/calcom/route.ts')),
    /cancelarJuntaEnLead\(lead, isoToFechaTijuana\(reserva\.inicio\), hoyEnTijuana\(\), reserva\.inicio\)/);
});

test('CABLEADO: el cron recorre TODOS los workspaces activos para el lead, con su ?dry=1', () => {
  const cron = sinComentarios(leer('app/api/cron/reunion-recordatorio/route.ts'));
  assert.match(cron, /const dry = request\.nextUrl\.searchParams\.get\('dry'\) === '1';/);
  assert.match(cron, /\(await listarWorkspaces\(\)\)\.filter\(\(w\) => w\.estado === 'activo'\)/);
  assert.match(cron, /mandarRecordatoriosAlLead\(ws, \{ dry,/);
  assert.match(cron, /const workspaces = dry \? \[\] : await correrPorWorkspace\('calendly'/, 'en seco tampoco sale el aviso al dueño');
  assert.equal((cron.match(/correrPorWorkspace\(/g) ?? []).length, 1, 'el del lead no puede ir sólo a los de Calendly: Código Inmobiliario usa Cal.com');
  const vercel = JSON.parse(leer('vercel.json')) as { crons: Array<{ path: string; schedule: string }> };
  assert.equal(vercel.crons.find((c) => c.path === '/api/cron/reunion-recordatorio')?.schedule, '*/10 * * * *',
    'la tolerancia de 12 min está calculada para un cron cada 10');
});

test('la migración 0204 existe, agrega las dos columnas y dice su orden de despliegue', () => {
  const ruta = 'supabase/migrations/0204_link_de_la_reunion.sql';
  assert.ok(existsSync(join(RAIZ, ruta)));
  const sql = leer(ruta);
  assert.match(sql, /add column if not exists junta_1_url text/);
  assert.match(sql, /add column if not exists junta_2_url text/);
  assert.match(sql, /ORDEN DE DESPLIEGUE: ANTES O JUNTO con el deploy/);
  // Y el emisor de verdad las LEE (si dejara de leerlas, el orden de despliegue cambiaría).
  assert.match(EMISOR, /junta_1_url, junta_2_url'/);
});

// ⚠️ MUDADO DOS VECES. El 08/10/2026 el recordatorio pasó de un renglón arriba del lienzo a un ítem de la lista;
// el 10/10/2026 (decisión de Martín: «Mudarlo al motor») pasó a ser una AUTOMATIZACIÓN con su CRON. Lo que se
// cuida es lo mismo: que lo que se publica sea lo que su emisor sabe mandar, con los datos que resuelve.
test('CABLEADO: Publicar y Activar rechazan, con el CRON del recordatorio, lo que su emisor no sabe mandar', () => {
  const nut = sinComentarios(leer('lib/nutricion.ts'));
  assert.match(nut, /\.from\('nutricion_secuencias'\)\.select\('pasos, trigger_tipo'\)\.eq\('id', id\)\.maybeSingle\(\);/);
  assert.match(nut, /if \(\(previo as \{ trigger_tipo\?: string \} \| null\)\?\.trigger_tipo === TRIGGER_RECORDATORIO\) \{\s*const r = toquesDeLaAutomatizacion\(grafo\);\s*if \(r\.problema\) throw new PasosInvalidosError/);
  assert.match(sinComentarios(leer('lib/recordatorio-lead.ts')), /const malas = variablesDesconocidas\(t\);/);
});

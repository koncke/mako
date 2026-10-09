// =============================================================================
// curso-recordatorio — el recordatorio de clases (#780): a quién, cuándo, qué, y que sólo el cron lo manda
// =============================================================================
// Decisión de Martín (06/10/2026): por WhatsApp, a los 3 días sin entrar al portal, sólo los videos
// sin ver de su etapa. El envío del ws1 está PRENDIDO: esto le escribe de verdad a los clientes de
// Mauricio, así que lo que se fija acá es sobre todo lo que IMPIDE escribir de más.
//
// Ejecuta lo puro (lib/curso-mensajes-texto.ts y `videosSinVer` de lib/curso.ts) y fija con guards
// lo de lib/curso-mensajes.ts (server-only) que no se ve en una pantalla: el orden «lo que se sabe
// sin mandar → la marca con compare-and-set → el envío», que nunca crea un acceso, y que sólo lo
// llama el cron.
//
// (El resultado de romperlo, con números, está al final del archivo.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { videosSinVer, PCT_VISTO, type Clase } from '../lib/curso';
import {
  tocaRecordatorio, enUniversoDeRecordatorio, sesionCerca, ventanaDeSesionCerca, sigueEnElPrograma,
  textoRecordatorioClases, textoRecordatorioDueno, claveAvisoRecordatorio, TITULO_AVISO_RECORDATORIO,
  DIAS_SIN_ENTRAR, DIAS_ENTRE_RECORDATORIOS, SESION_CERCA_HORAS, TOPE_PENDIENTES,
  ultimoInicioDeRecordatorio, TOPE_PEDIDO_EVOLUTION_MS, RESERVA_RECORDATORIO_MS, RESERVA_COPIA_MS, MARGEN_CIERRE_MS,
  type AccesoParaRecordar,
} from '../lib/curso-mensajes-texto';
import { CATALOGO_AVISOS, areaDeAviso } from '../lib/avisos-catalogo';

const RAIZ = join(import.meta.dirname, '..');
// ⚠️ Normaliza el fin de línea: en un worktree el fuente llega en CRLF (AGENTS.md).
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después: un `/*` dentro de un `//` se comería el código.
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const H = 3_600_000;
const D = 24 * H;
const AHORA = new Date('2026-10-12T16:00:00Z');   // lunes 12/10, 10:00 en CDMX
const hace = (ms: number) => new Date(AHORA.getTime() - ms).toISOString();

const acc = (o: Partial<AccesoParaRecordar> = {}): AccesoParaRecordar => ({
  revocado: false, ingresos: 0, ultimoIngresoAt: null, invitacionEnviadaAt: null, linkEnviadoAt: null, recordatorioAt: null, ...o,
});

// ── Cuándo toca ──────────────────────────────────────────────────────────────

test('las constantes son las de la decisión: 3 días sin entrar, uno cada 3 días, sesiones a 48 h', () => {
  assert.equal(DIAS_SIN_ENTRAR, 3);
  assert.equal(DIAS_ENTRE_RECORDATORIOS, 3);
  assert.equal(SESION_CERCA_HORAS, 48);
});

test('nunca entró: cuenta desde la invitación, y el borde de los 3 días es exacto', () => {
  const invitado = (ms: number) => acc({ invitacionEnviadaAt: hace(ms) });
  assert.equal(tocaRecordatorio(invitado(3 * D - 60_000), AHORA), false, 'a 2 días y 23:59 todavía no');
  assert.equal(tocaRecordatorio(invitado(3 * D), AHORA), true, 'a los 3 días justos, sí');
  assert.equal(tocaRecordatorio(invitado(10 * D), AHORA), true);
  assert.equal(tocaRecordatorio(invitado(1 * D), AHORA), false);
});

test('ya entró: cuenta desde su ÚLTIMO ingreso, no desde la invitación', () => {
  assert.equal(tocaRecordatorio(acc({ ingresos: 4, invitacionEnviadaAt: hace(20 * D), ultimoIngresoAt: hace(2 * D) }), AHORA), false,
    'entró hace 2 días: la invitación vieja no lo vuelve «3 días sin entrar»');
  assert.equal(tocaRecordatorio(acc({ ingresos: 4, invitacionEnviadaAt: hace(20 * D), ultimoIngresoAt: hace(3 * D) }), AHORA), true);
  // Entró con el link de WhatsApp (sin invitación) y hace 5 días que no vuelve.
  assert.equal(tocaRecordatorio(acc({ ingresos: 1, ultimoIngresoAt: hace(5 * D) }), AHORA), true);
  // Entró hace 10 días y AYER lo invitaron por mail: el contacto más reciente es la invitación.
  assert.equal(tocaRecordatorio(acc({ ingresos: 1, ultimoIngresoAt: hace(10 * D), invitacionEnviadaAt: hace(1 * D) }), AHORA), false);
});

// Revisión del 07/10/2026: `invitacion_enviada_at` es SÓLO la invitación por mail. El link que
// Mauricio manda por WhatsApp desde la ficha no lo escribe, así que sin `linkEnviadoAt` el cliente
// que lo recibió y nunca lo abrió quedaba afuera, y mandar el link no contaba como contacto.
test('el link por WhatsApp cuenta: lo mete al universo y es un ancla más (gana la más reciente)', () => {
  // Le mandaron el link y nunca lo abrió: sin invitación por mail ni ingresos.
  assert.equal(enUniversoDeRecordatorio(acc({ linkEnviadoAt: hace(1 * D) })), true, 'el caso más típico de «nunca entró»');
  assert.equal(tocaRecordatorio(acc({ linkEnviadoAt: hace(3 * D) }), AHORA), true, 'a los 3 días del link, sí');
  assert.equal(tocaRecordatorio(acc({ linkEnviadoAt: hace(3 * D - 60_000) }), AHORA), false, 'a 2 días y 23:59 del link, todavía no');
  // Invitado por mail hace 10 días y HOY le llegó el link por WhatsApp: el recordatorio no sale una hora después.
  assert.equal(tocaRecordatorio(acc({ invitacionEnviadaAt: hace(10 * D), linkEnviadoAt: hace(1 * H) }), AHORA), false);
  // Entró hace 10 días y anteayer le llegó el link de su etapa nueva: cuenta desde el link.
  assert.equal(tocaRecordatorio(acc({ ingresos: 3, ultimoIngresoAt: hace(10 * D), linkEnviadoAt: hace(2 * D) }), AHORA), false);
  // Y un link viejo no tapa un ingreso más nuevo: gana el más reciente, sea cual sea.
  assert.equal(tocaRecordatorio(acc({ ingresos: 3, ultimoIngresoAt: hace(1 * D), linkEnviadoAt: hace(9 * D) }), AHORA), false);
  // Revocado no entra aunque le hayan mandado el link.
  assert.equal(tocaRecordatorio(acc({ revocado: true, linkEnviadoAt: hace(9 * D) }), AHORA), false);
});

test('no más de uno cada 3 días: el borde también es exacto', () => {
  const base = { invitacionEnviadaAt: hace(30 * D) };
  assert.equal(tocaRecordatorio(acc({ ...base, recordatorioAt: hace(3 * D - 60_000) }), AHORA), false, 'recordado hace 2 días y 23:59');
  assert.equal(tocaRecordatorio(acc({ ...base, recordatorioAt: hace(3 * D) }), AHORA), true, 'recordado hace 3 días justos');
  assert.equal(tocaRecordatorio(acc({ ...base, recordatorioAt: hace(1 * H) }), AHORA), false);
});

test('fuera del universo, o sin un dato que se pueda leer: NO toca (fail-closed)', () => {
  assert.equal(tocaRecordatorio(acc({ revocado: true, invitacionEnviadaAt: hace(10 * D) }), AHORA), false, 'revocado');
  assert.equal(tocaRecordatorio(acc({ ultimoIngresoAt: hace(10 * D) }), AHORA), false,
    'ni invitado ni con ingresos: «tiene fila» no es «lo invitaron»');
  assert.equal(tocaRecordatorio(acc({ ingresos: 2 }), AHORA), false, 'sin ancla no se puede decir «3 días sin entrar»');
  assert.equal(tocaRecordatorio(acc({ invitacionEnviadaAt: hace(10 * D), recordatorioAt: 'no es fecha' }), AHORA), false,
    'una marca que no se lee no autoriza a mandar otro');
  assert.equal(enUniversoDeRecordatorio(acc({ invitacionEnviadaAt: hace(1) })), true);
  assert.equal(enUniversoDeRecordatorio(acc({ ingresos: 1 })), true);
  assert.equal(enUniversoDeRecordatorio(acc({})), false);
});

test('una sesión de la entrega a 48 h o menos —antes o después— lo saltea', () => {
  const en = (horas: number) => new Date(AHORA.getTime() + horas * H).toISOString();
  assert.equal(sesionCerca([en(47)], AHORA), true, 'el previo le va a escribir');
  assert.equal(sesionCerca([en(48)], AHORA), true);
  assert.equal(sesionCerca([en(49)], AHORA), false);
  assert.equal(sesionCerca([en(-30)], AHORA), true, 'el posterior le está escribiendo');
  assert.equal(sesionCerca([en(-49)], AHORA), false);
  assert.equal(sesionCerca([], AHORA), false);
  assert.equal(sesionCerca(['no es fecha'], AHORA), false);
  // La lectura del cron trae toda sesión que la regla considera «cerca».
  const v = ventanaDeSesionCerca(AHORA);
  for (let h = -60; h <= 60; h += 0.5) {
    if (!sesionCerca([en(h)], AHORA)) continue;
    assert.ok(en(h) >= v.desde && en(h) <= v.hasta, `la sesión a ${h} h está cerca y la lectura no la trae`);
  }
});

test('graduado, baja o pausado no reciben nada; sin fila en cs_clientes, sí (EN POSITIVO)', () => {
  assert.equal(sigueEnElPrograma(null), true);
  assert.equal(sigueEnElPrograma(undefined), true);
  assert.equal(sigueEnElPrograma('activo'), true);
  for (const e of ['graduado', 'baja', 'pausado', 'un-estado-nuevo']) assert.equal(sigueEnElPrograma(e), false, e);
});

// ── Qué videos ───────────────────────────────────────────────────────────────

const clase = (id: number, o: Partial<Clase> = {}): Clase => ({
  id, productoId: 1, etapa: 'norte', orden: id, titulo: `Video ${id}`, descripcion: '', tipo: 'clase',
  minutos: null, videoTipo: 'ninguno', videoUrl: null, videoPath: null, tarea: '', campos: [], obligatoria: false, ...o,
});
const YT = (id: number) => clase(id, { videoTipo: 'youtube', videoUrl: `https://www.youtube.com/watch?v=v${id}` });

test('videosSinVer: medible por debajo del umbral es pendiente; desde el umbral, visto', () => {
  assert.equal(PCT_VISTO, 90, 'el umbral es el mismo con el que la tab y la ficha dicen «visto»');
  const clases = [YT(1), YT(2), YT(3), clase(4, { videoTipo: 'archivo', videoPath: 'ws1/x.mp4' }), clase(5, { videoTipo: 'vimeo', videoUrl: 'https://vimeo.com/123' })];
  const pct: Record<number, number> = { 1: 89, 2: 90, 4: 100, 5: 12 };
  assert.deepEqual(videosSinVer(clases, (id) => pct[id]).map((c) => c.id), [1, 3, 5], 'el 3 no lo abrió nunca: cuenta como no visto');
  // El umbral se puede pasar, y el orden es el de la etapa.
  assert.deepEqual(videosSinVer(clases, (id) => pct[id], 80).map((c) => c.id), [3, 5]);
});

test('videosSinVer: «sin medir» (Drive, Loom, link afuera) NO cuenta como no visto, y una clase sin video tampoco', () => {
  const clases = [
    clase(1, { videoTipo: 'drive', videoUrl: 'https://drive.google.com/file/d/abc/view' }),
    clase(2, { videoTipo: 'loom', videoUrl: 'https://www.loom.com/share/aa11' }),
    clase(3, { videoTipo: 'url', videoUrl: 'https://ejemplo.com/clase' }),
    clase(4),                                                     // sin video: un formulario
    clase(5, { videoTipo: 'archivo', videoPath: null }),          // subida que no terminó
    clase(6, { videoTipo: 'youtube', videoUrl: 'javascript:alert(1)' }),
  ];
  assert.deepEqual(videosSinVer(clases, () => 0), [], 'ninguno de estos se le puede pedir como «sin ver»');
});

// ── Qué dice ─────────────────────────────────────────────────────────────────

// El detector de voseo de tests/curso-mensajes.test.ts (una palabra que termina en vocal acentuada
// + s es la forma del voseo; los límites van por Unicode: `\b` en JS es ASCII).
const NEUTRAS = new Set(['más', 'después', 'atrás', 'además', 'demás', 'jamás', 'país', 'interés', 'través', 'estás', 'está',
  'aquí', 'ahí', 'allí', 'acá', 'allá', 'qué', 'sí', 'sé', 'mí', 'tú', 'también', 'quizás', 'adiós',
  // Pretérito de 1ª persona: MaKo le habla a Mauricio en primera persona. Por NOMBRE, de a uno.
  'recordé']);
const CLITICOS = /(?<!\p{L})(fijate|avisame|decime|contame|escribime|mandame|hacelo|miralo|miralos|mirala|velo|sos|vos)(?!\p{L})/iu;
function voseo(texto: string): string[] {
  const out: string[] = [];
  for (const m of texto.matchAll(/\p{L}+/gu)) {
    const w = m[0].toLowerCase();
    if (/[áéí]s?$/.test(w) && !NEUTRAS.has(w)) out.push(m[0]);
  }
  const c = texto.match(CLITICOS);
  if (c) out.push(c[0]);
  return out;
}

test('el detector caza el voseo (si no, el verde de abajo no dice nada)', () => {
  assert.deepEqual(voseo('Tenés 2 videos. Miralos acá'), ['Tenés', 'Miralos']);
  assert.deepEqual(voseo('Tienes 2 videos. Míralos aquí'), []);
});

const LINK = 'https://hola-mako.com/compartido/curso/c1.1.21.3.FIRMA_abc-123';
const NORTE = { etapa: 'Norte', videos: ['Cómo leer tu tablero', 'Tu primera meta'] };

test('al cliente: de TÚ, corto, con SU link entero y los títulos pendientes', () => {
  const t = textoRecordatorioClases({ nombre: 'Ana Ruiz', bloques: [NORTE], link: LINK })!;
  assert.equal(t, `Hola Ana, tienes 2 videos pendientes de *Norte*:\n· Cómo leer tu tablero\n· Tu primera meta\n\nMíralos aquí: ${LINK}`);
  const uno = textoRecordatorioClases({ nombre: null, bloques: [{ etapa: 'Norte', videos: ['Tu primera meta'] }], link: LINK })!;
  assert.equal(uno, `Hola, tienes 1 video pendiente de *Norte*:\n· Tu primera meta\n\nMíralo aquí: ${LINK}`);
  // Con más de 3 títulos, «y N más».
  const muchos = textoRecordatorioClases({ nombre: 'Ana', bloques: [{ etapa: 'Norte', videos: ['a', 'b', 'c', 'd', 'e'] }], link: LINK })!;
  assert.match(muchos, /· c\n· y 2 más\n/);
  assert.equal(TOPE_PENDIENTES, 3);
  // Dos cursos: un bloque por etapa.
  const dos = textoRecordatorioClases({ nombre: 'Ana', bloques: [NORTE, { etapa: 'Bienvenida', videos: ['Hola'] }], link: LINK })!;
  assert.match(dos, /^Hola Ana, tienes 3 videos pendientes:\nDe \*Norte\*:\n· Cómo leer tu tablero\n· Tu primera meta\nDe \*Bienvenida\*:\n· Hola\n\nMíralos aquí: /);
  for (const x of [t, uno, muchos, dos]) {
    assert.deepEqual(voseo(x), [], `voseo en: ${x}`);
    assert.ok(x.includes(LINK), 'sin el link de su portal');
    assert.ok(x.length < 400, `largo: ${x.length}`);
  }
});

test('sin videos pendientes NO se manda nada (null), aunque le toque', () => {
  assert.equal(textoRecordatorioClases({ nombre: 'Ana', bloques: [], link: LINK }), null);
  assert.equal(textoRecordatorioClases({ nombre: 'Ana', bloques: [{ etapa: 'Norte', videos: [] }], link: LINK }), null);
});

test('la copia a Mauricio: a quién se le recordó qué, a quién no le llegó y a quién no se le pudo escribir', () => {
  const t = textoRecordatorioDueno({
    hechos: [
      { cliente: 'Ana Ruiz', bloques: [NORTE], noLlego: null },
      { cliente: 'Luis Paz', bloques: [{ etapa: 'Contexto', videos: ['a', 'b', 'c', 'd'] }], noLlego: null },
      { cliente: 'Eva Sol', bloques: [NORTE], noLlego: 'la línea está desconectada' },
    ],
    sinEscribir: [{ cliente: 'Juan Gil', motivo: 'sin teléfono' }],
  })!;
  assert.equal(t, [
    'Les recordé sus videos pendientes a 2 clientes con 3 días sin entrar:',
    '· *Ana Ruiz* (*Norte*): Cómo leer tu tablero, Tu primera meta',
    '· *Luis Paz* (*Contexto*): a, b, c y 1 más',
    'No le llegó el recordatorio:',
    '· *Eva Sol*: la línea está desconectada',
    'No le pude escribir:',
    '· *Juan Gil*: sin teléfono',
  ].join('\n'));
  const uno = textoRecordatorioDueno({ hechos: [{ cliente: 'Ana Ruiz', bloques: [NORTE], noLlego: null }] })!;
  assert.match(uno, /^Le recordé sus videos pendientes a 1 cliente con 3 días sin entrar:\n/);
  assert.equal(textoRecordatorioDueno({ hechos: [], sinEscribir: [] }), null, 'sin nada que contar, no hay aviso');
  for (const x of [t, uno, TITULO_AVISO_RECORDATORIO]) {
    assert.deepEqual(voseo(x), [], `voseo en: ${x}`);
    assert.ok(!x.includes('compartido/curso'), 'el link del cliente no va a un grupo');
  }
});

test('la clave de la copia lleva los clientes: dos corridas del mismo tick con clientes distintos no se pisan', () => {
  assert.equal(claveAvisoRecordatorio(1, [9, 3, 3], AHORA), 'recordatorio:1:2026-10-12T16:3-9');
  assert.equal(claveAvisoRecordatorio(1, [3, 9], AHORA), claveAvisoRecordatorio(1, [9, 3], AHORA));
  assert.notEqual(claveAvisoRecordatorio(1, [3], AHORA), claveAvisoRecordatorio(1, [9], AHORA));
  assert.notEqual(claveAvisoRecordatorio(1, [3], AHORA), claveAvisoRecordatorio(2, [3], AHORA));
});

test('el catálogo tiene la copia: prendida, con el rótulo de LEAD, y un ejemplo de tú', () => {
  const cat = CATALOGO_AVISOS.find((c) => c.id === 'curso-recordatorio-clases');
  assert.ok(cat, 'falta la entrada: sale con el rótulo SISTEMA y no se puede apagar ni renombrar');
  assert.equal(cat!.porDefecto, 'on', 'sin porDefecto nace APAGADA y a Mauricio no le llega nada');
  assert.equal(areaDeAviso('curso-recordatorio-clases'), 'lead');
  assert.deepEqual(voseo(cat!.ejemplo), [], `voseo en el ejemplo: ${cat!.ejemplo}`);
  // El tipo que emite el cron es el del catálogo.
  assert.match(sinComentarios(leer('lib/curso-mensajes.ts')), /const TIPO_AVISO_RECORDATORIO = 'curso-recordatorio-clases';/);
});

// ── El cron: el orden, la marca, y que nunca crea un acceso ──────────────────

const SRC = sinComentarios(leer('lib/curso-mensajes.ts'));
const bloque = (desde: string, hasta: string) => {
  const ini = SRC.indexOf(desde);
  const fin = SRC.indexOf(hasta, ini + desde.length);
  assert.ok(ini > 0 && fin > ini, `no encontré el bloque «${desde}»`);
  return SRC.slice(ini, fin);
};

test('por cliente: lo que se sabe sin mandar → la marca con compare-and-set → el envío', () => {
  const cuerpo = bloque('async function recordarA(', 'async function recordarEnWorkspace(');
  const orden = [
    'tocaRecordatorio(paraRecordar(f), ahora)',
    'sigueEnElPrograma(estado)',
    'sesionCerca(sesiones, ahora)',
    'await videosPendientesDe(leadId, c.cache)',
    'await destinoDe(leadId, { envioOn: true, sinCrearAcceso: true })',
    'ctl.intentos >= TOPE_RECORDATORIOS_POR_CORRIDA',
    'await marcarRecordatorio(leadId, f.recordatorio_at)',
    'await mandar(d, leadId, texto)',
  ];
  let previo = -1;
  for (const paso of orden) {
    const i = cuerpo.indexOf(paso);
    assert.ok(i > previo, `«${paso}» falta o está fuera de orden`);
    previo = i;
  }
  // Sin videos pendientes no se marca ni se anota: «no manda nada».
  const alDia = cuerpo.slice(cuerpo.indexOf('if (!bloques.length)'), cuerpo.indexOf('return;', cuerpo.indexOf('if (!bloques.length)')));
  assert.doesNotMatch(alDia, /marcarRecordatorio|anotarRecordatorio/);
  // Sin destino (sin teléfono…) se anota y NO se marca: queda esperando a que se arregle.
  const sinDestino = cuerpo.slice(cuerpo.indexOf('if (!d.ok) {'), cuerpo.indexOf('return;', cuerpo.indexOf('if (!d.ok) {')));
  assert.match(sinDestino, /anotarRecordatorio\(leadId, f\.recordatorio_motivo, d\.motivo\)/);
  assert.doesNotMatch(sinDestino, /marcarRecordatorio/);
  // Marcado y falló: no se reintenta ni se desmarca.
  assert.match(cuerpo, /noLlego = 'falló el envío';/);
  assert.doesNotMatch(SRC, /recordatorio_at: null/, 'nadie desmarca un recordatorio ya procesado');
});

test('los mensajes NOMBRAN sólo lo que el alumno puede abrir: candados y permisos, la evaluación del portal (revisión 08/10)', () => {
  // El recordatorio y lo pendiente de una llamada listaban «las clases de su etapa»: con los candados
  // (D2) y los permisos (mig 0219), eso era pedirle ver lo que no puede abrir, o nombrarle un módulo
  // que en el portal no viaja ni el nombre.
  const ab = bloque('async function abiertasDe(', 'async function contenidoDe(');
  assert.match(ab, /await aperturasDelAlumno\(\{ \.\.\.p, alcance: acceso\?\.alcance \?\? null \}\)/, 'la MISMA evaluación que el portal, con sus permisos');
  assert.match(ab, /ap\.clases\.get\(c\.id\)\?\.abierta === true/);
  assert.match(ab, /catch \(e\) \{[\s\S]*return null;/, 'no poder evaluar es no nombrar');
  const videos = bloque('async function videosPendientesDe(', 'async function marcarRecordatorio(');
  assert.match(videos, /const abiertas = await abiertasDe\(/);
  assert.match(videos, /if \(!abiertas\) continue;/);
  assert.match(videos, /videosSinVer\(deLaEtapa\.filter\(\(c\) => abiertas\.has\(c\.id\)\)/);
  const contenido = bloque('async function contenidoDe(', 'type Ctx =');
  assert.match(contenido, /pendientesDe\(deLaEtapa\.filter\(\(c\) => abiertas\.has\(c\.id\)\)/);
  assert.match(contenido, /const pendientes = deLaEtapa\.length && abiertas\s*\?/, 'sin evaluar, `null` (ni «te falta» ni «vas al día»)');
  // 09/10/2026 (mig 0232): y sólo de un curso que su acceso le abre. Una sesión con el producto de un
  // curso al que no se lo invitó no le nombra ninguna clase.
  assert.match(contenido, /const abiertas = deLaEtapa\.length && productos\.includes\(curso\.productoId\)\s*\?/, 'nombra clases de un curso que su acceso no le abre');
});

test('la marca: compare-and-set contra el valor recién leído, y se lee si agarró la fila', () => {
  const m = bloque('async function marcarRecordatorio(', 'async function anotarRecordatorio(');
  assert.match(m, /\.update\(\{ recordatorio_at: /);
  assert.match(m, /\.is\('revocado_at', null\)/, 'un acceso revocado entre la lectura y la marca no se marca');
  assert.match(m, /leido == null \? base\.is\('recordatorio_at', null\) : base\.eq\('recordatorio_at', leido\)/,
    'sin el compare-and-set dos corridas del mismo tick le mandan dos veces');
  assert.match(m, /\.select\('lead_id'\)/, 'sin `.select` no se sabe si la marca agarró la fila');
  assert.match(m, /length > 0/);
});

test('el negocio: horario e interruptor ANTES de leer o escribir nada de un cliente', () => {
  const w = bloque('async function recordarEnWorkspace(', 'export async function correrRecordatoriosDeClases(');
  const iHorario = w.indexOf('if (!enHorarioDeMensajes(ahora, tz))');
  const iFlag = w.indexOf('if (!(await envioWhatsappHabilitado()))');
  const iDb = w.indexOf('await getTenantDb()');
  const iCliente = w.indexOf('await recordarA(');
  assert.ok(iHorario > 0 && iFlag > iHorario && iDb > iFlag && iCliente > iDb, 'el horario y el envío apagado se miran primero');
  // Apagado o fuera de horario: se cuenta y se sale, sin marcar ni avisar.
  for (const i of [iHorario, iFlag]) assert.doesNotMatch(w.slice(i, w.indexOf('return;', i)), /marcar|emitirAviso|mandar\(/);
  // Graduados/bajas y sesiones cerca salen de lecturas del NEGOCIO, adentro del inquilino.
  assert.match(w, /db\.from\('cs_clientes'\)\.select\('lead_id, estado'\)\.in\('lead_id', leadIds\)/);
  assert.match(w, /db\.from\('curso_sesiones'\)\.select\('lead_id, fecha'\)\.in\('lead_id', leadIds\)\.gte\('fecha', v\.desde\)\.lte\('fecha', v\.hasta\)/);
  // UNA copia por corrida a Mauricio, con el tipo del catálogo.
  assert.equal((w.match(/emitirAviso\(/g) ?? []).length, 1);
  assert.match(w, /tipo: TIPO_AVISO_RECORDATORIO/);
  assert.match(w, /dedupKey: claveAvisoRecordatorio\(ws, /);
});

test('el universo: sólo accesos NO revocados, con su acceso dado (mail o link) o que ya entraron; y nunca crea un acceso', () => {
  const correr = bloque('export async function correrRecordatoriosDeClases(', '\n}\n');
  assert.match(correr, /q\.is\('area', null\)\.is\('revocado_at', null\)\.or\('invitacion_enviada_at\.not\.is\.null,link_enviado_at\.not\.is\.null,ingresos\.gt\.0'\)/,
    'la lectura cruzada trae sólo el acceso DEL CLIENTE (no el de un líder, mig 0212) y también al que sólo recibió su link por WhatsApp');
  // Las dos lecturas traen la columna, y la que DECIDE se la pasa a la regla pura.
  assert.match(SRC, /const COLS_ACCESO_CRUZADA = '[^']*\blink_enviado_at\b[^']*';/);
  assert.match(SRC, /const COLS_ACCESO_FRESCA = '[^']*\blink_enviado_at\b[^']*';/);
  assert.match(bloque('const paraRecordar = ', 'function faltaLaMarcaDeRecordatorio('), /linkEnviadoAt: f\.link_enviado_at \?\? null,/);
  assert.match(correr, /runWithWorkspace\(ws, \(\) => recordarEnWorkspace\(/);
  assert.match(correr, /\.filter\(\(w\) => w\.estado === 'activo'\)/, 'un negocio pausado no le escribe a sus clientes');
  // La sección entera: ni `linkDeAcceso` (que CREA la fila) ni inserts.
  const seccion = SRC.slice(SRC.indexOf('const TIPO_AVISO_RECORDATORIO'));
  assert.doesNotMatch(seccion, /linkDeAcceso\(|\.insert\(|\.upsert\(/, 'un mensaje automático no le abre una puerta a nadie');
  // Y el destino, con la opción, firma sobre el acceso que existe.
  const destino = bloque('async function destinoDe(', 'async function mandar(');
  assert.match(destino, /opts\.sinCrearAcceso\s*\? await linkDeAccesoExistente\(leadId, ws\)/);
  const datos = sinComentarios(leer('lib/curso-datos.ts'));
  const existente = datos.slice(datos.indexOf('export async function linkDeAccesoExistente('), datos.indexOf('\n}\n', datos.indexOf('export async function linkDeAccesoExistente(')));
  assert.ok(existente.length > 50, 'falta linkDeAccesoExistente');
  assert.doesNotMatch(existente, /\.insert\(|\.upsert\(|\.update\(/);
  assert.match(existente, /if \(!a \|\| a\.revocado\) return null;/);
});

test('sin la mig 0211 el cron NO se cae: lo dice y el recordatorio no corre', () => {
  const correr = bloque('export async function correrRecordatoriosDeClases(', '\n}\n');
  assert.match(correr, /if \(faltaLaMarcaDeRecordatorio\(msg\(e\)\)\) \{[\s\S]*?res\.sinColumna = true;[\s\S]*?return res;/);
  const mig = leer('supabase/migrations/0211_curso_recordatorio.sql');
  assert.match(mig, /ORDEN DE DESPLIEGUE: ANTES del deploy/);
  assert.match(mig, /alter table curso_accesos add column if not exists recordatorio_at timestamptz;/);
  assert.match(mig, /alter table curso_accesos add column if not exists recordatorio_motivo text;/);
  assert.match(mig, /alter table curso_accesos add column if not exists link_enviado_at timestamptz;/);
  // Sin la columna nueva (una 0211 vieja aplicada) el cron también lo dice en vez de leerlo como caída.
  assert.match(bloque('function faltaLaMarcaDeRecordatorio(', 'const sinTiempo = '), /link_enviado_at/);
});

test('la mig 0211 rellena link_enviado_at con SU link (ws y lead del token), sin pisar y sin tocar las marcas', () => {
  const mig = leer('supabase/migrations/0211_curso_recordatorio.sql');
  const sql = mig.replace(/^--.*$/gm, '');   // sólo el SQL: la cabecera nombra las columnas en prosa
  const backfill = sql.slice(sql.indexOf('with ultimo as ('));
  assert.ok(backfill.length > 100, 'falta el backfill de link_enviado_at');
  // El link es `c1.<ws>.<lead>.<versión>.<firma>`: el punto después del lead es lo que separa el 21 del 210.
  assert.match(backfill, /m\.texto like \('%\/compartido\/curso\/c1\.' \|\| a\.workspace_id::text \|\| '\.' \|\| a\.lead_id::text \|\| '\.%'\)/);
  assert.match(backfill, /on m\.workspace_id = a\.workspace_id/, 'sin el workspace, un link de otro negocio podría anclar a éste');
  assert.match(backfill, /and m\.from_me/, 'sólo lo que SALIÓ de la línea');
  // Sólo llena lo vacío: reaplicarla no pisa un link anotado después por `mandar`.
  assert.equal((backfill.match(/link_enviado_at is null/g) ?? []).length, 2);
  // Las marcas del recordatorio NO se rellenan: NULL es «nunca se le recordó».
  assert.doesNotMatch(sql, /set recordatorio_(at|motivo)/);
});

// ── El link por WhatsApp se anota al salir (revisión del 07/10/2026) ─────────

test('todo WhatsApp del curso con su link anota link_enviado_at, sólo si SALIÓ, y sin poder tirar', () => {
  const m = bloque('async function mandar(', 'async function anotarLinkEnviado(');
  const iFallo = m.indexOf("if (!r.ok) return { ok: false, motivo: r.error?.trim() || 'no salió' };");
  const iAnota = m.indexOf('if (texto.includes(d.link)) await anotarLinkEnviado(leadId);');
  assert.ok(iFallo > 0, 'el envío fallido tiene que volver antes de anotar');
  assert.ok(iAnota > iFallo, 'se anota DESPUÉS de saber que salió, y sólo si el texto llevaba su link');
  // Los cinco mensajes al cliente pasan por `mandar`: ninguno manda por fuera.
  assert.equal((SRC.match(/enviarYEspejar\(/g) ?? []).length, 1, 'un envío por fuera de `mandar` no anotaría el link');
  // La anotación nunca tira (el mensaje ya salió) y escribe sólo la columna del link.
  const a = bloque('async function anotarLinkEnviado(', 'export async function mandarLinkDelCurso(');
  assert.match(a, /^async function anotarLinkEnviado\(leadId: number\): Promise<void> \{\s*try \{/);
  assert.match(a, /\} catch \(e\) \{/);
  assert.match(a, /\.update\(\{ link_enviado_at: new Date\(\)\.toISOString\(\) \}\)\.eq\('lead_id', leadId\)/);
});

// ── El reloj: el último recordatorio arranca con tiempo para la copia (revisión del 07/10/2026) ──

test('el reloj: el último recordatorio arranca con tiempo para terminar y para la copia a Mauricio', () => {
  const ruta = sinComentarios(leer('app/api/cron/curso-sesiones/route.ts'));
  const maxDuracion = Number(ruta.match(/export const maxDuration = (\d+);/)?.[1]);
  assert.ok(maxDuracion > 0, 'no encontré el maxDuration del cron');
  // Los topes REALES de los dos pedidos a Evolution: el envío al cliente y la copia al grupo.
  const evo = sinComentarios(leer('lib/evolution.ts'));
  const evFetch = evo.slice(evo.indexOf('async function evFetch'), evo.indexOf('\n}\n', evo.indexOf('async function evFetch')));
  const topeEnvio = Number(evFetch.match(/AbortSignal\.timeout\(topeMs \?\? (\d+)\)/)?.[1]);
  const grupo = sinComentarios(leer('lib/mako-grupo.ts'));
  const ev = grupo.slice(grupo.indexOf('async function ev('), grupo.indexOf('\n}\n', grupo.indexOf('async function ev(')));
  const topeGrupo = Number(ev.match(/AbortSignal\.timeout\((\d+)\)/)?.[1]);
  assert.ok(topeEnvio > 0 && topeGrupo > 0, 'cambió cómo se topa un pedido a Evolution: hay que volver a medir la reserva');
  assert.ok(TOPE_PEDIDO_EVOLUTION_MS >= Math.max(topeEnvio, topeGrupo), `la reserva cuenta ${TOPE_PEDIDO_EVOLUTION_MS} y Evolution puede tardar ${Math.max(topeEnvio, topeGrupo)}`);
  assert.ok(RESERVA_RECORDATORIO_MS > topeEnvio, 'un recordatorio entero es su envío más la marca, el espejo y el motivo');
  assert.ok(RESERVA_COPIA_MS > topeGrupo, 'la copia es el grupo más el mail y el feed');
  // Lo que se EJECUTA: un envío que arranca en el último momento más la copia entran antes del corte.
  const inicio = 1_000_000;
  const ultimo = ultimoInicioDeRecordatorio(inicio, maxDuracion);
  assert.ok(ultimo + topeEnvio + topeGrupo <= inicio + maxDuracion * 1000 - MARGEN_CIERRE_MS,
    `el último envío arranca a +${(ultimo - inicio) / 1000} s y con la copia puede pasar los ${maxDuracion} s`);
  assert.ok(ultimo > inicio, 'con este maxDuration no queda tiempo para ningún recordatorio');
  assert.equal(ultimo - inicio, 40_000, 'con 120 s: 120 − 35 − 40 − 5');
  // Y el cron le pasa ESE reloj, armado con su propio maxDuration (no un número suelto).
  assert.match(ruta, /correrRecordatoriosDeClases\(new Date\(\), \{ hastaMs: ultimoInicioDeRecordatorio\(inicio, maxDuration\) \}\)/);
});

test('el reloj se mira antes de cada negocio, antes de cada cliente y antes de cada marca', () => {
  assert.match(SRC, /const sinTiempo = \(ctl: ControlCorrida\): boolean => Date\.now\(\) > ctl\.hastaMs;/);
  const w = bloque('async function recordarEnWorkspace(', 'export async function correrRecordatoriosDeClases(');
  const bucle = w.slice(w.indexOf('for (const leadId of leadIds) {'), w.indexOf('await recordarA('));
  assert.match(bucle, /if \(sinTiempo\(ctl\)\) res\.topeAlcanzado = true;\s*if \(res\.topeAlcanzado\) break;/,
    'sin tiempo no se empiezan las lecturas de otro cliente: lo que queda es de la copia');
  const correr = bloque('export async function correrRecordatoriosDeClases(', '\n}\n');
  const porNegocio = correr.slice(correr.indexOf('for (const [ws, leadIds] of porWs) {'), correr.indexOf('runWithWorkspace(ws, () => recordarEnWorkspace('));
  assert.match(porNegocio, /if \(sinTiempo\(ctl\)\) res\.topeAlcanzado = true;\s*if \(res\.topeAlcanzado\) break;/);
  const cliente = bloque('async function recordarA(', 'async function recordarEnWorkspace(');
  const iReloj = cliente.indexOf('ctl.intentos >= TOPE_RECORDATORIOS_POR_CORRIDA || sinTiempo(ctl)');
  assert.ok(iReloj > 0 && iReloj < cliente.indexOf('await marcarRecordatorio('), 'el reloj va antes de la marca');
  // La copia sigue saliendo DESPUÉS del bucle aunque se haya cortado por tiempo: es lo que se protege.
  assert.ok(w.indexOf('emitirAviso(') > w.indexOf('for (const leadId of leadIds) {'));
});

// ── Sólo el cron lo dispara ──────────────────────────────────────────────────

/** Los .ts/.tsx de app/ y lib/ EN DISCO (no `git ls-files`, que no ve un archivo nuevo sin stagear). */
function fuentes(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(join(RAIZ, dir))) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const r = `${dir}/${n}`;
    if (statSync(join(RAIZ, r)).isDirectory()) fuentes(r, out);
    else if (/\.(ts|tsx)$/.test(n)) out.push(r);
  }
  return out;
}

test('el cron horario lo llama, DESPUÉS de las llamadas y con un tope de tiempo; y nadie más lo llama', () => {
  const ruta = 'app/api/cron/curso-sesiones/route.ts';
  assert.ok(existsSync(join(RAIZ, ruta)));
  const r = sinComentarios(leer(ruta));
  assert.match(r, /checkCronAuth\(req\)/);
  const iSes = r.indexOf('await correrAvisosDeSesiones(');
  const iRec = r.indexOf('await correrRecordatoriosDeClases(new Date(), { hastaMs: ultimoInicioDeRecordatorio(inicio, maxDuration) })');
  assert.ok(iSes > 0 && iRec > iSes, 'el recordatorio va después de las llamadas, con su presupuesto de tiempo');
  assert.match(r, /recordatorios: rc/, 'el resultado viaja en la respuesta del cron');
  // Nadie más: ni una pantalla, ni una action, ni otra ruta (un deploy no dispara nada).
  const llaman = [...fuentes('app'), ...fuentes('lib')]
    .filter((f) => /correrRecordatoriosDeClases/.test(sinComentarios(leer(f))))
    .sort();
  assert.deepEqual(llaman, ['app/api/cron/curso-sesiones/route.ts', 'lib/curso-mensajes.ts']);
  // Y vercel.json sigue corriendo ese cron cada hora.
  const v = JSON.parse(leer('vercel.json')) as { crons: Array<{ path: string; schedule: string }> };
  assert.match(v.crons.find((c) => c.path === '/api/cron/curso-sesiones')?.schedule ?? '', /^\d{1,2} \* \* \* \*$/);
});

// PROBADO ROMPIÉNDOLO (07/10/2026), con un arnés que rompe UNA cosa por vez y restaura de memoria
// (md5 de los cinco fuentes igual antes y después; nunca `git checkout`). Corre este archivo junto
// con tests/curso-mensajes.test.ts — baseline de los dos: 60 pass / 0 fail. Cada rotura, y lo que cae:
//   1. el borde de los 3 días con `<=` → 58/2: «nunca entró…» y «ya entró…».
//   2. el ancla = la más VIEJA (`Math.min`) → 59/1: «ya entró: cuenta desde su ÚLTIMO ingreso».
//   3. sin «uno cada 3 días» → 59/1.      4. el universo sin mirar `revocado` → 59/1.
//   5. una marca ilegible autoriza a mandar → 59/1 («fail-closed»).
//   6. la sesión cerca sólo hacia adelante → 59/1.   7. el programa en NEGATIVO (pausado pasa) → 59/1.
//   8. «sin medir» cuenta como no visto → 59/1.      9. el umbral exacto como no visto → 59/1.
//   10. «Miralos acá» en el texto al cliente → 59/1 (el voseo).
//   11. sin videos pendientes igual arma un mensaje → 59/1.   12. la clave sin los clientes → 59/1.
//   13. sin teléfono MARCA → 59/1.   14. la marca sin compare-and-set → 59/1.
//   15. sin el horario del negocio → 59/1.   16. el destino con `linkDeAcceso` (CREA el acceso) → 59/1.
//   17. la lectura cruzada trae revocados → 59/1.   18. el cron no lo llama → 59/1.
//   19. un archivo nuevo en app/ que lo llama → 59/1 («y nadie más lo llama»).
//   20. la copia sin `porDefecto: 'on'` (nace apagada) → 59/1.
//   21. una tercera lectura sin inquilino → 59/1 (el guard de tests/curso-mensajes.test.ts).
//   22. la copia sin «No le pude escribir» → 59/1.   23. sin destino no anota el motivo → 59/1.
//   24. no saltea a quien tiene una sesión cerca → 59/1.   25. le escribe a graduados y bajas → 59/1.
//
// Y LA REVISIÓN DEL 07/10/2026 (el link por WhatsApp y el reloj de la copia), con el mismo arnés:
// baseline 65 pass / 0 fail, md5 de los cinco fuentes igual antes y después. Veinte roturas:
//   A. el ancla sin el link → 64/1.   B. el universo sin el link → 64/1 (los dos: «el link por WhatsApp cuenta»).
//   C. la lectura cruzada sin `link_enviado_at` → 64/1.   D. la lectura fresca sin la columna → 64/1.
//   E. `paraRecordar` no pasa el link → 64/1 (los tres: «el universo…»).
//   F. `sinColumna` no reconoce la columna nueva → 64/1.   J. la mig sin la columna → 64/1 («sin la mig 0211…»).
//   G. anota aunque el envío falle → 64/1.   H. anota sin mirar si el texto lleva el link → 64/1.
//   I. la anotación sin `try` → 64/1.   T. un `enviarYEspejar` por fuera de `mandar` → 64/1 («todo WhatsApp…»).
//   K. el backfill sin el punto después del lead (el 21 matchea al 210) → 64/1.
//   L. el backfill pisa lo ya anotado → 64/1 («la mig 0211 rellena…»).
//   M. el reloj sin reservar la copia → 64/1.   O. la reserva cuenta 20 s por pedido → 64/1.
//   P. Evolution sube su tope a 45 s (lib/evolution.ts) → 64/1 («el reloj: el último recordatorio…»).
//   N. el cron vuelve a 90 s sueltos → 63/2 (ése y «el cron horario lo llama…»).
//   Q. sin reloj antes de cada cliente → 64/1.   R. sin reloj antes de cada negocio → 64/1.
//   S. la marca sin mirar el reloj → 64/1 («el reloj se mira antes de cada negocio…»).
// REVISIÓN del 08/10/2026 (los candados y los permisos, scratchpad/rev-nucleo/romper-final.mjs,
// restaurado de memoria). Sin romper, este archivo solo: 27 / 0. Cada una dio 26 / 1 en «los mensajes
// NOMBRAN sólo lo que el alumno puede abrir…»: el recordatorio con los videos de la etapa sin filtrar ·
// lo pendiente de una llamada sin filtrar · `abiertasDe` nombrando todo cuando no pudo evaluar.

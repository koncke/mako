// =============================================================================
// El CRON de un mensaje: la próxima vez, sin deriva y sin mandar de más
// =============================================================================
// Todo lo que se persigue acá falla EN SILENCIO: un horario que se corre de a
// siete minutos por semana, un mensaje que sale doce veces al volver el cron, una
// hora que se mueve sola dos veces por año con el horario de verano. Ninguno da
// error y ninguno se reporta — se descubre meses después como «esto llega a
// cualquier hora».
//
// Correr: npm test
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  sanearCron, textoCron, partesEn, instanteDe, proximaOcurrencia,
  UNIDADES, CADA_MAX, DIA_MES_MAX, motivoNoAgendable, TEXTO_NO_AGENDABLE, type CronAviso,
} from '../lib/cron-aviso';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
/** ⚠️ SIN COMENTARIOS. Un guard que busca el nombre de lo que NO tiene que estar se
 *  acusa a sí mismo por el comentario que explica por qué no está: acá el de
 *  `enviarAlGrupoMaKo`, que el módulo nombra tres veces en prosa. Ya pasó dos veces
 *  en este repo (el `envioEmailHabilitado` de avisos.ts y el `setState` de lienzo).
 */
const sinComentarios = (src: string): string =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const AR = 'America/Argentina/Buenos_Aires';   // sin horario de verano
const NY = 'America/New_York';                 // con horario de verano
const cron = (p: Partial<CronAviso> = {}): CronAviso =>
  sanearCron({ unidad: 'dia', cada: 1, hora: 9, minuto: 0, ...p })!;

// ── saneo ───────────────────────────────────────────────────────────────────

test('El saneo rechaza lo que no es una unidad y completa el resto', () => {
  assert.equal(sanearCron(null), null);
  assert.equal(sanearCron({ unidad: 'quincena' }), null);
  const c = sanearCron({ unidad: 'semana' })!;
  assert.deepEqual(c, { unidad: 'semana', cada: 1, hora: 9, minuto: 0, diaSemana: 1 });
});

test('Los topes existen para que nadie agende en el año 3000', () => {
  assert.equal(sanearCron({ unidad: 'dia', cada: 999999 })!.cada, 1);
  assert.equal(sanearCron({ unidad: 'dia', cada: CADA_MAX })!.cada, CADA_MAX);
  assert.equal(sanearCron({ unidad: 'dia', hora: 99 })!.hora, 9);
  // ⚠️ El día 31 no existe en febrero, y las dos salidas posibles son decisiones
  // que nadie tomó. 28 sale todos los meses.
  assert.equal(sanearCron({ unidad: 'mes', diaMes: 31 })!.diaMes, 1);
  assert.equal(sanearCron({ unidad: 'mes', diaMes: DIA_MES_MAX })!.diaMes, DIA_MES_MAX);
});

test('Un cambio de unidad no tira los campos de la otra', () => {
  // La pantalla cambia la unidad con los otros valores puestos: si el saneo
  // rechazara el objeto, elegir «mes» borraría la hora que la persona eligió.
  const c = sanearCron({ unidad: 'mes', cada: 2, hora: 18, minuto: 30, diaSemana: 5, diaMes: 10 })!;
  assert.equal(c.hora, 18);
  assert.equal(c.diaMes, 10);
  assert.equal(c.diaSemana, undefined, 'el día de la semana no es de un cron mensual');
});

test('Las cinco unidades del pedido están, con ese nombre', () => {
  // «1 vez a la semana, al mes, al año, diariamente... Cada X horas»
  assert.deepEqual(UNIDADES.map((u) => u.key), ['hora', 'dia', 'semana', 'mes', 'anio']);
});

// ── el texto dice la ZONA ───────────────────────────────────────────────────

test('⚠️ El texto nombra la ZONA, porque «a la mañana» no se verificó', () => {
  // Medido el 30/09/2026: 6 de los 10 workspaces activos no tienen `mako.timezone`
  // y caen a America/Tijuana. Decir la zona deja que el dueño vea si está mal.
  assert.match(textoCron(cron({ unidad: 'semana', diaSemana: 1 }), AR), /lunes a las 09:00 de America\/Argentina\/Buenos_Aires/);
  assert.equal(textoCron(cron({ unidad: 'dia' }), AR), 'Todos los días a las 09:00 de ' + AR);
  assert.equal(textoCron(cron({ unidad: 'dia', cada: 3 }), AR), 'Cada 3 días a las 09:00 de ' + AR);
  // «Cada hora» NO lleva hora de pared: ahí no la decide nadie.
  assert.equal(textoCron(cron({ unidad: 'hora', cada: 6 }), AR), 'Cada 6 horas');
});

// ── hora de pared ↔ instante ────────────────────────────────────────────────

test('La hora de pared se convierte y se vuelve a leer igual', () => {
  const d = instanteDe(AR, 2026, 10, 5, 9, 0);
  const p = partesEn(AR, d);
  assert.deepEqual([p.y, p.m, p.d, p.h, p.min], [2026, 10, 5, 9, 0]);
  assert.equal(p.dow, 1, '5/10/2026 es lunes');
});

test('⚠️ EL DÍA DEL CAMBIO DE HORA: las 9 siguen siendo las 9', () => {
  // Acá está la razón de las DOS pasadas de corrección, y la primera versión de
  // este test no la veía: probaba el 15/7 y el 15/12, lejos del salto, donde una
  // sola pasada también acierta. Lo encontró un barrido de fuerza bruta sobre 11
  // zonas × 366 días × 7 horas: **49 casos de 28.182 difieren**, y uno de ellos es
  // `America/Tijuana` el 8/3 a las 9:00 — la zona POR DEFECTO de este repo y la
  // hora típica de un aviso diario. Con una sola pasada ese día el mensaje sale a
  // las 10, sin un solo error.
  const casos: Array<[string, number, number, number]> = [
    ['America/Tijuana', 3, 8, 9],     // el caso que importa: zona default, hora default
    ['America/Tijuana', 11, 1, 2],
    [NY, 11, 1, 2],
    [NY, 11, 1, 3],
    [NY, 7, 15, 9],                   // y lejos del salto sigue andando
    [NY, 12, 15, 9],
  ];
  for (const [tz, mes, dia, hora] of casos) {
    const p = partesEn(tz, instanteDe(tz, 2026, mes, dia, hora, 0));
    assert.deepEqual([p.m, p.d, p.h, p.min], [mes, dia, hora, 0], `${tz} ${dia}/${mes} ${hora}h`);
  }
});

test('La medianoche es la hora 0 y el día no se corre', () => {
  // ⚠️ El `% 24` de `partesEn` es DEFENSIVO y no se puede medir acá: el ICU de este
  // Node ya devuelve «00». Probado quitándolo: los 17 tests siguen en verde. Se deja
  // porque `hour12: false` devuelve «24» en otros ICU y ahí la medianoche se leería
  // como el final del día anterior — pero el comentario no puede afirmar que pase,
  // porque no lo vi pasar.
  const p = partesEn(AR, instanteDe(AR, 2026, 10, 5, 0, 0));
  assert.deepEqual([p.h, p.d], [0, 5]);
});

// ── la próxima ocurrencia ───────────────────────────────────────────────────

const enAR = (y: number, m: number, d: number, h: number, min = 0) => instanteDe(AR, y, m, d, h, min);

test('Diario: el siguiente día a la MISMA hora', () => {
  const ahora = enAR(2026, 10, 5, 10, 30);          // lunes, ya pasaron las 9
  const prox = proximaOcurrencia(cron({ unidad: 'dia' }), enAR(2026, 10, 5, 9), AR, ahora);
  const p = partesEn(AR, prox);
  assert.deepEqual([p.d, p.h, p.min], [6, 9, 0]);
});

test('⚠️ NO HAY DERIVA: la próxima se ancla en la AGENDADA, no en cuándo salió', () => {
  // Es la trampa que las insistencias ya pagaron: `desde + cadaMin` con
  // `desde = ahora` hace que un mensaje de los lunes a las 9 que sale 9:07 agende
  // el lunes siguiente 9:07, después 9:14, y así para siempre.
  let agendada = enAR(2026, 10, 5, 9);
  for (let i = 0; i < 8; i++) {
    const salioTarde = new Date(agendada.getTime() + 7 * 60_000 + 40_000);   // 7m40s tarde
    agendada = proximaOcurrencia(cron({ unidad: 'semana', diaSemana: 1 }), agendada, AR, salioTarde);
    const p = partesEn(AR, agendada);
    assert.deepEqual([p.h, p.min, p.dow], [9, 0, 1], `vuelta ${i + 1}: se corrió el horario`);
  }
  const p = partesEn(AR, agendada);
  assert.deepEqual([p.m, p.d], [11, 30], 'ocho lunes después del 5/10 es el 30/11');
});

test('⚠️ Y el ancla se NOTA cuando el cron estuvo caído: la grilla no se reinicia', () => {
  // La vuelta de arriba no alcanzaba para ver la rotura: con un semanal, el día de
  // la semana y la hora vuelven a fijar el instante, así que anclarse en `ahora`
  // daba el mismo resultado y el test pasaba en VERDE con el bug puesto. Lo que lo
  // distingue es una grilla que NO se puede reconstruir desde hoy: cada 3 días.
  const anterior = enAR(2026, 10, 5, 9);            // la grilla es 5, 8, 11, 14…
  const ahora = enAR(2026, 10, 12, 10);             // una semana sin tick
  const prox = proximaOcurrencia(cron({ unidad: 'dia', cada: 3 }), anterior, AR, ahora);
  const p = partesEn(AR, prox);
  assert.deepEqual([p.m, p.d, p.h], [10, 14, 9], 'se reinició la grilla en el día de hoy');
});

test('⚠️ Con el cron caído manda UNO, no los doce perdidos', () => {
  // «Cada 2 horas» con un día de caída: la grilla se respeta y las perdidas se
  // saltean. Mandarlas todas sería doce mensajes de golpe.
  const anterior = new Date('2026-10-05T12:00:00.000Z');
  const ahora = new Date('2026-10-06T12:00:00.000Z');   // 24 h después
  const prox = proximaOcurrencia(cron({ unidad: 'hora', cada: 2 }), anterior, AR, ahora);
  assert.ok(prox.getTime() > ahora.getTime(), 'agendó en el pasado: un envío por tick para siempre');
  assert.equal(prox.toISOString(), '2026-10-06T14:00:00.000Z', 'se salió de la grilla de las pares');
});

test('Semanal: se planta en el día pedido y avanza semanas enteras', () => {
  // Desde un lunes, un «todos los viernes» tiene que dar el viernes de ESA semana,
  // no el de la que viene. Sumar semanas antes de buscar el día lo corre una.
  const ahora = enAR(2026, 10, 5, 10);              // lunes 5/10
  const prox = proximaOcurrencia(cron({ unidad: 'semana', diaSemana: 5 }), enAR(2026, 10, 5, 9), AR, ahora);
  const p = partesEn(AR, prox);
  assert.deepEqual([p.d, p.dow, p.h], [9, 5, 9], 'el viernes 9/10 a las 9');
});

test('Cada 2 semanas: no se saltea una de más', () => {
  const ahora = enAR(2026, 10, 5, 10);
  const prox = proximaOcurrencia(cron({ unidad: 'semana', cada: 2, diaSemana: 1 }), enAR(2026, 10, 5, 9), AR, ahora);
  const p = partesEn(AR, prox);
  assert.deepEqual([p.m, p.d], [10, 19], 'dos semanas después del 5/10 es el 19/10');
});

test('Mensual: el mismo día del mes que viene', () => {
  const ahora = enAR(2026, 10, 15, 10);
  const prox = proximaOcurrencia(cron({ unidad: 'mes', diaMes: 15 }), enAR(2026, 10, 15, 9), AR, ahora);
  const p = partesEn(AR, prox);
  assert.deepEqual([p.m, p.d, p.h], [11, 15, 9]);
});

test('Anual: el mismo día y mes del año que viene', () => {
  const ahora = enAR(2026, 3, 1, 10);
  const prox = proximaOcurrencia(cron({ unidad: 'anio', mes: 3, diaMes: 1 }), enAR(2026, 3, 1, 9), AR, ahora);
  const p = partesEn(AR, prox);
  assert.deepEqual([p.y, p.m, p.d], [2027, 3, 1]);
});

test('⚠️ La próxima NUNCA cae en el pasado', () => {
  // Una fila con `proxima_at` en el pasado la manda el drenador en CADA tick: es
  // un mensaje cada diez minutos hasta que alguien lo apague.
  const ahora = new Date('2026-10-05T12:00:00.000Z');
  for (const u of UNIDADES) {
    for (const cada of [1, 3, 99]) {
      const c = sanearCron({ unidad: u.key, cada, hora: 9, minuto: 0 })!;
      const prox = proximaOcurrencia(c, new Date('2020-01-01T00:00:00.000Z'), AR, ahora);
      assert.ok(prox.getTime() > ahora.getTime(), `${u.key} cada ${cada} agendó en el pasado`);
    }
  }
});

test('Y la hora de pared se respeta también cruzando el horario de verano', () => {
  // Un diario a las 9 en Nueva York, arrancando antes del cambio del 1/11/2026:
  // las 9 siguen siendo las 9 del otro lado.
  let agendada = instanteDe(NY, 2026, 10, 30, 9, 0);
  const vistas: number[] = [];
  for (let i = 0; i < 5; i++) {
    agendada = proximaOcurrencia(cron({ unidad: 'dia' }), agendada, NY, new Date(agendada.getTime() + 60_000));
    vistas.push(partesEn(NY, agendada).h);
  }
  assert.deepEqual(vistas, [9, 9, 9, 9, 9], 'el horario de verano movió la hora de pared');
});

// ──────────────────────────────────────────────────────────────────────────
// EL DRENADOR: lo que falla en silencio
// ──────────────────────────────────────────────────────────────────────────

test('⚠️ AVANZA EL HORARIO ANTES DE MANDAR, con compare-and-set', () => {
  // Al revés, dos invocaciones del mismo tick —un reintento de Vercel, o un tick
  // que tarda más que el intervalo y se solapa con el siguiente— mandan DOS veces.
  // El precedente está medido en esta casa: 21 pares duplicados el 27/09 sobre
  // `mako_doer_conv`, por los 7-10 s que el envío por WhatsApp retiene el HTTP
  // abierto entre la lectura y la marca.
  //
  // Y el reclamo que YA existía no cubre esto: `reclamarEspaciado` cuelga de un
  // `if (minutos && …)` y está medido que `frecuenciaMin` es 0 en los 108 avisos
  // activos de los 10 workspaces — o sea que hoy no reclama nada.
  const src = leer('../lib/avisos-programados.ts');
  const cuerpo = src.slice(src.indexOf('export async function drenarProgramados'));
  const iUpdate = cuerpo.indexOf(".update({");
  const iEmitir = cuerpo.indexOf('emitirAviso(');
  assert.ok(iUpdate > 0 && iEmitir > iUpdate, 'el drenador manda antes de reclamar: dos ticks duplican');
  assert.match(cuerpo, /\.eq\('proxima_at', f\.proxima_at\)/,
    'se fue el compare-and-set: sin él, dos ticks a la vez mandan los dos');
});

test('⚠️ SALE POR `emitirAviso`, no por el grupo directo', () => {
  // Es la diferencia entre un mensaje del producto y uno que se saltea todo:
  // `emitirAviso` mira el interruptor, respeta los canales elegidos, deja la entrada
  // en el feed y abre las insistencias. `enviarAlGrupoMaKo` no hace ninguna de las
  // cuatro — es correcto para una INSISTENCIA (ya salió una vez por el camino bueno)
  // y sería un agujero acá: un aviso programado que el negocio apagó tiene que dejar
  // de salir.
  const src = sinComentarios(leer('../lib/avisos-programados.ts'));
  assert.match(src, /emitirAviso\(/, 'el drenador dejó de salir por el choke point');
  assert.ok(!/enviarAlGrupoMaKo/.test(src), 'se saltea el interruptor y los canales');
  assert.match(src, /plantillaActiva\(/, 'dejó de mirar el interruptor');
});

test('⚠️ El interruptor se mira DESPUÉS de reclamar', () => {
  // Si se mira antes y está apagado, la fila queda vencida y el drenador la vuelve a
  // leer en CADA tick, para siempre. Reclamar primero avanza el horario igual y
  // simplemente no manda.
  const src = leer('../lib/avisos-programados.ts');
  const cuerpo = src.slice(src.indexOf('export async function drenarProgramados'));
  assert.ok(cuerpo.indexOf('plantillaActiva(') > cuerpo.indexOf('.update({'),
    'un aviso apagado deja su fila vencida y se relee en cada tick');
});

test('⚠️ La ZONA se congela en la fila, no se resuelve por tick', () => {
  // `tzDeWorkspace` sale a la red (Cal.com, Google Calendar) con una carrera de 4 s y,
  // si no llega, devuelve America/Tijuana sin guardarla. Resolverla en cada tick
  // serían 6 × 4 s del presupuesto del tick (los seis workspaces activos sin
  // `mako.timezone`, medido el 30/09) — y, peor, dejaría que el horario de un mensaje
  // se mueva solo el día que la averiguación conteste otra cosa.
  const src = leer('../lib/avisos-programados.ts');
  const set = src.slice(src.indexOf('export async function setProgramado'), src.indexOf('export async function drenarProgramados'));
  const dren = src.slice(src.indexOf('export async function drenarProgramados'));
  assert.match(set, /tzDeWorkspace\(/, 'el agendado dejó de resolver la zona');
  assert.ok(!/tzDeWorkspace/.test(dren), 'el drenador volvió a resolver la zona por tick');
  assert.match(dren, /f\.tz/, 'el drenador dejó de usar la zona congelada');
});

test('⚠️ El ancla del drenador es `proxima_at`, no `ahora`', () => {
  // Es la deriva otra vez, del lado del server: anclar en `ahora` corre el horario
  // siete minutos por semana y nadie lo reporta.
  const src = leer('../lib/avisos-programados.ts');
  assert.match(src, /proximaOcurrencia\(cron, new Date\(f\.proxima_at\)/,
    'el drenador calcula la próxima desde `ahora`: vuelve la deriva');
  assert.match(src, /anterior_at: f\.proxima_at/, 'el ancla guardada dejó de ser la ocurrencia agendada');
});

test('El agendado tiene su TABLA y su CRON registrado', () => {
  // Una pantalla que guarda un horario sin nadie que lo drene es el control que se
  // dibuja y no manda nada — y es INVISIBLE: no hay ninguna pantalla que diga «este
  // mensaje tenía que salir el lunes y no salió», así que el silencio se lee como
  // «esta semana no hubo nada que avisar».
  const mig = leer('../supabase/migrations/0183_avisos_programados.sql');
  assert.match(mig, /create table if not exists avisos_programados/);
  assert.match(mig, /unique \(workspace_id, aviso_id\)/, 'un mensaje tendría dos horarios');
  assert.match(mig, /enable row level security/, 'la tabla quedó abierta a la key anónima');
  const vercel = JSON.parse(leer('../vercel.json')) as { crons: Array<{ path: string; schedule: string }> };
  const cron = vercel.crons.find((c) => c.path === '/api/cron/avisos-programados');
  assert.ok(cron, 'la tabla existe y nadie la drena');
  assert.equal(cron!.schedule, '*/10 * * * *');
  // Y la ruta del cron existe de verdad, no sólo su fila en el json.
  assert.match(leer('../app/api/cron/avisos-programados/route.ts'), /drenarProgramados\(/);
});

test('⚠️ TIEMPO y ACCIÓN no se pueden editar los dos a la vez', () => {
  // «No deben poder editarse los 2 al mismo tiempo, primero se selecciona tiempo o
  // acción y luego se selecciona el desplegable.» Elegir uno APAGA el otro, y eso es
  // una escritura —no un `disabled`—, porque las dos mitades viven en lugares
  // distintos (el evento en el store del flujo, el cron en su tabla).
  const src = leer('../app/agencia/FlujoAviso.tsx');
  // ⚠️ El corte va hasta el `};` de la propia función: `src.indexOf('return (')`
  // encuentra el PRIMER return del archivo, que está 200 líneas antes, y deja el
  // slice vacío — o sea un guard que pasa sin mirar nada.
  const desde = src.indexOf('const elegir =');
  const elegir = src.slice(desde, src.indexOf('};', desde));
  assert.match(elegir, /disparador: \{ tipo: 'manual' \}/, 'elegir TIEMPO dejó de apagar la acción');
  assert.match(elegir, /onCron\(null\)/, 'elegir ACCIÓN dejó de apagar el tiempo');
});

// ── EL TEXTO DE EJEMPLO NO SALE POR TIEMPO ──────────────────────────────────

test('⚠️ EL TEXTO DE EJEMPLO NO SE AGENDA: es dato de muestra, no un mensaje', () => {
  // Medido el 06/10/2026: un «Por tiempo» sobre `reunion-recordatorio` le mandó al grupo
  // de Leila, cuatro días a las 9:00, el EJEMPLO del catálogo — un recordatorio de
  // reunión con un lead real de otro cliente. Por tiempo sale el texto tal cual, y para
  // un mensaje que nadie reescribió ese texto es el molde con datos de muestra.
  //
  // PROBADO ROMPIÉNDOLO: con `motivoNoAgendable` devolviendo siempre null → pass 27 ·
  // fail 1 (este test). Restaurado → 28 en verde.
  const EJ = 'En 30 min tienes la *R2* con *Laura Gil*.';
  assert.equal(motivoNoAgendable(EJ, EJ), 'ejemplo', 'el ejemplo de fábrica pasó como agendable');
  assert.equal(motivoNoAgendable(`  ${EJ}\n`, EJ), 'ejemplo', 'un espacio de más lo hizo pasar');
  assert.equal(motivoNoAgendable('   ', EJ), 'sin-texto', 'un texto vacío se agendó');
  assert.equal(motivoNoAgendable('Revisa tu agenda de hoy.', EJ), null, 'un texto propio dejó de poder agendarse');
  // Una plantilla propia no tiene ejemplo de fábrica: su texto lo escribió alguien.
  assert.equal(motivoNoAgendable('Carga los gastos del mes.', null), null, 'una plantilla propia dejó de poder agendarse');
  for (const t of Object.values(TEXTO_NO_AGENDABLE)) assert.ok(t.length <= 60, `el motivo en pantalla es largo: «${t}»`);
});

test('⚠️ LAS DOS PUNTAS PREGUNTAN: el que agenda se niega y el que manda no manda', () => {
  // Agendar mira el texto PUBLICADO al guardar el horario; mandar lo vuelve a mirar en
  // cada tick, porque el texto puede volver al de fábrica DESPUÉS (alguien lo restaura).
  // Y el drenador pregunta sobre la MISMA variable que manda: si la guarda mirara una
  // lectura y el envío otra, podrían contestar distinto.
  //
  // PROBADO ROMPIÉNDOLO, de a una: el `if (motivo)` del drenador apagado, el `throw new
  // NoAgendable` de `setProgramado` sacado, y `referenciaPlantilla(...)` mandado en vez de
  // `crudo` → las tres dan pass 27 · fail 1 (este test).
  const src = sinComentarios(leer('../lib/avisos-programados.ts'));
  const dren = src.slice(src.indexOf('export async function drenarProgramados'));
  const iGuarda = dren.indexOf('if (motivo)');
  assert.ok(iGuarda > 0 && iGuarda < dren.indexOf('emitirAviso('), 'el drenador manda sin preguntar si es el ejemplo');
  assert.match(dren, /motivoNoAgendable\(crudo,/, 'la guarda dejó de mirar el texto que se manda');
  assert.match(dren, /conVariables\(crudo,/, 'lo que se manda dejó de ser lo que la guarda miró');
  assert.ok(!/referenciaPlantilla/.test(src), 'volvió una segunda lectura del texto, aparte de la guarda');

  const set = src.slice(src.indexOf('export async function setProgramado'), src.indexOf('export async function drenarProgramados'));
  const iNiega = set.indexOf('throw new NoAgendable');
  assert.ok(iNiega > 0 && iNiega < set.indexOf('.upsert('), 'el agendado guarda el horario sin mirar el texto');
  // Y desagendar NO pasa por la guarda: sacar un horario tiene que andar siempre.
  assert.ok(set.indexOf(".delete()") < iNiega, 'desagendar quedó detrás de la guarda');
});

test('Las dos rutas contestan la negativa como un 400 con el motivo', () => {
  // Sin esto, la de la agencia (que no tiene un try afuera) devolvía el 500 de Next en
  // HTML y la pantalla mostraba un error de JSON en vez del motivo.
  //
  // PROBADO ROMPIÉNDOLO: la ruta de la agencia sin el `instanceof NoAgendable`, y la
  // pantalla sin el `setIntencion(null)` → las dos dan pass 27 · fail 1 (este test).
  for (const r of ['../app/api/admin/plantillas/route.ts', '../app/api/perfil/plantillas/route.ts']) {
    const src = sinComentarios(leer(r));
    const caso = src.slice(src.indexOf("case 'cron-set'"), src.indexOf("case 'acuses-"));
    assert.match(caso, /instanceof NoAgendable/, `${r} no distingue la negativa`);
    assert.match(caso, /status: 400/, `${r} contesta la negativa con otro código`);
  }
  // Y la pantalla vuelve atrás la intención cuando el server se niega.
  const ui = leer('../app/agencia/FlujoAviso.tsx');
  const desde = ui.indexOf('const elegir =');
  const elegir = ui.slice(desde, ui.indexOf('\n  };', desde));
  assert.match(elegir, /ok === false\) setIntencion\(null\)/, '«Por tiempo» queda elegido sin horario cuando se niega');
});

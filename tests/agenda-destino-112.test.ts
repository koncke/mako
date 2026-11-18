// =============================================================================
// Ticket #112 (Joan, Código Inmobiliario, ws 13, 18/11/2026): «NO me agenda el evento en mi google calendar, solo en el calendario de Mako»
// =============================================================================
// El «Misa Fasta SAM» del #111 se pidió con «agenda un evento en MI CALENDARIO…» y quedó sólo en el Calendario de MaKo, con el Google
// Calendar del negocio conectado desde el 8/10. Medido con el turno real: «mi calendario» traía sólo `crear_evento_calendario`, y
// `crear_evento_google` viajaba sólo con «el calendario de google». Lo que fija, por el camino del turno del grupo (clasificador +
// clase de la IA + `herramientasDelTurno` con lo que el doer leyó de la agenda):
//   1. con Google conectado, el pedido TAL CUAL va a Google: viaja `crear_evento_google`, no el Calendario de MaKo, con su instrucción;
//   2. la preferencia de Joan TAL CUAL («cada vez que quiera agendar algo tiene que agendarlo en mi google calendar de una») trae la
//      operación que la guarda, y lo guardado manda en los pedidos que no dicen dónde; «el calendario de MaKo» por su nombre, a MaKo;
//   3. sin Google conectado (o sólo para leer): lo dice con el link a Integraciones, nunca en silencio; «mi calendario» a secas, como
//      siempre (el de MaKo);
//   4. el seguimiento de un lead (#110) con Google como destino va a Google;
//   5. la operación real (tests/_agenda-destino-112-hijo.ts): sin Google no se guarda «google»; «mako» se guarda con el «sí»;
//   6. el doer lee la preferencia y la conexión, y se las pasa al turno.
// Probado rompiéndolo (18/11/2026), una rotura por vez: sin `destino` en herramientasDelTurno → fallan 1, 2, 3 y 4; con «el
// calendario de Mako» antes que Google en `cualNombra` → falla 2 (la queja de Joan, «solo en el calendario de Mako», ganaba); sin
// `sin-conexion` → falla 3.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import { veredictoDeClase } from '../lib/mako-intencion-ia';
import { destinoDeLaAgenda, pidePreferenciaDeAgenda, necesitaLaConexion, type ConexionGoogle, type DestinoGuardado } from '../lib/agenda-destino';
import type { Vista } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)))`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
const VISTA: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };
const CONECTADO: ConexionGoogle = { conectado: true, puedeMover: true };
const SIN_GOOGLE: ConexionGoogle = { conectado: false, puedeMover: false };
const SOLO_LEER: ConexionGoogle = { conectado: true, puedeMover: false };
const LINK = 'https://hola-mako.com/integraciones?abrir=google&ws=13';

/** El pedido del #111/#112 TAL CUAL. */
const PEDIDO = 'Mako agenda un evento en mi calendario hoy 18 a las 18hs, que dure 1hora , que se llame Misa Fasta SAM';
/** Lo que escribió Joan en el #112, TAL CUAL. */
const QUEJA = 'NO me agenda el evento en mi google calendar, solo en el calendario de Mako, cada vez que quiera agendar algo tiene que agendarlo en mi google calendar de una';

function turno(texto: string, o: { guardado?: DestinoGuardado | null; google?: ConexionGoogle | null; agenda?: boolean } = {}) {
  const reglas = clasificarIntencion(texto, {});
  const veredicto = veredictoDeClase({ clase: 'ACCION', resumen: 'Agendar un evento', reenviado: false }, reglas, { esSuperAdmin: false, escribeElDueno: false, texto });
  return herramientasDelTurno({
    veredicto, texto, contextoDelSi: null, hilo: null, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: VISTA,
    hayPendientes: false, resumenesPendientes: [], sinCalendly: true, hoy: '2026-11-18',
    agenda: o.agenda === false ? null : { guardado: o.guardado ?? null, google: o.google === undefined ? CONECTADO : o.google, link: LINK },
  });
}
const nombres = (t: ReturnType<typeof turno>) => t.tools.map((x) => x.name);

test('1. con Google conectado, el pedido TAL CUAL («mi calendario») va a Google, no sólo al Calendario de MaKo', () => {
  const t = turno(PEDIDO);
  assert.ok(nombres(t).includes('crear_evento_google'), `no viajó crear_evento_google: ${nombres(t).join(', ')}`);
  assert.ok(!nombres(t).includes('crear_evento_calendario'), 'el Calendario de MaKo no viaja para esto: lo de Google ya se ve en él');
  assert.match(t.instruccion ?? '', /DÓNDE SE AGENDA: este negocio tiene su Google Calendar conectado/);
  assert.match(t.instruccion ?? '', /usa crear_evento_google/);
  // Sin lo que el doer leyó de la agenda (el chat de la app, o antes de esto): como siempre, el de MaKo. Era el #112.
  const antes = turno(PEDIDO, { agenda: false });
  assert.ok(antes.tools.some((x) => x.name === 'crear_evento_calendario') && !antes.tools.some((x) => x.name === 'crear_evento_google'));
  // EL CASO REAL QUE ANDUVO (18/11/2026, 13:00 UTC): con la frase que le mandó el equipo, MaKo propuso por `proponer_agendar_agenda`
  // («Voy a agendar en tu Google Calendar "Misa Fasta SAM" hoy 18/11 a las 18:00 por 1 hora, sin invitados»), Joan dijo «si» y a las
  // 13:01:06 quedó en su Google Calendar. Ese camino sigue: con el arreglo viaja también `crear_evento_google`, y no el de MaKo.
  const ANDUVO = 'Mako agenda en mi Google Calendar hoy a las 18:00, que dure 1 hora, un evento que se llame Misa Fasta SAM';
  assert.ok(nombres(turno(ANDUVO, { agenda: false })).includes('proponer_agendar_agenda'), 'lo que anduvo en producción');
  const real = nombres(turno(ANDUVO));
  assert.ok(real.includes('proponer_agendar_agenda') && real.includes('crear_evento_google') && !real.includes('crear_evento_calendario'), real.join(', '));
  // «mi agenda», «en Google»: lo mismo.
  for (const f of ['agenda en mi agenda hoy a las 18 la Misa Fasta SAM por una hora', 'agendalo en google hoy a las 18', 'crea un evento en mi Google Calendar hoy a las 18hs por 1 hora que se llame Misa Fasta SAM']) {
    assert.equal(destinoDeLaAgenda({ texto: f, guardado: null, google: CONECTADO }), 'google', f);
  }
});

test('2. la preferencia de Joan TAL CUAL se guarda con un «sí», y lo guardado manda en lo que no dice dónde', () => {
  assert.equal(pidePreferenciaDeAgenda(QUEJA), 'google', 'la queja «solo en el calendario de Mako» no le gana a lo que pide para siempre');
  const t = turno(QUEJA);
  assert.ok(nombres(t).includes('elegir_google_o_mako'), `no viajó la operación que guarda la preferencia: ${nombres(t).join(', ')}`);
  assert.match(t.instruccion ?? '', /TE DICE DÓNDE QUIERE QUE AGENDES SIEMPRE: en su Google Calendar\. Propón elegir_google_o_mako con destino «google»/);
  assert.equal(pidePreferenciaDeAgenda('de ahora en adelante agéndalo todo en el calendario de mako'), 'mako');
  assert.equal(pidePreferenciaDeAgenda(PEDIDO), null, 'un pedido de una vez no es una preferencia');
  // Guardado «google»: un pedido que no dice dónde va a Google; «el calendario de MaKo» por su nombre, a MaKo.
  const sinDecir = 'agenda una reunión de equipo el jueves a las 10';
  assert.equal(destinoDeLaAgenda({ texto: sinDecir, guardado: 'google', google: CONECTADO }), 'google');
  assert.ok(nombres(turno(sinDecir, { guardado: 'google' })).includes('crear_evento_google'));
  assert.equal(destinoDeLaAgenda({ texto: 'ponlo en el calendario de mako el jueves a las 10', guardado: 'google', google: CONECTADO }), 'mako');
  assert.ok(nombres(turno('agenda en el calendario de mako el jueves a las 10 la reunión de equipo', { guardado: 'google' })).includes('crear_evento_calendario'));
  // Nombrar los dos va a Google, salvo un «no en Google».
  assert.equal(destinoDeLaAgenda({ texto: 'agéndalo en mi google calendar, no en el calendario de mako', guardado: null, google: CONECTADO }), 'google');
  assert.equal(destinoDeLaAgenda({ texto: 'agéndalo en el calendario de mako, no en google', guardado: null, google: CONECTADO }), 'mako');
});

test('3. sin Google conectado (o sólo para leer): lo dice con el link, nunca en silencio; «mi calendario» a secas, como siempre', () => {
  const t = turno('agenda en mi google calendar hoy a las 18 la Misa Fasta SAM', { google: SIN_GOOGLE });
  assert.match(t.instruccion ?? '', /no tiene su Google Calendar conectado/);
  assert.ok((t.instruccion ?? '').includes(`Configuración › Integraciones: ${LINK}`));
  assert.match(t.instruccion ?? '', /No lo agendes sólo en el Calendario de MaKo sin decirlo/);
  assert.match(turno('agenda en mi google calendar hoy a las 18', { google: SOLO_LEER }).instruccion ?? '', /conectado sólo para leer/);
  assert.equal(destinoDeLaAgenda({ texto: 'agenda una reunión el jueves a las 10', guardado: 'google', google: SIN_GOOGLE }), 'sin-conexion', 'lo eligió y se desconectó: se dice');
  assert.equal(destinoDeLaAgenda({ texto: PEDIDO, guardado: null, google: SIN_GOOGLE }), null, '«mi calendario» sin Google: el de MaKo, sin cartel');
  // Y la conexión sólo se mira si hace falta (refresca el token contra Google).
  assert.equal(necesitaLaConexion({ texto: '¿cuántos leads entraron hoy?', guardado: 'google' }), false);
  assert.equal(necesitaLaConexion({ texto: 'agenda una reunión el jueves', guardado: null }), false);
  assert.equal(necesitaLaConexion({ texto: PEDIDO, guardado: null }), true);
  assert.equal(necesitaLaConexion({ texto: 'agenda en el calendario de mako el jueves', guardado: 'google' }), false);
});

test('4. el seguimiento de un lead (#110) con Google como destino va a Google', () => {
  const t = turno('agrega una nota al lead Valery: agendar llamarla en dos semanas para coordinar la reunión', { guardado: 'google' });
  assert.ok(nombres(t).includes('crear_evento_google') && nombres(t).includes('agregar_nota_lead'));
  assert.ok(!nombres(t).includes('crear_evento_calendario'));
  assert.match(t.instruccion ?? '', /crear_evento_google con título «Llamar a /);
  assert.match(t.instruccion ?? '', /fecha 2026-12-02/);
  // Sin destino Google, el del #110, igual.
  assert.match(turno('agrega una nota al lead Valery: agendar llamarla en dos semanas', { agenda: false }).instruccion ?? '', /crear_evento_calendario con tipo «llamada»/);
});

test('5. la operación real que guarda dónde agenda MaKo (base de mentira)', () => {
  const r = spawnSync(process.execPath, ['--conditions=react-server', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_agenda-destino-112-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 240_000,
  });
  assert.equal(r.status, 0, (r.stderr || '').slice(-2000));
  const e = new Map((r.stdout || '').split('\n').filter((l) => l.startsWith('@@DESTINO@@')).map((l) => {
    const o = JSON.parse(l.slice(11)) as Record<string, unknown> & { nombre: string };
    return [o.nombre, o];
  }));
  const sin = e.get('sinGoogle') as unknown as { google: { ok: boolean; error: string }; pendientes: number; guardado: unknown };
  assert.equal(sin.google.ok, false);
  assert.match(sin.google.error, /no tiene una agenda de Google conectada/);
  assert.equal(sin.pendientes, 0, 'sin Google, «google» no queda propuesto');
  assert.equal(sin.guardado, null);
  const mako = e.get('mako') as unknown as { mako: { ok: boolean }; antes: unknown; si: { resultado: string }; guardado: unknown };
  assert.equal(mako.mako.ok, true);
  assert.equal(mako.antes, null, 'hasta el «sí» no se guarda nada');
  assert.match(mako.si.resultado, /Hecho/);
  assert.equal(mako.guardado, 'mako');
  assert.match(JSON.stringify(e.get('invalido')), /google \| mako/);
  assert.deepEqual((e.get('red') as unknown as { red: string[] }).red, []);
});

test('6. el doer lee la preferencia y la conexión de la agenda y se las pasa al turno', () => {
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /const leido = await getSetting\(KEY_DESTINO_AGENDA\)\.catch\(\(\) => null\);/);
  assert.match(doer, /const google = necesitaLaConexion\(\{ texto: textoDeAgenda, guardado \}\) \? await permisoCalendarioGoogle\(\) : null;/);
  assert.match(doer, /agenda: agendaDelTurno,/);
  // La operación viaja por WhatsApp y la app, nunca por HTTP (es la agenda de Google), y al FINAL de su área.
  const def = leer('lib/api-mako/areas/calendario.def.ts');
  assert.ok(def.lastIndexOf("id: 'elegir_google_o_mako'") > def.lastIndexOf("id: 'enlazar_email_calendario'"));
});

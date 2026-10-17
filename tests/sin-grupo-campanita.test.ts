// =============================================================================
// «Sin grupo de MaKo» en la tarjeta MaKo, y la campanita de escritorio (17/10/2026)
// =============================================================================
// Orden de Cerebro (16/10/2026): «la campanita de escritorio y la opción visible «Sin grupo de MaKo: por email / queda en
// la app» en la tarjeta MaKo, con default «queda en la app». Lee con getSettingEstricto y un marcador tipado sinGrupo,
// nunca con getSetting. Hoy se reintenta una vez por hora en el ws4.» El mapeo previo, con las trampas, en
// docs/hallazgos-comunicacion.md («La campanita de escritorio y el «sin grupo de MaKo»»). Lo que fija este test:
//   1. la opción vive en los params de la tarjeta (`sinGrupoDeMako`): sin elegir, 'app'; editar el texto no la borra;
//   2. viaja al aviso desde los dos runners (`armarAvisoDeTarjeta` y `pasosDelEvento`), nunca en una tarjeta por email;
//   3. lo que la tarjeta le contesta al motor (`resultadoDelAviso`) y lo que cuenta como LLEGÓ (`llegoLaTarjeta`): quedar
//      en la app cuenta, y es lo que le pone techo a la alerta del ws4;
//   4. `emitirAviso` DE VERDAD (Evolution y la base de mentira, en un node aparte): sin grupo no sale a Evolution, queda en
//      la app o va por email, y la fila lo dice; «no pude leer el grupo» NO es «no tiene» (ni un correo);
//   5. lo que dibuja la campanita (lib/campanita.ts): agrupa los repetidos, dice si no llegó, no linkea al default, marca
//      visto sólo si hay algo nuevo;
//   6. las costuras: el Sidebar la monta y no se pliega debajo de ella, la ruta lee estricto, y la tarjeta la ofrece.
//
// Probado rompiéndolo (17/10/2026, arnés del scratchpad `romper.py` + `roturas-sin-grupo.json`: una rotura por vez,
// restaurada byte a byte y comprobada con md5; base 6 / 6, al final 6 / 6):
//   1. `enviarAlGrupoMaKo` lee el grupo con `getGrupoJidMaKo` (getSetting)          → 2 rojos (4 y 6).
//   2. «no pude leer el grupo» lleva el marcador `sinGrupo`                         → 1 rojo (4).
//   3. el respaldo por email sin mirar `canal.email` (duplica el correo)            → 1 rojo (4).
//   4. `llegoLaTarjeta` sin contar la app                                           → 1 rojo (3).
//   5. la campanita sin agrupar los repetidos                                       → 1 rojo (5).
//   6. `paramsConPartes` sin `sinGrupo` (editar el texto borra la opción)           → 1 rojo (1).
//   7. el contador sin `SIN_RUIDO` (la lista y el número cuentan distinto)          → 1 rojo (6).
//   8. la fila no anota que no llegó (`anotarSalida`)                               → 1 rojo (4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  sinGrupoDeMako, paramsDeMako, paramsConPartes, armarAvisoDeTarjeta, resultadoDelAviso, llegoLaTarjeta, SINES_GRUPO, ROTULO_SIN_GRUPO,
} from '../lib/mako-tarjeta';
import { pasosDelEvento } from '../lib/aviso-evento';
import type { PasoGrafo } from '../lib/flujo-grafo';
import { agruparAvisos, rotuloDeSalida, marcaAlAbrir, fraseDeAviso, haceCuanto, LINK_POR_DEFECTO, type FilaFeed } from '../lib/campanita';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string): string => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);

/** Corre `codigo` en un node aparte (react-server + mocks de módulos) y devuelve el JSON de su última línea. */
function hijo(codigo: string): Record<string, unknown> {
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', codigo,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, EVOLUTION_BASE_URL: 'http://evo.test', EVOLUTION_API_KEY: 'k-de-mentira' } });
  const lineas = out.trim().split('\n');
  return JSON.parse(lineas[lineas.length - 1]!) as Record<string, unknown>;
}

const texto = (cuerpo: string) => ({ tipo: 'texto' as const, cuerpo });

// ── 1-3. La opción, puro ─────────────────────────────────────────────────────────

test('1. la opción vive en la tarjeta: sin elegir queda en la app, y editar el texto no la borra', () => {
  assert.deepEqual(SINES_GRUPO, ['app', 'email']);
  assert.deepEqual(ROTULO_SIN_GRUPO, { app: 'Queda en la app', email: 'Por email' });
  assert.equal(sinGrupoDeMako(undefined), 'app');
  assert.equal(sinGrupoDeMako({ sinGrupo: 'cualquiera' }), 'app', 'lo que no es «email» queda en la app');
  const base = paramsConPartes({ leadId: 'evento' }, [texto('Hola')]);
  assert.ok(!('sinGrupo' in base), 'sin elegir no se escribe nada: las tarjetas de antes quedan como estaban');
  const conEmail = paramsDeMako(base, { sinGrupo: 'email' });
  assert.equal(conEmail.sinGrupo, 'email');
  const editada = paramsDeMako(conEmail, { cuerpo: 'Hola de nuevo' });
  assert.equal(editada.sinGrupo, 'email', 'editar el texto borró lo elegido');
  assert.equal(editada.mensaje, 'Hola de nuevo');
  const porEmail = paramsDeMako(editada, { canal: 'email', asunto: 'A' });
  assert.equal(porEmail.sinGrupo, 'email', 'pasar a email y volver al grupo no tiene por qué perderlo');
  const deVuelta = paramsDeMako(editada, { sinGrupo: 'app' });
  assert.ok(!('sinGrupo' in deVuelta), 'volver a «queda en la app» lo saca');
});

test('2. viaja al aviso desde los dos runners, y nunca en una tarjeta por email', () => {
  const partes = [{ tipo: 'texto' as const, texto: 'Nuevo agendado' }];
  const o = { desdeUnFlujo: true, respuesta: '', lead: null, linkLead: null, textos: { titulo: 'T', mensaje: 'Nuevo agendado' }, partes };
  assert.equal(armarAvisoDeTarjeta({ partes: [texto('Nuevo agendado')], sinGrupo: 'email' }, o).sinGrupo, 'email');
  assert.equal(armarAvisoDeTarjeta({ partes: [texto('Nuevo agendado')] }, o).sinGrupo, undefined);
  assert.equal(armarAvisoDeTarjeta({ mensaje: 'de antes', sinGrupo: 'email' }, { ...o, partes: null }).sinGrupo, 'email', 'la tarjeta de antes también');
  assert.equal(armarAvisoDeTarjeta({ partes: [texto('x')], canal: 'email', asunto: 'A', sinGrupo: 'email' }, o).sinGrupo, undefined, 'por email no hay grupo que falte');
  // El runner de los eventos: el paso lo lleva; sin elegir, el paso queda como siempre (la firma no cambia).
  const RELLENO = { orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, proveedor: 'no_oficial' } as const;
  const tarjeta = (params: Record<string, unknown>): PasoGrafo =>
    ({ ...RELLENO, id: 'm1', siguiente: null, accion: { operacion: 'avisar_al_equipo', params: { leadId: 'evento', mensaje: 'Hola', partes: [texto('Hola')], ...params } } }) as PasoGrafo;
  const con = pasosDelEvento([tarjeta({ sinGrupo: 'email' })], 'lead_contesta');
  assert.equal(con.problema, null);
  assert.equal((con.pasos[0] as { sinGrupo?: string }).sinGrupo, 'email');
  const sin = pasosDelEvento([tarjeta({})], 'lead_contesta');
  assert.ok(!('sinGrupo' in sin.pasos[0]!), 'sin elegir, el paso no lleva nada');
  assert.equal(con.firma, sin.firma, 'una corrida dormida se cortaría si la firma cambiara');
  const email = pasosDelEvento([tarjeta({ canal: 'email', asunto: 'A', sinGrupo: 'email' })], 'lead_contesta');
  assert.ok(!('sinGrupo' in email.pasos[0]!));
});

test('3. lo que contesta al motor, y lo que cuenta como LLEGÓ', () => {
  const base = { ok: true, wa: false, deduped: false, feedId: 7, waError: 'el negocio no tiene grupo de MaKo' };
  assert.deepEqual(resultadoDelAviso({ ...base, sinGrupo: 'app' }, null), { ok: true, resumen: 'El negocio no tiene grupo de MaKo: quedó en la app.' });
  assert.equal(resultadoDelAviso({ ...base, sinGrupo: 'app', feedId: null }, null).ok, false, 'sin la fila no quedó en ningún lado');
  assert.deepEqual(resultadoDelAviso({ ...base, sinGrupo: 'email', email: true }, null), { ok: true, resumen: 'El negocio no tiene grupo de MaKo: le escribí al equipo por email.' });
  const sinMail = resultadoDelAviso({ ...base, sinGrupo: 'email', email: false }, null);
  assert.equal(sinMail.ok, false, 'un correo elegido que no salió es un fallo');
  assert.match(sinMail.resumen, /quedó en la app/);
  // Un grupo que existe y no salió sigue siendo el fallo de siempre.
  assert.equal(resultadoDelAviso({ ...base, waError: 'Evolution 400' }, null).ok, false);
  // LLEGÓ.
  assert.equal(llegoLaTarjeta({ ok: true, wa: true }), true);
  assert.equal(llegoLaTarjeta({ ok: true, wa: false, email: true }), true);
  assert.equal(llegoLaTarjeta({ ok: true, wa: false, sinGrupo: 'app', feedId: 7 }), true, 'la campanita ES el destino elegido: sin contarla, el ws4 vuelve cada hora');
  assert.equal(llegoLaTarjeta({ ok: true, wa: false, sinGrupo: 'email', email: false, feedId: 7 }), true, 'sin destinatarios, reintentar cada hora sólo suma filas');
  assert.equal(llegoLaTarjeta({ ok: true, wa: false, sinGrupo: 'app', feedId: null }), false);
  assert.equal(llegoLaTarjeta({ ok: true, wa: false, feedId: 7 }), false, 'un WhatsApp caído con grupo NO llegó: el feed solo no avisa a nadie');
  assert.equal(llegoLaTarjeta({ ok: false, wa: true }), false);
});

// ── 4. emitirAviso de verdad ─────────────────────────────────────────────────────

const JID = '120363000000000000@g.us';
const HIJO = `
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const log = { feed: [], anotado: [], fetch: [], mails: [], push: 0 };
let grupo = null; let leerFalla = false; let canal = { activo: true, wa: true, email: false, frecuenciaMin: 0 };
globalThis.fetch = async (u, init) => {
  log.fetch.push(new URL(String(u)).pathname);
  return new Response(JSON.stringify({ key: { id: 'W' + log.fetch.length } }), { status: 201 });
};
const settings = await import(${url('lib/settings.ts')});
mock.module(${url('lib/settings.ts')}, { exports: { ...real(settings),
  // ⚠️ getSetting devuelve SIEMPRE el grupo: si el envío lo leyera con getSetting, «sin grupo» no se vería nunca.
  getSetting: async (k) => (k === 'mako.grupo_jid' ? '${JID}' : k === 'mako.voz.instancia' ? 'mako_test' : null),
  getSettingEstricto: async (k) => { if (k !== 'mako.grupo_jid') return null; if (leerFalla) throw new Error('timeout de la base'); return grupo; },
  setSetting: async () => {},
} });
mock.module(${url('lib/notificaciones.ts')}, { exports: {
  crearNotificacion: async (x) => { log.feed.push(x.payload); return 41; },
  anotarSalida: async (ws, id, payload) => { log.anotado.push({ ws, id, payload }); },
} });
mock.module(${url('lib/espaciado.ts')}, { exports: { reclamarEspaciado: async () => true, salioReciente: async () => false } });
const perfil = await import(${url('lib/perfil.ts')});
mock.module(${url('lib/perfil.ts')}, { exports: { ...real(perfil), estadoAviso: async () => canal, resumenAvisosActivo: async () => false } });
mock.module(${url('lib/avisos-cola.ts')}, { exports: { encolarAviso: async () => false } });
mock.module(${url('lib/mako-doer-conv.ts')}, { exports: { guardarTurno: async () => {} } });
mock.module(${url('lib/push.ts')}, { exports: { enviarPush: async () => { log.push++; return { enviados: 1, fallidos: 0, sinSuscripciones: 0 }; } } });
mock.module(${url('lib/plantillas.ts')}, { exports: { getFlujo: async () => null } });
mock.module(${url('lib/notif-destinatarios.ts')}, { exports: { ...real(await import(${url('lib/notif-destinatarios.ts')})), getDestinatariosDe: async () => ({ telefonos: [], emails: ['equipo@negocio.test'] }) } });
mock.module(${url('lib/resend.ts')}, { exports: { ...real(await import(${url('lib/resend.ts')})), sendEmail: async (m) => { log.mails.push(m.to); return { ok: true }; } } });
const { emitirAviso } = await import(${url('lib/avisos.ts')});
const { ESTADO_TARJETA } = await import(${url('lib/mako-tarjeta.ts')});
const { APAGADO } = await import(${url('lib/aviso-evento.ts')});
const corrida = async (a, o = {}) => {
  log.feed = []; log.anotado = []; log.fetch = []; log.mails = []; log.push = 0;
  grupo = o.grupo ?? null; leerFalla = !!o.leerFalla; canal = o.canal ?? { activo: true, wa: true, email: false, frecuenciaMin: 0 };
  const r = await emitirAviso(a);
  return { r, ...JSON.parse(JSON.stringify(log)) };
};
const base = { ws: 4, tipo: 'chatbot-aviso-equipo', titulo: 'T', texto: 'Meta frenó la cuenta', categoria: 'accion', semaforo: 'amarillo', rotulo: false, estado: ESTADO_TARJETA };
const partes = [{ tipo: 'texto', texto: 'Meta frenó la cuenta' }];
const out = {
  conGrupo: await corrida(base, { grupo: '${JID}' }),
  app: await corrida(base),
  appPartes: await corrida({ ...base, partes }),
  email: await corrida({ ...base, sinGrupo: 'email' }),
  noPudeLeer: await corrida({ ...base, sinGrupo: 'email' }, { leerFalla: true }),
  emailYaSalio: await corrida({ tipo: 'meta-cuenta-frenada', titulo: 'T', texto: 'x', ws: 4, sinGrupo: 'email' }, { canal: { activo: true, wa: true, email: true, frecuenciaMin: 0 } }),
  sinAutomatizacion: await corrida({ ...base, estado: APAGADO }),
  apagadoEnStore: await corrida({ tipo: 'meta-cuenta-frenada', titulo: 'T', texto: 'x', ws: 4 }, { canal: { activo: false, wa: true, email: false, frecuenciaMin: 0 } }),
};
console.log(JSON.stringify(out));
`;

test('4. emitirAviso de verdad: sin grupo queda en la app o va por email, y «no pude leer» no es «no tiene»', () => {
  const o = hijo(HIJO) as Record<string, any>;
  // Con grupo: como siempre, y la fila no se reescribe.
  assert.deepEqual(o.conGrupo.fetch, ['/message/sendText/mako_test']);
  assert.equal(o.conGrupo.r.wa, true);
  assert.equal(o.conGrupo.r.sinGrupo, undefined);
  assert.deepEqual(o.conGrupo.anotado, []);
  // Sin grupo, de fábrica: nada a Evolution, nada de correo, el push sí, y la fila dice por qué.
  for (const k of ['app', 'appPartes']) {
    const x = o[k];
    assert.deepEqual(x.fetch, [], `${k}: sin grupo se le pegó a Evolution`);
    assert.deepEqual(x.mails, [], `${k}: «queda en la app» mandó un correo que nadie pidió`);
    assert.equal(x.r.sinGrupo, 'app', `${k}: el marcador tipado no llegó`);
    assert.equal(x.r.feedId, 41);
    assert.equal(x.push, 1, `${k}: «queda en la app» incluye el teléfono`);
    assert.deepEqual(x.anotado, [{ ws: 4, id: 41, payload: { texto: 'Meta frenó la cuenta', categoria: 'accion', semaforo: 'amarillo', salida: 'sin_grupo' } }]);
  }
  // Por email: UN correo al equipo, y la fila lo dice.
  assert.deepEqual(o.email.mails, ['equipo@negocio.test']);
  assert.equal(o.email.r.email, true);
  assert.equal(o.email.r.sinGrupo, 'email');
  assert.equal(o.email.anotado[0].payload.porEmail, true);
  // ⚠️ «No pude leer el grupo» NO es «no tiene»: ni correo ni marcador (con un bache, un correo por aviso por negocio).
  assert.deepEqual(o.noPudeLeer.mails, [], 'un error de lectura disparó el respaldo por email');
  assert.equal(o.noPudeLeer.r.sinGrupo, undefined);
  assert.match(o.noPudeLeer.r.waError, /no pude leer el grupo de MaKo/);
  assert.equal(o.noPudeLeer.anotado[0].payload.salida, 'no_llego');
  // El aviso que ya iba por email no se duplica.
  assert.deepEqual(o.emailYaSalio.mails, ['equipo@negocio.test'], 'el respaldo duplicó el correo que el aviso ya mandó');
  // La fila de un evento sin automatización es bitácora (la campanita la esconde); la que el negocio apagó, no.
  assert.equal(o.sinAutomatizacion.feed[0].salida, 'sin_automatizacion');
  assert.equal(o.sinAutomatizacion.r.apagado, true);
  assert.equal(o.apagadoEnStore.feed[0].salida, 'apagado');
  assert.deepEqual(o.apagadoEnStore.fetch, []);
});

// ── 5. Lo que dibuja la campanita ────────────────────────────────────────────────

const fila = (id: number, min: number, o: Partial<FilaFeed> = {}): FilaFeed => ({
  id, tipo: 'meta-cuenta-frenada', severidad: 'urgente', titulo: 'Meta Frenó la Cuenta', descripcion: '*Tu cuenta* está frenada',
  link: LINK_POR_DEFECTO, payload: {}, createdAt: new Date(Date.UTC(2026, 9, 17, 3, 0) - min * 60_000).toISOString(), ...o,
});

test('5. la campanita agrupa los repetidos seguidos, dice si no llegó y no linkea al default', () => {
  const filas = [
    fila(9, 0), fila(8, 70), fila(7, 140),
    fila(6, 200, { tipo: 'chatbot-aviso-equipo', titulo: 'Nuevo agendado', descripcion: 'Ana', link: '/crm/5', severidad: 'warn', payload: { salida: 'sin_grupo' } }),
    fila(5, 210, { tipo: 'chatbot-aviso-equipo', titulo: 'Nuevo agendado', descripcion: 'Beto', link: '/crm/6', severidad: 'warn' }),
    fila(4, 300),
  ];
  const visto = fila(0, 100).createdAt;
  const a = agruparAvisos(filas, visto);
  assert.deepEqual(a.map((x) => [x.id, x.veces]), [[9, 3], [6, 1], [5, 1], [4, 1]], 'la alerta que insiste sale una vez; dos leads son dos renglones; lo no seguido no se junta');
  assert.equal(a[0]!.nuevo, true);
  assert.equal(a[0]!.link, null, 'el default de Configuraciones no es un link');
  assert.equal(a[0]!.frase, 'Tu cuenta está frenada', 'las marcas de WhatsApp no se dibujan');
  assert.equal(a[0]!.urgente, true);
  assert.equal(a[1]!.link, '/crm/5');
  assert.equal(a[1]!.salida, 'Sin grupo: quedó aquí');
  assert.equal(a[3]!.nuevo, false);
  // Las salidas, cortas.
  assert.equal(rotuloDeSalida({ salida: 'sin_grupo', porEmail: true }), 'Sin grupo: fue por email');
  assert.equal(rotuloDeSalida({ salida: 'no_llego' }), 'No llegó al grupo');
  assert.equal(rotuloDeSalida({ salida: 'apagado' }), 'Apagado: quedó aquí');
  assert.equal(rotuloDeSalida({}), null);
  assert.equal(fraseDeAviso('━━ AVISO ━━\nhola'), 'AVISO hola');
  // Marcar visto: sólo si lo más nuevo es posterior a la marca (la marca reescribe el perfil entero).
  assert.equal(marcaAlAbrir(filas, visto), filas[0]!.createdAt);
  assert.equal(marcaAlAbrir(filas, filas[0]!.createdAt), null);
  assert.equal(marcaAlAbrir([], null), null);
  assert.equal(haceCuanto(fila(1, 30).createdAt, Date.UTC(2026, 9, 17, 3, 0)), 'hace 30 min');
  assert.equal(haceCuanto(fila(1, 180).createdAt, Date.UTC(2026, 9, 17, 3, 0)), 'hace 3 h');
});

// ── 6. Las costuras ──────────────────────────────────────────────────────────────

test('6. el Sidebar la monta sin plegarse debajo, la ruta lee estricto y la tarjeta la ofrece', () => {
  const sb = sinComentarios(leer('app/_components/Sidebar.tsx'));
  assert.match(sb, /<CampanitaAvisos open=\{open\}/, 'la campanita no está en el pie');
  assert.match(sb, /document\.getElementById\(ID_PANEL_AVISOS\)\?\.matches\(':hover'\)/, 'la barra se pliega debajo del panel abierto');
  assert.match(sb, /veAvisos && <CampanitaAvisos/, 'un closer o setter vería una campana que siempre está vacía');
  const ruta = sinComentarios(leer('app/api/notificaciones/route.ts'));
  assert.match(ruta, /listNotificaciones\(ws, \{ limite, antesDe, estricto: true \}\)/, '«no pude leer» se dibujaría «Sin avisos todavía»');
  const notif = sinComentarios(leer('lib/notificaciones.ts'));
  assert.equal((notif.match(/\.or\(SIN_RUIDO\)/g) ?? []).length, 2, 'la lista y el contador tienen que contar lo mismo');
  const grupo = sinComentarios(leer('lib/mako-grupo.ts'));
  for (const f of ['export async function enviarAlGrupoMaKo(', 'export async function enviarPartesAlGrupoMaKo(']) {
    const i = grupo.indexOf(f);
    const cuerpo = grupo.slice(i, grupo.indexOf('\n}\n', i));
    assert.match(cuerpo, /grupoJidEstricto\(ws\)/, `${f} lee el grupo con getSetting: un error sería «no tiene grupo»`);
    assert.doesNotMatch(cuerpo, /getGrupoJidMaKo\(/);
  }
  const lienzo = sinComentarios(leer('app/automations/FlujoLienzo.tsx'));
  assert.match(lienzo, /data-sin-grupo-mako/, 'la opción no se ve en la tarjeta');
  assert.match(lienzo, /onCambio\(\{ sinGrupo: v as SinGrupo \}, true\)/);
  const def = leer('lib/api-mako/areas/chatbot.def.ts');
  assert.match(def, /nombre: 'sinGrupo', tipo: 'string', enum: \['app', 'email'\]/, 'la API de MaKo no la puede configurar');
});

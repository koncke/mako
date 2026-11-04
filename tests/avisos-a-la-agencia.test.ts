// =============================================================================
// Lo que es de la agencia le llega a la agencia, y no al grupo de su cliente (31/10/2026, ticket #37)
// =============================================================================
// Martín: «Las alertas siempre deberían llegarle a Código Inmobiliario y en general a todas las agencias de esta manera… pero no
// debería llegarlo al grupo de WhatsApp del cliente final». El aviso real, el de Natalia del 31/10, era la cuenta PUBLICITARIA de
// Meta en período de gracia, y no el plan de MaKo. Lo real corre en tests/_avisos-a-la-agencia-hijo.ts: mira a qué grupo y a qué
// correo llega cada cosa.
//
// PROBADO ROMPIÉNDOLO (31/10/2026), una rotura por vez: 57 aplicadas, y 56 las ve algún test. La otra es equivalente: sin mirar el
// error de la lectura del nombre, el nombre vacío frena igual. Base 17 / 0. Tres sobrevivieron la primera vez y forzaron a reforzarlo.
//
// Correr: node --import tsx --test tests/avisos-a-la-agencia.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AVISOS_SOLO_SUPERADMIN, CATALOGO_AVISOS, esAvisoParaAgencia } from '../lib/avisos-catalogo';
import { TOPE_NOMBRE_SECUENCIA } from '../lib/setting-estrategia';
import { EVENTOS_MAKO, TRIGGER_AVISO_MAKO } from '../lib/disparadores';
import { pasosDePlantilla, plantillaPorId, TOPE_LINEA } from '../lib/plantillas-automatizaciones';
import { normalizar } from '../lib/flujo-grafo';
import { frenoDelEvento, pasosDelEvento } from '../lib/aviso-evento';
import { leOfrecePagar, textoDelCorte, vigenciaDelLugar, type CobroDelLugar, type CorteGuardado } from '../lib/plan-acceso-reglas';
import { PREFIJO_RENOVACION_FALLIDA } from '../lib/cobrado-lead';
import { problemasDeTokens } from '../lib/tokens-del-flujo';

const RAIZ = join(__dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_avisos-a-la-agencia-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
const AGENCIA = '13@g.us', OTRA = '14@g.us', NATALIA = '19@g.us';
const a = (cs: Array<{ to: string }>) => cs.map((c) => c.to);

/** Los textos de las tarjetas de una plantilla. */
const tarjetas = (id: string): string[] => (pasosDePlantilla(plantillaPorId(id)!) as unknown as Array<{ accion?: { params?: unknown } }>)
  .map((p) => JSON.stringify(p.accion?.params ?? '')).filter((t) => t.includes('MaKo'));

test('La alerta de Meta del cliente de una agencia llega al grupo de la agencia, con su nombre, y nunca al suyo', () => {
  assert.deepEqual(R.natalia.grupos, [AGENCIA], 'es el pedido entero');
  assert.equal(R.natalia.llegaron, 1, 'el techo cuenta los que llegaron: sin esto vuelve a avisar cada hora');
  assert.match(R.natalia.texto, /La cuenta publicitaria de \*Natalia\* está \*EN PERÍODO DE GRACIA\*/, 'sin el nombre, la agencia recibe una alarma que no puede accionar');
  assert.match(R.natalia.texto, /https:\/\/mako\.test\/partners/);
  assert.doesNotMatch(R.natalia.texto, /\{\{|integraciones/, 'el link de integraciones sería el de la propia agencia');
  assert.equal(R.nataliaFeed, 0, 'tampoco en la campanita ni en el push de la cliente');
  assert.deepEqual(R.agenciaFeed, ['meta-cuenta-frenada-agencia']);
  assert.deepEqual(R.nataliaVolvio.grupos, [AGENCIA], 'el «ya está» tiene que seguir a la alerta');
  assert.match(R.nataliaVolvio.texto, /\*Natalia\* volvió a la normalidad/);
});

test('Quien no es cliente de una agencia aprobada lo sigue recibiendo en su grupo', () => {
  assert.deepEqual(R.directo.grupos, ['30@g.us']);
  assert.match(R.directo.texto, /Tu cuenta publicitaria está \*EN PERÍODO DE GRACIA\*/);
  assert.deepEqual(R.directoVolvio.grupos, ['30@g.us']);
  assert.deepEqual(R.revocado.grupos, ['32@g.us'], 'una agencia que ya no lo lleva no tiene por qué enterarse');
  assert.deepEqual(R.pendiente.grupos, ['33@g.us'], 'una pendiente todavía no entra a su cuenta');
  assert.deepEqual(R.dePausada.grupos, ['36@g.us'], 'una agencia pausada no lo va a leer');
});

test('Una agencia sin grupo la recibe por correo: el cliente ya no la ve, y quedaba sólo en una campanita', () => {
  assert.deepEqual(R.agenciaSinGrupo.grupos, [], 'y al grupo del cliente tampoco');
  assert.deepEqual(a(R.agenciaSinGrupoCorreos), ['singrupo@x.test']);
  assert.match(R.agenciaSinGrupoCorreos[0].cuerpo, /De La Sin Grupo/);
});

test('Con dos agencias aprobadas les llega a las dos', () => {
  assert.deepEqual([...R.deDos.grupos].sort(), [AGENCIA, OTRA]);
  assert.equal(R.deDos.llegaron, 2);
});

test('«No sé» nunca cae en el grupo del cliente: no sale, y el cron lo reintenta', () => {
  for (const c of [R.carteraCaida, R.nombreCaido, R.sinNombre, R.filasCaidas]) {
    assert.deepEqual(c.grupos, [], 'una base caída le contaba al cliente una deuda ajena');
    assert.equal(c.ok, false, 'con `ok: true` el cron lo daría por emitido');
  }
});

test('Sin la fila de la agencia no sale a nadie, y queda sin gastar el techo', () => {
  assert.deepEqual(R.sinFilaDeLaAgencia.grupos, [], 'el deploy antes que la mudanza no puede avisarle al cliente');
  assert.equal(R.sinFilaDeLaAgencia.llegaron, 0);
  assert.equal(R.sinFilaDeLaAgencia.ok, true);
});

test('Las plantillas entran en los topes: un nombre más largo nace cortado en la fila, y ése es el título que llega', () => {
  for (const id of ['mako-meta-cuenta-frenada-agencia', 'mako-meta-cuenta-recuperada-agencia']) {
    assert.ok(plantillaPorId(id)!.nombre.length <= TOPE_NOMBRE_SECUENCIA, id);
    assert.ok(plantillaPorId(id)!.linea.length <= TOPE_LINEA, id);
  }
});

test('La API de MaKo no le ofrece a un negocio el aviso de una agencia, y no afirma que le llega el suyo', () => {
  assert.equal(esAvisoParaAgencia('meta-cuenta-frenada-agencia'), true);
  assert.equal(esAvisoParaAgencia('meta-cuenta-frenada'), false);
  const api = readFileSync(join(RAIZ, 'lib/api-mako/areas/equipo.run.ts'), 'utf8');
  assert.match(api, /a\.categoria !== 'reporte' && !esAvisoParaAgencia\(a\.id\)/);
  assert.match(api, /le_llega_a_su_agencia: await agenciasAprobadasDe\(ctx\.ws\)/);
});

test('El lienzo de SuperAdmin dice a quién le llega: nada por detrás', () => {
  const conAgencia = EVENTOS_MAKO.filter((e) => e.conAgencia).map((e) => e.aviso).sort();
  assert.deepEqual(conAgencia, CATALOGO_AVISOS.filter((c) => c.aLaAgencia).map((c) => c.id).sort(), 'el catálogo decide el destino y el evento lo dice: no se pueden separar');
  const lienzo = readFileSync(join(RAIZ, 'app/automations/FlujoLienzo.tsx'), 'utf8');
  assert.match(lienzo, /aAgencia \? 'Le llega a la agencia del negocio del evento\.'/);
  assert.match(lienzo, /delEvento\?\.conAgencia \? ' Si es cliente de una agencia, le llega a ella, con otro texto\.'/);
});

test('Es por clase: el aviso de su propio WhatsApp sigue siendo del cliente', () => {
  assert.deepEqual(R.suWhatsapp.grupos, [NATALIA]);
  assert.deepEqual(CATALOGO_AVISOS.filter((c) => c.aLaAgencia).map((c) => c.id), ['meta-cuenta-frenada', 'meta-cuenta-recuperada']);
});

test('Cada aviso a la agencia existe de punta a punta: catálogo, evento, plantilla, SuperAdmin y mudanza', () => {
  const mudanza = readFileSync(join(RAIZ, 'scripts/mudanza-avisos-plataforma.mts'), 'utf8');
  for (const c of CATALOGO_AVISOS.filter((x) => x.aLaAgencia)) {
    const aviso = CATALOGO_AVISOS.find((x) => x.id === c.aLaAgencia);
    assert.ok(aviso, c.id);
    assert.equal(aviso.porDefecto, 'on', 'sin esto la mudanza crea la fila PAUSADA, y el aviso no le llega a nadie');
    assert.ok(AVISOS_SOLO_SUPERADMIN.includes(aviso.id), 'los avisos de sistema los configura sólo el super admin');
    const ev = EVENTOS_MAKO.find((e) => e.aviso === aviso.id);
    assert.ok(ev, aviso.id);
    assert.equal(ev.plataforma, true, aviso.id);
    assert.ok((ev.trae as readonly string[]).includes('clienteagencia'), 'sin esto `{{cliente_nombre}}` no se ofrece ni se publica');
    const plantilla = `mako-${aviso.id}`;
    assert.ok(plantillaPorId(plantilla), plantilla);
    assert.ok(mudanza.includes(`{ plantilla: '${plantilla}', evento: '${ev.subtipo}' }`), 'sin esto su fila no se puede crear');
    const pasos = normalizar(pasosDePlantilla(plantillaPorId(plantilla)!));
    assert.equal(pasosDelEvento(pasos, ev.subtipo).problema ?? null, null, plantilla);
    assert.equal(frenoDelEvento(pasos, ev.subtipo), null, plantilla);
  }
});

test('Todo texto a la agencia nombra al cliente y sólo cita datos que el evento trae', () => {
  for (const id of ['mako-meta-cuenta-frenada-agencia', 'mako-meta-cuenta-recuperada-agencia']) {
    const ts = tarjetas(id);
    assert.ok(ts.length >= 1, id);
    // Lo mismo que mira Publicar: un dato que el evento no trae saldría como `{{token}}` crudo.
    const ev = plantillaPorId(id)!.cron as { evento?: string };
    assert.deepEqual(problemasDeTokens(normalizar(pasosDePlantilla(plantillaPorId(id)!)), TRIGGER_AVISO_MAKO, ev.evento), [], id);
    for (const t of ts) {
      assert.match(t, /\{\{cliente_nombre\}\}/, `${id}: ${t.slice(0, 80)}`);
      assert.doesNotMatch(t, /\bTu cuenta\b/, 'en el grupo de la agencia, «tu cuenta» es la de ella');
    }
  }
});

test('«Tu cuenta» sola se lee como la de MaKo: al cliente directo le dice cuál', () => {
  for (const t of tarjetas('mako-meta-cuenta-frenada')) assert.doesNotMatch(t, /Tu cuenta (está|quedó)/, t.slice(0, 80));
});

test('El rechazo de una renovación se lo cuenta a la agencia, una vez por período y sin el cliente', () => {
  assert.deepEqual(R.quien, { agenciaWs: 13, clienteWs: 19, paga: 'agencia', proveedor: 'mercadopago' });
  assert.deepEqual(a(R.rechazo), ['agencia@x.test']);
  assert.match(R.rechazo[0].asunto, /Natalia/);
  assert.match(R.rechazo[0].cuerpo, /Natalia[\s\S]*se va a pausar su cuenta/);
  assert.match(R.rechazo[0].cuerpo, /Mercado Pago lo reintenta solo: para que entre, cambia ahí la tarjeta/, 'en MaKo Partners no hay ningún botón para esto: el correo tiene que decir qué hacer');
  assert.doesNotMatch(R.rechazo[0].cuerpo, /resuelves|regulariza/i);
  assert.match(R.rechazoPagaElCliente[0].cuerpo, /Creem lo reintenta solo: la paga tu cliente, avísale/);
  assert.deepEqual(R.renovacionSinAutorizar, [], 'la está pagando ella en pantalla: no hay ningún reintento que anunciarle');
  assert.deepEqual(R.reintento, [], 'la pasarela reintenta varias veces');
  assert.deepEqual(a(R.primeraRenovacion), ['agencia@x.test'], 'la primera renovación nace pendiente');
  assert.deepEqual(R.primerMes, [], 'el primer mes lo está pagando ella en pantalla');
  assert.deepEqual(R.propio, [], 'un plan propio no tiene agencia');
  assert.equal(R.quienRevocado, null, 'una agencia que lo soltó no recibe nada');
  assert.deepEqual(R.rechazoSinSaber, [], 'sin poder leer no se manda');
  assert.match(R.rechazoSinSaberAnotado, /tarjeta rechazada/, 'y el pago rechazado se anota igual');
});

test('Un cobro de agencia nunca da mora: por eso el cartel de la mora no le sale al cliente, y no hay que «arreglarlo»', () => {
  const rechazada = { id: 1, tipo: 'suscripcion', estado: 'pagado', suscripcion_estado: 'activa', pagado_at: '2026-08-10T15:00:00Z', reembolsado_at: null, inicio_at: null, created_at: '2026-08-10T14:00:00Z', cliente_ws: 19, motivo: `${PREFIJO_RENOVACION_FALLIDA}: tarjeta rechazada` } as unknown as CobroDelLugar;
  assert.equal(vigenciaDelLugar([rechazada], [], Date.parse('2026-10-31T12:00:00Z')).estado, 'al-dia', 'con mora, el cliente vería una deuda de su agencia');
  assert.equal(vigenciaDelLugar([{ ...rechazada, cliente_ws: null } as CobroDelLugar], [], Date.parse('2026-09-12T12:00:00Z')).estado, 'mora', 'el plan propio sí la da: si no, este test no mira nada');
});

test('La pausa: a la agencia siempre; al cliente, sólo si paga él', () => {
  assert.deepEqual(a(R.pausaPagaLaAgencia), ['agencia@x.test'], 'el cliente no debe nada');
  assert.match(R.pausaPagaLaAgencia[0].asunto, /Natalia/);
  assert.deepEqual(a(R.pausaPagaElCliente), ['agencia@x.test', 'solo@x.test']);
  assert.deepEqual(a(R.pausaPropia), ['directo@x.test']);
  assert.deepEqual(a(R.pausaSinCobro), ['directo@x.test'], 'un corte que no viene de un cobro sigue siendo del negocio');
  assert.deepEqual(a(R.pausaSinSaber), ['natalia@x.test'], 'sale una sola vez por corte: un cliente directo no puede quedar pausado sin saberlo');
  assert.doesNotMatch(R.pausaSinSaber[0].cuerpo, /cobrar|pagues|Pendiente/, 'sin poder leer quién paga, no le cuenta una deuda');
});

test('La pantalla de la cuenta pausada no le pide plata a quien no la debe', () => {
  const c = (motivo: CorteGuardado['motivo']): CorteGuardado => ({ cobroId: 1, hasta: '2026-10-10', motivo, desde: '2026-10-15T00:00:00Z', vigente: true });
  for (const m of ['impago', 'baja', 'devuelto'] as const) assert.match(textoDelCorte(c(m), { pagaSuAgencia: true }).detalle, /Tu agencia tiene que regularizar/, m);
  assert.match(textoDelCorte(c('impago'), { paraAgencia: true }).titulo, /Este cliente está pausado/);
  assert.doesNotMatch(textoDelCorte(c('impago'), { paraAgencia: true }).detalle, /Regulariza|Partners/, 'en MaKo Partners no hay cómo: no se promete');
  assert.match(textoDelCorte(c('devuelto'), { paraAgencia: true }).titulo, /se devolvió/, 'una devolución no se dice como si faltara pagar');
  assert.match(textoDelCorte(c('impago')).titulo, /Tu pago no entró/, 'quien paga lo suyo, como siempre');
  assert.match(textoDelCorte(c('sin-agencia'), { pagaSuAgencia: true }).titulo, /dejó de administrar/, 'ya no tiene agencia que lo pague');
  const ofrece = (quienPaga: 'agencia' | 'cliente' | 'no-se' | null, motivo: CorteGuardado['motivo'] = 'impago', esAgencia = false) => leOfrecePagar({ esAgencia, corte: c(motivo), quienPaga });
  assert.equal(ofrece(null), true, 'quien debe lo suyo sigue pudiendo pagar');
  assert.equal(ofrece('cliente'), true, 'el cliente de agencia que se paga solo, también');
  assert.equal(ofrece('agencia'), false, 'no le pide plata a quien no la debe');
  assert.equal(ofrece('no-se'), false, 'una lectura caída no le ofrece pagar una deuda ajena');
  assert.equal(ofrece(null, 'impago', true), false, 'la agencia que mira no paga desde acá');
  assert.equal(ofrece(null, 'devuelto'), false);
  assert.equal(ofrece(null, 'renovacion-sin-autorizar'), false);
  assert.equal(leOfrecePagar({ esAgencia: false, corte: null, quienPaga: null }), false, 'una pausa a mano es «escríbenos»');
  const pagina = readFileSync(join(RAIZ, 'app/cuenta-pausada/page.tsx'), 'utf8');
  assert.match(pagina, /const porPago = !telefono && leOfrecePagar\(\{ esAgencia, corte, quienPaga \}\);/, 'el botón de pagar lo decide esa regla; en un teléfono no se vende');
  assert.match(pagina, /corte\?\.vigente && quienPaga !== 'no-se' \? corte : null/, 'sin saber quién paga, el texto tampoco habla de plata');
});

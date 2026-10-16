// =============================================================================
// «MaKo en WhatsApp» = automatizaciones: el CRON «Evento de MaKo» y su emisor (lib/aviso-evento.ts)
// =============================================================================
// Pedido de Martín (11/10/2026): «Todo ahora es lo mismo... Las tarjetas cambian, cambia el CRON, cambia la
// tarjeta de "MaKo en WhatsApp" cambia todo, y NO debería... debe ser IDENTICO». Diseño:
// docs/diseno-mako-en-whatsapp-unificado.md (§6, los tests de la parte A). Lo que se fija, y por qué:
//   1. la tabla `EVENTOS_MAKO`: cuatro (el nuevo agendado desde la décima tanda), cada uno un aviso del catálogo, y sus
//      avisos son `AVISOS_POR_EVENTO`;
//   2. el CRON: clase `mako`, su texto, «Este CRON va solo», «Este CRON no se cambia» (también el recordatorio);
//   3. `pasosDelEvento`: las tres plantillas traducen y cada tarjeta que el runner no sabe correr se rechaza
//      CON su tarjeta (Publicar la abre);
//   4. `decidir` con la CONDITION (lo que no se sabe NUNCA se cumple) y lo que envejece no se duerme;
//   5. `emitirPorEvento` EJECUTADO con una base de mentira: sin filas no sale ni reclama, una lectura que
//      falla no es «no tiene», el dedup se reclama UNA vez por evento y corren todas las filas;
//   6. el cableado (los módulos con `server-only` no cargan bajo tsx: se lee su fuente sin comentarios);
//   7. lo que encontró la revisión adversarial (11/10/2026): una corrida dormida retoma sólo con la MISMA forma
//      (`firma`), «no pude leer al lead» se reintenta en vez de gastar el dedup, «Lo que arma MaKo» no va después de
//      un DELAY, y el motor no le corre nada a una inscripción de una fila del emisor.
//
// PROBADO ROMPIÉNDOLO: ver las roturas al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AVISOS_POR_EVENTO, eventoDeAviso, avisoDeEvento, eventoDeFila, datosDelEvento, pasosDelEvento, frenoDelEvento,
  emitirPorEvento, ESTADO_EVENTO, APAGADO, MOTIVO_EVENTO, idCorridaDeFila, filaDeIdCorrida, pasosParaRetomar,
  type DepsEvento, type FilaEvento, type FilaParaRetomar,
} from '../lib/aviso-evento';
import {
  EVENTOS_MAKO, EVENTOS_MAKO_OFRECIDOS, TRIGGER_AVISO_MAKO, TRIGGERS_DEL_EMISOR, SOLO_DESDE_EL_CRON, CLASES_DISPARADOR, MOTIVO_CRON_SOLO, MOTIVO_CRON_FIJO,
  sanearDisparador, claseDeDisparador, eventosDe, eventosOfrecidos, textoDeDisparador, problemaDeDisparadores, problemaDeDisparador,
  problemaDeCambio, barreElDisparador, disparadoresDe, esDelEmisor, MOTIVO_EVENTO_RETIRADO, type Disparador,
} from '../lib/disparadores';
import { TRIGGER_RECORDATORIO } from '../lib/recordatorio-automatizacion';
import { CATALOGO_AVISOS, AVISOS_SOLO_SUPERADMIN, textoLoArmaElCodigo } from '../lib/avisos-catalogo';
import { decidir, ctxParaDormir, QUE_ENVEJECEN, DELAY_MAX_HORAS, reintentoDeHechos, REINTENTO_HECHOS_MIN, TOPE_REINTENTOS_HECHOS } from '../lib/flujo-pasos';
import { CLAVE_QUE_ENVEJECE } from '../lib/cobranza';
import { variablesPara, CLAVE_MENSAJE_MAKO } from '../lib/variables-aviso';
import { esFlujoValido, type Paso } from '../lib/flujos-tipos';
import type { PasoGrafo, RamaCondicion, HechosLead } from '../lib/flujo-grafo';
import type { EmitirAvisoInput } from '../lib/avisos';
import type { CtxFlujo } from '../lib/flujos';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** De `desde` hasta `hasta` (el próximo), sin comentarios. */
const bloque = (src: string, desde: string, hasta: string): string => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const f = src.indexOf(hasta, i + desde.length);
  return src.slice(i, f > 0 ? f : undefined);
};

// ── Las piezas del lienzo (lo mismo que nace del ＋, como lib/plantillas-automatizaciones.ts) ─────────
const RELLENO = { orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, proveedor: 'no_oficial' } as const;
const mako = (id: string, mensaje: string, siguiente: string | null): PasoGrafo =>
  ({ ...RELLENO, id, siguiente, accion: { operacion: 'avisar_al_equipo', params: { leadId: 'evento', mensaje } } }) as PasoGrafo;
const esperar = (id: string, minutos: number, siguiente: string | null, modo: 'tiempo' | 'antes_reunion' = 'tiempo'): PasoGrafo =>
  ({ ...RELLENO, id, nodo: 'esperar', espera: { modo, minutos }, siguiente }) as PasoGrafo;
const rama = (id: string, siguiente: string | null): RamaCondicion => ({ id, modo: 'todas', filas: [{ campo: 'agendo' }], siguiente });
const condicion = (id: string, ramas: RamaCondicion[], siNo: string | null): PasoGrafo =>
  ({ ...RELLENO, id, nodo: 'condicion', ramas, si_no: siNo }) as PasoGrafo;
const whatsapp = (id: string, cuerpo: string, siguiente: string | null): PasoGrafo => ({ ...RELLENO, id, cuerpo, siguiente }) as PasoGrafo;

// Los textos de la cobranza de hoy, LITERALES (el `ejemplo` de `cuota-vencida` y su cadencia de fábrica).
const ENTRADA = '💸 *Cobranza*: la cuota {{cuota_numero}} de {{lead_nombre}} venció hace {{cuota_dias}} — *{{cuota_monto}} sin cobrar*. Si ya se cobró, márcalo en su ficha. — MaKo';
const A_48 = '💸 Sigue sin cobrarse la cuota {{cuota_numero}} de {{lead_nombre}} — {{cuota_monto}}, vencía el {{cuota_vence}}.\n\n👉 {{link_lead}} — MaKo';
const A_72 = '💸 Último recordatorio por la cuota {{cuota_numero}} de {{lead_nombre}} ({{cuota_monto}}): si ya se cobró, márcalo en su ficha y dejo de insistir.\n\n👉 {{link_lead}} — MaKo';

/** Las tres plantillas de la galería (diseño §4). */
const REUNION = [mako('mr_aviso', '{{mensaje_mako}}', null)];
const CHARLA = [mako('mc_aviso', '{{mensaje_mako}}', null)];
const AGENDADO = [mako('ma_aviso', '{{mensaje_mako}}', null)];
const COBRANZA = [
  mako('mk_entrada', ENTRADA, 'mk_e48'), esperar('mk_e48', 2880, 'mk_48'), mako('mk_48', A_48, 'mk_e72'),
  esperar('mk_e72', 4320, 'mk_72'), mako('mk_72', A_72, null),
];
/** Qué tarjeta es cada paso de la cobranza: lo que la corrida guarda para saber dónde está (`TraduccionEvento.firma`). */
const FIRMA_COBRANZA = 'mk_entrada:mensaje>mk_e48:esperar>mk_48:mensaje>mk_e72:esperar>mk_72:mensaje';

// ── 1. La tabla ──────────────────────────────────────────────────────────────────────────────────

// Desde la décima tanda (GENERAL 7, 11/10/2026) son CUATRO: el aviso de nuevo agendado (`lead_agendo`) pasó a ser un
// evento (docs/diseno-automations-galeria-v2.md §5).
test('EVENTOS_MAKO: siete (15/10: restablecer la contraseña), cada subtipo se guarda, cada aviso existe y es UNO de `AVISOS_POR_EVENTO`', () => {
  // El quinto, «Entra un pago» (11/10/2026): lo emite la pasarela de pagos (lib/cobros.ts). El séptimo (15/10/2026) es
  // de una PERSONA: lo emite Seguridad en el ws de la plataforma (tests/email-persona.test.ts).
  // (15/10/2026: y los dos primeros Mensajes de MaKo a sus clientes, de la PLATAFORMA: la línea caída y la que volvió.)
  // (16/10/2026: y el reporte de los lunes, que sale por «MaKo por email».)
  // (16/10/2026, tarde: «WhatsApp cerró la sesión» es su propio evento, con su texto literal: docs/inventario-nada-por-detras.md.)
  assert.deepEqual(EVENTOS_MAKO.map((e) => e.subtipo), ['reunion_pronto', 'lead_contesta', 'cuota_vencida', 'lead_agendo', 'pago_recibido', 'analisis_listo', 'contrasena_restablecer', 'whatsapp_caido', 'whatsapp_desvinculado', 'whatsapp_volvio', 'reunion_grabada', 'reporte_semanal']);
  assert.deepEqual(EVENTOS_MAKO.map((e) => e.aviso), ['reunion-recordatorio', 'wa-mensaje-entrante', 'cuota-vencida', 'reunion-nuevo-agendado', 'pago-recibido', 'dashboard-analisis-listo', 'seguridad-contrasena-restablecer', 'wa-desconectado', 'wa-desvinculado', 'wa-reconectado', 'reunion-ocurrio-fathom', 'reporte-semanal']);
  for (const e of EVENTOS_MAKO) {
    // El subtipo pasa el saneo del CRON (el id crudo, con guion, no pasaría).
    assert.equal(sanearDisparador({ id: 'd1', trigger_tipo: TRIGGER_AVISO_MAKO, subtipo: e.subtipo })?.subtipo, e.subtipo, e.subtipo);
    assert.ok(CATALOGO_AVISOS.some((c) => c.id === e.aviso), `${e.aviso} no está en el catálogo`);
    assert.equal(eventoDeAviso(e.aviso), e.subtipo);
    assert.equal(avisoDeEvento(e.subtipo), e.aviso);
    // Uno del NEGOCIO no puede ser del super admin; uno de la PLATAFORMA (15/10/2026), justo al revés: es de los que
    // configura sólo el super admin (`AVISOS_SOLO_SUPERADMIN`), y ahora lo configura en SUS automatizaciones.
    if (e.plataforma) assert.ok(AVISOS_SOLO_SUPERADMIN.includes(e.aviso), `${e.aviso} es de la plataforma y no es del super admin`);
    else assert.ok(!AVISOS_SOLO_SUPERADMIN.includes(e.aviso), `${e.aviso} es del super admin: no puede ser un evento del negocio`);
  }
  assert.equal(sanearDisparador({ id: 'd1', trigger_tipo: TRIGGER_AVISO_MAKO, subtipo: 'cuota-vencida' })?.subtipo, null, 'el id crudo no es un subtipo');
  assert.deepEqual([...AVISOS_POR_EVENTO].sort(), EVENTOS_MAKO.map((e) => e.aviso).sort());
  assert.equal(eventoDeAviso('cuota-por-vencer'), null, 'cuota-por-vencer es de la agencia y no cambia');
});

test('los datos del «{ }»: el lead en los tres, la cuota en la cobranza y «Lo que arma MaKo» sólo con texto del código', () => {
  // Undécima tanda (11/10/2026, punto 4): además el PAGO en «Entra un pago» (`conPago`) y lo que ESCRIBIÓ el lead
  // en la charla (`conEscrito`): los datos citables que reemplazan a `{{mensaje_mako}}`. `conMensaje` se queda
  // hasta la limpieza (las filas vivas lo siguen resolviendo).
  assert.deepEqual(datosDelEvento('reunion_pronto'), { conLead: true, conCuota: false, conMensaje: true, conPago: false, conEscrito: false, conAnalisis: false, destino: 'equipo' });
  assert.deepEqual(datosDelEvento('lead_contesta'), { conLead: true, conCuota: false, conMensaje: true, conPago: false, conEscrito: true, conAnalisis: false, destino: 'equipo' });
  assert.deepEqual(datosDelEvento('cuota_vencida'), { conLead: true, conCuota: true, conMensaje: false, conPago: false, conEscrito: false, conAnalisis: false, destino: 'equipo' });
  assert.deepEqual(datosDelEvento('lead_agendo'), { conLead: true, conCuota: false, conMensaje: true, conPago: false, conEscrito: false, conAnalisis: false, destino: 'equipo' });
  assert.deepEqual(datosDelEvento('pago_recibido'), { conLead: true, conCuota: false, conMensaje: true, conPago: true, conEscrito: false, conAnalisis: false, destino: 'equipo' });
  // El AI Analyst (13/10/2026): sin lead (el análisis es del negocio), con los datos del análisis.
  assert.deepEqual(datosDelEvento('analisis_listo'), { conLead: false, conCuota: false, conMensaje: false, conPago: false, conEscrito: false, conAnalisis: true, destino: 'equipo' });
  assert.deepEqual(datosDelEvento('no_existe'), { conLead: false, destino: 'equipo' });
  // Y lo que cada uno trae es lo que el «{ }» ofrece: el pago sólo en el pago, lo escrito sólo en la charla.
  const de = (sub: string) => variablesPara(datosDelEvento(sub)).map((v) => v.key);
  assert.ok(de('pago_recibido').includes('pago_monto') && !de('cuota_vencida').includes('pago_monto'));
  assert.ok(de('lead_contesta').includes('lead_escribio') && !de('pago_recibido').includes('lead_escribio'));
  // «Lo que arma MaKo» sale de `textoDelCodigo`: los tres que lo tienen (el agendado desde la décima tanda), y la cobranza no.
  assert.ok(textoLoArmaElCodigo('reunion-recordatorio') && textoLoArmaElCodigo('wa-mensaje-entrante') && !textoLoArmaElCodigo('cuota-vencida'));
  assert.ok(textoLoArmaElCodigo('reunion-nuevo-agendado'), 'el agendado no ofrecería «Lo que arma MaKo» y su plantilla no se publicaría');
  const claves = (o: Parameters<typeof variablesPara>[0]) => variablesPara(o).map((v) => v.key);
  // ⚠️ UNDÉCIMA TANDA (punto 4, §1.11): «Lo que arma MaKo» se RESUELVE (`conMensaje`, arriba) pero NO se ofrece en ningún
  // evento: es el aviso entero pegado en un token, y lo reemplazan los datos citables.
  for (const e of EVENTOS_MAKO) assert.ok(!claves(datosDelEvento(e.subtipo)).includes(CLAVE_MENSAJE_MAKO), `«Lo que arma MaKo» se ofrece en «${e.subtipo}»`);
  assert.ok(claves(datosDelEvento('cuota_vencida')).includes('cuota_monto'));
  // ⚠️ Un alcance nuevo NO cae en la cuota: con la cuota y sin `conMensaje`, «Lo que arma MaKo» no se ofrece.
  assert.ok(!claves({ conLead: true, conCuota: true }).includes(CLAVE_MENSAJE_MAKO), 'cualquier cobranza ofrecería un dato que no trae');
  assert.ok(!claves({ conLead: true, conMensaje: true, destino: 'lead' }).includes(CLAVE_MENSAJE_MAKO), 'es del equipo');
});

// ── 2. El CRON ───────────────────────────────────────────────────────────────────────────────────

const ev = (subtipo: string | null, id = 'd1'): Disparador => ({ id, trigger_tipo: TRIGGER_AVISO_MAKO, subtipo });
const etapa: Disparador = { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'agenda', etapas: null };
const manual: Disparador = { id: 'd1', trigger_tipo: 'manual' };
const recordatorio: Disparador = { id: 'd1', trigger_tipo: TRIGGER_RECORDATORIO };

test('el CRON: clase «mako», su texto es el label, no es un botón de la primera pantalla y no barre', () => {
  assert.equal(claseDeDisparador(ev('cuota_vencida')), 'mako');
  assert.equal(eventosDe('mako'), EVENTOS_MAKO);
  const t = textoDeDisparador(ev('reunion_pronto'), { deSiempre: () => 'NO' });
  assert.equal(t, 'Falta media hora para una reunión');
  // Siete desde el 11/10/2026 («Pagos», botón propio por decisión de Martín); `mako` sigue sin ser un botón.
  assert.deepEqual(CLASES_DISPARADOR.map((c) => c.clase), ['producto', 'recurrente', 'etiqueta', 'instagram', 'messenger', 'email', 'pagos'], 'mako no es un botón de la primera pantalla');
  assert.equal(barreElDisparador(ev('lead_contesta')), false, 'el barrido horario le mandaría un aviso por cada lead');
  // El evento vive en la lista guardada; el primero de las columnas lo hereda (mismo trigger_tipo).
  assert.equal(disparadoresDe({ trigger_tipo: TRIGGER_AVISO_MAKO, etapa: 'manual', disparadores: [ev('lead_contesta')] })[0].subtipo, 'lead_contesta');
  assert.equal(eventoDeFila({ trigger_tipo: TRIGGER_AVISO_MAKO, disparadores: [ev('lead_contesta')] }), 'lead_contesta');
  assert.equal(eventoDeFila({ trigger_tipo: TRIGGER_AVISO_MAKO, disparadores: null }), null);
  assert.equal(eventoDeFila({ trigger_tipo: 'etapa_actual', disparadores: [ev('lead_contesta')] }), null);
});

// UNDÉCIMA TANDA (punto 8: «Debería estar todo en un mismo flujo de "Agendó reunión"»): el nuevo agendado y la media hora
// antes ya no se ofrecen a una fila nueva (son tarjetas de «Un Lead Agendó Llamada»), pero SIGUEN vivos para las filas
// que los usan (#239, #240) hasta la limpieza: su evento se lee, su CRON se guarda, su plantilla vieja traduce y su aviso
// es el de siempre. Rotura R10 (arnés wf-undecima/w3-plantillas/roturas.cjs, base 24 / 0): sacar `lead_agendo` de
// EVENTOS_MAKO → 19 / 5 (éste, la tabla, los datos, el runner y las plantillas que traducen). Y R9 (sacarle `oculta` a
// `{{mensaje_mako}}`) → 23 / 1 (los datos del «{ }»). Y R19 (`problemaDeCambio` deja nacer una fila NUEVA con un
// evento retirado, al pegar o duplicar) → 23 / 1 (problemaDeCambio).
test('los retirados (el nuevo agendado y la media hora antes) no se ofrecen, y siguen vivos para las filas que los usan', () => {
  assert.deepEqual(EVENTOS_MAKO_OFRECIDOS.map((e) => e.subtipo), ['lead_contesta', 'cuota_vencida', 'pago_recibido', 'analisis_listo', 'contrasena_restablecer', 'whatsapp_caido', 'whatsapp_desvinculado', 'whatsapp_volvio', 'reunion_grabada', 'reporte_semanal']);
  assert.deepEqual(EVENTOS_MAKO.filter((e) => e.retirado).map((e) => e.subtipo), ['reunion_pronto', 'lead_agendo']);
  // EL SELECTOR DEL CRON los ofrece así (enchufado en el cierre de la ola 3: dibujaba `eventosDe`, con los retirados):
  // sin los retirados, salvo el que la fila YA tiene (la viva de antes se ve elegida hasta el script). Probado
  // rompiéndolo (11/10/2026, wf-undecima/enchufador/roturas.cjs): `eventosOfrecidos` = `eventosDe` → 23 / 1 (base 24 / 0).
  assert.deepEqual(eventosOfrecidos('mako', null).map((e) => e.subtipo), ['lead_contesta', 'cuota_vencida', 'pago_recibido', 'analisis_listo']);
  assert.deepEqual(eventosOfrecidos('mako', 'lead_agendo').map((e) => e.subtipo), ['lead_contesta', 'cuota_vencida', 'lead_agendo', 'pago_recibido', 'analisis_listo']);
  // El de una PERSONA (15/10/2026) se ofrece sólo en la plataforma: en un negocio no le llegaría nunca.
  // Y los de la PLATAFORMA a sus clientes (15/10/2026), también sólo ahí (el negocio de arriba no los ve).
  assert.deepEqual(eventosOfrecidos('mako', null, { plataforma: true }).map((e) => e.subtipo), ['lead_contesta', 'cuota_vencida', 'pago_recibido', 'analisis_listo', 'contrasena_restablecer', 'whatsapp_caido', 'whatsapp_desvinculado', 'whatsapp_volvio', 'reunion_grabada', 'reporte_semanal']);
  assert.deepEqual(eventosOfrecidos('pagos', null), eventosDe('pagos'), 'las otras clases, como siempre');
  assert.match(leer('app/automations/EditorDisparadores.tsx'), /\{eventosOfrecidos\(clase, d\.subtipo, \{ plataforma \}\)\.map\(\(ev\) => \{/);
  assert.doesNotMatch(leer('app/automations/EditorDisparadores.tsx'), /eventosDe\(clase\)/, 'el selector volvió a ofrecer los retirados');
  for (const sub of ['lead_agendo', 'reunion_pronto']) {
    // La fila viva: su evento se lee, su CRON se puede volver a guardar (ni «Elige el evento» ni «todavía no»).
    assert.equal(eventoDeFila({ trigger_tipo: TRIGGER_AVISO_MAKO, disparadores: [ev(sub)] }), sub);
    assert.equal(problemaDeDisparador(ev(sub), { unico: true }), null, `${sub}: la fila viva ya no se guarda`);
    assert.ok(avisoDeEvento(sub), sub);
  }
  assert.equal(pasosDelEvento(AGENDADO, 'lead_agendo').problema, null, 'la fila viva del nuevo agendado deja de correr');
  assert.equal(pasosDelEvento(REUNION, 'reunion_pronto').problema, null);
});

test('lo que le falta: «Elige el evento», un horario no, y con uno del emisor «Este CRON va solo»', () => {
  assert.equal(problemaDeDisparador(ev(null), { unico: true }), 'Elige el evento');
  assert.equal(problemaDeDisparador(ev('cuota_vencida'), { unico: true }), null);
  assert.equal(problemaDeDisparador({ ...ev('cuota_vencida'), cron: { unidad: 'dia', cada: 1, hora: 9, minuto: 0 } }, { unico: true }), 'Un evento no se repite por horario');
  assert.equal(problemaDeDisparadores([ev('cuota_vencida'), { ...etapa, id: 'd2' }]), MOTIVO_CRON_SOLO);
  assert.equal(problemaDeDisparadores([recordatorio, { ...etapa, id: 'd2' }]), MOTIVO_CRON_SOLO, 'el recordatorio también: un segundo CRON lo inscribía en el motor');
  assert.equal(problemaDeDisparadores([ev('cuota_vencida')]), null);
});

test('problemaDeCambio: el CRON del emisor no se cambia; de «a elegir» a uno del emisor, sí (pegar un flujo)', () => {
  assert.equal(problemaDeCambio([ev('cuota_vencida')], [ev('lead_contesta')]), MOTIVO_CRON_FIJO, 'de un evento a otro');
  assert.equal(problemaDeCambio([ev('cuota_vencida')], [etapa]), MOTIVO_CRON_FIJO, 'de un evento a otra clase');
  assert.equal(problemaDeCambio([recordatorio], [etapa]), MOTIVO_CRON_FIJO, 'la «←» del recordatorio');
  assert.equal(problemaDeCambio([recordatorio], [ev('reunion_pronto')]), MOTIVO_CRON_FIJO, 'de un emisor al otro');
  assert.equal(problemaDeCambio([etapa], [ev('cuota_vencida')]), MOTIVO_CRON_FIJO, 'de otra clase a un evento');
  assert.equal(problemaDeCambio([manual], [ev('cuota_vencida')]), null, 'pegar un flujo copiado: la fila nace «manual»');
  assert.equal(problemaDeCambio([ev('cuota_vencida', 'd1')], [ev('cuota_vencida', 'd9')]), null, 'guardar lo mismo (el id no cuenta)');
  assert.equal(problemaDeCambio([etapa], [{ ...etapa, etapa: 'facturando' }]), null, 'lo del motor, como siempre');
  assert.equal(problemaDeCambio([{ ...manual, cron: { unidad: 'dia', cada: 1, hora: 9, minuto: 0 } }], [ev('cuota_vencida')]), MOTIVO_CRON_FIJO, 'un Recurrente no es «a elegir»');
  // Undécima tanda: una fila NUEVA (pegar un flujo copiado de #239) no nace con un evento retirado; la viva se guarda igual.
  assert.equal(problemaDeCambio([manual], [ev('lead_agendo')]), MOTIVO_EVENTO_RETIRADO, 'una fila nueva con el nuevo agendado');
  assert.equal(problemaDeCambio([manual], [ev('reunion_pronto')]), MOTIVO_EVENTO_RETIRADO);
  assert.equal(problemaDeCambio([ev('lead_agendo')], [ev('lead_agendo', 'd2')]), null, 'la fila viva ya no se puede guardar');
});

test('SOLO_DESDE_EL_CRON tiene los dos del emisor (por /email no se eligen) y el emisor incluye al recordatorio', () => {
  assert.ok(TRIGGERS_DEL_EMISOR.has(TRIGGER_RECORDATORIO) && TRIGGERS_DEL_EMISOR.has(TRIGGER_AVISO_MAKO));
  assert.equal(TRIGGERS_DEL_EMISOR.size, 2);
  for (const t of TRIGGERS_DEL_EMISOR) assert.ok(SOLO_DESDE_EL_CRON.has(t), t);
  assert.ok(esDelEmisor(recordatorio) && !esDelEmisor(etapa) && !esDelEmisor(null));
});

// ── 3. pasosDelEvento ────────────────────────────────────────────────────────────────────────────

test('las tres plantillas traducen: la cobranza a mensaje, esperar 48, mensaje, esperar 72, mensaje', () => {
  const r = pasosDelEvento(REUNION, 'reunion_pronto');
  assert.deepEqual(r, { pasos: [{ tipo: 'mensaje', canal: 'aviso_dueno', texto: '{{mensaje_mako}}' }], problema: null, tarjeta: null, firma: 'mr_aviso:mensaje' });
  assert.equal(pasosDelEvento(CHARLA, 'lead_contesta').problema, null);
  // La plantilla `mako-agendado` (décima tanda): el texto lo arman los webhooks de la agenda (`textoDelCodigo`).
  assert.deepEqual(pasosDelEvento(AGENDADO, 'lead_agendo'), { pasos: [{ tipo: 'mensaje', canal: 'aviso_dueno', texto: '{{mensaje_mako}}' }], problema: null, tarjeta: null, firma: 'ma_aviso:mensaje' });
  assert.equal(frenoDelEvento(AGENDADO, 'lead_agendo'), null);
  const c = pasosDelEvento(COBRANZA, 'cuota_vencida');
  assert.equal(c.problema, null);
  assert.deepEqual(c.pasos, [
    { tipo: 'mensaje', canal: 'aviso_dueno', texto: ENTRADA },
    { tipo: 'esperar', horas: 48 },
    { tipo: 'mensaje', canal: 'aviso_dueno', texto: A_48 },
    { tipo: 'esperar', horas: 72 },
    { tipo: 'mensaje', canal: 'aviso_dueno', texto: A_72 },
  ]);
  assert.equal(frenoDelEvento(COBRANZA, 'cuota_vencida'), null);
  // Y una CONDITION de UNA rama, con «Si no» vacío: se cumple sigue, no termina.
  const conCond = [condicion('c1', [rama('c1_si', 'm1')], null), mako('m1', 'Hola', null)];
  const t = pasosDelEvento(conCond, 'lead_contesta');
  assert.equal(t.problema, null);
  assert.deepEqual(t.pasos.map((p) => p.tipo), ['condicion', 'mensaje']);
  assert.equal((t.pasos[0] as Extract<Paso, { tipo: 'condicion' }>).rama.id, 'c1_si');
});

// ── Undécima tanda (ola 2, w2-mako-editor): la tarjeta TAL CUAL en una fila de evento ───────────────────────────
// La tarjeta «MaKo en WhatsApp» guarda su lista (`params.partes`, lib/mako-tarjeta.ts): en una fila de evento el paso del
// runner la lleva (`partes`), y la de ANTES (sin lista) sale EXACTAMENTE como hasta hoy. Las reglas de lo que no va
// (un dato que envejece, «Lo que arma MaKo» después de un DELAY) miran TODO lo escrito, no el espejo.
// PROBADO ROMPIÉNDOLO (11/10/2026, arnés scratchpad/wf-undecima/w2-mako-editor/romper.mjs; base 23 / 0 en este archivo):
//   P1. `pasosDelEvento` pierde las partes (el paso sale sólo con `texto`)                       → 22 / 1 (este test)
//   P2. las reglas miran el espejo guardado `params.mensaje` y no cada parte (un `{{cuota_dias}}`
//       en un pie después del DELAY pasa)                                                        → 22 / 1 (este test)
//   P3. una tarjeta sin texto (sólo la Voz de MaKo) vuelve a ser `makoVacia`                     → 22 / 1 (este test)
//   Todas restauradas con md5 igual; al final, 23 / 0.
//   P4. `emitirTarjetaDelEvento` sin la guarda de la Voz de MaKo                                 → 22 / 1 (el del runner)
test('la tarjeta TAL CUAL en una fila de evento: el paso lleva sus partes; la de antes, igual que siempre', () => {
  const lista = [{ tipo: 'texto', cuerpo: '💰 {{nombre_completo}} pagó {{pago_monto}}' }, { tipo: 'audio', audio_id: 31, pausa_s: 2 }, { tipo: 'media', media_id: 9, cuerpo: '👉 {{link_lead}}' }];
  const talCual = (id: string, partes: unknown[], siguiente: string | null = null): PasoGrafo =>
    ({ ...RELLENO, id, siguiente, accion: { operacion: 'avisar_al_equipo', params: { leadId: 'evento', mensaje: 'espejo', partes } } }) as PasoGrafo;
  const r = pasosDelEvento([talCual('mp', lista)], 'pago_recibido');
  assert.equal(r.problema, null);
  assert.deepEqual(r.pasos, [{ tipo: 'mensaje', canal: 'aviso_dueno', texto: '💰 {{nombre_completo}} pagó {{pago_monto}}\n\n👉 {{link_lead}}', partes: lista }],
    'el paso perdió las partes (saldría sólo el texto, sin la Voz de MaKo ni el archivo)');
  assert.equal(r.firma, 'mp:mensaje', 'la firma es la de siempre: qué tarjeta es cada paso');
  // Sólo la Voz de MaKo: no está vacía.
  assert.deepEqual(pasosDelEvento([talCual('mv', [{ tipo: 'audio', audio_id: 31 }])], 'lead_contesta').pasos,
    [{ tipo: 'mensaje', canal: 'aviso_dueno', texto: '🎤 Nota de voz de MaKo', partes: [{ tipo: 'audio', audio_id: 31 }] }]);
  // La lista explícita y vacía SÍ está vacía (aunque el espejo diga algo).
  assert.deepEqual(frenoDelEvento([talCual('m0', [])], 'lead_contesta'), { error: MOTIVO_EVENTO.makoVacia, tarjeta: 'm0' });
  // Lo que envejece y «Lo que arma MaKo», en CUALQUIER parte (también un pie), después de un DELAY.
  assert.deepEqual(frenoDelEvento([mako('m1', ENTRADA, 'd1'), esperar('d1', 60, 'm2'), talCual('m2', [{ tipo: 'texto', cuerpo: 'Sigue sin cobrarse' }, { tipo: 'media', media_id: 9, cuerpo: 'Van {{cuota_dias}}' }])], 'cuota_vencida'),
    { error: MOTIVO_EVENTO.envejece, tarjeta: 'm2' });
  assert.deepEqual(frenoDelEvento([talCual('m1', [{ tipo: 'texto', cuerpo: 'Hola' }, { tipo: 'texto', cuerpo: '{{mensaje_mako}}' }])], 'cuota_vencida'),
    { error: MOTIVO_EVENTO.sinMensaje, tarjeta: 'm1' });
  // La de ANTES (sin lista): EXACTAMENTE como hasta hoy, sin `partes` en el paso.
  assert.deepEqual(pasosDelEvento(COBRANZA, 'cuota_vencida').pasos[0], { tipo: 'mensaje', canal: 'aviso_dueno', texto: ENTRADA });
  assert.ok(!('partes' in pasosDelEvento(AGENDADO, 'lead_agendo').pasos[0]));
});

test('cada tarjeta que el runner no sabe correr se rechaza CON su tarjeta (Publicar la abre)', () => {
  const caso = (pasos: PasoGrafo[], sub: string, motivo: string, tarjeta: string | null) => {
    const f = frenoDelEvento(pasos, sub);
    assert.deepEqual(f, { error: motivo, tarjeta }, `${motivo}`);
  };
  caso([mako('m1', 'Hola', 'w1'), whatsapp('w1', 'Hola lead', null)], 'lead_contesta', MOTIVO_EVENTO.alLead, 'w1');
  caso([mako('m1', 'Hola', 'e1'), { ...whatsapp('e1', 'Hola', null), canal: 'email' } as PasoGrafo], 'lead_contesta', MOTIVO_EVENTO.alLead, 'e1');
  caso([mako('m1', 'Hola', 'a1'), { ...RELLENO, id: 'a1', siguiente: null, accion: { operacion: 'crear_tarea', params: {} } } as PasoGrafo], 'lead_contesta', MOTIVO_EVENTO.accion, 'a1');
  caso([mako('m1', 'Hola', 'r1'), { ...RELLENO, id: 'r1', nodo: 'respuesta', paso_ia: true, casos: [], si_no: null } as PasoGrafo], 'lead_contesta', MOTIVO_EVENTO.respuesta, 'r1');
  caso([mako('m1', 'Hola', 'i1'), { ...RELLENO, id: 'i1', nodo: 'ir_a', destino: { nodo: 'm1' } } as PasoGrafo], 'lead_contesta', MOTIVO_EVENTO.irA, 'i1');
  caso([{ ...mako('m1', 'Hola', 'm2'), paralelos: ['m3'] } as PasoGrafo, mako('m2', 'B', null), mako('m3', 'C', null)], 'lead_contesta', MOTIVO_EVENTO.paralelo, 'm1');
  caso([{ ...RELLENO, id: 'entrada', nodo: 'inicio', siguiente: 'm1', paralelos: ['m2'] } as PasoGrafo, mako('m1', 'A', null), mako('m2', 'B', null)], 'lead_contesta', MOTIVO_EVENTO.paralelo, null);
  caso([esperar('d1', 60, 'm1', 'antes_reunion'), mako('m1', 'Hola', null)], 'reunion_pronto', MOTIVO_EVENTO.delayReunion, 'd1');
  caso([esperar('d1', (DELAY_MAX_HORAS + 1) * 60, 'm1'), mako('m1', 'Hola', null)], 'lead_contesta', MOTIVO_EVENTO.delayTope, 'd1');
  caso([condicion('c1', [rama('c1_si', 'm1')], 'm2'), mako('m1', 'A', null), mako('m2', 'B', null)], 'lead_contesta', MOTIVO_EVENTO.condicion, 'c1');
  caso([condicion('c1', [rama('c1_a', 'm1'), rama('c1_b', 'm1')], null), mako('m1', 'A', null)], 'lead_contesta', MOTIVO_EVENTO.condicion, 'c1');
  caso([mako('m1', '   ', null)], 'lead_contesta', MOTIVO_EVENTO.makoVacia, 'm1');
  caso([mako('m1', '{{mensaje_mako}}', null)], 'cuota_vencida', MOTIVO_EVENTO.sinMensaje, 'm1');
  caso([mako('m1', ENTRADA, 'd1'), esperar('d1', 60, 'm2'), mako('m2', 'Ya van {{cuota_dias}}', null)], 'cuota_vencida', MOTIVO_EVENTO.envejece, 'm2');
  // «Lo que arma MaKo» también es una foto (revisión del 11/10/2026): «⏰ En 30 min tienes la R1…» una hora después
  // salía con la reunión empezada. En los dos eventos que lo traen, y aunque la tarjeta de ANTES lo use.
  caso([mako('m1', '{{mensaje_mako}}', 'd1'), esperar('d1', 60, 'm2'), mako('m2', 'Recuerda: {{mensaje_mako}}', null)], 'reunion_pronto', MOTIVO_EVENTO.mensajeViejo, 'm2');
  caso([condicion('c1', [rama('c1_si', 'd1')], null), esperar('d1', 60, 'm2'), mako('m2', '{{mensaje_mako}}', null)], 'lead_contesta', MOTIVO_EVENTO.mensajeViejo, 'm2');
  // Después del DELAY, con los datos estables, sí va.
  assert.equal(frenoDelEvento([mako('m1', '{{mensaje_mako}}', 'd1'), esperar('d1', 60, 'm2'), mako('m2', 'Sigue sin respuesta {{lead_nombre}}', null)], 'lead_contesta'), null);
  caso([mako('m1', 'A', null), mako('m2', 'suelta', null)], 'lead_contesta', MOTIVO_EVENTO.afuera, 'm2');
  caso([esperar('d1', 60, null)], 'lead_contesta', MOTIVO_EVENTO.sinMako, null);
  caso(REUNION, 'nada', MOTIVO_EVENTO.sinEvento, null);
  // `{{cuota_dias}}` en la ENTRADA (antes de cualquier DELAY) sí va: es el dato de hoy.
  assert.equal(frenoDelEvento([mako('m1', ENTRADA, null)], 'cuota_vencida'), null);
});

// ── 4. El runner ─────────────────────────────────────────────────────────────────────────────────

const HECHOS = (agendo: boolean): HechosLead => ({
  etiquetas: new Set(), etapa: null, agendo, pago: false, yaContactado: false, respondio: false,
  creadoMs: null, tieneTelefono: true, tieneEmail: false, ahoraMs: Date.now(),
});

test('decidir con la CONDITION: se cumple → sigue; no, o SIN hechos → termina (lo que no se sabe NUNCA se cumple)', () => {
  const pasos: Paso[] = [{ tipo: 'condicion', rama: rama('r', null) }, { tipo: 'mensaje', canal: 'aviso_dueno', texto: 'x' }];
  const est = { paso: 0, desde: new Date(), respondioAt: null, ahora: new Date() };
  assert.deepEqual(decidir(pasos, { ...est, hechos: HECHOS(true) }), { que: 'saltar', siguiente: 1 });
  assert.deepEqual(decidir(pasos, { ...est, hechos: HECHOS(false) }), { que: 'terminar' });
  assert.deepEqual(decidir(pasos, { ...est, hechos: null }), { que: 'terminar' });
  assert.deepEqual(decidir(pasos, est), { que: 'terminar' });
  // Y en el store de /mensajes no entra (sin hechos cortaría siempre).
  assert.equal(esFlujoValido({ version: 1, activo: true, disparador: { tipo: 'manual' }, pasos }), false);
  assert.equal(esFlujoValido({ version: 1, activo: true, disparador: { tipo: 'manual' }, pasos: [{ tipo: 'esperar', horas: 1 }] }), true);
});

test('lo que ENVEJECE no se duerme: `ctxParaDormir` saca `cuota_dias` y deja el resto', () => {
  assert.ok(QUE_ENVEJECEN.includes(CLAVE_QUE_ENVEJECE), 'la cobranza y el runner nombran distinto lo que envejece');
  const ctx = { ws: 1, cuotaId: 9, texto: 't', aviso: { id: 'cuota-vencida', titulo: 'C' }, datos: { cuota_numero: '2', cuota_monto: 'US$ 1', cuota_dias: '3 días' } };
  assert.deepEqual(ctxParaDormir(ctx), { ...ctx, datos: { cuota_numero: '2', cuota_monto: 'US$ 1' } });
  const sin: { ws: number; datos?: Record<string, string> } = { ws: 1 };
  assert.equal(ctxParaDormir(sin), sin);
});

// ── Revisión del 11/10/2026 (lente motor y datos) ─────────────────────────────────────────────────
const filaCob = (pasos: PasoGrafo[], o: Partial<FilaParaRetomar> = {}): FilaParaRetomar => ({
  activa: true, archivada_at: null, pasos, trigger_tipo: TRIGGER_AVISO_MAKO, disparadores: [ev('cuota_vencida')], ...o,
});

test('una corrida dormida sigue SÓLO si la fila tiene la misma forma: con una CONDITION delante, la entrada saldría otra vez', () => {
  assert.equal(pasosDelEvento(COBRANZA, 'cuota_vencida').firma, FIRMA_COBRANZA);
  const igual = pasosParaRetomar(filaCob(COBRANZA), FIRMA_COBRANZA);
  assert.ok('pasos' in igual && igual.pasos.length === 5);
  // Un TEXTO editado en su lugar no es otra forma: sigue, con lo publicado ahora.
  const otroTexto = COBRANZA.map((p) => (p.id === 'mk_48' ? mako('mk_48', '💸 Texto nuevo {{cuota_numero}}', 'mk_e72') : p));
  const sigue = pasosParaRetomar(filaCob(otroTexto), FIRMA_COBRANZA);
  assert.ok('pasos' in sigue);
  assert.equal((sigue.pasos[2] as Extract<Paso, { tipo: 'mensaje' }>).texto, '💸 Texto nuevo {{cuota_numero}}');
  // EL REPRO DEL REVISOR: dormida en el índice 1 (el DELAY de 48 h), el negocio publica una CONDITION delante de la
  // entrada. Con los pasos de ahora, el índice 1 es la ENTRADA: `decidir` la ejecutaría otra vez.
  const conCond = [condicion('c1', [rama('c1_si', 'mk_entrada')], null), ...COBRANZA];
  const ahora = pasosDelEvento(conCond, 'cuota_vencida');
  assert.equal(ahora.problema, null);
  const d = decidir(ahora.pasos, { paso: 1, desde: new Date(Date.now() - 49 * 3_600_000), respondioAt: null, ahora: new Date(), hechos: null });
  assert.equal(d.que === 'ejecutar' && d.paso.tipo === 'mensaje' ? d.paso.texto : null, ENTRADA, 'sin la firma, la entrada salía de nuevo');
  assert.deepEqual(pasosParaRetomar(filaCob(conCond), FIRMA_COBRANZA), { corta: 'cambio' });
  // Sacar una tarjeta también corre la posición (saltea un recordatorio o adelanta el último).
  const sinEl48 = [mako('mk_entrada', ENTRADA, 'mk_e48'), esperar('mk_e48', 2880, 'mk_72'), mako('mk_72', A_72, null)];
  assert.deepEqual(pasosParaRetomar(filaCob(sinEl48), FIRMA_COBRANZA), { corta: 'cambio' });
  // Sin firma no se adivina; apagada y rota, como siempre.
  assert.deepEqual(pasosParaRetomar(filaCob(COBRANZA), undefined), { corta: 'cambio' });
  assert.deepEqual(pasosParaRetomar(filaCob(COBRANZA, { activa: false }), FIRMA_COBRANZA), { corta: 'apagada' });
  assert.deepEqual(pasosParaRetomar(filaCob(COBRANZA, { archivada_at: '2026-10-11T00:00:00Z' }), FIRMA_COBRANZA), { corta: 'apagada' });
  assert.deepEqual(pasosParaRetomar(null, FIRMA_COBRANZA), { corta: 'apagada' });
  assert.deepEqual(pasosParaRetomar(filaCob([mako('m1', 'A', 'w1'), whatsapp('w1', 'Hola', null)]), FIRMA_COBRANZA), { corta: 'rota' });
});

test('«no pude leer al lead» en una CONDITION se reintenta con tope corto; agotado, se rinde', () => {
  const t0 = new Date('2026-10-11T12:00:00Z');
  assert.deepEqual(reintentoDeHechos(undefined, t0), { que: 'reintentar', hasta: new Date(t0.getTime() + REINTENTO_HECHOS_MIN * 60_000), reintentos: 1 });
  assert.equal((reintentoDeHechos(1, t0) as { reintentos: number }).reintentos, 2);
  assert.deepEqual(reintentoDeHechos(TOPE_REINTENTOS_HECHOS, t0), { que: 'rendirse' });
  assert.deepEqual(reintentoDeHechos(TOPE_REINTENTOS_HECHOS + 4, t0), { que: 'rendirse' });
  assert.equal((reintentoDeHechos('dos', t0) as { reintentos: number }).reintentos, 1, 'basura = cero');
  assert.equal((reintentoDeHechos(-3, t0) as { reintentos: number }).reintentos, 1);
  // El mismo momento unos minutos después: más tarde, el texto armado ya habla de otro momento.
  assert.ok(TOPE_REINTENTOS_HECHOS * REINTENTO_HECHOS_MIN <= 15);
});

// ── 5. El emisor, ejecutado ──────────────────────────────────────────────────────────────────────

const CAT = { id: 'cuota-vencida', titulo: 'Cuota vencida → cobrar', categoria: 'accion' as const, semaforo: 'rojo' as const };
const fila = (id: number, o: Partial<FilaEvento> = {}): FilaEvento => ({
  id, nombre: `Cobranza ${id}`, activa: true, pasos: COBRANZA, trigger_tipo: TRIGGER_AVISO_MAKO,
  disparadores: [ev('cuota_vencida')], ...o,
});

function deps(o: { filas?: FilaEvento[]; tira?: boolean; gana?: boolean } = {}) {
  const anotado = { emitidos: [] as EmitirAvisoInput[], reclamos: [] as unknown[][], corridas: [] as Array<{ id: string; pasos: Paso[]; ctx: CtxFlujo }>, logs: [] as string[] };
  const d: DepsEvento = {
    leerFilas: async () => { if (o.tira) throw new Error('la base no contesta'); return o.filas ?? []; },
    emitirAviso: async (a) => { anotado.emitidos.push(a); return { ok: true, feedId: 7, wa: false, deduped: false, apagado: true }; },
    reclamar: async (...args) => { anotado.reclamos.push(args); return o.gana ?? true; },
    correr: async (id, pasos, _ws, ctx) => { anotado.corridas.push({ id, pasos, ctx }); },
    log: (m) => { anotado.logs.push(m); },
  };
  return { d, anotado };
}
const OPTS = { lead: { id: 42, nombre: 'Ana' }, datos: { cuota_numero: '2', cuota_dias: '3 días' }, dedupKey: 'cuota:5', dedupTtlMin: 999, cuotaId: 5 };

test('sin filas: el feed como apagado, SIN reclamar el dedup, y `deduped` (la cobranza no lo cuenta)', async () => {
  const { d, anotado } = deps();
  const r = await emitirPorEvento(CAT, 3, OPTS, d);
  assert.equal(r.ok, true);
  assert.equal(r.deduped, true);
  assert.equal(r.filas, 0);
  assert.equal(anotado.reclamos.length, 0, 'un apagado nunca se dijo: reclamar envenena la ventana');
  assert.equal(anotado.corridas.length, 0);
  assert.equal(anotado.emitidos.length, 1);
  assert.equal(anotado.emitidos[0].estado, APAGADO);
  assert.equal(anotado.emitidos[0].tipo, 'cuota-vencida');
  // Pausada o de OTRO evento cuentan como «no tiene».
  const b = deps({ filas: [fila(1, { activa: false }), fila(2, { disparadores: [ev('lead_contesta')] })] });
  assert.equal((await emitirPorEvento(CAT, 3, OPTS, b.d)).deduped, true);
  assert.equal(b.anotado.corridas.length, 0);
});

test('una lectura que FALLA no es «no tiene»: ok:false, sin feed, sin reclamar y sin correr', async () => {
  const { d, anotado } = deps({ tira: true });
  const r = await emitirPorEvento(CAT, 3, OPTS, d);
  assert.equal(r.ok, false);
  assert.deepEqual([anotado.emitidos.length, anotado.reclamos.length, anotado.corridas.length], [0, 0, 0]);
  assert.match(anotado.logs[0], /no pude leer/);
});

test('dos filas del MISMO evento: reclama UNA vez (la clave de siempre) y corren LAS DOS, con el contexto del evento', async () => {
  const { d, anotado } = deps({ filas: [fila(1), fila(2, { nombre: 'Otra' })] });
  const r = await emitirPorEvento(CAT, 3, { ...OPTS, texto: 'armado' }, d);
  assert.deepEqual(anotado.reclamos, [[3, 'cuota-vencida', 999, 'cuota:5']]);
  assert.deepEqual(anotado.corridas.map((c) => c.id), [idCorridaDeFila(1), idCorridaDeFila(2)]);
  assert.equal(filaDeIdCorrida('sec:2'), 2);
  assert.equal(filaDeIdCorrida('cuota-vencida'), null);
  const ctx = anotado.corridas[1].ctx;
  assert.deepEqual(ctx, {
    ws: 3, leadId: 42, leadNombre: 'Ana', cuotaId: 5, datos: OPTS.datos, texto: 'armado', aviso: { id: 'cuota-vencida', titulo: 'Otra' },
    // La forma de la fila viaja con la corrida: `retomarCorrida` la compara al despertar.
    firma: FIRMA_COBRANZA,
  });
  assert.equal(anotado.corridas[0].pasos.length, 5);
  assert.equal(anotado.emitidos.length, 0, 'el envío lo hace cada tarjeta, no el emisor');
  assert.deepEqual([r.ok, r.deduped, r.filas], [true, false, 2]);
});

test('el reclamo perdido corta TODO (deduped, cero corridas); una fila con problema se saltea y la otra corre', async () => {
  const perdido = deps({ filas: [fila(1), fila(2)], gana: false });
  const r = await emitirPorEvento(CAT, 3, OPTS, perdido.d);
  assert.deepEqual([r.ok, r.deduped, perdido.anotado.corridas.length], [true, true, 0]);
  const rota = deps({ filas: [fila(1, { pasos: [mako('m1', '{{mensaje_mako}}', null)] }), fila(2)] });
  const r2 = await emitirPorEvento(CAT, 3, OPTS, rota.d);
  assert.deepEqual(rota.anotado.corridas.map((c) => c.id), ['sec:2']);
  assert.equal(r2.filas, 1);
  assert.match(rota.anotado.logs[0], /#1 no corre/);
  // ⚠️ Y si NINGUNA se puede correr, es un apagado: no consume la ventana (en la cobranza, 120 días).
  const todas = deps({ filas: [fila(1, { pasos: [] })] });
  const r3 = await emitirPorEvento(CAT, 3, OPTS, todas.d);
  assert.deepEqual([r3.deduped, todas.anotado.reclamos.length, todas.anotado.emitidos[0]?.estado], [true, 0, APAGADO]);
});

test('el estado con que emite la tarjeta: por WhatsApp, sin email ni espaciado; el apagado, nada', () => {
  assert.deepEqual(ESTADO_EVENTO, { activo: true, wa: true, email: false, frecuenciaMin: 0 });
  assert.deepEqual(APAGADO, { activo: false, wa: false, email: false, frecuenciaMin: 0 });
});

// ── 6. El cableado ───────────────────────────────────────────────────────────────────────────────

const AVISOS = sinComentarios(leer('lib/avisos.ts'));
const FLUJOS = sinComentarios(leer('lib/flujos.ts'));
const NUT = sinComentarios(leer('lib/nutricion.ts'));

test('emitirDelCatalogo desvía los tres ANTES de leer el store, con el ws ya resuelto', () => {
  const f = bloque(AVISOS, 'export async function emitirDelCatalogo(', '\n}\n');
  const ws = f.indexOf('const ws = opts.ws ?? (await getWorkspaceActual()) ?? OWNER_WS;');
  // (15/10/2026: el de la PLATAFORMA sin su fila seguía al store. Desde el 16/10, tarde, NO: sin camino viejo, devuelve lo
  // que corrió también ahí — docs/inventario-nada-por-detras.md.)
  const desvio = f.indexOf('return emitirPorEvento(cat, ws, opts, await depsDelEvento());');
  assert.match(f, /if \(AVISOS_POR_EVENTO\.has\(id\)\) \{\n(\s*\/\/[^\n]*\n)*\s*return emitirPorEvento\(cat, ws, opts, await depsDelEvento\(\)\);/, 'el desvío tiene que devolver lo que corrió');
  const store = f.indexOf('getPlantilla');
  assert.ok(ws > 0 && desvio > ws, 'el desvío tiene que ir con el ws resuelto');
  assert.ok(store > desvio, 'el desvío va antes de getPlantilla');
  // Las filas, con el workspace EXPLÍCITO y sin las archivadas.
  const deps = bloque(AVISOS, 'async function depsDelEvento(', '\n}\n');
  assert.match(deps, /\.eq\('workspace_id', ws\)\.eq\('trigger_tipo', TRIGGER_AVISO_MAKO\)\.is\('archivada_at', null\)/);
  assert.match(deps, /if \(error\) throw new Error/);
  // emitirAviso con `estado`: ni el store ni la insistencia.
  const e = bloque(AVISOS, 'export async function emitirAviso(', '\n}\n');
  assert.match(e, /const canal = a\.estado \?\? await estadoAviso\(ws, a\.tipo\);/);
  assert.match(e, /if \(a\.alDueno !== true && !a\.estado\) \{/);
});

test('el runner: correrFlujoDe corta los tres, la tarjeta MaKo emite el aviso con su estado y «Lo que arma MaKo»', () => {
  assert.match(bloque(FLUJOS, 'export async function correrFlujoDe(', '\n}\n'), /^[^\n]*\n\s*if \(AVISOS_POR_EVENTO\.has\(avisoId\)\) return false;/);
  const paso = bloque(FLUJOS, 'async function ejecutarPaso(', '\nasync function emitirTarjetaDelEvento(');
  // Undécima tanda: con la lista de la tarjeta (`paso.partes`, la tarjeta TAL CUAL).
  assert.match(paso, /if \(paso\.canal === 'aviso_dueno'\) \{\n\s*const propio = [^\n]*\n(\s*\/\/[^\n]*\n)*\s*if \(ctx\.aviso\) \{ await emitirTarjetaDelEvento\(flujoId, \{ texto: propio, partes: paso\.partes, email: paso\.email \}, ws, ctx, ctx\.aviso\); return; \}/,
    'la tarjeta de un evento tiene que desviarse ANTES de la línea suelta al grupo');
  const tarjeta = bloque(FLUJOS, 'async function emitirTarjetaDelEvento(', '\n}\n');
  assert.match(tarjeta, /\[CLAVE_MENSAJE_MAKO\]: ctx\.texto/);
  // (16/10/2026: por email, el título y el estado son los del correo, `avisoPorEmail`; si no, los de siempre.)
  assert.match(tarjeta, /await emitirAviso\(\{\n\s*tipo: aviso\.id, titulo: porEmail\?\.titulo \?\? aviso\.titulo, texto,[\s\S]*estado: porEmail\?\.estado \?\? ESTADO_EVENTO,/);
  assert.doesNotMatch(tarjeta, /enviarAlGrupoMaKo|dedupTtlMin/, 'ni una línea suelta al grupo ni un dedup por tarjeta');
  // ⚠️ POR PARTES (undécima, decisión 2 de la décima): primero la guarda de la Voz de MaKo (`problemaDePartesGrupo`: un
  // audio del negocio sería la voz del dueño en el grupo), después TODOS los binarios bajados con los textos resueltos
  // con los MISMOS datos (`prepararPartesGrupo(tarjeta.partes, resolver)`), y sale tal cual: sin rótulo, con las partes.
  assert.match(tarjeta, /const ajena = await problemaDePartesGrupo\(tarjeta\.partes\);\n\s*if \(ajena\) \{[^\n]*return; \}/);
  assert.match(tarjeta, /const p = await prepararPartesGrupo\(tarjeta\.partes, resolver\);\n\s*if \(!p\.ok\) \{[^\n]*return; \}/, 'una tarjeta a medias salía igual');
  assert.ok(tarjeta.indexOf('problemaDePartesGrupo(') < tarjeta.indexOf('prepararPartesGrupo('), 'se bajaba un audio ajeno antes de mirar de quién es');
  // (15/10/2026: un evento de la PLATAFORMA resuelve y manda en el negocio que lo emitió, `negocioWs`.)
  assert.match(tarjeta, /const wsDestino = ctx\.negocioWs \?\? ws;\n\s*const resolver = \(t: string\) => conVariables\(t, \{ ws: wsDestino, leadId: ctx\.leadId \?\? null, leadNombre: ctx\.leadNombre \?\? null \}, datos\)/);
  assert.match(tarjeta, /categoria: cat\?\.categoria, semaforo: cat\?\.semaforo, ws: wsDestino,/);
  // (16/10/2026: por email, sin partes ni rótulo: tests/reporte-semanal-plataforma.test.ts.)
  assert.match(tarjeta, /: partes \? \{ partes, rotulo: false as const \} : \{\}\),/, 'la tarjeta por partes salía con el rótulo, o sin sus partes');
  // Los hechos se leen en la CONDITION, una vez, y van a `decidir`.
  const ej = bloque(FLUJOS, 'export async function ejecutarPasos(', '\n}\n');
  assert.match(ej, /if \(pasos\[i\]\?\.tipo === 'condicion' && hechos === undefined\) \{\n\s*const leidos = await hechosDeLaCorrida\(pasos, ws, ctx\);/);
  assert.match(ej, /hechos: hechos \?\? null/);
  const hech = bloque(FLUJOS, 'async function hechosDeLaCorrida(', '\n}\n');
  assert.match(hech, /hechosDeUnLead\(ws, ctx\.leadId, filas\)/);
  // ⚠️ «No pude leer» no es «no tiene» (revisión del 11/10/2026): el error vuelve 'ilegible' y la corrida se duerme EN
  // ESA CONDITION (con corrida, avanza a sí misma; sin, abre una con el contexto entero), en vez de terminar «hecha».
  assert.match(hech, /\} catch \(e\) \{\n[^\n]*\n\s*return 'ilegible';/);
  assert.match(ej, /if \(leidos === 'ilegible'\) \{[\s\S]*?const r = reintentoDeHechos\(ctx\.reintentos, new Date\(\)\);/);
  assert.match(ej, /if \(corridaId\) await avanzar\(ws, corridaId, i, i, r\.hasta, ctxR\);\n\s*else await abrirCorrida\(ws, flujoId, i, r\.hasta, ctxR, \{ reintento: true \}\);\n\s*return;/);
  // Retomar una corrida de fila relee LA FILA y decide `pasosParaRetomar` (apagada, rota u OTRA FORMA → cortada).
  const ret = bloque(FLUJOS, 'export async function retomarCorrida(', '\n}\n');
  assert.match(ret, /const r = pasosParaRetomar\(await runWithWorkspace\(ws, \(\) => filaParaRetomar\(filaId\)\), c\.ctx\.firma\);/);
  assert.match(ret, /if \('corta' in r\) \{[\s\S]*?await cerrarCorrida\(ws, c\.id, 'cortada'\);\n\s*return;\n\s*\}\n\s*await runWithWorkspace\(ws, \(\) => ejecutarPasos\(c\.avisoId, r\.pasos, ws, c\.ctx, c\)\);/);
  assert.match(bloque(FLUJOS, 'async function filaParaRetomar(', '\n}\n'), /if \(error\) throw new Error/, 'un bache de la base no corta la cadencia');
  // La corrida duerme sin lo que envejece, salvo un reintento (el mismo momento), y el reintento cuenta sus vueltas.
  const corr = sinComentarios(leer('lib/flujo-corridas.ts'));
  // (15/10/2026: y sin los datos SECRETOS, también en el reintento: `sinSecretos`, tests/email-persona.test.ts.)
  assert.match(corr, /desde_at: new Date\(\)\.toISOString\(\), ctx: sinSecretos\(o\?\.reintento \? ctx : ctxParaDormir\(ctx\)\),/);
  assert.match(bloque(corr, 'export async function avanzar(', '\n}\n'), /\.\.\.\(ctx \? \{ ctx: sinSecretos\(ctx\) \} : \{\}\),\n\s*\}\)\n\s*\.eq\('id', id\)\.eq\('paso', pasoViejo\)/);
});

test('los cinco llamadores de la reunión y la charla pasan el LEAD, y la cobranza pasa la cuota', () => {
  assert.match(sinComentarios(leer('lib/reunion-recordatorio.ts')), /emitirDelCatalogo\('reunion-recordatorio', \{ ws, texto, lead: \{ id: lead\.id, nombre: lead\.nombre \} \}\)/);
  assert.match(sinComentarios(leer('lib/chat-agent-handoff.ts')), /emitirDelCatalogo\('wa-mensaje-entrante', \{\n\s*ws: ws \?\? undefined,\n\s*lead: \{ id: input\.leadId, nombre: input\.leadNombre \?\? null \},/);
  const enNut = [...NUT.matchAll(/emitirDelCatalogo\('wa-mensaje-entrante', \{([\s\S]*?)\n\s*\}\);/g)].map((m) => m[1]);
  assert.equal(enNut.length, 3, 'lib/nutricion.ts emite la charla en tres lugares');
  for (const c of enNut) assert.match(c, /lead: \{ id: leadId, nombre: /, 'uno de los tres no pasa el lead');
  assert.match(sinComentarios(leer('app/api/cron/cobranza/route.ts')), /dedupKey: d\.dedupKey, dedupTtlMin: TTL_UNA_POR_CUOTA_MIN,\n\s*cuotaId: d\.cuota\.pago_id,/);
});

// GENERAL 7 de la décima tanda (docs/diseno-automations-galeria-v2.md §5): sin el lead, la CONDITION de la automatización
// no ve nada y `{{lead_nombre}}` o `{{link_lead}}` salen crudos. Son CUATRO: la R1 y la R2 de Calendly y de Cal.com.
test('los cuatro llamadores del nuevo agendado (Calendly y Cal.com, R1 y R2) pasan el LEAD y su texto', () => {
  for (const ruta of ['app/api/webhooks/calendly/route.ts', 'app/api/webhooks/calcom/route.ts']) {
    const llamadas = [...sinComentarios(leer(ruta)).matchAll(/emitirDelCatalogo\('reunion-nuevo-agendado', \{([\s\S]*?)\n\s*\}\);/g)].map((m) => m[1]);
    assert.equal(llamadas.length, 2, `${ruta}: no emite el agendado en dos lugares (R1 y R2)`);
    for (const c of llamadas) {
      assert.match(c, /\n\s*lead: \{ id: lead\.id, nombre(: | \})/, `${ruta}: uno de los dos no pasa el lead`);
      assert.match(c, /\n\s*texto: /, `${ruta}: uno de los dos no arma su texto («Lo que arma MaKo»)`);
    }
  }
});

test('el motor: no inscribe una fila del emisor, Publicar frena el evento y el CRON del emisor no se toca', () => {
  const ins = bloque(NUT, 'export async function inscribirEnSecuencia(', '\n}\n');
  assert.match(ins, /if \(TRIGGERS_DEL_EMISOR\.has\(s\.trigger_tipo\)\) return \{ inscribe: false, porque: 'del_emisor'/);
  const pub = bloque(NUT, 'export async function setSecuenciaPasos(', '\n}\n');
  assert.match(pub, /const delEvento = await frenoDeFilaEvento\(supabase, id, previo, grafo\);\n\s*if \(delEvento\) throw new PasosInvalidosError/);
  assert.ok(pub.indexOf('frenoDeFilaEvento(') < pub.indexOf('if (o?.soloValidar) return;'), 'Activar no lo frenaría');
  // El evento se lee de la lista de CRON, SÓLO para una fila de evento, y una lectura que falla tira.
  const freno = bloque(NUT, 'async function frenoDeFilaEvento(', '\n}\n');
  assert.match(freno, /!== TRIGGER_AVISO_MAKO\) return null;/);
  assert.match(freno, /\.select\('disparadores'\)\.eq\('id', id\)\.maybeSingle\(\);\n\s*if \(error\) throw new Error/);
  assert.match(freno, /return frenoDelEvento\(grafo, eventoDeFila\(/);
  assert.match(NUT, /if \(triggerTipo === 'aviso_mako'\) return \[\];/);
  // ⚠️ Y EL MOTOR NO LE CORRE NADA A UNA INSCRIPCIÓN DE UNA FILA DEL EMISOR (revisión del 11/10/2026): el encadenamiento
  // del desenlace y la API las crean sin pasar por las dos puertas de arriba. La cancela ANTES de los hilos y del cupo
  // (con el cupo lleno, la tarjeta MaKo —una ⚡ Acción— seguía corriendo).
  const motor = bloque(NUT, 'export async function procesarEnvios(', '\n}\n');
  const guarda = motor.indexOf('if (sec && TRIGGERS_DEL_EMISOR.has(sec.trigger_tipo)) {');
  assert.ok(guarda > 0, 'el motor no frena las filas del emisor');
  assert.ok(guarda < motor.indexOf('let hs = sanearHilos(insc.hilos);') && guarda < motor.indexOf('if (cupoLleno() && !(pasoLeido'), 'la guarda va antes de los hilos y del cupo');
  assert.match(motor.slice(guarda), /^[^\n]*\n\s*await escribir\(insc, \{ estado: 'cancelada', proximo_envio_at: null \}, \{ modo: 'fila', alcance: 'inscripcion' \}\);\n[\s\S]*?\n\s*continue;\n\s*\}/);
  const g = sinComentarios(leer('lib/disparadores-guardar.ts'));
  assert.equal([...g.matchAll(/const cambio = problemaDeCambio\(previos, lista\);\n\s*if \(cambio\) throw new TriggerInvalidoError/g)].length, 2, 'guardar y preparar');
  const s = sinComentarios(leer('lib/setting-secuencias.ts'));
  assert.match(bloque(s, 'export async function setCronSecuencia(', '\n}\n'), /await exigirQueNoSeaDelEmisor\(supabase, secuenciaId, 'setCronSecuencia'\);/);
  assert.match(bloque(s, 'async function escribirDisparador(', '\n}\n'), /await exigirQueNoSeaDelEmisor\(supabase, secuenciaId, quien\);/);
});

// ── Roturas (11/10/2026) ─────────────────────────────────────────────────────────────────────────
// Arnés en el scratchpad (aviso-evento-roturas.mjs), una por vez, restaurada DE MEMORIA (nunca `git checkout`)
// y verificada con md5, corriendo este archivo, tests/secuencia-duplicar y tests/nutricion-triggers-registros.
// Base: 40 / 0. Restaurado: 40 / 0.
//   R1. el dedup se reclama por FILA, adentro del bucle (la segunda fila la frena la primera)  → 38 / 2
//   R2. sin `if (triggerTipo === 'aviso_mako') return [];` en `cohorteDeTrigger`             → 39 / 1
//   R3. Duplicar sin la lista de CRON del emisor (la copia queda «Elige el evento»)            → 38 / 2 (los de duplicar)
//   R4. `decidir` SIGUE en la CONDITION sin hechos (lo que no se sabe se cumple)               → 39 / 1
//   R5. el alcance `mensaje` cae en `conCuota` (el bug de antes: cualquier cobranza lo ofrece) → 39 / 1
// Roturas de la revisión (11/10/2026, arnés revision-roturas.mjs, sólo este archivo). Base: 21 / 0. Restaurado: 21 / 0.
//   R6. `pasosParaRetomar` ignora la firma (la corrida sigue con cualquier forma)                → 20 / 1
//   R7. `reintentoDeHechos` sin tope (una lectura que falla siempre gira para siempre)              → 20 / 1
//   R8. «Lo que arma MaKo» después de un DELAY pasa                                                → 20 / 1
//   R9. el motor corre la inscripción de una fila del emisor (la condición de la guarda, apagada)  → 20 / 1
//   R10. un error leyendo al lead vuelve a ser null (la corrida termina «hecha» con el dedup gastado) → 20 / 1
// Roturas de la décima tanda (11/10/2026, arnés galeria10-roturas.mjs, sólo este archivo). Base: 22 / 0. Restaurado: 22 / 0.
//   R11. `reunion-nuevo-agendado` sin `textoDelCodigo` (lib/avisos-catalogo.ts)                     → 20 / 2 (los datos del
//        «{ }» y las plantillas que traducen: sin la marca, `{{mensaje_mako}}` no se ofrece y el freno rechaza la plantilla)
// Roturas de la undécima tanda (11/10/2026, arnés scratchpad/wf-undecima/w1-datos-catalogo/romper.mjs, restaurado
// con md5), corriendo este archivo con tests/tokens-del-flujo. Base: 28 / 0. Restaurado: 28 / 0.
//   R9u.  `datosDelEvento` sin `conPago` (el pago no se ofrece ni se valida en «Entra un pago»)  → 26 / 2
//   R10u. «Un lead contesta» sin `escrito` en lo que trae (lib/disparadores.ts)                   → 26 / 2

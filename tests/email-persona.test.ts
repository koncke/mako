// =============================================================================
// «Email a la persona» y el dato SECRETO: restablecer la contraseña por Automations (15/10/2026)
// =============================================================================
// La contraseña es obligatoria desde el 21/10 (decisión de Martín) y «Olvidé mi contraseña» necesita un mail a ESA
// persona con un link de UN uso. Todo por Automations: Seguridad emite el evento `contrasena_restablecer` en el ws de la
// plataforma y la automatización de SuperAdmin manda el «Email a la persona» por el remitente de MaKo. El contrato del
// secreto (acordado con Ciberseguridad): no se guarda nunca, no va al feed ni al grupo, no hay DELAY, y Publicar exige
// el link en el cuerpo. Diseño: docs/diseno-2fa-obligatorio.md §8.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.
//
// Correr: node --import tsx --test tests/email-persona.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pasosDelEvento, datosDeLaPersona, datosDelEvento, MOTIVO_EVENTO } from '../lib/aviso-evento';
import { EVENTOS_MAKO, eventosOfrecidos } from '../lib/disparadores';
import { sinSecretos, CLAVES_SECRETAS, variablesPara } from '../lib/variables-aviso';
import { problemasDeTokens, contextoDeTarjeta } from '../lib/tokens-del-flujo';
import { enviarEmailAPersona, sinValoresSecretos, type DepsEmailPersona, type PasoEmailPersona } from '../lib/email-persona';
import { PLANTILLAS, PLANTILLAS_PLATAFORMA, plantillasPara } from '../lib/plantillas-automatizaciones';
import { crearDesdePlantilla, PlantillaInvalidaError, type DepsPlantilla } from '../lib/plantilla-crear';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const RELLENO = { orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, proveedor: 'no_oficial' } as const;
const email = (id: string, asunto: string, cuerpo: string, siguiente: string | null, extra: Record<string, unknown> = {}): PasoGrafo =>
  ({ ...RELLENO, id, canal: 'email', asunto, cuerpo, siguiente, ...extra }) as PasoGrafo;
const mako = (id: string, mensaje: string, siguiente: string | null): PasoGrafo =>
  ({ ...RELLENO, id, siguiente, accion: { operacion: 'avisar_al_equipo', params: { mensaje } } }) as PasoGrafo;
const esperar = (id: string, siguiente: string | null): PasoGrafo => ({ ...RELLENO, id, nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente }) as PasoGrafo;
const LINK = 'https://hola-mako.com/restablecer?t=SECRETO-123';
const BIEN = 'Entra aquí: {{link_restablecer}}';
const EV = 'contrasena_restablecer';

test('el evento de una persona: declara el propósito, sólo la plataforma lo ve en el CRON', () => {
  const ev = EVENTOS_MAKO.find((e) => e.subtipo === EV);
  assert.equal(ev?.persona, 'restablecer', 'el propósito tiene que venir DECLARADO del evento');
  assert.ok(!eventosOfrecidos('mako', null).some((e) => e.subtipo === EV), 'un negocio ve en el CRON un evento que nunca le llega');
  assert.ok(eventosOfrecidos('mako', null, { plataforma: true }).some((e) => e.subtipo === EV));
  assert.ok(eventosOfrecidos('mako', EV).some((e) => e.subtipo === EV), 'el ya elegido se tiene que seguir viendo');
});

test('el mail a la persona se traduce al runner con su propósito; lo demás se frena con su motivo', () => {
  const t = pasosDelEvento([email('e1', 'Tu link', BIEN, null)], EV);
  assert.equal(t.problema, null);
  assert.deepEqual(t.pasos, [{ tipo: 'email_persona', asunto: 'Tu link', texto: BIEN, proposito: 'restablecer' }]);
  const caso = (pasos: PasoGrafo[], motivo: string, tarjeta: string | null) => {
    const r = pasosDelEvento(pasos, EV);
    assert.equal(r.problema, motivo);
    assert.equal(r.tarjeta, tarjeta);
  };
  caso([esperar('d1', 'e1'), email('e1', 'Tu link', BIEN, null)], MOTIVO_EVENTO.secretoDelay, 'd1');
  caso([email('e1', 'Tu link', BIEN, 'd1'), esperar('d1', null)], MOTIVO_EVENTO.secretoDelay, 'd1');
  // Suelto (sin conectar) también: el motivo es el del secreto, no «hay tarjetas que no salen».
  caso([email('e1', 'Tu link', BIEN, null), esperar('d1', null)], MOTIVO_EVENTO.secretoDelay, 'd1');
  caso([{ ...RELLENO, id: 'w1', cuerpo: BIEN, siguiente: null } as PasoGrafo], MOTIVO_EVENTO.soloEmail, 'w1');
  caso([mako('m1', 'Alguien pidió restablecer', null)], MOTIVO_EVENTO.sinEmail, null);
  caso([email('e1', 'Tu link', 'Hola, sin link', null)], MOTIVO_EVENTO.sinSecreto, 'e1');
  caso([email('e1', 'Tu link {{link_restablecer}}', BIEN, null)], MOTIVO_EVENTO.secretoFuera, 'e1');
  caso([email('e1', 'Tu link', BIEN, null, { preheader: '{{link_restablecer}}' })], MOTIVO_EVENTO.secretoFuera, 'e1');
  caso([email('e1', 'Tu link', BIEN, 'm1'), mako('m1', 'Le mandé {{link_restablecer}}', null)], MOTIVO_EVENTO.secretoFuera, 'm1');
  caso([email('e1', 'Tu link', BIEN, null, { tipo: 'ia' })], MOTIVO_EVENTO.emailIA, 'e1');
  caso([email('e1', '', BIEN, null)], MOTIVO_EVENTO.sinAsunto, 'e1');
  caso([{ ...RELLENO, id: 'c1', nodo: 'condicion', ramas: [{ id: 'r', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'e1' }], si_no: null } as PasoGrafo, email('e1', 'Tu link', BIEN, null)], MOTIVO_EVENTO.condicionPersona, 'c1');
  // Un evento de un LEAD sigue sin escribirle a nadie por email.
  assert.equal(pasosDelEvento([email('e1', 'Hola', 'Hola', null)], 'pago_recibido').problema, MOTIVO_EVENTO.alLead);
});

test('el secreto: sólo para el mail a la persona, y nunca en lo que se guarda', () => {
  assert.ok(CLAVES_SECRETAS.has('link_restablecer'));
  const ctx = { ws: 9, datos: { usuario_id: '7', link_restablecer: LINK } };
  assert.deepEqual(sinSecretos(ctx).datos, { usuario_id: '7' });
  const sin = { ws: 9, datos: { usuario_id: '7' } };
  assert.equal(sinSecretos(sin), sin, 'sin secretos tiene que devolver el MISMO contexto');
  // El «{ }»: el link se ofrece en el mail a la persona y en ningún otro lado.
  assert.ok(variablesPara(datosDeLaPersona(EV)!).some((v) => v.key === 'link_restablecer'));
  assert.ok(!variablesPara(datosDelEvento(EV)).some((v) => v.key === 'link_restablecer'), 'el link se ofrece en la tarjeta del grupo');
  assert.equal(datosDeLaPersona('pago_recibido'), null);
  // Publicar: el email de la persona lo resuelve; en el grupo, no.
  assert.equal(contextoDeTarjeta(email('e1', 'Tu link', BIEN, null), { trigger_tipo: 'aviso_mako', subtipo: EV })?.tipo, 'catalogo');
  assert.deepEqual(problemasDeTokens([email('e1', 'Tu link', BIEN, null)], 'aviso_mako', EV), []);
  assert.equal(problemasDeTokens([mako('m1', BIEN, null)], 'aviso_mako', EV).length, 1, 'el link en el grupo pasa Publicar');
});

test('lo que se GUARDA de una corrida pasa por sinSecretos, también en el reintento', () => {
  const src = sinComentarios(leer('lib/flujo-corridas.ts'));
  assert.match(src, /ctx: sinSecretos\(o\?\.reintento \? ctx : ctxParaDormir\(ctx\)\)/);
  assert.match(src, /\.\.\.\(ctx \? \{ ctx: sinSecretos\(ctx\) \} : \{\}\)/);
});

// ── El envío, con todo de mentira ─────────────────────────────────────────────────────────────────
const PASO: PasoEmailPersona = { tipo: 'email_persona', asunto: 'Tu link', texto: BIEN, proposito: 'restablecer' };
function deps(o: Partial<DepsEmailPersona> = {}) {
  const enviados: Array<{ to: string; subject: string; html: string; text: string }> = [];
  const grupo: string[] = [];
  const logs: string[] = [];
  const pedidos: Array<[number, string]> = [];
  const d: DepsEmailPersona = {
    destino: async (uid, p) => { pedidos.push([uid, p]); return 'ana@ejemplo.com'; },
    valores: async (_t, datos) => ({ ...datos }),
    enviar: async (m) => { enviados.push(m); return { ok: true, id: 'r1' }; },
    alGrupo: async (t) => { grupo.push(t); },
    log: (m) => { logs.push(m); },
    ...o,
  };
  return { d, enviados, grupo, logs, pedidos };
}
const CTX = { datos: { usuario_id: '7', link_restablecer: LINK } };

test('sale a la persona, con el propósito del evento, el link en el cuerpo y nada en el grupo', async () => {
  const x = deps();
  assert.equal(await enviarEmailAPersona(PASO, CTX, x.d), 'enviado');
  assert.deepEqual(x.pedidos, [[7, 'restablecer']]);
  assert.equal(x.enviados.length, 1);
  assert.equal(x.enviados[0].to, 'ana@ejemplo.com');
  assert.equal(x.enviados[0].subject, 'Tu link');
  assert.ok(x.enviados[0].text.includes(LINK));
  assert.ok(x.enviados[0].html.includes('SECRETO-123'));
  assert.deepEqual(x.grupo, []);
  assert.ok(!x.logs.join('\n').includes('SECRETO-123'));
});

test('sin persona o sin correo no sale; «no pude leer» y un error lo dicen al grupo SIN el link', async () => {
  let x = deps();
  assert.equal(await enviarEmailAPersona(PASO, { datos: { link_restablecer: LINK } }, x.d), 'sin_usuario');
  assert.equal(x.enviados.length, 0);
  x = deps({ destino: async () => null });
  assert.equal(await enviarEmailAPersona(PASO, CTX, x.d), 'sin_destino');
  assert.deepEqual(x.grupo, [], 'una cuenta sin correo no es un error del envío');
  x = deps({ destino: async () => { throw new Error('la base no contestó'); } });
  assert.equal(await enviarEmailAPersona(PASO, CTX, x.d), 'ilegible');
  assert.equal(x.enviados.length, 0);
  assert.equal(x.grupo.length, 1);
  // Un error que repite el cuerpo (con el link adentro) sale tapado.
  x = deps({ enviar: async () => ({ ok: false, error: `rechazado: ${LINK}` }) });
  assert.equal(await enviarEmailAPersona(PASO, CTX, x.d), 'no_salio');
  assert.ok(x.grupo[0].includes('[oculto]'));
  assert.ok(!x.grupo.join('\n').includes('SECRETO-123'), 'el link llegó al grupo');
  assert.ok(!x.logs.join('\n').includes('SECRETO-123'), 'el link llegó al log');
  assert.equal(sinValoresSecretos(`a ${LINK} b`, { link_restablecer: LINK, usuario_id: '7' }), 'a [oculto] b');
});

test('el runner lo manda por el remitente de MaKo, al destino de Seguridad con el propósito del paso', () => {
  const src = sinComentarios(leer('lib/flujos.ts'));
  assert.match(src, /destino: \(uid, proposito\) => destinoDeUsuario\(uid, 'email', proposito\)/);
  assert.match(src, /sendEmail\(\{ \.\.\.m, from: REMITENTE_MAKO/);
});

test('la plantilla «Restablecer Contraseña»: de SuperAdmin, publicable, y un negocio no la crea', async () => {
  const p = PLANTILLAS_PLATAFORMA.find((x) => x.id === 'seguridad-restablecer');
  assert.ok(!PLANTILLAS.some((x) => x.id === 'seguridad-restablecer'), 'la de SuperAdmin se metió en la galería de los negocios');
  assert.ok(p?.soloPlataforma);
  assert.equal(p!.cron.evento, EV);
  assert.equal(pasosDelEvento(p!.pasos as PasoGrafo[], EV).problema, null, 'la plantilla no se puede publicar');
  assert.deepEqual(problemasDeTokens(p!.pasos as PasoGrafo[], 'aviso_mako', EV), []);
  assert.ok(!plantillasPara({ plataforma: false }).some((x) => x.id === p!.id), 'un negocio la ve en la galería');
  assert.ok(plantillasPara({ plataforma: true }).some((x) => x.id === p!.id));
  const nada = {} as DepsPlantilla;
  await assert.rejects(crearDesdePlantilla(p!.id, nada), PlantillaInvalidaError);
  await assert.rejects(crearDesdePlantilla(p!.id, { ...nada, plataforma: false }), PlantillaInvalidaError);
});

// ── ROTURAS (15/10/2026) ────────────────────────────────────────────────────────────────────────
// Con el arnés del scratchpad (rompe UNA, corre este archivo, restaura DE MEMORIA; nunca git). Base: 8 / 0. Cada una dio
// 7 / 1: `sinSecretos` sin sacar nada · `abrirCorrida` guardando el secreto · un DELAY con secreto que pasa · el secreto
// en la tarjeta del grupo · el secreto en el asunto · el mail sin el link · el error al grupo con el link adentro · el
// destino con un propósito fijo en vez del del paso · el evento de una persona ofrecido en cualquier negocio · un negocio
// que crea la plantilla de SuperAdmin · el runner sin el remitente de MaKo. Restaurado: 8 / 0.
// ⚠️ La primera vuelta encontró una rotura que NO fallaba: el freno del DELAY estaba DOS veces (en el barrido y en el
// recorrido) y el segundo tapaba al primero. Quedó uno, el del barrido, que también ve un DELAY suelto (caso de arriba).

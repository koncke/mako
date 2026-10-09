// =============================================================================
// «Probar» decide cada condición como un lead RECIÉN LLEGADO (quinta tanda, punto 1)
// =============================================================================
// Pedido de Martín (09/10/2026), textual: «al darle probar en la automatización de bienvenida, no
// salió el mensaje que debería salir en la prueba, si es por el delay, evidentemente no debe tardar
// nada, con el aviso en el chat de "Esperar 1 h" ya se entiende».
//
// MEDIDO antes de tocar nada, con la Bienvenida del ws1 (docs/relevo/chatbot-secuencias.json, M2) y la
// regla de la cuarta tanda (cada condición por su PRIMERA rama): «Esperar 1 h» → el «Sí» de «Agendó»
// → «↪ Sigue en «Agendó: confirmar y preparar»». Ningún mensaje. La espera no era (ya no espera): era
// la rama. Este test EJECUTA el recorrido con las dos reglas sobre ese mismo flujo, y fija lo que el
// lead nuevo sabe y no sabe (lib/simulador-grafo.ts: `hechosDeLeadNuevo`, `elegirComoLead`,
// `leadNuevoDelCron`), y los destinos guardados de quien prueba (`destinosGuardados`, `perfilConDestino`).
//
// PROBADO ROMPIÉNDOLO (09/10/2026, arnés del scratchpad: una rotura por vez, restaurada DE MEMORIA;
// base 8 / 8): ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { PasoGrafo } from '../lib/flujo-grafo';
import {
  flujoParaProbar, iniciar, siguiente, elegir, hechosDeLeadNuevo, elegirComoLead, leadNuevoDelCron,
  destinosGuardados, perfilConDestino, CLAVE_DESTINOS_PRUEBA, TOPE_DESTINOS_GUARDADOS,
  type EstadoSim, type LeadNuevoPrueba,
} from '../lib/simulador-grafo';
import { cumpleFila } from '../lib/flujo-grafo';

const spec = JSON.parse(readFileSync(new URL('../docs/relevo/chatbot-secuencias.json', import.meta.url), 'utf8').replace(/\r\n/g, '\n')) as Record<string, Array<Record<string, unknown>>>;
const BIENVENIDA = flujoParaProbar(
  spec.M2_bienvenida_198_con_email.map((p, i) => ({ orden: i + 1, delay_horas: 0, asunto: null, template_wa: null, cuerpo: '', ...p }) as PasoGrafo),
  null,
).pasos;

/** El recorrido con una regla para las condiciones: lo que se VE, en orden. */
function recorrer(pasos: readonly PasoGrafo[], decidir: (st: EstadoSim) => EstadoSim): string[] {
  const vistos: string[] = [];
  let st = iniciar(pasos);
  for (let k = 0; k < 80; k++) {
    const r = siguiente(pasos, st, { secuencia: () => 'Agendó: confirmar y preparar' });
    st = r.estado;
    const e = r.evento;
    if (!e) break;
    if (e.t === 'mensaje') vistos.push(`${e.paso.canal}:${e.nodo}`);
    else if (e.t === 'condicion') st = decidir(st);
    else vistos.push(e.texto);
    if (e.t === 'fin') break;
  }
  return vistos;
}

const comoLeadNuevo = (extra: LeadNuevoPrueba = {}) => (st: EstadoSim) => elegirComoLead(BIENVENIDA, st, hechosDeLeadNuevo(extra)).estado;

test('la Bienvenida, MEDIDA: por el «Sí» no salía ningún mensaje; como lead nuevo sale el audio', () => {
  // La regla de la cuarta tanda, tal cual: la primera rama.
  const porElSi = recorrer(BIENVENIDA, (st) => elegir(st, st.eligiendo!.opciones[0].puerto));
  assert.deepEqual(porElSi, ['⏳ Esperar 1 h', '↪ Sigue en «Agendó: confirmar y preparar»'], 'cambió lo medido: revisar el diagnóstico');
  // La regla nueva: el motor decide con un lead que acaba de entrar.
  const nuevo = recorrer(BIENVENIDA, comoLeadNuevo());
  assert.equal(nuevo[0], '⏳ Esperar 1 h', 'la espera se DICE y se sigue');
  assert.equal(nuevo[1], 'whatsapp:b_audio1', 'después de la espera, el audio de bienvenida');
  assert.ok(!nuevo.some((v) => v.startsWith('↪ Sigue en')), 'un lead nuevo no agendó: no salta a «Agendó»');
  // Y el email del día 3 también llega: tiene email y no agendó.
  assert.ok(nuevo.includes('email:b_email1'), `sin el primer email: ${nuevo.join(' | ')}`);
});

test('un lead nuevo: sin agenda, sin pago, sin respuesta, llegado AHORA; con teléfono y email', () => {
  const h = hechosDeLeadNuevo({ ahoraMs: 1_000_000 });
  assert.equal(h.agendo, false);
  assert.equal(h.pago, false);
  assert.equal(h.respondio, false);
  assert.equal(h.yaContactado, false);
  assert.equal(h.creadoMs, 1_000_000, 'llegó ahora: «llegó hace menos de N h» se cumple');
  assert.equal(cumpleFila({ campo: 'antiguedad', valor: 72 }, h), true);
  assert.equal(cumpleFila({ campo: 'agendo', no: true }, h), true, '«No agendó» es verdad para un lead nuevo');
  assert.equal(cumpleFila({ campo: 'tiene_telefono' }, h), true);
  // Lo que la prueba misma produjo también cuenta.
  const despues = hechosDeLeadNuevo({ yaContactado: true, respondio: true });
  assert.equal(cumpleFila({ campo: 'ya_contactado' }, despues), true);
  assert.equal(cumpleFila({ campo: 'respondio' }, despues), true);
});

test('el catálogo va con CEROS, no ausente: una condición negada se cumple («No reprodujo el VSL»)', () => {
  const h = hechosDeLeadNuevo();
  assert.equal(cumpleFila({ campo: 'reprodujo_vsl', no: true }, h), true, 'ausente, «No reprodujo» nunca se cumpliría');
  assert.equal(cumpleFila({ campo: 'reprodujo_vsl' }, h), false);
  assert.equal(cumpleFila({ campo: 'reunion_agendada' }, h), false, 'un lead nuevo no tiene reunión');
  assert.equal(cumpleFila({ campo: 'hizo_clic', no: true }, h), true);
});

test('quién entra según el CRON: por etapa, en esa etapa; por etiqueta, con la etiqueta; por otra cosa, nada', () => {
  const porEtapa = hechosDeLeadNuevo(leadNuevoDelCron({ trigger_tipo: 'etapa_actual', etapa: 'nuevo', funnel_id: 4 }));
  assert.equal(cumpleFila({ campo: 'etapa', valor: 'nuevo' }, porEtapa), true);
  assert.equal(cumpleFila({ campo: 'etapa', valor: 'nuevo', funnel_id: 4 }, porEtapa), true);
  const porEtiqueta = hechosDeLeadNuevo(leadNuevoDelCron({ trigger_tipo: 'etiqueta_puesta', etiqueta_id: 9 }));
  assert.equal(cumpleFila({ campo: 'etiqueta', valor: 9 }, porEtiqueta), true);
  assert.equal(cumpleFila({ campo: 'etiqueta', valor: 8 }, porEtiqueta), false);
  const porEntrega = leadNuevoDelCron({ trigger_tipo: 'entrega_actual', etapa: 'onboarding', producto_id: 3 });
  assert.deepEqual([...(hechosDeLeadNuevo(porEntrega).catalogo?.entrega ?? [])], ['3:onboarding']);
  assert.equal(hechosDeLeadNuevo(porEntrega).etapa, null, 'la de entrega no es una etapa de la casa');
  assert.deepEqual(leadNuevoDelCron({ trigger_tipo: 'manual', etapa: 'manual' }), {});
});

test('elegirComoLead: decide con la MISMA función del motor y, sin la tarjeta, sigue por el «Si no»', () => {
  const pasos: PasoGrafo[] = [
    { id: 'c', nodo: 'condicion', canal: 'whatsapp', cuerpo: '', ramas: [{ id: 'r', modo: 'todas', filas: [{ campo: 'pago' }], siguiente: 'a' }], si_no: 'b' },
    { id: 'a', canal: 'whatsapp', cuerpo: 'pagó', siguiente: null },
    { id: 'b', canal: 'whatsapp', cuerpo: 'no pagó', siguiente: null },
  ];
  const parado = siguiente(pasos, iniciar(pasos)).estado;
  assert.ok(parado.eligiendo);
  const r = elegirComoLead(pasos, parado, hechosDeLeadNuevo());
  assert.equal(r.opcion?.puerto, 'si_no');
  assert.equal((siguiente(pasos, r.estado).evento as { nodo?: string } | null)?.nodo, 'b');
  const pago = elegirComoLead(pasos, parado, { ...hechosDeLeadNuevo(), pago: true });
  assert.equal(pago.opcion?.puerto, 'r', 'con el dato cambiado, cambia la rama: no es «siempre el Si no»');
  const sinTarjeta = elegirComoLead([], parado, hechosDeLeadNuevo());
  assert.equal(sinTarjeta.opcion?.puerto, 'si_no');
  assert.equal(elegirComoLead(pasos, iniciar(pasos), hechosDeLeadNuevo()).opcion, null, 'sin condición pendiente no elige nada');
});

// ── Los destinos guardados de quien prueba ───────────────────────────────────────────────────

test('los guardados: el teléfono y el email de su perfil PRIMERO, después los suyos, sin repetir', () => {
  // El de su perfil NO es el primero de los guardados: así se ve que va adelante (y no por casualidad).
  const u = { email: 'Yo@Mio.com', perfil: { telefono: '+52 55 9999 9999', [CLAVE_DESTINOS_PRUEBA]: { telefonos: ['5491125052605', '525599999999', 'x'], emails: ['otra@mia.com', 'yo@mio.com'] } } };
  assert.deepEqual(destinosGuardados(u), { telefonos: ['525599999999', '5491125052605'], emails: ['yo@mio.com', 'otra@mia.com'] });
  assert.deepEqual(destinosGuardados(null), { telefonos: [], emails: [] });
  assert.deepEqual(destinosGuardados({ perfil: { [CLAVE_DESTINOS_PRUEBA]: 'roto' } }), { telefonos: [], emails: [] });
});

test('guardar uno: va primero, sin repetir, con tope, y el resto del perfil viaja INTACTO', () => {
  const perfil = { telefono: '5491100000000', notifInApp: { popup: true }, [CLAVE_DESTINOS_PRUEBA]: { telefonos: ['5215511111111'], emails: [] } };
  const p = perfilConDestino(perfil, { telefono: '+52 55 2222 2222' })!;
  assert.deepEqual(p.notifInApp, { popup: true }, 'partir de {} borraba lo demás del jsonb');
  assert.equal(p.telefono, '5491100000000');
  assert.deepEqual((p[CLAVE_DESTINOS_PRUEBA] as { telefonos: string[] }).telefonos, ['525522222222', '5215511111111']);
  // El mismo otra vez sube al principio, no se duplica.
  const otra = perfilConDestino(p, { telefono: '5215511111111' })!;
  assert.deepEqual((otra[CLAVE_DESTINOS_PRUEBA] as { telefonos: string[] }).telefonos, ['5215511111111', '525522222222']);
  let muchos: Record<string, unknown> = {};
  for (let i = 0; i < TOPE_DESTINOS_GUARDADOS + 3; i++) muchos = perfilConDestino(muchos, { email: `p${i}@x.com` })!;
  assert.equal((muchos[CLAVE_DESTINOS_PRUEBA] as { emails: string[] }).emails.length, TOPE_DESTINOS_GUARDADOS);
  assert.equal(perfilConDestino(perfil, { telefono: '123' }), null, 'un número que no sirve no se guarda');
  assert.equal(perfilConDestino(perfil, { email: 'no-es-un-mail' }), null);
});

test('el panel y la ruta: la condición la decide el lead nuevo, y los guardados son de QUIEN PRUEBA', () => {
  const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const panel = sinComentarios(readFileSync(new URL('../app/chatbot/PanelProbar.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n'));
  const caso = panel.slice(panel.indexOf("case 'condicion': {"), panel.indexOf("case 'fin':"));
  assert.ok(caso.length > 50 && caso.length < 700, `el recorte mide ${caso.length}`);
  assert.match(caso, /elegirComoLead\(flujoRef\.current, simRef\.current, hechosDeLeadNuevo\(\{/);
  assert.match(caso, /yaContactado: huboMensaje\.current, respondio: turnoLead\.current > 0/);
  assert.doesNotMatch(caso, /opciones\[0\]/, 'volvió «siempre el Sí»');
  // El «ya le escribimos» se marca con CUALQUIER mensaje, antes de filtrar por canal.
  const msj = panel.slice(panel.indexOf("case 'mensaje': {"), panel.indexOf("if (delPaso !== ctx.current.canal)"));
  assert.match(msj, /huboMensaje\.current = true;/);
  const ruta = sinComentarios(readFileSync(new URL('../app/api/chat-agent/simulador/route.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n'));
  const guardar = ruta.slice(ruta.indexOf("if (body.action === 'guardar-destino')"), ruta.indexOf('const id = Number(body.secuenciaId);\n    if (!Number.isFinite(id)) return json({ ok: false, error: \'secuenciaId inválido\' }, 400);\n    const historial'));
  assert.ok(guardar.indexOf("if (a.rol !== 'admin')") >= 0 && guardar.indexOf("if (a.rol !== 'admin')") < guardar.indexOf('guardarDestinoDeQuienPrueba('), 'sólo el admin guarda');
  assert.match(guardar, /const sesion = await getUsuarioActual\(\);/, 'por el email de SU sesión');
  const prueba = sinComentarios(readFileSync(new URL('../lib/prueba-paso.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n'));
  const escribir = prueba.slice(prueba.indexOf('export async function guardarDestinoDeQuienPrueba('), prueba.indexOf('export type ResultadoPruebaPaso'));
  assert.match(escribir, /const u = await buscarUsuarioPorEmail\(email\);/);
  assert.match(escribir, /\.from\('usuarios'\)\s*\.update\(\{ perfil, updated_at: new Date\(\)\.toISOString\(\) \}\)\.eq\('id', /);
  assert.doesNotMatch(escribir, /setSetting|setContactoReportes|getPerfil|getTenantDb/, 'los guardados son de la PERSONA, no del negocio');
});

// ── ROTURAS (09/10/2026) ───────────────────────────────────────────────────────────────────────
// Cada una sola, restaurada de memoria (md5 verificado); base 8 pass / 0 fail. Las 9 cayeron:
//   1. `elegirComoLead` siempre por la primera opción (la regla vieja)            → 6 / 2.
//   2. `hechosDeLeadNuevo` con `agendo: true`                                      → 6 / 2.
//   3. `hechosDeLeadNuevo` sin el bloque `catalogo` (ausente en vez de ceros)       → 6 / 2.
//   4. `leadNuevoDelCron` sin la etiqueta del CRON                                  → 7 / 1.
//   5. `destinosGuardados` con el teléfono del perfil al final                      → 7 / 1.
//      ⚠️ La PRIMERA versión de ese test no la cazaba (8 / 0): el teléfono del perfil era también
//      el primero de los guardados, así que el orden salía bien por casualidad.
//   6. lo mismo con el email de su sesión                                          → 7 / 1.
//   7. `perfilConDestino` partiendo de {} (pierde `notifInApp`)                    → 7 / 1.
//   8. el panel decidiendo con `evento.opciones[0]` otra vez                        → 7 / 1.
//   9. la ruta guardando sin el guard de admin                                     → 7 / 1.

// =============================================================================
// «PROBAR»: EL GRUPO DE WHATSAPP DE MaKo COMO PRIMER CONTACTO (16/10/2026)
// =============================================================================
// Feedback de Martín del 16/10 (por Cerebro, punto 3), textual: «En todas las automatizaciones de WhatsApp que haya un
// paso del grupo de WhatsApp de MaKo, debería salir como primer contacto, con el nombre real del grupo... Y al
// reproducir cada caso, MaKo debería enviar el mensaje correspondiente».
//
// Lo que se fija:
//   · qué tarjeta le escribe al grupo (la «MaKo en WhatsApp»; la que va por email, no) — `vaAlGrupo`;
//   · el nombre: el REAL; si no se pudo leer, uno que no finge serlo; en SuperAdmin, el de cada negocio;
//   · lo que le llega, como lo arma el motor: las partes tal cual con los datos de ejemplo, o el texto envuelto de antes;
//   · el simulador le pasa la tarjeta al panel, y el panel la manda al chat del grupo, nunca al grupo de verdad;
//   · la lista: el grupo PRIMERO, con sus no leídos, también en la fila de fotos.
//
// ⚠️ PROBADO ROMPIENDO (16/10/2026, scratchpad romper-grupo.mjs; base 6 pass / 0 fail, 8 roturas, todas atajadas). El
// resultado MEDIDO de cada rotura, al lado de su test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PasoGrafo } from '../lib/flujo-grafo';
import { iniciar, siguiente, textoDeEjemplo } from '../lib/simulador-grafo';
import {
  vaAlGrupo, avisaAlGrupo, nombreDelGrupo, loQueLlegaAlGrupo, NOMBRE_GRUPO_SIN_LEER, NOMBRE_GRUPO_DE_CADA_NEGOCIO,
} from '../lib/probar-grupo';
import { BarraEscenarios } from '../app/automations/PanelProbar';

const leer = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const PANEL = leer('app/automations/PanelProbar.tsx');
const RUTA = leer('app/api/chat-agent/simulador/route.ts');

const base = { canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, template_wa: null } as const;
const tarjeta = (id: string, params: Record<string, unknown>, siguiente: string | null = null): PasoGrafo =>
  ({ ...base, id, cuerpo: '', accion: { operacion: 'avisar_al_equipo', params }, siguiente }) as PasoGrafo;
const DE_HOY = tarjeta('k1', { mensaje: 'Agendó {{nombre}}', partes: [{ tipo: 'texto', cuerpo: 'Agendó {{nombre}}' }, { tipo: 'audio', audio_id: 7 }, { tipo: 'media', media_id: 9, cuerpo: 'Para {{nombre}}' }] });
const DE_ANTES = tarjeta('k2', { titulo: 'Nuevo agendado', mensaje: 'Revisá a {{nombre}}' });
const POR_EMAIL = tarjeta('k3', { canal: 'email', asunto: 'Hola', partes: [{ tipo: 'texto', cuerpo: 'x' }] });
const OTRA = { ...base, id: 'a1', cuerpo: '', accion: { operacion: 'mover_lead_etapa', params: {} }, siguiente: null } as PasoGrafo;
const datos = (t: string) => textoDeEjemplo(t, 'Acme');
const NOMBRE = textoDeEjemplo('{{nombre}}', 'Acme');

// rotura 1 (la tarjeta por email también «va al grupo»): 5 pass / 1 fail, cae éste.
test('le escribe al grupo la «MaKo en WhatsApp»; la que va por email y otra ⚡ Acción, no', () => {
  assert.equal(vaAlGrupo(DE_HOY), true);
  assert.equal(vaAlGrupo(DE_ANTES), true);
  assert.equal(vaAlGrupo(POR_EMAIL), false, 'la «MaKo por email» le escribe al correo del equipo');
  assert.equal(vaAlGrupo(OTRA), false);
  assert.equal(avisaAlGrupo([OTRA, DE_HOY]), true);
  assert.equal(avisaAlGrupo([OTRA, POR_EMAIL]), false);
});

// rotura 2 (sin nombre leído, el contacto dice uno inventado): 5 pass / 1 fail, cae éste.
test('el nombre del contacto: el REAL del grupo; si no se pudo leer, uno que no finge serlo', () => {
  assert.equal(nombreDelGrupo({ hay: true, nombre: ' MaKo <> Código Inmobiliario ' }), 'MaKo <> Código Inmobiliario');
  assert.equal(nombreDelGrupo({ hay: true, nombre: null }), NOMBRE_GRUPO_SIN_LEER);
  assert.equal(nombreDelGrupo('error'), NOMBRE_GRUPO_SIN_LEER);
  assert.equal(nombreDelGrupo(null), NOMBRE_GRUPO_SIN_LEER);
  assert.equal(nombreDelGrupo({ hay: true, nombre: 'MaKo · SuperAdmin', deCadaNegocio: true }), NOMBRE_GRUPO_DE_CADA_NEGOCIO,
    'en SuperAdmin la fila de un evento le escribe al grupo de cada negocio, no al suyo');
  assert.equal(NOMBRE_GRUPO_SIN_LEER, 'Grupo de MaKo');
});

// rotura 3 (los textos sin los datos de ejemplo): 5 pass / 1 fail, cae éste.
test('lo que le llega: la tarjeta de hoy, por partes y con los datos; la de antes, envuelta como la manda el motor', () => {
  assert.deepEqual(loQueLlegaAlGrupo(DE_HOY, datos), [
    { tipo: 'texto', texto: `Agendó ${NOMBRE}` },
    { tipo: 'audio', audioId: 7 },
    { tipo: 'media', mediaId: 9, caption: `Para ${NOMBRE}` },
  ]);
  const [vieja] = loQueLlegaAlGrupo(DE_ANTES, datos);
  assert.equal(vieja.tipo, 'texto');
  const t = vieja.tipo === 'texto' ? vieja.texto : '';
  assert.match(t, /^🟡 \*Nuevo agendado\*/);
  assert.ok(t.includes(`Revisá a ${NOMBRE}`), t);
  assert.match(t, /— MaKo$/);
  assert.deepEqual(loQueLlegaAlGrupo(tarjeta('k4', { partes: [] }), datos), [], 'una tarjeta sin escribir no manda nada');
});

// rotura 4 (el evento de la acción sin su tarjeta): 5 pass / 1 fail, cae éste.
test('el simulador le pasa la tarjeta al panel con el evento de la acción', () => {
  const FLUJO = [{ ...base, id: 'm1', cuerpo: 'Hola', siguiente: 'k1' } as PasoGrafo, { ...DE_HOY, siguiente: null }];
  let st = iniciar(FLUJO);
  let r = siguiente(FLUJO, st); st = r.estado;
  assert.equal(r.evento?.t, 'mensaje');
  r = siguiente(FLUJO, st);
  assert.ok(r.evento?.t === 'accion');
  assert.equal(r.evento.paso.id, 'k1');
  assert.equal(vaAlGrupo(r.evento.paso), true);
});

// rotura 5 (la acción vuelve a ser sólo una pastilla): 5 pass / 1 fail, cae éste.
// rotura 6 (la lista sólo con más de un caso, como antes): 5 pass / 1 fail, cae éste.
// rotura 7 (la prueba le escribe al grupo de verdad): 5 pass / 1 fail, cae éste.
test('el panel: la tarjeta va al chat del grupo, la lista sale con el grupo, y al grupo de verdad no le escribe', () => {
  assert.match(PANEL, /case 'accion':\n\s+case 'salto':\n\s+pildora\(evento\);/);
  assert.match(PANEL, /if \(e\.t === 'accion' && ctx\.current\.canal === 'whatsapp' && vaAlGrupo\(e\.paso\)\) alGrupo\(e\.paso\);/);
  assert.match(PANEL, /const conGrupo = canal === 'whatsapp' && avisaAlGrupo\(flujoVivo\);\n\s+const conBarra = canal !== 'email' && \(escenarios\.length > 1 \|\| conGrupo\);/);
  const alGrupo = PANEL.slice(PANEL.indexOf('const alGrupo = '), PANEL.indexOf('const pildora = '));
  assert.ok(alGrupo.length > 200, 'no encontré `alGrupo`');
  // ⚠️ CAMBIADO A PROPÓSITO EL 17/10/2026 (#852, Martín: «que se puedan probar en el grupo de MaKo»): al grupo de verdad
  // le escribe SÓLO «Probar en el grupo» —una automatización que sólo le habla al grupo— y nunca el envío al lead. Lo fija
  // también tests/probar-en-el-grupo.test.ts.
  assert.doesNotMatch(alGrupo, /mandarReal|fetch\(/, 'la prueba le escribiría al grupo por el envío al lead');
  const postares = [...alGrupo.matchAll(/postar\(/g)].length;
  assert.equal(postares, 1, 'al grupo, un solo envío: el de «Probar en el grupo»');
  assert.match(alGrupo, /if \(realRef\.current && enElGrupoRef\.current && debeSalirDeVerdad\(/, 'al grupo de verdad sólo en «Probar en el grupo»');
  assert.match(alGrupo, /sistema\(PILDORA_AL_GRUPO\);/);
  // El chat del grupo, sin caja para escribir (sin `onEnviarTexto`), y diciendo arriba si es una prueba o si le llega.
  assert.match(PANEL, /<ChatHilo key=\{ID_GRUPO\} accent="var\(--wa\)" accentBubble="var\(--wa-bubble\)" mensajes=\{\[real && enElGrupo \? NOTA_GRUPO_DE_VERDAD : NOTA_GRUPO, \.\.\.grupoMsgs\]\} animarNuevos \/>/);
  assert.match(PANEL, /const NOTA_GRUPO: HiloMsg = \{ id: 'nota-grupo', fromMe: false, tipo: 'sistema', texto: NOTA_DEL_GRUPO \};/);
  // La ruta sólo LEE el grupo.
  const ruta = RUTA.slice(RUTA.indexOf('async function grupoDelNegocio'), RUTA.indexOf('export async function GET'));
  assert.match(ruta, /infoGrupoMaKo\(jid\)/);
  assert.doesNotMatch(ruta, /enviar/i);
  assert.match(ruta, /if \(deUnEvento && ws === \(await wsSuperAdmin\(\)\.catch\(\(\) => -1\)\)\) return \{ ok: true, hay: true, nombre: null, deCadaNegocio: true \};/);
});

// rotura 8 (el grupo deja de dibujarse en la columna): 5 pass / 1 fail, cae éste.
test('la lista: el grupo PRIMERO, con su nombre, lo último y los no leídos; también en la fila de fotos', () => {
  const props = {
    escenarios: [{ id: 'e1', pasos: [], cuando: ['Agendó'], mensajes: 1, elecciones: {} }] as never[], elegido: null, previas: {}, canal: 'whatsapp' as const,
    onElegir: () => {}, grupo: { nombre: 'MaKo <> Acme', ultimo: 'MaKo: Agendó Luis', noLeidos: 2, sel: true, onElegir: () => {} },
  };
  const col = renderToStaticMarkup(createElement(BarraEscenarios, props));
  const iGrupo = col.indexOf('data-contacto-grupo');
  assert.ok(iGrupo > 0 && iGrupo < col.indexOf('>Caso 1<'), 'el grupo va antes que los casos');
  assert.match(col, />MaKo &lt;&gt; Acme</);
  assert.match(col, />MaKo: Agendó Luis</);
  assert.match(col, /data-no-leidos[^>]*>2</);
  assert.match(col, /data-contacto-grupo[^>]*aria-current="true"/);
  const fila = renderToStaticMarkup(createElement(BarraEscenarios, { ...props, fila: true }));
  assert.ok(fila.indexOf('data-contacto-grupo') > 0 && fila.indexOf('data-contacto-grupo') < fila.indexOf('>Caso 1<'));
  assert.doesNotMatch(renderToStaticMarkup(createElement(BarraEscenarios, { ...props, grupo: null })), /data-contacto-grupo/);
});

// =============================================================================
// Duodécima tanda de Automations (12/10/2026), paquete «ui-boton-qr»: el ✦ del título y el QR que salta al crear.
// Diseño: docs/diseno-duodecima-tanda.md §1.7, §2.7 y §2.12 (decisiones 9 y 10). Pedido de Martín, textual:
//   · «se aprieta el botón de MaKo cuando está abierta cualquier tarjeta y la tarjeta debería cerrarse; no debería
//     permanecer abierta y no hacer nada» / «ese botón está más grande que el de al lado»;
//   · «cuando creás un paso que requiera WhatsApp y te diga que tu WhatsApp no está conectado, ahí que salte el QR.
//     Que no haya ninguna fricción».
//
// Lo que se fija:
//   · `abrirMako` (SecuenciaPerfil): con una tarjeta abierta la CIERRA (`foco` con id null) y abre, nunca alterna;
//     el lienzo cierra con `setSel(foco.id)`;
//   · el botón tiene la cara del título (`tarjetaChrome`) y el logo de 32;
//   · `medioAConectarAlCrear`, EJECUTADA: salta sólo con `chipDeTarjeta(...).frena`, nunca sin lectura ni con
//     «no pude comprobarlo», una vez por medio, y sólo WhatsApp, Instagram y Messenger;
//   · FlujoLienzo abre el modal desde un EFECTO (cuando llega la lectura del medio), no en el render.
//
// PROBADO ROMPIÉNDOLO: ver el pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { medioAConectarAlCrear, MOTIVO_MEDIO, type EstadoMedios, type Medio } from '../lib/medios-automatizacion';
import type { PasoGrafo } from '../lib/flujo-grafo';
import { BotonLogoMako } from '../app/automations/SecuenciaPerfil';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas primero y los bloques después (AGENTS.md: un `/*` adentro de un comentario de línea).
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const tramo = (src: string, desde: string, hasta: string, tope = 4_000): string => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no está «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no está el cierre «${hasta}»`);
  assert.ok(j - i <= tope, `el tramo de «${desde}» mide ${j - i} (> ${tope})`);
  return src.slice(i, j + hasta.length);
};
const PERFIL = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));
const LIENZO = sinComentarios(leer('app/automations/FlujoLienzo.tsx'));

// ── El ✦ del título ──────────────────────────────────────────────────────────────────────────

test('abrirMako: con una tarjeta abierta la cierra (foco con id null) y ABRE; sin tarjeta, alterna', () => {
  assert.equal((PERFIL.match(/const abrirMako = /g) ?? []).length, 1, 'abrirMako tiene que vivir en un solo lugar');
  const f = tramo(PERFIL, 'const abrirMako = () => {', '\n  };', 600);
  assert.match(f, /if \(tarjetaAbierta\) \{\s*setFoco\(\(f\) => \(\{ id: null, vez: \(f\?\.vez \?\? 0\) \+ 1 \}\)\);\s*setEditandoIA\(true\);\s*return;\s*\}/,
    'con una tarjeta abierta no la cierra o no abre');
  assert.match(f, /setEditandoIA\(\(v\) => !v\);\s*\};$/, 'sin tarjeta abierta ya no alterna');
  // El botón llama a abrirMako, y nadie más alterna la barra por su lado.
  assert.match(PERFIL, /<BotonLogoMako lado=\{ALTO_ACCION\} encendido=\{editandoIA\} onClick=\{abrirMako\} /);
  assert.equal((PERFIL.match(/setEditandoIA\(\(v\) => !v\)/g) ?? []).length, 1, 'otro clic alterna la barra por fuera de abrirMako');
  // `foco` admite null de punta a punta, y el lienzo lo aplica con setSel (null = cerrar).
  assert.match(PERFIL, /useState<\{ id: string \| null; vez: number \} \| null>\(null\)/);
  assert.match(LIENZO, /foco\?: \{ id: string \| null; vez: number \} \| null;/);
  assert.match(LIENZO, /if \(foco && foco\.vez !== focoVisto\) \{ setFocoVisto\(foco\.vez\); setSel\(foco\.id\); \}/);
  // Cerrar la tarjeta olvida el CRON abierto (el efecto de siempre, con el aviso del lienzo).
  assert.match(PERFIL, /useEffect\(\(\) => \{ if \(!tarjetaAbierta\) setCronAbierto\(null\); \}, \[tarjetaAbierta\]\);/);
});

test('el ✦ tiene la cara del título (tarjetaChrome) y el logo de 32 adentro; encendido, el aro dorado', () => {
  const html = renderToStaticMarkup(createElement(BotonLogoMako, { lado: 44, onClick: () => {}, title: 'x' }));
  assert.match(html, /background:var\(--surface\);border:1px solid var\(--border\);border-radius:11px/, 'no tiene la cara del título');
  assert.match(html, /box-shadow:0 2px 8px rgba\(0,0,0,.06\)/, 'no tiene la sombra del título');
  assert.match(html, /width:44px;height:44px/);
  assert.match(html, /<svg width="32" height="32" viewBox="0 0 48 48"/, 'el logo no es el de 32');
  const on = renderToStaticMarkup(createElement(BotonLogoMako, { lado: 44, onClick: () => {}, title: 'x', encendido: true }));
  assert.match(on, /box-shadow:0 0 0 2px var\(--mako\)/, 'encendido sin el aro dorado');
});

// ── El QR salta al crear ─────────────────────────────────────────────────────────────────────

const P = (o: Record<string, unknown>) => ({ canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', ...o }) as unknown as PasoGrafo;
const WA = P({ id: 'a' });
const OTRA_LINEA = P({ id: 'b', linea: 'mako_ws1_b' });
const IG = P({ id: 'c', canal: 'instagram' });
const MS = P({ id: 'd', canal: 'messenger' });
const EMAIL = P({ id: 'e', canal: 'email', asunto: 'x' });
const AI_STEP = P({ id: 'f', nodo: 'respuesta', paso_ia: true });
const ESPERA = P({ id: 'g', nodo: 'esperar' });
const NO = (m: Medio) => ({ conectado: false, motivo: MOTIVO_MEDIO[m] });
const SI = { conectado: true };
const NOSE = { conectado: null, motivo: 'No pude comprobarlo' };
const SIN_NADA: EstadoMedios = { whatsapp: { porDefecto: NO('whatsapp'), lineas: {} }, email: NO('email'), instagram: NO('instagram'), messenger: NO('messenger') };
const NADA = new Set<Medio>();

test('medioAConectarAlCrear: salta con el medio que frena, con la línea del paso en WhatsApp', () => {
  assert.deepEqual(medioAConectarAlCrear(WA, SIN_NADA, null, NADA), { medio: 'whatsapp', linea: null });
  assert.deepEqual(medioAConectarAlCrear(WA, SIN_NADA, 'mako_ws1', NADA), { medio: 'whatsapp', linea: 'mako_ws1' });
  assert.deepEqual(medioAConectarAlCrear(OTRA_LINEA, SIN_NADA, 'mako_ws1', NADA), { medio: 'whatsapp', linea: 'mako_ws1_b' });
  assert.deepEqual(medioAConectarAlCrear(IG, SIN_NADA, null, NADA), { medio: 'instagram', linea: null });
  assert.deepEqual(medioAConectarAlCrear(MS, SIN_NADA, null, NADA), { medio: 'messenger', linea: null });
  assert.deepEqual(medioAConectarAlCrear(AI_STEP, SIN_NADA, null, NADA), { medio: 'whatsapp', linea: null }, 'un AI Step contesta por WhatsApp');
});

test('medioAConectarAlCrear: sin lectura, con «no pude comprobarlo» o conectado, NO salta', () => {
  assert.equal(medioAConectarAlCrear(WA, null, null, NADA), null, 'saltó sin poder leer');
  assert.equal(medioAConectarAlCrear(WA, undefined, null, NADA), null, 'saltó mientras se leía');
  assert.equal(medioAConectarAlCrear(WA, { whatsapp: { porDefecto: NOSE, lineas: {} } }, null, NADA), null, 'saltó con «no pude comprobarlo»');
  assert.equal(medioAConectarAlCrear(IG, { instagram: NOSE }, null, NADA), null);
  assert.equal(medioAConectarAlCrear(WA, { whatsapp: { porDefecto: SI, lineas: {} } }, null, NADA), null, 'saltó con WhatsApp conectado');
  assert.equal(medioAConectarAlCrear(IG, { instagram: SI }, null, NADA), null);
  assert.equal(medioAConectarAlCrear(ESPERA, SIN_NADA, null, NADA), null, 'una espera no usa ningún medio');
});

test('medioAConectarAlCrear: una vez por medio, y el email no salta (queda su chip)', () => {
  assert.equal(medioAConectarAlCrear(WA, SIN_NADA, null, new Set<Medio>(['whatsapp'])), null, 'saltó dos veces el QR');
  assert.deepEqual(medioAConectarAlCrear(IG, SIN_NADA, null, new Set<Medio>(['whatsapp'])), { medio: 'instagram', linea: null }, 'ofrecer WhatsApp apagó Instagram');
  assert.equal(medioAConectarAlCrear(EMAIL, SIN_NADA, null, NADA), null, 'el email no salta solo');
});

test('FlujoLienzo abre el modal desde un EFECTO (al llegar la lectura del medio), no en el render', () => {
  // El Set es del MÓDULO (una vez por visita, aunque el lienzo se remonte).
  assert.match(LIENZO, /^const conectarOfrecido = new Set<Medio>\(\);$/m);
  const efecto = tramo(LIENZO, 'useEffect(() => {\n    const id = pedirConectar.current;', '}, [medios, pasos]);', 900);
  assert.match(efecto, /if \(!id \|\| medios === undefined\) return;\s*pedirConectar\.current = null;/, 'no espera la lectura del medio');
  assert.match(efecto, /rolAdmin && paso \? medioAConectarAlCrear\(paso, medios, linea\?\.actual \?\? null, conectarOfrecido\) : null/);
  assert.match(efecto, /conectarOfrecido\.add\(pide\.medio\);\s*setConectarMedio\(pide\);/);
  // Fuera del efecto, setConectarMedio sólo va dentro de un handler (el chip y el cierre del modal).
  const resto = LIENZO.replace(efecto, '');
  const sueltos = [...resto.matchAll(/setConectarMedio\(/g)].filter((m) => !/=>\s*$/.test(resto.slice(Math.max(0, m.index! - 8), m.index!)));
  assert.equal(sueltos.length, 0, 'setConectarMedio se llama en el render');
  // Las tres maneras de CREAR una tarjeta dejan su id para el efecto.
  assert.match(LIENZO, /if \(nuevo\) \{ setSel\(nuevo\); pedirConectar\.current = nuevo; \}/, 'el ＋ no pide conectar');
  assert.match(tramo(LIENZO, 'const reconectarANueva = ', '\n  };', 800), /setSel\(r2\.id\);\s*pedirConectar\.current = r2\.id;/, 'soltar la flecha no pide conectar');
  assert.match(tramo(LIENZO, 'const crearSueltaEn = ', '\n  };', 900), /setSel\(r\.id\);\s*pedirConectar\.current = r\.id;/, 'el click derecho no pide conectar');
});

// PROBADO ROMPIÉNDOLO (12/10/2026), de a una, con el arnés
// scratchpad/wf-duodecima/ui-boton-qr/romper.mjs (guarda el original en memoria, reescribe, corre y restaura
// comprobando el sha1). Base: este archivo + tests/medios-automatizacion.test.ts + tests/automations-decima-lienzo.test.ts.
// Base: 36 pass / 0 fail (los tres archivos).
//   R1. abrirMako con una tarjeta abierta alterna (sin cerrar ni abrir)                   → 35 / 1 (abrirMako)
//   R2. el ✦ sin la cara del título (el bloque transparente de antes)                       → 35 / 1 (la cara)
//   R3. salta con cualquier chip, también «no pude comprobarlo» (no sólo con `frena`)       → 34 / 2 (sin lectura + la grilla)
//   R4. ignora lo ya ofrecido (salta cada vez)                                              → 34 / 2 (una vez por medio + la grilla)
//   R5. el email también salta                                                              → 34 / 2 (una vez por medio + la grilla)
//   R6. el efecto no espera la lectura del medio nuevo (`medios === undefined`)             → 35 / 1 (el efecto)
//   R7. el ＋ no deja el id para el efecto                                                    → 35 / 1 (el efecto)
//   R8. setConectarMedio en el render                                                       → 35 / 1 (el efecto)
// Restaurado: 36 / 0.

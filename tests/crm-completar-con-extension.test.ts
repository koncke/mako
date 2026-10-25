// =============================================================================
// «Completar nombres» va por la extensión, pide instalarla y arranca sola; y se ve sin abrir el «⋯» (25/10/2026, f12 y f11)
// =============================================================================
// Martín en la llamada con Leandro (Fathom, 24/10), textual:
//   f12 (22:00): «En completar nombres, si no tenés instalada la extensión de Maco (...) eso es un bug (...) ese botón te
//                debería decir instala la extensión de Maco y que ahí directamente comience.»
//   f11 (18:22): «Ah, no lo vi eso, a ver, vamos a verlo.» (Leandro no encontró la opción de completar: vivía en el «⋯».)
// Sin la extensión, «Completar nombres» corría un camino del server que completaba «algunos o ninguno» sin decir por qué.
//   1. la pantalla se entera EN VIVO de la extensión (el atributo de extension/mako-puente.js);
//   2. «Completar nombres» con la extensión lee su WhatsApp Web; sin ella (o vieja) el pie dice «Instala…» con «Instalar», y
//      al aparecer la extensión arranca sola; el texto no promete lo que no pasa (en una pestaña ya abierta, recargar);
//   3. «Completar nombres» también en el pie: después de traer y cuando hay gente que ya está.
// PROBADO ROMPIÉNDOLO: ver el pie.
// Correr: node --import tsx --test tests/crm-completar-con-extension.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (r: string) => readFileSync(join(import.meta.dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. la extensión, en vivo: el atributo de mako-puente.js y al volver a la pestaña', () => {
  const h = sinComentarios(leer('app/crm/usar-extension-fichas.ts'));
  assert.match(h, /mo\.observe\(document\.documentElement, \{ attributes: true, attributeFilter: \['data-mako-puente'\] \}\);/);
  assert.match(h, /window\.addEventListener\('focus', avisar\);/);
  assert.match(h, /return useSyncExternalStore\(suscribir, extensionLeeFichas, \(\) => 'no'\);/, 'en el servidor no hay extensión');
  // El atributo es el que lee `extensionLeeFichas` (el mismo nombre en los dos lados).
  assert.match(leer('lib/wa-fichas-cliente.ts'), /getAttribute\('data-mako-puente'\)/);
  const p = sinComentarios(leer('app/crm/TraerDeGrupoWA.tsx'));
  assert.match(p, /const extWa = useExtensionFichas\(\);/);
});

test('2. sin la extensión: lo dice, con «Instalar», y arranca sola al aparecer', () => {
  const p = sinComentarios(leer('app/crm/TraerDeGrupoWA.tsx'));
  assert.doesNotMatch(p, /completarNombresDeGrupoAction/, 'volvió el camino que completaba «algunos o ninguno» sin decir por qué');
  assert.match(p, /if \(extWa === 'si'\) \{ setEsperaExt\(null\); void leerDeWhatsappWeb\(\); return; \}\n\s*setErr\(null\); setHecho\(null\); setEsperaExt\('pide'\);/);
  assert.match(p, /const arrancarAlInstalar = useEffectEvent\(\(\) => \{ setEsperaExt\(null\); void leerDeWhatsappWeb\(\); \}\);/);
  assert.match(p, /useEffect\(\(\) => \{ if \(esperaExt && extWa === 'si'\) arrancarAlInstalar\(\); \}, \[esperaExt, extWa\]\);/, 'no arranca solo al instalarla');
  assert.match(p, /esperaExt === 'pide' \? \{ texto: `\$\{extWa === 'vieja' \? 'Actualiza' : 'Instala'\} la extensión de MaKo para completar los nombres\.`, tono: 'neutro' as const, accion: instalar \}/);
  assert.match(p, /window\.open\('\/extension\/instalar', '_blank', 'noopener'\)/);
  // Honesto: Chrome no mete la extensión en una pestaña ya abierta, así que se dice qué hacer si no arranca.
  assert.match(p, /esperaExt === 'fue' \? \{ texto: 'Cuando la extensión esté, empieza sola\. Si no arranca, recarga esta pestaña\.'/);
  // En el «⋯», el mismo camino con y sin la extensión.
  assert.match(p, /\.\.\.\(extWa !== 'si' \? \[\{ id: 'nombres', texto: 'Completar nombres', icono: 'persona' as const, onElegir: completarNombres \}\] : \[\]\),/);
});

test('3. «Completar nombres» en el pie: después de traer, y con gente que ya está', () => {
  const p = sinComentarios(leer('app/crm/TraerDeGrupoWA.tsx'));
  assert.match(p, /setHecho\(`«\$\{grupo\.nombre\}»: \$\{resumen\}\.\$\{fallidos\}\$\{cola2\}`\);\n\s*setTrasTraer\(true\);/);
  assert.match(p, /hecho \? \{ texto: hecho, tono: 'ok' as const, \.\.\.\(trasTraer && ofrecer \? \{ accion: completarAca \} : \{\}\) \}/);
  assert.match(p, /: ofrecer \? \{ texto: `\$\{miles\(yaEstan\)\} ya \$\{yaEstan === 1 \? 'está' : 'están'\} en tu CRM\.`, tono: 'neutro' as const, accion: completarAca \}/);
  assert.match(p, /const ofrecer = !trayendo && yaEstan > 0;/);
});

// PROBADO ROMPIÉNDOLO (25/10/2026), contra una base de 3 / 0, de a una y restaurando de una copia:
//   · sin el efecto que arranca al aparecer la extensión                                   → 2 / 1
//   · el pie sin «Completar nombres» cuando hay gente que ya está                          → 2 / 1
//   · el hook sin mirar el atributo (sólo al volver a la pestaña)                          → 2 / 1

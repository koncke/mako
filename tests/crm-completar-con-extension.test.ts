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
// ⚠️ DESDE EL 26/10/2026 NO HAY «COMPLETAR NOMBRES» (Martín: «Quiero que al extraer de WhatsApp en el CRM, automáticamente
// ejecute esto. Que no me diga "Completar nombres"»): los nombres van dentro de «Extraer» (tests/wa-extraer-072.test.ts). De
// acá queda lo de la extensión: en vivo, y sin ella el pie pide instalarla y los nombres arrancan solos al aparecer.
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

test('2. sin la extensión (o vieja), «Extraer» NO arranca: salta el pop-up de instalarla, y al aparecer arranca sola', () => {
  // Martín, 26/10/2026: «si no tiene la extensión que no lo deje scrapear, que le salte el pop-up para instalar la extensión».
  const p = sinComentarios(leer('app/crm/TraerDeGrupoWA.tsx'));
  assert.doesNotMatch(p, /completarNombresDeGrupoAction/, 'volvió el camino que completaba «algunos o ninguno» sin decir por qué');
  const cuerpo = p.slice(p.indexOf('const extraer = async'));
  assert.match(cuerpo, /^const extraer = async \(soloNombres = false(?:, o\?: \{ todosLosPerfiles\?: boolean \})?\) => \{\n\s+if \(!grupo \|\| trayendo \|\| !entrada\) return;\n\s+if \(extWa !== 'si'\) \{ setPideExt\(true\); return; \}/, 'sin la extensión, «Extraer» trae leads sin nombres');
  assert.match(p, /\{pideExt && \(\n\s+<Confirm tone="primary" title=\{extWa === 'vieja' \? 'Actualiza la extensión de MaKo' : 'Instala la extensión de MaKo'\}/, 'sin el pop-up');
  assert.match(p, /window\.open\('\/extension\/instalar', '_blank', 'noopener'\)/);
  assert.match(p, /window\.dispatchEvent\(new CustomEvent\('MAKO_EXTENSION_REVISAR'\)\);/, 'una vieja con la nueva en su carpeta no se pone al día');
  assert.match(p, /const arrancarAlInstalar = useEffectEvent\(\(\) => \{ setEsperaExt\(null\); void extraer\(\); \}\);/);
  assert.match(p, /useEffect\(\(\) => \{ if \(esperaExt && extWa === 'si'\) arrancarAlInstalar\(\); \}, \[esperaExt, extWa\]\);/, 'no arranca sola al instalarla');
  assert.match(p, /esperaExt === 'fue' \? \{ texto: 'Cuando la extensión esté, la extracción empieza sola\.'/);
});

test('3. no hay «Completar nombres»: ni en el «⋯» ni en el pie (van solos dentro de «Extraer»)', () => {
  const p = sinComentarios(leer('app/crm/TraerDeGrupoWA.tsx'));
  assert.doesNotMatch(p, /Completar nombres|Completar desde mi WhatsApp|completarAca|leerDeWhatsappWeb/);
  assert.match(p, /const mas: OpcionMas\[\] = trayendo \|\| !yaEstan \? \[\] : \[\n\s+\{ id: 'empresa', texto: 'Datos de empresa',/, 'en el «⋯» quedó algo más que «Datos de empresa»');
});

// PROBADO ROMPIÉNDOLO (25/10/2026), contra una base de 3 / 0, de a una y restaurando de una copia:
//   · sin el efecto que arranca al aparecer la extensión                                   → 2 / 1
//   · el pie sin «Completar nombres» cuando hay gente que ya está                          → 2 / 1
//   · el hook sin mirar el atributo (sólo al volver a la pestaña)                          → 2 / 1
// Y el 26/10/2026, con «Extraer» (base 3 / 0): un «Completar nombres» de vuelta en el «⋯» → 2 / 1; «Extraer» sin la extensión
// que igual arranca (sin el `setPideExt(true)`) → 2 / 1.

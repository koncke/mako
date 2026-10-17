// =============================================================================
// #882 (segunda mitad): crear por cualquier vía lo crea EN EL ACTO, con el cargador (17/10/2026)
// =============================================================================
// Martín (Fathom 863534246, 48:05): «Cuando se crea un nuevo flujo, sea cual sea la vía, ya sea un mensaje en el chat...,
// ya sea eligiendo una plantilla o copiando algo, debería automáticamente crearlo y de última tener un loader». El chat ya
// lo hacía (decimotercera tanda). Ahora la plantilla y la copia usan el MISMO cargador de «＋ Nueva» (la fila aparece YA,
// elegida, con el lienzo y su loader), y la plantilla no pregunta la etapa en el modal: el lienzo abre con su CRON
// abierto (`cron: true` → `cronAlAbrir`) para elegirla ahí.
//
// PROBADO ROMPIÉNDOLO (arnés `romper.py` + `roturas-882b.json`; base 3 / 0): la galería vuelve a preguntar antes de crear
// → 2 / 1; la copia sin el cargador → 2 / 1; el lienzo sin abrir el CRON → 2 / 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const bloque = (src: string, desde: string): string => { const i = src.indexOf(desde); assert.ok(i >= 0, desde); return src.slice(i, src.indexOf('\n  };\n', i)); };

test('la plantilla se crea al tocarla: sin la pregunta del modal, con el cargador, y abre con su CRON abierto', () => {
  const gal = leer('app/automations/GaleriaPlantillas.tsx');
  assert.match(bloque(gal, 'const elegir = (pl: PlantillaAutomatizacion) => {'), /if \(p\.onCrearPlantilla\) \{ p\.onCrearPlantilla\(pl\); return; \}\n\s*if \(preguntaEtapa\(/, 'la galería vuelve a preguntar antes de crear');
  const app = leer('app/automations/ChatAgentApp.tsx');
  const plantilla = bloque(app, 'const crearDePlantilla = async (pl: PlantillaAutomatizacion) => {');
  assert.match(plantilla, /setGaleria\(false\);[\s\S]*setCreando\(\{ temporal, id: null \}\);\n\s*setAbrirSec\(\{ id: temporal \}\);/);
  assert.match(plantilla, /setAbrirSec\(pl\.cron\.pide \? \{ id, cron: true \} : \{ id \}\);/);
  assert.match(app, /onCrearPlantilla=\{\(pl\) => void crearDePlantilla\(pl\)\}/);
});

test('la copia, con el cargador de «＋ Nueva»', () => {
  const copia = bloque(leer('app/automations/ChatAgentApp.tsx'), 'const crearDesdeCopia = async (texto: string) => {');
  assert.match(copia, /setCreando\(\{ temporal, id: null \}\);\n\s*setAbrirSec\(\{ id: temporal \}\);/, 'la copia no muestra nada mientras pega');
  assert.match(copia, /finally \{ setCreando\(null\); creandoNueva\.current = false; \}/);
});

test('el lienzo abre con su CRON abierto cuando se lo piden', () => {
  assert.match(leer('app/automations/SimuladorWhatsApp.tsx'), /cronAlAbrir=\{cronPara === sel\.id\}/);
  const perfil = leer('app/automations/SecuenciaPerfil.tsx');
  assert.match(perfil, /if \(cronAlAbrir\) \{\n\s*setCronAbierto\(crons\.primero\?\.id \?\? 'nuevo'\);\n\s*setFoco\(\(f\) => \(\{ id: ID_INICIO, vez: \(f\?\.vez \?\? 0\) \+ 1 \}\)\);/);
});

// «Nueva hoja» ofrece SÓLO las plantillas copiadas de verdad (4/11/2026). Martín, mirando producción: «elimina todos los templates viejos y
// vamos de a poco cargando cuando ya estén». Lo que se ofrece se DERIVA de la plantilla (trae su diseño propio, `Hoja.diseno`), así una hoja
// copiada nueva entra sola; las de antes siguen en el código para las hojas que ya existen. Y la miniatura de una plantilla con diseño es SU
// diseño (app/dashboard/disenos/DisenoEnMiniatura.tsx), no la grilla: «en "Closing" la miniatura no es para nada igual».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DISENOS_HOJA } from '../lib/graficos-catalogo';
import {
  PLANTILLAS_GENERAL_OFRECIDAS, PLANTILLAS_HOJA, PLANTILLAS_OFRECIDAS, esPlantillaOfrecida, instanciarPlantilla, plantillaHojaDe, plantillaOfrecidaDe,
} from '../lib/graficos-plantillas';
import { PLANTILLAS_GENERAL } from '../lib/general-plantillas';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

test('se ofrece exactamente la plantilla que trae su diseño propio, y ninguna otra', () => {
  for (const p of [...PLANTILLAS_HOJA, ...PLANTILLAS_GENERAL]) {
    const conDiseno = !!instanciarPlantilla(p).diseno;
    assert.equal(esPlantillaOfrecida(p), conDiseno, `${p.id}: ${conDiseno ? 'trae diseño y no se ofrece' : 'se ofrece sin diseño'}`);
  }
  assert.ok(PLANTILLAS_OFRECIDAS.some((p) => p.id === 'closing'), 'Closing (la copia de Halden) se ofrece');
  assert.ok(PLANTILLAS_OFRECIDAS.some((p) => p.id === 'cobranza'), 'Cobranza (la copia de Coffer) se ofrece');
  assert.ok(PLANTILLAS_GENERAL_OFRECIDAS.some((p) => p.id === 'foco'), 'Focus (la copia de Pane) se ofrece en General');
  // Comercial se ofrece desde el 4/11 (tarde): trae su diseño (la copia de Selvar).
  assert.ok(PLANTILLAS_OFRECIDAS.some((p) => p.id === 'comercial'), 'Comercial (la copia de Selvar) se ofrece');
  // Marketing se ofrece desde el 4/11 (tarde): trae su diseño (la copia de Kestrel).
  assert.ok(PLANTILLAS_OFRECIDAS.some((p) => p.id === 'marketing'), 'Marketing (la copia de Kestrel) se ofrece');
  // Landing se ofrece desde el 4/11 (noche): trae su diseño (la copia de Corbel).
  assert.ok(PLANTILLAS_OFRECIDAS.some((p) => p.id === 'landing'), 'Landing (la copia de Corbel) se ofrece');
  // Chat Analyst se ofrece desde el 4/11 (noche): trae su diseño (la copia de Parley).
  assert.ok(PLANTILLAS_OFRECIDAS.some((p) => p.id === 'chat-analyst'), 'Chat Analyst (la copia de Parley) se ofrece');
  assert.ok(PLANTILLAS_OFRECIDAS.some((p) => p.id === 'automatizaciones'), 'Automatizaciones (la copia de Noria) se ofrece');
  for (const viejo of ['ads-analyst']) assert.ok(!PLANTILLAS_OFRECIDAS.some((p) => p.id === viejo), `${viejo} ya no se ofrece`);
  assert.ok(PLANTILLAS_GENERAL_OFRECIDAS.every((p) => !!instanciarPlantilla(p).diseno));
});

test('una plantilla vieja sigue existiendo para quien la tiene, pero no se crea desde la API', () => {
  assert.ok(plantillaHojaDe('ads-analyst'), 'el código de la vieja sigue (las hojas que ya existen y los «Ver …» de antes)');
  assert.equal(plantillaOfrecidaDe('ads-analyst'), undefined);
  assert.equal(plantillaOfrecidaDe('closing')?.id, 'closing');
});

test('el modal, la API del Dashboard y la de General leen las ofrecidas, nunca la lista entera', () => {
  const modal = leer('app/dashboard/NuevaHoja.tsx');
  assert.doesNotMatch(modal, /\bPLANTILLAS_HOJA\b/, 'el modal no lista PLANTILLAS_HOJA');
  assert.doesNotMatch(modal, /catalogo = [^;]*\bPLANTILLAS_GENERAL\b(?!_)/, 'ni PLANTILLAS_GENERAL');
  assert.match(leer('lib/api-mako/areas/dashboard.helpers.ts'), /ordenarConSugeridas\(PLANTILLAS_OFRECIDAS, ETIQUETAS_DASHBOARD, senales\)/);
  assert.match(leer('lib/api-mako/areas/dashboard.run.ts'), /const p = plantillaOfrecidaDe\(plantilla\);/);
  assert.match(leer('lib/api-mako/areas/general.def.ts'), /const PLANTILLAS = PLANTILLAS_GENERAL_OFRECIDAS\.map/);
});

test('la miniatura de una plantilla con diseño es su diseño: un diseño nuevo no compila sin la suya', () => {
  const mini = leer('app/dashboard/disenos/DisenoEnMiniatura.tsx');
  assert.match(mini, /const MINIATURAS: Record<DisenoHoja\['id'\], /, 'la tabla es total sobre DISENOS_HOJA');
  // Un id con guion ('mi-dia') va entre comillas en la tabla: la clave se busca con o sin ellas.
  for (const d of DISENOS_HOJA) assert.match(mini, new RegExp(`\\n  '?${d}'?: \\(`), `${d} tiene su miniatura`);
  assert.match(leer('app/dashboard/MiniaturaHoja.tsx'), /\{hoja\?\.diseno \? \(/, 'MiniaturaHoja dibuja el diseño cuando la plantilla lo trae');
  assert.match(mini, /quieta \/>/, 'quieta: sin entrada, sin cifras que cuentan, sin leer la caja de IA');
});

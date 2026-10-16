// =============================================================================
// «Avatar de IA» del Video Editor: copia la pantalla de CapCut, genera con lo del
// Video Generator
// =============================================================================
// Pedido de Martín (14/10/2026): «implementa lo que ya tenemos en MaKo para la
// generación de videos con esa tab que tiene Capcut de "Avatar de IA"». Lo que se
// cuida acá:
//   · qué es un avatar (un escenario confirmado del historial) y cómo entra al plan;
//   · que un avatar que dice una frase no se cobre como un anuncio de 7 tomas;
//   · que la pestaña NO tenga un camino de generación propio: plan, filmar y
//     preguntar son las acciones del Video Generator, en serie y sin reintento.
//
// Probado rompiéndolo (14/10/2026), base 7 de 7, cada rotura restaurada y con 1 fallo:
// sin deduplicar por mediaId · un avatar sin confirmar · el avatar en una sola toma ·
// sin el piso de una toma · un reintento de filmar · el planificador ignorando el piso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { avataresDelHistorial, conAvatar } from '../app/video-editor/avatar/avatares';
import { cabidaDeGuion, puestaPorId } from '../lib/puestas-data';

const escena = (n: number, lugar: string) => ({ n, desde: n, hasta: n, lugar, prompt: `prompt ${lugar}`, fondo: `fondo ${lugar}` });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const plan = (id: string, titulo: string, escenas: ReturnType<typeof escena>[], imagenes: Record<string, any>, puestaId = 'selfie-movimiento'): any => ({
  id, pedido: titulo, at: '2026-10-14T00:00:00Z',
  plan: { titulo, puestaId, clips: [{ n: 1 }, { n: 2 }, { n: 3 }] },
  escenas, imagenes,
});
const ok = (url: string, id: string, extra = {}) => ({ elegida: url, elegidaId: id, confirmada: true, ...extra });

test('un avatar es un escenario CONFIRMADO con url y mediaId; sin repetir y del más nuevo al más viejo', () => {
  const historial = [
    plan('nuevo', 'Anuncio nuevo', [escena(1, 'Oficina'), escena(2, 'Auto')], {
      '1': ok('u-ofi', 'm-ofi', { reusadaDe: 'Anuncio viejo' }),   // la misma imagen, reusada
      '2': { elegida: 'u-auto', elegidaId: 'm-auto' },                // elegida pero SIN confirmar
    }),
    plan('viejo', 'Anuncio viejo', [escena(1, 'Oficina'), escena(2, 'Casa')], {
      '1': ok('u-ofi', 'm-ofi'),
      '2': ok('u-casa', ''),                                           // sin mediaId: no se puede filmar
    }),
    plan('otro', 'Otro', [escena(1, 'Parque')], { '1': ok('u-parque', 'm-parque') }, 'plano-secuencia'),
  ];
  const avatares = avataresDelHistorial(historial);
  assert.deepEqual(avatares.map((a) => a.id), ['m-ofi', 'm-parque']);
  assert.equal(avatares[0].deAnuncio, 'Anuncio viejo', 'un dato reusado dice de dónde salió');
  assert.equal(avatares[1].puestaId, 'plano-secuencia', 'el formato viaja con el avatar: decide el encuadre');
  assert.equal(avatares[1].escena.prompt, 'prompt Parque');
});

test('el plan nuevo lleva el avatar en TODAS sus tomas, ya confirmado y con su mediaId', () => {
  const [avatar] = avataresDelHistorial([plan('v', 'Viejo', [escena(2, 'Oficina')], { '2': ok('u', 'm-1') })]);
  const recien = plan('n', 'Nuevo', [], {});
  const item = conAvatar(recien, avatar);
  assert.deepEqual(item.escenas, [{ n: 1, desde: 1, hasta: 3, lugar: 'Oficina', prompt: 'prompt Oficina', fondo: 'fondo Oficina' }]);
  assert.deepEqual(item.imagenes, { '1': { elegida: 'u', elegidaId: 'm-1', confirmada: true, reusadaDe: 'Viejo' } });
});

test('una frase de avatar no se cobra como un anuncio: con piso de UNA toma entra en una', () => {
  const puesta = puestaPorId('plano-secuencia')!;
  const frase = 'Hola, soy Mauricio y hoy te cuento cómo conseguir clientes sin pagar anuncios.';
  // Con el rango del formato, The Office obliga a 7 tomas (7 clips pagados por una oración).
  assert.equal(cabidaDeGuion(puesta, frase).clips, puesta.clips[0]);
  const piso1 = { ...puesta, clips: [1, puesta.clips[1]] as [number, number] };
  assert.equal(cabidaDeGuion(piso1, frase).clips, 1);
});

// ── El cableado ──────────────────────────────────────────────────────────────
const raiz = resolve(import.meta.dirname, '..');
const fuente = (...p: string[]) => readFileSync(resolve(raiz, ...p), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('la pestaña «Avatar de IA» está en la biblioteca, con su sección registrada e importada', () => {
  assert.match(fuente('app', 'video-editor', 'ce', 'ranuras.ts'), /\| 'avatar';/);
  assert.match(fuente('app', 'video-editor', '_opencut', 'components', 'editor', 'panels', 'assets', 'assets-panel-store.tsx'), /"ajuste",\s*"plantillas",\s*"avatar",\s*\];/); // «Plantillas» (tanda 3 de las plantillas) va entre las dos
  assert.match(fuente('app', 'video-editor', '_opencut', 'components', 'editor', 'panels', 'assets', 'tabbar.tsx'), /avatar: \{ etiqueta: "Avatar de IA"/);
  assert.match(fuente('app', 'video-editor', 'ce', 'extensiones.ts'), /import '\.\.\/_opencut\/avatar\/registro';/);
  const registro = fuente('app', 'video-editor', '_opencut', 'avatar', 'registro.ts');
  assert.match(registro, /categoria: "avatar",[\s\S]*etiqueta: "Biblioteca de avatares",[\s\S]*Contenido: AvatarIAView/);
});

test('NO hay generación propia: plan, filmar y preguntar son las acciones del Video Generator', () => {
  const acciones = fuente('app', 'video-editor', 'avatar', 'actions.ts');
  assert.match(acciones, /await generarPlanAction\(\{[\s\S]*adaptarVoz: false,[\s\S]*clipsMinimos: 1,[\s\S]*\}\);/);
  const gen = fuente('app', 'video-editor', '_opencut', 'avatar', 'generar.ts');
  assert.match(gen, /import \{ estadoTomaAction, generarTomaAction \} from "@\/app\/video-generator\/video-action";/);
  for (const prohibido of [/encolar\(/, /flow\.google/, /batchexecute/, /Promise\.all/]) {
    assert.doesNotMatch(gen, prohibido, `generar.ts no puede tener ${prohibido}: ni camino propio ni tomas en paralelo`);
  }
  // Una sola llamada a filmar, adentro del recorrido de las tomas: sin reintento.
  assert.equal((gen.match(/generarTomaAction\(/g) || []).length, 1);
  assert.match(gen, /for \(const n of plan\.tomas\) \{[\s\S]*await generarTomaAction\(plan\.planId, n\)/);
});

test('el piso de tomas llega hasta el planificador, y sin él todo sigue como antes', () => {
  const planner = fuente('lib', 'video-planner.ts');
  assert.match(planner, /const minClips = pedido\.clipsMinimos != null\s*\? Math\.min\(maxClips, Math\.max\(1, Math\.round\(pedido\.clipsMinimos\)\)\)\s*: minPuesta;/);
  const accion = fuente('app', 'video-generator', 'actions.ts');
  assert.match(accion, /const cabida = cabidaDeGuion\(piso, soloHablado\(guionTexto\)\);/);
  assert.match(accion, /clipsMinimos: input\.clipsMinimos,/);
});

test('la bajada del clip es UNA, la de «Editar en el editor»', () => {
  assert.match(fuente('app', 'video-editor', 'desde', 'ImportarDesde.tsx'), /import \{ bajarVideo \} from "\.\/bajar";/);
  assert.match(fuente('app', 'video-editor', '_opencut', 'avatar', 'generar.ts'), /import \{ bajarVideo \} from "@\/app\/video-editor\/desde\/bajar";/);
  assert.doesNotMatch(fuente('app', 'video-editor', 'desde', 'ImportarDesde.tsx'), /async function bajar\(/);
});

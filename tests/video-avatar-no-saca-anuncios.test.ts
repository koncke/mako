// =============================================================================
// Hacer un video de avatar no saca un anuncio del historial, CORRIENDO LAS ACCIONES REALES (F168, 18/11/2026)
// =============================================================================
// tests/video-historial-cupos.test.ts fija el cupo por tipo (`recortarPorCupo`): guardado con `tipo: 'avatar'`, un avatar no
// compite con los anuncios. Lo que ese test no veía es el ORDEN de las escrituras en las dos acciones de avatar:
//
//   1. `generarPlanAction` armaba el plan y lo GUARDABA en el acto, sin `tipo` → entraba como ANUNCIO protegido;
//   2. con 10 anuncios en el cupo, `recortarPorCupo` tiraba uno (uno PAGADO si los 10 tenían clips) y lo escribía en la base;
//   3. recién después `conAvatar` lo sellaba como avatar y se guardaba otra vez — pero el anuncio tirado ya no volvía.
//
// Y `cambiarMuletillasAction` tenía la misma doble escritura: el plan nuevo quedaba como un FANTASMA (otro anuncio más, con
// un id al azar) al lado del de verdad, que se guardaba después con su id.
//
// La cura (app/video-generator/actions.ts → `guardar: false`): esas tres acciones le piden el plan SIN guardar y lo guardan
// ellas, una sola vez y con el item ya terminado. Acá se corren las tres REALES —`crearAvatarAction` del Video Editor,
// `crearVideoAction` de AI Avatar y `cambiarMuletillasAction`— con `generarPlanAction` real adentro, contra un `app_settings`
// en memoria. De mentira van sólo el modelo (`generarPlan`), la sesión, los candados y la prueba gratis.
//
// Correr: node --import tsx --test tests/video-avatar-no-saca-anuncios.test.ts
//
// PROBADO ROMPIÉNDOLO (18/11/2026): base 4/0. Con `guardar: false` sacado de las tres acciones (el código de antes) → 1/3: caen
// los tres casos de las acciones, y queda verde el del Video Generator, que guarda como siempre.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const RAIZ = join(import.meta.dirname, '..');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);

/**
 * El escenario de cada caso: diez anuncios FILMADOS (un clip pagado cada uno, que es el puntero que se perdía) y, en el más
 * nuevo, un escenario confirmado —es de donde el Video Editor saca el avatar—. Los mocks van ANTES de importar las acciones.
 */
const ARMADO = `
import { mock } from 'node:test';
const base = new Map();
const WS = 9;
const k = (key) => WS + '|' + key;
// lib/settings ENTERO de mentira (no se esparce el real: cualquier módulo que lo importe antes del mock se quedaría con el real).
mock.module(${url('lib/settings.ts')}, { exports: {
  getSetting: async (key) => base.get(k(key)) ?? null,
  getSettingEstricto: async (key) => base.get(k(key)) ?? null,
  setSetting: async (key, v) => { base.set(k(key), v); },
  cambiarSettingSi: async (key, esperado, nuevo) => { if ((base.get(k(key)) ?? null) !== esperado) return false; base.set(k(key), nuevo); return true; },
  borrarSetting: async (key) => { base.delete(k(key)); },
  borrarSettingSi: async (key, esperado) => { if (base.get(k(key)) !== esperado) return false; base.delete(k(key)); return true; },
  getSettingsConPrefijo: async () => new Map(),
  borrarSettingsConPrefijo: async () => {},
  getSettingNum: async (key) => { const v = base.get(k(key)); return v == null ? null : Number(v); },
} });
// ⚠️ Sin el \`default\` del real: tsx lo transpila a CommonJS, y su \`default\` es el module.exports con las propiedades que el
// mock vuelve a definir encima («Cannot redefine property»).
const real = async (rel) => { const { default: _d, ...resto } = await import(rel); return resto; };
const esparcir = async (rel, cambios) => mock.module(rel, { exports: { ...(await real(rel)), ...cambios } });
await esparcir(${url('lib/workspace.ts')}, {
  getWorkspaceActual: async () => WS, getRolWsEfectivo: async () => 'admin', wsObligatorio: async () => WS,
});
let planes = 0;
await esparcir(${url('lib/video-planner.ts')}, {
  generarPlan: async (_ws, pedido) => {
    planes += 1;
    return { ok: true, plan: { titulo: 'Plan ' + planes, puestaId: pedido.puestaId, clips: [{ n: 1, dice: pedido.guionLiteral }] } };
  },
});
await esparcir(${url('app/video-generator/voz-cliente.ts')}, { getVozCliente: async () => ({ acento: '', muletillas: [], muestras: [] }) });
await esparcir(${url('lib/timezone.ts')}, { tzDeWorkspace: async () => 'America/Mexico_City' });
// Los dos \`acceso\` ENTEROS de mentira: el real importa lib/tab-access, que trae next/navigation (no carga en react-server).
mock.module(${url('app/video-editor/acceso.ts')}, { exports: { veEditorVideo: async () => true, requireEditorVideo: async () => {} } });
mock.module(${url('app/ai-avatar/acceso.ts')}, { exports: {
  veAiAvatar: async () => true, requireAiAvatar: async () => {}, candadoDeAiAvatar: async () => null,
} });
await esparcir(${url('lib/prueba-uso.ts')}, { frenoDePrueba: async () => ({ ok: true }), sumarUsoDePrueba: async () => {} });
await esparcir(${url('app/ai-avatar/looks.ts')}, { leerLooks: async () => [
  { id: 'lk1', plantillaId: 'oficina', fotoId: 'f1', trabajoId: null, mediaId: 'look-media', url: 'https://x/look.png', error: '', detalle: '', creadoEn: '2026-11-02T10:00:00.000Z' },
] });
await esparcir(${url('app/video-generator/guiones-datos.ts')}, { guionesDisponibles: async () => [{ id: 'g1', texto: 'Hola, esto es lo que digo en el anuncio.' }] });

const { KEY_HISTORIAL_VIDEO, leerHistorial } = await import(${url('app/video-generator/video-datos.ts')});
const anuncio = (i) => ({
  id: 'anuncio-' + i, pedido: 'anuncio ' + i, at: '2026-11-0' + (i % 9 + 1) + 'T00:00:00Z', guionId: 'g1',
  plan: { titulo: 'Anuncio ' + i, puestaId: 'plano-secuencia', clips: [{ n: 1 }] },
  video: { '1': { url: 'https://x/anuncio-' + i + '.mp4' } },
});
const sembrados = Array.from({ length: 10 }, (_, i) => anuncio(10 - i));
// El más nuevo trae el escenario confirmado del que el Video Editor saca el avatar.
sembrados[0] = { ...sembrados[0],
  escenas: [{ n: 1, desde: 1, hasta: 1, lugar: 'La oficina', prompt: 'p' }],
  imagenes: { '1': { elegida: 'https://x/esc.png', elegidaId: 'esc-media', confirmada: true } },
};
base.set(k(KEY_HISTORIAL_VIDEO), JSON.stringify(sembrados));
const ANUNCIOS = sembrados.map((e) => e.id);
/** Lo que quedó GUARDADO en la base (no la lectura, que recorta de nuevo). */
const guardado = () => JSON.parse(base.get(k(KEY_HISTORIAL_VIDEO)) ?? '[]');
const resumen = () => {
  const g = guardado();
  return {
    anuncios: g.filter((e) => e.tipo !== 'avatar').map((e) => e.id),
    avatares: g.filter((e) => e.tipo === 'avatar').map((e) => e.id),
    total: g.length,
  };
};
`;

function hijo(cuerpo: string): Record<string, unknown> {
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings',
    '--import', 'tsx', '--input-type=module', '-e', ARMADO + cuerpo,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], timeout: 240_000 });
  const lineas = out.trim().split('\n');
  return JSON.parse(lineas[lineas.length - 1]!) as Record<string, unknown>;
}

const DIEZ = Array.from({ length: 10 }, (_, i) => `anuncio-${10 - i}`);

test('el «Avatar de IA» del Video Editor no saca ninguno de los 10 anuncios filmados', () => {
  const r = hijo(`
const { crearAvatarAction } = await import(${url('app/video-editor/avatar/actions.ts')});
const out = await crearAvatarAction({ avatarId: 'esc-media', guion: 'Hola, soy tu avatar.' });
console.log(JSON.stringify({ out: { ok: out.ok, error: out.error ?? null, planId: out.planId ?? null }, ...resumen() }));`);
  assert.deepEqual((r.out as { ok: boolean; error: string | null }).ok, true, `la acción falló: ${(r.out as { error: string | null }).error}`);
  assert.deepEqual(r.anuncios, DIEZ, 'los 10 anuncios siguen guardados, en el mismo orden');
  assert.deepEqual(r.avatares, [(r.out as { planId: string }).planId], 'y el avatar entró UNA vez, sellado como avatar');
  assert.equal(r.total, 11);
});

test('el video con avatar de AI Avatar no saca ninguno de los 10 anuncios filmados', () => {
  const r = hijo(`
const { crearVideoAction } = await import(${url('app/ai-avatar/actions.ts')});
const out = await crearVideoAction({ avatarId: 'look-media', guion: 'Hola, soy tu avatar.' });
console.log(JSON.stringify({ out: { ok: out.ok, error: out.error ?? null, planId: out.planId ?? null }, ...resumen() }));`);
  assert.equal((r.out as { ok: boolean }).ok, true, `la acción falló: ${(r.out as { error: string | null }).error}`);
  assert.deepEqual(r.anuncios, DIEZ, 'los 10 anuncios siguen guardados, en el mismo orden');
  assert.deepEqual(r.avatares, [(r.out as { planId: string }).planId], 'y el avatar entró UNA vez, sellado como avatar');
});

test('rehacer el guion con las muletillas no deja un anuncio fantasma ni tira uno de los 10', () => {
  const r = hijo(`
const { cambiarMuletillasAction } = await import(${url('app/video-generator/video-action.ts')});
// Dos borradores sin filmar: el anuncio-1 (el que se rehace: con clips la acción no acepta) y el anuncio-5. Con la doble
// escritura de antes, el fantasma protegido tiraba al anuncio-1, el segundo guardado lo devolvía y tiraba al anuncio-5.
const g = guardado().map((e) => (e.id === 'anuncio-1' || e.id === 'anuncio-5') ? { ...e, video: {} } : e);
base.set(k(KEY_HISTORIAL_VIDEO), JSON.stringify(g));
const out = await cambiarMuletillasAction('anuncio-1', true);
const item = guardado().find((e) => e.id === 'anuncio-1');
console.log(JSON.stringify({ ok: out.ok, error: out.error ?? null, titulo: item?.plan?.titulo ?? null, ...resumen() }));`);
  assert.equal(r.ok, true, `la acción falló: ${r.error}`);
  // El rehecho pasa adelante (se guarda como «el último tocado»): se comparan los ids, no el orden.
  assert.deepEqual([...(r.anuncios as string[])].sort(), [...DIEZ].sort(), 'los mismos 10 anuncios: ni un fantasma de más, ni uno de menos');
  assert.equal(r.titulo, 'Plan 1', 'y el anuncio-1 quedó con el plan rehecho, con su id de siempre');
});

test('el Video Generator sigue guardando el plan como antes (sin `guardar`)', () => {
  const r = hijo(`
const { generarPlanAction } = await import(${url('app/video-generator/actions.ts')});
const out = await generarPlanAction({ puestaId: 'plano-secuencia', guionId: 'g1', guionTexto: 'Hola, esto es lo que digo en el anuncio.', adaptarVoz: false });
const leido = (await leerHistorial()).map((e) => e.id);
console.log(JSON.stringify({ ok: out.ok, error: out.error ?? null, id: out.item?.id ?? null, devuelto: (out.historial ?? []).map((e) => e.id), leido }));`);
  assert.equal(r.ok, true, `la acción falló: ${r.error}`);
  assert.equal((r.leido as string[])[0], r.id, 'el plan nuevo quedó guardado, primero');
  assert.deepEqual(r.devuelto, r.leido, 'y lo que devuelve es lo guardado');
});

// =============================================================================
// La guía de cada pestaña: los catálogos (29/10/2026, G1 de docs/mako-iniciativa/guia.md §2.2)
// =============================================================================
// Lo que se fija de TODOS los catálogos (lib/guia/catalogo.ts los junta; cada uno vive al lado de su tab):
//   1. cada uno cumple (lib/guia/reglas.ts → problemasDeGuia): ids únicos con el prefijo de su tab o `mk-`, textos cortos, de tú,
//      sin voseo y con «Toca» (nunca «Haz clic»), de 2 a 4 objetivos de 1 a 3 pasos, y cada paso nombra un ancla del catálogo;
//   2. cada ancla está MARCADA en el fuente (`ancla('id')` o `data-recorrido="id"`), o trae su `donde` y su `css` sigue donde
//      vive: una marca que se fue deja a la guía señalando la nada;
//   3. toda tab que ve un cliente tiene catálogo, o está en `SIN_GUIA_TODAVIA` con su tanda (la lista sólo se achica);
//   4. el Ops Center la usa: `useGuiaDeLaTab('mako')`, el «?» la ofrece, y el recorrido `sb-inicio` se fue.
//
// Correr: node --import tsx --test tests/guia-catalogo.test.ts
// PROBADO ROMPIÉNDOLO (base 4/0), ver la cosecha (docs/hallazgos-ui.md).
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOGOS, PREFIJOS_COMUNES, anclaDelCatalogo, guiaDe } from '../lib/guia/catalogo';
import { problemasDeGuia, textosDeGuia } from '../lib/guia/reglas';
import type { GuiaDeTab } from '../lib/guia/tipos';
import { marcasDeVoseo } from '../lib/puestas-data';
import { FAMILIAS, MAKO_NAV, USER_NAV, itemsDe } from '../app/_components/nav';
import { LEAD_MAGNET_EN_PRODUCCION } from '../lib/lead-magnets/archivado';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const GUIAS = CATALOGOS as readonly GuiaDeTab[];

/** El prefijo de las anclas de cada tab (además de los comunes, `mk-`). */
const PREFIJO: Record<string, string> = { mako: 'sb-' };

/**
 * Las tabs que un cliente ve y todavía no tienen su guía, con la tanda que la trae (guia.md §6). Sólo se achica: una tab nueva sin
 * catálogo falla, y una que ya lo tiene tiene que salir de acá.
 */
const SIN_GUIA_TODAVIA: Readonly<Record<string, string>> = {
  todo: 'G6, Plan', chats: 'G6, Chats (monta la estrella)', graphics: 'G3, Dashboard',
  setting: 'G6, Automations', 'customer-success': 'G6, Classroom', 'admin-customers': 'G6, Classroom (Clientes)', offer: 'G6, Offer',
  'landing-writer': 'G6, Web Generator', 'ads-manager': 'G6, Media Buyer', 'video-editor': 'G6, Video Editor (después de G5)',
  copywriter: 'G6, Copywriter (después de G5)', 'ai-avatar': 'G6, AI Avatar',
  perfil: 'G6, Settings (monta la estrella)', 'api-mako': 'G6, API de MaKo', partners: 'G6, Planes y Partners', agency: 'G6, Planes y Partners',
  tickets: 'G6, Ticketera de usuarios (Report a problem)', 'market-an': 'G6, Competitor Spy',
  // 5/11/2026: entró a Create con el shell compartido (app/_crear/PantallaCrear.tsx), como sus hermanas: su guía espera a G5.
  // ARCHIVADO el 11/11/2026 por pedido de Martín (lib/lead-magnets/archivado.ts): apagado, no es una tab.
  ...(LEAD_MAGNET_EN_PRODUCCION ? { 'lead-magnet-generator': 'G6, Lead Magnet (después de G5)' } : {}),
};

function fuentes(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
    const r = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...fuentes(r)); else if (/\.tsx?$/.test(e.name)) out.push(r);
  }
  return out;
}

test('1. cada catálogo cumple: ids con su prefijo, textos cortos de tú sin voseo, 2 a 4 objetivos de 1 a 3 pasos', () => {
  assert.ok(GUIAS.length >= 1);
  const todos = new Set<string>();
  for (const g of GUIAS) {
    const prefijos = [PREFIJO[g.key] ?? `${g.key}-`, ...PREFIJOS_COMUNES];
    assert.deepEqual(problemasDeGuia(g, prefijos), [], g.key);
    const texto = textosDeGuia(g).join(' · ');
    assert.deepEqual(marcasDeVoseo(texto), [], `${g.key}: voseo`);
    assert.doesNotMatch(texto, /haz clic|haga clic|clickea|cliquea/i, `${g.key}: «Toca», no «Haz clic»`);
    // Un id es la clave de lo visto y lo que nombra el modelo: único en TODA la app (salvo los comunes, que se repiten igual).
    for (const a of g.anclas) {
      if (!PREFIJOS_COMUNES.some((p) => a.id.startsWith(p))) assert.ok(!todos.has(a.id), `${a.id}: repetida en dos catálogos`);
      todos.add(a.id);
    }
  }
  assert.equal(anclaDelCatalogo('sb-nuevo')?.guia.key, 'mako');
  assert.equal(anclaDelCatalogo('no-existe'), null);
});

test('2. cada ancla está marcada en el fuente (o trae su `donde`, y su css sigue donde vive)', () => {
  const app = fuentes('app').map((f) => leer(f));
  for (const g of GUIAS) {
    for (const a of g.anclas) {
      if (a.donde?.length) {
        for (const d of a.donde) for (const v of d.vive) assert.ok(existsSync(join(RAIZ, v)) && leer(v).includes(d.css.split(/[ [:>]/)[0]), `${a.id}: su «donde» no vive en ${v}`);
        continue;
      }
      const marcada = app.some((src) => src.includes(`ancla('${a.id}')`) || src.includes(`data-recorrido="${a.id}"`));
      assert.ok(marcada, `${g.key} · ${a.id}: nadie la marca (ancla('${a.id}') o data-recorrido="${a.id}")`);
    }
  }
  // Nunca un aria-label como ancla (se cambia por un texto y se rompe en silencio).
  for (const g of GUIAS) for (const a of g.anclas) for (const d of a.donde ?? []) assert.doesNotMatch(d.css, /aria-label/, `${a.id}: un aria-label como ancla`);
});

test('3. toda tab que ve un cliente tiene su guía, o está en la lista que sólo se achica', () => {
  const visibles = [...FAMILIAS.flatMap(itemsDe), ...MAKO_NAV, ...USER_NAV.filter((i) => !i.soloSeccion)].map((i) => i.key);
  for (const k of visibles) assert.ok(guiaDe(k) || SIN_GUIA_TODAVIA[k], `${k}: una tab nueva sin guía (sumale su catálogo, guia.md §2.2)`);
  for (const k of Object.keys(SIN_GUIA_TODAVIA)) {
    assert.ok(visibles.includes(k), `${k}: ya no es una tab: sácala de SIN_GUIA_TODAVIA`);
    assert.equal(guiaDe(k), null, `${k}: ya tiene catálogo: sácala de SIN_GUIA_TODAVIA`);
  }
});

test('4. el Ops Center la usa: su guía, el «?» que la ofrece, y fuera el recorrido `sb-inicio`', () => {
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(sb, /const guia = useGuiaDeLaTab\(ops \? '' : 'mako', \{ listo: conGuia && k\.cargado && k\.esJefe && k\.app != null, hechos: \{ sinApp: k\.app === 'bloquea', sinIA: k\.iaConectada === false \} \}\);/);
  assert.match(sb, /className="co-ayuda" onClick=\{\(\) => guia\.ofrecer\(\)\}/);
  assert.doesNotMatch(sb, /<Recorrido |useRecorrido\(|PASOS_INICIO/, 'dos tutoriales en una pantalla');
  assert.equal(existsSync(join(RAIZ, 'app/second-brain/recorrido-inicio.ts')), false, 'el recorrido viejo se borra en la tanda que pone su guía');
  // El velo, montado UNA vez para toda la app.
  assert.equal((leer('app/layout.tsx').match(/<VeloGuia \/>/g) ?? []).length, 1);
  // Los chats llevan su marca: el velo les deja un hueco.
  assert.match(leer('app/_chat/MakoEnLaTab.tsx'), /className=\{apartado \? 'ch-tab-panel ch-tab-panel--apartado' : 'ch-tab-panel'\}[^>]*data-mako-chat=""/);
  assert.match(leer('app/admin/operaciones/PanelChat.tsx'), /<section className="co-panel"[^>]*data-mako-chat=""/);
});

// PROBADO ROMPIÉNDOLO (29/10/2026, base 4/0):
//   · voseo en el catálogo                          → 3/1 (1)
//   · un ancla sin marcar (sb-buscar)               → 3/1 (2)
//   · el panel del chat sin su hueco                → 3/1 (4)

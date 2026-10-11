// =============================================================================
// Offer Playbook (/admin/offer-playbook): el marco partido en tabs y los autores
// =============================================================================
// La tab RENDERIZA docs/offer-marco.md (no lo copia) y lib/offer-autores.ts. Lo que
// se fija acá es lo que se rompe sin que nada falle:
//   · una sección nueva del documento que ninguna tab muestra (desaparece en silencio),
//   · un «lo tomó MaKo» que apunta a una sección que no existe (un link muerto),
//   · el .md que no llega al deploy (la tab anda en local y sale vacía en producción),
//   · la pantalla sin su guard de super admin o fuera de la barra.
//
// Probado rompiéndolo (11/10/2026) — ver el bloque «Roturas» al final.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  cortarSecciones, textoDeTab, indiceDeSecciones, claveDeReferencia, tabDeSeccion,
  SECCIONES_DE_TAB, TABS_PLAYBOOK,
} from '../app/admin/offer-playbook/secciones';
import { AUTORES_OFERTA, TEMAS_OFERTA } from '../lib/offer-autores';
import { PENDIENTES_OFFER, QUIEN_DECIDE } from '../app/admin/offer-playbook/pendientes';

const raiz = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(raiz, rel), 'utf8').replace(/\r\n/g, '\n');
const DOC = leer('docs/offer-marco.md');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('cada «## N.» del marco está mapeado a UNA tab, a propósito', () => {
  const { secciones } = cortarSecciones(DOC);
  assert.ok(secciones.length >= 10, `el marco tiene ${secciones.length} secciones`);
  const mapeadas = Object.values(SECCIONES_DE_TAB).flat();
  for (const s of secciones) {
    const veces = mapeadas.filter((n) => n === s.numero).length;
    assert.equal(veces, 1, `la sección ${s.numero} («${s.titulo}») está mapeada ${veces} veces en SECCIONES_DE_TAB`);
  }
});

test('ninguna sección se pierde ni se repite al partir el documento', () => {
  const { secciones } = cortarSecciones(DOC);
  const tabs = TABS_PLAYBOOK.map((t) => t.id).filter((t) => t !== 'autores') as Array<Exclude<(typeof TABS_PLAYBOOK)[number]['id'], 'autores'>>;
  const textos = Object.fromEntries(tabs.map((t) => [t, textoDeTab(DOC, t)]));
  for (const t of tabs) assert.ok(textos[t].trim().length > 500, `la tab ${t} sale casi vacía`);
  for (const s of secciones) {
    const donde = tabs.filter((t) => textos[t].includes(s.texto.split('\n')[0]));
    assert.deepEqual(donde, [tabDeSeccion(s.numero)], `«${s.titulo}» aparece en ${JSON.stringify(donde)}`);
  }
  // La introducción (para qué sirve y de dónde sale) va arriba del criterio.
  assert.match(textos.criterio.split('\n').slice(0, 12).join('\n'), /Para qué sirve/);
});

test('el índice de secciones resuelve «§N.N» con el ancla que pone MarkdownDoc', () => {
  const idx = indiceDeSecciones(DOC);
  assert.equal(idx.get('2.10')?.tab, 'criterio');
  assert.equal(idx.get('9.5')?.tab, 'discrepancias');
  assert.equal(idx.get('7.1')?.tab, 'precio');
  assert.equal(claveDeReferencia('§2.10'), '2.10');
  assert.equal(claveDeReferencia('§ 9'), '9');
  assert.equal(claveDeReferencia('sin número'), null);
});

test('las conclusiones por autor: los cinco cursos principales, con fuente y sin links muertos', () => {
  assert.ok(AUTORES_OFERTA.length >= 5, `hay ${AUTORES_OFERTA.length} autores cargados`);
  for (const nombre of ['Contreras', 'Razzetti', 'Cubría', 'Carrizo', 'Hormozi']) {
    assert.ok(AUTORES_OFERTA.some((a) => a.autor.includes(nombre)), `falta ${nombre}`);
  }
  const temas = new Set(TEMAS_OFERTA.map((t) => t.id));
  const idx = indiceDeSecciones(DOC);
  for (const a of AUTORES_OFERTA) {
    assert.ok(a.tesis.trim() && a.tesis.length <= 300, `${a.autor}: tesis vacía o larga (${a.tesis.length})`);
    assert.ok(a.conclusiones.length >= 2, `${a.autor}: ${a.conclusiones.length} conclusiones`);
    for (const c of a.conclusiones) {
      assert.ok(temas.has(c.tema), `${a.autor}: tema desconocido ${c.tema}`);
      assert.ok(c.fuente.trim(), `${a.autor}: conclusión sin fuente («${c.texto.slice(0, 60)}»)`);
      assert.ok(c.texto.length <= 320, `${a.autor}: conclusión de ${c.texto.length} caracteres`);
    }
    for (const x of a.adopta) {
      const clave = claveDeReferencia(x.seccion);
      assert.ok(clave && idx.has(clave), `${a.autor}: «${x.que.slice(0, 50)}» apunta a ${x.seccion}, que no existe en el marco`);
    }
    if (a.cita) assert.ok(a.cita.split(/\s+/).length < 15, `${a.autor}: la cita tiene ${a.cita.split(/\s+/).length} palabras`);
  }
  // Un autor, una ficha: el índice de arriba linkea por nombre.
  assert.equal(new Set(AUTORES_OFERTA.map((a) => a.autor)).size, AUTORES_OFERTA.length);
});

test('el .md viaja al deploy de esta ruta', () => {
  const cfg = sinComentarios(leer('next.config.ts'));
  assert.match(cfg, /'\/admin\/offer-playbook':\s*\[[^\]]*'\.\/docs\/offer-marco\.md'/);
});

test('la pantalla abre con el guard de super admin y está en la barra', () => {
  const page = sinComentarios(leer('app/admin/offer-playbook/page.tsx'));
  assert.match(page, /const admin = await getSesionAdmin\(\);\s*if \(!admin\) redirect\(/);
  assert.ok(existsSync(join(raiz, 'app/admin/offer-playbook/page.tsx')));
  const nav = sinComentarios(leer('app/_components/nav.ts'));
  assert.match(nav, /key: 'admin-offer-playbook', label: 'Offer Playbook', href: '\/admin\/offer-playbook'/);
});

test('lo que el código todavía no aplica: corto y con quién lo resuelve', () => {
  assert.ok(PENDIENTES_OFFER.length > 0);
  for (const p of PENDIENTES_OFFER) {
    assert.ok(QUIEN_DECIDE[p.decide], `${p.tema}: decide desconocido`);
    for (const [campo, v] of [['marco', p.marco], ['hoy', p.hoy]] as const) {
      assert.ok(v.trim() && v.length <= 200, `${p.tema}: «${campo}» vacío o de ${v.length} caracteres`);
    }
  }
  assert.equal(new Set(PENDIENTES_OFFER.map((p) => p.tema)).size, PENDIENTES_OFFER.length);
  // Se dibuja en la pestaña Criterio.
  assert.match(sinComentarios(leer('app/admin/offer-playbook/page.tsx')), /tab === 'criterio' && <><EnElCodigo \/><ListaPendientes \/><\/>/);
});

// ── Roturas (11/10/2026, base 6/6 en verde; arnés en el scratchpad que restaura de memoria) ──
//   · la sección 8 sin tab ............................ 2 fallos, 4 pases
//   · la sección 9 mapeada en dos tabs ................ 3 fallos, 3 pases
//   · la introducción fuera de «criterio» ............. 1 fallo, 5 pases
//   · un «lo tomó MaKo» apuntando a §99.1 ............. 1 fallo, 5 pases
//   · sin el .md en outputFileTracingIncludes ......... 1 fallo, 5 pases
//   · sin el guard de super admin ..................... 1 fallo, 5 pases
//   · la key de la barra cambiada ..................... 1 fallo, 5 pases

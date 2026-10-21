// =============================================================================
// Second Brain — cada link de un nodo abre lo que dice (20/10/2026)
// =============================================================================
// Lo encontró el chat de CRM: el nodo de un cliente linkeaba «/crm?lead=<id>», y /crm no lee `lead`: el link abría la
// LISTA del CRM y no la ficha. La ficha es /crm/<id> (app/crm/[id]): la misma ruta que usa todo el CRM (`/crm/${l.id}`
// en CrmBoard, duplicados, el formulario de alta) y lib/aviso-lead.ts. El teléfono la traduce sola (lib/movil-rutas.ts) y
// el grafo le suma el ?ws= (Grafo.tsx, `conWs`).
// ⚠️ El test de entonces FIJABA el link roto (`'/crm?lead=500'`): copiaba lo que el código devolvía en vez de lo que la
//    pantalla de destino lee. Por eso este barrido mira el DESTINO: para cada link que arma el grafo (lib/cerebro-*.ts),
//    la ruta existe en app/ y, si lleva un `?param=`, la página lo declara en sus searchParams.
//
// Verificado ROMPIÉNDOLO (20/10/2026, arnés romper.py del scratchpad), contra la base en verde (3 / 0):
//   · el nodo del cliente otra vez con `/crm?lead=${c.leadId}`                 → 0 / 3
//   · un link a una ruta que no existe (`/clientes` en vez de `/clients`)      → 2 / 1
//   · /crm sin declarar `funnel` en sus searchParams                         → 2 / 1
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AristaCerebro, NodoCerebro } from '../lib/cerebro-modelo';
import { agregarLoVivo, LECTURAS_VACIAS } from '../lib/cerebro-vivo';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

test('el nodo de un cliente abre SU FICHA (/crm/<id>), no la lista del CRM', () => {
  const nodos: NodoCerebro[] = [{ id: 'raiz', area: 'norte', etiqueta: 'raiz', detalle: '', fuente: '', autoria: 'mako' }];
  const aristas: AristaCerebro[] = [];
  agregarLoVivo({ nodos, aristas }, {
    ...LECTURAS_VACIAS,
    clientes: { total: 1, recientes: [{ leadId: 500, nombre: 'Ana', empresa: null, fechaCierre: '2026-10-15', sinCobro: false }] },
  }, { raiz: 'raiz', primeraEtapa: null, etapasEnMapa: new Set() });
  const ana = nodos.find((n) => n.id === 'cliente:500');
  assert.ok(ana, 'el cliente está');
  assert.equal(ana!.href, '/crm/500');
  assert.ok(existsSync(join(RAIZ, 'app/crm/[id]/page.tsx')), 'la ruta de la ficha existe');
});

/** Los links que arma el grafo: el path (con `${…}` en los segmentos dinámicos) y el primer `?param=`, si lo hay. */
function linksDelGrafo(): { archivo: string; path: string; param: string | null }[] {
  const archivos = readdirSync(join(RAIZ, 'lib')).filter((f) => /^cerebro-.*\.ts$/.test(f)).map((f) => `lib/${f}`);
  const out: { archivo: string; path: string; param: string | null }[] = [];
  for (const archivo of archivos) {
    for (const m of leer(archivo).matchAll(/href: (?:[\w.?]+ \|\| |[\w.]+ \? )?[`'"](\/[^`'"?]*)(?:\?([a-z_]+)=)?/g)) {
      out.push({ archivo, path: m[1], param: m[2] ?? null });
    }
  }
  return out;
}

/** La carpeta de app/ que sirve ese path: un segmento con `${…}` va a la carpeta dinámica `[x]` de su padre. */
function carpetaDe(path: string): string | null {
  let dir = 'app';
  for (const seg of path.split('/').filter(Boolean)) {
    if (seg.includes('${')) {
      const dinamica = readdirSync(join(RAIZ, dir)).find((d) => /^\[[^.\]]+\]$/.test(d));
      if (!dinamica) return null;
      dir = `${dir}/${dinamica}`;
    } else {
      if (!existsSync(join(RAIZ, dir, seg))) return null;
      dir = `${dir}/${seg}`;
    }
  }
  return existsSync(join(RAIZ, dir, 'page.tsx')) ? dir : null;
}

/** Los searchParams que la página declara: el tipo de `searchParams: Promise<…>`, o el tipo con nombre que use (en la
 *  página o en lo que importa de app/). */
function paramsDeLaPagina(dir: string): string {
  const pagina = leer(`${dir}/page.tsx`);
  const tipo = /searchParams: Promise<(\{[^>]*\}|\w+)>/.exec(pagina)?.[1] ?? '';
  if (tipo.startsWith('{')) return tipo;
  const fuentes = [pagina, ...[...pagina.matchAll(/from '(?:\.\/|@\/app\/)([^']+)'/g)].map((m) => {
    const base = m[0].includes("'./") ? `${dir}/${m[1]}` : `app/${m[1]}`;
    const f = ['.tsx', '.ts'].map((x) => base + x).find((x) => existsSync(join(RAIZ, x)));
    return f ? leer(f) : '';
  })];
  for (const s of fuentes) {
    const def = new RegExp(`type ${tipo} = (\\{[^}]*\\})`).exec(s)?.[1];
    if (def) return def;
  }
  return '';
}

test('cada link del grafo: la ruta existe, y el `?param=` lo lee la página de destino', () => {
  const links = linksDelGrafo();
  assert.ok(links.length >= 10, `se leyeron los links del grafo (${links.length})`);
  assert.ok(links.some((l) => l.path === '/crm/${c.leadId}'), 'el del cliente, entre ellos');
  for (const l of links) {
    const dir = carpetaDe(l.path);
    assert.ok(dir, `${l.archivo}: «${l.path}» no es una ruta de la app`);
    if (!l.param) continue;
    const params = paramsDeLaPagina(dir!);
    assert.match(params, new RegExp(`\\b${l.param}\\?:`), `${l.archivo}: «${l.path}?${l.param}=» — ${dir}/page.tsx no lee \`${l.param}\` (abre otra cosa)`);
  }
});

test('ningún link del grafo usa `?lead=`: la ficha de un lead es /crm/<id>', () => {
  for (const f of readdirSync(join(RAIZ, 'lib')).filter((x) => /^cerebro-.*\.ts$/.test(x))) {
    assert.doesNotMatch(leer(`lib/${f}`), /\?lead=/, `lib/${f}`);
  }
  for (const f of ['app/second-brain/Grafo.tsx', 'app/m/second-brain/SecondBrainM.tsx', 'app/m/second-brain/modelo.ts']) {
    assert.doesNotMatch(leer(f), /\?lead=/, f);
  }
});

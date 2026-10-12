// =============================================================================
// Offer Playbook (/admin/offer-playbook): A definir, el marco partido en tabs y los autores
// =============================================================================
// La tab RENDERIZA docs/offer-marco.md (no lo copia) y lib/offer-autores.ts, y dibuja
// lo que Martín tiene que decidir (pendientes.ts). Lo que se fija acá es lo que se
// rompe sin que nada falle:
//   · una sección del documento que ninguna tab muestra (desaparece en silencio) —
//     se mira en el HTML que se dibuja, no sólo en el reparto,
//   · un «lo tomó MaKo» que apunta a una sección que no existe, o a un ancla que
//     queda adentro de un desplegable cerrado (un link muerto),
//   · una tarjeta de «A definir» sin alguno de sus campos, larga o con jerga,
//   · el «lista para vender» de la pantalla distinto del que calcula el código,
//   · el .md que no llega al deploy (la tab anda en local y sale vacía en producción),
//   · la pantalla sin su guard de super admin, fuera de la barra, con una tab de más
//     o con la fila de tabs arrastrando el parser al navegador,
//   · un color o un tamaño que no existe en los tokens (un var(--x) inexistente NO
//     falla: hereda o vale nada), o voseo en lo que se dibuja.
//
// ⚠️ Los guards de la casa que barren el repo (voseo, var(--fs-*), use client) usan
// `git ls-files`: un archivo nuevo de esta carpeta no lo ven hasta el `git add`. Por
// eso este test lee la carpeta del DISCO. El detector de acá (marcasDeVoseo) es el
// corto; el que genera las formas (tests/puente-panel-copy.test.ts) se corrió a mano
// sobre la carpeta el 11/10/2026: cazó una constante `DEJALO` y se renombró.
//
// Probado rompiéndolo (11/10/2026) — ver el bloque «Roturas» al final.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  cortarSecciones, seccionesDeTab, seccionesDeBloque, indiceDeSecciones, claveDeReferencia, tabDeSeccion,
  hrefDeDestino, idBloque, partirRubrica, partirDiscrepancias, partirErrores, partirPorComas, sinCursivas,
  esCriterioDeMako, tabDeParam, SECCIONES_DE_TAB, BLOQUES_CRITERIO, BLOQUE_FUENTES, TABS_PLAYBOOK, TAB_INICIAL,
  type TabDelMarco,
} from '../app/admin/offer-playbook/secciones';
import { A_DEFINIR, ORDEN_TIPOS } from '../app/admin/offer-playbook/pendientes';
import { mapaDeTemas, nombreCorto, idAutor } from '../app/admin/offer-playbook/mapa-autores';
import { LISTA_PARA_VENDER } from '../app/admin/offer-playbook/EnElCodigo';
import { ListaPendientes } from '../app/admin/offer-playbook/ListaPendientes';
import { Criterio } from '../app/admin/offer-playbook/Criterio';
import { Autores } from '../app/admin/offer-playbook/Autores';
import { Discrepancias } from '../app/admin/offer-playbook/Discrepancias';
import { Errores } from '../app/admin/offer-playbook/Errores';
import { AUTORES_OFERTA, TEMAS_OFERTA } from '../lib/offer-autores';
import { PIEZAS, DIMENSIONES, DIMENSION_IDS, DIMENSIONES_CRITICAS, type NotaDimension } from '../lib/offer-marco';
import { calcularDiagnostico } from '../lib/offer-reglas';
import { marcasDeVoseo } from '../lib/puestas-data';

const raiz = join(__dirname, '..');
const CARPETA = 'app/admin/offer-playbook';
const leer = (rel: string) => readFileSync(join(raiz, rel), 'utf8').replace(/\r\n/g, '\n');
const DOC = leer('docs/offer-marco.md');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const archivos = readdirSync(join(raiz, CARPETA)).filter((f) => /\.(tsx?|css)$/.test(f));

/** El texto de un HTML, como lo lee una persona (sin etiquetas, sin entidades). */
const plano = (html: string) => html
  .replace(/<[^>]+>/g, '')
  .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ');

/** Cada tab dibujada en el servidor, con el documento real. */
function dibujar(tab: TabDelMarco | 'definir', ver: string | null = null): string {
  const el = tab === 'definir' ? createElement(ListaPendientes)
    : tab === 'criterio' ? createElement(Criterio, { doc: DOC, ver })
      : tab === 'autores' ? createElement(Autores, { indice: indiceDeSecciones(DOC), fuentes: seccionesDeTab(DOC, 'autores'), ver })
        : tab === 'discrepancias' ? createElement(Discrepancias, { secciones: seccionesDeTab(DOC, 'discrepancias'), ver })
          : createElement(Errores, { secciones: seccionesDeTab(DOC, 'errores') });
  return renderToStaticMarkup(el);
}
const TABS_MARCO = Object.keys(SECCIONES_DE_TAB) as TabDelMarco[];

/** Dos frases de prosa de una sección (la primera y la última), sin marcas: lo que una persona lee. */
function muestras(cuerpo: string): string[] {
  const prosa = cuerpo.split('\n').map((l) => l.trim())
    .filter((l) => l && !/^(\||#|>|```|-{3,})/.test(l))
    .map((l) => sinCursivas(l).replace(/^(-|\d+\.)\s+/, '').replace(/^\*\*[^*]+\*\*\s*/, '').replace(/\*\*/g, '').replace(/`/g, ''))
    .filter((l) => l.length >= 30 && !/\[[^\]]+\]\(/.test(l));
  const corta = (l: string) => l.slice(0, 42).replace(/\s+\S*$/, '');
  return prosa.length ? [...new Set([corta(prosa[0]), corta(prosa[prosa.length - 1])])] : [];
}

// ── El reparto del documento ─────────────────────────────────────────────────

test('cada «## N.» del marco está mapeado a UNA tab, y cada una de Criterio a UN desplegable', () => {
  const { secciones } = cortarSecciones(DOC);
  assert.ok(secciones.length >= 10, `el marco tiene ${secciones.length} secciones`);
  const mapeadas = Object.values(SECCIONES_DE_TAB).flat();
  const enBloques = BLOQUES_CRITERIO.flatMap((b) => b.secciones);
  for (const s of secciones) {
    const veces = mapeadas.filter((n) => n === s.numero).length;
    assert.equal(veces, 1, `la sección ${s.numero} («${s.titulo}») está mapeada ${veces} veces en SECCIONES_DE_TAB`);
    if (tabDeSeccion(s.numero) === 'criterio') {
      const b = enBloques.filter((n) => n === s.numero).length;
      assert.equal(b, 1, `la sección ${s.numero} («${s.titulo}») está en ${b} desplegables de Criterio`);
    }
  }
  // Y al revés: un desplegable no nombra una sección que Criterio no tiene.
  for (const n of enBloques) assert.ok(SECCIONES_DE_TAB.criterio.includes(n), `BLOQUES_CRITERIO nombra la ${n}, que no es de Criterio`);
  // Precio, garantía, bonos y urgencia (§6-§7) viven en Criterio; las fuentes (§10), en Autores.
  assert.equal(tabDeSeccion(6), 'criterio');
  assert.equal(tabDeSeccion(7), 'criterio');
  assert.equal(tabDeSeccion(10), 'autores');
});

test('ninguna sección desaparece: cada una se LEE en el HTML de su tab, y en ninguna otra', () => {
  const html = Object.fromEntries(TABS_MARCO.map((t) => [t, plano(dibujar(t))]));
  for (const t of TABS_MARCO) assert.ok(html[t].length > 1_000, `la tab ${t} sale casi vacía (${html[t].length} caracteres)`);
  for (const s of cortarSecciones(DOC).secciones) {
    const ms = muestras(s.cuerpo);
    assert.ok(ms.length > 0, `la sección ${s.numero} no tiene prosa para comprobar`);
    for (const m of ms) {
      const donde = TABS_MARCO.filter((t) => html[t].includes(m));
      assert.deepEqual(donde, [tabDeSeccion(s.numero)], `«${m}» (§${s.numero}) se lee en ${JSON.stringify(donde)}`);
    }
  }
  // La introducción (para qué sirve y de dónde sale) va en el primer desplegable de Criterio.
  assert.equal(seccionesDeBloque(DOC, BLOQUES_CRITERIO[0].id).intro?.includes('Para qué sirve'), true);
  assert.match(html.criterio, /Para qué sirve\. La tab Offer usa este marco/);
});

test('Criterio: indicadores, piezas y rúbrica del CÓDIGO, la nota del documento y los cinco desplegables', () => {
  const crudo = dibujar('criterio');
  const html = plano(crudo);
  for (const p of PIEZAS) assert.ok(html.includes(p.label), `falta la pieza ${p.label}`);
  assert.equal((crudo.match(/>Mínima</g) ?? []).length, PIEZAS.filter((p) => p.minimo).length);
  for (const d of DIMENSIONES) assert.ok(html.includes(d.alto) && html.includes(d.bajo), `falta la fila de ${d.id}`);
  assert.equal((crudo.match(/data-critica="true"/g) ?? []).length, DIMENSIONES_CRITICAS.length);
  assert.match(crudo, /class="opb-mal">0-3/);
  assert.match(crudo, /class="opb-bien">7-10/);
  // La rúbrica es ancha: va en una caja que scrollea adentro.
  assert.match(crudo, /class="mk-scroll-x opb-marco"><table class="opb-tabla opb-rubrica"/);
  // «Cómo sale la nota» es el «Cómo se lee» del §4, TAL CUAL, y no se repite en el desplegable.
  const s4 = seccionesDeBloque(DOC, 'rubrica').secciones[0];
  const { comoSeLee, resto } = partirRubrica(s4.cuerpo);
  assert.match(comoSeLee, /promedio × 10/);
  assert.match(comoSeLee, /Lista para salir a vender/);
  assert.equal(s4.cuerpo.split('\n').filter((l) => l.trim() && l.trim() !== '**Cómo se lee**').length,
    [...comoSeLee.split('\n'), ...resto.split('\n')].filter((l) => l.trim()).length, 'partir la rúbrica perdió renglones');
  assert.equal(html.split('promedio de las nueve llevado a 100').length - 1, 1);
  assert.match(html, /Cómo sale la nota/);
  // Los cinco desplegables, cerrados salvo el que pide `?ver=`.
  for (const b of BLOQUES_CRITERIO) assert.ok(crudo.includes(`<details id="${idBloque(b.id)}"`), `falta el desplegable ${b.id}`);
  assert.equal((crudo.match(/<details[^>]*\sopen=""/g) ?? []).length, 0);
  assert.match(dibujar('criterio', 'precio'), new RegExp(`<details id="${idBloque('precio')}" open=""`));
});

test('el «lista para vender» de la pantalla es el que calcula el código', () => {
  const { criticas, piso } = LISTA_PARA_VENDER;
  const notas = (f: (id: (typeof DIMENSION_IDS)[number]) => number): NotaDimension[] =>
    DIMENSION_IDS.map((id) => ({ id, nota: f(id), porque: '', mejora: '' }));
  const esCritica = (id: (typeof DIMENSION_IDS)[number]) => DIMENSIONES_CRITICAS.includes(id);
  assert.equal(calcularDiagnostico(notas((id) => (esCritica(id) ? criticas : piso))).lista, true, 'en el borde exacto tiene que estar lista');
  assert.equal(calcularDiagnostico(notas((id) => (id === DIMENSIONES_CRITICAS[0] ? criticas - 1 : esCritica(id) ? criticas : piso))).lista, false,
    `con una crítica en ${criticas - 1} no puede estar lista`);
  assert.equal(calcularDiagnostico(notas((id) => (esCritica(id) ? criticas : piso - 1))).lista, false, `con una dimensión en ${piso - 1} no puede estar lista`);
});

test('el índice de secciones resuelve «§N.N» con el ancla que pone MarkdownDoc y el desplegable que la muestra', () => {
  const idx = indiceDeSecciones(DOC);
  assert.deepEqual([idx.get('2.10')?.tab, idx.get('2.10')?.abre], ['criterio', 'piezas']);
  assert.deepEqual([idx.get('7.1')?.tab, idx.get('7.1')?.abre], ['criterio', 'precio']);
  assert.deepEqual([idx.get('9.5')?.tab, idx.get('9.5')?.abre], ['discrepancias', '9.5']);
  assert.deepEqual([idx.get('8')?.tab, idx.get('8')?.abre], ['errores', null]);
  assert.deepEqual([idx.get('10')?.tab, idx.get('10')?.abre], ['autores', BLOQUE_FUENTES]);
  assert.equal(hrefDeDestino(idx.get('7.1')!), '/admin/offer-playbook?tab=criterio&ver=precio#71-garantía');
  assert.equal(claveDeReferencia('§2.10'), '2.10');
  assert.equal(claveDeReferencia('§ 9'), '9');
  assert.equal(claveDeReferencia('sin número'), null);
});

// ── Autores ──────────────────────────────────────────────────────────────────

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
  // Un autor, una tarjeta: la tabla de arriba la abre por su ancla.
  assert.equal(new Set(AUTORES_OFERTA.map(idAutor)).size, AUTORES_OFERTA.length);
});

test('cada «lo tomó MaKo» llega: el ancla existe en su tab y `?ver=` abre el desplegable que la contiene', () => {
  const idx = indiceDeSecciones(DOC);
  const destinos = [...new Map(AUTORES_OFERTA.flatMap((a) => a.adopta).map((x) => {
    const d = idx.get(claveDeReferencia(x.seccion)!)!;
    return [`${d.tab}|${d.id}`, d] as const;
  })).values()];
  assert.ok(destinos.length >= 20, `sólo ${destinos.length} destinos distintos`);
  const cache = new Map<string, string>();
  for (const d of destinos) {
    const k = `${d.tab}|${d.abre}`;
    if (!cache.has(k)) cache.set(k, dibujar(d.tab, d.abre));
    const html = cache.get(k)!;
    assert.ok(html.includes(`id="${d.id}"`), `${hrefDeDestino(d)}: el ancla no está en la tab ${d.tab}`);
    if (d.abre) {
      const idDet = d.tab === 'discrepancias' ? d.id : idBloque(d.abre);
      assert.match(html, new RegExp(`<details id="${idDet}" open=""`), `${hrefDeDestino(d)}: el desplegable no llega abierto`);
    }
  }
  assert.doesNotMatch(dibujar('autores'), /opb-ref--muerta/);
});

test('Autores: «quién habla de qué» no pierde conclusiones, y las fuentes (§10) van al final', () => {
  const { principales, resto, filas } = mapaDeTemas();
  const total = AUTORES_OFERTA.reduce((n, a) => n + a.conclusiones.length, 0);
  assert.equal(filas.reduce((n, f) => n + f.total, 0), total, 'la tabla no suma todas las conclusiones');
  assert.equal(principales.length + resto.length, AUTORES_OFERTA.length);
  assert.deepEqual(principales.map((a) => nombreCorto(a.autor)), ['Contreras', 'Razzetti', 'Cubría y Molina', 'Carrizo', 'Hormozi']);
  const crudo = dibujar('autores');
  assert.equal((crudo.match(/<details id="autor-/g) ?? []).length, AUTORES_OFERTA.length);
  assert.ok(crudo.indexOf(`id="${idBloque(BLOQUE_FUENTES)}"`) > crudo.lastIndexOf('<details id="autor-'), 'las fuentes no van al final');
  assert.match(plano(crudo), /Fuentes de cada curso/);
  assert.match(dibujar('autores', idAutor(AUTORES_OFERTA[0])), new RegExp(`<details id="${idAutor(AUTORES_OFERTA[0])}" open=""`));
});

// ── Discrepancias y errores ──────────────────────────────────────────────────

test('Discrepancias: una tarjeta por «9.x», con el criterio de MaKo destacado y sin perder texto', () => {
  const s9 = seccionesDeTab(DOC, 'discrepancias')[0];
  const { preambulo, items } = partirDiscrepancias(s9.cuerpo);
  assert.ok(items.length >= 8, `${items.length} discrepancias`);
  for (const d of items) {
    assert.ok(d.tramos.some(esCriterioDeMako), `${d.clave} sin criterio de MaKo`);
    const leido = d.tramos.map((t) => t.texto).join(' ');
    const original = s9.cuerpo.split(/^###\s+/m).find((b) => b.startsWith(d.clave + ' '))!;
    for (const l of original.split('\n').slice(1).filter((x) => x.trim())) {
      const sinRotulo = l.trim().replace(/^-\s+\*\*[^*]+\*\*\s*/, '');
      assert.ok(leido.includes(sinRotulo), `${d.clave}: se perdió «${sinRotulo.slice(0, 60)}»`);
    }
  }
  assert.equal(preambulo, '');
  const crudo = dibujar('discrepancias');
  assert.equal((crudo.match(/<details /g) ?? []).length, items.length);
  assert.equal((crudo.match(/>Criterio de MaKo</g) ?? []).length, items.length);
});

test('Errores comunes: una tarjeta por fila de la tabla, y lo que no es tabla también se lee', () => {
  const s8 = seccionesDeTab(DOC, 'errores')[0];
  const { antes, filas, despues } = partirErrores(s8.cuerpo);
  assert.ok(filas && filas.length >= 8, `${filas?.length} filas`);
  assert.ok(antes && despues, 'falta el texto de antes o de después de la tabla');
  const crudo = dibujar('errores');
  assert.equal((crudo.match(/class="opb-error"/g) ?? []).length, filas.length);
  // «Lo señalan» no se corta adentro de una cita.
  assert.deepEqual(partirPorComas('Molina («se mejora quitando, no agregando»), Razzetti («píldora»)'),
    ['Molina («se mejora quitando, no agregando»)', 'Razzetti («píldora»)']);
});

test('las cursivas que MarkdownDoc no entiende no se dibujan con los asteriscos', () => {
  assert.equal(sinCursivas('Contreras (*Nicho Dorado*: «los nichos»)'), 'Contreras (Nicho Dorado: «los nichos»)');
  assert.equal(sinCursivas('**negrita** y `a*b*c`'), '**negrita** y `a*b*c`');
  const sinBold = sinCursivas(DOC).replace(/`[^`\n]*`/g, '').replace(/\*\*.+?\*\*/g, '');
  assert.equal((sinBold.match(/\*/g) ?? []).length, 0, 'quedan asteriscos sueltos en el marco');
  for (const t of TABS_MARCO) assert.doesNotMatch(plano(dibujar(t)), /\*[A-Za-zÁÉÍÓÚáéíóúñ]/, `asteriscos a la vista en ${t}`);
});

// ── A definir ────────────────────────────────────────────────────────────────

test('A definir: cada tarjeta con todos sus campos, corta y sin jerga; la primera, las cifras inventadas', () => {
  assert.ok(A_DEFINIR.length > 0);
  assert.equal(A_DEFINIR[0].clave, 'cifras');
  assert.deepEqual(A_DEFINIR.map((p) => p.n), A_DEFINIR.map((_, i) => i + 1), 'la numeración no es correlativa');
  // Agrupadas: primero un tipo entero y después el otro, en el orden de ORDEN_TIPOS.
  const tipos = A_DEFINIR.map((p) => p.tipo).filter((t, i, xs) => xs[i - 1] !== t);
  assert.deepEqual(tipos, ORDEN_TIPOS.filter((t) => tipos.includes(t)), `los grupos se mezclan: ${tipos}`);
  assert.equal(new Set(A_DEFINIR.map((p) => p.clave)).size, A_DEFINIR.length);
  const JERGA = /\bD[1-9]\b|§|\.tsx?\b|\blib\/|\bapp\/|\bprompt\b|\bpipeline\b|\bjson\b/i;
  for (const p of A_DEFINIR) {
    const techo: Array<[string, string, number]> = [
      ['titulo', p.titulo, 40], ['hoy', p.hoy, 240], ['pregunta', p.pregunta, 70], ['porque', p.porque, 100],
      ...p.opciones.flatMap((o) => [[`opción ${o.letra}`, o.texto, 40], [`consecuencia ${o.letra}`, o.consecuencia, 110]] as Array<[string, string, number]>),
    ];
    for (const [campo, v, max] of techo) {
      assert.ok(v.trim(), `${p.clave}: «${campo}» vacío`);
      assert.ok(v.length <= max, `${p.clave}: «${campo}» de ${v.length} caracteres (techo ${max})`);
      assert.doesNotMatch(v, JERGA, `${p.clave}: «${campo}» tiene jerga`);
      assert.deepEqual(marcasDeVoseo(v), [], `${p.clave}: voseo en «${campo}»`);
    }
    assert.ok(p.hoy.split(/(?<=[.!?])\s+/).length <= 2, `${p.clave}: «qué pasa hoy» en más de dos frases`);
    assert.ok(p.opciones.length >= 2 && p.opciones.length <= 3, `${p.clave}: ${p.opciones.length} opciones`);
    assert.deepEqual(p.opciones.map((o) => o.letra), ['A', 'B', 'C'].slice(0, p.opciones.length));
    assert.ok(p.opciones.some((o) => o.letra === p.recomiendo), `${p.clave}: recomienda una opción que no está`);
    if (p.tipo === 'correccion') assert.equal(p.pregunta, '¿Lo arreglo?');
  }
  const crudo = dibujar('definir');
  const html = plano(crudo);
  assert.match(html, /Responde en el chat con el número y la letra/);
  for (const p of A_DEFINIR) {
    assert.ok(crudo.includes(`id="pendiente-${p.clave}"`), `falta la tarjeta ${p.clave}`);
    assert.match(crudo, new RegExp(`id="pendiente-${p.clave}"[\\s\\S]*?Mi recomendación</span><strong>${p.recomiendo}\\.</strong>`),
      `${p.clave}: la recomendación no dice su letra`);
  }
  assert.equal((crudo.match(/data-rec="true"/g) ?? []).length, A_DEFINIR.length, 'cada tarjeta resalta UNA opción');
});

// ── La pantalla ──────────────────────────────────────────────────────────────

test('la barra: cinco pestañas, «A definir» primero y con su número; las que se fueron caen donde quedó su contenido', () => {
  assert.deepEqual(TABS_PLAYBOOK.map((t) => t.label), ['A definir', 'Criterio', 'Autores', 'Discrepancias', 'Errores comunes']);
  assert.equal(TAB_INICIAL, 'definir');
  assert.equal(tabDeParam(undefined), 'definir');
  assert.equal(tabDeParam('precio'), 'criterio');
  assert.equal(tabDeParam('fuentes'), 'autores');
  assert.equal(tabDeParam('cualquiera'), 'definir');
  const page = sinComentarios(leer(`${CARPETA}/page.tsx`));
  assert.match(page, /<TabsPlaybook activa=\{tab\} cuentas=\{\{ definir: A_DEFINIR\.length \}\} \/>/);
  // La fila de tabs es lo único cliente, y no arrastra secciones.ts (que trae MarkdownDoc) al navegador.
  const fila = leer(`${CARPETA}/TabsPlaybook.tsx`);
  assert.match(fila, /^'use client';/);
  assert.match(fila, /from '\.\/tabs'/);
  assert.doesNotMatch(sinComentarios(fila), /from '\.\/secciones'|MarkdownDoc/);
  assert.doesNotMatch(sinComentarios(leer(`${CARPETA}/tabs.ts`)), /^\s*import\s/m);
  for (const f of archivos.filter((x) => x !== 'TabsPlaybook.tsx')) {
    assert.doesNotMatch(leer(`${CARPETA}/${f}`).slice(0, 400), /^\s*['"]use client['"]/m, `${f} no debería ser cliente`);
  }
});

test('la pantalla abre con el guard de super admin, está en la barra y el .md viaja al deploy', () => {
  const page = sinComentarios(leer(`${CARPETA}/page.tsx`));
  assert.match(page, /const admin = await getSesionAdmin\(\);\s*if \(!admin\) redirect\(/);
  assert.ok(existsSync(join(raiz, `${CARPETA}/page.tsx`)));
  const nav = sinComentarios(leer('app/_components/nav.ts'));
  assert.match(nav, /key: 'admin-offer-playbook', label: 'Offer Playbook', href: '\/admin\/offer-playbook'/);
  const cfg = sinComentarios(leer('next.config.ts'));
  assert.match(cfg, /'\/admin\/offer-playbook':\s*\[[^\]]*'\.\/docs\/offer-marco\.md'/);
});

test('reglas de la casa: tokens que existen en claro y oscuro, el ancho por Pagina, tablas en .mk-scroll-x, Link de la casa y sin voseo', () => {
  const css = leer('app/globals.css') + leer('app/_ui/ui.css');
  const bloque = (abre: string) => { const i = css.indexOf(abre); assert.ok(i >= 0, `no encuentro ${abre}`); return css.slice(i, css.indexOf('\n}', i)); };
  const claro = bloque(':root {');
  const oscuro = bloque('[data-tema="oscuro"] {');
  const definido = (t: string, en: string) => new RegExp(`^\\s*${t}\\s*:`, 'm').test(en);
  // Un solo hex en los dos temas, a propósito (app/_ui/LEEME.md).
  const MISMO_EN_LOS_DOS = new Set(['--mako']);
  const usados = new Set<string>();
  for (const f of archivos) for (const m of leer(`${CARPETA}/${f}`).matchAll(/var\((--[a-z0-9-]+)\)/g)) usados.add(m[1]);
  assert.ok(usados.size > 15, `sólo ${usados.size} tokens: el barrido no está leyendo`);
  for (const t of usados) {
    assert.ok(definido(t, css), `${t} no existe en app/globals.css ni en ui.css`);
    const valor = claro.match(new RegExp(`^\\s*${t}\\s*:\\s*([^;]+);`, 'm'))?.[1] ?? '';
    if (/^(#|rgb)/.test(valor.trim()) && !MISMO_EN_LOS_DOS.has(t)) assert.ok(definido(t, oscuro), `${t} es un color sin versión oscura`);
  }
  for (const t of [...usados].filter((x) => x.startsWith('--fs-'))) {
    assert.ok(['--fs-card', '--fs-kpi', '--fs-md', '--fs-meta', '--fs-page', '--fs-sect', '--fs-sm'].includes(t), `${t} no es de la escala`);
  }
  const page = sinComentarios(leer(`${CARPETA}/page.tsx`));
  assert.match(page, /<Pagina>/);
  for (const f of archivos.filter((x) => x.endsWith('.tsx'))) {
    const src = sinComentarios(leer(`${CARPETA}/${f}`));
    assert.doesNotMatch(src, /maxWidth/, `${f}: un ancho propio (lo pone Pagina)`);
    assert.doesNotMatch(src, /from 'next\/link'/, `${f}: Link de Next en vez del de la casa`);
    assert.doesNotMatch(src, /useRouter[^;]*from 'next\/navigation'/, `${f}: router de Next en vez del de la casa`);
    const tablas = (src.match(/<table/g) ?? []).length;
    assert.ok(tablas <= (src.match(/mk-scroll-x/g) ?? []).length, `${f}: una tabla fuera de .mk-scroll-x`);
    const visible = src.replace(/^\s*import .*$/gm, '');
    assert.deepEqual(marcasDeVoseo(visible), [], `${f}: voseo en lo que se dibuja`);
  }
  // El único tope de ancho de la hoja es el del párrafo (la medida de lectura).
  const hoja = leer(`${CARPETA}/playbook.css`).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.deepEqual([...hoja.matchAll(/^(\.[^{]+)\{[^}]*max-width/gm)].map((m) => m[1].trim()), ['.opb-texto']);
  for (const f of archivos.filter((x) => x.endsWith('.ts'))) {
    assert.deepEqual(marcasDeVoseo(sinComentarios(leer(`${CARPETA}/${f}`))), [], `${f}: voseo`);
  }
});

// ── Roturas (11/10/2026, base 15/15 en verde; arnés en el scratchpad que restaura de memoria) ──
//   · la sección 8 sin tab ................................ 4 fallos, 11 pases
//   · la sección 9 mapeada en dos tabs .................... 4 fallos, 11 pases
//   · el §6 fuera de su desplegable de Criterio ........... 1 fallo, 14 pases
//   · la introducción fuera del primer desplegable ........ 1 fallo, 14 pases
//   · un link «§N.N» de Criterio que no abre su desplegable 1 fallo, 14 pases
//   · Desplegable que ignora `abierto` .................... 3 fallos, 12 pases
//   · el criterio de MaKo sin destacar .................... 1 fallo, 14 pases
//   · partirDiscrepancias tira las viñetas «Por qué» ...... 2 fallos, 13 pases
//   · «Lo señalan» cortado adentro de una cita ............ 1 fallo, 14 pases
//   · sinCursivas apagado (asteriscos a la vista) ......... 1 fallo, 14 pases
//   · decisiones antes que correcciones ................... 1 fallo, 14 pases
//   · una tarjeta sin «Mi recomendación» .................. 1 fallo, 14 pases
//   · recomienda una letra que no está en sus opciones .... 1 fallo, 14 pases
//   · jerga («D1») en una tarjeta ......................... 1 fallo, 14 pases
//   · «qué pasa hoy» de más de 240 caracteres ............. 2 fallos, 13 pases
//   · voseo («querés») en una tarjeta ..................... 2 fallos, 13 pases
//   · voseo («vos») en un rótulo de un componente ......... 1 fallo, 14 pases
//   · «lista para vender» de la pantalla en 6 ............. 1 fallo, 14 pases
//   · la rúbrica fuera de .mk-scroll-x .................... 2 fallos, 13 pases
//   · un color sin versión oscura (--warn-fill) ........... 1 fallo, 14 pases
//   · un --fs-* inexistente (--fs-xs) ..................... 1 fallo, 14 pases
//   · un maxWidth propio en un componente ................. 1 fallo, 14 pases
//   · la fila de tabs importa secciones.ts ................ 1 fallo, 14 pases
//   · vuelve la tab «Fuentes» ............................. 1 fallo, 14 pases
//   · un link viejo ?tab=precio cae en «A definir» ........ 1 fallo, 14 pases
//   · sin el guard de super admin ......................... 1 fallo, 14 pases
//   · «A definir» sin su número en la barra ............... 1 fallo, 14 pases
//   ⚠️ «Respondé» en el texto de arriba de «A definir» lo cazó la frase exacta y NO
//   marcasDeVoseo, que no conoce ese verbo: el detector corto sólo ve su lista. Lo que
//   cubre el resto es el guard que genera las formas (tests/puente-panel-copy.test.ts),
//   una vez que estos archivos estén en el índice.

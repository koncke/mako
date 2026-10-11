// =============================================================================
// editor-landing-plantillas — las 10 landings y los diseños de sección
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Las plantillas
// (lib/editor-landing/plantillas.ts) son lo primero que ve quien abre el editor sin nada
// escrito, y lo que se copia a SU landing. Lo que estos tests cuidan:
//   · que cada plantilla pase el saneo del server (validar.ts) SIN UN CAMBIO: lo que se
//     inserta es lo que se guarda, y nada se arregla en silencio al primer guardado;
//   · que la conversión no haya tenido que corregir nada (una variante, un ícono o un
//     destino mal escrito se «arregla» solo para quien la usa: acá tiene que verse);
//   · que los botones de captación lleguen a una sección que existe y los formularios
//     entren al CRM (email o teléfono);
//   · que no haya un solo nombre real (AGENTS.md: un ejemplo con datos de un cliente se lee
//     como un dato) y que el copy esté en español neutro;
//   · y que dos landings de la misma plantilla no compartan ids.
// Se lee el fuente SIN comentarios (AGENTS.md: un guard que busca lo que NO tiene que estar
// se acusa a sí mismo por el párrafo que explica por qué no está).
//
// PROBADO ROMPIÉNDOLO (11/10/2026, scratchpad/paqC/romper.mjs, en memoria y sin git): al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  PLANTILLAS, DISENOS_SECCION, CATEGORIAS_PLANTILLA, armarConDescartes, plantillaPorId, disenoSeccionPorId,
} from '../lib/editor-landing/plantillas';
import { sanearContenido } from '../lib/editor-landing/validar';
import { TEMAS } from '../lib/editor-landing/temas';
import { NOMBRES_ICONO } from '../lib/editor-landing/iconos';
import { NODO, textoDe, textoDeContenido, type JsonNodo, type LandingContenido } from '../lib/editor-landing/doc';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const sinAcentos = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function* nodos(n: JsonNodo): Generator<JsonNodo> {
  yield n;
  for (const c of n.content ?? []) yield* nodos(c);
}
const todos = (c: LandingContenido) => c.paginas.flatMap((p) => p.doc.content.flatMap((t) => [...nodos(t)]));

/** Gente y negocios REALES de este producto (la misma lista que tests/variables-aviso.test.ts). */
const REALES = [
  'Mauricio', 'Leila', 'Martín', 'Joan', 'Juan Francisco', 'Brigitte',
  'Código Inmobiliario', 'Negocio que Escala', 'MasteryHaus', 'Vértice', 'AvatarHype',
  'Francisco Ramos', 'Dental Ramos', 'Sergio Esquer', 'BG Trucking', 'Aspro', 'Bustos', 'Koncke',
];

test('son 10 landings con id único, categoría de la lista y un tema que existe', () => {
  assert.equal(PLANTILLAS.length, 10);
  assert.equal(new Set(PLANTILLAS.map((p) => p.id)).size, 10);
  const temas = new Set(TEMAS.map((t) => t.id));
  for (const p of PLANTILLAS) {
    assert.ok((CATEGORIAS_PLANTILLA as readonly string[]).includes(p.categoria), p.id);
    assert.ok(temas.has(p.tema), `${p.id}: tema «${p.tema}» no existe`);
    assert.ok(p.nombre && p.descripcion.length <= 80, p.id);
    assert.equal(plantillaPorId(p.id), p);
  }
});

test('toda plantilla pasa el saneo del server SIN UN CAMBIO, y la conversión no tuvo que corregir nada', () => {
  for (const p of PLANTILLAS) {
    const { valor: c, descartes } = armarConDescartes(() => p.contenido());
    assert.deepEqual(descartes, [], `${p.id}: la conversión corrigió algo`);
    const saneo = sanearContenido(c);
    assert.deepEqual(saneo.descartes, [], `${p.id}: el saneo tiró algo`);
    assert.deepEqual(saneo.contenido, c, `${p.id}: el saneo cambió algo`);
  }
});

test('cada landing tiene entre 6 y 10 secciones en su página de inicio, y UN solo Título por página', () => {
  for (const p of PLANTILLAS) {
    const c = p.contenido();
    const inicio = c.paginas.find((x) => x.ruta === '')!;
    const n = inicio.doc.content.length;
    assert.ok(n >= 6 && n <= 10, `${p.id}: ${n} secciones`);
    for (const pg of c.paginas) {
      const titulos = pg.doc.content.flatMap((t) => [...nodos(t)]).filter((x) => x.type === 'heading' && x.attrs?.variante === 'titulo');
      assert.equal(titulos.length, 1, `${p.id} / ${pg.titulo}: ${titulos.length} títulos`);
    }
  }
});

test('los botones apuntan a una sección que existe (o quedan en «#» para el enlace de pago), y los formularios entran al CRM', () => {
  for (const p of PLANTILLAS) {
    const c = p.contenido();
    for (const pg of c.paginas) {
      const ids = new Set(pg.doc.content.map((t) => t.attrs?.id));
      for (const n of pg.doc.content.flatMap((t) => [...nodos(t)])) {
        if (n.type === NODO.boton) {
          const href = String(n.attrs?.href);
          assert.ok(href === '#' || (href.startsWith('#t-') && ids.has(href.slice(3))), `${p.id}: botón «${textoDe(n)}» → ${href}`);
        }
        if (n.type === NODO.formulario) {
          const tipos = (n.attrs?.campos as { tipo: string }[]).map((x) => x.tipo);
          assert.ok(tipos.includes('email') || tipos.includes('telefono'), `${p.id}: formulario sin email ni teléfono`);
        }
      }
    }
    // Las de captación tienen formulario y su botón principal lleva ahí.
    if (['Agendar', 'Captar contactos', 'Eventos', 'Servicios'].includes(p.categoria)) {
      const [inicio] = c.paginas;
      const conForm = inicio.doc.content.find((t) => [...nodos(t)].some((x) => x.type === NODO.formulario));
      assert.ok(conForm, `${p.id}: sin formulario`);
      const primero = [...nodos(inicio.doc.content[0])].find((x) => x.type === NODO.boton);
      if (primero) assert.equal(primero.attrs?.href, `#t-${conForm!.attrs?.id}`, `${p.id}: el botón del inicio no va al formulario`);
    }
  }
});

test('los diseños «con íconos» tienen un ícono del set en cada ítem, y ninguna imagen viene cargada', () => {
  const set = new Set(NOMBRES_ICONO);
  const conIcono = new Set(['vinetas-iconos', 'cajas-iconos', 'etapas-iconos', 'iconos-texto', 'iconos-izquierda', 'iconos-grandes']);
  for (const p of PLANTILLAS) {
    const c = p.contenido();
    for (const n of todos(c)) {
      if (n.type === NODO.optimizado && conIcono.has(String(n.attrs?.variante))) {
        for (const it of n.content ?? []) assert.ok(set.has(String(it.attrs?.icono)), `${p.id}: «${textoDe(it).slice(0, 30)}» sin ícono`);
      }
      if (n.type === NODO.tarjeta || n.type === NODO.optimizadoItem) assert.equal(n.attrs?.imagenSrc, null, `${p.id}: imagen cargada`);
      assert.notEqual(n.type, NODO.imagen, `${p.id}: una imagen de bloque necesita src`);
    }
    // Hay al menos un hueco de imagen de acento para que la persona elija.
    assert.ok(c.paginas.some((pg) => pg.doc.content.some((t) => t.attrs?.diseno !== 'sin')) || p.id === 'gracias', `${p.id}: sin imagen de acento`);
  }
});

test('dos landings de la misma plantilla no comparten ids (de sección, de página ni de campo)', () => {
  for (const p of PLANTILLAS) {
    const ids = (c: LandingContenido) => [
      ...c.paginas.map((x) => x.id),
      ...todos(c).filter((n) => n.type === NODO.tarjeta).map((n) => String(n.attrs?.id)),
      ...todos(c).filter((n) => n.type === NODO.formulario).flatMap((n) => (n.attrs?.campos as { id: string }[]).map((x) => x.id)),
    ];
    const a = ids(p.contenido());
    const b = ids(p.contenido());
    assert.equal(new Set(a).size, a.length, `${p.id}: ids repetidos adentro`);
    assert.equal(a.filter((x) => b.includes(x)).length, 0, `${p.id}: dos llamadas comparten ids`);
  }
});

test('ningún nombre real: ni en el fuente ni en lo que se dibuja', () => {
  const fuente = sinAcentos(sinComentarios(leer('lib/editor-landing/plantillas.ts')));
  const dibujado = sinAcentos(PLANTILLAS.map((p) => textoDeContenido(p.contenido())).join('\n') + DISENOS_SECCION.map((d) => textoDe(d.crear())).join('\n'));
  for (const nombre of REALES) {
    const n = sinAcentos(nombre);
    assert.equal(fuente.includes(n), false, `«${nombre}» en plantillas.ts`);
    assert.equal(dibujado.includes(n), false, `«${nombre}» en una plantilla`);
  }
});

test('el copy está en español neutro (tú), en las plantillas y en los diseños de sección', () => {
  const textos = [
    ...PLANTILLAS.flatMap((p) => [p.nombre, p.descripcion, textoDeContenido(p.contenido()), ...p.contenido().paginas.flatMap((x) => [x.seoTitulo ?? '', x.seoDescripcion ?? ''])]),
    ...DISENOS_SECCION.flatMap((d) => [d.nombre, textoDe(d.crear())]),
  ];
  const marcas = textos.flatMap((t) => marcasDeVoseo(t));
  assert.deepEqual(marcas, []);
  // `marcasDeVoseo` no ve los imperativos («Agendá», «Mirá»), que son justo la forma de un
  // botón. El detector completo es el del guard del repo (`voseoEn`, tests/puente-panel-copy.test.ts,
  // conjugado desde infinitivos); se corre en OTRO proceso para no traer sus tests a este archivo.
  // Ese guard barre lib/ con `git ls-files`, o sea que no ve plantillas.ts hasta el `git add`:
  // éste lo cubre antes.
  const guard = pathToFileURL(join(RAIZ, 'tests/puente-panel-copy.test.ts')).href;
  const script = `import { readFileSync } from 'node:fs'; import { voseoEn } from ${JSON.stringify(guard)}; const t = JSON.parse(readFileSync(0, 'utf8')); console.log('VOSEO' + JSON.stringify(t.flatMap((x) => voseoEn(x).map((h) => h.forma)))); process.exit(0);`;
  const salida = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { cwd: RAIZ, input: JSON.stringify(textos), encoding: 'utf8' });
  const linea = salida.split('\n').find((l) => l.startsWith('VOSEO'));
  assert.ok(linea, `el detector no contestó: ${salida.slice(0, 300)}`);
  assert.deepEqual(JSON.parse(linea.slice(5)), []);
});

test('diseños de sección: unos 18, con ícono del set, cada uno una tarjeta válida y sin «Título»', () => {
  assert.ok(DISENOS_SECCION.length >= 18, `${DISENOS_SECCION.length}`);
  assert.equal(new Set(DISENOS_SECCION.map((d) => d.id)).size, DISENOS_SECCION.length);
  const set = new Set(NOMBRES_ICONO);
  for (const d of DISENOS_SECCION) {
    assert.ok(set.has(d.icono), `${d.id}: ícono «${d.icono}» no existe`);
    assert.equal(disenoSeccionPorId(d.id), d);
    const { valor: t, descartes } = armarConDescartes(() => d.crear());
    assert.deepEqual(descartes, [], d.id);
    assert.equal(t.type, NODO.tarjeta);
    assert.equal([...nodos(t)].some((n) => n.type === 'heading' && n.attrs?.variante === 'titulo'), false, `${d.id} trae un «Título»`);
    const c: LandingContenido = { v: 1, paginas: [{ id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: [t] } }] };
    const saneo = sanearContenido(c);
    assert.deepEqual(saneo.descartes, [], d.id);
    assert.deepEqual(saneo.contenido, c, d.id);
    assert.notEqual(d.crear().attrs?.id, t.attrs?.id, `${d.id}: dos inserciones comparten id`);
  }
  // Los nombres que pide el relevo de Gamma.
  for (const nombre of ['Un encabezado y tres columnas', 'Título y subtítulo', 'Imagen principal + título', 'Una foto hermosa con texto superpuesto', 'Un encabezado, un párrafo y un botón']) {
    assert.ok(DISENOS_SECCION.some((d) => d.nombre === nombre), `falta «${nombre}»`);
  }
});

// ── PROBADO ROMPIÉNDOLO (11/10/2026) ──────────────────────────────────────────
// scratchpad/paqC/romper.mjs (en memoria, restaurado byte a byte, sin git). Base: 9 pasan.
//   · «Mauricio» en vez de «[Tu nombre]» ..................... 1 fallo (nombre real)
//   · una variante mal escrita ('linea-lateralx') ............ 1 fallo (saneo / descartes): la
//     conversión la «arregla» a Viñetas grandes, y sólo el colector de descartes lo ve
//   · «Agendá tu llamada» en un botón ........................ 1 fallo (español neutro)
//     ⚠️ Con `marcasDeVoseo` sola daba VERDE: no ve los imperativos. Por eso corre además
//     `voseoEn`, el detector del guard del repo, en otro proceso.
//   · el botón del inicio a '#seccion-99' .................... 2 fallos (saneo/descartes, botones)
//   · un ítem de «Íconos con texto» sin ícono ................ 1 fallo (íconos)
//   · un diseño de sección con «Título» ...................... 1 fallo (diseños de sección)

// =============================================================================
// web-generator-carrusel-45 — el carrusel vertical 4:5 SE PUEDE ELEGIR al crear
// =============================================================================
// Pedido de Leila TRES veces (llamada del 5/11/2026; pedidos 2.14 / 3.9 / 4.10 de
// docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:66): «falta el formato vertical 4:5 en el
// Web Generator». Armaba el carrusel en el Image Editor —lento, emulando Canva— porque el rápido
// no ofrecía ese tamaño.
//
// La PROPORCIÓN 4:5 ya estaba (`cd0f4811e`, 6/11: tests/editor-landing-carrusel-45.test.ts cuida
// la hoja, el PDF, el PPTX y la miniatura). Lo que faltaba, y es lo que cuida ESTE archivo, es
// que se pueda ELEGIR AL CREAR —no cambiándole la relación de aspecto a mano después— con las
// plantillas de carrusel de MaKo:
//   · las 8 plantillas salen de `TIPOS_CARRUSEL` (lib/carruseles/tipos.ts), las MISMAS que el
//     Image Editor: ninguna duplicada, y si allá se suma un tipo, aparece acá (se cuenta);
//   · se arman válidas, sin un solo descarte de la gramática, y nacen 4:5 por el alta de la
//     pantalla (`pedidoDePlantilla`), no por un objeto armado a mano;
//   · todo pedido a la IA lleva la proporción, y con 4:5 la IA recibe las reglas de LÁMINA (en
//     4:5 entra la mitad del texto) y no las de diapositiva;
//   · la UI dice «lámina» y concuerda en masculino («el carrusel», «generado»);
//   · y la API de MaKo lo crea con la misma operación.
//
// Probado rompiéndolo (6/11/2026): 28 piezas rotas a propósito, 28 rojos. Los números al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://proyecto.supabase.co';

import {
  PLANTILLAS_CARRUSEL, PROPORCION_CARRUSEL, REGLAS_CARRUSEL_EDITAR, REGLAS_CARRUSEL_ESQUEMA,
  REGLAS_CARRUSEL_SECCIONES, armarCarrusel, plantillaCarruselPorId, tarjetaDeLamina,
} from '../lib/editor-landing/plantillas-carrusel';
import { TIPOS_CARRUSEL } from '../lib/carruseles/tipos';
import { PLANTILLAS_PRESENTACION } from '../lib/editor-landing/plantillas-presentaciones';
import {
  DocDe, EJEMPLOS_CAJA, ICONO_TIPO, NOMBRE_TIPO, TIPOS_CREAR, configDeCreacion, docDe, elDocDe,
  esteDocDe, formatoDeTipo, paramsDeTipo, participio, pedidoDePlantilla, plantillasDe,
  proporcionDeTipo, termino, tipoValido,
} from '../app/web-generator/crear/tipo';
import { ANCHO_DIAPO_EM, CONFIG_DEFAULT, PROPORCIONES, cuadroCss, relacionDe, terminoTarjeta } from '../lib/editor-landing/api-tipos';
import { formaDeLaFoto } from '../lib/editor-landing/exportar-png';
import { sanearConfig } from '../lib/editor-landing/validar';
import { NOMBRES_ICONO } from '../lib/editor-landing/iconos';
import { textoDeContenido } from '../lib/editor-landing/doc';
import { TEMAS, temaPorId } from '../lib/editor-landing/temas';
import { MiniaturaLanding } from '../app/web-generator/MiniaturaLanding';
import { problemasDelEjemplo } from './_reales';

const CARRUSEL = { formato: 'presentacion', proporcion: '4:5' } as const;

/** Las plantillas de presentación y de carrusel, que nacen las dos como presentación. */
const TODAS = [...PLANTILLAS_PRESENTACION, ...PLANTILLAS_CARRUSEL];

// ─────────────────────────────────────────────────────────────────────────────
// 1. Se puede ELEGIR: el tipo «Carrusel» en la pantalla de crear
// ─────────────────────────────────────────────────────────────────────────────

test('«Carrusel» es un tipo que se ofrece al crear, y nace 4:5 sin tocar Configuración', () => {
  assert.ok((TIPOS_CREAR as readonly string[]).includes('carrusel'), 'la pantalla no ofrece Carrusel');
  assert.equal(tipoValido('carrusel'), 'carrusel');
  // Un carrusel es una PRESENTACIÓN de 4:5: no hay formato nuevo (api-tipos.ts, `FORMATOS`).
  assert.equal(formatoDeTipo('carrusel'), 'presentacion');
  assert.equal(proporcionDeTipo('carrusel'), '4:5');
  assert.equal(proporcionDeTipo('presentacion'), '16:9');
  assert.ok((PROPORCIONES as readonly string[]).includes(PROPORCION_CARRUSEL), 'la forma del carrusel no está en PROPORCIONES');

  // El alta de la IA: nace 4:5 y SOBREVIVE al saneo del server (lo que tira `sanearConfig` se
  // guarda como 16:9 y la persona vuelve a tener que cambiarlo a mano: el bug original).
  const c = configDeCreacion('carrusel', 'pewter', { modo: 'ia', pedido: 'algo' });
  assert.equal(c.formato, 'presentacion');
  assert.equal(c.proporcion, '4:5');
  const guardada = sanearConfig(c).config;
  assert.equal(guardada.formato, 'presentacion');
  assert.equal(guardada.proporcion, '4:5', 'el guardado le cambió la forma');
  assert.equal(relacionDe(guardada), 4 / 5);

  // Los rótulos de la pastilla y su ícono: `svgIcono` con un nombre que no existe devuelve un
  // hueco SIN avisar, así que los tres se cuentan contra el catálogo.
  assert.equal(NOMBRE_TIPO.carrusel, 'Carrusel');
  for (const t of TIPOS_CREAR) assert.ok((NOMBRES_ICONO as readonly string[]).includes(ICONO_TIPO[t]), `${t}: el ícono «${ICONO_TIPO[t]}» no existe`);
  assert.ok((EJEMPLOS_CAJA.carrusel?.length ?? 0) >= 3, 'la caja no tiene ejemplos de carrusel');
  for (const e of EJEMPLOS_CAJA.carrusel) assert.ok(e.length <= 70, `«${e}» es largo para un placeholder`);
});

test('la palabra: en un carrusel son LÁMINAS, y las frases concuerdan en masculino', () => {
  assert.equal(terminoTarjeta(CARRUSEL), 'lámina');
  assert.equal(terminoTarjeta(CARRUSEL, { plural: true, mayuscula: true }), 'Láminas');
  assert.equal(termino('carrusel', { plural: true }), 'láminas');
  // Una presentación 16:9 y una página no cambian de palabra.
  assert.equal(terminoTarjeta({ formato: 'presentacion', proporcion: '16:9' }), 'diapositiva');
  assert.equal(terminoTarjeta({ formato: 'presentacion' }, { plural: true }), 'diapositivas');
  assert.equal(termino('landing', { plural: true }), 'secciones');

  // «Carrusel» es la primera palabra MASCULINA de la pantalla: sin esto sale «La carrusel».
  assert.equal(elDocDe('carrusel'), 'el carrusel');
  assert.equal(elDocDe('carrusel', { mayuscula: true }), 'El carrusel');
  assert.equal(elDocDe('landing', { mayuscula: true }), 'La landing');
  assert.equal(elDocDe('presentacion'), 'la presentación');
  assert.equal(esteDocDe('carrusel'), 'este carrusel');
  assert.equal(esteDocDe('presentacion'), 'esta presentación');
  assert.equal(participio('carrusel', 'generad'), 'generado');
  assert.equal(participio('presentacion', 'cread'), 'creada');
  assert.equal(DocDe('carrusel'), 'Carrusel');
  assert.equal(docDe('carrusel'), 'carrusel');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Las plantillas: las de MaKo, sin duplicar
// ─────────────────────────────────────────────────────────────────────────────

test('las plantillas de carrusel son los tipos de MaKo, UNA por tipo y en el mismo orden', () => {
  assert.equal(plantillasDe('carrusel'), PLANTILLAS_CARRUSEL);
  // Se CUENTAN contra lib/carruseles/tipos.ts: si allá se suma un tipo y acá no aparece, falla.
  assert.equal(PLANTILLAS_CARRUSEL.length, TIPOS_CARRUSEL.length);
  assert.deepEqual(PLANTILLAS_CARRUSEL.map((p) => p.id), TIPOS_CARRUSEL.map((t) => `carr-${t.id}`));
  assert.deepEqual(PLANTILLAS_CARRUSEL.map((p) => p.nombre), TIPOS_CARRUSEL.map((t) => t.nombre));
  // El id no se puede cruzar con el de una presentación (los dos viajan a `config.origen.plantilla`).
  const ids = new Set(TODAS.map((p) => p.id));
  assert.equal(ids.size, TODAS.length, 'hay un id repetido entre presentaciones y carruseles');
  // El tema de cada una existe en el catálogo (si no, el documento nace con el tema equivocado).
  // ⚠️ Se cuenta contra la LISTA, no con `temaPorId`: ése cae a `pewter` con un id que no existe y
  // nunca devuelve undefined, así que `assert.ok(temaPorId(x))` pasa con cualquier cosa.
  const idsTema = new Set(TEMAS.map((t) => t.id));
  for (const p of PLANTILLAS_CARRUSEL) assert.ok(idsTema.has(p.tema), `${p.id}: el tema «${p.tema}» no existe`);
  assert.equal(temaPorId('no-existe-xyz')?.id, 'pewter', 'temaPorId dejó de caer al default: la nota de arriba cambia');
  assert.ok(new Set(PLANTILLAS_CARRUSEL.map((p) => p.tema)).size >= 4, 'las ocho con el mismo tema: se eligió el default');
  assert.ok(TEMAS.length > 0);
  assert.ok(plantillaCarruselPorId('carr-lista'));
  assert.equal(plantillaCarruselPorId('pres-pitch'), undefined, 'una presentación no es un carrusel');
  assert.equal(plantillaCarruselPorId('lista'), undefined, 'el id del tipo de Imagen no es el de la plantilla');
});

test('cada plantilla se arma VÁLIDA (sin un descarte) y con una lámina por lámina del tipo', () => {
  for (const p of PLANTILLAS_CARRUSEL) {
    const { contenido, descartes } = armarCarrusel(p);
    assert.equal(descartes.length, 0, `${p.id}: ${descartes.join(' · ')}`);
    assert.equal(contenido.paginas.length, 1, `${p.id}: un carrusel es UNA página`);
    const tipo = TIPOS_CARRUSEL.find((t) => `carr-${t.id}` === p.id)!;
    const cuantas = tipo.estructura(tipo.laminas.def).length;
    assert.equal(contenido.paginas[0].doc.content?.length, cuantas, `${p.id}: ${cuantas} láminas en el tipo`);
    assert.ok(cuantas >= 4 && cuantas <= 10, `${p.id}: ${cuantas} láminas`);
    // El texto es el de la estructura de MaKo, tal cual: la conversión no reescribe nada.
    const texto = textoDeContenido(contenido);
    for (const l of tipo.estructura(tipo.laminas.def)) assert.ok(texto.includes(l.titulo), `${p.id}: falta «${l.titulo}»`);
    // Ids NUEVOS en cada llamada (dos altas no pueden compartir el id de una sección).
    assert.notEqual(p.contenido().paginas[0].id, p.contenido().paginas[0].id);
    // Nada de un negocio real ni del nuestro (tests/_reales.ts): el EJEMPLO lleno se queda en Imagen.
    assert.deepEqual(problemasDelEjemplo(texto), [], p.id);
    assert.ok(!texto.includes(tipo.ejemplo.negocio), `${p.id}: entró el ejemplo lleno («${tipo.ejemplo.negocio}»)`);
  }
});

test('la lámina se traduce por su ROL: la portada engancha, el cierre va en acento, el medio rotula', () => {
  const portada = tarjetaDeLamina({ rol: 'portada', rotulo: 'Portada', titulo: 'Un gancho', cuerpo: 'La bajada' });
  assert.equal(portada.fondo, undefined, 'la portada no lleva el fondo del cierre');
  assert.deepEqual(portada.bloques?.map((b) => b.t), ['titulo', 'p-grande']);

  const cierre = tarjetaDeLamina({ rol: 'cierre', rotulo: 'Cierre', titulo: 'Escríbeme', cuerpo: 'Una acción' });
  assert.equal(cierre.fondo, 'acento', 'el cierre de un carrusel va en otro fondo (es donde se pide algo)');
  assert.deepEqual(cierre.bloques?.map((b) => b.t), ['h2', 'p-grande']);

  const medio = tarjetaDeLamina({ rol: 'punto', rotulo: 'Punto 2', titulo: 'Tu punto', cuerpo: 'Una idea' });
  assert.deepEqual(medio.bloques?.map((b) => b.t), ['antetitulo', 'h2', 'p']);
  const primero = medio.bloques?.[0];
  assert.equal(primero && 'texto' in primero ? primero.texto : null, 'Punto 2', 'el rótulo de la lámina va arriba');

  // Una lámina sin cuerpo no deja un párrafo vacío (la gramática lo descartaría).
  assert.equal(tarjetaDeLamina({ rol: 'punto', rotulo: 'R', titulo: 'T', cuerpo: '' }).bloques?.length, 2);
  assert.equal(tarjetaDeLamina({ rol: 'portada', rotulo: 'R', titulo: 'T', cuerpo: '' }).bloques?.length, 1);
  // Ningún rol trae tablas, gráficos ni formularios: no se leen en el teléfono.
  for (const t of TIPOS_CARRUSEL) for (const l of t.estructura(t.laminas.def)) {
    for (const b of tarjetaDeLamina(l).bloques ?? []) assert.ok(!['tabla', 'grafico', 'formulario', 'columnas'].includes(b.t), `${t.id}: ${b.t}`);
  }
});

test('el alta de la pantalla crea el carrusel en 4:5, y el de una presentación sigue en 16:9', () => {
  for (const p of PLANTILLAS_CARRUSEL) {
    const r = pedidoDePlantilla(p);
    assert.equal(r.config?.formato, 'presentacion', p.id);
    assert.equal(r.config?.proporcion, '4:5', `${p.id}: no nace vertical`);
    assert.equal(r.titulo, p.nombre);
    assert.deepEqual(r.config?.origen, { modo: 'plantilla', plantilla: p.id });
    assert.equal(sanearConfig(r.config!).config.proporcion, '4:5', `${p.id}: el saneo le cambió la forma`);
  }
  for (const p of PLANTILLAS_PRESENTACION) assert.equal(pedidoDePlantilla(p).config?.proporcion, '16:9', p.id);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. La IA: con 4:5 escribe láminas, no diapositivas
// ─────────────────────────────────────────────────────────────────────────────

test('la proporción VIAJA a la IA, y en una landing no queda pegada', () => {
  const base = {
    cantidad: 7, textoPorSeccion: 'medio', idioma: 'es-MX', audiencia: '', tono: '', objetivo: 'agendar',
    basadoEnUrl: 'https://ejemplo.com/x', fuenteImagenes: 'stock', instrucciones: '', modoTexto: 'generar',
  } as Parameters<typeof paramsDeTipo>[0];
  const carr = paramsDeTipo(base, 'carrusel');
  assert.equal(carr.formato, 'presentacion');
  assert.equal(carr.proporcion, '4:5', 'sin esto la IA escribe una diapositiva 16:9 que no entra en 4:5');
  assert.equal(carr.basadoEnUrl, null, 'el diagnóstico de una página no es contexto de un carrusel');
  assert.equal(paramsDeTipo(base, 'presentacion').proporcion, '16:9');
  const land = paramsDeTipo({ ...base, proporcion: '4:5' }, 'landing');
  assert.equal(land.formato, 'pagina');
  assert.equal('proporcion' in land, false, 'la forma del carrusel quedó pegada en una landing');
});

test('las reglas del carrusel reemplazan a las de diapositiva en los TRES prompts', () => {
  // Se lee el fuente de ia.ts (server-only: ningún test lo puede importar).
  const src = readFileSync('lib/editor-landing/ia.ts', 'utf8');
  assert.match(src, /const esCarrusel = \(params: unknown\): boolean =>\s*\n?\s*esDiapositivas\(params\) && \(params as \{ proporcion\?: unknown \}\)\.proporcion === '4:5'/);
  // Un solo lugar decide, y los tres prompts lo llaman: esquema, secciones y editar.
  assert.match(src, /if \(esCarrusel\(params\)\) return cual === 'esquema' \? REGLAS_CARRUSEL_ESQUEMA : cual === 'secciones' \? REGLAS_CARRUSEL_SECCIONES : REGLAS_CARRUSEL_EDITAR;/);
  for (const cual of ['esquema', 'secciones', 'editar']) {
    assert.ok(src.includes(`reglasDeFormato(p.params, '${cual}')`), `el prompt de ${cual} no pide las reglas del formato`);
  }
  assert.equal((src.match(/reglasDeFormato\(p\.params, '/g) ?? []).length, 3);
  // Y las viejas ya no se eligen a mano en ningún prompt (si no, el carrusel recibe las dos).
  assert.doesNotMatch(src, /\? REGLAS_DIAPOSITIVAS_(ESQUEMA|SECCIONES|EDITAR) : REGLAS_PAGINA/);
  // El motivo del gasto de IA y el título de respaldo dicen «Carrusel», no «Presentación».
  assert.match(src, /const nombreDoc = .*esCarrusel\(params\) \? 'Carrusel'/);
  assert.match(src, /motivo: `Esquema de \$\{docEnFrase\(p\.params\)\}/);
  assert.match(src, /motivo: `\$\{terminoTarjeta\(p\.params, \{ plural: true, mayuscula: true \}\)\}/);
});

test('las reglas del carrusel dicen lo que hace falta: gancho, poco texto y una acción', () => {
  for (const r of [REGLAS_CARRUSEL_ESQUEMA, REGLAS_CARRUSEL_SECCIONES, REGLAS_CARRUSEL_EDITAR]) {
    assert.match(r, /CARRUSEL/, 'la regla no dice que es un carrusel');
    assert.match(r, /4:5/);
    assert.ok(r.length >= 120 && r.length <= 1_200, `una regla de ${r.length} caracteres`);
  }
  assert.match(REGLAS_CARRUSEL_ESQUEMA, /PRIMERA lámina es el gancho/);
  assert.match(REGLAS_CARRUSEL_ESQUEMA, /ÚLTIMA pide UNA sola acción/);
  for (const r of [REGLAS_CARRUSEL_ESQUEMA, REGLAS_CARRUSEL_SECCIONES, REGLAS_CARRUSEL_EDITAR]) {
    assert.match(r, /tablas/, 'no prohíbe las tablas, que no se leen en el teléfono');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Lo que se ve y lo que puede pedir MaKo
// ─────────────────────────────────────────────────────────────────────────────

test('la miniatura y la vista en vivo salen VERTICALES (4 / 5), no 16:9', () => {
  const html = renderToStaticMarkup(createElement(MiniaturaLanding, {
    tarjeta: null, tema: TEMAS[0], formato: formatoDeTipo('carrusel'), proporcion: proporcionDeTipo('carrusel'),
  }));
  assert.match(html, /style="aspect-ratio:4 \/ 5"/, 'la miniatura del carrusel sale con otra forma');
  assert.equal(cuadroCss(proporcionDeTipo('carrusel')), '4 / 5');
  // Y la pantalla de la generación la pide por TIPO, no con la constante de 16:9 (si queda
  // `PROPORCION_IA`, el carrusel se genera mostrándose horizontal).
  const src = readFileSync('app/web-generator/crear/CrearConIA.tsx', 'utf8');
  assert.match(src, /formato=\{formatoDeTipo\(tg\)\} proporcion=\{proporcionDeTipo\(tg\)\}/);
  assert.doesNotMatch(src, /proporcion=\{PROPORCION_IA\}/);
  // Y las frases de esa pantalla concuerdan con el género del tipo (nunca «La carrusel»).
  assert.doesNotMatch(src, /Creando la \$\{doc\}|\$\{doc\.slice\(1\)\} (generada|creada)|`La \$\{docDe\(/);
});

test('exportar como PNG: la lámina sale CON su forma, y una landing sigue saliendo fluida', () => {
  // El bug que encontró mirarlo: la foto salía del `.gm-doc` en un lienzo de 1280 px SIN
  // `data-formato`, así que las reglas de la diapositiva (css.ts, «15b») no se aplicaban y la
  // lámina salía del ancho de una pantalla. Un carrusel se exporta para SUBIRLO: si no es 4:5,
  // Instagram lo recorta.
  const carr = formaDeLaFoto({ ...CONFIG_DEFAULT, formato: 'presentacion', proporcion: '4:5' });
  assert.equal(carr.proporcion, '4:5');
  // 43em (ANCHO_DIAPO_EM) + los 4em que `calc(100% - 4em)` le descuenta, por 18px de letra base.
  assert.equal(carr.ancho, Math.ceil((ANCHO_DIAPO_EM['4:5'] + 4) * 18));
  assert.ok(carr.ancho > ANCHO_DIAPO_EM['4:5'] * 18, 'el lienzo achica la lámina y la foto no es 4:5');
  // Medido en Chromium con ESTE montaje (6/11/2026): 774 × 968 px, × 2 de pixelRatio = 1548 × 1936,
  // relación 0.800 exacta (Instagram pide 1080 × 1350, la misma).
  assert.equal(ANCHO_DIAPO_EM['4:5'] * 18 * 2, 1548);

  const pres = formaDeLaFoto({ ...CONFIG_DEFAULT, formato: 'presentacion', proporcion: '16:9' });
  assert.equal(pres.proporcion, '16:9');
  assert.equal(pres.ancho, Math.ceil((ANCHO_DIAPO_EM['16:9'] + 4) * 18));
  // Lo que NO tiene forma sigue como estaba: el lienzo de una pantalla y el documento entero.
  for (const c of [{ formato: 'pagina' as const }, { formato: 'presentacion' as const, proporcion: 'fluido' as const }]) {
    const f = formaDeLaFoto({ ...CONFIG_DEFAULT, ...c });
    assert.equal(f.proporcion, null, JSON.stringify(c));
    assert.equal(f.ancho, 1280, JSON.stringify(c));
  }
  assert.equal(formaDeLaFoto(undefined).proporcion, null);

  // El diálogo de Exportar dice la palabra del formato, no «secciones» a mano.
  const dlg = readFileSync('app/web-generator/editor/dialogos/DialogoExportar.tsx', 'utf8');
  assert.match(dlg, /etiqueta=\{terminoTarjeta\(config, \{ plural: true, mayuscula: true \}\)\}/);
  assert.doesNotMatch(dlg, /texto: 'Todas las secciones'|texto: 'Sección actual'/, 'la palabra sale de terminoTarjeta');

  // Y el montaje tiene que poner los dos data-* y fotografiar la TARJETA (sin eso, nada aplica).
  const src = readFileSync('lib/editor-landing/exportar-png.ts', 'utf8');
  assert.match(src, /caja\.dataset\.formato = 'presentacion';/);
  assert.match(src, /caja\.dataset\.proporcion = forma\.proporcion;/);
  assert.match(src, /forma\.proporcion && montaje\.contenedor\.querySelector<HTMLElement>\('\.gm-doc \.gm-tarjeta'\)/);
  assert.doesNotMatch(src, /width: ANCHO_FOTO \+ 'px'/, 'el lienzo no respeta la forma de la diapositiva');
});

test('la API de MaKo crea un carrusel con la misma operación, y lo lista aparte', async () => {
  const { disenosParaApi, pedidoDePresentacion } = await import('../lib/api-mako/areas/landing-editor.helpers');
  const catalogo = disenosParaApi();
  assert.deepEqual(catalogo.carruseles.map((p) => p.id), PLANTILLAS_CARRUSEL.map((p) => p.id));
  assert.deepEqual(catalogo.presentaciones.map((p) => p.id), PLANTILLAS_PRESENTACION.map((p) => p.id));
  assert.match(catalogo.nota, /carruseles/);
  for (const p of PLANTILLAS_CARRUSEL) {
    const pedido = pedidoDePresentacion(p.id, null)!;
    assert.ok(pedido, `${p.id}: la API no lo encuentra`);
    assert.equal(pedido.config?.proporcion, '4:5', p.id);
    assert.deepEqual({ ...pedido, contenido: null }, { ...pedidoDePlantilla(p), contenido: null }, `${p.id}: la API y la pantalla no crean lo mismo`);
  }
  assert.equal(pedidoDePresentacion('carr-no-existe', null), null);
  // El enum de la operación los ofrece (si no, MaKo no puede nombrarlos).
  const { porId } = await import('../lib/api-mako/registro');
  const op = porId('crear_presentacion_desde_plantilla');
  const par = op?.parametros.find((x) => x.nombre === 'plantilla');
  for (const p of PLANTILLAS_CARRUSEL) assert.ok(par?.enum?.includes(p.id), `${p.id} no está en el enum`);
});

// =============================================================================
// PROBADO ROMPIENDOLO (6/11/2026). Base: 12 pasan / 0 fallan. Cada pieza, rota a proposito:
//   - proporcionDeTipo('carrusel') -> '16:9' (la forma vieja) ...... 4 fallan
//   - formatoDeTipo('carrusel') -> 'pagina' ........................ 3 fallan
//   - plantillasDe('carrusel') -> PLANTILLAS_PRESENTACION .......... 2 fallan
//   - el id sin el prefijo `carr-` (se cruza con el de Imagen) ..... 2 fallan
//   - la proporcion de la plantilla en 16:9 ........................ 2 fallan
//   - sacar 'carrusel' de TIPOS_CREAR .............................. 1 falla
//   - tipoValido sin la rama de 'carrusel' ......................... 1 falla
//   - el icono de Carrusel con un nombre que no esta en el catalogo  1 falla
//   - paramsDeTipo sin la proporcion ............................... 1 falla
//   - paramsDeTipo sin sacarla en una landing (queda pegada) ....... 1 falla
//   - configDeCreacion de un carrusel sin proporcion ............... 1 falla
//   - GENERO_TIPO.carrusel femenino («La carrusel generada») ....... 1 falla
//   - la caja sin ejemplos de carrusel ............................. 1 falla
//   - una plantilla de menos (7 de los 8 tipos de MaKo) ............ 1 falla
//   - el cierre sin `fondo: 'acento'` .............................. 1 falla
//   - la portada con el rotulo, como las del medio ................. 1 falla
//   - un tema que no existe en el catalogo ......................... 1 falla
//   - terminoTarjeta sin la rama de 4:5 («diapositiva») ............ 1 falla
//   - esCarrusel comparando con '4:3' .............................. 1 falla
//   - un prompt con las reglas viejas (el de editar) ............... 1 falla
//   - nombreDoc sin 'Carrusel' (el gasto de IA miente) ............. 1 falla
//   - el PNG sin los data-* (la hoja de la diapositiva no aplica) .. 1 falla
//   - el PNG fotografiando el .gm-doc y no la lamina ............... 1 falla
//   - el lienzo del PNG siempre de 1280 (achica la lamina) ......... 1 falla
//   - la miniatura de la generacion con PROPORCION_IA .............. 1 falla
//   - pedidoDePresentacion sin la lista de carruseles .............. 1 falla
//   - el catalogo de la API sin `carruseles` ....................... 1 falla
//   - el enum de la operacion sin los ids de carrusel .............. 1 falla
// 28 roturas, 28 rojos. Un cambio SIN efecto (un comentario en plantillas-carrusel.ts): 12 verdes.
// =============================================================================

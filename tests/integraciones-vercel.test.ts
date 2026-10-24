// =============================================================================
// /integraciones con la estructura de Vercel Marketplace (24/10/2026)
// =============================================================================
// Martín: «hay tanta pero tanta info que se complica muchísimo para el usuario... Piensa en como hacerlo o investiga como lo
// hacen otras apps». La referencia es vercel.com/marketplace (la abrió el Cerebro en el navegador y se volvió a relevar el
// 24/10, la página en vivo y su documentación). La causa no eran las 22 tarjetas: eran diez categorías desplegadas a la vez,
// «Requiere tu atención» repitiendo arriba hasta quince tarjetas de la grilla, el medidor y todo lo que no es el catálogo
// desplegado. Lo que fija este test:
//   1. UNA fila de controles: el estado, la categoría (que sale de los datos: ya no hay lista blanca) y la búsqueda («/»);
//   2. dos secciones con criterio: «Conectadas» primero (las que tienen un problema adelante, con él en su tarjeta) y «Sin
//      conectar» (las opcionales al final), con «Mostrar más integraciones» calculado;
//   3. la tarjeta mínima: el logo, la categoría, el nombre, UNA línea y, en las conectadas, su estado; nunca una variable;
//   4. un link `?abrir=` llega a su tarjeta aunque esté plegada o filtrada;
//   5. se fueron el medidor, «Requiere tu atención» y las filas por categoría; «Costo de MaKo» y el «Historial de
//      problemas» quedan abajo, plegados con su dato a la vista, y se abren con sus links;
//   6. «Tus cuentas de IA» es la tarjeta destacada, arriba, con su estado en una línea y el MISMO modal del Ops Center;
//   7. el teléfono: las mismas secciones, en el mismo orden y con los mismos rótulos.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ORDEN_CATEGORIAS, ordenCategoria } from '../lib/integraciones-catalogo';
import { resumenDeCuentas } from '../lib/ia-pc-reglas';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const tablero = () => sinComentarios(leer('app/integraciones/IntegracionesBoard.tsx'));
const render = (b: string) => b.slice(b.indexOf('  return (\n    <Raiz'), b.indexOf('function CostoMaKo('));

test('1. una fila de controles: el estado, la categoría (de los datos, sin lista blanca) y la búsqueda con «/»', () => {
  const b = tablero();
  assert.match(b, /const ESTADOS_FILTRO: DropdownOption\[\] = \[\n\s*\{ value: TODAS, label: 'Todos los estados', icono: 'filtro' \},\n\s*\{ value: 'conectadas', label: 'Conectadas', icono: 'check' \},\n\s*\{ value: 'sin-conectar', label: 'Sin conectar', icono: 'agregar' \},\n\s*\{ value: 'problemas', label: 'Con problemas', icono: 'avisar' \},/);
  // Las categorías salen de las integraciones que esta persona ve, con su ícono; una nueva, con la etiqueta.
  assert.match(b, /\.\.\.\[\.\.\.new Set\(integraciones\.map\(\(i\) => i\.categoria\)\)\]/);
  assert.match(b, /icono: ICONO_CATEGORIA\[c\] \?\? 'etiqueta'/);
  assert.doesNotMatch(b, /CAT_ORDER/, 'la lista blanca que dejó invisibles a GitHub y a Whop');
  // El orden, compartido con el teléfono: una categoría que no está en la lista va al final, no desaparece.
  assert.equal(ordenCategoria('Publicidad'), 0);
  assert.equal(ordenCategoria('Una categoría nueva'), ORDEN_CATEGORIAS.length);
  const r = render(b);
  const estado = r.indexOf('options={ESTADOS_FILTRO}'), categoria = r.indexOf('options={opcionesCategoria}'), buscar = r.indexOf('<label className="int-buscar">');
  assert.ok(estado > 0 && estado < categoria && categoria < buscar, 'en una fila y en el orden de Vercel: el tipo, la categoría y la búsqueda');
  assert.match(r, /placeholder="Buscar" aria-label="Buscar una integración"/);
  // La búsqueda no mira tildes ni mayúsculas, y mira el nombre, la categoría y la línea.
  assert.match(b, /sinTildes\(`\$\{i\.nombre\} \$\{i\.categoria\} \$\{i\.descripcion\}`\)\.includes\(texto\)/);
  // «/» la enfoca, salvo escribiendo en otro campo o con un modal abierto.
  assert.match(b, /if \(e\.key !== '\/' \|\| e\.metaKey \|\| e\.ctrlKey \|\| e\.altKey \|\| hayModal\) return;/);
  assert.match(b, /if \(t\?\.closest\('input, textarea, select, \[contenteditable="true"\], \[role="dialog"\]'\)\) return;/);
});

test('2. dos secciones: «Conectadas» primero (los problemas adelante) y «Sin conectar» (las opcionales al final); «Mostrar más» calculado', () => {
  const b = tablero();
  const r = render(b);
  assert.ok(r.indexOf("tituloSeccion('int-conectadas', 'Conectadas'") > 0 && r.indexOf("tituloSeccion('int-conectadas', 'Conectadas'") < r.indexOf("tituloSeccion('int-sin-conectar', 'Sin conectar'"));
  // Una IA que configura el equipo de MaKo no le pide nada al negocio: va con las conectadas.
  assert.match(b, /const estaConectada = \(i: Integracion\) => i\.estado === 'conectada' \|\| delEquipoMaKo\(i\);/);
  assert.match(b, /const rango = \(i: Integracion\) => \(motivoDe\(i\) == null \? 2 : sevOf\(i\) === 'bad' \? 0 : 1\);/, 'rojo, ámbar y después las que están bien');
  assert.match(b, /\.sort\(\(a, b\) => Number\(opcionalSinConectar\(a\)\) - Number\(opcionalSinConectar\(b\)\) \|\| enOrden\(a, b\)\)/);
  // Doce y «Mostrar más integraciones», que se dibuja sólo si deja algo afuera; con un filtro, una búsqueda o un link que pide
  // una de las plegadas, se ve todo.
  assert.match(b, /const TOPE_CATALOGO = 12;/);
  assert.match(b, /const catalogo = verTodas \|\| filtrando \|\| pedidaOculta \? sinConectarVis : sinConectarVis\.slice\(0, TOPE_CATALOGO\);/);
  assert.match(r, /\{ocultas > 0 && \(/);
  assert.match(r, />Mostrar más integraciones<\/button>/);
  // Sin resultados, una frase y la salida.
  assert.match(r, /'Ninguna integración con estos filtros\.'/);
  assert.match(r, /onClick=\{limpiar\}>Ver todas<\/button>/);
});

test('3. la tarjeta: el logo, la categoría, el nombre, UNA línea y, en las conectadas, su estado; nunca una variable', () => {
  const b = tablero();
  const t = b.slice(b.indexOf('const tarjeta = (i: Integracion) =>'), b.indexOf('const grilla = '));
  const orden = ['id={`svc-${i.key}`}', '<SvcIcon k={i.key}', '<span className="int-pildora">{i.categoria}</span>', '{i.nombre}</span>', '<span className="int-tarjeta__linea">{i.descripcion}</span>', '{conectada && ('];
  const pos = orden.map((x) => t.indexOf(x));
  assert.ok(pos.every((p, k) => p > 0 && (k === 0 || p > pos[k - 1])), `la tarjeta, en el orden de Vercel: ${pos}`);
  assert.match(t, /onClick=\{\(\) => setModal\(\{ t: 'svc', key: i\.key \}\)\}/, 'toda la tarjeta abre su modal, el de siempre');
  assert.match(t, /\{equipo \? POR_QUE_LA_CONFIGURA_MAKO : motivo \?\? 'Conectada'\}/);
  // El motivo es de una conectada que no está bien; una sin conectar no lleva ninguno (y nunca `i.detalle`, que dice
  // «Falta configurar: RESEND_API_KEY»).
  const m = b.slice(b.indexOf('const motivoDe = '), b.indexOf('const opcionesCategoria'));
  assert.match(m, /if \(!estaConectada\(i\) \|\| delEquipoMaKo\(i\) \|\| sevOf\(i\) === 'good'\) return null;/);
  assert.doesNotMatch(m, /i\.detalle/);
  assert.match(m, /else if \(i\.key === 'calendly' && i\.estado === 'conectada' && faltaAvisoCalendly\) \{\s*motivo = faltaAvisoCalendly\.motivo;/);
  assert.match(m, /else if \(i\.key === 'landing' && landingVieja\) \{\s*motivo = ROTULO_PIXEL_VIEJO;/);
  // La línea, en dos renglones; el nombre, entero.
  assert.match(leer('app/globals.css'), /\.int-tarjeta__linea \{[^}]*-webkit-line-clamp: 2;/);
});

test('4. un link `?abrir=` llega a su tarjeta: sin filtros, desplegada, y el scroll detrás del render', () => {
  const b = tablero();
  const efecto = b.slice(b.indexOf("const abrir = searchParams.get('abrir');"), b.indexOf('const googleConToken'));
  assert.match(efecto, /setQ\(''\); setCatF\(TODAS\); setEstadoF\(TODAS\);\n\s*setPedida\(\(p\) => \(\{ key: abrir, vez: \(p\?\.vez \?\? 0\) \+ 1 \}\)\);/);
  assert.match(efecto, /q\.delete\('abrir'\);/, 'el parámetro se limpia: un F5 no reabre lo cerrado');
  assert.match(b, /const pedidaOculta = pedida != null && sinConectarVis\.slice\(TOPE_CATALOGO\)\.some\(\(i\) => i\.key === pedida\.key\);/);
  assert.match(b, /if \(!pedida\) return;\n\s*const t = requestAnimationFrame\(\(\) => \{\n\s*document\.getElementById\(`svc-\$\{pedida\.key\}`\)\?\.scrollIntoView/);
});

test('5. fuera el medidor, «Requiere tu atención» y las filas por categoría; «Costo de MaKo» y el historial, plegados y con su dato', () => {
  const b = tablero();
  const r = render(b);
  assert.doesNotMatch(r, /Requiere tu atención|conectados<\/span>|>Servicios<|Gratis · rotan sin costo/);
  assert.doesNotMatch(b, /const medidas = |const atencion: |const porCategoria = /);
  assert.doesNotMatch(b, /Gratis · rotan sin costo/, '22/10/2026: nada de «gratis», y Groq ya no rota');
  // «Costo de MaKo»: plegado, con el gasto del mes a la vista; se abre con #saldo-ia (el chip «Saldo de IA») y con ?ops=1.
  const costo = b.slice(b.indexOf('function CostoMaKo('), b.indexOf('function ProblemasHistorial('));
  assert.match(costo, /<details ref=\{plegable\} id="saldo-ia" className="int-plegable"/);
  assert.match(costo, /<span className="int-plegable__dato">\{usage \? `\$\{usd\(usage\.gastadoMesUsd \?\? 0\)\} este mes` : '···'\}<\/span>/);
  assert.match(costo, /if \(window\.location\.hash !== '#saldo-ia' \|\| !plegable\.current\) return;\n\s*plegable\.current\.open = true;/);
  assert.match(b, /setModal\(\{ t: 'hist' \}\);\n\s*setAbrirCosto\(\(n\) => n \+ 1\);/);
  assert.match(costo, /useEffect\(\(\) => \{ if \(abrir > 0 && plegable\.current\) plegable\.current\.open = true; \}, \[abrir\]\);/);
  // El historial: plegado, con cuántos están en curso (o que no se pudo leer) a la vista.
  const h = b.slice(b.indexOf('function ProblemasHistorial('));
  assert.match(h, /<details className="int-plegable"/);
  assert.match(h, /\{leidos === null \? 'No pude leerlo' : `\$\{activos\} \$\{activos === 1 \? 'activo' : 'activos'\}`\}/);
  // Adentro de un <summary>, nada de flex ni grilla en el <summary> mismo (WebKit ≤ 16): va en un <span>.
  assert.doesNotMatch(leer('app/globals.css').replace(/\/\*[\s\S]*?\*\//g, ''), /^[^{}\n]*summary[^{},\n]*\{[^}]*display: (grid|flex)/m);
  // La bajada ya no nombra WhatsApp (salió del catálogo el 09/10/2026).
  assert.doesNotMatch(leer('app/integraciones/page.tsx'), /bajada="WhatsApp/);
});

test('6. «Tus cuentas de IA»: la destacada, arriba, con su estado en una línea y el MISMO modal del Ops Center', () => {
  const page = sinComentarios(leer('app/integraciones/page.tsx'));
  assert.ok(page.indexOf('<TarjetaTusCuentasIA />') > 0 && page.indexOf('<TarjetaTusCuentasIA />') < page.indexOf('<IntegracionesBoard'), 'arriba del catálogo');
  const t = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  const tarjeta = t.slice(t.indexOf('export function TarjetaTusCuentasIA('));
  assert.match(tarjeta, /useEffect\(\(\) => \{ void leer\(\); \}, \[leer\]\);/, 'lee una vez (el bloque releía cada 20 s aunque nadie lo mirara)');
  assert.doesNotMatch(tarjeta, /setInterval/);
  assert.match(tarjeta, /<Modal titulo="Tus cuentas de IA" onCerrar=\{\(\) => \{ setAbierto\(false\); void leer\(\); \}\} ancho=\{640\}>\s*<TusCuentasIA sinCabecera \/>/);
  // Lo que dice, con datos.
  const cuenta = (n: number) => ({ numero: n, proveedor: 'claude' as const, email: null, plan: null, dispositivos: [] });
  assert.deepEqual(resumenDeCuentas(null, false), { linea: 'Leyendo tus cuentas…', tono: 'apagado' });
  assert.equal(resumenDeCuentas(null, true).linea, 'No pude leer tus cuentas: ábrelas para volver a intentar.');
  assert.deepEqual(resumenDeCuentas({ pcs: [], grupos: { cuentas: [], sinCuenta: [] } }, true), { linea: 'Conecta tu Claude, tu GPT o tu Gemini: con eso contesta tu Ops Center.', tono: 'ojo' });
  assert.equal(resumenDeCuentas({ pcs: [{ enLinea: true, cuentas: [] }], grupos: { cuentas: [], sinCuenta: [{} as never] } }, true).linea, 'Tu computadora está conectada, pero su Claude no tiene la sesión iniciada.');
  assert.deepEqual(resumenDeCuentas({ pcs: [{ enLinea: true, cuentas: [1] }, { enLinea: false, cuentas: [1] }], grupos: { cuentas: [cuenta(1)] as never, sinCuenta: [] } }, true), { linea: '1 cuenta · 1 computadora en línea', tono: 'bien' });
  assert.deepEqual(resumenDeCuentas({ pcs: [{ enLinea: false, cuentas: [1] }], grupos: { cuentas: [cuenta(1), cuenta(2)] as never, sinCuenta: [] } }, true), { linea: '2 cuentas · ninguna computadora en línea', tono: 'ojo' });
});

test('7. el teléfono: las mismas secciones, en el mismo orden y con los mismos rótulos', () => {
  const m = sinComentarios(leer('app/m/configuraciones/integraciones/IntegracionesM.tsx'));
  const pos = ['<FilaM titulo="Tus cuentas de IA"', '<SeccionM titulo="Conectadas">', '<SeccionM titulo="Sin conectar">', '<SeccionM titulo="Historial de problemas">'].map((x) => m.indexOf(x));
  assert.ok(pos.every((p, k) => p > 0 && (k === 0 || p > pos[k - 1])), `en el orden de la computadora: ${pos}`);
  assert.doesNotMatch(m, /Para resolver|categorias\.map/, 'ni «Para resolver» arriba ni una sección por categoría');
  assert.match(m, /href="\/perfil\/ia"/, 'su casa en el teléfono: /m/cuenta/ia (el proxy la reescribe)');
  assert.match(m, /\{sinConectar\.map\(\(i\) => <FilaM key=\{i\.key\} titulo=\{i\.nombre\} segunda=\{i\.descripcion\}/, 'la línea, no «Falta configurar: …»');
  const p = sinComentarios(leer('app/m/configuraciones/integraciones/page.tsx'));
  assert.match(p, /conectada: i\.estado === 'conectada' \|\| i\.detalle === POR_QUE_LA_CONFIGURA_MAKO,/);
  assert.match(p, /const enOrden = \(a: IntegracionM, b: IntegracionM\) => ordenCategoria\(a\.categoria\) - ordenCategoria\(b\.categoria\) \|\| ordenIA\(a\.key\) - ordenIA\(b\.key\);/);
  assert.match(p, /\.sort\(\(a, b\) => Number\(a\.opcional\) - Number\(b\.opcional\) \|\| enOrden\(a, b\)\)/);
  assert.match(p, /\.sort\(\(a, b\) => rango\(a\) - rango\(b\) \|\| enOrden\(a, b\)\)/);
});

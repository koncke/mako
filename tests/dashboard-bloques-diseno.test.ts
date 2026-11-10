// Las hojas copiadas, en BLOQUES (6/11/2026). Martín: «Los dashboard puede que estén, pero se rompen todos en la vista de EDICIÓN…
// Haz que todo sea funcional y editable». Cada tarjeta de un diseño es un elemento de la grilla (lib/disenos-partes.ts,
// app/dashboard/disenos/BloqueDeDiseno.tsx): se ve igual mirando y editando, y se mueve, se configura y se borra como las demás.
//
// Recorre las 22 plantillas con diseño (las del Dashboard y las de General): cada una nace en bloques, sin perder ninguna pieza, con
// cada bloque leyendo componentes que existen, sin encimarse, y leer dos veces no la migra dos veces. Una hoja GUARDADA con su
// diseño entero (el modelo hasta el 6/11, la de Mauricio) se migra al leerse sin perder nada. Y el catálogo dice lo mismo que cada
// componente de diseño: cada `<Parte id>` del archivo está en el catálogo y al revés.
//
// Probado rompiéndolo (6/11/2026, contra 9 verdes): sacar la migración de `sanearHoja` → 4 rojos (1, 2, 4, 5); migrar dos veces
// (sin la guarda de «ya tiene bloques») → 1 rojo (3); que `pedidosDeHoja` no pida lo que leen los bloques plegados → 1 rojo (6);
// que la copia no siga las piezas de un bloque → 1 rojo (7); borrar un `<Parte id="tasa">` de HojaClosing → 1 rojo (8).
// Y la tarde del mismo día: sacarle a Marketing su paleta oscura (`.kt:where([data-tema="oscuro"] *)`) → 1 rojo (12).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { sanearHoja, esElemento, MAX_COMPONENTES, type Componente, type Hoja } from '../lib/graficos-catalogo';
import { HOJA_DE_ROL, PLANTILLAS_HOJA, PLANTILLAS_OFRECIDAS, instanciarPlantilla, type PlantillaHoja } from '../lib/graficos-plantillas';
import { PLANTILLAS_GENERAL } from '../lib/general-plantillas';
import { DISENOS, SECCION_PIEZAS, conBloquesDeDiseno, disenosDelInforme, idsQueLeenLosBloques, insertarBloque, parteDe, partesDe, seDibujaMirando, sinBloquesDeDiseno } from '../lib/disenos-partes';
import { hojaConIdsNuevos } from '../lib/graficos-copia';
import { pedidosDeHoja } from '../app/dashboard/exportar';
import { ocultosPorPlegado, panelesALaVista, plegadasDe, plegadasDeEntrada } from '../lib/graficos-secciones';
import { ENTRADAS, entradaEfectiva, sanearEntrada } from '../lib/graficos-entradas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOY = '2026-11-06';

/** Las plantillas con diseño propio (las 22), con su diseño. */
function conDiseno(): Array<{ p: PlantillaHoja; diseno: string }> {
  const out: Array<{ p: PlantillaHoja; diseno: string }> = [];
  for (const p of [...PLANTILLAS_HOJA, ...PLANTILLAS_GENERAL]) {
    const crudo = p.armar((x) => x) as { diseno?: { id: string } };
    if (crudo.diseno) out.push({ p, diseno: crudo.diseno.id });
  }
  return out;
}

/** La hoja como la guardaba el modelo de antes: el armado de la plantilla, sin pasar por la migración. */
function guardadaDeAntes(p: PlantillaHoja): Record<string, unknown> {
  const ids = new Map<string, string>();
  let n = 0;
  return { ...p.armar((local) => { if (!ids.has(local)) ids.set(local, `x${(n++).toString(36)}-${local.slice(0, 20)}`); return ids.get(local)!; }), plantilla: p.id };
}

const bloques = (h: Hoja) => h.componentes.filter((c) => esElemento(c) && c.tipo === 'diseno');

test('1 · las 22 plantillas con diseño nacen en bloques: una tarjeta por bloque, en el orden del catálogo', () => {
  const lista = conDiseno();
  assert.equal(lista.length, 22, `son ${lista.length}`);
  for (const { p, diseno } of lista) {
    const h = instanciarPlantilla(p);
    assert.equal(h.diseno?.v, 2, `${p.id}: no quedó en bloques`);
    const partes = partesDe(diseno);
    assert.ok(partes.length >= 4, `${p.id}: el diseño ${diseno} tiene ${partes.length} partes`);
    assert.deepEqual(bloques(h).map((c) => (c as { diseno?: { parte: string } }).diseno?.parte), partes.map((x) => x.id), `${p.id}: los bloques no son las partes`);
    assert.ok(h.componentes.length <= MAX_COMPONENTES, `${p.id}: ${h.componentes.length} componentes`);
  }
});

test('2 · cada bloque lee componentes que EXISTEN en su hoja, y todo lo que leía el diseño entero sigue ahí', () => {
  for (const { p } of conDiseno()) {
    const h = instanciarPlantilla(p);
    const ids = new Set(h.componentes.map((c) => c.id));
    for (const b of bloques(h)) {
      const d = (b as { diseno: { parte: string; piezas: Record<string, string> } }).diseno;
      for (const [rol, id] of Object.entries(d.piezas)) assert.ok(ids.has(id), `${p.id}.${d.parte}: la pieza ${rol} apunta a la nada`);
    }
    // Las piezas del diseño (las de `hoja.diseno`) siguen todas en la hoja: la migración no borra.
    for (const [rol, id] of Object.entries(h.diseno?.piezas ?? {})) assert.ok(ids.has(id), `${p.id}: se perdió la pieza ${rol}`);
  }
});

test('3 · leer dos veces no la migra dos veces, y los bloques no se enciman', () => {
  for (const { p } of conDiseno()) {
    const h = instanciarPlantilla(p);
    const otra = sanearHoja(JSON.parse(JSON.stringify(h)), 0)!;
    assert.equal(otra.componentes.length, h.componentes.length, `${p.id}: la segunda lectura cambió la hoja`);
    assert.equal(conBloquesDeDiseno(h.id, h.componentes, h.diseno!, MAX_COMPONENTES), null, `${p.id}: se migraría otra vez`);
    const bs = bloques(h);
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j];
      const se = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!se, `${p.id}: ${(a as { diseno?: { parte: string } }).diseno?.parte} y ${(b as { diseno?: { parte: string } }).diseno?.parte} se enciman`);
    }
  }
});

test('4 · una hoja GUARDADA con su diseño entero (el modelo de antes, la de Mauricio) se migra al leerse sin perder nada', () => {
  for (const { p } of conDiseno()) {
    const crudo = guardadaDeAntes(p);
    const antes = sanearHoja({ ...crudo, diseno: undefined }, 0)!; // lo mismo, sin migrar
    const h = sanearHoja(crudo, 0)!;
    const despues = new Set(h.componentes.map((c) => c.id));
    // Los ids que trae lo guardado siguen (uno sin id lo acuña el saneo en cada lectura: se cuenta).
    const guardados = ((crudo.componentes as Array<{ id?: string }> | undefined) ?? []).map((c) => c.id).filter((x): x is string => !!x);
    for (const id of guardados) if (antes.componentes.some((c) => c.id === id)) assert.ok(despues.has(id), `${p.id}: se perdió ${id}`);
    assert.equal(h.componentes.length, antes.componentes.length + partesDe(h.diseno!.id).length + 1, `${p.id}: no son lo de antes, los bloques y la sección`);
    // Abajo de los bloques, la sección plegada con todo lo que tenía, en su orden.
    const seccion = h.componentes.find((c) => esElemento(c) && c.tipo === 'seccion' && c.texto === SECCION_PIEZAS)!;
    assert.ok(seccion && esElemento(seccion) && seccion.seccion?.plegable && seccion.seccion.abierto === false, `${p.id}: falta «${SECCION_PIEZAS}» plegada`);
    const fondoBloques = Math.max(...bloques(h).map((b) => b.y + b.h));
    for (const c of h.componentes) if (!(esElemento(c) && (c.tipo === 'diseno' || c === seccion))) assert.ok(c.y >= fondoBloques, `${p.id}: ${c.id} quedó entre los bloques`);
  }
});

test('5 · un diseño sin partes no se migra (sigue con su diseño entero) y una hoja sin diseño no gana bloques', () => {
  const cs: Componente[] = [];
  assert.equal(conBloquesDeDiseno('h', cs, { id: 'closing', piezas: {} }, 0), null, 'sin lugar: no se migra');
  const sinDiseno = sanearHoja({ ...guardadaDeAntes(PLANTILLAS_HOJA.find((p) => p.id === 'closing')!), diseno: undefined }, 0)!;
  assert.equal(bloques(sinDiseno).length, 0);
});

test('6 · lo que leen los bloques se pide aunque «Todas las piezas» esté plegada (si no, los bloques salen vacíos)', () => {
  for (const { p } of conDiseno()) {
    const h = instanciarPlantilla(p);
    const ocultos = ocultosPorPlegado(h.componentes, plegadasDe(h.componentes));
    const pedidos = new Set(pedidosDeHoja(h, {}, HOY, 0, ocultos).graficos.map((x) => x.g.id));
    const graficos = new Set(h.componentes.filter((c) => c.clase === 'grafico').map((c) => c.id));
    for (const id of idsQueLeenLosBloques(h.componentes)) if (graficos.has(id)) assert.ok(pedidos.has(id), `${p.id}: no se pide ${id}`);
  }
});

test('7 · duplicar o copiar la hoja: cada bloque sigue a sus piezas por el id nuevo', () => {
  const h = instanciarPlantilla(PLANTILLAS_HOJA.find((p) => p.id === 'closing')!);
  const c = hojaConIdsNuevos(h);
  const ids = new Set(c.componentes.map((x) => x.id));
  for (const b of bloques(c)) for (const id of Object.values((b as { diseno: { piezas: Record<string, string> } }).diseno.piezas)) assert.ok(ids.has(id), 'un bloque de la copia apunta a la hoja de antes');
  assert.equal(c.diseno?.v, 2);
});

test('8 · el catálogo dice lo mismo que cada componente de diseño: cada <Parte id> está en el catálogo y al revés', () => {
  const ARCHIVO: Record<string, string> = {
    closing: 'HojaClosing', cobranza: 'HojaCobranza', foco: 'HojaFocus', 'mi-dia': 'HojaMiDia', general: 'HojaGeneral', operacion: 'HojaOperacion',
    comercial: 'HojaComercial', marketing: 'HojaMarketing', landing: 'HojaLanding', chat: 'HojaChat', automatizaciones: 'HojaAutomatizaciones',
    cs: 'HojaCs', productividad: 'HojaProductividad', contenido: 'HojaContenido', curso: 'HojaCurso', servicio: 'HojaServicio',
    instagram: 'HojaInstagram', anuncio: 'HojaAnuncio', hooks: 'HojaHooks', vsl: 'HojaVsl', inmobiliaria: 'HojaInmobiliaria', 'cold-calling': 'HojaColdCalling',
  };
  assert.deepEqual(Object.keys(ARCHIVO).sort(), Object.keys(DISENOS).sort());
  for (const [d, archivo] of Object.entries(ARCHIVO)) {
    const src = readFileSync(join(RAIZ, 'app/dashboard/disenos', `${archivo}.tsx`), 'utf8').replace(/\r\n/g, '\n')
      .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    const enArchivo = new Set([...src.matchAll(/<Parte id="([a-z][a-z0-9-]*)">/g)].map((m) => m[1]));
    const enCatalogo = new Set(partesDe(d).map((x) => x.id));
    for (const id of enArchivo) assert.ok(enCatalogo.has(id), `${archivo}: <Parte id="${id}"> no está en el catálogo`);
    for (const id of enCatalogo) assert.ok(enArchivo.has(id), `${d}: «${id}» está en el catálogo y no en ${archivo}`);
  }
});

test('9 · una tarjeta que pide un dato que no llegó no ocupa lugar mirando; la animación de entrada: sólo del catálogo, y la del diseño', () => {
  const h = instanciarPlantilla(PLANTILLAS_HOJA.find((p) => p.id === 'closing')!);
  const contacto = bloques(h).find((b) => (b as { diseno?: { parte: string } }).diseno?.parte === 'contacto')!;
  assert.equal(seDibujaMirando(contacto, { contacto: false, general: true }), false);
  assert.equal(seDibujaMirando(contacto, { contacto: true, general: true }), true);
  assert.equal(sanearEntrada('giran'), 'giran');
  assert.equal(sanearEntrada('inventada'), null);
  assert.equal(entradaEfectiva(h).id, 'suben', 'Closing entra como Halden');
  assert.equal(entradaEfectiva({ ...h, entrada: 'giran' }).id, 'giran');
  assert.equal(entradaEfectiva({}).id, 'ninguna', 'una hoja sin diseño no se anima sola');
  assert.equal(new Set(ENTRADAS.map((e) => e.id)).size, ENTRADAS.length);
  assert.equal(sanearHoja({ ...h, entrada: 'giran' }, 0)?.entrada, 'giran');
  assert.equal(sanearHoja({ ...h, entrada: 'x' }, 0)?.entrada, undefined);
});

test('10 · la biblioteca «Bloques»: cualquier tarjeta entra en cualquier hoja de su informe, con sólo las piezas que lee', () => {
  const pl = PLANTILLAS_HOJA.find((p) => p.id === 'closing')!;
  const fuente = () => { const f = instanciarPlantilla(pl); return { piezas: f.diseno!.piezas, componentes: sinBloquesDeDiseno(f.componentes) }; };
  const vacia: Componente[] = [];
  // En una hoja vacía: el bloque arriba, y la sección plegada con las CINCO piezas que la tasa lee (no las doce de Closing).
  const r = insertarBloque({ hojaId: 'hoja-x', componentes: vacia, diseno: null, d: 'closing', parte: 'tasa', fuente: fuente(), max: MAX_COMPONENTES, maxIa: 1 });
  assert.ok(!('error' in r), 'entra');
  const cs = (r as { componentes: Componente[]; id: string }).componentes;
  const b = cs.find((c) => c.id === (r as { id: string }).id)!;
  assert.ok(esElemento(b) && b.tipo === 'diseno' && b.diseno?.parte === 'tasa');
  const lee = new Set(parteDe('closing', 'tasa')!.lee.map((k) => (b as { diseno: { piezas: Record<string, string> } }).diseno.piezas[k]));
  assert.equal(lee.size, 5);
  for (const id of lee) assert.ok(cs.some((c) => c.id === id), 'cada pieza que lee está en la hoja');
  assert.equal(cs.length, 1 + 1 + 5, 'el bloque, la sección y las cinco piezas');
  assert.deepEqual(panelesALaVista(cs).map((c) => c.id), [b.id], 'a la vista, sólo el bloque');
  assert.ok(plegadasDeEntrada(cs).size === 1, 'la sección arranca plegada');
  // Lo que el bloque lee se pide aunque esté plegado.
  const pedidos = pedidosDeHoja({ ...instanciarPlantilla(pl), componentes: cs }, {}, HOY, 0, ocultosPorPlegado(cs, plegadasDe(cs)));
  for (const id of lee) assert.ok(pedidos.graficos.some((x) => x.g.id === id), `se pide ${id}`);
  // Una segunda tarjeta del MISMO diseño reusa las piezas: no trae otra copia.
  const r2 = insertarBloque({ hojaId: 'hoja-x', componentes: cs, diseno: null, d: 'closing', parte: 'desenlace', fuente: fuente(), max: MAX_COMPONENTES, maxIa: 1 });
  const cs2 = (r2 as { componentes: Componente[] }).componentes;
  assert.equal(cs2.length, cs.length + 1, 'sólo el bloque nuevo');
  const b2 = cs2.find((c) => c.id === (r2 as { id: string }).id)!;
  assert.ok(b2.y < cs2.find((c) => esElemento(c) && c.tipo === 'seccion')!.y, 'arriba de «Todas las piezas»: lo de abajo de una sección es de ella');
  assert.equal(sinSuperposicion(cs2), null);
  // En la hoja de Closing (sus bloques ya están): una tarjeta repetida no trae nada.
  const h = instanciarPlantilla(pl);
  const r3 = insertarBloque({ hojaId: h.id, componentes: h.componentes, diseno: h.diseno, d: 'closing', parte: 'semana', fuente: fuente(), max: MAX_COMPONENTES, maxIa: 1 });
  assert.equal((r3 as { componentes: Componente[] }).componentes.length, h.componentes.length + 1);
  // El tope se respeta, y lo que no existe se dice.
  assert.deepEqual(insertarBloque({ hojaId: 'h', componentes: vacia, diseno: null, d: 'closing', parte: 'tasa', fuente: fuente(), max: 3, maxIa: 1 }), { error: 'La hoja ya tiene el máximo de piezas' });
  assert.ok('error' in insertarBloque({ hojaId: 'h', componentes: vacia, diseno: null, d: 'closing', parte: 'no-existe', fuente: fuente(), max: 60, maxIa: 1 }));
  // Cada informe ofrece SUS diseños: General no ofrece Closing, y el Dashboard no ofrece Focus.
  assert.ok(disenosDelInforme('dashboard').includes('closing') && !disenosDelInforme('dashboard').includes('foco'));
  assert.ok(disenosDelInforme('general').includes('foco') && !disenosDelInforme('general').includes('closing'));
  assert.equal(disenosDelInforme('dashboard').length + disenosDelInforme('general').length, Object.keys(DISENOS).length);
});

function sinSuperposicion(cs: readonly Componente[]): string | null {
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const a = cs[i], b = cs[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) return `${a.id} pisa a ${b.id}`;
  }
  return null;
}

test('11 · «Velocidad de llamada» (Código Inmobiliario): tarjetas copiadas que leen piezas que existen, y nunca para un closer ni un setter', () => {
  // Lo que ofrece la galería es PLANTILLAS_OFRECIDAS, no PLANTILLAS_HOJA: con esta línea mirando la otra lista, la hoja estuvo un día
  // escrita, en verde y sin poder crearse (lib/graficos-plantillas.ts, `traeDisenoCopiado`).
  const p = PLANTILLAS_OFRECIDAS.find((x) => x.id === 'velocidad-llamada')!;
  assert.ok(p, 'se ofrece en «Nueva hoja» y en la API');
  const h = instanciarPlantilla(p);
  const tarjetas = bloques(h).map((b) => { const d = (b as { diseno: { id: string; parte: string; piezas: Record<string, string> } }).diseno; return `${d.id}/${d.parte}`; });
  assert.deepEqual(tarjetas, [
    'cold-calling/cabecera', 'closing/contacto', 'cold-calling/numeros', 'cold-calling/llamadas', 'cold-calling/siguen',
    'cold-calling/llamados', 'cold-calling/quien', 'cold-calling/terminan', 'marketing/tabla',
  ], 'el título con «Grabar llamada» arriba, el primer contacto después');
  for (const b of bloques(h)) {
    const d = (b as { diseno: { id: string; parte: string; piezas: Record<string, string> } }).diseno;
    for (const k of parteDe(d.id, d.parte)!.lee) assert.ok(h.componentes.some((c) => c.id === d.piezas[k]), `${d.id}/${d.parte}: la pieza ${k} existe`);
  }
  assert.ok(panelesALaVista(h.componentes).length <= 14);
  // A la vista, las tarjetas y (9/11/2026) la tabla «Cada lead nuevo» después del primer contacto: lo que preguntó Juanfran es por
  // CADA lead (tests/dashboard-velocidad-codigo.test.ts).
  assert.deepEqual(panelesALaVista(h.componentes).map((c) => c.clase), ['elemento', 'elemento', 'grafico', ...Array(7).fill('elemento')], 'a la vista, las tarjetas y la tabla de cada lead');
  assert.equal(sinSuperposicion(h.componentes), null);
  assert.equal(h.controles.find((c) => c.tipo === 'periodo')?.preset, 'ult30');
  // Nombra leads (el primer contacto, a quién llamaste): ni el closer ni el setter la ven (cada uno tiene su hoja única).
  assert.ok(Object.values(HOJA_DE_ROL).every((r) => r?.plantilla !== 'velocidad-llamada'));
  // Dos instancias no comparten ids, y leer dos veces no la cambia.
  const otra = instanciarPlantilla(p);
  assert.ok(otra.componentes.every((c) => !h.componentes.some((x) => x.id === c.id)));
  assert.deepEqual(sanearHoja(h, 0)!.componentes, h.componentes);
});

// 12 · El modo de la hoja es el de MaKo (6/11/2026). Martín: «los que vienen en dark mode deben acompañar siempre el white mode si
// el usuario lo tiene así en MaKo, y si tiene dark mode, automáticamente pasarse a allí». Cada hoja de estilos de un diseño trae su
// paleta por defecto (la clara) y la oscura bajo `[data-tema="oscuro"]` (el atributo que pone MaKo en <html>), con la selección
// empezando por su raíz (`.raiz:where([data-tema="oscuro"] *)`: misma especificidad). Se mide con los colores: la oscura tiene que
// ser MÁS oscura que la de por defecto, variable por variable compartida, y la de por defecto tiene que ser clara.
const luminancia = (hex: string): number | null => {
  // Sólo los opacos: uno con transparencia («#ffffff14», un brillo) no es un fondo, y su color solo no dice cómo se ve.
  // Un oklch (Operación) da su L: la de OKLab es la raíz cúbica de la luminancia, así que se eleva al cubo.
  const ok = /^oklch\(\s*([\d.]+)(%?)\s+[\d.]+\s+[\d.]+\s*\)$/i.exec(hex.trim());
  if (ok) return (Number(ok[1]) / (ok[2] ? 100 : 1)) ** 3;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const variables = (bloque: string) => new Map([...bloque.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].map((m) => [m[1], m[2].trim()]));

test('12 · ninguna hoja fija su modo: cada diseño trae su paleta oscura bajo el atributo de MaKo, y la de por defecto es clara', async () => {
  const archivos = readdirSync(join(RAIZ, 'app/dashboard/disenos')).filter((f) => f.endsWith('-css.ts'));
  assert.equal(archivos.length, Object.keys(DISENOS).length, 'una hoja de estilos por diseño');
  for (const f of archivos) {
    const mod = await import(pathToFileURL(join(RAIZ, 'app/dashboard/disenos', f)).href) as Record<string, unknown>;
    const css = String(Object.values(mod).find((v) => typeof v === 'string' && v.length > 2000)).replace(/\/\*[\s\S]*?\*\//g, '');
    const raiz = /\n\.([a-z][a-z0-9-]*)\s*\{/.exec(css)?.[1];
    assert.ok(raiz, `${f}: sin raíz`);
    const ini = css.search(new RegExp(`\\n\\.${raiz}\\s*\\{`));
    const base = variables(css.slice(ini, css.indexOf('}', ini)));
    const sel = `.${raiz}:where([data-tema="oscuro"] *)`;
    const io = css.indexOf(`${sel} {`) >= 0 ? css.indexOf(`${sel} {`) : css.indexOf(`${sel}{`);
    assert.ok(io > 0, `${f}: falta ${sel}`);
    const oscuro = variables(css.slice(io, css.indexOf('}', io)));
    const pares = [...oscuro].map(([k, v]) => [luminancia(base.get(k) ?? ''), luminancia(v)] as const).filter((x): x is readonly [number, number] => x[0] != null && x[1] != null);
    assert.ok(pares.length >= 6, `${f}: la oscura redefine ${pares.length} colores (se esperan al menos 6)`);
    const prom = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    // Los fondos (lo más claro de la de por defecto) bajan en la oscura.
    const fondos = pares.filter(([b]) => b > 0.6);
    assert.ok(fondos.length >= 2, `${f}: la de por defecto tiene pocos fondos claros (${fondos.length}): ¿quedó oscura?`);
    assert.ok(prom(fondos.map(([, o]) => o)) < 0.12, `${f}: en oscuro los fondos siguen claros`);
  }
});

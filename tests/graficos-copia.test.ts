// =============================================================================
// Copiar un dashboard con un TOKEN (lib/graficos-copia.ts, app/api/graficos/copia, mig 0268) y la caja
// «¿Qué vas a crear hoy?» de «Nueva hoja» (app/dashboard/NuevaHoja.tsx)
// =============================================================================
// Martín (12/10/2026): «pasale la sección de "¿Qué vamos a hacer hoy?" al chat de graphics para que lo implemente tal
// cual en lo que se tiene hoy de "Pídeselo a MaKo". Tiene que ser funcional, es decir, que los dashboards también
// deberían poder copiarse y enviarse con ese token».
//
// Probado ROMPIÉNDOLO (13/10/2026), con la base en verde (9 de 9) y restaurando de memoria después de cada una:
//   r1 · `hojaParaCopiar` sin el vaciado (devolver `c` tal cual)                 → 2 fallos (las personas viajan, y lo
//                                                                                   que se vacía en el otro negocio cambia).
//   r2 · `campoPublico` que devuelve true siempre                                → 2 fallos (los mismos).
//   r3 · `hojaParaOtroNegocio` sin el `if (c.fijo)`                              → 1 fallo (la KPI de R1 deja de ser R1).
//   r4 · `vocabularioFijo` que devuelve null siempre                             → 1 fallo (la prioridad «Alta» se vacía).
//   r5 · `hojaConIdsNuevos` sin `seguir` (las fuentes de la caja de IA)          → 1 fallo (la caja lee ids que no están).
//   r6 · `hojaConIdsNuevos` sin re-acuñar los controles                          → 1 fallo.
//   r7 · el regex del token sin el `(?![0-9A-Z])`                                → 1 fallo (un token de 11 letras pasa).
//   r8 · la ruta sin `hojaParaOtroNegocio`                                       → 1 fallo.
//   r9 · NuevaHoja montando otra vez «Pídeselo a MaKo»                           → 1 fallo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nuevoGrafico, sanearHoja, type Componente, type ControlVista, type Elemento, type Grafico, type Hoja } from '../lib/graficos-catalogo';
import {
  PREFIJO_TOKEN_DASH, avisoDeVaciados, dashPegado, hojaConIdsNuevos, hojaDeCopia, hojaParaCopiar, hojaParaOtroNegocio,
  nombreDeHoja, rotuloDashPegado, tokenDashDeBytes, tokenDashDeTexto,
} from '../lib/graficos-copia';
import { LARGO_TOKEN_COPIA } from '../lib/token-copia';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

// ── Una hoja con todo lo que se copia ──────────────────────────────────────────────────────────

const control = (o: Partial<ControlVista> & Pick<ControlVista, 'id' | 'tipo'>): Record<string, unknown> =>
  ({ campo: null, preset: 'ult30', desde: null, hasta: null, valores: null, texto: '', agrupar: 'auto', ...o });

function hojaDePrueba(): Hoja {
  const g1 = { ...nuevoGrafico('tabla', [], 'leads'), id: 'g-leads', x: 0, y: 0 } as Grafico;
  const g2 = { ...nuevoGrafico('tabla', [g1], 'llamadas_venta'), id: 'g-llamadas', x: 6, y: 0 } as Grafico;
  const pop = { ...nuevoGrafico('tabla', [], 'leads'), id: 'g-pop', x: 0, y: 0 } as Grafico;
  const raw = {
    id: 'hoja-origen', nombre: 'Ventas', emoji: '📈',
    controles: [
      control({ id: 'c-closer', tipo: 'lista', campo: 'closer', valores: ['Ana Pérez'] }),
      control({ id: 'c-campana', tipo: 'lista', campo: 'campana', valores: ['Campaña Octubre'] }),
      control({ id: 'c-prioridad', tipo: 'lista', campo: 'ejecucion.prioridad', valores: ['Alta'] }),
      control({ id: 'c-texto', tipo: 'texto', campo: 'anuncio', texto: 'black' }),
      control({ id: 'c-periodo', tipo: 'periodo', preset: 'ult7' }),
    ],
    componentes: [
      { ...g1, controles: [control({ id: 'c-g1-closer', tipo: 'lista', campo: 'closer', valores: ['Ana Pérez'], fijo: true })] },
      { ...g2, controles: [control({ id: 'c-g2-campana', tipo: 'lista', campo: 'campana', valores: ['Campaña Octubre'], fijo: true })],
        alClic: 'popup', popup: { titulo: 'Detalle', componentes: [{ ...pop, controles: [control({ id: 'c-pop-closer', tipo: 'lista', campo: 'closer', valores: ['Ana Pérez'] })] }] } },
      { id: 'e-ia', clase: 'elemento', tipo: 'ia', texto: 'Conclusiones', x: 0, y: 4, w: 6, h: 3,
        ia: { pedido: 'Qué cambió', fuentes: ['g-llamadas'], vista: 'resumen', largo: 'corto', formato: 'parrafo', lee: 'hoja', cron: null } },
    ],
    conectores: [{ id: 'k1', desde: 'g-leads', hasta: 'g-llamadas', punta: 'fin', trazo: 'curva', color: null }],
  };
  const h = sanearHoja(raw, 0);
  assert.ok(h, 'el fixture no sanea');
  return h;
}

/** Todos los controles de la hoja, por id (la barra, los gráficos y los del pop-up). */
function controlesPorId(h: Hoja): Map<string, ControlVista> {
  const out = new Map<string, ControlVista>();
  const enComps = (cs: readonly Componente[]) => {
    for (const c of cs) {
      if (c.clase !== 'grafico') continue;
      for (const k of c.controles) out.set(k.id, k);
      if (c.popup) enComps(c.popup.componentes);
    }
  };
  for (const k of h.controles) out.set(k.id, k);
  enComps(h.componentes);
  return out;
}

test('el fixture llega entero al saneo (si no, los demás tests prueban otra cosa)', () => {
  const h = hojaDePrueba();
  const c = controlesPorId(h);
  assert.deepEqual(c.get('c-closer')?.valores, ['Ana Pérez']);
  assert.deepEqual(c.get('c-g2-campana')?.valores, ['Campaña Octubre']);
  assert.equal(c.get('c-g1-closer')?.fijo, true);
  assert.deepEqual(c.get('c-pop-closer')?.valores, ['Ana Pérez']);
  assert.equal(c.get('c-texto')?.texto, 'black');
  const ia = h.componentes.find((x) => x.id === 'e-ia') as Elemento;
  assert.deepEqual(ia.ia?.fuentes, ['g-llamadas']);
  assert.equal(h.conectores?.length, 1);
});

// ── El token ─────────────────────────────────────────────────────────────────────────────────

test('el token: MAKO-DASH- y 10 letras de Crockford; se encuentra en una frase y en minúsculas, y no confunde un flujo', () => {
  const t = tokenDashDeBytes(Array.from({ length: LARGO_TOKEN_COPIA }, (_, i) => i * 37));
  assert.match(t, /^MAKO-DASH-[0-9A-HJKMNP-TV-Z]{10}$/);
  assert.equal(tokenDashDeTexto(`te paso el dashboard: ${t.toLowerCase()} avisame`), t);
  assert.equal(tokenDashDeTexto('MAKO-FLUJO-ABCDEFGHJK'), null, 'un token de un flujo no es un dashboard');
  assert.equal(tokenDashDeTexto(`${t}Z`), null, 'un token con una letra de más no es un token');
  assert.equal(tokenDashDeTexto('MAKO-DASH-ABCDEFGHIL'), null, 'I y L no son del alfabeto');
  assert.throws(() => tokenDashDeBytes([1, 2, 3]));
  const p = dashPegado(`  mira esto ${t} y armalo  `);
  assert.deepEqual(p, { token: t, resto: 'mira esto y armalo' });
  assert.equal(dashPegado('Cuánto gasto en anuncios'), null);
  assert.equal(rotuloDashPegado('📈 Ventas'), 'Dashboard copiado: 📈 Ventas');
  assert.equal(nombreDeHoja({ nombre: 'Ventas', emoji: '' }), 'Ventas');
  assert.equal(avisoDeVaciados(0), null);
  assert.equal(avisoDeVaciados(1), '1 filtro vaciado');
  assert.equal(avisoDeVaciados(3), '3 filtros vaciados');
});

test('la migración 0268 acepta EXACTAMENTE el token que se acuña, y lleva su revoke', () => {
  const sql = leer('supabase/migrations/0268_dashboard_copias.sql');
  const m = /check \(token ~ '([^']+)'\)/.exec(sql);
  assert.ok(m, 'falta el check del token');
  const re = new RegExp(m[1]);
  const t = tokenDashDeBytes(Array.from({ length: LARGO_TOKEN_COPIA }, (_, i) => 255 - i));
  assert.ok(re.test(t), `el check de la base rechaza ${t}`);
  assert.equal(t.startsWith(PREFIJO_TOKEN_DASH), true);
  assert.match(sql, /revoke all on dashboard_copias from anon, authenticated;/);
  assert.match(sql, /alter table dashboard_copias enable row level security;/);
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ''), /\bworkspace_id\b/,'la tabla se lee desde cualquier negocio: su columna es workspace_origen');
});

// ── Al copiar: las personas no viajan ─────────────────────────────────────────────────────────

test('al copiar, los filtros sobre PERSONAS se vacían (de mirar, de definición y del pop-up); lo público se queda', () => {
  const { hoja, vaciados } = hojaParaCopiar(hojaDePrueba());
  const c = controlesPorId(hoja);
  assert.equal(c.get('c-closer')?.valores, null, 'el closer de la barra viajó');
  assert.equal(c.get('c-g1-closer')?.valores, null, 'el closer de definición viajó');
  assert.equal(c.get('c-g1-closer')?.fijo, true, 'el control de definición se quedó, vacío');
  assert.equal(c.get('c-pop-closer')?.valores, null, 'el closer del pop-up viajó');
  assert.deepEqual(c.get('c-campana')?.valores, ['Campaña Octubre'], 'la campaña es pública: viaja');
  assert.equal(c.get('c-texto')?.texto, 'black', 'el anuncio es público: la búsqueda viaja');
  assert.equal(vaciados, 3);
  assert.doesNotMatch(JSON.stringify(hoja), /Ana Pérez/, 'el nombre de una persona quedó en algún lado');
});

// ── Al pegar en otro negocio: lo del otro negocio no vale ─────────────────────────────────────

test('en OTRO negocio, los filtros para mirar se quedan con el vocabulario fijo; los de definición no se tocan', () => {
  const { hoja, vaciados } = hojaParaOtroNegocio(hojaParaCopiar(hojaDePrueba()).hoja);
  const c = controlesPorId(hoja);
  assert.equal(c.get('c-campana')?.valores, null, 'la campaña del otro negocio dejaría el gráfico en cero');
  assert.equal(c.get('c-texto')?.texto, '', 'la búsqueda era del otro negocio');
  assert.deepEqual(c.get('c-prioridad')?.valores, ['Alta'], '«Alta» no es de ningún negocio');
  assert.deepEqual(c.get('c-g2-campana')?.valores, ['Campaña Octubre'], 'un filtro de DEFINICIÓN define la tarjeta: se queda');
  assert.equal(c.get('c-periodo')?.preset, 'ult7', 'un período no nombra nada del negocio');
  assert.equal(vaciados, 2);
});

// ── Los ids nuevos ───────────────────────────────────────────────────────────────────────────

test('lo pegado entra con TODOS los ids nuevos, y lo que apunta a un id lo sigue (conectores y la caja de MaKo)', () => {
  const h = hojaDePrueba();
  const n = hojaConIdsNuevos(h);
  assert.notEqual(n.id, h.id);
  assert.equal(n.nombre, 'Ventas');
  const viejos = new Set([...controlesPorId(h).keys(), ...h.componentes.map((x) => x.id), 'g-pop']);
  for (const id of controlesPorId(n).keys()) assert.ok(!viejos.has(id), `el control ${id} conservó su id`);
  const ids = n.componentes.map((x) => x.id);
  for (const id of ids) assert.ok(!viejos.has(id), `el componente ${id} conservó su id`);
  const g2 = n.componentes[1] as Grafico;
  assert.ok(g2.popup && !viejos.has(g2.popup.componentes[0].id), 'el gráfico del pop-up conservó su id');
  const ia = n.componentes.find((x) => x.clase === 'elemento') as Elemento;
  assert.deepEqual(ia.ia?.fuentes, [g2.id], 'la caja de MaKo dejó de leer el gráfico que leía');
  assert.deepEqual(n.conectores?.map((k) => [k.desde, k.hasta]), [[ids[0], ids[1]]]);
  // Y el saneo de siempre no le poda nada (es lo que corre al agregarla al informe).
  const saneada = sanearHoja(n, 0)!;
  assert.deepEqual((saneada.componentes.find((x) => x.clase === 'elemento') as Elemento).ia?.fuentes, [g2.id]);
  assert.equal(saneada.conectores?.length, 1);
  // Dos pegadas de la misma copia no comparten ningún id.
  const otra = hojaConIdsNuevos(h, 'Ventas (copia)');
  assert.equal(otra.nombre, 'Ventas (copia)');
  assert.ok(!otra.componentes.some((x) => ids.includes(x.id)));
});

test('una hoja sin nada no se copia (y lo que no es una hoja tampoco)', () => {
  assert.equal(hojaDeCopia({ id: 'x', nombre: 'Vacía' }), null);
  assert.equal(hojaDeCopia('no'), null);
  assert.ok(hojaDeCopia(hojaDePrueba()));
});

// ── La ruta y las pantallas ─────────────────────────────────────────────────────────────────────

test('la ruta: sólo el admin con la tab; copiar pasa por hojaParaCopiar y pegar en otro negocio por hojaParaOtroNegocio', () => {
  const src = sinComentarios(leer('app/api/graficos/copia/route.ts'));
  assert.match(src, /if \(rol !== 'admin'\) return err\(403/);
  assert.match(src, /tabEnCapa\('graphics', await getCapaActual\(\)\)/);
  const copiar = src.slice(src.indexOf("body?.action === 'copiar'"), src.indexOf("body?.action === 'leer'"));
  assert.match(copiar, /hojaParaCopiar\(leida\)[\s\S]*guardarCopiaDash\(hoja,/, 'se guarda lo que no pasó por hojaParaCopiar');
  const leerB = src.slice(src.indexOf("body?.action === 'leer'"), src.indexOf('} catch (e)'));
  assert.match(leerB, /copia\.wsOrigen !== ws \? hojaParaOtroNegocio\(copia\.hoja\)/);
  // La tabla no es de un inquilino: no pasa por getTenantDb ni va en TENANT_TABLES.
  assert.doesNotMatch(leer('lib/workspace.ts'), /'dashboard_copias'/);
});

test('«Nueva hoja» monta LA caja de «¿Qué vas a crear hoy?» (sin «Pídeselo a MaKo»), con el token pegado y el «+»', () => {
  const src = sinComentarios(leer('app/dashboard/NuevaHoja.tsx'));
  assert.match(src, /<CajaPedido titulo=\{\{ texto: TITULO_CAJA, nivel: 2 \}\}/);
  assert.doesNotMatch(src, /Pídeselo a MaKo/);
  assert.doesNotMatch(src, /function useEjemplo\(/, 'volvió la copia del ejemplo que se escribe solo: es de la caja');
  assert.match(src, /const p = dashPegado\(v\);/, 'pegar un token en el campo no lo reconoce');
  assert.match(src, /crear\(hojaConIdsNuevos\(r\.hoja\), r\.aviso \?\? undefined\)/, 'lo pegado entra con los ids del origen');
  assert.match(src, /label: 'Pegar un dashboard'/);
  assert.match(src, /label: 'Subir archivo o imagen'/);
  assert.doesNotMatch(src, /useFocoInicial|autoFocus/, 'con el foco al abrir, el ejemplo de la caja no se mueve nunca');
  // El ⋮ de cada hoja copia, y «Duplicar» re-acuña con la misma función.
  assert.match(sinComentarios(leer('app/dashboard/Cabecera.tsx')), /op\('Copiar dashboard', 'copiar', \(\) => acciones\.onCopiar\(deOpciones\.id\)\)/);
  const editor = sinComentarios(leer('app/dashboard/EditorInforme.tsx'));
  assert.match(editor, /const copia = hojaConIdsNuevos\(h, `\$\{h\.nombre\} \(copia\)`\);/);
  assert.match(editor, /onCopiar: copiarHoja/);
});

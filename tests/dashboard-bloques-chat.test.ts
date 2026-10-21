// =============================================================================
// Lo que el chat del Ops Center dibuja al confirmar un cambio del Dashboard (2.7, sobre el marco de bloques 1.7)
// =============================================================================
// Ops Center = lo principal (20/10/2026, docs/ops-center-principal.md). Al confirmar una acción del Dashboard en el
// chat, el hilo dibuja un bloque (lib/chat-bloques.ts): lo creado (una hoja, una tarjeta) con «Abrir en el Dashboard»,
// o el antes y el después de lo que cambió. Lo arma `bloqueDelCambio` (lib/api-mako/areas/dashboard-bloques.ts) en el
// `aplicar` del runner, con el informe de antes y el GUARDADO.
// Lo que se puede romper sin que se vea: que `aplicar` deje de devolverlo (el chat sólo diría «Hecho»), que el link sea
// absoluto (el saneo del marco lo descarta entero: un bloque con un `https://` no se dibuja), que el período salga como
// un id («ult90») en vez de en palabras, y que una edición con MaKo no diga qué agregó y qué sacó.
// La revisión del 21/10 sumó: con más de 12 filas el marco cortaba lo último, que era «Se saca» (lo que no se deshace);
// «Abrir en el Dashboard» abría el informe de quien mira aunque se editara el de otra persona; el bloque salía por la API
// HTTP; y el G5 de una hoja escribía «16 × 10» en el marco, como el tamaño de una imagen.
//
// Correr: node --import tsx --test tests/dashboard-bloques-chat.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (20/10/2026, base 5/0): `aplicar` sin el bloque → 4 / 1; el link absoluto (`https://…`) → 1 / 4
// (el saneo del marco tira el bloque entero);
// el período como id → 4 / 1; «Editar con MaKo» sin lo que se saca → 4 / 1; crear una hoja sin el estado «Nueva» → 4 / 1.
// Lo de la revisión (21/10/2026, base de los dos archivos 14/0): «Se saca» al final → 13 / 1; sin «Y N cambios más» →
// 13 / 1; el bloque por HTTP → 13 / 1; el informe de otra persona con su botón → 13 / 1; `aplicar` sin mirar quién
// chatea → 13 / 1; «16 × 10» en el marco → 13 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOPE_FILAS_G4, bloqueDelCambio, contenidoDeHoja, hrefHoja } from '../lib/api-mako/areas/dashboard-bloques';
import { aplicarCambio, type Cambio } from '../lib/api-mako/areas/dashboard.helpers';
import { rutaInterna, sanearBloque } from '../lib/chat-bloques';
import { firmaDeHoja } from '../lib/graficos-ia-edicion';
import { hojaVacia, type Componente, type Grafico, type Tablero } from '../lib/graficos-catalogo';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));

const graf = (id: string, extra: Partial<Grafico> = {}): Componente => ({
  clase: 'grafico', id, x: 0, y: 0, w: 6, h: 4, tipo: 'barras', fuente: 'leads', metricas: ['leads'], dimension: null, desglose: null,
  controles: [], periodo: 'ult90', desde: '', hasta: '', titulo: 'Leads', ...extra,
} as unknown as Componente);
const tablero = (...hojas: ReturnType<typeof hojaVacia>[]): Tablero => ({ version: 5, hojas } as unknown as Tablero);
/** Aplica el cambio como `aplicar` y arma el bloque como `aplicar`. */
const confirmar = (t: Tablero, c: Cambio) => {
  const ap = aplicarCambio(t, c);
  assert.ok(ap.ok, `el cambio no se aplicó: ${(ap as { error?: string }).error}`);
  return bloqueDelCambio(c, t, ap.tablero);
};
/** Lo que el marco dibuja: si el saneo lo cambia o lo tira, el chat no muestra lo que armamos. */
const sobrevive = (b: unknown) => assert.deepEqual(sanearBloque(b), b, 'el saneo del marco lo cambió o lo descartó');

test('crear o duplicar una hoja: «creado», con lo que tiene y «Abrir en el Dashboard» en ESA hoja', () => {
  const t = tablero(hojaVacia('Marketing', { id: 'mkt', componentes: [graf('g1')] }));
  const nueva = hojaVacia('Ventas', { id: 'ventas', emoji: '📈', componentes: [graf('g2'), graf('g3')] });
  const b = confirmar(t, { op: 'crear_hoja', hoja: nueva });
  // Sin medidas: una hoja no tiene una imagen, y el marco vacío escribía «16 × 10».
  assert.deepEqual(b, { t: 'creado', titulo: '📈 Ventas', estado: 'Nueva', nota: '2 gráficos', abrir: { titulo: 'Abrir en el Dashboard', href: '/dashboard?hoja=ventas' } });
  sobrevive(b);
  const copia = confirmar(t, { op: 'duplicar_hoja', hojaId: 'mkt', copia: hojaVacia('Marketing (copia)', { id: 'mkt2', componentes: [graf('g9')] }) });
  assert.equal((copia as { estado?: string }).estado, 'Copia');
  assert.equal(contenidoDeHoja(hojaVacia('Nada')), 'En blanco');
});

test('editar o mover una tarjeta: el antes y el después, en palabras y sólo lo que cambió', () => {
  const t = tablero(hojaVacia('Marketing', { id: 'mkt', componentes: [graf('g1'), graf('g2', { x: 6 })] }));
  // (Cambiar el tipo a «línea» le suma una dimensión en el saneo: el bloque dice lo que QUEDÓ, no lo que se pidió.)
  // El período vive en el control del gráfico (v5: el saneo lo muda ahí), no en `periodo`.
  const g1 = t.hojas[0].componentes[0] as Grafico;
  const conControl = g1.controles.some((k) => k.tipo === 'periodo');
  const editado = {
    ...g1, titulo: 'Leads del mes',
    ...(conControl ? { controles: g1.controles.map((k) => (k.tipo === 'periodo' ? { ...k, preset: 'este_mes' } : k)) } : { periodo: 'este_mes' }),
  } as Componente;
  const b = confirmar(t, { op: 'reemplazar_componente', hojaId: 'mkt', componente: editado }) as { t: string; filas: Array<{ campo?: string; antes: string; despues: string }> };
  assert.equal(b.t, 'antes_despues');
  assert.deepEqual(b.filas.map((f) => f.campo), ['Título', 'Período']);
  assert.deepEqual(b.filas.find((f) => f.campo === 'Período'), { campo: 'Período', antes: 'Últimos 90 días', despues: 'Este mes' });
  sobrevive(b);
  const movido = confirmar(t, { op: 'mover_componente', hojaId: 'mkt', componenteId: 'g2', movida: { lugar: 'arriba' } }) as { filas: Array<{ campo?: string }> };
  assert.deepEqual(movido.filas.map((f) => f.campo), ['Lugar']);
  sobrevive(movido);
});

test('«Editar con MaKo»: qué se agrega y qué se saca; renombrar una hoja; quitar una tarjeta', () => {
  const t = tablero(hojaVacia('Marketing', { id: 'mkt', componentes: [graf('g1'), graf('g2', { titulo: 'Cierres' })] }));
  const h = t.hojas[0];
  const nueva = { ...h, componentes: [h.componentes[0], graf('g3', { titulo: 'Agendas' })] };
  // `editar_con_ia` aplica sólo si la hoja sigue siendo la que MaKo leyó (su firma).
  const b = confirmar(t, { op: 'editar_con_ia', hojaId: 'mkt', antes: firmaDeHoja(h), hoja: nueva });
  const filas = (b as { filas: Array<{ campo?: string; antes: string; despues: string }> }).filas;
  // Lo que se saca va PRIMERO: no se deshace, y es lo que el corte de 12 filas perdía cuando iba al final.
  assert.deepEqual(filas.map((f) => [f.campo, f.antes, f.despues]), [['Se saca', 'Cierres', '—'], ['Se agrega', '—', 'Agendas']]);
  sobrevive(b);
  // 13 tarjetas: MaKo renombra 12 y saca una. Entra en 12 filas, con «Se saca» arriba y la última contando el resto.
  const trece = tablero(hojaVacia('Marketing', { id: 'mkt', componentes: Array.from({ length: 13 }, (_, i) => graf(`g${i}`, { titulo: `T${i}`, y: i * 4 })) }));
  const h13 = trece.hojas[0];
  const renombradas = { ...h13, componentes: h13.componentes.slice(0, 12).map((c) => ({ ...c, titulo: `${(c as Grafico).titulo} nuevo` } as Componente)) };
  const grande = confirmar(trece, { op: 'editar_con_ia', hojaId: 'mkt', antes: firmaDeHoja(h13), hoja: renombradas }) as { filas: Array<{ campo?: string; antes: string; despues: string }> };
  assert.equal(grande.filas.length, TOPE_FILAS_G4);
  assert.deepEqual(grande.filas[0], { campo: 'Se saca', antes: 'T12', despues: '—' });
  assert.deepEqual(grande.filas.at(-1), { campo: 'Y 2 cambios más', antes: '—', despues: 'Los ves en la hoja' });
  sobrevive(grande);
  const ren = confirmar(t, { op: 'editar_hoja', hojaId: 'mkt', nombre: 'Marketing del mes' }) as { filas: Array<{ campo?: string; antes: string; despues: string }> };
  assert.deepEqual(ren.filas, [{ campo: 'Nombre', antes: 'Marketing', despues: 'Marketing del mes' }]);
  const quitado = confirmar(t, { op: 'quitar_componente', hojaId: 'mkt', componenteId: 'g2' }) as { filas: Array<{ campo?: string; despues: string }> };
  assert.deepEqual(quitado.filas, [{ campo: 'Cierres', antes: 'En la hoja', despues: 'Quitado' }]);
});

test('el link es una ruta de la app: el marco lo acepta y la pantalla le suma el ?ws= de quien mira', () => {
  assert.equal(hrefHoja('mkt'), '/dashboard?hoja=mkt');
  assert.equal(hrefHoja(null), '/dashboard');
  assert.equal(rutaInterna(hrefHoja('a b/c')), '/dashboard?hoja=a%20b%2Fc');
  // Una flecha entre dos tarjetas no dibuja nada: sólo el «Hecho».
  const t = tablero(hojaVacia('Marketing', { id: 'mkt', componentes: [graf('g1'), graf('g2', { x: 6 })] }));
  assert.equal(bloqueDelCambio({ op: 'agregar_conector', hojaId: 'mkt', conector: { id: 'k', desde: 'g1', hasta: 'g2' } } as Cambio, t, t), null);
});

test('el informe de OTRA persona: sin «Abrir en el Dashboard» (abriría el de quien mira) y con su nombre', () => {
  const t = tablero(hojaVacia('Marketing', { id: 'mkt', componentes: [graf('g1')] }));
  const ren = confirmar(t, { op: 'editar_hoja', hojaId: 'mkt', nombre: 'Ventas' });
  const ap = aplicarCambio(t, { op: 'editar_hoja', hojaId: 'mkt', nombre: 'Ventas' });
  assert.ok(ap.ok);
  const deAna = bloqueDelCambio({ op: 'editar_hoja', hojaId: 'mkt', nombre: 'Ventas' }, t, ap.tablero, 'Ana');
  assert.ok(ren && 'abrir' in ren && ren.abrir, 'el de quien chatea, con su botón');
  assert.deepEqual(deAna, { t: 'antes_despues', titulo: 'La hoja «Ventas», en el informe de Ana', filas: [{ campo: 'Nombre', antes: 'Marketing', despues: 'Ventas' }] });
  sobrevive(deAna);
  // Lo creado lleva siempre su botón: en el de otra persona pasa a un antes y después.
  const nueva = hojaVacia('Comercial', { id: 'com', componentes: [graf('g2')] });
  const ap2 = aplicarCambio(t, { op: 'crear_hoja', hoja: nueva });
  assert.ok(ap2.ok);
  const creadaDeAna = bloqueDelCambio({ op: 'crear_hoja', hoja: nueva }, t, ap2.tablero, 'Ana');
  assert.deepEqual(creadaDeAna, { t: 'antes_despues', titulo: 'Comercial, en el informe de Ana', filas: [{ campo: 'Nueva', antes: '—', despues: 'Comercial (1 gráfico)' }] });
  sobrevive(creadaDeAna);
  // `aplicar` lo decide con quien chatea (`Ctx.quien`) contra el dueño del informe (`payload.sub`).
  const run = leer('lib/api-mako/areas/dashboard.run.ts');
  assert.match(run, /const deOtro = quienChatea\(ctx\)\?\.sub !== sub \? \(typeof payload\.de === 'string' && payload\.de\.trim\(\)\) \|\| 'otra persona' : null;/);
  assert.match(run, /payload: \{ sub: r\.sub, de: r\.eleccion\.persona \? \(r\.eleccion\.persona\.nombre \|\| r\.eleccion\.persona\.email\) : null,/);
});

test('por la API HTTP el bloque no sale: es lo que dibuja el chat, una forma interna', () => {
  const http = leer('lib/api-mako/rutas-http.ts');
  assert.match(http, /const \{ bloque: _dibujo, \.\.\.datos \} = res\.datos \?\? \{\};/);
  assert.match(http, /\.\.\.\(res\.datos \? \{ datos \} : \{\}\)/);
  assert.doesNotMatch(http, /datos: res\.datos/, 'los datos tal cual llevaban el bloque');
});

test('`aplicar` devuelve el bloque en `datos.bloque`, armado con el informe de antes y el GUARDADO', () => {
  const run = leer('lib/api-mako/areas/dashboard.run.ts');
  assert.match(run, /const bloque = bloqueDelCambio\(cambio, actual\.tablero, g\.tablero, deOtro\);/);
  assert.match(run, /datos: \{ \.\.\.datos, link: linkHoja\(sigue \? hojaId : null, ctx\), \.\.\.\(bloque \? \{ bloque \} : \{\}\) \},/);
  // El marco lo saca de ahí (lib/mako-turno-app.ts, `confirmarDesdeTarjeta`).
  assert.match(leer('lib/mako-turno-app.ts'), /const bloque = r\.ok \? bloqueDeResultado\(r\.datos\) : null;/);
});

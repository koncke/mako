// =============================================================================
// Los bloques de venta de una landing (5/11/2026, Black November de Leila)
// =============================================================================
// La cuenta regresiva, la prueba social y la barra de escasez (lib/editor-landing/bloques-venta.ts). La regla: SÓLO CON
// DATOS REALES QUE PONE EL NEGOCIO, y sin el dato el bloque no se muestra. Lo que se fija, EJECUTADO:
//   · la página publicada (render.ts) dibuja los tres con sus datos, y NO dibuja ninguno sin su fecha, sus compras o sus números;
//   · el script de la página (`SCRIPT_PAGINA`, con `SCRIPT_VENTA` adentro) corre en un DOM (jsdom) con el reloj controlado:
//     el reloj cuenta hasta la fecha guardada; al llegar se oculta o dice que terminó y NO vuelve a empezar; el pop muestra lo
//     que escribió el negocio («hace 2 días» sale de SU fecha), uno a la vez, y la «×» lo cierra;
//   · la API (`planBloqueVenta`): una fecha pasada, una compra sin nombre o futura, y «quedan» más que «de» se rechazan; la
//     hora sin zona se lee en la del negocio; si la sección ya tiene el bloque, lo cambia;
//   · «Editar con IA» lo conserva entero (no lo vuelve un párrafo).
//
// PROBADO ROMPIÉNDOLO (5/11/2026), sobre una base de 5 / 0:
//   V1 render.ts sin saltear el bloque sin dato                          → 4 / 1
//   V2 el script sin el corte al vencer (sigue contando)                  → 4 / 1
//   V3 el pop con un ítem fijo (no rota)                                  → 4 / 1
//   V4 la API dejando pasar una fecha que ya pasó                          → 4 / 1
//   V5 la IA sin conservarlos (`CON_REF` sin los tres)                     → 4 / 1
// Restaurado, 5 / 0. (El «hace N días» usaba `new Date()` y daba verde sólo porque el reloj real era el 5/11: va `Date.now()`.)
//
// Correr: node --import tsx --test tests/bloques-venta-landing.test.ts
// =============================================================================
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proyecto.supabase.co';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
// jsdom viene en node_modules (lo trae otra dependencia) sin sus tipos: se carga con su forma mínima, para que el tsc entero
// no lo cuente como un error. Lo que se usa es crear la ventana y correr el script de la página adentro.
const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: new (html: string, o: { runScripts: 'outside-only' }) => { window: unknown } };
import { htmlDePagina } from '../lib/editor-landing/render';
import { temaPorId } from '../lib/editor-landing/temas';
import { NODO, type JsonNodo, type LandingContenido, type Pagina } from '../lib/editor-landing/doc';
import { CONFIG_DEFAULT } from '../lib/editor-landing/api-tipos';
import { SCRIPT_PAGINA } from '../lib/editor-landing/pagina-publica';
import { horaLocalDe, instanteDeHoraLocal, resumenBloqueVenta } from '../lib/editor-landing/bloques-venta';
import { sanearContenido } from '../lib/editor-landing/validar';
import { tarjetaABloques, bloquesATarjeta } from '../lib/editor-landing/ia-bloques';
import { planBloqueVenta } from '../lib/api-mako/areas/landing-contenido.helpers';

const tema = temaPorId('pewter');
const AHORA = Date.parse('2026-11-05T18:00:00Z');
const CIERRE = '2026-11-30T05:59:00.000Z'; // 29/11 23:59 en Ciudad de México
const cuenta = (o: Record<string, unknown> = {}): JsonNodo => ({ type: NODO.cuentaRegresiva, attrs: { hasta: CIERRE, zona: 'America/Mexico_City', titulo: 'Black November termina en', alVencer: 'mensaje', mensaje: 'Black November terminó.', ...o } });
const prueba = (items: unknown[]): JsonNodo => ({ type: NODO.pruebaSocial, attrs: { items } });
const escasez = (o: Record<string, unknown>): JsonNodo => ({ type: NODO.escasez, attrs: { titulo: '', unidad: '', ...o } });
const COMPRAS = [
  { nombre: 'Ana', detalle: 'compró el Plan Black', lugar: 'Guadalajara', fecha: '2026-11-03' },
  { nombre: 'Luis', detalle: 'se inscribió', lugar: '', fecha: null },
];
const pagina = (bloques: JsonNodo[]): Pagina => ({ id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc', content: [{ type: NODO.tarjeta, attrs: { id: 'tA' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }, ...bloques] }] } });
const html = (bloques: JsonNodo[]) => htmlDePagina(pagina(bloques), CONFIG_DEFAULT, tema, { modo: 'publico' });

test('la página publicada los dibuja con SUS datos, y sin el dato no dibuja nada', () => {
  const h = html([cuenta(), prueba(COMPRAS), escasez({ total: 50, quedan: 12, unidad: 'cupos' })]);
  assert.match(h, /class="gm-cuenta" data-hasta="2026-11-30T05:59:00\.000Z" data-al-vencer="mensaje"/);
  assert.match(h, /Hasta el 29 de noviembre a las 23:59/, 'sin el script, la fecha de cierre se lee igual');
  assert.match(h, /<div class="gm-prueba" data-pop="si" hidden="">/, 'el pop, escondido hasta que lo muestra el script');
  assert.match(h, /<strong class="gm-prueba-nombre">Ana<\/strong><span class="gm-prueba-lugar"> de Guadalajara<\/span>/);
  assert.match(h, /Quedan 12 de 50 cupos/);
  assert.match(h, /style="width:76%"/, 'la barra es lo vendido: 38 de 50');
  // Sin el dato: ni la fecha, ni una compra con nombre y qué hizo, ni los dos números (o «quedan» de más).
  const vacio = html([cuenta({ hasta: null }), prueba([{ nombre: 'Ana', detalle: '' }]), escasez({ total: 50, quedan: null }), escasez({ total: 10, quedan: 20 })]);
  assert.doesNotMatch(vacio, /gm-cuenta|gm-prueba|gm-escasez/);
  assert.match(html([escasez({ total: 50, quedan: 0 })]), /Agotado: no quedan lugares/);
  // Se guardan sin descartes (el saneo del server los conoce).
  const r = sanearContenido({ v: 1, paginas: [pagina([cuenta(), prueba(COMPRAS), escasez({ total: 5, quedan: 1 })])] });
  assert.deepEqual(r.descartes, []);
});

/** La página publicada en un DOM, con el reloj y los timers en la mano del test. */
function enDom(h: string, ahora: { ms: number }) {
  const dom = new JSDOM(`<!doctype html><html><body>${h}</body></html>`, { runScripts: 'outside-only' });
  const w = dom.window as unknown as Window & typeof globalThis & { eval: (s: string) => unknown };
  const timers: Array<{ fn: () => void; cada: number | null; en: number }> = [];
  w.Date.now = () => ahora.ms;
  w.setTimeout = ((fn: () => void, ms: number) => { timers.push({ fn, cada: null, en: ahora.ms + ms }); return timers.length; }) as never;
  w.setInterval = ((fn: () => void, ms: number) => { timers.push({ fn, cada: ms, en: ahora.ms + ms }); return timers.length; }) as never;
  w.eval(SCRIPT_PAGINA);
  const avanzar = (ms: number) => {
    const hasta = ahora.ms + ms;
    for (let vuelta = 0; vuelta < 10_000; vuelta++) {
      const t = timers.filter((x) => x.en <= hasta).sort((a, b) => a.en - b.en)[0];
      if (!t) break;
      ahora.ms = t.en;
      if (t.cada == null) timers.splice(timers.indexOf(t), 1); else t.en += t.cada;
      t.fn();
    }
    ahora.ms = hasta;
  };
  return { d: w.document, avanzar };
}

test('el reloj cuenta hasta la fecha guardada; al llegar dice que terminó y NO vuelve a empezar', () => {
  const ahora = { ms: Date.parse('2026-11-30T05:58:50.000Z') }; // 10 s antes del cierre
  const { d, avanzar } = enDom(html([cuenta(), cuenta({ alVencer: 'ocultar' })]), ahora);
  const [c1, c2] = [...d.querySelectorAll('.gm-cuenta')] as HTMLElement[];
  const num = (c: HTMLElement, u: string) => c.querySelector(`.gm-cuenta-num[data-u="${u}"]`)?.textContent;
  assert.deepEqual([num(c1, 'd'), num(c1, 'h'), num(c1, 'm'), num(c1, 's')], ['0', '00', '00', '10']);
  avanzar(4000);
  assert.equal(num(c1, 's'), '06');
  avanzar(7000);
  assert.equal(c1.getAttribute('data-vencida'), 'si');
  assert.equal((c1.querySelector('.gm-cuenta-msg') as HTMLElement).hidden, false, 'dice «Black November terminó.»');
  assert.equal(c2.hidden, true, 'la de «ocultar» se oculta');
  // Pasan dos días (y otro visitante entra): sigue terminada, nadie la reinicia.
  avanzar(2 * 86_400_000);
  assert.equal(c1.getAttribute('data-vencida'), 'si');
  assert.equal(num(c1, 's'), '01', 'el reloj no volvió a contar');
  const otro = enDom(html([cuenta()]), { ms: Date.parse('2026-12-02T10:00:00Z') });
  assert.equal(otro.d.querySelector('.gm-cuenta')?.getAttribute('data-vencida'), 'si', 'un visitante nuevo la ve terminada');
});

test('el pop muestra lo que escribió el negocio, uno a la vez, con «hace N días» de SU fecha, y la «×» lo cierra', () => {
  const ahora = { ms: AHORA };
  const { d, avanzar } = enDom(`<div class="gm-doc">${html([prueba(COMPRAS)])}</div>`, ahora);
  const p = d.querySelector('.gm-prueba') as HTMLElement;
  assert.equal(p.parentElement?.className, 'gm-doc', 'sale de la sección (animada) al final de .gm-doc');
  assert.equal(p.hidden, true, 'no aparece de entrada');
  assert.equal(p.querySelector('[data-fecha]')?.textContent, 'hace 2 días', 'del 3 al 5 de noviembre');
  avanzar(4000);
  const visible = () => [...p.querySelectorAll('.gm-prueba-item[data-visible="si"]')].map((x) => x.querySelector('strong')?.textContent);
  assert.equal(p.hidden, false);
  assert.deepEqual(visible(), ['Ana']);
  avanzar(8000);
  assert.deepEqual(visible(), ['Luis'], 'rota de a uno');
  (p.querySelector('.gm-prueba-cerrar') as HTMLButtonElement).click();
  avanzar(8000);
  assert.equal(p.hidden, true, 'cerrado, no vuelve en esta visita');
});

const contenido = (bloques: JsonNodo[] = []): LandingContenido => ({ v: 1, paginas: [pagina(bloques)] });
const OP = { zona: 'America/Mexico_City', ahoraMs: AHORA };
const nodoDe = (c: LandingContenido, tipo: string) => (c.paginas[0].doc.content?.[0].content ?? []).filter((n) => n.type === tipo);

test('la API: sólo con datos reales; la hora en la zona del negocio; y si ya está, lo cambia', () => {
  const r = planBloqueVenta(contenido(), { seccion: 'tA', tipo: 'cuenta_regresiva', hasta: '2026-11-29T23:59' }, OP);
  assert.ok(!('error' in r), JSON.stringify(r));
  const n = nodoDe((r as { contenido: LandingContenido }).contenido, NODO.cuentaRegresiva);
  assert.equal(n.length, 1);
  assert.equal(n[0].attrs?.hasta, CIERRE, '23:59 de Ciudad de México');
  assert.match((r as { resumen: string }).resumen, /Agregar en la sección .*cuenta regresiva hasta el 29 de noviembre a las 23:59/);
  // Cambiar la que ya está: no agrega otra.
  const r2 = planBloqueVenta((r as { contenido: LandingContenido }).contenido, { seccion: 'tA', tipo: 'cuenta_regresiva', alVencer: 'ocultar' }, OP);
  assert.equal(nodoDe((r2 as { contenido: LandingContenido }).contenido, NODO.cuentaRegresiva).length, 1);
  assert.equal(nodoDe((r2 as { contenido: LandingContenido }).contenido, NODO.cuentaRegresiva)[0].attrs?.alVencer, 'ocultar');
  // Lo que no se acepta.
  assert.match((planBloqueVenta(contenido(), { seccion: 'tA', tipo: 'cuenta_regresiva', hasta: '2026-11-01T10:00' }, OP) as { error: string }).error, /ya pasó/);
  assert.match((planBloqueVenta(contenido(), { seccion: 'tA', tipo: 'cuenta_regresiva' }, OP) as { error: string }).error, /Falta hasta cuándo/);
  assert.match((planBloqueVenta(contenido(), { seccion: 'tA', tipo: 'prueba_social', compras: [{ nombre: 'Ana' }] }, OP) as { error: string }).error, /quién .* y qué hizo/);
  assert.match((planBloqueVenta(contenido(), { seccion: 'tA', tipo: 'prueba_social', compras: [{ nombre: 'Ana', detalle: 'compró', fecha: '2026-12-01' }] }, OP) as { error: string }).error, /futura/);
  assert.match((planBloqueVenta(contenido(), { seccion: 'tA', tipo: 'escasez', quedan: 20, total: 10 }, OP) as { error: string }).error, /no pueden quedar más/);
  assert.match((planBloqueVenta(contenido(), { seccion: 'tA', tipo: 'escasez', quedan: 3 }, OP) as { error: string }).error, /Faltan los dos números/);
  const e = planBloqueVenta(contenido(), { seccion: 'tA', tipo: 'escasez', quedan: 12, total: 50, unidad: 'cupos' }, OP);
  assert.match((e as { resumen: string }).resumen, /Quedan 12 de 50 cupos/);
  // La vuelta del input del editor.
  assert.equal(horaLocalDe(CIERRE, 'America/Mexico_City'), '2026-11-29T23:59');
  assert.equal(instanteDeHoraLocal('2026-11-29T23:59', 'America/Mexico_City'), CIERRE);
  assert.match(resumenBloqueVenta(NODO.pruebaSocial, { items: COMPRAS }), /2 compras/);
});

test('«Editar con IA» los conserva enteros (no los vuelve un párrafo ni los borra)', () => {
  const t = pagina([cuenta(), prueba(COMPRAS), escasez({ total: 50, quedan: 12 })]).doc.content![0];
  const d: string[] = [];
  const ia = tarjetaABloques(t, { descartes: d });
  assert.deepEqual(ia.bloques.slice(1).map((b) => (b as { t: string }).t), ['conservar', 'conservar', 'conservar']);
  assert.deepEqual(d, []);
  const vuelta = bloquesATarjeta(ia, { base: t });
  assert.deepEqual((vuelta.content ?? []).slice(1).map((n) => n.type), [NODO.cuentaRegresiva, NODO.pruebaSocial, NODO.escasez]);
  assert.equal((vuelta.content ?? [])[1].attrs?.hasta, CIERRE);
});

// =============================================================================
// Web Generator, tanda 7: la ventana de lectura se abre EN EL CLIC que pide Analizar o Replicar
// =============================================================================
// Martín (15/10/2026), textual: «Si no pudo leer la landing, no me debe saltar el botón de "MaKo no pudo leerla
// sola" y las opciones de leer en tu navegador... Por defecto si no pudo de una manera que vaya directo a abrir
// la ventana emergente y a analizar la landing...».
//
// POR QUÉ HABÍA UN SEGUNDO BOTÓN: Chrome sólo deja abrir una ventana dentro del gesto de la persona, y el orden
// era server → ventana: para cuando el server contestaba `enNavegador`, el clic ya no servía y hacía falta OTRO.
// Ahora es ventana → server (lib/editor-landing/lector-navegador.ts, la cabecera). Lo que estos tests cuidan:
//   · el `window.open` (de `abrirEnElClic` o de la reserva) corre en el handler del clic ANTES de cualquier
//     `await`, y ningún camino que arranca desde un efecto abre una ventana propia;
//   · los arranques automáticos (el Diagnóstico y Replicar que arrancan solos) TOMAN la ventana reservada;
//   · el casillero: misma URL, una vez, vence cerrándola, cerrada no se usa, bloqueada se dice;
//   · `pedirConVentana`: con `enNavegador` y la ventana viva se lee en ESA ventana y el pedido se repite con
//     la lectura, sin clic; la prueba rápida cierra la ventana si el server sí lee; sin texto, `vacia`;
//   · la prueba del server usa `motivoDePagina` (la misma regla que Replicar, no una copia) y la acción
//     nueva está detrás del corte de rol de la ruta, y NO en la API de MaKo.
// Lo que no se puede probar acá (un Chrome real con su bloqueador de ventanas) está en el reporte de la tanda.
//
// PROBADO ROMPIÉNDOLO (15/10/2026): ver el bloque «ROTURAS» al final.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  TEXTO_ESPERA_VENTANA, abrirEnElClic, leerEnNavegador, pedirConVentana, reservarVentanaLectura, soltarVentanaReservada,
  tomarVentanaReservada, type VentanaDelClic,
} from '../lib/editor-landing/lector-navegador';
import { urlConVentanaAlAbrir } from '../app/web-generator/panel-reglas';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque que va de `ini` hasta `fin` (su cierre real, nunca un número de caracteres). */
function bloque(src: string, ini: string, fin: string): string {
  const i = src.indexOf(ini);
  assert.ok(i >= 0, `no encontré «${ini}»`);
  const j = src.indexOf(fin, i + ini.length);
  assert.ok(j > i, `no encontré el cierre «${fin}» de «${ini}»`);
  return src.slice(i, j + fin.length);
}
const MAKO = 'https://hola-mako.com';
const URL_L = 'https://su-landing.com/oferta';
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// Un navegador de mentira: `window.open`, las ventanas, los mensajes y el POST de la firma
// ─────────────────────────────────────────────────────────────────────────────

type Oyente = (ev: { source: unknown; origin: string; data: unknown }) => void;
type VentanaFalsa = {
  closed: boolean;
  navegada: string;
  document: { title: string; body: { style: { cssText: string }; textContent: string } };
  location: { replace(u: string): void };
  postMessage(data: unknown, destino: string): void;
  close(): void;
};

function navegadorFalso(abrir: 'si' | 'null' = 'si') {
  const ventanas: VentanaFalsa[] = [];
  const oyentes = new Set<Oyente>();
  (globalThis as unknown as { fetch: unknown }).fetch = async () => ({ ok: true, json: async () => ({ ok: true, firma: '1760000000000.F' }) });
  const nueva = (): VentanaFalsa => {
    const v: VentanaFalsa = {
      closed: false,
      navegada: '',
      document: { title: '', body: { style: { cssText: '' }, textContent: '' } },
      location: { replace(u: string) { v.navegada = u; } },
      postMessage() { /* el «dale» */ },
      close() { v.closed = true; },
    };
    ventanas.push(v);
    return v;
  };
  (globalThis as unknown as { window: unknown }).window = {
    location: { origin: MAKO, search: '?ws=9' },
    screen: { availWidth: 1440, availHeight: 900 },
    open: () => (abrir === 'null' ? null : nueva()),
    addEventListener: (_: string, f: Oyente) => { oyentes.add(f); },
    removeEventListener: (_: string, f: Oyente) => { oyentes.delete(f); },
  };
  const mandar = (ev: { source: unknown; origin: string; data: unknown }) => { for (const f of [...oyentes]) f(ev); };
  /** El lector del otro lado: cuando la ventana navega, saluda y manda lo leído (`piezas`). */
  const contestar = async (v: VentanaFalsa, piezas: unknown[], tras = 0) => {
    for (let i = 0; i < 200 && !v.navegada; i++) await esperar(10);
    assert.ok(v.navegada, 'la ventana nunca navegó a la ruta del lector');
    if (tras) await esperar(tras);
    const id = new URL(v.navegada, MAKO).searchParams.get('lector')!;
    mandar({ source: v, origin: 'null', data: { tipo: 'mako-lectura', id, fase: 'hola', camino: 'ventana' } });
    mandar({ source: v, origin: 'null', data: { tipo: 'mako-lectura', id, fase: 'fin', camino: 'ventana', titulo: 'T', piezas } });
  };
  return { ventanas, oyentes, contestar };
}

const TEXTO_LEIDO = [{ tipo: 'texto', texto: 'Una landing que se arma en el navegador y que MaKo lee como un visitante' }];
type Resp = { ok: boolean; enNavegador?: boolean; conLectura?: boolean };
const pideNavegador = (r: Resp) => !r.ok && r.enNavegador === true;

// ─────────────────────────────────────────────────────────────────────────────
// 1. El casillero: reservar en el clic, tomar en el arranque automático
// ─────────────────────────────────────────────────────────────────────────────

test('la reserva: la abre y la pinta en el clic; la toma la MISMA página, UNA vez', () => {
  const f = navegadorFalso();
  const v = reservarVentanaLectura(URL_L);
  assert.equal(f.ventanas.length, 1, 'el window.open corre en la reserva (el clic)');
  assert.equal(f.ventanas[0].document.body.textContent, TEXTO_ESPERA_VENTANA);
  assert.equal(tomarVentanaReservada('https://otra.com/x'), null, 'otra página no la toma');
  assert.equal(tomarVentanaReservada(URL_L), v, 'la misma página la toma');
  assert.equal(tomarVentanaReservada(URL_L), null, 'una sola vez');
  assert.equal(f.ventanas[0].closed, false, 'tomada, no se cierra');
});

test('la reserva: vence cerrándola, cerrada no se usa, otro clic cierra la anterior, bloqueada se dice', async () => {
  const f = navegadorFalso();
  reservarVentanaLectura(URL_L, { venceMs: 40 });
  await esperar(80);
  assert.equal(f.ventanas[0].closed, true, 'al vencer se cierra');
  assert.equal(tomarVentanaReservada(URL_L), null, 'y ya no se toma');

  reservarVentanaLectura(URL_L);
  f.ventanas[1].close();
  assert.equal(tomarVentanaReservada(URL_L), null, 'cerrada por la persona: no se usa');

  reservarVentanaLectura(URL_L);
  reservarVentanaLectura('https://otra.com/x');
  assert.equal(f.ventanas[2].closed, true, 'el segundo clic cierra la ventana del primero');
  soltarVentanaReservada('https://otra.com/x');
  assert.equal(f.ventanas[3].closed, true, 'soltar cierra');

  navegadorFalso('null');
  assert.equal(reservarVentanaLectura(URL_L), 'bloqueada');
  assert.equal(tomarVentanaReservada(URL_L), 'bloqueada', 'el arranque sabe que el navegador la bloqueó');
  assert.equal(reservarVentanaLectura('no es una url'), null, 'sin dirección, no se reserva nada');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. pedirConVentana: el pedido de siempre con la ventana del clic
// ─────────────────────────────────────────────────────────────────────────────

test('enNavegador con la ventana viva: se lee en ESA ventana y el pedido se repite con la lectura, sin clic', async () => {
  const f = navegadorFalso();
  const ventana = abrirEnElClic();
  const pedidos: unknown[] = [];
  let leyendo = false;
  const p = pedirConVentana<Resp>({
    url: URL_L,
    ventana,
    pedir: async (lectura) => { pedidos.push(lectura ?? null); return lectura ? { ok: true, conLectura: true } : { ok: false, enNavegador: true }; },
    pideNavegador,
    probar: async () => false,
    alLeer: () => { leyendo = true; },
  });
  await f.contestar(f.ventanas[0], TEXTO_LEIDO);
  const r = await p;
  assert.equal(f.ventanas.length, 1, 'ninguna ventana nueva: se usó la del clic');
  assert.match(f.ventanas[0].navegada, /^\/api\/landing-generator\/diagnostico\/pagina\?url=https%3A%2F%2Fsu-landing\.com%2Foferta&lector=/);
  assert.equal(leyendo, true, 'la pantalla pasó a «Leyendo la página…»');
  assert.equal(pedidos.length, 2, 'el pedido se repitió solo');
  assert.equal(pedidos[0], null);
  assert.match((pedidos[1] as { texto: string }).texto, /se arma en el navegador/);
  assert.deepEqual(r.r, { ok: true, conLectura: true });
  assert.equal(r.sinLectura, null);
  assert.equal(r.lectura?.fuente, 'navegador', 'la lectura vuelve (el Diagnóstico la reusa para Replicar)');
  assert.equal(f.ventanas[0].closed, true);
  assert.equal(f.oyentes.size, 0);
});

test('la prueba rápida: si el server SÍ lee, la ventana se cierra antes de que conteste el pedido', async () => {
  const f = navegadorFalso();
  const ventana = abrirEnElClic();
  let suelta!: (r: Resp) => void;
  const p = pedirConVentana<Resp>({
    url: URL_L, ventana, pideNavegador, probar: async () => true,
    pedir: () => new Promise<Resp>((res) => { suelta = res; }),
  });
  await esperar(20);
  assert.equal(f.ventanas[0].closed, true, 'legible: cerrada con el pedido todavía pensando');
  suelta({ ok: true });
  const r = await p;
  assert.deepEqual(r, { r: { ok: true }, lectura: null, sinLectura: null });
  assert.equal(f.ventanas[0].navegada, '', 'no se navegó a nada');
});

test('la prueba que llega TARDE no cierra una ventana que ya está leyendo', async () => {
  const f = navegadorFalso();
  const ventana = abrirEnElClic();
  const p = pedirConVentana<Resp>({
    url: URL_L, ventana, pideNavegador,
    probar: () => esperar(150).then(() => true),
    pedir: async (lectura) => (lectura ? { ok: true, conLectura: true } : { ok: false, enNavegador: true }),
  });
  const lector = f.contestar(f.ventanas[0], TEXTO_LEIDO, 300);
  await esperar(250);
  assert.equal(f.ventanas[0].closed, false, 'la prueba contestó «legible» con la lectura en curso: la ventana sigue');
  await lector;
  assert.deepEqual((await p).r, { ok: true, conLectura: true });
});

test('sin texto en el navegador: `vacia`, y recién ahí se pega (no hay segunda vuelta)', async () => {
  const f = navegadorFalso();
  let n = 0;
  const p = pedirConVentana<Resp>({
    url: URL_L, ventana: abrirEnElClic(), pideNavegador, probar: async () => false,
    pedir: async () => { n++; return { ok: false, enNavegador: true }; },
  });
  await f.contestar(f.ventanas[0], []);
  const r = await p;
  assert.equal(r.sinLectura?.motivo, 'vacia');
  assert.equal(n, 1);
});

test('bloqueada, cerrada antes de contestar, otra falla y pantalla que se fue: nadie lee ni repite', async () => {
  // Bloqueada en el clic: el aviso (sinLectura «bloqueadas»), sin abrir nada.
  let f = navegadorFalso();
  let n = 0;
  const pedir = async () => { n++; return { ok: false, enNavegador: true } as Resp; };
  let r = await pedirConVentana<Resp>({ url: URL_L, ventana: 'bloqueada', pedir, pideNavegador });
  assert.equal(r.sinLectura?.motivo, 'bloqueadas');
  assert.equal(f.ventanas.length, 0);
  assert.equal(n, 1);

  // Cerrada por la persona (o por la prueba) antes de que el server pidiera el navegador: la salida de siempre.
  f = navegadorFalso();
  const v = abrirEnElClic() as Window;
  n = 0;
  const p = pedirConVentana<Resp>({ url: URL_L, ventana: v, pedir: () => esperar(30).then(pedir), pideNavegador, probar: async () => false });
  v.close();
  r = await p;
  assert.equal(r.sinLectura, null, 'sin nota: LeerOPegar con su botón, como antes');
  assert.equal(f.ventanas[0].navegada, '');
  assert.equal(n, 1);

  // Otra falla (un 404): la ventana se cierra.
  f = navegadorFalso();
  r = await pedirConVentana<Resp>({ url: URL_L, ventana: abrirEnElClic(), pedir: async () => ({ ok: false }), pideNavegador, probar: async () => false });
  assert.equal(f.ventanas[0].closed, true);
  assert.equal(r.sinLectura, null);

  // La pantalla se fue: ni se lee ni se repite el pedido (la segunda vuelta paga IA).
  f = navegadorFalso();
  n = 0;
  r = await pedirConVentana<Resp>({ url: URL_L, ventana: abrirEnElClic(), pedir, pideNavegador, probar: async () => false, sigue: () => false });
  assert.equal(n, 1);
  assert.equal(f.ventanas[0].navegada, '');
  assert.equal(f.ventanas[0].closed, true);
});

test('leerEnNavegador con la ventana del clic: no abre otra; cerrada es «cerrada», nunca «bloqueadas»', async () => {
  const f = navegadorFalso();
  const v = abrirEnElClic() as Window;
  const p = leerEnNavegador(URL_L, { ventana: v, topeMs: 3_000 });
  await f.contestar(f.ventanas[0], TEXTO_LEIDO);
  assert.ok((await p).ok);
  assert.equal(f.ventanas.length, 1);
  (v as unknown as VentanaFalsa).closed = true;
  const r = await leerEnNavegador(URL_L, { ventana: v });
  assert.equal(!r.ok && r.motivo, 'cerrada');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Cuándo se reserva (la regla pura del Panel)
// ─────────────────────────────────────────────────────────────────────────────

test('urlConVentanaAlAbrir: sólo lo de AFUERA que va a leer al montarse', () => {
  const analizadas = [{ url: 'https://ya-analizada.com', veredicto: 'ok', score: 7 }];
  assert.equal(urlConVentanaAlAbrir({ tipo: 'diagnostico', url: URL_L }, analizadas), URL_L);
  assert.equal(urlConVentanaAlAbrir({ tipo: 'diagnostico', docId: 4 }, analizadas), null, 'una NUESTRA se lee de su contenido');
  assert.equal(urlConVentanaAlAbrir({ tipo: 'diagnostico', url: 'https://www.ya-analizada.com/' }, analizadas), null, 'ya analizada: abre lo guardado');
  assert.equal(urlConVentanaAlAbrir({ tipo: 'diagnostico' }, analizadas), null);
  assert.equal(urlConVentanaAlAbrir({ tipo: 'replicar', url: URL_L, auto: true }, analizadas), URL_L, 'Replicar con el formato por defecto');
  assert.equal(urlConVentanaAlAbrir({ tipo: 'replicar', url: URL_L, formato: 'presentacion', auto: true }, analizadas), URL_L);
  assert.equal(urlConVentanaAlAbrir({ tipo: 'replicar', url: URL_L, formato: 'web', auto: true }, analizadas), null, 'la «Página web» no lee en el navegador');
  assert.equal(urlConVentanaAlAbrir({ tipo: 'replicar' }, analizadas), null);
  assert.equal(urlConVentanaAlAbrir({ tipo: 'crear' }, analizadas), null);
  // La MISMA pantalla no se remonta ni arranca de nuevo: la ventana quedaría huérfana hasta vencer.
  assert.equal(urlConVentanaAlAbrir({ tipo: 'diagnostico', url: URL_L }, analizadas, { tipo: 'diagnostico', url: URL_L }), null);
  assert.equal(urlConVentanaAlAbrir({ tipo: 'diagnostico', url: URL_L }, analizadas, { tipo: 'diagnostico', url: 'https://otra.com/' }), URL_L);
  assert.equal(urlConVentanaAlAbrir({ tipo: 'replicar', url: URL_L, auto: true }, analizadas, { tipo: 'replicar', url: URL_L, formato: 'landing', auto: true }), null);
  assert.equal(urlConVentanaAlAbrir({ tipo: 'replicar', url: URL_L, auto: true }, analizadas, { tipo: 'crear' }), URL_L);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. El cableado de las pantallas (fuente sin comentarios)
// ─────────────────────────────────────────────────────────────────────────────

const INICIO = sinComentarios(leer('app/web-generator/Inicio.tsx'));
const PANEL = sinComentarios(leer('app/web-generator/diagnostico/PanelDiagnostico.tsx'));
const REPLICAR = sinComentarios(leer('app/web-generator/crear/Replicar.tsx'));

test('el window.open corre en el CLIC, antes de cualquier await: Inicio (el ↑ de la caja y el «Ir a»)', () => {
  const abrir = bloque(INICIO, 'const abrirDerechaEnElClic = (d: Derecha) => {', '\n  };');
  assert.ok(abrir.length < 400, `el bloque mide ${abrir.length}`);
  assert.doesNotMatch(abrir, /await|async/);
  assert.ok(abrir.indexOf('const leer = urlConVentanaAlAbrir(d, analizadas, derecha);') >= 0, 'la regla, con la pantalla de ahora');
  assert.ok(abrir.indexOf('if (leer) reservarVentanaLectura(leer);') >= 0, 'reserva');
  assert.ok(abrir.indexOf('reservarVentanaLectura(leer)') < abrir.indexOf('setDerecha(d)'), 'la ventana antes que el estado');
  const alAccion = bloque(INICIO, 'const alAccion = (a: AccionCaja) => {', '\n  };');
  assert.match(alAccion, /abrirDerechaEnElClic\(derechaDeAccion\(a, lista, props\.bases\)\)/);
  assert.doesNotMatch(alAccion, /setDerecha\(|await/);
  const ir = bloque(INICIO, 'const analizarUrl = (url: string) => {', '\n  };');
  assert.match(ir, /abrirDerechaEnElClic\(propia \?/);
  assert.doesNotMatch(ir, /setDerecha\(|await/);
});

test('el window.open corre en el CLIC, antes de cualquier await: el Diagnóstico y Replicar', () => {
  // «Volver a analizar»: la ventana es el ARGUMENTO (se evalúa antes de entrar a `analizar`).
  assert.match(PANEL, /onClick=\{\(\) => void analizar\(\{ ventana: !deNuestra && urlPegada \? abrirEnElClic\(\) : null \}\)\}/);
  // Replicar y «Aplicar» de una de afuera: handlers sincrónicos, la ventana primero.
  const rep = bloque(PANEL, 'const replicar = useCallback((formato: FormatoReplicar) => {', '\n  }, [');
  assert.doesNotMatch(rep, /await|async/);
  assert.ok(rep.indexOf('abrirEnElClic()') > 0 && rep.indexOf('abrirEnElClic()') < rep.indexOf('setMenuReplicar(null)'));
  assert.match(rep, /void pedirReplica\(urlPegada, formato, lectura && formato !== 'web' \? \{ lectura \} : \{ ventana \}\)/);
  const apl = bloque(PANEL, 'const aplicarAfuera = useCallback((que: number[] | \'todos\') => {', '\n  }, [');
  assert.doesNotMatch(apl, /await|async/);
  assert.ok(apl.indexOf('abrirEnElClic()') > 0 && apl.indexOf('abrirEnElClic()') < apl.indexOf('setParaAplicar(true)'));
  assert.match(apl, /void pedirReplica\(urlPegada, 'landing', lectura \? \{ lectura \} : \{ ventana \}, pasarYAbrir\)/);
  // El formulario de Replicar y su «Replicar como…»: en el submit / el clic, sin nada antes.
  assert.match(REPLICAR, /onSubmit=\{\(e\) => \{ e\.preventDefault\(\); if \(url && !ocupado\) empezar\(url, formato, pideVentana\(formato\) \? abrirEnElClic\(\) : null\); \}\}/);
  assert.match(REPLICAR, /onProbar=\{\(f\) => \{ if \(!pedida\) return; const v = pideVentana\(f\) \? abrirEnElClic\(\) : null; setFormato\(f\); empezar\(pedida, f, v\); \}\}/);
});

test('ningún camino que corre DESPUÉS de un await (o desde un efecto) abre una ventana propia', () => {
  // `analizar` y el `replicar` de useReplicar corren desde efectos y después de pedidos: reciben la ventana.
  const analizar = bloque(PANEL, 'const analizar = useCallback(async (', '\n  }, [');
  const usar = bloque(REPLICAR, 'const replicar = useCallback(async (', '\n  }, [');
  for (const [nombre, b] of [['analizar', analizar], ['useReplicar', usar]] as const) {
    assert.ok(b.length > 600 && b.length < 4_000, `${nombre}: el bloque mide ${b.length}`);
    assert.doesNotMatch(b, /abrirEnElClic\(|reservarVentanaLectura\(|window\.open\(|leerEnNavegador\(/, nombre);
    assert.match(b, /await pedirConVentana\(/, `${nombre} usa pedirConVentana`);
  }
  // Sólo estos archivos abren la ventana del clic (un call site nuevo se mira acá antes de sumarlo).
  const abren: string[] = [];
  const recorrer = (dir: string) => {
    for (const n of readdirSync(join(RAIZ, dir))) {
      const r = `${dir}/${n}`;
      if (statSync(join(RAIZ, r)).isDirectory()) recorrer(r);
      else if (/\.tsx?$/.test(n)) {
        const src = leer(r);
        // Primero el texto crudo (barato); sin comentarios, sólo donde aparece.
        if (/abrirEnElClic\(|reservarVentanaLectura\(/.test(src) && /abrirEnElClic\(|reservarVentanaLectura\(/.test(sinComentarios(src))) abren.push(r);
      }
    }
  };
  recorrer('app');
  assert.deepEqual(abren.sort(), ['app/web-generator/Inicio.tsx', 'app/web-generator/crear/Replicar.tsx', 'app/web-generator/diagnostico/PanelDiagnostico.tsx']);
});

test('los arranques automáticos TOMAN la ventana reservada (y la sueltan si no analizan)', () => {
  const montaje = bloque(PANEL, 'const reservada = ', 'else sinUsar();');
  assert.match(montaje, /const reservada = !deNuestra && url \? tomarVentanaReservada\(url\) : null;/);
  assert.match(montaje, /if \(!lista\.sugerencias\.length && !lista\.resumen\) void analizar\(\{ ventana: reservada \}\);\s*else sinUsar\(\);/);
  const auto = bloque(REPLICAR, 'const arrancado = useRef(false);', '}, [auto, urlInicial, formatoInicial, empezar]);');
  assert.match(auto, /if \(auto && u\) empezar\(u, f, pideVentana\(f\) \? tomarVentanaReservada\(u\) : null\);/);
});

test('con `enNavegador` la pantalla lee en la ventana: los dos pedidos preguntan lo mismo que el server contesta', () => {
  const analizar = bloque(PANEL, 'const analizar = useCallback(async (', '\n  }, [');
  assert.match(analizar, /pideNavegador: \(x\) => !esLista\(x\) && \(x as \{ enNavegador\?: boolean \}\)\.enNavegador === true,/);
  assert.match(analizar, /setSalida\(sinLectura\);/);
  const usar = bloque(REPLICAR, 'const replicar = useCallback(async (', '\n  }, [');
  assert.match(usar, /pideNavegador: \(x\) => !x\.ok && \(x as \{ enNavegador\?: boolean \}\)\.enNavegador === true,/);
  assert.match(usar, /salida: sinLectura,/);
  // LeerOPegar ya no es el camino: es la salida, y arranca con lo que pasó (el aviso a la vista, o a pegar).
  const lop = sinComentarios(leer('app/web-generator/lector/LeerOPegar.tsx'));
  assert.match(lop, /useLectorEnNavegador\(\{ bloqueadas: salida\?\.motivo === 'bloqueadas' \}\)/);
  assert.match(lop, /useState\(!enNavegador \|\| salida\?\.motivo === 'vacia'\)/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. El server: la prueba rápida y su puerta
// ─────────────────────────────────────────────────────────────────────────────

test('la prueba de lectura usa `motivoDePagina` (la regla de Replicar), sin IA ni base', () => {
  const srv = sinComentarios(leer('lib/editor-landing/diagnostico-server.ts'));
  assert.match(srv, /import \{ motivoDePagina, sanearLectura \} from '\.\/lectura-reglas';/);
  const prueba = bloque(srv, 'export async function probarLectura(', '\n}\n');
  assert.ok(prueba.length < 600, `el bloque mide ${prueba.length}`);
  assert.match(prueba, /legible: motivoDePagina\(await extraerLanding\(url, \{ talCual: true \}\)\) === null/);
  assert.match(prueba, /catch \{\s*return \{ ok: true, legible: false \};/, 'un error de bajada = no legible');
  assert.doesNotMatch(prueba, /\.bloqueada|\.texto|getTenantDb|analizar|chatClaude|guardarFallo/, 'ni una copia de la regla, ni base, ni IA');
  // Y es la MISMA función que decide Replicar (ia.ts, el esquema en modo importar).
  assert.match(sinComentarios(leer('lib/editor-landing/ia.ts')), /const motivo = motivoDePagina\(pagina\);/);
});

test('la acción nueva va detrás del corte de rol y de capa de la ruta, y NO en la API de MaKo', () => {
  const ruta = sinComentarios(leer('app/api/landing-generator/diagnostico/route.ts'));
  const post = bloque(ruta, 'export async function POST(req: Request) {', '\n}\n');
  const corte = post.indexOf("if (rol !== 'admin') return falla(403");
  const capa = post.indexOf("if (!tabEnCapa('landing-writer', await getCapaActual())) return falla(404");
  const caso = post.indexOf("case 'probarLectura': return responder(await probarLectura({ url: body.url }));");
  assert.ok(corte > 0 && capa > corte && caso > capa, `corte ${corte}, capa ${capa}, caso ${caso}`);
  assert.doesNotMatch(ruta, /export (async )?function (GET|PUT|PATCH|DELETE)/, 'un solo handler: el POST con el corte');
  const api: string[] = [];
  for (const n of readdirSync(join(RAIZ, 'lib/api-mako/areas'))) if (/probarLectura/.test(leer(`lib/api-mako/areas/${n}`))) api.push(n);
  assert.deepEqual(api, [], 'es un paso de la pantalla, no una capacidad');
});

// =============================================================================
// ROTURAS (15/10/2026). Base en verde: 16 pasan / 0 fallan. Una rotura por vez, con un arnés en el scratchpad que
// guarda el archivo EN MEMORIA, lo rompe, corre ESTE test y lo reescribe desde memoria (sha256 comparado después;
// nunca `git checkout --`). «pasan / fallan» y qué la cazó:
//   R1  pedirConVentana lee en una ventana NUEVA .................. 13 / 3  «enNavegador…», «la prueba que llega TARDE», «sin texto»
//   R2  la prueba rápida no cierra ................................ 15 / 1  «la prueba rápida»
//   R3  la prueba cierra aunque la ventana esté leyendo ........... 15 / 1  «la prueba que llega TARDE»
//   R4  sin el corte de 0 palabras ................................ 15 / 1  «sin texto en el navegador»
//   R5  sin mirar si la pantalla sigue ............................ 15 / 1  «bloqueada, cerrada…, pantalla que se fue»
//   R6  tomar no consume la reserva ............................... 15 / 1  «la reserva: … UNA vez»
//   R7  la reserva no vence ....................................... 15 / 1  «la reserva: vence cerrándola…»
//   R8  tomar devuelve una ventana cerrada ........................ 15 / 1  «la reserva: vence cerrándola…»
//   R9  leerEnNavegador ignora la ventana dada .................... 12 / 4  los tres de pedirConVentana y «leerEnNavegador con la ventana…»
//   R10 la ventana dada y cerrada sale «bloqueadas» ............... 15 / 1  «leerEnNavegador con la ventana del clic»
//   R11 alAccion sin reservar (setDerecha directo) ................ 15 / 1  «…antes de cualquier await: Inicio»
//   R12 la reserva después de un await ............................ 15 / 1  «…antes de cualquier await: Inicio»
//   R13 «Volver a analizar» sin la ventana del clic ............... 15 / 1  «…antes de cualquier await: el Diagnóstico y Replicar»
//   R14 `analizar` abre su propia ventana (corre desde un efecto) . 15 / 1  «ningún camino que corre DESPUÉS de un await…»
//   R15 el montaje del Diagnóstico no toma la reserva ............. 15 / 1  «los arranques automáticos TOMAN…»
//   R16 Replicar automático no toma la reserva .................... 15 / 1  «los arranques automáticos TOMAN…»
//   R17 el formulario de Replicar sin la ventana .................. 15 / 1  «…el Diagnóstico y Replicar»
//   R18 useReplicar nunca pide el navegador ....................... 15 / 1  «con `enNavegador` la pantalla lee…»
//   R19 la prueba con una COPIA de la regla (`.bloqueada`) ........ 15 / 1  «la prueba de lectura usa `motivoDePagina`»
//   R20 un error de bajada = legible .............................. 15 / 1  «la prueba de lectura usa `motivoDePagina`»
//   R21 la ruta sin el corte de rol ............................... 15 / 1  «la acción nueva va detrás del corte…»
//   R22 la prueba nombrada en lib/api-mako/areas/landing.def.ts ... 15 / 1  «…y NO en la API de MaKo»
//   R23 LeerOPegar sin el aviso a la vista ........................ 15 / 1  «con `enNavegador` la pantalla lee…»
//   R24 reservar aunque ya esté analizada ......................... 15 / 1  «urlConVentanaAlAbrir»
//   R25 reservar para la «Página web» ............................. 15 / 1  «urlConVentanaAlAbrir»
//   R26 reservar aunque sea la MISMA pantalla ..................... 15 / 1  «urlConVentanaAlAbrir»
//   R27 Inicio sin pasarle la pantalla de ahora a la regla ........ 15 / 1  «…antes de cualquier await: Inicio»
// Restaurado: 16 / 0.
// =============================================================================

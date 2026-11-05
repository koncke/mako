// =============================================================================
// MaKo toma la iniciativa: las aperturas (29/10/2026, T1 de docs/mako-iniciativa/plan.md)
// =============================================================================
// Martín (29/10): «que MaKo tome la iniciativa… en lugar de botones en la top bar». Lo que se fija:
//   1. CADA SUPERFICIE (lib/aperturas/*.ts, se juntan leyendo la carpeta: no hay lista central) corre sus EJEMPLOS y cada
//      apertura cumple: primer paso con una pregunta de HECHO (`PREGUNTA_DE_ACCION`, salvo la guía, por su id), 160 caracteres,
//      rótulos de 28, corto de 4 palabras, de 2 a 4 botones con uno que avanza y uno que calla, sin voseo; y tiene un llamador
//      en app/ (si no, es código muerto, como `primerMensajeDeEjemplo`);
//   2. la regla de la pregunta de hecho: lo que atrapa y lo que deja pasar;
//   3. la memoria: «Ahora no» 14 días y el segundo para siempre, una vez por día lo de negocio, tres días ignorada 14 días, lo
//      contestado no baja a «vista», y el perfil conserva lo demás, con el workspace en la clave;
//   4. los pasos comunes: la oferta (0, 1, varias; sin la app sin texto libre), el objetivo y lo que falta para pedir;
//   5. la ruta: la fila de la SESIÓN, la clave con el workspace que arma ELLA, compare-and-set;
//   6. el montaje: en el Cerebro, con el hilo vacío en lugar de la portada (también sin la app) y con historia después del
//      último mensaje; la estrella cerrada no monta el motor;
//   7. la pieza dibujada: el mensaje de MaKo, el recomendado marcado, el link de `ir`, «Instalar MaKo» la pieza de la caja;
//   8. las respuestas rápidas del hilo sin la app dicen por qué, y no se tocan (antes no hacían nada y no avisaban).
//
// Correr: node --import tsx --test tests/aperturas.test.ts
// PROBADO ROMPIÉNDOLO (base 8/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as modulo from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PREFIJO_NEGOCIO, PREGUNTA_DE_ACCION, TOPE_TEXTO, anotar, claveApertura, claveValida, memoriaDelNegocio, perfilConApertura, primeraVezDe,
  problemasDeApertura, puedeHablar, respuestasDeMemoria, saludoDe, type Apertura,
} from '../lib/aperturas/reglas';
import { OTRA_COSA, pasoObjetivo, pasoOferta, pasoSinIA, valorDeOferta } from '../lib/aperturas/comunes';
import { marcasDeVoseo } from '../lib/puestas-data';

type Loader = (url: string, ctx: unknown, next: (url: string, ctx: unknown) => unknown) => unknown;
const { registerHooks } = modulo as unknown as { registerHooks: (h: { load: Loader }) => void };
registerHooks({ load: (url, ctx, next) => (/\.css($|\?)/.test(url) ? { format: 'commonjs', source: '', shortCircuit: true } : next(url, ctx)) });

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const DIA = 86_400_000;
const MEDIODIA = Date.parse('2026-10-29T15:00:00');

/** Todo lo que la persona lee de una apertura, para el voseo. */
const textos = (a: Apertura) => [a.texto, a.corto ?? '', ...a.botones.map((b) => b.rotulo)].join(' · ');

/** Todos los archivos del código de la app (para «tiene un llamador»). */
function fuentesDe(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
    const r = `${dir}/${e.name}`;
    if (e.isDirectory()) { if (e.name !== 'node_modules') out.push(...fuentesDe(r)); } else if (/\.tsx?$/.test(e.name)) out.push(r);
  }
  return out;
}

test('1. cada superficie: sus ejemplos dan el paso esperado, y cada apertura cumple las reglas y tiene quien la monte', async () => {
  const archivos = readdirSync(join(RAIZ, 'lib/aperturas')).filter((f) => /\.ts$/.test(f) && !['reglas.ts', 'comunes.ts'].includes(f) && !f.endsWith('-server.ts'));
  assert.ok(archivos.includes('ops.ts'), 'la del Cerebro');
  const app = fuentesDe('app').map((f) => [f, leer(f)] as const);
  for (const f of archivos) {
    const m = await import(pathToFileURL(join(RAIZ, 'lib/aperturas', f)).href) as Record<string, unknown>;
    const sup = Object.entries(m).find(([k]) => k.startsWith('SUPERFICIE_'));
    assert.ok(sup, `${f}: exporta su SUPERFICIE_*`);
    const [nombre, superficie] = sup as [string, { id: string; apertura: (h: unknown, r: Record<string, string>) => Apertura | null }];
    const ejemplos = m.EJEMPLOS as readonly { nombre: string; h: unknown; r: Record<string, string>; espera: string | null; primerPaso?: true }[];
    const catalogo = m.CATALOGO as readonly { id: string }[];
    assert.ok(ejemplos?.length, `${f}: sus EJEMPLOS`);
    const vistos = new Set<string>();
    for (const e of ejemplos) {
      const a = superficie.apertura(e.h, e.r);
      assert.equal(a?.id ?? null, e.espera, `${f} · ${e.nombre}`);
      if (!a) continue;
      vistos.add(a.id);
      // O el de los hechos del negocio, que comparten superficies a propósito (`negocio:plan`: el Plan y la escalera del Ops Center).
      assert.ok(a.id.startsWith(`${superficie.id}:`) || a.id.startsWith(`${PREFIJO_NEGOCIO}:`), `${a.id}: con el prefijo de su superficie (o el del negocio)`);
      assert.deepEqual(problemasDeApertura(a, { primerPaso: !!e.primerPaso }), [], `${a.id}`);
      assert.deepEqual(marcasDeVoseo(textos(a)), [], `${a.id}: voseo`);
      // Con el saludo de la primera vez, también entra.
      assert.ok(`${saludoDe('Anastasia Valentina')} ${a.texto}`.length <= TOPE_TEXTO, `${a.id}: con el saludo pasa de ${TOPE_TEXTO}`);
    }
    // El catálogo dice todo lo que puede salir, y los ejemplos lo recorren entero.
    assert.deepEqual([...vistos].sort(), catalogo.map((c) => c.id).sort(), `${f}: los ejemplos recorren su CATALOGO`);
    // Alguien en app/ la monta.
    assert.ok(app.some(([, src]) => src.includes(nombre)), `${nombre}: nadie en app/ la monta (código muerto)`);
  }
});

test('2. la primera pregunta es de HECHO: lo que atrapa `PREGUNTA_DE_ACCION`, y la excepción de la guía por su id', () => {
  for (const t of ['¿Quieres que lo adapte?', '¿Te ayudo con tu oferta?', '¿Lo adapto a tu oferta?', '¿Cargamos tus clientes?', '¿Conecto tu Meta?', '¿Empezamos?'])
    assert.match(t, PREGUNTA_DE_ACCION, t);
  for (const t of ['¿Cuál usas?', '¿Para cuál de tus ofertas es?', '¿Dónde tienes hoy a tus clientes?', '¿Lo van a ver sin sonido?'])
    assert.doesNotMatch(t, PREGUNTA_DE_ACCION, t);
  const deAccion: Apertura = { id: 'ops:prueba', alcance: 'negocio', texto: '¿Quieres que te ayude a aprender a usar esta pestaña?', botones: [{ tipo: 'respuesta', rotulo: 'Sí', valor: 'si' }, { tipo: 'callar', rotulo: 'Ahora no' }] };
  assert.ok(problemasDeApertura(deAccion, { primerPaso: true }).some((p) => /pregunta una acción/.test(p)));
  assert.deepEqual(problemasDeApertura({ ...deAccion, id: 'guia:mako' }, { primerPaso: true }), [], 'la de la guía es la frase de Martín, a propósito');
  const larga = { ...deAccion, id: 'ops:larga', texto: `${'a'.repeat(160)}?` };
  assert.ok(problemasDeApertura(larga, { primerPaso: false }).some((p) => /caracteres/.test(p)));
  const sinCallar: Apertura = { id: 'ops:x', alcance: 'negocio', texto: '¿Cuál usas?', botones: [{ tipo: 'respuesta', rotulo: 'Claude', valor: 'c' }, { tipo: 'respuesta', rotulo: 'ChatGPT', valor: 'g' }] };
  assert.ok(problemasDeApertura(sinCallar, { primerPaso: true }).includes('falta el botón de callar'));
});

test('3. la memoria: «Ahora no», una vez por día, tres días ignorada, y el perfil con el workspace en la clave', () => {
  // «Ahora no»: 14 días; el segundo, para siempre.
  const n1 = anotar(undefined, 'ahora-no', MEDIODIA);
  assert.equal(n1.d, 'ahora-no');
  assert.equal(puedeHablar(n1, 'negocio', MEDIODIA + 13 * DIA), false);
  assert.equal(puedeHablar(n1, 'negocio', MEDIODIA + 14 * DIA), true);
  assert.equal(anotar(n1, 'ahora-no', MEDIODIA + 15 * DIA).d, 'nunca', 'dos «Ahora no»: nunca');
  // Vista sin respuesta: las de negocio callan hasta mañana; las de una pieza, no.
  const v1 = anotar(undefined, 'vista', MEDIODIA);
  assert.equal(puedeHablar(v1, 'negocio', MEDIODIA + 3_600_000), false, 'ignorada hoy: calla hasta mañana');
  assert.equal(puedeHablar(v1, 'negocio', MEDIODIA + DIA), true);
  assert.equal(puedeHablar(v1, 'entidad', MEDIODIA + 3_600_000), true);
  assert.equal(anotar(v1, 'vista', MEDIODIA + 3_600_000).vistas, 1, 'el mismo día no cuenta dos veces');
  const v3 = anotar(anotar(v1, 'vista', MEDIODIA + DIA), 'vista', MEDIODIA + 2 * DIA);
  assert.equal(v3.vistas, 3);
  assert.equal(puedeHablar(v3, 'negocio', MEDIODIA + 3 * DIA), false, 'tres días ignorada: 14 días');
  assert.equal(puedeHablar(v3, 'negocio', MEDIODIA + 16 * DIA), true);
  // Lo contestado no habla más ni baja a «vista».
  const r = anotar(v1, 'respondida', MEDIODIA, { valor: 'claude' });
  assert.equal(puedeHablar(r, 'negocio', MEDIODIA + 30 * DIA), false);
  assert.deepEqual(anotar(r, 'vista', MEDIODIA + DIA), r);
  assert.deepEqual(respuestasDeMemoria({ 'ops:ia': r, 'copywriter:oferta|pg-1': r, 'ops:otro': v1 }, 'ops'), { 'ops:ia': 'claude' });
  // El perfil: conserva lo demás, la clave lleva el workspace, y la pantalla ve sólo su negocio.
  const perfil = { telefono: '+52 55', recorridos: { 'sb-inicio': '2026-10-20T00:00:00Z' } };
  const p = perfilConApertura(perfil, 3, 'ops:ia', 'respondida', MEDIODIA, { valor: 'claude' });
  assert.equal(p.telefono, '+52 55');
  assert.deepEqual(p.recorridos, perfil.recorridos);
  assert.deepEqual(Object.keys(p.aperturas as object), ['3:ops:ia']);
  assert.equal(memoriaDelNegocio(p, 3)['ops:ia'].valor, 'claude');
  assert.deepEqual(memoriaDelNegocio(p, 13), {}, 'otro negocio no ve el «Claude» de éste');
  assert.equal(primeraVezDe(perfil), true);
  assert.equal(primeraVezDe(p), false);
  // El tope: se olvidan las más viejas, nunca la de ahora.
  let grande: Record<string, unknown> = {};
  for (let i = 0; i < 205; i++) grande = perfilConApertura(grande, 1, claveApertura('ops:ia', `e${i}`), 'vista', MEDIODIA + i * 1000);
  assert.equal(Object.keys(grande.aperturas as object).length, 200);
  assert.ok((grande.aperturas as Record<string, unknown>)['1:ops:ia|e204'], 'la última queda');
  // Una clave del navegador se valida (sin workspace: lo pone la ruta).
  assert.equal(claveValida('ops:ia'), true);
  assert.equal(claveValida('copywriter:oferta|pg-12'), true);
  assert.equal(claveValida('3:ops:ia'), false, 'con workspace no: lo pone la ruta');
  assert.equal(claveValida('ops:ia|<script>'), false);
});

test('4. los pasos comunes: la oferta (0, 1, varias; sin la app sin texto libre), el objetivo y lo que falta para pedir', () => {
  const tres = pasoOferta({ superficie: 'copywriter', ofertas: [{ id: 1, nombre: 'Mentoría 90 días' }, { id: 2, nombre: 'Taller' }, { id: 3, nombre: 'Curso' }, { id: 4, nombre: 'VIP' }], conApp: true });
  assert.equal(tres.texto, '¿Para cuál de tus ofertas es?');
  assert.deepEqual(tres.botones.map((b) => b.rotulo), ['Mentoría 90 días', 'Taller', 'Curso', 'Ahora no'], 'hasta 3 y el de callar');
  const una = pasoOferta({ superficie: 'copywriter', ofertas: [{ id: 7, nombre: 'Mentoría 90 días' }], conApp: true, callar: 'Lo escribo yo' });
  assert.equal(una.texto, '¿Es para «Mentoría 90 días»?');
  assert.deepEqual(una.botones.map((b) => (b.tipo === 'respuesta' ? b.valor : b.rotulo)), [valorDeOferta(7), OTRA_COSA, 'Lo escribo yo']);
  const ninguna = pasoOferta({ superficie: 'copywriter', ofertas: [], conApp: true });
  assert.equal(ninguna.libre, true);
  const sinApp = pasoOferta({ superficie: 'copywriter', ofertas: [], conApp: false });
  assert.equal(sinApp.libre, undefined, 'sin la app la caja no escribe: sin texto libre');
  assert.equal(sinApp.botones[0].tipo, 'ir');
  const larga = pasoOferta({ superficie: 'web', ofertas: [{ id: 1, nombre: 'Programa de acompañamiento para inmobiliarias' }, { id: 2, nombre: 'B' }], conApp: true });
  assert.ok(larga.botones[0].rotulo.length <= 28 && larga.botones[0].rotulo.endsWith('…'));
  const obj = pasoObjetivo({ superficie: 'web', delFunnel: 'whatsapp' })!;
  assert.equal(obj.botones[0].rotulo, 'Escribirte por WhatsApp', 'el de su funnel primero');
  assert.equal(obj.botones.length, 4);
  assert.equal(pasoObjetivo({ superficie: 'web', saltar: true }), null, 'si el funnel lo dice, no se pregunta');
  assert.equal(pasoSinIA({ superficie: 'copywriter', app: 'bloquea', iaConectada: true })!.botones[0].tipo, 'hacer');
  assert.equal(pasoSinIA({ superficie: 'copywriter', app: 'tiene', iaConectada: false })!.id, 'copywriter:sin-ia');
  assert.equal(pasoSinIA({ superficie: 'copywriter', app: 'tiene', iaConectada: true, pendiente: { texto: 'Adapta esta página', para: 'Mentoría' } })!.botones[0].tipo, 'pedir');
  assert.equal(pasoSinIA({ superficie: 'copywriter', app: 'tiene', iaConectada: true }), null);
  for (const a of [tres, una, ninguna, sinApp, larga, obj]) {
    assert.deepEqual(problemasDeApertura(a, { primerPaso: true }), [], a.id);
    assert.deepEqual(marcasDeVoseo(textos(a)), [], a.id);
  }
  for (const a of [pasoSinIA({ superficie: 'x', app: 'bloquea', iaConectada: null })!, pasoSinIA({ superficie: 'x', app: 'tiene', iaConectada: false })!]) {
    assert.deepEqual(problemasDeApertura(a, { primerPaso: false }), [], a.id);
  }
});

test('5. la ruta: la fila de la SESIÓN, la clave con el workspace que arma ella, y compare-and-set', () => {
  const r = sinComentarios(leer('app/api/aperturas/route.ts'));
  assert.match(r, /getUsuarioActual\(\)/);
  assert.match(r, /\.from\('usuarios'\)\.select\('id, perfil, updated_at'\)\.eq\('email', email\)/, 'la fila es la de la sesión, no la del negocio mirado');
  assert.match(r, /if \(!claveValida\(body\.clave\)\)/, 'la clave del navegador se valida (y viene sin workspace)');
  assert.equal((r.match(/perfilConApertura\(fila\.perfil, ws, clave, d, ahora, extra\)/g) ?? []).length, 2, 'el workspace lo pone la ruta, con y sin compare-and-set');
  assert.doesNotMatch(r, /perfilConApertura\(fila\.perfil, (?!ws, )/, 'ninguna escritura sin el workspace');
  assert.match(r, /memoriaDelNegocio\(fila\.perfil, ws\)/, 'la pantalla ve sólo lo de este negocio');
  assert.match(r, /q\.eq\('updated_at', fila\.updated_at\)/, 'compare-and-set: otro escritor del perfil no se pisa');
  assert.match(r, /status: 503/, 'una lectura caída no es «nunca vio nada»');
});

test('6. el montaje: en el Cerebro, en lugar de la portada (también sin la app) y después del último mensaje; nunca guardada', () => {
  const p = sinComentarios(leer('app/second-brain/PiezasCliente.tsx'));
  const hilo = p.slice(p.indexOf('export function HiloDelCliente('), p.indexOf('export function CajaDelCliente('));
  assert.match(hilo, /!k\.items\.length && !k\.trabajo \? \(apertura \?\? \(k\.app === 'bloquea' \? null : \(/, 'vacío: la apertura, también bloqueado');
  assert.match(hilo, /marcas=\{k\.marcas\} \/>\n\s*\{apertura\}\n\s*<\/>/, 'con historia: después del último mensaje');
  const usar = p.slice(p.indexOf('export function useAperturaDelCerebro('), p.indexOf('export function HiloDelCliente('));
  assert.match(usar, /const libre = o\.libre && k\.esJefe && k\.cargado && !k\.errorCarga && !k\.enCurso && !o\.propia && !deLaGuia && !guia\.senalando && !guia\.esperando;/,
    'calla trabajando, fuera del Cerebro, con la de la tab, con la guía hablando o señalando');
  assert.match(usar, /if \(o\.propia\) return o\.propia;\n\s*if \(deLaGuia && guia\.pregunta\) return <AperturaMako estado=\{guia\.pregunta\}/, 'la de la tab, la de la guía, la del Cerebro: en ese orden');
  assert.doesNotMatch(usar, /enviar\(|guardar|POST/, 'la apertura no se guarda en la conversación');
  // El Ops Center del cliente y la estrella la montan; la estrella le pasa la de la tab y calla con preguntas en el bloque.
  assert.match(sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx')), /<HiloDelCliente k=\{k\} apertura=\{apertura\} \/>/);
  const estrella = sinComentarios(leer('app/_chat/MakoEnLaTab.tsx'));
  assert.match(estrella, /const apertura = useAperturaDelCerebro\(k, \{ libre: !\(preguntas && preguntas\.length > 0\), propia: aperturaDeLaTab \}\);/);
  assert.match(estrella, /<HiloDelCliente k=\{k\} apertura=\{apertura\} \/>/);
  // Cerrada: no monta el motor; pide la memoria y la app y la IA, y se abre sola una vez por tab.
  const cerrada = estrella.slice(estrella.indexOf('function useEstrellaCerrada('), estrella.indexOf('export function MakoEnLaTab('));
  assert.doesNotMatch(cerrada, /useChatCliente/, 'cerrada no monta el motor');
  assert.match(cerrada, /void leerAppYIA\(\)\.then/, 'la app y la IA, de la memoria compartida (sin pedidos propios en la estrella)');
  assert.match(sinComentarios(leer('app/_chat/aperturas-memoria.ts')), /const r = await fetch\('\/api\/mako\/chat\?suIA=1'/, 'lo mismo que bloquea la caja');
  assert.match(cerrada, /const abrirSola = habla && !m!\[claveEstrella\(tab\)\];/);
  assert.match(estrella, /anotarApertura\(claveEstrella\(tab\), 'vista'\);\n\s*abrir\(\);/, 'abierta sola, queda anotada: no vuelve a abrirse sola en esa tab');
});

test('7. la pieza dibujada: el mensaje de MaKo, el recomendado marcado, el link de `ir`, y sin el menú de WhatsApp', async () => {
  const { AperturaMako } = await import('../app/_chat/AperturaMako');
  const apertura: Apertura = {
    id: 'ops:prueba', alcance: 'negocio', texto: 'Para escribir por ti uso tu propia IA. ¿Cuál usas?',
    botones: [{ tipo: 'respuesta', rotulo: 'Claude', valor: 'claude' }, { tipo: 'ir', rotulo: 'Ver cómo', href: '/perfil/ia' }, { tipo: 'callar', rotulo: 'Ahora no' }],
  };
  const html = renderToStaticMarkup(createElement(AperturaMako, {
    estado: { apertura, charla: [{ mako: '¿Ya tienes tu oferta?', yo: 'Sí' }], elegir: () => {} },
    quien: { nombre: 'MaKo' }, acciones: {},
  }));
  assert.match(html, /data-apertura="ops:prueba"/);
  assert.match(html, /¿Cuál usas\?/);
  assert.match(html, /¿Ya tienes tu oferta\?[\s\S]*Sí/, 'lo ya contestado queda como charla');
  assert.match(html, /<button type="button" class="of-pill of-pill--mako">Claude<\/button>/, 'el recomendado, marcado');
  assert.match(html, /<a[^>]*class="of-pill"[^>]*href="\/perfil\/ia"|<a[^>]*href="\/perfil\/ia"[^>]*class="of-pill"/, '`ir` es un link');
  assert.match(html, /<button type="button" class="of-pill">Ahora no<\/button>/);
  const src = sinComentarios(leer('app/_chat/AperturaMako.tsx'));
  assert.match(src, /<ContextoWA\.Provider value=\{null\}>/, 'mensajes sin guardar: sin fijar ni reaccionar');
  assert.match(src, /if \(b\.tipo === 'hacer' && b\.accion === 'instalar'\) return <span key=\{b\.rotulo\} className="ch-apertura__pieza"><InstalarMaKo \/><\/span>;/, '«Instalar MaKo» es la pieza de la caja');
  assert.match(src, /<style>\{CSS_OFFER\}<\/style>/, '`.of-pill` sólo existe con la hoja de Offer montada');
});

test('8. las respuestas rápidas del hilo sin la app: dicen por qué y no se tocan', async () => {
  const { BloqueHilo } = await import('../app/_chat/BloqueHilo');
  const b = { t: 'pregunta' as const, pregunta: '¿Cuál prefieres?', opciones: [{ titulo: 'La A' }, { titulo: 'La B' }] };
  const sin = renderToStaticMarkup(createElement(BloqueHilo, { b, onResponder: () => true, sinMandar: 'Para contestar, instala MaKo: el botón está abajo, en la caja.' }));
  assert.match(sin, /class="ch-sin-mandar" role="note">Para contestar, instala MaKo/);
  assert.equal((sin.match(/<button[^>]*class="ch-opcion"[^>]*disabled=""/g) ?? []).length, 2, 'no se tocan');
  const con = renderToStaticMarkup(createElement(BloqueHilo, { b, onResponder: () => true }));
  assert.doesNotMatch(con, /ch-sin-mandar|disabled/);
  assert.match(sinComentarios(leer('app/second-brain/PiezasCliente.tsx')), /sinMandar=\{k\.app === 'bloquea' \? FRASE_RESPONDER : null\}/, 'el Cerebro se lo pasa sin la app');
});

// PROBADO ROMPIÉNDOLO (29/10/2026, base 8/0):
//   · el paso 3 pregunta una acción («¿Quieres que la conecte?»)    → 7/1 (1)
//   · el teléfono recibe el paso de instalar                       → 7/1 (1)
//   · `PREGUNTA_DE_ACCION` sin la primera del plural               → 7/1 (2)
//   · dos «Ahora no» no callan para siempre                         → 7/1 (3)
//   · lo de negocio habla varias veces por día                      → 7/1 (3)
//   · sin la app, la oferta con texto libre                         → 7/1 (4)
//   · la ruta escribe sin el workspace (una de sus dos escrituras)  → 7/1 (5)
//   · con historia, el hilo sin la apertura                         → 7/1 (6)
//   · el recomendado sin marcar                                     → 7/1 (7)
//   · sin la app, las respuestas rápidas se tocan y no dicen nada   → 7/1 (8)

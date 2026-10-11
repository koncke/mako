// =============================================================================
// El recorrido guiado de la tab Automations (décima tanda, GENERAL 8)
// =============================================================================
// Pedido de Martín (11/10/2026): «Haz el tutorial de como utilizar esta tab de "Automations" tal como lo
// tenemos en el tutorial de "CURSO", que sea como un recorrido.» Los pasos y dónde está cada objetivo viven
// en app/automations/recorrido-automations.ts (datos puros + `marcar`), los monta
// app/automations/RecorridoAutomations.tsx con app/_ui/Recorrido.tsx, y ChatAgentApp los enchufa.
//
// ⚠️ UN PASO CUYO OBJETIVO NO SE ENCUENTRA SE SALTEA EN SILENCIO (lib/recorridos.ts). Acá los objetivos no
//    los escribe la pantalla: los pone `marcar` buscando lo que la pantalla YA dibuja (un `data-*`, un
//    `aria-label`, el título de una tarjeta). Por eso el test que más vale es «lo que se busca existe en el
//    fuente del archivo que lo dibuja»: si otra pista renombra `data-nuevo-mensaje`, el recorrido queda más
//    corto y nada lo dice — salvo este test.
//
// ── Roturas (11/10/2026, scratchpad/general8-romper.mjs: una por vez, restaurada de MEMORIA + md5) ──
// Sin romper: 12 pass / 0 fail. Cada rotura tumbó SU test:
//   · `data-nuevo-mensaje` renombrado en lo que se busca           → 11 / 1 «lo que se busca existe en el fuente»
//   · sin el paso del AI Step                                       → 10 / 2 «explica lo que se pidió» y «nada de más»
//   · un paso en voseo («Elegí una…»)                               → 11 / 1 «textos de pantalla»
//   · `marcar` sin el chequeo del escrito a mano                    → 11 / 1 «uno escrito A MANO gana…»
//   · `marcar` deja que un elemento sirva a dos objetivos          → 10 / 2 «…no sirve a dos» y «decide con la foto entera»
//   · ChatAgentApp sin `!galeria` en el autoabrir                   → 11 / 1 «ChatAgentApp lo monta como CURSO»
//   · al cerrar no se llama a `soltar`                              → 11 / 1 «RecorridoAutomations: …suelta al cerrar»

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DONDE, OBJETIVO_AYUDA, PASOS_AUTOMATIONS, RECORRIDO_AUTOMATIONS, marcar, soltar,
  type Buscar, type ElementoMarcable,
} from '../app/automations/recorrido-automations';
import { RECORRIDO_CURSO, RECORRIDO_LECCION } from '../app/customer-success/curso/recorridos-curso';
import { idRecorridoValido } from '../lib/recorridos';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md): un `/*` adentro de un `//` se comería el código.
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const objetivos = () => PASOS_AUTOMATIONS.map((p) => p.objetivo);

// ── Los datos ────────────────────────────────────────────────────────────────

test('la clave es propia y válida, y los objetivos llevan «au-» (el «ayuda» es de CURSO)', () => {
  assert.equal(RECORRIDO_AUTOMATIONS, 'automations', 'la clave de «ya lo vio» no se cambia: quien lo vio lo volvería a ver');
  assert.ok(idRecorridoValido(RECORRIDO_AUTOMATIONS));
  assert.ok(![RECORRIDO_CURSO, RECORRIDO_LECCION].includes(RECORRIDO_AUTOMATIONS));
  for (const o of objetivos()) assert.match(o, /^au-[a-z0-9-]+$/, `«${o}» sin el prefijo de la tab`);
});

test('explica lo que se pidió, en el orden de la pantalla, y termina en el «?»', () => {
  const o = objetivos();
  const pedidos = ['au-lista', 'au-nueva', 'au-mako', 'au-configuraciones', 'au-cron', 'au-mas', 'au-condicion', 'au-delay',
    'au-ai-step', 'au-probar', 'au-publicar', 'au-activar', OBJETIVO_AYUDA];
  for (const x of pedidos) assert.ok(o.includes(x), `al recorrido le falta «${x}»`);
  // La lista (de arriba abajo), el lienzo, «Probar» arriba a la derecha, «Publicar» y «Activar» abajo.
  const i = (x: string) => o.indexOf(x);
  assert.ok(i('au-lista') < i('au-nueva') && i('au-nueva') < i('au-mako') && i('au-mako') < i('au-configuraciones'));
  assert.ok(i('au-configuraciones') < i('au-cron') && i('au-cron') < i('au-mas') && i('au-mas') < i('au-condicion'));
  assert.ok(i('au-ai-step') < i('au-probar') && i('au-probar') < i('au-publicar') && i('au-publicar') < i('au-activar'));
  assert.equal(o.at(-1), OBJETIVO_AYUDA, 'cómo volver a verla es lo que queda al cerrarla');
  // Sin CONDITION, DELAY ni AI Step en el flujo sus pasos se saltean: el del ＋ es el único que dice que existen.
  assert.match(PASOS_AUTOMATIONS.find((p) => p.objetivo === 'au-mas')!.texto, /CONDITION.*DELAY.*AI Step/);
});

test('textos de pantalla: cortos, de TÚ y sin pasos repetidos', () => {
  const o = objetivos();
  assert.equal(new Set(o).size, o.length, 'el recorrido repite un paso');
  for (const p of PASOS_AUTOMATIONS) {
    assert.ok(p.titulo.length <= 28, `título largo: «${p.titulo}»`);
    assert.ok(p.texto.length <= 80, `texto largo (${p.texto.length}): «${p.texto}»`);
    assert.ok((p.texto.match(/[.!?](\s|$)/g) ?? []).length <= 2, `más de dos frases: «${p.texto}»`);
    assert.match(p.texto, /^[A-ZÁÉÍÓÚÑ¿¡]/, `arranca en minúscula: «${p.texto}»`);
    assert.deepEqual(marcasDeVoseo(`${p.titulo} ${p.texto}`), [], `voseo en «${p.titulo}: ${p.texto}»`);
    // `marcasDeVoseo` no ve «hacé», «elegí» ni «probá» (tests/curso-recorridos.test.ts lo midió): un
    // imperativo de TÚ nunca termina en vocal con tilde. Los límites por Unicode: `\b` es ASCII.
    const tildeFinal = [...`${p.titulo} ${p.texto}`.matchAll(/(?<!\p{L})\p{L}*[áéí](?!\p{L})/gu)].map((m) => m[0].toLowerCase())
      .filter((w) => !['aquí', 'ahí', 'allí', 'acá', 'allá', 'está', 'más', 'sí', 'qué', 'también', 'después', 'así', 'aún'].includes(w));
    assert.deepEqual(tildeFinal, [], `voseo en «${p.titulo}: ${p.texto}»`);
  }
});

test('cada paso tiene dónde buscarlo (salvo el «?», que se marca solo), y nada de más', () => {
  const o = objetivos();
  for (const x of o) {
    if (x === OBJETIVO_AYUDA) { assert.ok(!(x in DONDE), 'el «?» lo marca BotonRecorrido, no `marcar`'); continue; }
    assert.ok(DONDE[x]?.length, `«${x}» no tiene dónde buscarse: su paso no saldría nunca`);
    assert.ok(DONDE[x].some((b) => !b.futuro), `«${x}» sólo se busca en algo que todavía no existe`);
  }
  for (const k of Object.keys(DONDE)) assert.ok(o.includes(k), `«${k}» se marca y ningún paso lo señala`);
});

/**
 * Lo que un renglón de `DONDE` le pide al fuente: los `data-*` y las clases por su NOMBRE, y los valores
 * de un `aria-label`/`title`/`data-*` exacto y el `texto` tal cual. Un `^=` (un prefijo armado con una
 * constante) y los atributos de siempre (`aria-pressed`, `title`) no se piden por nombre.
 */
function loQuePide(b: Buscar): string[] {
  const out: string[] = [];
  for (const m of b.css.matchAll(/\[([a-z-]+)(?:(\^?=)"([^"]*)")?\]/g)) {
    if (m[1].startsWith('data-')) out.push(m[1]);
    if (m[2] === '=') out.push(m[3]);
  }
  for (const m of b.css.matchAll(/(?<![\w-])\.([a-z][a-z0-9-]*)/g)) out.push(m[1]);
  if (b.texto != null) out.push(b.texto);
  return out;
}

test('lo que se busca existe en el fuente del archivo que lo dibuja (si no, el paso se saltea en silencio)', () => {
  const faltan: string[] = [];
  for (const [objetivo, formas] of Object.entries(DONDE)) {
    for (const b of formas) {
      if (b.futuro) continue;
      assert.ok(b.vive.length, `«${objetivo}» (${b.css}) no dice dónde vive`);
      const fuentes = b.vive.map((f) => sinComentarios(leer(f)));
      for (const t of loQuePide(b)) if (!fuentes.some((s) => s.includes(t))) faltan.push(`${objetivo}: «${t}» no está en ${b.vive.join(' ni ')}`);
    }
  }
  assert.deepEqual(faltan, []);
});

// ── marcar, con un DOM de mentira ────────────────────────────────────────────
//
// `marcar` sólo usa cinco cosas del DOM (`ElementoMarcable`). El de mentira contesta cada selector con la
// lista de elementos que lo «cumplen» (`css`), en el orden en que se crearon, que hace de orden del DOM.

type Falso = ElementoMarcable & { attrs: Map<string, string>; css: string[]; vis: boolean; texto: string; hijos: Falso[] };
const ATR = 'data-recorrido';
function dom() {
  const todos: Falso[] = [];
  const consulta = (lista: Falso[], css: string): Falso[] => {
    if (css === 'tira') throw new SyntaxError('selector inválido');
    const m = /^\[data-recorrido="(.*)"\]$/.exec(css);
    if (m) return lista.filter((e) => e.attrs.get(ATR) === m[1]);
    return lista.filter((e) => e.css.includes(css));
  };
  const el = (css: string[], o: { vis?: boolean; texto?: string; hijos?: Falso[]; recorrido?: string } = {}): Falso => {
    const e: Falso = {
      attrs: new Map(o.recorrido ? [[ATR, o.recorrido]] : []), css, vis: o.vis ?? true, texto: o.texto ?? '', hijos: o.hijos ?? [],
      getAttribute: (n) => e.attrs.get(n) ?? null,
      setAttribute: (n, v) => { e.attrs.set(n, v); },
      removeAttribute: (n) => { e.attrs.delete(n); },
      getClientRects: () => ({ length: e.vis ? 1 : 0 }),
      get textContent() { return e.texto + e.hijos.map((h) => h.textContent).join(''); },
      querySelectorAll: (css2) => (css2 === '*' ? e.hijos : consulta(e.hijos, css2)),
    };
    todos.push(e);
    return e;
  };
  const raiz = { querySelectorAll: (css: string) => consulta(todos, css) };
  return { el, raiz };
}
const marca = (e: Falso) => e.attrs.get(ATR) ?? null;
const D = (x: Record<string, Buscar[]>) => x;

test('marcar: el primer visible de la primera forma que encuentra; la segunda, sólo si la primera no', () => {
  const { el, raiz } = dom();
  const oculto = el(['a'], { vis: false });
  const uno = el(['a']);
  const otro = el(['a']);
  const respaldo = el(['b']);
  const puestas = new Map<string, ElementoMarcable>();
  marcar(raiz, puestas, D({ 'au-x': [{ css: 'a', vive: [] }, { css: 'b', vive: [] }] }));
  assert.equal(marca(oculto), null, 'uno sin cajas (display:none) no cuenta');
  assert.equal(marca(uno), 'au-x');
  assert.equal(marca(otro), null, 'se marca UNO: el recorrido señala el primero del DOM');
  assert.equal(marca(respaldo), null);
  // Se va el de la primera forma: pasa a la segunda, y la marca vieja se saca.
  uno.vis = false; otro.vis = false;
  marcar(raiz, puestas, D({ 'au-x': [{ css: 'a', vive: [] }, { css: 'b', vive: [] }] }));
  assert.equal(marca(uno), null);
  assert.equal(marca(respaldo), 'au-x');
  // Y si no queda ninguno, no queda ninguna marca (el paso se saltea).
  respaldo.vis = false;
  marcar(raiz, puestas, D({ 'au-x': [{ css: 'a', vive: [] }, { css: 'b', vive: [] }] }));
  assert.equal(marca(respaldo), null);
  assert.equal(puestas.size, 0);
});

test('marcar: `texto` exige el texto EXACTO del candidato o de algo adentro (el título de una tarjeta)', () => {
  const { el, raiz } = dom();
  const mensaje = el(['[data-nodo]'], { hijos: [el([], { texto: 'WHATSAPP' }), el([], { texto: 'Hola, ¿cómo estás?' })] });
  const condicion = el(['[data-nodo]'], { hijos: [el([], { texto: '  CONDITION ' }), el([], { texto: 'Etapa · Agendó' })] });
  const casi = el(['button'], { texto: 'Publicar ahora' });
  const publicar = el(['button'], { texto: 'Publicar' });
  const puestas = new Map<string, ElementoMarcable>();
  marcar(raiz, puestas, D({
    'au-condicion': [{ css: '[data-nodo]', texto: 'CONDITION', vive: [] }],
    'au-publicar': [{ css: 'button', texto: 'Publicar', vive: [] }],
  }));
  assert.equal(marca(mensaje), null);
  assert.equal(marca(condicion), 'au-condicion');
  assert.equal(marca(casi), null, '«Publicar ahora» no es «Publicar»');
  assert.equal(marca(publicar), 'au-publicar');
});

test('marcar: uno escrito A MANO gana, el de otro objetivo no se pisa, y un elemento no sirve a dos', () => {
  const { el, raiz } = dom();
  const aMano = el(['otra-cosa'], { recorrido: 'au-x' });
  const candidato = el(['a']);
  const ajeno = el(['b'], { recorrido: 'marca' });
  const libre = el(['b']);
  const compartido = el(['c']);
  const puestas = new Map<string, ElementoMarcable>();
  marcar(raiz, puestas, D({
    'au-x': [{ css: 'a', vive: [] }],
    'au-y': [{ css: 'b', vive: [] }],
    'au-z': [{ css: 'c', vive: [] }],
    'au-w': [{ css: 'c', vive: [] }],
  }));
  assert.equal(marca(candidato), null, 'con uno a mano a la vista, `marcar` no marca ese objetivo');
  assert.equal(marca(aMano), 'au-x');
  assert.equal(marca(ajeno), 'marca', 'el data-recorrido de CURSO (o de quien sea) no se pisa');
  assert.equal(marca(libre), 'au-y');
  assert.equal(marca(compartido), 'au-z', 'el primero que lo pide se lo queda; el segundo se saltea');
  assert.ok(!puestas.has('au-w'));
  // El escrito a mano se oculta: ahora sí marca el suyo.
  aMano.vis = false;
  marcar(raiz, puestas, D({ 'au-x': [{ css: 'a', vive: [] }] }));
  assert.equal(marca(candidato), 'au-x');
});

test('marcar: un objetivo que se muda no le tapa el lugar al siguiente (decide con la foto entera)', () => {
  const { el, raiz } = dom();
  const x1 = el(['a', 'b']);
  const x2 = el(['a']);
  const puestas = new Map<string, ElementoMarcable>();
  const donde = D({ 'au-b': [{ css: 'b', vive: [] }], 'au-a': [{ css: 'a', vive: [] }] });
  // Primera foto: sólo x1 cumple «a» (x2 todavía no se ve) → x1 es de «au-a»; «au-b» no encuentra.
  x2.vis = false;
  marcar(raiz, puestas, D({ 'au-a': [{ css: 'a', vive: [] }] }));
  assert.equal(marca(x1), 'au-a');
  // Segunda: aparece x2. «au-b» (que va primero) quiere a x1, que era NUESTRO para «au-a»: se lo lleva,
  // y «au-a» se muda a x2 en la MISMA corrida.
  x2.vis = true;
  marcar(raiz, puestas, donde);
  assert.equal(marca(x1), 'au-b');
  assert.equal(marca(x2), 'au-a');
});

test('soltar saca sólo lo suyo, y un selector que el navegador no entiende no rompe nada', () => {
  const { el, raiz } = dom();
  const a = el(['a']);
  const b = el(['b']);
  const puestas = new Map<string, ElementoMarcable>();
  marcar(raiz, puestas, D({ 'au-a': [{ css: 'tira', vive: [] }, { css: 'a', vive: [] }], 'au-b': [{ css: 'b', vive: [] }] }));
  assert.equal(marca(a), 'au-a', 'la forma que tira se saltea y sigue la siguiente');
  b.setAttribute(ATR, 'otra'); // alguien la cambió en el medio
  soltar(puestas);
  assert.equal(marca(a), null);
  assert.equal(marca(b), 'otra', 'una marca que ya no es la nuestra no se saca');
  assert.equal(puestas.size, 0);
});

// ── El montaje ───────────────────────────────────────────────────────────────

test('ChatAgentApp lo monta como CURSO: el gancho antes de los return, el «?» en los dos lugares y la capa en el <main>', () => {
  const app = sinComentarios(leer('app/automations/ChatAgentApp.tsx'));
  assert.match(app, /import \{ AyudaAutomations, RecorridoAutomations, useRecorridoAutomations \} from '\.\/RecorridoAutomations';/);
  const gancho = app.indexOf('const recorrido = useRecorridoAutomations(rolAdmin && enOnboarding === false && visibles !== null && visibles.length > 0 && creando === null && !galeria);');
  // Solo, a quien arma (un admin, como `puedeEditar` en CURSO) y con la pantalla llena: ni el cartel vacío
  // («Todos arrancan vacíos»: quedaría VISTO con tres pasos), ni la galería encima, ni mientras se crea una.
  assert.ok(gancho > 0, 'el autoabrir cambió: ¿a quién y cuándo se abre solo?');
  const primerReturn = app.indexOf('if (enOnboarding === null) {');
  assert.ok(primerReturn > 0 && gancho < primerReturn, 'el gancho va ANTES de los return (AGENTS.md: ningún hook detrás de un return)');
  // El «?»: en el renglón de la lista (al lado del horario) y en el cartel vacío.
  assert.equal((app.match(/<AyudaAutomations onClick=\{recorrido\.reabrir\} \/>/g) ?? []).length, 2);
  const horario = app.slice(app.indexOf('horario={('), app.indexOf('</span>', app.indexOf('horario={(')));
  // (Desde la décima tanda, GENERAL 4, al lado de «Configuraciones», que reemplazó al botón del horario.)
  assert.match(horario, /<ConfiguracionesBoton \/>\s*<AyudaAutomations onClick=\{recorrido\.reabrir\} \/>/);
  const vacio = app.slice(app.indexOf('Todavía no hay automatizaciones.'), app.indexOf('{errCrear && <span role="alert"'));
  assert.match(vacio, /<AyudaAutomations onClick=\{recorrido\.reabrir\} \/>/);
  // La capa, una vez y adentro del <main> de la pantalla llena (no en el del QR ni en el del cargando).
  const llena = app.slice(app.indexOf("<main style={{ flex: 1, minWidth: 0, height: '100vh'"));
  assert.equal((app.match(/<RecorridoAutomations /g) ?? []).length, 1);
  assert.match(llena, /<RecorridoAutomations abierto=\{recorrido\.abierto\} onCerrar=\{recorrido\.onCerrar\} \/>\s*<\/main>/);
});

test('RecorridoAutomations: marca sólo mientras está abierto, busca en su <main> y suelta al cerrar', () => {
  const src = sinComentarios(leer('app/automations/RecorridoAutomations.tsx'));
  assert.match(src, /return useRecorrido\(RECORRIDO_AUTOMATIONS, \{ autoabrir \}\);/);
  assert.match(src, /<BotonRecorrido objetivo=\{OBJETIVO_AYUDA\}/, 'sin `objetivo`, el último paso no tiene a qué señalar');
  assert.match(src, /useLayoutEffect\(\(\) => \{\s*if \(!abierto\) return;/);
  assert.match(src, /ancla\.current\?\.closest\('main'\)/);
  // Sólo `childList`: las marcas son atributos, y mirándolos se observaría a sí mismo.
  assert.match(src, /mo\.observe\(raiz, \{ childList: true, subtree: true \}\);/);
  assert.match(src, /return \(\) => \{ mo\.disconnect\(\); if \(cuadro\) cancelAnimationFrame\(cuadro\); soltar\(puestas\); \};/);
  assert.match(src, /\}, \[abierto\]\);/);
  assert.match(src, /<Recorrido id=\{RECORRIDO_AUTOMATIONS\} pasos=\{PASOS_AUTOMATIONS\} abierto=\{abierto\} onCerrar=\{onCerrar\} \/>/);
});

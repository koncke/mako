// =============================================================================
// Refrescar tirando hacia abajo, en TODAS las pantallas de MaKo Mobile (15/10/2026)
// =============================================================================
// Martín: «En el centro y otras tabs no está la funcionalidad de refrescar, eso debe estar presente
// en tooodos lados en mobile». El gesto vive en PantallaM y era OPT-IN (`refrescable`): lo tenían las
// pantallas que existían el día que se escribió, y el Centro de Operaciones nació sin él. Ahora
// viene prendido, y este test es lo que impide que la próxima pantalla vuelva a nacer sin él:
//   · toda página de app/m dibuja adentro de <PantallaM>, salvo las de EXCEPCIONES (con su motivo);
//   · `refrescable={false}` sólo en las de APAGADO (con su motivo);
//   · y refrescar trae lo nuevo también en el mazo de la Ticketera, que guarda la cola en estado.
// Probado rompiéndolo: el default de PantallaM en `false`, 1 fallo; el Centro sin PantallaM (un
// `return <>…</>`), 1 fallo; un `refrescable={false}` sin anotar en la ficha de un lead, 1 fallo;
// `nuevasParaElMazo` devolviendo todas, 1 fallo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { nuevasParaElMazo } from '../app/tickets/decisiones/reglas';
import type { Decision } from '../app/admin/runway/decisiones';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas de comentario PRIMERO y los bloques después (un `/*` en un `//` se comería código). */
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/** Las páginas que NO dibujan PantallaM, y por qué. */
const EXCEPCIONES: Record<string, string> = {
  'app/m/page.tsx': 'sólo redirige al inicio: no dibuja nada',
  'app/m/mako/page.tsx': 'el chat de MaKo: tirar hacia abajo es ver mensajes viejos, no refrescar',
};
/** Las que montan PantallaM con `refrescable={false}`, y por qué. Hoy ninguna. */
const APAGADO: Record<string, string> = {};

function paginas(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
    const r = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...paginas(r));
    else if (e.name === 'page.tsx') out.push(r);
  }
  return out.sort();
}
const PAGINAS = paginas('app/m');

/** El cuerpo de una función de primer nivel del archivo: hasta la primera línea que es SÓLO `}`
 *  (una firma en varias líneas cierra su tipo con `}) {` en la columna 0, y eso no es el final). */
function bloqueDe(src: string, cabeza: RegExp): string | null {
  const m = cabeza.exec(src);
  if (!m) return null;
  const fin = /\n\}[ \t]*(?:\n|$)/.exec(src.slice(m.index));
  return src.slice(m.index, fin ? m.index + fin.index : undefined);
}

/**
 * Lo que DEVUELVE la página: la etiqueta con la que arranca cada `return` de JSX de su función
 * («PantallaM», «» para un fragmento). Sólo los returns de la función misma —los de un `.map` o de
 * un componente auxiliar van más adentro (más de 6 espacios)— y, si devuelve un componente del MISMO
 * archivo (`<GeneralPagina>` en Today), los de ése. Un componente de afuera cuenta como suelto.
 */
function retornosDePagina(src: string, cabeza: RegExp = /export default (?:async )?function \w+\s*\(/, prof = 0): string[] {
  const cuerpo = bloqueDe(src, cabeza);
  if (cuerpo == null || prof > 3) return [];
  const out: string[] = [];
  for (const m of cuerpo.matchAll(/\n( *)[^\n]*?\breturn\s*\(?\s*<([A-Za-z.]*)/g)) {
    if (m[1].length > 6) continue;
    const tag = m[2];
    const local = /^[A-Z]\w*$/.test(tag) && tag !== 'PantallaM' && new RegExp(`\\n(?:async )?function ${tag}\\s*\\(`).test(src);
    out.push(...(local ? retornosDePagina(src, new RegExp(`\\n(?:async )?function ${tag}\\s*\\(`), prof + 1) : [tag]));
  }
  return out;
}
const retornosJsx = (src: string) => retornosDePagina(src);

test('PantallaM trae el refresco PRENDIDO por defecto', () => {
  assert.match(sinComentarios(leer('app/m/_ui/PantallaM.tsx')), /export function PantallaM\(\{\s*refrescable = true\b/);
});

test('toda página de /m dibuja adentro de PantallaM (salvo las anotadas, con su motivo)', () => {
  assert.ok(PAGINAS.length >= 20, `encontré ${PAGINAS.length} páginas: el recorrido se rompió`);
  const malas: string[] = [];
  for (const p of PAGINAS) {
    if (p in EXCEPCIONES) continue;
    const src = sinComentarios(leer(p));
    const rs = retornosJsx(src);
    if (!rs.length) { malas.push(`${p}: no devuelve JSX (si sólo redirige, va en EXCEPCIONES con su motivo)`); continue; }
    const sueltos = rs.filter((t) => t !== 'PantallaM');
    if (sueltos.length) malas.push(`${p}: ${sueltos.length} return sin PantallaM (${sueltos.map((t) => `<${t}>`).join(', ')})`);
  }
  assert.deepEqual(malas, [], 'Una pantalla de /m sin PantallaM no se puede refrescar tirando hacia abajo');
});

test('`refrescable={false}` sólo donde tirar hacia abajo es OTRA cosa, y anotado', () => {
  const sinAnotar = PAGINAS.filter((p) => /refrescable=\{false\}/.test(sinComentarios(leer(p))) && !(p in APAGADO));
  assert.deepEqual(sinAnotar, []);
  // Y los componentes de /m tampoco lo apagan por su cuenta (lo decide la página, a la vista).
  const componentes = readdirSync(join(RAIZ, 'app/m'), { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.tsx') && !f.endsWith('page.tsx'))
    .filter((f) => /refrescable=\{false\}/.test(sinComentarios(leer(`app/m/${f.replace(/\\/g, '/')}`))));
  assert.deepEqual(componentes, []);
});

test('las excepciones siguen existiendo y siguen siendo excepciones (una vieja es un permiso de más)', () => {
  for (const [p, motivo] of Object.entries({ ...EXCEPCIONES, ...APAGADO })) {
    assert.ok(motivo.length > 20, `${p}: el motivo tiene que decir POR QUÉ`);
    assert.ok(existsSync(join(RAIZ, p)), `${p} ya no existe: sacala de la lista`);
  }
  for (const p of Object.keys(EXCEPCIONES)) {
    const rs = retornosJsx(sinComentarios(leer(p)));
    assert.ok(!rs.includes('PantallaM') || /refrescable=\{false\}/.test(leer(p)), `${p} ya monta PantallaM con refresco: sacala de EXCEPCIONES`);
  }
  for (const p of Object.keys(APAGADO)) assert.match(leer(p), /refrescable=\{false\}/, `${p} ya no lo apaga: sacala de APAGADO`);
  assert.ok(PAGINAS.length === new Set(PAGINAS.map((p) => relative(RAIZ, join(RAIZ, p)))).size);
});

// ── Refrescar tiene que TRAER lo nuevo: el mazo guarda su cola en estado ──────
let n = 0;
function dec(p: Partial<Decision> = {}): Decision {
  n += 1;
  return {
    id: n, ref: `d-${n}`, chat: 'Chat', pregunta: `¿Pregunta ${n}?`,
    opciones: [{ clave: 'A', texto: 'Sí' }, { clave: 'B', texto: 'No' }],
    destraba: null, contexto: null, recomendada: null, urgencia: 'criterio', href: null, orden: 100,
    respuesta: null, respuestaTexto: null, respondidaAt: null, recogidaAt: null, creadaAt: '2026-10-14T16:00:00Z',
    ...p,
  };
}

test('el mazo suma al final lo que llegó nuevo, y lo que ya pasó por él no vuelve', () => {
  const a = dec(), b = dec(), c = dec();
  const vistas = new Set([a.id, b.id]);
  // Llegó una nueva (c); `a` sigue pendiente en el server (está en «después»): no se repite.
  assert.deepEqual(nuevasParaElMazo([a, b, c], vistas).map((d) => d.id), [c.id]);
  // Una contestada no entra aunque nunca se haya visto.
  const contestada = dec({ respuesta: 'A', respondidaAt: '2026-10-15T09:00:00Z' });
  assert.deepEqual(nuevasParaElMazo([a, contestada], vistas), []);
  // Y el mazo la usa con las props nuevas, sin rearmar la cola.
  const mazo = sinComentarios(leer('app/tickets/decisiones/Mazo.tsx'));
  assert.match(mazo, /nuevasParaElMazo\(decisiones, ya\)/);
  assert.match(mazo, /setCola\(\(c\) => \[\.\.\.c, \.\.\.nuevas\]\)/);
  assert.match(mazo, /\}, \[decisiones\]\);/);
});

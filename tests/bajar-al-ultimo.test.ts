// El chat SIEMPRE baja al último mensaje (20/11/2026; Martín: «siempre se haga scroll automático hacia el último mensaje para que el
// usuario sepa dónde están las cosas»). El núcleo de app/_chat/useBajarAlUltimo.ts, con un hilo de mentira y un ResizeObserver de
// mentira: el video que termina de cargar DESPUÉS de montarse el mensaje, la imagen lenta, y la persona que subió a leer.
// Y quién lo usa: el onboarding, los coaches (computadora y teléfono) y el chat «Onboarding» del Ops Center.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bajarAlCrecer, seguirAlUltimo, CERCA_DE_ABAJO_PX } from '../app/_chat/useBajarAlUltimo';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/** Un hilo que escrolea: `contenido` es lo que mide lo de adentro, `vista` lo que se ve. El navegador recorta el scroll. */
function hiloFalso(contenido: number, vista = 600) {
  const alto = { contenido };
  const oyentes = new Set<() => void>();
  let top = 0;
  const h = {
    get scrollTop() { return top; },
    set scrollTop(v: number) { top = Math.max(0, Math.min(v, alto.contenido - vista)); },
    get scrollHeight() { return alto.contenido; },
    get clientHeight() { return vista; },
    children: [{}],
    addEventListener: (_t: 'scroll', f: () => void) => { oyentes.add(f); },
    removeEventListener: (_t: 'scroll', f: () => void) => { oyentes.delete(f); },
    /** La persona mueve el hilo. */
    mover(v: number) { h.scrollTop = v; for (const f of oyentes) f(); },
    /** Lo de adentro cambia de alto (un video que cargó): el navegador no avisa con un scroll, avisa el ResizeObserver. */
    crecer(n: number) { alto.contenido = n; if (top > n - vista) h.scrollTop = top; RO.ultimo?.disparar(); },
    abajo: () => alto.contenido - vista,
  };
  return h;
}
class RO {
  static ultimo: RO | null = null;
  constructor(private cb: () => void) { RO.ultimo = this; }
  observe() {}
  disconnect() {}
  disparar() { this.cb(); }
}

test('1. el video que termina de cargar DESPUÉS de montarse su mensaje: el chat baja con él', () => {
  const h = hiloFalso(1000);
  const s = seguirAlUltimo(h, { Observador: RO });
  s.bajar(); // el mensaje nuevo
  assert.equal(h.scrollTop, h.abajo());
  // La portada y los metadatos llegan después: el mensaje crece 300 px con el chat quieto.
  h.crecer(1300);
  assert.equal(h.scrollTop, h.abajo(), 'baja hasta el final del video');
  // Una imagen lenta, igual.
  h.crecer(1500);
  assert.equal(h.scrollTop, h.abajo());
  s.soltar();
});

test('2. la persona que SUBIÓ a leer: lo que crece no la arrastra; un mensaje NUEVO sí la baja', () => {
  const h = hiloFalso(1000);
  const s = seguirAlUltimo(h, { Observador: RO });
  s.bajar();
  h.mover(100); // sube a leer
  assert.equal(s.pegado(), false);
  h.crecer(1600); // el video de abajo termina de cargar
  assert.equal(h.scrollTop, 100, 'se queda donde está leyendo');
  s.bajar(); // llega un mensaje nuevo
  assert.equal(h.scrollTop, h.abajo(), 'el mensaje nuevo la baja');
  h.crecer(1900);
  assert.equal(h.scrollTop, h.abajo(), 'y ya abajo, lo que crece la sigue bajando');
  s.soltar();
});

test('3. cerca del final sigue pegada (mira el último con un poco de aire), y volver abajo la vuelve a pegar', () => {
  const h = hiloFalso(1000);
  const s = seguirAlUltimo(h, { Observador: RO });
  s.bajar();
  h.mover(h.abajo() - (CERCA_DE_ABAJO_PX - 10));
  assert.equal(s.pegado(), true);
  h.crecer(1200);
  assert.equal(h.scrollTop, h.abajo());
  h.mover(50);
  assert.equal(s.pegado(), false);
  h.mover(h.abajo());
  assert.equal(s.pegado(), true, 'bajó sola hasta el final');
  s.soltar();
});

test('4. el chat que abre ARRIBA (el chat nuevo del Ops Center, con su portada) no baja; y sin ResizeObserver no se rompe', () => {
  const h = hiloFalso(1000);
  const s = seguirAlUltimo(h, { arriba: () => true, Observador: RO });
  s.bajar();
  assert.equal(h.scrollTop, 0);
  h.crecer(1400);
  assert.equal(h.scrollTop, 0);
  s.soltar();
  const h2 = hiloFalso(1000);
  const s2 = seguirAlUltimo(h2, { Observador: null });
  s2.bajar();
  assert.equal(h2.scrollTop, h2.abajo());
  s2.soltar();
});

test('5. lo usan el onboarding, los coaches (computadora y teléfono) y el chat «Onboarding» del Ops Center; su llegada avisa cada mensaje', () => {
  const v2 = sinComentarios(leer('app/onboarding/ChatArranqueV2.tsx'));
  // Por la CLAVE de la última fila dibujada, nunca por una cuenta (la auditoría, onboarding-1: al contestar entraban dos mensajes y se
  // iban los puntitos y lo pendiente en el mismo render, y la cuenta no cambiaba), y sin animación (onboarding-7).
  assert.match(v2, /const ultimaFila = cola\.visibles\[cola\.visibles\.length - 1\];/);
  assert.match(v2, /useBajarAlUltimo\(seguirHilo, `\$\{fase\}\|\$\{ultimaFila\?\.id \?\? ''\}\|\$\{ultimaFila && cola\.conPieza\(ultimaFila\.id\) \? 'pieza' : ''\}\|\$\{pendiente \?\? ''\}\|\$\{escribe \? 'escribe' : ''\}`\);/);
  assert.doesNotMatch(v2, /const cuantos =|scrollTo\(\{ top: h\.scrollHeight|suave: true/, 'sin la cuenta, sin el scroll de una vez, sin animación');
  // Los chats que dibujan su hilo en PanelDeChat le pasan la clave de su ÚLTIMA fila y el panel baja (PanelChat.tsx → `seguir`).
  const coach = sinComentarios(leer('app/second-brain/ChatDelCoach.tsx'));
  assert.match(coach, /const ultimaFila = `\$\{hiloCoach\.items\[hiloCoach\.items\.length - 1\]\?\.id \?\? ''\}\|/);
  assert.match(coach, /<PanelDeChat hilo=\{hilo\} adjuntos=\{k\.adjuntosCaja\} seguir=\{\{ clave: ultimaFila \}\}/);
  const hoja = sinComentarios(leer('app/m/second-brain/HojaDelCoach.tsx'));
  assert.match(hoja, /useBajarAlUltimo\(seguirHoja, `\$\{hiloCoach\.items\[hiloCoach\.items\.length - 1\]\?\.id \?\? ''\}\|/);
  assert.doesNotMatch(hoja, /el\.scrollTop = el\.scrollHeight|k\.items\.length\}\|/);
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(sb, /const ultimaFila = `\$\{k\.items\[k\.items\.length - 1\]\?\.id \?\? ''\}\|/);
  assert.match(sb, /seguir=\{\{ clave: ultimaFila, arriba: enChatNuevo && !k\.items\.length \}\}/);
  assert.doesNotMatch(sb, /el\.scrollTop = enChatNuevo|useBajarAlUltimo\(/);
  const panel = sinComentarios(leer('app/admin/operaciones/PanelChat.tsx'));
  assert.match(panel, /const contenedor = useCallback\(\(\) => \(sigue \? hilo\.current : null\), \[hilo, sigue\]\);\n\s*useBajarAlUltimo\(contenedor, seguir\?\.clave \?\? '', \{ arriba: !!seguir\?\.arriba \}\);/);
  // La llegada (ops-center-1: sus filas viven fuera de la lista del chat) avisa cada fila nueva; desde el 20/11 vive en el chat del reto.
  const b = sinComentarios(leer('app/second-brain/LlegadaAlReto.tsx'));
  assert.match(b, /useEffect\(\(\) => \{ if \(fase !== 'espera'\) avisarMensajeNuevo\(\); \}, \[fase\]\);/);
  // El hilo y sus hijos, con ResizeObserver: lo que crece adentro (un video, una imagen, una tarjeta) lo avisa.
  const hk = sinComentarios(leer('app/_chat/useBajarAlUltimo.ts'));
  assert.match(hk, /ro\.observe\(el as never\);\n\s*for \(const c of Array\.from\(el\.children\)\) ro\.observe\(c as never\);/);
});

test('6. UN solo mecanismo para lo que crece: el chat de los grupos lo usa con su propia regla de «abajo»', () => {
  // El grupo decide por su cuenta cuándo está abajo (lo nuevo de otros no la baja si está leyendo: cuenta cuántos llegaron).
  const h = hiloFalso(1000);
  let abajo = true;
  const c = bajarAlCrecer(h, () => abajo, RO);
  h.scrollTop = h.abajo();
  h.crecer(1300);
  assert.equal(h.scrollTop, h.abajo(), 'la foto que cargó después: sigue abajo');
  abajo = false;
  h.mover(200);
  h.crecer(1600);
  assert.equal(h.scrollTop, 200, 'leyendo arriba: no la mueve');
  c.soltar();
  const g = sinComentarios(leer('app/_chat/grupo/useSeguirElHilo.ts'));
  assert.match(g, /import \{ bajarAlCrecer \} from '@\/app\/_chat\/useBajarAlUltimo';/);
  assert.match(g, /if \(el\) \{ crece = bajarAlCrecer\(el, \(\) => estabaAbajo\.current\); mirarHijos\.current = crece\.mirarHijos; \}/);
  const n = sinComentarios(leer('app/_chat/useBajarAlUltimo.ts'));
  assert.match(n, /const crece = bajarAlCrecer\(el, \(\) => pegado && !arriba\(\), o\.Observador, /, 'el de los demás chats, el mismo');
  assert.equal((n.match(/new Clase\(/g) ?? []).length, 1, 'un solo ResizeObserver en el código');
});

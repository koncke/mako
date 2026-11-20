// =============================================================================
// EL TUTORIAL SIN LA PRESENTACIÓN, EL VIDEO DEL COSTADO A SU MEDIDA Y LA BARRA OCULTA AL ENTRAR (19/11/2026)
// =============================================================================
// Martín, probando el onboarding V2 en producción (/second-brain?ws=3, al tocar «Entrar a MaKo»):
//   · «sigue apareciendo el botón de cómo funciona… elimínalo, no lo quiero ver nunca más en ningún lugar de ninguna tab… muy, muy,
//     muy molesto» → el cuadro de la presentación («Cómo funciona X», «Omitir recorrido», «Empezar») no existe más: todo tutorial
//     arranca solo, y para saltearlo se cierra el video del costado;
//   · «fíjate lo horrible que se ve el video, como si fuera una columna larguísima» → el video era un <aside>, y la regla global
//     `[data-barra-agencia] aside` (app/globals.css, la de la barra del super admin) le daba el alto de la pantalla entera;
//   · «apenas entro y sale la barra lateral, que habíamos quedado que justamente al principio estaba oculta» → «Entrar a MaKo» la
//     esconde y el recorrido la muestra en su paso «Tu panel» (app/_ui/tutorial/barra-oculta.ts).
// Probado rompiéndolo (19/11/2026, una rotura por vez y restaurada): con «Cómo funciona» de vuelta cae el 1; con el <aside>, el 2;
// sin el esconderLaBarra() de «Entrar a MaKo», el 3.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { presentaLaBarra } from '../app/_ui/tutorial/barra-oculta';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
function archivos(dir: string, fuera: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== 'node_modules') archivos(p, fuera); } else if (/\.tsx?$/.test(n)) fuera.push(p);
  }
  return fuera;
}

test('1. el tutorial no tiene presentación: ni «Cómo funciona», ni «Empezar», ni el velo sin paso; arranca solo', () => {
  const m = sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx'));
  assert.doesNotMatch(m, /Cómo funciona/, 'el título de la presentación');
  assert.doesNotMatch(m, /'Empezar'/, 'el botón de la presentación');
  assert.match(m, /const visible = !!t && !!paso && !!geo\.hueco;/, 'sin paso, ninguna tarjeta');
  assert.doesNotMatch(m, /<div className="mk-rec__velo"/, 'sin el velo entero de la presentación');
  // Arranca solo: con frases, el video manda apenas está; sin ellas, el primer paso.
  assert.match(m, /useEffect\(\(\) => \{ if \(conFrases && !modoVideo && i === -1 && vidRef\.current\) siguiente\(\); \}/);
  assert.match(m, /if \(i !== -1 \|\| conFrases \|\| modoVideo\) return;\n\s*const t = window\.setTimeout\(\(\) => \{ setEl\(null\); setGeo\(\{ hueco: null, tarjeta: null \}\); setI\(0\); \}, ESPERA_VIDEO_MS\);/);
  // Para saltearlo, se cierra el video del costado.
  assert.match(m, /onCerrar=\{\(\) => fin\('omitido'\)\} onOmitir=\{\(\) => fin\('omitido'\)\}/);
  // Y en ningún otro lado de la app un tutorial dice «Cómo funciona …» armado con su nombre.
  const otros = archivos(join(RAIZ, 'app')).filter((f) => /Cómo funciona \$\{/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(otros, []);
});

test('2. el video del costado mide lo que el video: no es un <aside> (la regla de la barra del super admin los estira)', () => {
  const globales = leer('app/globals.css');
  assert.match(globales, /\[data-barra-agencia\] aside, \[data-alerta-voz\] aside\[data-sidebar\] \{\n\s*top: var\(--barra-agencia\) !important;\n\s*height: calc\(100vh - var\(--barra-agencia\)\) !important;/,
    'la regla que estira todo <aside> con la barra del super admin (si cambia, este test se revisa)');
  const m = sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx'));
  assert.doesNotMatch(m, /<aside[^>]*mk-tuto__video/, 'el video del costado y el flotante');
  assert.equal((m.match(/<div role="complementary" className="mk-tuto__video"/g) ?? []).length, 1, 'el del costado');
  // El flotante es el reproductor de la maqueta desde la verificación de F2 (app/_ui/tutorial/VideoEnLaEsquina.tsx): tampoco <aside>.
  const p = sinComentarios(leer('app/_ui/tutorial/VideoEnLaEsquina.tsx'));
  assert.doesNotMatch(p, /<aside/);
  assert.match(p, /<div className="mk-pip"[^>]* role="complementary"/);
});

test('3. la barra lateral, oculta desde «Entrar a MaKo» hasta el paso que la presenta', () => {
  assert.equal(presentaLaBarra('aside[data-sidebar]'), true);
  assert.equal(presentaLaBarra('[data-recorrido="sb-second-brain"]'), false);
  assert.match(leer('app/_ui/ui.css'), /html\[data-barra-oculta\] aside\[data-sidebar\] \{ display: none !important; \}/);
  const v2 = sinComentarios(leer('app/onboarding/ChatArranqueV2.tsx'));
  // (20/11, OD-13: entre las dos, la pausa de los videos del onboarding y el cierre del que ya flotaba en la esquina, para que no pasen
  // flotando al Ops Center.)
  assert.match(v2, /setSaliendo\(true\);\n\s*for \(const v of Array\.from\(document\.querySelectorAll<HTMLVideoElement>\('\.arr-v2 video'\)\)\) v\.pause\(\);\n\s*const flotando = senalAhora\(\);\n\s*if \(flotando\?\.tipo === 'video'\) soltarSenal\(flotando\.id\);\n\s*esconderLaBarra\(\);\n\s*router\.push\(RUTA_AL_RETO\);/, '«Entrar a MaKo» la esconde (y abre el chat del reto)');
  const m = sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx'));
  assert.match(m, /if \(presentaLaBarra\(paso\.sel\)\) mostrarLaBarra\(\);/, 'el paso «Tu panel» la muestra');
  assert.match(m, /const paso = pasoDeFrase\(f, pasos\);\n[^\n]*\n\s*if \(presentaLaBarra\(paso\.sel\)\) mostrarLaBarra\(\);\n\s*if \(lugarDe\(paso\.sel\)\)/, 'y la frase del video que la presenta, antes de buscarla');
  // Al terminar vuelve, salvo la marca «dale play» (20/11, la verificación de OD-03: su play arranca el recorrido).
  assert.match(m, /const fin = useCallback\(\(como: 'fin' \| 'omitido' \| 'hecho'\) => \{ if \(!invita\) mostrarLaBarra\(\); terminar\(senal\.id, como\); \}/, 'al terminar vuelve');
  // Nunca queda escondida sin salida; mientras el chat presenta el recorrido, su play sigue ahí.
  assert.match(m, /window\.setTimeout\(\(\) => \{ if \(!elChatPresentaElRecorrido\(\)\) mostrarLaBarra\(\); \}, ESPERA_BARRA_MS\)/);
  // El recorrido presenta la barra (su paso «Tu panel»).
  assert.match(leer('lib/onboarding-v2/recorrido.ts'), /\{ sel: 'aside\[data-sidebar\]', titulo: 'Tu panel'/);
});

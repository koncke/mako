// Lo que Martín vio entrando a MaKo en producción como administrador de Lalaland (ws 3), 20/11/2026 (memoria onboarding-16-11-decisiones,
// «20/11, ~13:00 UTC»): «Entrar a MaKo» abre el chat del reto, y la llegada es su primer mensaje; la vista como administrador muestra lo
// mismo que ve el cliente (la barra oculta, lo visto); los puntitos de MaKo en un grupo se ven; y en la cabecera de los coaches los
// videos van a la derecha, como en la maqueta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. «Entrar a MaKo» abre el Ops Center con el chat «Reto de 7 días» ya elegido (la misma ruta que manda el reto)', async () => {
  const { RUTA_AL_RETO } = await import('../lib/onboarding-arranque');
  const avisos = leer('lib/reto/avisos.ts');
  assert.match(avisos, new RegExp(`export const RUTA_RETO = '${RUTA_AL_RETO.replace(/[?]/g, '\\?')}';`), 'la misma ruta');
  const v2 = sinComentarios(leer('app/onboarding/ChatArranqueV2.tsx'));
  assert.match(v2, /esconderLaBarra\(\);\n\s*router\.push\(RUTA_AL_RETO\);/);
  assert.doesNotMatch(v2, /rutaDelHilo/, 'ya no al chat «Onboarding»');
  // ChatSecondBrain abre el reto con `?reto=1`.
  assert.match(sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx')), /const \[reto, setReto\] = useState\(retoV2 && retoInicial\);/);
});

test('2. la llegada es una pieza para el chat del reto: espera el hilo cargado, sus puntitos son los de la cola y se recuerda por persona', () => {
  const l = sinComentarios(leer('app/second-brain/LlegadaAlReto.tsx'));
  assert.match(l, /export function LlegadaAlReto\(\{ nombre, listo = true, onMostrada \}/);
  // ops-center-2: arranca con el hilo cargado, y se vuelve a medir cuando el hilo cambia o se mueve.
  assert.match(l, /if \(fase !== 'espera' \|\| !sabe \|\| !listo\) return;/);
  assert.match(l, /const hiloDe = fila\.current\?\.closest\('\.co-hilo'\) \?\? null;/);
  assert.match(l, /hiloDe\?\.addEventListener\('scroll', medir, \{ passive: true \}\);/);
  // onboarding-4: los puntitos, los de la cola de salida (no 1,8 s fijos).
  assert.match(l, /window\.setTimeout\(\(\) => setFase\('listo'\), msEscribiendo\(textoLlegada\(nombre\)\)\)/);
  assert.doesNotMatch(l, /MS_ESCRIBE_LLEGADA|1800/);
  // ops-center-3: por persona (la huella de /api/recorridos), también al recargar.
  assert.match(l, /setFase\(toca && !yaMostrada\(r\.quien\) && !senalAhora\(\) \? 'escribe' : 'listo'\);/);
  assert.match(l, /const claveMostrada = \(quien: string \| null\) => \(quien \? `mk-llegada-mostrada:\$\{quien\}` : null\);/);
  assert.match(sinComentarios(leer('app/_ui/Recorrido.tsx')), /return \{ visto, abierto, reabrir, marcarVisto, onCerrar, quien: resp\?\.quien \?\? null \};/);
  // El mensaje está siempre (también con el recorrido visto); el reto sigue cuando se mostró.
  assert.match(l, /if \(fase === 'espera'\) return null;/);
  assert.match(l, /if \(toca\) anotarMostrada\(r\.quien\);\n\s*onMostrada\?\.\(\);/);
});

test('3. la vista como ADMINISTRADOR muestra lo mismo que ve el cliente: el estado del onboarding es del dueño del negocio que se mira', async () => {
  const s = sinComentarios(leer('lib/seguir-en-pc.ts'));
  assert.match(s, /const mirando = await estaImpersonando\(\)\.catch\(\(\) => false\);\n\s*const email = mirando \? await emailDelDuenoDelWs\(ws\)\.catch\(\(\) => ''\) : s\.email\.trim\(\)\.toLowerCase\(\);/);
  // La barra oculta: ya no da siempre que no mirando un negocio (la causa de que se viera al llegar).
  const f = s.slice(s.indexOf('export async function seguirEnPcPendiente'), s.indexOf('export async function anotarQueEmpezoElV2'));
  assert.doesNotMatch(f, /estaImpersonando/);
  assert.match(f, /if \(!p\.mirando && puedeOperar\(/, 'quien opera, sólo en su cuenta');
  // Lo visto del recorrido, del dueño, en un negocio con el V2.
  const r = sinComentarios(leer('app/api/recorridos/route.ts'));
  assert.match(r, /const p = await personaDelOnboarding\(\);\n\s*if \(p\?\.mirando && veOnboardingV2\(\{ ws: p\.ws \}\)\) return p\.email;/);
  // «Te mandamos el link a…» con el email del dueño.
  const pg = sinComentarios(leer('app/onboarding/page.tsx'));
  assert.match(pg, /email: quien\?\.email \|\| sesion\.email/);
  assert.match(pg, /email=\{quienPc\?\.email \|\| sesionPc\?\.email \|\| ''\}/);
  // El dueño sale de un módulo CHICO: el guard del layout raíz lo importa (tests/seguir-en-pc-liviano.test.ts).
  const d = leer('lib/dueno-del-ws.ts');
  assert.deepEqual([...d.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]), ['./supabase']);
  assert.match(sinComentarios(leer('lib/usuarios.ts')), /return emailDelDuenoDelWs\(ws\);/, 'una sola consulta del dueño');
});

test('4. en un grupo, los puntitos de MaKo pensando se ven (ops-center-8a); lo nuevo de otros sigue como WhatsApp (3/11)', () => {
  const h = sinComentarios(leer('app/_chat/grupo/useSeguirElHilo.ts'));
  assert.match(h, /if \(!pensando \|\| !listo \|\| !visible\) return;\n\s*mirarHijos\.current\?\.\(\);\n\s*if \(!estabaAbajo\.current\) return;/);
  for (const a of ['app/second-brain/ChatDelGrupo.tsx', 'app/m/second-brain/HojaDelGrupo.tsx']) assert.match(sinComentarios(leer(a)), /pensando: k\.pensando, listo:/, a);
});

test('5. en la cabecera de Offer Coach y Funnel Coach, los videos y lo demás van a la DERECHA (la maqueta: `.mq-arriba { margin-left: auto }`)', () => {
  const c = sinComentarios(leer('app/second-brain/ChatDelCoach.tsx'));
  assert.match(c, /acciones: \(\n\s*<span className="co-cab__der">\n\s*\{dosCoaches && <VideosDelChat videos=\{videosDeLaLista\} \/>\}/);
  assert.match(leer('app/admin/operaciones/centro.css'), /\.co-cab__der \{ margin-left: auto; display: flex; align-items: center; gap: 8px; min-width: 0; \}/);
  // La lista de videos abre hacia la izquierda también en el teléfono (abierta hacia la derecha se salía de la pantalla).
  assert.doesNotMatch(leer('app/_ui/tutorial/VideosDelChat.tsx'), /\.mk-vchat__lista \{ right: auto; left: 0; \}/);
});

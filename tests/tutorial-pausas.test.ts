// =============================================================================
// CUÁNDO SE PAUSA EL VIDEO DE UN TUTORIAL (20/11/2026)
// =============================================================================
// Martín: «había muchos videos que se pausaban en el tiempo incorrecto… los tutoriales que tenemos por las tabs». La auditoría del
// Cerebro (20/11, 60 frases de todas las pestañas) midió que los tiempos del manifiesto están bien; el que pausaba mal era el
// motor (app/_ui/tutorial/MotorTutorial.tsx): pausaba en el t_inicio por una marca ausente, seguía en el acto después de un clic que
// navega, y «Siguiente» no hacía el clic. Las reglas nuevas viven en app/_ui/tutorial/pausas.ts.
// Probado rompiéndolo (20/11/2026, una rotura por vez y restaurada): con la pausa en el t_inicio de vuelta cae el 5; sin la
// retención después del clic, el 6; con «Siguiente» sin el clic, el 7; sin `antes` en pasoDeFrase, el 8; con las tapas sin `libre`,
// el 9; sin limpiar los relojes al desmontar, el 10; soltando la retención mientras la página carga, el 1.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MIN_RETENCION_MS, QUIETO_MS, TOPE_CADENA_MS, TOPE_CARGA_MS, TOPE_RETENCION_MS, alFinSinMarca, comoCadena, navegaA, pasoDeLaCadena, siguienteConMarca, soloEnComputadora, soltarRetencion } from '../app/_ui/tutorial/pausas';
import { tutorialDe } from '../lib/tutoriales';
import { mismoLugar, type FraseVideo } from '../lib/tutoriales/videos';
import { tutorialDelDia, DIAS_RETO } from '../lib/reto/dias';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const motor = () => sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx'));

const r = { desde: 1000, url: 'https://hola-mako.com/second-brain', navega: false };
const ahora = (o: Partial<{ ms: number; url: string; marca: boolean; cargando: boolean; quietoMs: number }>) =>
  ({ ms: 1000, url: r.url, marca: false, cargando: false, quietoMs: 0, ...o });

test('1. después de un clic, el video se suelta con la marca, nunca mientras la página carga, y siempre con el tope', () => {
  assert.equal(soltarRetencion(r, ahora({ ms: 1100, marca: true })), true, 'la marca siguiente ya está: sigue en el acto');
  // El grafo del Second Brain: el loader (CargandoMako) ~3 s. Quieto, aunque la página no cambie.
  assert.equal(soltarRetencion(r, ahora({ ms: 4000, cargando: true, quietoMs: 2500 })), false, 'cargando: espera');
  assert.equal(soltarRetencion(r, ahora({ ms: 1000 + TOPE_RETENCION_MS, cargando: true })), true, 'el tope, aunque cargue');
  // Un link a /perfil (sin pantalla de carga): espera a que la URL cambie, aunque la página esté quieta.
  const link = { ...r, navega: true };
  assert.equal(soltarRetencion(link, ahora({ ms: 3000, quietoMs: 2000 })), false, 'el link todavía no llevó');
  assert.equal(soltarRetencion(link, ahora({ ms: 3000, url: 'https://hola-mako.com/perfil', quietoMs: QUIETO_MS })), true, 'llegó y se aquietó');
  // Un menú que abre y no trae la marca: un momento para que se dibuje, y después sigue (la frase se saltea sin pausar).
  assert.equal(soltarRetencion(r, ahora({ ms: 1000 + MIN_RETENCION_MS - 1, quietoMs: 5000 })), false, 'lo mínimo');
  assert.equal(soltarRetencion(r, ahora({ ms: 1000 + MIN_RETENCION_MS, quietoMs: QUIETO_MS - 1 })), false, 'la página sigue cambiando');
  assert.equal(soltarRetencion(r, ahora({ ms: 1000 + MIN_RETENCION_MS, quietoMs: QUIETO_MS })), true, 'quieta: sigue');
});

test('2. en el t_fin de una frase sin su marca: espera sólo a una página que carga, y con tope', () => {
  assert.equal(alFinSinMarca(false, 0), 'saltear', 'la marca no existe (otro rol, una vista vacía): sigue sin pausar');
  assert.equal(alFinSinMarca(true, 0), 'esperar');
  assert.equal(alFinSinMarca(true, TOPE_CARGA_MS), 'saltear', 'nunca queda quieto sin salida');
});

test('3. la marca que el clic tiene que hacer aparecer: la próxima frase con marca, sin hacer', () => {
  const f = (id: string, t: number, sel: string | null): FraseVideo => ({ id, t_inicio: t, t_fin: t + 2, texto: id, sel, espera_clic: !!sel, cierra_despues: false });
  const frases = [f('a', 0, '#a'), f('b', 3, null), f('c', 6, '#c'), f('d', 9, '#d')];
  assert.equal(siguienteConMarca(frases, frases[0], new Set(['a']))?.id, 'c', 'saltea la que sólo narra');
  assert.equal(siguienteConMarca(frases, frases[0], new Set(['a', 'c']))?.id, 'd');
  assert.equal(siguienteConMarca(frases, frases[3], new Set(['a', 'c', 'd'])), null, 'la última: no hay a quién esperar');
});

test('4. el clic que navega: otra ruta u otra consulta del mismo sitio; en el teléfono, lo de la computadora no se busca', () => {
  const aqui = 'https://hola-mako.com/second-brain?chat=3';
  assert.equal(navegaA('/perfil', aqui), true);
  assert.equal(navegaA('/calendario?vista=llamadas', 'https://hola-mako.com/calendario'), true, 'otra consulta');
  assert.equal(navegaA('/second-brain?chat=3', aqui), false, 'la misma página');
  assert.equal(navegaA('#arriba', aqui), false);
  assert.equal(navegaA('https://otro.com/x', aqui), false, 'otro sitio');
  assert.equal(navegaA('/perfil', aqui, '_blank'), false, 'otra pestaña');
  const pasos = [{ sel: 'input[aria-label="Nombre del negocio"]', soloComputadora: true as const }, { sel: '[data-prioridad]' }];
  assert.equal(soloEnComputadora('input[aria-label="Nombre del negocio"]', pasos, true, mismoLugar), true, 'settings-3 en el teléfono');
  assert.equal(soloEnComputadora('input[aria-label="Nombre del negocio"]', pasos, false, mismoLugar), false, 'en la computadora, sí');
  assert.equal(soloEnComputadora('[data-prioridad]', pasos, true, mismoLugar), false);
});

test('5. el motor NUNCA pausa en el t_inicio por una marca ausente: la busca mientras dura su voz', () => {
  const m = motor();
  assert.doesNotMatch(m, /esperando\.current/, 'la espera de 4 s con el video quieto en el t_inicio');
  assert.doesNotMatch(m, /Date\.now\(\) - w\.desde > 4000/);
  // La frase sin marca queda pendiente, el video sigue, y en su t_fin sólo espera una carga.
  assert.match(m, /if \(lugarDe\(paso\.sel\)\) \{ setFrase\(f\); return; \}[\s\S]{0,400}pendiente\.current = \{ f, espera: null \};/);
  assert.match(m, /if \(t < p\.f\.t_fin - 0\.05\) return;\n\s*if \(alFinSinMarca\(cargandoAhora\(\), 0\) === 'esperar'\) \{ p\.espera = Date\.now\(\); v\.pause\(\); esperarCarga\(p\); return; \}/);
  // Los únicos v.pause() del motor: el t_fin de una frase marcada, la carga en el t_fin, la retención y el video cerrado.
  const pausas = (m.match(/\bv\.pause\(\)/g) ?? []).length;
  assert.equal(pausas, 5, `v.pause() en el motor: ${pausas}`);
});

test('6. después de un clic, el video se queda en el silencio de la frase tocada hasta que aparece la marca siguiente', () => {
  const m = motor();
  // En el SILENCIO de verdad (20/11, la verificación de motor-3/c): tocada durante su voz, la frase termina y se retiene en su t_fin.
  assert.match(m, /const destino = f && clic \? siguienteConMarca\(frases, f, hechas\.current\) : null;\n[^\n]*\n\s*if \(destino && !lugarDe\(pasoDeFrase\(destino, pasos\)\.sel\)\) \{/);
  assert.match(m, /const quieto = \(\) => \{ if \(lugarDe\(pasoDeFrase\(destino, pasos\)\.sel\)\) return; v\.pause\(\); retener\(\{ desde: Date\.now\(\), url: desdeUrl, navega, destino \}\); \};/);
  assert.match(m, /if \(retenida\.current\) \{ if \(!v\.paused\) v\.pause\(\); return; \}/, 'retenido, quieto');
  assert.match(m, /soltarRetencion\(r, \{ ms: ahora, url: urlAhora\(\), marca, cargando: cargandoAhora\(\), quietoMs: ahora - cambio \}\)/);
  // El clic de la persona, con adónde lleva medido ANTES de navegar.
  // (Sin video, antes anota qué paso sigue a su clic: su `antes` no se vuelve a tocar. La verificación de OD-10.)
  assert.match(m, /const navega = navegaAlTocar\(el\), url = urlAhora\(\);\n\s*if \(!modoVideo\) trasSuClic\.current = pasos\[i \+ 1\] \?\? null;\n\s*window\.setTimeout\(\(\) => \(modoVideo && !cierre \? seguirVideo\('persona', navega, url\)/);
});

test('7. «Siguiente» hace el clic (abre el menú, el grafo, Settings), sin contarlo como tocado por la persona', () => {
  const m = motor();
  assert.match(m, /if \(frase\?\.espera_clic && el\?\.isConnected\) \{ const navega = navegaAlTocar\(el\), url = urlAhora\(\); el\.click\(\); seguirVideo\('siguiente', navega, url\); return; \}/);
  assert.match(m, /if \(tocado \|\| !e\.isTrusted \|\|/, 'el clic sintético de «Siguiente» no es el de la persona');
  assert.match(m, /if \(clic === 'persona'\) \{ tocadas\.current\.add\(f\.id\);/, 'sólo la persona cuenta para el reto');
});

test('8. el `antes` del paso viaja con la frase, y el motor lo toca sólo si la marca falta y la frase anterior no se tocó', () => {
  const m = motor();
  assert.match(m, /\.\.\.\(mismo\?\.antes \? \{ antes: mismo\.antes \} : \{\}\),/);
  // (20/11: con un `antes` de uno, la regla de siempre; una cadena arranca en lo que dejó abierto la frase tocada: el 11.)
  assert.match(m, /if \(paso\.antes && \(typeof paso\.antes !== 'string' \|\| !\(previa && pulsadas\.current\.has\(previa\.id\)\)\)\) tocarAntes\(paso\.antes, \(\) => vivo\.current\);/);
  // (Y no justo después de que la persona lo tocó: el Second Brain alterna. La verificación de OD-10.)
  assert.match(m, /if \(paso\.antes && !modoVideo && !lugarDe\(paso\.sel\) && !recienTocado\) tocarAntes\(paso\.antes, \(\) => vivo\);/, 'con la marca ya puesta no se toca de nuevo');
  // El recorrido: «Siguiente» en el Second Brain ya no deja el grafo sin abrir.
  assert.match(leer('lib/onboarding-v2/recorrido.ts'), /\{ sel: '\[data-recorrido="sb-grafo"\]'[^}]*antes: SECOND_BRAIN/);
});

test('9. las tapas respetan `libre`, y `libre` viaja del reto al tutorial del día (el menú de la foto, día 2)', () => {
  const m = motor();
  assert.match(m, /\.\.\.\(mismo\?\.libre \? \{ libre: true as const \} : \{\}\),/);
  assert.match(m, /!\(senal\.tipo === 'marca' && senal\.libre\) && !paso\?\.libre && <Tapas h=\{geo\.hueco\} \/>/);
  const dia2 = DIAS_RETO.find((d) => d.n === 2);
  assert.ok(dia2);
  const settings = tutorialDelDia(dia2).pasos.filter((p) => p.sel === '#user-menu a[href^="/perfil"]');
  assert.ok(settings.length > 0 && settings.every((p) => p.libre === true), 'el link de Settings del menú de la foto, libre');
});

test('10. los relojes del modo video se limpian al desmontar, y nunca un play() sin capa o con el video cerrado', () => {
  const m = motor();
  assert.match(m, /return \(\) => \{ vivo\.current = false; window\.clearTimeout\(reloj\.current\); cancelAnimationFrame\(alFinDeLaTocada\.current\); observador\.current\?\.disconnect\(\); retenida\.current = null; pendiente\.current = null; \};/);
  assert.match(m, /if \(!vivo\.current \|\| !v \|\| !v\.isConnected \|\| v\.ended\) return;\n\s*void v\.play\(\)/);
  // Ningún play() suelto: todos pasan por `reproducir`, salvo el arranque del modo video y el del VideoChico (cada uno con su
  // reintento en silencio).
  const sueltos = (m.match(/v\.play\(\)/g) ?? []).length;
  // 21/11 (producción): + el arranque DESDE UN PASO del medio (2, igual que el arranque: con sonido y, si no, en silencio), al volver a un
  // paso con «Atrás» o «Ir a un paso» (tests/revision-pasos-individuales.test.ts).
  assert.equal(sueltos, 7, `v.play() en el motor: ${sueltos} (reproducir 1, el arranque 2, el arranque desde un paso 2, VideoChico 2)`);
});

// EL `antes` EN CADENA (20/11; el Cerebro: Chats con canales y el Dashboard con hojas). Probado rompiéndolo: arrancando siempre por el
// primer eslabón cae el 11; sin cerrar lo abierto cuando el siguiente no aparece, el 11; con la cadena de Chats sin «Canal», el 12;
// sin la marca de «Conectar un canal» en el desplegable, el 12; con el Dashboard sin su cadena, el 12; tocando el `antes` sin video aunque
// la marca ya esté, el 8 y el 11.
test('11. el `antes` en cadena: arranca en el último eslabón a la vista, espera cada uno y, si no aparece, cierra lo abierto', () => {
  assert.deepEqual(comoCadena('a'), ['a'], 'uno solo es una cadena de uno');
  assert.equal(pasoDeLaCadena([true, false]), 0, 'el menú cerrado: se abre');
  assert.equal(pasoDeLaCadena([true, true]), 1, 'el menú ya abierto (lo dejó la frase anterior): se toca su opción, no se cierra');
  assert.equal(pasoDeLaCadena([false, true]), 1);
  assert.equal(pasoDeLaCadena([false, false]), -1, 'nada a la vista: no se toca nada');
  assert.ok(TOPE_CADENA_MS >= 1000 && TOPE_CADENA_MS <= 3000);
  const m = motor();
  assert.match(m, /const i = pasoDeLaCadena\(cadena\.map\(\(s\) => !!lugarDe\(s\)\)\);/);
  assert.match(m, /if \(Date\.now\(\) - desde > TOPE_CADENA_MS\) \{ cerrarLoAbierto\(\); return; \}/, 'nunca deja un menú colgado');
  assert.match(m, /if \(paso\.antes && \(typeof paso\.antes !== 'string' \|\| !\(previa && pulsadas\.current\.has\(previa\.id\)\)\)\) tocarAntes\(paso\.antes, \(\) => vivo\.current\);/,
    'en el video, una cadena va aunque se haya tocado la frase anterior (arranca en lo que esa frase dejó abierto)');
  // Sin video, sólo si la marca falta: el efecto vuelve a correr al encontrarla, y tocarla otra vez cerraba el menú (medido en el
  // navegador: con la cadena, «Canal» y «Conectar» se tocaban dos veces).
  assert.match(m, /if \(paso\.antes && !modoVideo && !lugarDe\(paso\.sel\) && !recienTocado\) tocarAntes\(paso\.antes, \(\) => vivo\);/);
});

test('12. Chats con canales y el Dashboard con hojas: sus cadenas, con lugares que existen', () => {
  const whatsapp = tutorialDe('chats')?.pasos.find((p) => p.sel.includes('tour-chats-whatsapp'));
  assert.deepEqual(whatsapp?.antes, ['button[aria-label="Canal"]', '[data-recorrido="tour-chats-conectar"]']);
  assert.match(leer('app/chats/FiltrosChats.tsx'), /\{ value: 'conectar', label: 'Conectar un canal', crear: true, marca: MARCA\.chatsConectar \}/);
  assert.match(leer('lib/tutoriales/marcas.ts'), /chatsConectar: 'tour-chats-conectar',/);
  // El renglón del desplegable lleva su lugar SÓLO si lo pide (el Dropdown lo usan decenas de pantallas: las demás no cambian).
  assert.match(leer('app/components/Dropdown.tsx'), /data-fuente=\{o\.fuente \? o\.value : undefined\} data-recorrido=\{o\.marca\}/);
  const caja = tutorialDe('dashboard')?.pasos.find((p) => p.sel === '[data-caja-pedido]');
  assert.deepEqual(caja?.antes, ['[data-recorrido="dash-hojas"]', '[data-recorrido="dash-nueva-hoja"] button']);
  const cab = leer('app/dashboard/Cabecera.tsx');
  assert.match(cab, /data-recorrido="dash-hojas"/);
  assert.match(cab, /<span className="lk-hoja-nueva" data-recorrido="dash-nueva-hoja">\s*<NuevoPlaceholder chico texto="Nueva hoja"/);
});

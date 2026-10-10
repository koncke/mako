// =============================================================================
// El lienzo de la sexta tanda: «Entonces», el DELAY en la flecha, el CRON con varios disparadores,
// las sueltas, el click derecho y el chrome
// =============================================================================
// Pedido literal de Martín (09/10/2026, sexta tanda; el entero en app/admin/dev/chatbot/bitacora.ts):
//   · General 4: «cada paso tiene un circulo al final que dice "Entonces" y la flecha sale de ahí...
//     si no tiene siguiente paso, el texto al lado del círculo con el "+" dice "Siguiente paso"».
//   · General 5: «la flecha... Yo puedo soltar en cualquier lugar de la tarjeta la flecha, pero
//     siempre se coloca en el mismo lugar».
//   · General 2 / 7: el click derecho, y los pasos sueltos «en cualquier momento y lugar del tablero».
//   · General 8: «El botón de IA de "Pedirle un cambio a MaKo" ponlo al lado del cuadro del título,
//     donde hoy está "activar". Activar pasa a estar al lado de "Publicar".»
//   · General 14: «En la posición donde hoy está el botón de IA de MaKo, pon un botón de ícono para
//     "acomodar" todas las tarjetas.»
//   · CRON 10: la tarjeta «Cuando…» de ManyChat, con «+Nuevo CRON» y el rayo.
//   · DELAY 1: «Que Delay no sea una tarjeta, que la flecha no se corte».
// Se EJECUTAN `grafoDeSecuencia` y la geometría (lib/lienzo-grafo.ts) con flujos de verdad; lo que es
// cableado de componentes se fija leyendo el fuente sin comentarios, por tramo.
//
// PROBADO ROMPIÉNDOLO (09/10/2026; base en verde: 13 pasan, 0 fallan). Cada rotura de a una,
// aplicada y restaurada DE MEMORIA por un arnés (nunca con `git checkout`). Pasan / fallan:
//   1. `tieneFilas` sin la salida al pie                                           -> 10 / 3
//   2. `rotuloDeFila` dice «Entonces» también sin flecha                            -> 12 / 1
//   3. la espera nunca va en la flecha (`colapsable` siempre false)                -> 11 / 2
//   4. la espera con DOS padres también va en la flecha                            -> 12 / 1
//   5. `altoCron` sin «+ Nuevo CRON»                                                -> 12 / 1
//   6. `puntoDeEntrada` con los 44 px de /mensajes para todas                      -> 12 / 1
//   7. `fijarPosicion` poda la tarjeta nueva                                        -> 12 / 1
//   8. el lienzo arma el gesto también con el botón derecho                        -> 12 / 1
//   9. el ✦ de MaKo vuelve a la fila del zoom                                       -> 12 / 1
//  10. «Activar» sale de al lado de «Publicar»                                      -> 12 / 1
//  11. eliminar una tarjeta vuelve a ser `borrarNodo`                               -> 12 / 1
//  12. sin la suelta marcada                                                        -> 12 / 1
//  13. la lista sin la división «Chatbot»                                           -> 12 / 1
// Segunda pasada (09/10/2026, parte «flujo»: los íconos del «⋯» por nombre del set). Base 13 / 0:
//  14. «Eliminar» con un ícono que no es la papelera (`cerrar`)                     -> 12 / 1
//  15. una opción con un `data:` propio en vez de un nombre del set                 -> 12 / 1
//  16. vuelve la fila «Si responde» al CRON de un flujo que la tiene                -> 12 / 1
//
// Correr: node --import tsx --test tests/lienzo-sexta-tanda.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  grafoDeSecuencia, opcionesDelMas, opcionesSueltas, MENU_MAS, altoCron, altoCajaDisparo, ICONO_CRON, ICONO_ACCION, ID_ENTRADA,
  ALTO_NUEVO_DISPARO, SEP_DISPARO, type PasoParaGrafo, type NodoFlujo,
} from '../lib/flujo-conversacion';
import {
  yDePuerto, rotuloDeFila, filaDePuerto, puntoDeEntrada, posicionDePildora, curvaEntre, tieneFilas,
  ALTO_PUERTO, BORDE_NODO, PIE_PUERTOS, Y_ENTRADA, ROTULO_ENTONCES, ROTULO_SIGUIENTE,
} from '../lib/lienzo-grafo';
import { fijarPosicion, conPosiciones } from '../lib/lienzo-posiciones';
import { ID_INICIO } from '../lib/flujo-grafo';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimuladorWhatsApp, ROTULO_CHATBOT, ROTULO_MENSAJES_MAKO, opcionesDeFila } from '../app/automations/SimuladorWhatsApp';
import { esIconoMenu } from '../app/_ui/iconos-menu';
import type { SecuenciaDto } from '../app/automations/ChatAgentApp';
import type { PlantillaVista } from '../lib/plantillas';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const tramo = (src: string, abre: string, cierra: string, tope: number): string => {
  const ini = src.indexOf(abre);
  assert.ok(ini >= 0, `no encontré «${abre}»`);
  const fin = src.indexOf(cierra, ini + abre.length);
  assert.ok(fin > ini, `no encontré «${cierra}»`);
  const b = src.slice(ini, fin);
  assert.ok(b.length < tope, `el recorte mide ${b.length}: está mirando otra cosa`);
  return b;
};
const msg = (id: string, extra: Partial<PasoParaGrafo> = {}): PasoParaGrafo => ({ id, canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', siguiente: null, ...extra });
const esp = (id: string, siguiente: string | null, extra: Partial<PasoParaGrafo> = {}): PasoParaGrafo => ({ id, nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente, canal: 'whatsapp', delay_horas: 0, cuerpo: '', ...extra });
const nodo = (g: { nodos: NodoFlujo[] }, id: string): NodoFlujo => { const n = g.nodos.find((x) => x.id === id); assert.ok(n, `no está el nodo ${id}`); return n!; };

test('⚠️ «Entonces / Siguiente paso»: la salida de una tarjeta va al PIE, y la flecha sale de ahí', () => {
  const g = grafoDeSecuencia([msg('m1', { siguiente: 'm2' }), msg('m2')], { disparador: 'X' });
  const m1 = nodo(g, 'm1');
  const m2 = nodo(g, 'm2');
  assert.equal(m1.salidaAlPie, true);
  assert.ok(tieneFilas(m1), 'la salida al pie no cuenta como fila');
  assert.equal(rotuloDeFila(m1, m1.puertos![0]), ROTULO_ENTONCES);
  assert.equal(rotuloDeFila(m2, m2.puertos![0]), ROTULO_SIGUIENTE, 'sin siguiente paso dice «Siguiente paso»');
  // La flecha sale de la fila del pie, y la fila del pie es la última de la tarjeta.
  assert.equal(yDePuerto(m1, 'sig'), m1.y + m1.alto - BORDE_NODO - PIE_PUERTOS - ALTO_PUERTO / 2);
  assert.match(curvaEntre(m1, m2, 'sig'), new RegExp(`^M ${m1.x + m1.ancho} ${yDePuerto(m1, 'sig')} `));
  // El CRON también («Entonces» al pie), salvo el de antes con «Si responde» (sus dos filas).
  assert.equal(nodo(g, ID_ENTRADA).salidaAlPie, true);
});

test('⚠️ la flecha ENTRA siempre al mismo punto de la tarjeta: arriba a la izquierda (sus títulos)', () => {
  const g = grafoDeSecuencia([msg('m1', { siguiente: 'm2' }), msg('m2', { cuerpo: 'x'.repeat(300) })], { disparador: 'X' });
  const m2 = nodo(g, 'm2');
  assert.deepEqual(puntoDeEntrada(m2), { x: m2.x, y: m2.y + Y_ENTRADA });
  assert.match(curvaEntre(nodo(g, 'm1'), m2, 'sig'), new RegExp(` ${m2.x} ${m2.y + Y_ENTRADA}$`));
  // /mensajes (sin `puertos`) queda como siempre: 44 px.
  const avisos = { ...m2, puertos: undefined, alto: 200 };
  assert.equal(puntoDeEntrada(avisos).y, avisos.y + 44);
});

test('⚠️ el DELAY va EN la flecha: no es una tarjeta, no ocupa columna y la flecha no se corta', () => {
  const g = grafoDeSecuencia([msg('m1', { siguiente: 'w' }), esp('w', 'm2'), msg('m2')], { disparador: 'X' });
  const w = nodo(g, 'w');
  assert.equal(w.enFlecha, true, 'la espera del medio es una tarjeta');
  assert.deepEqual(w.puertos, []);
  const flecha = g.aristas.find((a) => a.desde === 'm1');
  assert.ok(flecha, 'no hay flecha de m1');
  assert.equal(flecha!.hasta, 'm2', 'la flecha se corta en la espera');
  assert.deepEqual(flecha!.esperas, [{ id: 'w', texto: '1 h' }]);
  assert.equal(g.aristas.some((a) => a.desde === 'w' || a.hasta === 'w'), false, 'quedaron flechas a la espera');
  // m2 va en la columna siguiente a m1, no dos más allá. (Desde el 10/10/2026 la columna se corre lo que
  // pide la pastilla para no pisar las tarjetas —«1 h» pide 2 px más—, nunca una columna entera: 344 px.)
  const sinEspera = grafoDeSecuencia([msg('m1', { siguiente: 'm2' }), msg('m2')], { disparador: 'X' });
  assert.ok(nodo(g, 'm2').x - nodo(sinEspera, 'm2').x < 100, 'la espera ocupa una columna');
  // La pastilla está sobre la curva y se mueve con sus puntas.
  const p = posicionDePildora(g, 'w')!;
  assert.ok(p && p.x > nodo(g, 'm1').x + nodo(g, 'm1').ancho && p.x + p.ancho < nodo(g, 'm2').x + 1, 'la pastilla no está entre las dos tarjetas');
  const movido = { ...g, nodos: g.nodos.map((n) => (n.id === 'm2' ? { ...n, y: n.y + 300 } : n)) };
  assert.ok(posicionDePildora(movido, 'w')!.y > p.y + 100, 'la pastilla no siguió a la tarjeta movida');
});

test('la espera SIGUE siendo su píldora donde es un lugar del dibujo: al final, con dos padres, o repartiendo', () => {
  const alFinal = grafoDeSecuencia([msg('m1', { siguiente: 'w' }), esp('w', null)], { disparador: 'X' });
  assert.equal(nodo(alFinal, 'w').enFlecha, undefined);
  assert.equal(nodo(alFinal, 'w').puertos!.length, 1, 'la del final no tiene su salida');
  const dosPadres = grafoDeSecuencia([
    { id: 'c', nodo: 'condicion', canal: 'whatsapp', delay_horas: 0, cuerpo: '', ramas: [{ id: 'r', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'w' }], si_no: 'w' },
    esp('w', 'm2'), msg('m2'),
  ], { disparador: 'X' });
  assert.equal(nodo(dosPadres, 'w').enFlecha, undefined, 'una espera con dos padres se aplastó en una flecha');
  const reparte = grafoDeSecuencia([msg('m1', { siguiente: 'w' }), esp('w', 'm2', { paralelos: ['m3'] }), msg('m2'), msg('m3')], { disparador: 'X' });
  assert.equal(nodo(reparte, 'w').enFlecha, undefined, 'una espera que reparte se aplastó en una flecha');
  // Dos esperas seguidas van las dos sobre la MISMA flecha.
  const dos = grafoDeSecuencia([msg('m1', { siguiente: 'w1' }), esp('w1', 'w2'), esp('w2', 'm2', { espera: { modo: 'tiempo', minutos: 1440 } }), msg('m2')], { disparador: 'X' });
  assert.deepEqual(dos.aristas.find((a) => a.desde === 'm1')?.esperas?.map((e) => e.texto), ['1 h', '1 día']);
});

test('⚠️ la tarjeta CRON: el RAYO, una cajita por disparador y «+ Nuevo CRON» (CRON 10)', () => {
  assert.equal(ICONO_CRON, '⚡');
  assert.notEqual(ICONO_ACCION, ICONO_CRON);
  const uno = nodo(grafoDeSecuencia([msg('a')], { disparador: 'Llega a «Agendado»' }), ID_ENTRADA);
  const tres = nodo(grafoDeSecuencia([msg('a')], {
    disparador: 'X', nuevoDisparador: true,
    disparadores: [{ id: 'd1', texto: 'Llega a «Agendado»' }, { id: 'd2', texto: 'Se le puso «Cualificado»' }, { id: 'd3', texto: 'Comentó una publicación de Instagram con la palabra PRECIO' }],
  }), ID_ENTRADA);
  assert.equal(uno.icono, '⚡');
  assert.ok(tres.alto > uno.alto, 'la tarjeta no crece con los disparadores');
  assert.equal(tres.alto, altoCron(['Llega a «Agendado»', 'Se le puso «Cualificado»', 'Comentó una publicación de Instagram con la palabra PRECIO'], true, 1));
  assert.equal(altoCron(['a'], true, 1) - altoCron(['a'], false, 1), SEP_DISPARO + ALTO_NUEVO_DISPARO, '«+ Nuevo CRON» no suma su renglón');
  assert.ok(altoCajaDisparo('x'.repeat(80)) > altoCajaDisparo('corto'), 'un disparador largo no ocupa dos renglones');
});

test('⚠️ una tarjeta SUELTA se marca (borde punteado), y nace donde se hizo el click derecho', () => {
  const g = grafoDeSecuencia([msg('m1'), msg('s')], { disparador: 'X' });
  assert.equal(nodo(g, 's').suelta, true);
  assert.equal(nodo(g, 'm1').suelta, undefined);
  // `fijarPosicion` pone una tarjeta que el grafo derivado TODAVÍA no tiene (nace en el mismo cambio).
  const pos = fijarPosicion(g, {}, 'nueva', 900, 640, ID_ENTRADA);
  assert.ok(pos.nueva, 'se podó la tarjeta nueva');
  const cron = nodo(g, ID_ENTRADA);
  assert.deepEqual(pos.nueva, { x: 900 - cron.x, y: 640 - cron.y });
  const conLaNueva = grafoDeSecuencia([msg('m1'), msg('s'), msg('nueva')], { disparador: 'X' });
  const puesta = nodo(conPosiciones(conLaNueva, pos, ID_ENTRADA), 'nueva');
  assert.deepEqual([puesta.x, puesta.y], [900, 640], 'la suelta no quedó donde se hizo el click');
});

test('el click derecho crea lo MISMO que el ＋ (una fila en `MENU_MAS`), sin la restricción de «Si responde»', () => {
  assert.deepEqual(opcionesSueltas().map((o) => o.value), MENU_MAS.map((o) => o.value));
  assert.deepEqual(opcionesDelMas([msg('a')], 'a', false).map((o) => o.value), MENU_MAS.map((o) => o.value));
  assert.ok(opcionesSueltas().every((o) => o.icono?.startsWith('data:image/svg+xml')), 'una opción del menú va sin ícono');
});

test('`filaDePuerto`: de qué círculo sale cada flecha (la papelera de un círculo borra las suyas)', () => {
  const g = grafoDeSecuencia([msg('m1', { siguiente: 'm2', paralelos: ['m3'] }), msg('m2'), msg('m3')], { disparador: 'X' });
  const m1 = nodo(g, 'm1');
  assert.equal(filaDePuerto(m1, 'sig'), 'sig');
  assert.equal(filaDePuerto(m1, 'par:m3'), 'sig', 'la flecha en paralelo no sale del círculo de siempre');
  const c = { ...m1, salidaAlPie: undefined, puertos: [{ id: 'r1', rotulo: 'Agendó', vacio: false }, { id: 'si_no', rotulo: 'Si no', vacio: false }] };
  assert.equal(filaDePuerto(c, 'par:x@si_no'), 'si_no');
  assert.equal(filaDePuerto(c, 'r1'), 'r1');
});

// ── El cableado (fuente sin comentarios) ─────────────────────────────────────────

const LIENZO = sinComentarios(leer('../app/_components/Lienzo.tsx'));
const FLUJO = sinComentarios(leer('../app/automations/FlujoLienzo.tsx'));
const PERFIL = sinComentarios(leer('../app/automations/SecuenciaPerfil.tsx'));

test('⚠️ el lienzo: el gesto es del botón PRINCIPAL, y el click derecho abre su menú', () => {
  const down = tramo(LIENZO, 'function onPointerDown(', 'function onPointerMove(', 3_000);
  assert.match(down, /if \(e\.button !== 0\) return;/, 'el botón derecho arma un gesto y selecciona la tarjeta');
  assert.match(LIENZO, /onContextMenu=\{onContextMenu\}/);
  const ctx = tramo(LIENZO, 'function onContextMenu(', 'const [revelados, setRevelados]', 2_600);
  assert.match(ctx, /menuNodo\?\.\(id\)/);
  assert.match(ctx, /menuLienzo\?\.\(aGrafo\(e\.clientX, e\.clientY\)\)/);
  // Arrastrar: al soltar sobre una tarjeta, `onConectar` con la FILA del círculo.
  const soltar = tramo(LIENZO, 'function soltarCirculo(', 'function quitarDeFila(', 2_600);
  assert.match(soltar, /if \(!cancelado && g\.sobre\) onConectar\?\.\(g\.desde, g\.fila, g\.sobre\);/);
  // Y se atenúa todo menos el origen y la de abajo del cursor.
  assert.match(LIENZO, /arrastreFlecha && n\.id !== arrastreFlecha\.desde && n\.id !== sobreFlecha/);
});

test('⚠️ FlujoLienzo edita por lib/flujo-edicion.ts (todo por `onPasos`), y «Acomodar» va al lado del deshacer', () => {
  assert.match(FLUJO, /onConectar=\{editable \? \(desde, puerto, hacia\) => \{ aplicar\(conectar\(pasos, desde, puerto, hacia\)\); \} : undefined\}/);
  assert.match(FLUJO, /onQuitarFlecha=\{editable \? quitarFlecha : undefined\}/);
  assert.match(FLUJO, /menuLienzo=\{menuLienzo\} menuNodo=\{menuNodo\}/);
  assert.match(FLUJO, /herramientas=\{conAcomodar\}/);
  assert.match(FLUJO, /const r = crearSuelta\(pasos, que\);\s*onPasos\(\(\) => r\.pasos, true\);\s*ponerEn\(r\.id, punto\.x, punto\.y\);/);
  // La espera de una flecha se saca de la cadena (la flecha queda); las demás, con `eliminar` (por `onBorrar`).
  assert.match(FLUJO, /\?\.enFlecha\) \{ onPasos\(\(prev\) => borrarNodo\(prev, id\), true\); return; \}/);
  assert.match(PERFIL, /const r = eliminar\(pasos, id\);/, 'eliminar una tarjeta volvió a ser `borrarNodo` (se lleva lo de después)');
});

test('⚠️ el chrome: el ✦ de MaKo al lado del título, «Activar» al lado de «Publicar» (punto 8)', () => {
  const chrome = tramo(PERFIL, 'chrome={(', 'herramientas={rolAdmin ? (', 6_000);
  assert.match(chrome, /title="Pedirle un cambio a MaKo"/, 'el ✦ de MaKo no está al lado del título');
  assert.doesNotMatch(chrome, />Activar</, '«Activar» sigue arriba');
  const herramientas = tramo(PERFIL, 'herramientas={rolAdmin ? (', 'pie={(', 1_600);
  assert.doesNotMatch(herramientas, /Pedirle un cambio a MaKo/, 'el ✦ volvió a la fila del zoom');
  const pie = tramo(PERFIL, 'pie={(', 'editorEntrada={(', 4_000);
  assert.ok(pie.indexOf('>Activar<') >= 0 && pie.indexOf('>Activar<') < pie.indexOf("'Publicar'"), '«Activar» no está al lado de «Publicar»');
  assert.match(PERFIL, /onPublicar=\{rolAdmin \? \(\) => void publicar\(\) : undefined\}/);
});

test('⚠️ la lista lleva DOS divisiones: «Chatbot» arriba y «MaKo en WhatsApp» (punto 3), y el «⋯» con íconos', () => {
  const secuencia = {
    id: 7, clave: 'bienvenida', nombre: 'Bienvenida', etapa: 'nuevo', trigger_tipo: 'etapa',
    activa: true, pasos: [], inscriptos: 0, enviados: 0, estrategia: null, metricas: {},
  } as unknown as SecuenciaDto;
  const aviso = {
    id: 'reporte-semanal', titulo: 'Reporte semanal', categoria: 'reporte', prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false,
    yaImplementado: 'si', disparador: 'x', ejemplo: 'x', enabled: true, esCustom: false, fijo: false, canales: { wa: true, email: false },
    frecuenciaMin: 0, posiciones: {}, borrador: null, asunto: '',
  } as unknown as PlantillaVista;
  const html = renderToStaticMarkup(createElement(SimuladorWhatsApp, {
    secuencias: [secuencia], objetivos: [], etiquetaEtapa: (k: string) => k, negocio: 'Mi negocio', avisos: [aviso],
    rolAdmin: true, audios: [], canalCaido: false, onAudioNuevo: () => {}, onNueva: () => {}, onReload: () => {},
    productos: [], disparadores: [], tz: null,
  } as Parameters<typeof SimuladorWhatsApp>[0]));
  assert.equal(ROTULO_CHATBOT, 'Chatbot');
  assert.equal(ROTULO_MENSAJES_MAKO, 'MaKo en WhatsApp', 'el título es «MaKo en WhatsApp», no sólo MaKo (se confunde con la IA)');
  const iChatbot = html.indexOf(`>${ROTULO_CHATBOT}</div>`);
  const iSec = html.indexOf('>Bienvenida</span>');
  const iMako = html.indexOf(`>${ROTULO_MENSAJES_MAKO}</div>`);
  const iAviso = html.indexOf('>Reporte semanal</span>');
  assert.ok(iChatbot >= 0 && iChatbot < iSec && iSec < iMako && iMako < iAviso, 'las divisiones no van en orden: Chatbot, sus automatizaciones, MaKo en WhatsApp, sus mensajes');
  // Segunda pasada: los íconos del «⋯» son NOMBRES del set de la casa (app/_ui/iconos-menu.tsx), no
  // `data:` propios; y «borrar» es rojo SIEMPRE porque lo pinta `IconoMenu`, no la fila.
  for (const activa of [true, false]) {
    assert.ok(opcionesDeFila(activa).every((o) => esIconoMenu(o.icono)), 'una opción del «⋯» sin ícono del set');
  }
  assert.equal(opcionesDeFila(false).find((o) => o.value === 'eliminar')!.icono, 'borrar', 'la papelera no es la roja de la casa');
});

test('⚠️ el CRON de un flujo CON «Si responde» ya no tiene esa fila: su salida va al pie, como todos (punto 12)', () => {
  // Segunda pasada de la sexta tanda: «Si responde» es la CONDITION que escucha, no una fila del CRON.
  // Hasta acá un flujo de antes dibujaba el CRON con dos filas («Al entrar» y «Si responde»). Desde la
  // séptima la cuelga del CRON una flecha que NO es del dato (`sinMas`).
  const pasos: PasoParaGrafo[] = [msg('m1'), { id: 'r', nodo: 'respuesta', casos: [], si_no: null, canal: 'whatsapp', delay_horas: 0, cuerpo: '' }];
  const g = grafoDeSecuencia(pasos, { disparador: 'X' });
  const e = nodo(g, ID_ENTRADA);
  assert.equal(e.salidaAlPie, true);
  assert.deepEqual(e.puertos!.map((p) => p.id), ['sig'], 'volvió la fila «Si responde» al CRON');
  assert.deepEqual(g.aristas.filter((a) => a.hasta === 'r').map((a) => [a.desde, a.puerto, a.sinMas]), [[ID_ENTRADA, 'sig', true]], 'la que escucha sin su flecha del CRON, o con una que se puede editar');
  void ID_INICIO;
});

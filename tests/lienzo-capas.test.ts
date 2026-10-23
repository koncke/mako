// =============================================================================
// Las CAPAS de lo que flota sobre el lienzo de /automations, y el error que frena Publicar
// =============================================================================
// Revisión de la segunda tanda (09/10/2026, frente modelo). Tres hallazgos con la misma causa: el
// panel APAISADO del editor (la franja de abajo, nueva en esta tanda) no tenía capa propia y
// ningún ancestro del lienzo tiene z-index, así que:
//   · la esquina de avisos (EsquinaAvisos, `fixed`, z 55, subida a 64 px por el
//     `data-esquina-ocupada` de «Publicar») pintaba encima del rincón de abajo a la derecha del
//     panel: la casilla «Revisar antes de enviar» del editor de WhatsApp en `fila` no recibía el clic;
//   · las cajas de «Crear con IA» (z 4, SecuenciaPerfil) tapaban el pie del editor y el
//     desplegable del disparador;
//   · el error que frena Publicar (que ABRE la tarjeta culpable, o sea el panel) quedaba con su
//     primer renglón —el que nombra la tarjeta— debajo del panel, que va después en el DOM. Y los
//     tres mensajes nuevos de lib/flujo-grafo.ts llevaban el porqué entre paréntesis, que es lo
//     que los llevaba a tres renglones (AGENTS.md: «la pantalla dice QUÉ pasó»).
//
// PROBADO ROMPIÉNDOLO (09/10/2026; con todo puesto: 3 pasan, 0 fallan). Cada rotura de a una,
// aplicada y restaurada DE MEMORIA por un arnés (nunca con git). Pasan / fallan:
//   1. el panel apaisado sin `zIndex: Z_EDITOR_APAISADO`                         -> 2 / 1
//   2. «Publicar» sin `zIndex: Z_ACCION_LIENZO`                                  -> 2 / 1
//   3. `Z_EDITOR_APAISADO = 55` (empata con la esquina)                         -> 2 / 1
//   4. las cajas de «Crear con IA» suben a z 60                                 -> 2 / 1
//   5. vuelve «(abriría caminos nuevos en cada vuelta)» al mensaje del bucle    -> 2 / 1
//
// Correr: node --import tsx --test tests/lienzo-capas.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Z_EDITOR_APAISADO, Z_ACCION_LIENZO } from '../lib/lienzo-grafo';
import { validarGrafo, ID_INICIO, type PasoGrafo } from '../lib/flujo-grafo';
import { errorLegible } from '../lib/flujo-conversacion';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const numero = (src: string, re: RegExp, que: string): number => {
  const m = re.exec(src);
  assert.ok(m, `no encontré ${que}`);
  return Number(m[1]);
};

test('⚠️ el panel apaisado va encima de la esquina de avisos y de «Crear con IA», debajo de los modales; «Publicar», encima del panel', () => {
  const esquina = numero(sinComentarios(leer('../app/_components/EsquinaAvisos.tsx')), /position: 'fixed', right: 20, bottom: 'var\(--esquina-abajo, 20px\)', zIndex: (\d+)/, 'el z de la esquina de avisos');
  const perfil = sinComentarios(leer('../app/automations/SecuenciaPerfil.tsx'));
  // Desde la décima tanda (11/10/2026) queda UNA caja: la barra «Pídele un cambio» (editar). La del lienzo vacío
  // («Generar con IA», modo crear) se fue al modal «Nueva automatización» (docs/diseno-automations-galeria-v2.md §1).
  assert.ok(!perfil.includes('{rolAdmin && pasos.length === 0 && ('), 'volvió la caja «Generar con IA» del lienzo vacío');
  // Decimotercera tanda: el chat también con el lienzo vacío (MaKo crea ahí), y mientras MaKo trabaja sube por encima de
  // la capa que tapa el lienzo (que a su vez va encima de «Publicar»). Quieto, su capa de siempre.
  // 20/10/2026: el chat de MaKo ya no flota sobre el lienzo: es la sidebar (por portal en la ranura de la lista).
  // 22/10/2026, mañana (Martín: «debería quedar todo, incluso atrás de la sidebar, todo»): la capa de MaKo trabajando pasó a
  // tapar TODA la pantalla. Esa noche, mirando #289: «no debe deshabilitarme la navegación de la sidebar principal... Se debe
  // ejecutar en segundo plano. Si está bien que deshabilite la edición del lienzo». Queda a pantalla completa pero DEBAJO de
  // la barra de la app (z 60: nítida y se toca), encima de «Publicar» y de la esquina de avisos; la lista flotante con el
  // chat sube encima de la capa y sigue debajo de la barra. Debajo de los modales (la pila arranca en 130).
  assert.ok(perfil.includes('{rolAdmin && ranuraChat && createPortal('), 'no encontré el chat de MaKo en la sidebar');
  const barraApp = numero(sinComentarios(leer('../app/_components/Sidebar.tsx')), /<aside data-sidebar [^>]*zIndex: (\d+) \}\}>/, 'el z de la barra de la app');
  const capa = numero(perfil, /export const Z_CAPA_MAKO = (\d+);/, 'el z de la capa de MaKo');
  const chat = numero(perfil, /export const Z_CHAT_ENCIMA = (\d+);/, 'el z de la lista con el chat');
  const modales = numero(leer('../app/_components/pila-modales.ts'), /const Z_BASE = (\d+);/, 'la base de la pila de modales');
  assert.ok(capa < barraApp, `la capa (${capa}) tapa la barra de la app (${barraApp}): mientras MaKo trabaja no se puede ir a otra tab`);
  assert.ok(capa > esquina && capa > Z_ACCION_LIENZO, `la capa (${capa}) no tapa los avisos (${esquina}) y «Publicar» (${Z_ACCION_LIENZO})`);
  assert.ok(chat > capa && chat < barraApp && chat < modales, `la lista con el chat (${chat}) no queda entre la capa (${capa}) y la barra de la app (${barraApp})`);
  const lista = sinComentarios(leer('../app/automations/SimuladorWhatsApp.tsx'));
  assert.match(lista, /<aside aria-label=\{verLista \? 'Tus automatizaciones' : 'Chat con MaKo'\} data-panel-automations=[^>]*?zIndex: makoTrabajando \? Z_CHAT_ENCIMA : 3,/, 'la lista con el chat no sube encima de la capa: el chat queda tapado');
  assert.match(lista, /setMakoTrabajando\(t\); onMakoTrabajando\?\.\(t\);/, 'la lista no se entera de que MaKo trabaja');
  assert.ok(Z_EDITOR_APAISADO > esquina, `el panel (${Z_EDITOR_APAISADO}) no le gana a la esquina de avisos (${esquina}): tapa «Revisar antes de enviar»`);
  // (Acá se comparaba con el z del chat de «Crear con IA» flotando: desde el 20/10/2026 el chat es la sidebar, sin z propio.)
  assert.ok(Z_ACCION_LIENZO > Z_EDITOR_APAISADO, 'el error de «Publicar» queda debajo del panel que ese error abre');
  // Debajo de los modales (AGENTS.md: un aviso flotante va con z < 60; la pila arranca en 130).
  assert.ok(Z_ACCION_LIENZO < 60 && Z_ACCION_LIENZO < modales, `«Publicar» (${Z_ACCION_LIENZO}) taparía un modal`);
});

test('⚠️ el lienzo USA las dos capas: el panel apaisado y el contenedor de «Publicar»', () => {
  const lienzo = sinComentarios(leer('../app/_components/Lienzo.tsx'));
  // Desde la tercera tanda el panel es MEDIANO (`width: panelAncho`, decisión 1) y sigue con su capa.
  assert.match(lienzo, /height: panelAlto, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', zIndex: Z_EDITOR_APAISADO,/,
    'el panel apaisado no lleva su capa');
  assert.match(lienzo, /\{accion && <div data-no-pan data-esquina-ocupada style=\{\{ position: 'absolute', right: 12 \+ derAbajo, bottom: 12, zIndex: Z_ACCION_LIENZO \}\}>\{accion\}<\/div>\}/,
    '«Publicar» no lleva su capa');
});

test('⚠️ los errores de los hilos dicen QUÉ pasó, sin el porqué entre paréntesis, y entran en dos renglones', () => {
  const msg = (o: Partial<PasoGrafo>): PasoGrafo => ({ canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', siguiente: null, ...o });
  const esp = (id: string, siguiente: string): PasoGrafo => msg({ id, nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, cuerpo: '', siguiente });
  const irA = (id: string, nodo: string): PasoGrafo => msg({ id, nodo: 'ir_a', cuerpo: '', destino: { nodo } });
  // La tarjeta que reparte es una nota de voz con un texto largo: el nombre más largo que arma
  // `nombreDeTarjeta` («Nota de voz: » + el trozo de 26).
  const bucle: PasoGrafo[] = [
    { id: ID_INICIO, nodo: 'inicio', siguiente: 'm1' },
    msg({ id: 'm1', tipo: 'audio', audio_id: 1, cuerpo: 'Hola, te escribo porque vi que agendaste una llamada', siguiente: 'w1', paralelos: ['e1'] }),
    esp('w1', 'g1'), irA('g1', 'm1'), msg({ id: 'e1', canal: 'email', asunto: 'Hola', cuerpo: 'x' }),
  ];
  const cond: PasoGrafo[] = [
    msg({ id: 'k', nodo: 'condicion', cuerpo: '', paralelos: ['w'], ramas: [{ id: 'kr0', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'b' }], si_no: null }),
    msg({ id: 'b' }), msg({ id: 'w' }),
  ];
  const salto: PasoGrafo[] = [msg({ id: 'a', siguiente: 'b', paralelos: ['w'] }), msg({ id: 'b', siguiente: 'j' }), irA('j', 'w'), msg({ id: 'w' })];
  const casos: Array<[PasoGrafo[], string]> = [
    [bucle, 'la tarjeta m1 saca flechas en paralelo dentro de un bucle de «Ir a»'],
    [cond, 'la tarjeta k no puede sacar flechas en paralelo'],
    [salto, 'el «Ir a» j salta a una tarjeta de otro camino'],
  ];
  // El error va en una tarjeta de `maxWidth` 380 con 12 de relleno por lado y su borde, a 12,5 px:
  // ~6,4 px por letra en promedio (Geist), o sea ~55 letras por renglón.
  const perfil = sinComentarios(leer('../app/automations/SecuenciaPerfil.tsx'));
  const ancho = numero(perfil, /<span role="alert"[^>]*?style=\{\{ \.\.\.tarjetaChrome, maxWidth: (\d+), fontSize: 12\.5/, 'el ancho del error de Publicar');
  const letras = Math.floor((ancho - 26) / 6.4);
  for (const [pasos, esperado] of casos) {
    const errs = validarGrafo(pasos);
    assert.ok(errs.includes(esperado), `falta «${esperado}» en ${JSON.stringify(errs)}`);
    const legible = errorLegible(esperado, pasos);
    assert.doesNotMatch(legible, /\(/, `«${legible}» lleva un porqué entre paréntesis: va al comentario`);
    assert.ok(Math.ceil(legible.length / letras) <= 2, `«${legible}» (${legible.length} letras) ocupa más de dos renglones de ${letras}`);
  }
});

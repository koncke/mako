// =============================================================================
// El recordatorio de la reunión con el lienzo de una automatización (10/10/2026)
// =============================================================================
// Martín abrió /automations con la sexta tanda en producción y escribió, con la captura del
// recordatorio delante: «siguen habiendo cosas de versiones anteriores que estan mal..». El
// recordatorio armaba sus nodos a mano y se había quedado con el lienzo de antes. Esto fija, por
// resto del relevamiento:
//   · 1 DELAY: las esperas van EN la flecha (la pastilla), ninguna como tarjeta;
//   · 2 CRON: la tarjeta de ManyChat (su cajita, su alto sumado, su «Entonces») y sin «＋ Nuevo CRON»;
//   · 3 «Entonces» en cada mensaje que sigue y NINGÚN «Siguiente paso» (el emisor termina en el tercero);
//   · 4 el alto fijo de una automatización (el texto largo termina en «…»);
//   · 5 «Activar» al lado de «Publicar», no del título;
//   · 6 la cabecera del panel con el número de ESE toque (`CabeceraWhatsApp`), sin el renglón de más;
//   · 7 el panel grande de `muelles`;
//   · 8 la pila de deshacer y el click derecho («Publicar»);
//   · 9 lo no publicado se avisa a la lista y al cerrar la pestaña.
// Lo que se puede EJECUTAR (el grafo, el freno) se ejecuta: vive en lib/recordatorio-grafo.ts. Lo que
// vive en el componente se fija sobre su fuente SIN comentarios (la convención de la casa es explicar
// en el comentario lo que se sacó, y un guard de «esto NO está» se acusaría a sí mismo).
//
// PROBADO ROMPIÉNDOLO (10/10/2026): ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  grafoRecordatorio, frenoDelRecordatorio, pasosDelRecordatorio, textoQueSale, toqueDeId, esTarjetaDeToque, idToque,
  ANTES, AIRE_PILDORA, DISPARADOR_RECORDATORIO, AVISO_DATO_DESCONOCIDO,
} from '../lib/recordatorio-grafo';
import { grafoDeSecuencia, altoCron, altoDeMensaje, TITULO, ICONO_CRON, ID_ENTRADA, type NodoFlujo } from '../lib/flujo-conversacion';
import { rotuloDeFila, posicionDePildora, ROTULO_SIGUIENTE, ROTULO_ENTONCES, ALTO_PUERTO } from '../lib/lienzo-grafo';
import { TOQUES, TEXTO_DEFAULT, TOPE_TEXTO } from '../lib/recordatorio-lead';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const FLUJO = () => sinComentarios(leer('app/automations/RecordatorioFlujo.tsx'));
/** El JSX de una prop del lienzo (`chrome={(` … hasta la prop siguiente). */
function prop(src: string, abre: string, cierra: string): string {
  const i = src.indexOf(abre);
  assert.ok(i >= 0, `no encontré «${abre}»`);
  const f = src.indexOf(cierra, i + abre.length);
  assert.ok(f > i, `no encontré «${cierra}» después de «${abre}»`);
  return src.slice(i, f);
}

const nodo = (g: { nodos: NodoFlujo[] }, id: string): NodoFlujo => {
  const n = g.nodos.find((x) => x.id === id);
  assert.ok(n, `no está la tarjeta ${id}`);
  return n;
};
const G = () => grafoRecordatorio({});
const ultimo = TOQUES[TOQUES.length - 1];

// ── El grafo (lib/recordatorio-grafo.ts) ─────────────────────────────────────────

test('1 DELAY: las esperas van EN la flecha, con lo que falta para la reunión; ninguna es una tarjeta', () => {
  const g = G();
  const esperas = g.nodos.filter((n) => n.tipo === 'espera');
  assert.equal(esperas.length, TOQUES.length);
  assert.ok(esperas.every((n) => n.enFlecha), 'una espera volvió a dibujarse como tarjeta DELAY');
  // La cadena: CRON → 24 h antes → toque → 1 h antes → toque → 15 min antes → toque.
  const cadena = g.aristas.map((a) => [a.desde, a.hasta, (a.esperas ?? []).map((e) => e.texto)]);
  assert.deepEqual(cadena, [
    [ID_ENTRADA, idToque(1440), [ANTES[1440]]],
    [idToque(1440), idToque(60), [ANTES[60]]],
    [idToque(60), idToque(15), [ANTES[15]]],
  ]);
  assert.deepEqual(ANTES, { 1440: '24 h antes', 60: '1 h antes', 15: '15 min antes' });
});

test('2 CRON: la tarjeta de una automatización (cajita, alto sumado, «Entonces») y sin «＋ Nuevo CRON»', () => {
  const cron = nodo(G(), ID_ENTRADA);
  assert.equal(cron.tipo, 'entrada');
  assert.equal(cron.titulo, TITULO.cron);
  assert.equal(cron.icono, ICONO_CRON);
  assert.equal(cron.salidaAlPie, true);
  assert.deepEqual(cron.puertos, [{ id: 'sig', vacio: false }]);
  assert.equal(rotuloDeFila(cron, cron.puertos![0]), ROTULO_ENTONCES);
  // El alto es el de UNA cajita con «Agendó una reunión» y sin el renglón de «＋ Nuevo CRON».
  assert.equal(cron.alto, altoCron([DISPARADOR_RECORDATORIO], false, 1));
  assert.notEqual(cron.alto, altoCron([DISPARADOR_RECORDATORIO], true, 1));
});

test('3 «Entonces» en cada mensaje que sigue, ningún «Siguiente paso», y sin flechas en paralelo', () => {
  const g = G();
  for (const min of TOQUES) {
    const n = nodo(g, idToque(min));
    assert.equal(n.titulo, TITULO.whatsapp);
    assert.equal(n.canal, 'whatsapp');
    if (min === ultimo) {
      assert.deepEqual(n.puertos, [], 'el último toque no sigue en nada: sin salida');
      assert.notEqual(n.salidaAlPie, true);
    } else {
      assert.equal(n.salidaAlPie, true);
      assert.deepEqual(n.puertos, [{ id: 'sig', vacio: false }]);
    }
  }
  for (const n of g.nodos) {
    for (const p of n.puertos ?? []) {
      assert.notEqual(rotuloDeFila(n, p), ROTULO_SIGUIENTE, `${n.id} invita a un siguiente paso que el emisor no manda`);
      assert.ok(!p.paralelo, `${n.id} ofrece una flecha en paralelo`);
    }
  }
});

test('4 el alto fijo de una automatización: el mismo constructor, el mismo alto, también con un texto largo', () => {
  const largo = 'Hola {{nombre}}, '.repeat(35).slice(0, TOPE_TEXTO);
  const textos = { 1440: largo, 60: '', 15: 'Corto' };
  const g = grafoRecordatorio(textos);
  const pasos = pasosDelRecordatorio(textos);
  for (const min of TOQUES) {
    const paso = pasos.find((p) => p.id === idToque(min))!;
    assert.equal(nodo(g, idToque(min)).alto, altoDeMensaje(paso) + (min === ultimo ? 0 : ALTO_PUERTO));
  }
  // Un mensaje igual en una automatización mide lo mismo (y no crece con el texto: tiene tope).
  const sec = grafoDeSecuencia([{ id: 'm', canal: 'whatsapp', proveedor: 'no_oficial', tipo: 'texto', cuerpo: largo }], { disparador: 'X' });
  assert.equal(nodo(g, idToque(1440)).alto, nodo(sec, 'm').alto);
  assert.ok(nodo(g, idToque(1440)).alto < 70 + Math.ceil(largo.length / 34) * 18, 'la tarjeta volvió a crecer con el texto');
});

test('un texto vacío dibuja el de fábrica: es el que sale', () => {
  assert.equal(textoQueSale({ 60: '  ' }, 60), TEXTO_DEFAULT[60]);
  assert.equal(textoQueSale({ 60: 'Mío' }, 60), 'Mío');
  const vacio = grafoRecordatorio({ 15: '' });
  assert.equal(nodo(vacio, idToque(15)).alto, nodo(G(), idToque(15)).alto);
  assert.equal(nodo(vacio, idToque(15)).advertencia, undefined, 'un toque vacío no está «Sin escribir»: sale el de fábrica');
});

test('las pastillas no pisan las tarjetas: cada flecha mide lo que pide la suya', () => {
  const g = G();
  for (const a of g.aristas) {
    const d = nodo(g, a.desde);
    const h = nodo(g, a.hasta);
    for (const e of a.esperas ?? []) {
      const r = posicionDePildora(g, e.id);
      assert.ok(r, `la pastilla ${e.id} no tiene lugar`);
      assert.ok(r.x >= d.x + d.ancho + AIRE_PILDORA - 1, `${e.id} pisa la tarjeta de la izquierda (${r.x} < ${d.x + d.ancho})`);
      assert.ok(r.x + r.ancho <= h.x - AIRE_PILDORA + 1, `${e.id} pisa la tarjeta de la derecha (${r.x + r.ancho} > ${h.x})`);
      // El nodo de la espera está donde está su pastilla (el lienzo lo usa para correr la vista).
      const n = nodo(g, e.id);
      assert.deepEqual({ x: n.x, y: n.y }, { x: r.x, y: r.y });
      assert.equal(n.detalle, e.texto);
    }
  }
});

test('un dato que el emisor no conoce se marca en su tarjeta; y el freno de Publicar abre ESE toque', () => {
  const g = grafoRecordatorio({ 60: 'Hola {{nombre}} de {{negocio}}' });
  assert.equal(nodo(g, idToque(60)).advertencia, AVISO_DATO_DESCONOCIDO);
  assert.equal(nodo(g, idToque(1440)).advertencia, undefined);
  assert.deepEqual(frenoDelRecordatorio({ 60: 'Hola {{negocio}}' }), { error: 'No existe: {{negocio}}', toque: 60 });
  assert.deepEqual(frenoDelRecordatorio({ 15: 'x'.repeat(TOPE_TEXTO + 1) }), { error: `Máximo ${TOPE_TEXTO} caracteres.`, toque: 15 });
  assert.equal(frenoDelRecordatorio({ 1440: '', 60: TEXTO_DEFAULT[60], 15: 'Hola {{nombre}}, {{faltan}}' }), null);
});

test('sólo los mensajes se abren: ni el CRON ni las esperas', () => {
  assert.equal(esTarjetaDeToque(idToque(60)), true);
  assert.equal(esTarjetaDeToque('espera-60'), false);
  assert.equal(esTarjetaDeToque(ID_ENTRADA), false);
  assert.equal(esTarjetaDeToque('toque-30'), false, 'un toque que el emisor no tiene');
  assert.equal(toqueDeId('espera-1440'), 1440);
  assert.equal(toqueDeId(null), null);
});

// ── El componente (app/automations/RecordatorioFlujo.tsx) ─────────────────────────

test('el grafo sale de `grafoRecordatorio` y las tarjetas son las piezas de una automatización', () => {
  const r = FLUJO();
  assert.match(r, /const grafo = useMemo\(\(\) => grafoRecordatorio\(edicion\.textos\), \[edicion\.textos\]\);/);
  assert.doesNotMatch(r, /poner\(\{|tipo: 'espera'|titulo: |ANCHO_ESPERA|encerrar\(/, 'el recordatorio volvió a armar nodos a mano');
  assert.match(r, /import \{ CuerpoCron, renglonesDeTarjeta \} from '\.\/FlujoLienzo';/);
  assert.match(r, /<CuerpoCron disparadores=\{\[\.\.\.DISPARADORES_RECORDATORIO\]\} \/>/);
  assert.match(r, /<BurbujaHilo compacta saliente autor=\{negocio\} lineas=\{renglonesDeTarjeta\(paso, 0\)\} contenido=\{\{ texto: paso\.cuerpo \}\} \/>/);
  // Y las esperas siguen sin abrirse.
  assert.match(r, /onSeleccion=\{\(id\) => setSel\(esTarjetaDeToque\(id\) \? id : null\)\}/);
});

test('6 la cabecera del panel: el número de ESE toque (sin la palabra «WhatsApp» ni el renglón de más)', () => {
  const r = FLUJO();
  const cab = prop(r, 'tituloEditor={(n) => {', 'renderEditor={(n) => {');
  assert.match(cab, /<CabeceraWhatsApp paso=\{pasoDeToque\(min, '', edicion\.lineas\[min\] \?\? null\)\} lineaAutomatizacion=\{null\}/);
  assert.match(cab, /onLinea=\{\(l\) => ponerLinea\(min, l\)\}/);
  // El ✦ espera a que el que ayuda a escribir conozca las variables de este emisor (ver la cabecera).
  assert.match(cab, /conMako=\{false\}/);
  const editor = prop(r, 'renderEditor={(n) => {', 'chrome={(');
  assert.doesNotMatch(editor, /ANTES\[/, 'volvió el renglón «24 h antes de la reunión» arriba del editor');
  // Los números se publican con los textos, una sola vez.
  const publicar = prop(r, 'const publicar = async', 'const grafo = useMemo');
  assert.match(publicar, /lineas: Object\.fromEntries\(TOQUES\.map\(\(m\) => \[m, edicion\.lineas\[m\] \?\? null\]\)\)/);
});

test('5 «Activar» va al lado de «Publicar», con el error; el título queda solo', () => {
  const r = FLUJO();
  const chrome = prop(r, 'chrome={(', 'accion={(');
  const pie = r.slice(r.indexOf('accion={('));
  assert.doesNotMatch(chrome, /Activar|role="alert"/, '«Activar» (o el error) volvió al lado del título');
  const iActivar = pie.indexOf('aria-label="Activar el recordatorio"');
  const iPublicar = pie.indexOf("{guardando === 'textos' ? 'Publicando…' : 'Publicar'}");
  const iError = pie.indexOf('role="alert"');
  assert.ok(iError >= 0 && iActivar > iError && iPublicar > iActivar, 'el error → «Activar» → «Publicar», en ese orden');
  assert.match(chrome, /\{EMOJI_RECORDATORIO\}/);
});

test('un guardado a la vez: «Activar» y «Publicar» escriben el MISMO setting', () => {
  // La ruta lee, cambia y escribe el setting ENTERO: con los dos en vuelo, el último pisa al otro.
  const r = FLUJO();
  assert.match(r, /const ocupado = guardando != null;/);
  const pie = r.slice(r.indexOf('accion={('));
  assert.match(pie, /<button onClick=\{\(\) => void activar\(\)\} disabled=\{ocupado\}/);
  assert.match(pie, /<button onClick=\{\(\) => void publicar\(\)\} disabled=\{!sinPublicar \|\| ocupado\}/);
});

test('el título lleva el MISMO emoji que su fila de la lista', () => {
  const propio = /export const EMOJI_RECORDATORIO = '([^']+)';/.exec(FLUJO())?.[1];
  assert.ok(propio, 'el recordatorio no declara su emoji');
  // Hasta que la lista lo importe de acá (lo deja anotado el informe), son dos constantes: que digan
  // lo mismo. Con el import, la de la lista desaparece y esto pasa por la otra rama.
  const lista = sinComentarios(leer('app/automations/SimuladorWhatsApp.tsx'));
  const deLaLista = /const EMOJI_RECORDATORIO = '([^']+)';/.exec(lista)?.[1];
  if (deLaLista) assert.equal(propio, deLaLista, 'el título y la fila del recordatorio muestran emojis distintos');
  else assert.match(lista, /import \{[^}]*\bEMOJI_RECORDATORIO\b[^}]*\} from '\.\/RecordatorioFlujo';/);
});

test('7 el panel grande de `muelles`, por tipo de tarjeta, como un mensaje de una automatización', () => {
  const r = FLUJO();
  assert.match(r, /const talla = editorDeTarjeta\(muelles, sel != null \? grafo\.nodos\.find\(\(n\) => n\.id === sel\)\?\.tipo : null\);/);
  assert.match(r, /panelForma=\{formaPanel\} panelAncho=\{talla\.ancho\} panelAlto=\{talla\.alto\}/);
  assert.match(r, /insetIzq=\{izq\} insetDer=\{muelles \? muelles\.insets\.der : insetDer\}/);
  // Y quien lo monta se lo pasa (la línea del montaje en la lista).
  const lista = sinComentarios(leer('app/automations/SimuladorWhatsApp.tsx'));
  assert.match(lista, /<RecordatorioFlujo negocio=\{negocio\} insetIzq=\{m\.insets\.izq\} muelles=\{m\} onSinPublicar=\{setSinPublicar\} onCambio=\{setRecordatorioActivo\} \/>/);
});

test('8 la pila de deshacer apila las decisiones (no tipear) y el click derecho publica', () => {
  const r = FLUJO();
  assert.match(r, /usePilaDeshacer<Edicion>\(/);
  const ponerTexto = prop(r, 'const ponerTexto = ', 'const ponerLinea = ');
  const ponerLinea = prop(r, 'const ponerLinea = ', 'const volverAlOriginal = ');
  const original = prop(r, 'const volverAlOriginal = ', 'const publicados = ');
  assert.doesNotMatch(ponerTexto, /fotoAntes\(\)/, 'tipear no entra a la pila: el Ctrl+Z del texto es del navegador');
  assert.match(ponerLinea, /fotoAntes\(\);/);
  assert.match(original, /fotoAntes\(\);/);
  const menu = prop(r, 'menuLienzo={() => [{', '}]}');
  assert.match(menu, /label: 'Publicar'/);
  assert.match(menu, /deshabilitado: !sinPublicar \|\| ocupado, onElegir: \(\) => void publicar\(\)/);
  assert.doesNotMatch(r, /onAgregarTras|onBorrar|onConectar|menuNodo/, 'el emisor manda los tres toques: no se agregan, borran ni conectan');
});

test('9 lo no publicado se avisa a la lista (y se suelta al irse) y al cerrar la pestaña', () => {
  const r = FLUJO();
  assert.match(r, /const sinPublicar = publicados != null && !mismaEdicion\(edicion, publicados\);/);
  assert.match(r, /useEffect\(\(\) => \{ avisarSinPublicar\.current\?\.\(sinPublicar\); \}, \[sinPublicar\]\);/);
  assert.match(r, /useEffect\(\(\) => \(\) => \{ avisarSinPublicar\.current\?\.\(false\); \}, \[\]\);/);
  assert.match(r, /if \(!sinPublicar\) return;\n\s+const alSalir = \(e: BeforeUnloadEvent\) => \{ e\.preventDefault\(\); e\.returnValue = ''; \};\n\s+window\.addEventListener\('beforeunload', alSalir\);/);
});

test('Publicar frena con la MISMA pregunta que la ruta y abre la tarjeta culpable', () => {
  const r = FLUJO();
  const publicar = prop(r, 'const publicar = async', 'const grafo = useMemo');
  const iFreno = publicar.indexOf('const freno = frenoDelRecordatorio(edicion.textos);');
  assert.ok(iFreno >= 0 && iFreno < publicar.indexOf('guardar('), 'el freno va ANTES de mandar');
  assert.match(publicar, /if \(freno\) \{ setErr\(freno\.error\); setSel\(idToque\(freno\.toque\)\); return; \}/);
  assert.match(sinComentarios(leer('lib/recordatorio-grafo.ts')), /const error = problemaDelTexto\(textos\[min\] \?\? ''\);/);
  assert.match(sinComentarios(leer('app/api/chat-agent/recordatorio-reunion/route.ts')), /const problema = problemaDelTexto\(v\);/);
});

test('ningún hook detrás del return del giro de carga', () => {
  const r = FLUJO();
  const iReturn = r.indexOf('if (!estado) {\n    return (');
  assert.ok(iReturn > 0, 'no encontré el return de la carga');
  assert.doesNotMatch(r.slice(iReturn), /\buse[A-Z]\w*\(/, 'un hook después de un return: React #300 en producción');
});

// ROTURAS (10/10/2026), una por vez, aplicadas y restauradas DE MEMORIA (nunca con git checkout) por
// un arnés que verifica md5 idéntico al restaurar. Base en verde: 18 pass / 0 fail. Pasan / fallan:
//   lib/recordatorio-grafo.ts
//   · las esperas vuelven a dibujarse como tarjetas                              -> 16 / 2
//   · la espera como mensaje (fuera del modelo del flujo)                        -> 17 / 1
//   · el CRON con «＋ Nuevo CRON»                                                -> 17 / 1
//   · vuelve «Siguiente paso» en el último toque                                 -> 16 / 2
//   · las salidas ofrecen flechas en paralelo                                    -> 16 / 2
//   · la tarjeta vuelve a crecer con el texto (la fórmula de antes)              -> 17 / 1
//   · un texto vacío dibuja vacío, no el de fábrica                              -> 16 / 2
//   · las flechas no se ensanchan por su pastilla                                -> 17 / 1
//   · un dato desconocido no se marca en la tarjeta                              -> 17 / 1
//   · el freno no pregunta nada                                                  -> 16 / 2
//   · las esperas se abren (`esTarjetaDeToque` acepta `espera-`)                 -> 17 / 1
//   · un título escrito a mano («Mensaje»)                                       -> 17 / 1
//   app/automations/RecordatorioFlujo.tsx
//   · el CRON sin `CuerpoCron`; la burbuja sin `renglonesDeTarjeta`              -> 17 / 1 cada una
//   · el ✦ prendido (`conMako`) sin las variables del emisor                     -> 17 / 1
//   · «Activar» al lado del título; el error al lado del título                  -> 17 / 1 cada una
//   · el panel sin `panelForma`/`panelAncho`/`panelAlto`                         -> 17 / 1
//   · tipear entra a la pila; cambiar el número no entra                         -> 17 / 1 cada una
//   · «Publicar» del click derecho prendido sin cambios                          -> 17 / 1
//   · sin avisar lo no publicado a la lista; sin el `beforeunload`               -> 17 / 1 cada una
//   · el freno sin abrir la tarjeta culpable                                     -> 17 / 1
//   · un `useMemo` después del return de la carga                                -> 17 / 1
//   · el título con otro emoji que su fila                                       -> 17 / 1
//   · Publicar sin los números; las esperas abriéndose (`setSel(id)`)            -> 17 / 1 cada una
//   · `ocupado` sólo al publicar; «Activar» apretable mientras se publica         -> 17 / 1 cada una
//   app/automations/SimuladorWhatsApp.tsx
//   · el montaje sin `muelles` ni `onSinPublicar`                                -> 17 / 1
//   lib/recordatorio-lead.ts · la ruta
//   · `problemaDelTexto` sin el tope; la ruta con su propia validación           -> 17 / 1 cada una
// ⚠️ La primera versión de la rotura «las esperas vuelven a ser tarjetas» (un `paralelos` igual al
// `siguiente`) salió CIEGA, 17 / 0: `normalizar` saca ese paralelo y la espera colapsaba igual. No era
// un agujero del test sino una rotura que no rompía nada; se reemplazó por las dos de arriba.

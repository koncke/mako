// =============================================================================
// El flujo de un AVISO, dibujado: nodos que no pueden mentir
// =============================================================================
// El pedido llegó apuntando a Configuraciones › Notificaciones: «una pantalla
// tipo flujo, y ahí se edita todo». Un aviso es un flujo CORTO —tres o cinco
// nodos, no los veinte de un bot— y eso cambia qué hay que perseguir. No hay
// maraña que domar: lo que el dibujo tiene que hacer bien es no afirmar de más.
//
// Y la segunda tanda dejó una regla que vale para cualquier lienzo de esta casa:
// **un nodo es algo que OCURRE**. «Te llega al grupo de WhatsApp» era un nodo y
// el dueño lo marcó con una frase que lo resume — «es un paso que no hace nada».
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  grafoDeAviso, cadaCuanto, porDondeLlega, podarPosiciones, textoDisparador,
  type AvisoParaGrafo,
} from '../lib/flujo-aviso';
import { FRECUENCIAS } from '../lib/disparador-mensaje';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

const aviso = (p: Partial<AvisoParaGrafo> = {}): AvisoParaGrafo => ({
  disparador: 'Cron los lunes a la mañana', frecuenciaMin: 0, texto: 'Hola',
  canales: { wa: true, email: false }, insistir: null, evento: null, pasos: [], ...p,
});

test('Tres nodos: qué lo dispara, el mensaje, y si no contestas', () => {
  const g = grafoDeAviso(aviso());
  assert.deepEqual(g.nodos.map((n) => n.id), ['entrada', 'mensaje', 'respuesta']);
});

test('⚠️ «Te llega al grupo» NO es un nodo: un nodo es algo que OCURRE', () => {
  // Por dónde sale un mensaje es una PROPIEDAD del mensaje, no un paso del flujo.
  // Dibujarla como paso hace que el grafo cuente un hecho de más — y encima uno
  // que no se puede tocar desde ahí, porque el canal se elige al entrar.
  const g = grafoDeAviso(aviso());
  assert.ok(!g.nodos.some((n) => n.id === 'salida'), 'volvió el nodo que no hacía nada');
  assert.match(g.nodos.find((n) => n.id === 'mensaje')?.titulo ?? '', /WhatsApp/,
    'el destino tiene que leerse en el propio nodo del mensaje');
});

test('El recordatorio cuelga de SI NO CONTESTAS, no del mensaje', () => {
  // Es lo que el formulario no podía decir: apilado, «¿y si no contestas?» se leía
  // como un bloque más que ocurre siempre, en fila con los otros tres.
  const g = grafoDeAviso(aviso({ insistir: { cadaMin: 30, veces: 3 } }));
  const a = g.aristas.find((x) => x.hasta === 'recordatorio');
  assert.equal(a?.desde, 'respuesta', 'el recordatorio se colgó del nodo equivocado');
  assert.equal(a?.tono, 'condicional');
  assert.match(g.nodos.find((n) => n.id === 'recordatorio')?.detalle ?? '', /Cada 30 minutos, hasta 3 veces/);
});

test('⚠️ Con los DOS canales apagados, el MENSAJE lo dice y la flecha se pone mala', () => {
  // El aviso no sale por ningún lado y eso no se veía en ninguna pantalla: los
  // chips de canal se fueron del detalle a propósito, así que el único lugar donde
  // puede aparecer es acá.
  const g = grafoDeAviso(aviso({ canales: { wa: false, email: false } }));
  const m = g.nodos.find((n) => n.id === 'mensaje')!;
  assert.match(m.titulo, /ning[úu]n lado/i);
  assert.ok(m.advertencia, 'un mensaje que no sale por ningún lado tiene que estar marcado');
  assert.equal(g.aristas.find((a) => a.hasta === 'mensaje')?.tono, 'mala');
});

test('⚠️ Un recordatorio sin WhatsApp está dibujando algo que no puede ocurrir', () => {
  // El choke point abre la insistencia ADENTRO del `if` del envío al grupo: sin
  // WhatsApp, no hay recordatorio posible. Se dice, no se esconde.
  const conWa = grafoDeAviso(aviso({ insistir: { cadaMin: 30, veces: 2 }, canales: { wa: true, email: true } }));
  assert.equal(conWa.nodos.find((n) => n.id === 'recordatorio')?.advertencia, undefined);
  const sinWa = grafoDeAviso(aviso({ insistir: { cadaMin: 30, veces: 2 }, canales: { wa: false, email: true } }));
  assert.match(sinWa.nodos.find((n) => n.id === 'recordatorio')?.advertencia ?? '', /WhatsApp/);
});

// ── Los disparadores que se suman ───────────────────────────────────────────

test('Un evento elegido se suma al hecho nativo, no lo reemplaza', () => {
  // El aviso sigue saliendo por su camino de siempre. Lo que se elige acá es un
  // disparador MÁS, y el nodo tiene que decir las dos cosas: si dijera sólo el
  // evento, apagaría en la pantalla un camino que en el motor sigue vivo.
  const t = textoDisparador({ disparador: 'Cron los lunes', evento: { tipo: 'evento', evento: 'lead.agendo' } });
  assert.match(t, /Cron los lunes/);
  assert.match(t, /también/i);
  assert.equal(textoDisparador({ disparador: 'Cron los lunes', evento: null }), 'Cron los lunes');
});

test('⚠️ Un paso agregado SIN evento se dibuja con su advertencia', () => {
  // Los pasos del flujo los ejecuta `dispararEvento` y nada más. Sin un evento
  // elegido quedan dibujados y quietos — y un paso que no corre y no lo dice es
  // el control que se dibuja y no hace nada.
  const sin = grafoDeAviso(aviso({ pasos: [{ tipo: 'accion', accion: 'crear_tarea' }] }));
  assert.match(sin.nodos.find((n) => n.id === 'paso-0')?.advertencia ?? '', /evento/i);
  const con = grafoDeAviso(aviso({
    pasos: [{ tipo: 'accion', accion: 'crear_tarea' }],
    evento: { tipo: 'evento', evento: 'lead.agendo' },
  }));
  assert.equal(con.nodos.find((n) => n.id === 'paso-0')?.advertencia, undefined);
  assert.equal(con.aristas.find((a) => a.hasta === 'paso-0')?.tono, 'buena');
});

test('Los pasos se encadenan después del mensaje, en orden', () => {
  const g = grafoDeAviso(aviso({
    evento: { tipo: 'evento', evento: 'lead.agendo' },
    pasos: [{ tipo: 'accion', accion: 'crear_tarea' }, { tipo: 'mensaje', canal: 'wa_lead', texto: 'hola' }],
  }));
  assert.equal(g.aristas.find((a) => a.hasta === 'paso-0')?.desde, 'mensaje');
  assert.equal(g.aristas.find((a) => a.hasta === 'paso-1')?.desde, 'paso-0');
  assert.equal(g.nodos.find((n) => n.id === 'paso-1')?.tipo, 'mensaje-lead');
});

// ── Dónde quedó cada tarjeta ────────────────────────────────────────────────

test('Una posición guardada gana sobre la calculada', () => {
  const g = grafoDeAviso(aviso({ posiciones: { mensaje: { x: 900, y: 40 } } }));
  const m = g.nodos.find((n) => n.id === 'mensaje')!;
  assert.equal(m.x, 900);
  assert.equal(m.y, 40);
  // Y el que NO tiene posición guardada nace en su lugar calculado, no en el origen.
  assert.ok((g.nodos.find((n) => n.id === 'entrada')?.x ?? 0) > 0);
});

test('Las posiciones de nodos que ya no existen se podan', () => {
  // Sin esto, borrar un paso deja su coordenada para siempre y el próximo con el
  // mismo id nace en el lugar del que se fue.
  const podado = podarPosiciones({ mensaje: { x: 1, y: 2 }, 'paso-9': { x: 3, y: 4 } }, ['entrada', 'mensaje']);
  assert.deepEqual(Object.keys(podado), ['mensaje']);
});

test('La caja del grafo crece con la tarjeta que se arrastró lejos', () => {
  // El encuadre automático mira esta caja: si no creciera, arrastrar una tarjeta
  // hacia afuera la dejaría fuera de cuadro para siempre.
  const g = grafoDeAviso(aviso({ posiciones: { respuesta: { x: 1500, y: 700 } } }));
  assert.ok(g.ancho > 1500);
  assert.ok(g.alto > 700);
});

// ── El resto ────────────────────────────────────────────────────────────────

test('Cada cuánto viaja en la FLECHA y sale del catálogo compartido', () => {
  // El rótulo no se escribe dos veces: si se separa del desplegable que lo elige,
  // la flecha dice una cosa y el control otra sobre el mismo número.
  assert.equal(cadaCuanto(0), 'Cada vez que pasa');
  const unDia = FRECUENCIAS.find((f) => f.min === 24 * 60)!;
  assert.equal(cadaCuanto(unDia.min), unDia.label.replace('Máximo uno ', 'Como máximo '));
  assert.equal(grafoDeAviso(aviso()).aristas.find((a) => a.hasta === 'mensaje')?.etiqueta, 'Cada vez que pasa');
});

test('Por dónde llega dice los DOS canales cuando los dos están prendidos', () => {
  assert.match(porDondeLlega({ wa: true, email: true }), /WhatsApp y a tu correo/);
  assert.match(porDondeLlega({ wa: false, email: true }), /correo/);
  assert.match(porDondeLlega({ wa: true, email: false }), /WhatsApp/);
});

test('Ningún nodo se pisa, y toda arista une nodos que existen', () => {
  const g = grafoDeAviso(aviso({
    texto: 'x'.repeat(500), insistir: { cadaMin: 30, veces: 5 },
    evento: { tipo: 'evento', evento: 'lead.agendo' },
    pasos: [{ tipo: 'accion', accion: 'crear_tarea' }],
  }));
  const ids = new Set(g.nodos.map((n) => n.id));
  for (const a of g.aristas) {
    assert.ok(ids.has(a.desde) && ids.has(a.hasta), `arista suelta: ${a.desde}→${a.hasta}`);
  }
  for (let i = 0; i < g.nodos.length; i++) {
    for (let j = i + 1; j < g.nodos.length; j++) {
      const a = g.nodos[i]!, b = g.nodos[j]!;
      const pisa = a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto;
      assert.ok(!pisa, `${a.id} y ${b.id} se pisan`);
    }
  }
});

// ── Que no aparezca un segundo editor de nada ───────────────────────────────

test('UN solo dueño del flujo', () => {
  // `Recordatorios` escribía el paso `insistir` por su cuenta. Con el lienzo
  // tocando también el disparador, eso eran dos dueños del MISMO objeto — y
  // `setFlujo` reemplaza el flujo entero, así que el segundo en guardar se llevaba
  // puesto lo del primero. Se absorbió en el lienzo con todo lo suyo.
  const src = leer('../app/agencia/FlujoAviso.tsx');
  assert.match(src, /'flujo-set'/, 'el lienzo dejó de escribir el flujo');
  assert.match(src, /INSISTIR_MAX_VECES/, 'se perdió el techo dicho de la insistencia');
  const modal = leer('../app/agencia/TemplateDetalleModal.tsx');
  assert.ok(!/Recordatorios/.test(modal), 'volvió el segundo escritor del flujo');
});

test('Los nodos montan los controles que YA existían, no copias', () => {
  const src = leer('../app/agencia/FlujoAviso.tsx');
  for (const pieza of ['Disparador', 'EditorMensaje']) {
    assert.match(src, new RegExp('<' + pieza + '[\\s\\n]'), `el nodo dejó de montar ${pieza}: ¿se copió su control?`);
  }
  assert.ok(!/action: 'frecuencia'/.test(src), 'el lienzo escribió la frecuencia por su cuenta');
});

test('El detalle monta el lienzo y ya no apila los bloques', () => {
  const src = leer('../app/agencia/TemplateDetalleModal.tsx');
  assert.match(src, /<FlujoAviso/, 'el detalle dejó de montar el lienzo');
  assert.ok(!/<Disparador[\s\n]/.test(src), 'volvió el bloque suelto del disparador');
  assert.ok(!/<EditorMensaje[\s\n]/.test(src), 'volvió el textarea suelto del mensaje');
});

test('⚠️ El contenedor del lienzo no lleva `margin: 0 auto`', () => {
  // `margin-inline: auto` en un ITEM FLEX apaga el estirado y lo deja del ancho de
  // su contenido. Medido: el lienzo quedó en 344 px dentro de un panel de 1130 y se
  // dibujó al 33% — ilegible, y sin ningún error.
  //
  // SE MIRA EL ARCHIVO ENTERO. La primera versión recortaba 1400 caracteres antes
  // del montaje y el contenedor estaba ochenta líneas más arriba, así que devolver
  // el bug pasaba en VERDE. Lo cazó romperlo, no leerlo.
  const src = leer('../app/agencia/TemplateDetalleModal.tsx');
  assert.ok(!/margin: '0 auto'/.test(src), 'volvió el margin auto que encoge al lienzo');
  assert.ok(!/maxWidth: 560, margin/.test(src), 'volvió el tope que ahogaba el dibujo');
});

test('⚠️ El lienzo ocupa el recuadro: el chrome FLOTA', () => {
  // «El lienzo tiene que ocupar absolutamente todo el recuadro, incluso donde dice
  // "cerrar el editor", de lo contrario se ve muy chico.» Entre la topbar, la
  // cabecera y el pie le comían ~180 px de 620.
  const modal = leer('../app/agencia/TemplateDetalleModal.tsx');
  assert.match(modal, /chrome=\{/, 'el chrome dejó de flotar sobre el lienzo');
  const lienzo = leer('../app/_components/Lienzo.tsx');
  assert.match(lienzo, /chrome \?\? |chrome &&/, 'el lienzo dejó de aceptar chrome flotante');
  assert.match(lienzo, /sinMarco/, 'sin esto quedan dos marcos anidados');
});

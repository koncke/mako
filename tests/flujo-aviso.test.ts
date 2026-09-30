// =============================================================================
// El flujo de un AVISO, dibujado: cuatro nodos que no pueden mentir
// =============================================================================
// El pedido llegó apuntando a Configuraciones › Notificaciones: «Quiero que los
// editables del flujo de conversación sea como el editable de Manychat, que tiene
// una pantalla tipo flujo, y ahí se edita todo».
//
// Un aviso es un flujo CORTO —cuatro o cinco nodos, no los veinte de un bot— y eso
// cambia qué hay que perseguir. No hay maraña que domar: lo que el dibujo tiene que
// hacer bien es no afirmar de más. Un nodo «te llega al grupo de WhatsApp» sobre un
// mensaje con los dos canales apagados es peor que el formulario que reemplazó.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { grafoDeAviso, cadaCuanto, porDondeLlega, type AvisoParaGrafo } from '../lib/flujo-aviso';
import { FRECUENCIAS } from '../lib/disparador-mensaje';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

const aviso = (p: Partial<AvisoParaGrafo> = {}): AvisoParaGrafo => ({
  disparador: 'Cron los lunes a la mañana', frecuenciaMin: 0, texto: 'Hola',
  canales: { wa: true, email: false }, insistir: null, activo: true, ...p,
});

test('Cuatro nodos: qué lo dispara, el mensaje, por dónde llega, y si no contestas', () => {
  const g = grafoDeAviso(aviso());
  assert.deepEqual(g.nodos.map((n) => n.id), ['entrada', 'mensaje', 'salida', 'respuesta']);
  assert.equal(g.nodos.filter((n) => n.id === 'recordatorio').length, 0);
});

test('El recordatorio cuelga de SI NO CONTESTAS, no de la salida del mensaje', () => {
  // Es lo que el formulario no podía decir: apilado, «¿y si no contestas?» se leía
  // como un bloque más que ocurre siempre, en fila con los otros tres.
  const g = grafoDeAviso(aviso({ insistir: { cadaMin: 30, veces: 3 } }));
  assert.ok(g.nodos.some((n) => n.id === 'recordatorio'));
  const a = g.aristas.find((x) => x.hasta === 'recordatorio');
  assert.equal(a?.desde, 'respuesta', 'el recordatorio se colgó del nodo equivocado');
  assert.equal(a?.tono, 'condicional');
  assert.match(g.nodos.find((n) => n.id === 'recordatorio')?.detalle ?? '', /Cada 30 minutos, hasta 3 veces/);
});

test('⚠️ Con los DOS canales apagados, la salida lo dice y la flecha se pone mala', () => {
  // El aviso no sale por ningún lado y hoy eso no se veía en ninguna pantalla: los
  // chips de canal se fueron del detalle a propósito, así que el único lugar donde
  // puede aparecer es acá.
  const g = grafoDeAviso(aviso({ canales: { wa: false, email: false } }));
  const s = g.nodos.find((n) => n.id === 'salida')!;
  assert.match(s.detalle ?? '', /ning[úu]n lado/i);
  assert.ok(s.advertencia, 'un mensaje que no sale por ningún lado tiene que estar marcado');
  assert.equal(g.aristas.find((a) => a.hasta === 'salida')?.tono, 'mala');
});

test('⚠️ Un recordatorio sin WhatsApp está dibujando algo que no puede ocurrir', () => {
  // El choke point abre la insistencia ADENTRO del `if` del envío al grupo: sin
  // WhatsApp, no hay recordatorio posible. Se dice, no se esconde.
  const conWa = grafoDeAviso(aviso({ insistir: { cadaMin: 30, veces: 2 }, canales: { wa: true, email: true } }));
  assert.equal(conWa.nodos.find((n) => n.id === 'recordatorio')?.advertencia, undefined);
  const sinWa = grafoDeAviso(aviso({ insistir: { cadaMin: 30, veces: 2 }, canales: { wa: false, email: true } }));
  assert.match(sinWa.nodos.find((n) => n.id === 'recordatorio')?.advertencia ?? '', /WhatsApp/);
});

test('Cada cuánto viaja en la FLECHA y sale del catálogo compartido', () => {
  // El rótulo no se escribe dos veces: si se separa del desplegable que lo elige,
  // la flecha dice una cosa y el control otra sobre el mismo número.
  assert.equal(cadaCuanto(0), 'Cada vez que pasa');
  const unDia = FRECUENCIAS.find((f) => f.min === 24 * 60)!;
  assert.equal(cadaCuanto(unDia.min), unDia.label.replace('Máximo uno ', 'Como máximo '));
  assert.equal(grafoDeAviso(aviso({ frecuenciaMin: 0 })).aristas.find((a) => a.hasta === 'mensaje')?.etiqueta, 'Cada vez que pasa');
});

test('Por dónde llega dice los DOS canales cuando los dos están prendidos', () => {
  assert.match(porDondeLlega({ wa: true, email: true }), /WhatsApp y a tu correo/);
  assert.match(porDondeLlega({ wa: false, email: true }), /correo/);
  assert.match(porDondeLlega({ wa: true, email: false }), /WhatsApp/);
});

test('Ningún nodo se pisa, y toda arista une nodos que existen', () => {
  const g = grafoDeAviso(aviso({ texto: 'x'.repeat(500), insistir: { cadaMin: 30, veces: 5 } }));
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
  for (const n of g.nodos) {
    assert.ok(n.x + n.ancho <= g.ancho && n.y + n.alto <= g.alto, `${n.id} se sale de la caja`);
  }
});

// ── Que no aparezca un segundo editor de nada ───────────────────────────────

test('Los nodos montan los controles que YA existían, no copias', () => {
  // Reescribir el desplegable de frecuencia o los recordatorios adentro del lienzo
  // habría dejado dos escrituras del mismo dato — que es lo que esta tab pagó con
  // los dos interruptores de canal que decían cosas distintas.
  const src = leer('../app/agencia/FlujoAviso.tsx');
  for (const pieza of ['Disparador', 'Recordatorios', 'EditorMensaje']) {
    assert.match(src, new RegExp(`<${pieza}\\b`), `el nodo dejó de montar ${pieza}: ¿se copió su control?`);
  }
  assert.ok(!/action: 'frecuencia'/.test(src), 'el lienzo escribió la frecuencia por su cuenta');
  assert.ok(!/flujo-set/.test(src), 'el lienzo escribió el flujo por su cuenta');
});

test('El detalle monta el lienzo y ya no apila los tres bloques', () => {
  const src = leer('../app/agencia/TemplateDetalleModal.tsx');
  assert.match(src, /<FlujoAviso/, 'el detalle dejó de montar el lienzo');
  assert.ok(!/<Disparador\b/.test(src), 'volvió el bloque suelto del disparador');
  assert.ok(!/<Recordatorios\b/.test(src), 'volvió el bloque suelto de los recordatorios');
  assert.ok(!/<EditorMensaje\b/.test(src), 'volvió el textarea suelto del mensaje');
});

test('⚠️ El contenedor del lienzo no lleva `margin: 0 auto`', () => {
  // `margin-inline: auto` en un ITEM FLEX apaga el estirado y lo deja del ancho de
  // su contenido. Medido acá: el lienzo quedó en 344 px dentro de un panel de 1130
  // y se dibujó al 33% — ilegible, y sin ningún error. Es la misma trampa que ya
  // costó una barra partida en dos renglones en otra pantalla.
  //
  // Probado rompiéndolo: devolviendo `maxWidth: 560, margin: '0 auto'` → 1 fallo,
  // 9 pases.
  // ⚠️ SE MIRA EL ARCHIVO ENTERO, no los caracteres de arriba del `<FlujoAviso`. La
  // primera versión de este guard recortaba 1400 caracteres antes del montaje — y el
  // contenedor está ochenta líneas más arriba, así que devolver el `margin: '0 auto'`
  // pasaba en VERDE. Lo cazó romperlo, no leerlo.
  const src = leer('../app/agencia/TemplateDetalleModal.tsx');
  assert.ok(!/margin: '0 auto'/.test(src), 'volvió el margin auto que encoge al lienzo');
  assert.ok(!/maxWidth: 560/.test(src), 'volvió el tope de 560 que ahogaba el dibujo');
  assert.match(src, /width: '100%', flex: 1, minHeight: 0/, 'el contenedor dejó de estirar');
});

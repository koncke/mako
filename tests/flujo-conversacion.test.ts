// =============================================================================
// El flujo de conversación dibujado: que el grafo diga lo que el motor HACE
// =============================================================================
// El pedido, textual: «Quiero que los editables del flujo de conversación sea
// como el editable de Manychat, que tiene una pantalla tipo flujo, y ahí se edita
// todo».
//
// Un lienzo tiene una forma de fallar que una lista no tiene: **dibuja una
// afirmación**. Una flecha que se bifurca dice «acá el motor decide», y si el
// motor no decide, el dibujo miente con más autoridad que un campo en un
// formulario — porque se lee sin abrir nada y parece la estructura del sistema.
// De ahí la mitad de este archivo.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  grafoDeSecuencia, cuandoSale, CONDICIONES_VIVAS, CONDICION_TXT,
  type PasoParaGrafo,
} from '../lib/flujo-conversacion';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

const paso = (o: Partial<PasoParaGrafo> & { orden: number }): PasoParaGrafo => ({
  canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', ...o,
});

// ── La cadena ────────────────────────────────────────────────────────────────

test('El grafo arranca en la entrada y termina en el desenlace', () => {
  const g = grafoDeSecuencia([paso({ orden: 1 }), paso({ orden: 2, delay_horas: 24 })], null, 'No Agenda');
  const ids = g.nodos.map((n) => n.id);
  assert.deepEqual(ids.slice(0, 3), ['entrada', 'paso-1', 'paso-2']);
  assert.ok(ids.includes('desenlace'), 'sin desenlace, una secuencia no dice cuándo termina');
  const cadena = g.aristas.filter((a) => a.desde === 'entrada' || a.desde === 'paso-1');
  assert.ok(cadena.some((a) => a.desde === 'entrada' && a.hasta === 'paso-1'));
  assert.ok(cadena.some((a) => a.desde === 'paso-1' && a.hasta === 'paso-2'));
});

test('Los pasos se ordenan por `orden`, no por el orden del array', () => {
  // El array llega de la base y nadie garantiza el orden. Dibujarlo como viene
  // haría que la flecha del primer mensaje apunte al tercero.
  const g = grafoDeSecuencia([paso({ orden: 3 }), paso({ orden: 1 }), paso({ orden: 2 })], null, 'X');
  assert.deepEqual(g.nodos.filter((n) => n.tipo === 'mensaje').map((n) => n.orden), [1, 2, 3]);
});

test('El tiempo viaja en la FLECHA, y se dice como lo diría una persona', () => {
  const g = grafoDeSecuencia([paso({ orden: 1, delay_horas: 0 }), paso({ orden: 2, delay_horas: 24 })], null, 'X');
  const a1 = g.aristas.find((a) => a.hasta === 'paso-1');
  const a2 = g.aristas.find((a) => a.hasta === 'paso-2');
  assert.equal(a1?.etiqueta, 'Al instante');
  assert.equal(a2?.etiqueta, 'Al día siguiente');
});

test('Un paso anclado a la reunión cuenta HACIA ATRÁS', () => {
  // Es el caso de los recordatorios: `delay_horas` son horas ANTES de la reunión.
  // Dicho como los demás («2 horas después») diría exactamente lo contrario.
  assert.equal(cuandoSale(2, true, 'reunion'), '2 horas antes de la reunión');
  assert.equal(cuandoSale(0, false, 'reunion'), 'Al empezar la reunión');
  assert.equal(cuandoSale(1, true), '1 hora después');
  assert.equal(cuandoSale(48, true), '2 días después');
});

// ── Lo que ninguna pantalla mostraba: el encadenamiento ─────────────────────

test('El «Sigue con» se dibuja, y apunta a la secuencia que el desenlace nombra', () => {
  const g = grafoDeSecuencia([paso({ orden: 1 })],
    { desenlace: { logrado: 'agendo', logradoSecuencia: 'post-agenda' } },
    'No Agenda',
    [{ clave: 'post-agenda', nombre: 'Post-agenda' }]);
  const ir = g.nodos.find((n) => n.tipo === 'ir-a');
  assert.ok(ir, 'el encadenamiento no se dibujó: es la rama que ninguna pantalla mostraba');
  assert.equal(ir?.destinoExiste, true);
  assert.equal(ir?.detalle, 'Post-agenda');
  assert.ok(g.aristas.some((a) => a.desde === 'desenlace' && a.hasta === ir!.id && a.tono === 'buena'));
});

test('Un «Sigue con» que apunta a la nada se dibuja ROTO, no se esconde', () => {
  // Esconderlo deja al lead en el limbo sin que ninguna pantalla lo diga, que es
  // exactamente el problema que el encadenamiento por etapa vino a resolver.
  const g = grafoDeSecuencia([paso({ orden: 1 })],
    { desenlace: { falloSecuencia: 'la-que-borraron' } }, 'X', [{ clave: 'otra', nombre: 'Otra' }]);
  const ir = g.nodos.find((n) => n.tipo === 'ir-a');
  assert.ok(ir, 'se escondió un encadenamiento roto');
  assert.equal(ir?.destinoExiste, false);
  assert.match(ir?.detalle ?? '', /ya no existe/);
});

test('Sin desenlace encadenado no hay nodos «Sigue con» colgando', () => {
  const g = grafoDeSecuencia([paso({ orden: 1 })], { desenlace: {} }, 'X');
  assert.equal(g.nodos.filter((n) => n.tipo === 'ir-a').length, 0);
});

// ── La honestidad del dibujo ────────────────────────────────────────────────

test('⚠️ El dibujo sólo bifurca por las condiciones que el motor EVALÚA', () => {
  // `sin_respuesta` está escrito en 7 pasos de producción y el motor no lo mira:
  // cae de largo y el mensaje sale igual, haya contestado el lead o no. Una
  // flecha punteada ahí afirmaría una decisión que no ocurre.
  const viva = grafoDeSecuencia([paso({ orden: 1, requiere: 'respondio' })], null, 'X');
  assert.equal(viva.aristas.find((a) => a.hasta === 'paso-1')?.tono, 'condicional');
  assert.match(String(viva.aristas.find((a) => a.hasta === 'paso-1')?.etiqueta), /solo si contestó/);

  const muerta = grafoDeSecuencia([paso({ orden: 1, requiere: 'sin_respuesta' })], null, 'X');
  assert.equal(muerta.aristas.find((a) => a.hasta === 'paso-1')?.tono, 'normal',
    'se dibujó una bifurcación que el motor no ejecuta');
  assert.ok(!String(muerta.aristas.find((a) => a.hasta === 'paso-1')?.etiqueta).includes('solo si'),
    'la flecha promete un filtro que no existe');
  assert.equal(CONDICION_TXT.sin_respuesta, 'sale siempre');
});

test('⚠️ `CONDICIONES_VIVAS` dice lo mismo que el motor, medido en su fuente', () => {
  // El guard que ata el dibujo al motor. Sin esto, el día que alguien cablee
  // `sin_respuesta` en lib/nutricion.ts el lienzo sigue diciendo «sale siempre»
  // — y al revés, si alguien saca una rama, el lienzo la sigue dibujando.
  //
  // Probado rompiéndolo de dos formas, 17 pases y 1 fallo cada vez: sacando
  // 'primer_contacto' de CONDICIONES_VIVAS, y haciendo que el grafo vuelva a
  // dibujar cualquier `requiere` como bifurcación.
  // ⚠️ SE MIDEN LAS LÍNEAS QUE DECIDEN, NO TODAS LAS QUE NOMBRAN EL CAMPO. La
  // primera versión de este test contaba también el SANEO —`...(p.requiere ===
  // 'respondio' || … || p.requiere === 'sin_respuesta' ? …)`, que sólo dice qué
  // valores se guardan— y concluía que el motor evalúa las cuatro. O sea: midió el
  // universo equivocado y habría dado permiso para dibujar la bifurcación muerta.
  // Lo que decide si un paso SALE es un `if` del despachador o el `findIndex` que
  // salta al siguiente.
  const motor = leer('../lib/nutricion.ts')
    .replace(/^[ 	]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const chr10 = String.fromCharCode(10);
  const evalua = new Set<string>();
  for (const linea of motor.split(chr10)) {
    if (!/^\s*if \(/.test(linea) && !linea.includes('findIndex(')) continue;
    for (const m of linea.matchAll(/\w+\.requiere === '([a-z_]+)'/g)) evalua.add(m[1]!);
  }
  assert.ok(evalua.size > 0, 'no se encontró una sola condición en el motor: el guard se quedó ciego');
  assert.deepEqual(
    [...CONDICIONES_VIVAS].sort(),
    [...evalua].sort(),
    `el motor evalúa ${[...evalua].sort().join(', ')} y el lienzo cree que evalúa ${[...CONDICIONES_VIVAS].sort().join(', ')}`,
  );
});

// ── El hueco, y la forma ────────────────────────────────────────────────────

test('Una secuencia sin mensajes dibuja el HUECO, no un lienzo vacío', () => {
  const g = grafoDeSecuencia([], null, 'No Agenda');
  const hueco = g.nodos.find((n) => n.tipo === 'suelto');
  assert.ok(hueco, 'una secuencia sin mensajes se dibujaba vacía: lo único accionable es el hueco');
  assert.match(hueco?.detalle ?? '', /no le dice nada/i);
});

test('Las preguntas cuelgan de la RESPUESTA, no de la cadena de mensajes', () => {
  // Cualificar es algo que pasa cuando el lead contesta. Colgado de la cadena se
  // lee como un mensaje más que sale solo.
  const g = grafoDeSecuencia([paso({ orden: 1 })], { preguntas: ['¿Cuánto facturas?', ' '] }, 'X');
  const q = g.nodos.find((n) => n.tipo === 'cualifica');
  assert.ok(q);
  assert.equal(q?.titulo, 'Pregunta 1', 'las preguntas vacías no cuentan');
  assert.ok(g.aristas.some((a) => a.desde === 'respuesta' && a.hasta === 'cualifica'));
});

test('Ningún nodo se pisa con otro, y todos entran en la caja declarada', () => {
  // El layout es determinista y no se guarda: si dos nodos se superponen, el
  // dibujo es ilegible y no hay forma de arrastrarlos para arreglarlo.
  const g = grafoDeSecuencia(
    [paso({ orden: 1, cuerpo: 'x'.repeat(400) }), paso({ orden: 2 }), paso({ orden: 3 })],
    { preguntas: ['a'], desenlace: { logradoSecuencia: 'a', falloSecuencia: 'b' } },
    'Etapa', [{ clave: 'a', nombre: 'A' }, { clave: 'b', nombre: 'B' }],
  );
  for (const n of g.nodos) {
    assert.ok(n.x >= 0 && n.y >= 0, `${n.id} fuera de la caja`);
    assert.ok(n.x + n.ancho <= g.ancho, `${n.id} se sale a la derecha`);
    assert.ok(n.y + n.alto <= g.alto, `${n.id} se sale abajo`);
  }
  for (let i = 0; i < g.nodos.length; i++) {
    for (let j = i + 1; j < g.nodos.length; j++) {
      const a = g.nodos[i]!, b = g.nodos[j]!;
      const pisa = a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto;
      assert.ok(!pisa, `${a.id} y ${b.id} se pisan`);
    }
  }
});

test('Toda arista une nodos que existen', () => {
  const g = grafoDeSecuencia([paso({ orden: 1 }), paso({ orden: 2 })],
    { preguntas: ['a'], desenlace: { logradoSecuencia: 'z' } }, 'X', [{ clave: 'z', nombre: 'Z' }]);
  const ids = new Set(g.nodos.map((n) => n.id));
  for (const a of g.aristas) {
    assert.ok(ids.has(a.desde), `arista desde un nodo inexistente: ${a.desde}`);
    assert.ok(ids.has(a.hasta), `arista hacia un nodo inexistente: ${a.hasta}`);
  }
});

// ── Lo que este flujo NO puede volver a tener ──────────────────────────────
//
// ⚠️ Los guards del GESTO (pointer capture, el scroll fantasma, el encuadre) se
// mudaron a `tests/lienzo.test.ts` el 30/09/2026, junto con la maquinaria que
// persiguen: el lienzo pasó a `app/_components/Lienzo.tsx` cuando apareció el
// segundo flujo. Se pusieron ROJOS al mudar la pieza, que es la suerte — la
// versión silenciosa de este bug es un guard que sigue VERDE leyendo un archivo
// que ya no manda.
test('No vuelve un segundo editor de los mismos pasos', () => {
  // `MensajesChat` se retiró al montar el lienzo: dos editores del mismo jsonb
  // divergen, y el que se queda viejo es el que menos se abre. Es la lección del
  // editor de diagramas del funnel, borrado dos días antes que éste.
  const perfil = leer('../app/chatbot/SecuenciaPerfil.tsx');
  assert.ok(!/MensajesChat/.test(perfil), 'volvió el segundo editor de los pasos');
  assert.match(perfil, /<FlujoLienzo/, 'el perfil dejó de montar el lienzo');
});

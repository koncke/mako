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
  pasosDibujados, insertarPasoTras, quitarPasoDibujado,
  type AvisoParaGrafo,
} from '../lib/flujo-aviso';
import type { Paso } from '../lib/flujos-tipos';
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

// ── DÓNDE ENTRA UN PASO NUEVO ────────────────────────────────────────────────
// El ＋ sale al costado de una tarjeta, así que promete DÓNDE va a caer el paso.
// Un off-by-one acá no da error: pone el paso en otro lugar y el motor lo
// ejecuta ahí.

/** Los pasos del test se distinguen por una marca: comparar objetos no dice DÓNDE quedó cada uno. */
const nota = (p: Paso): string => (p as unknown as { nota?: string }).nota ?? p.tipo;
const accion = (n: number): Paso => ({ tipo: 'accion', accion: 'crear_tarea', nota: `a${n}` } as unknown as Paso);
const ESPERA: Paso = { tipo: 'esperar', minutos: 30 } as unknown as Paso;
const INSISTE: Paso = { tipo: 'insistir', texto: '', cadaMin: 60, veces: 2 };

test('El ＋ de `paso-N` inserta DESPUÉS de ese paso', () => {
  const pasos = [accion(1), accion(2), accion(3)];
  const tras0 = pasosDibujados(insertarPasoTras(pasos, 'paso-0', accion(9)));
  assert.deepEqual(tras0.map((p) => nota(p)), ['a1', 'a9', 'a2', 'a3']);
  const tras2 = pasosDibujados(insertarPasoTras(pasos, 'paso-2', accion(9)));
  assert.deepEqual(tras2.map((p) => nota(p)), ['a1', 'a2', 'a3', 'a9']);
});

test('El ＋ de un nodo del TRONCO inserta al principio', () => {
  // La entrada, el mensaje y el recordatorio no tienen pasos antes: el primer
  // paso de la cadena va justo después del mensaje.
  for (const id of ['entrada', 'mensaje', 'respuesta', 'recordatorio']) {
    const out = pasosDibujados(insertarPasoTras([accion(1)], id, accion(9)));
    assert.deepEqual(out.map((p) => nota(p)), ['a9', 'a1'], id);
  }
});

test('⚠️ Un `esperar` en el medio NO corre el índice del ＋', () => {
  // Los ids del grafo son `paso-<i>` sobre lo DIBUJADO, y `esperar` no se dibuja.
  // Contar sobre el array crudo mandaría el paso nuevo un lugar más adelante, sin
  // un solo error: por eso el filtro y la inserción viven en el mismo módulo.
  const pasos = [accion(1), ESPERA, accion(2)];
  // ⚠️ `paso-1` es el SEGUNDO DIBUJADO, que acá es el tercero del array. La primera
  // versión de este test insertaba tras `paso-0` y pasaba en VERDE con el índice
  // contado sobre el array crudo: el orden dibujado salía igual y lo único roto era
  // que el `esperar` quedaba DUPLICADO. Lo delató romperlo.
  const out = insertarPasoTras(pasos, 'paso-1', accion(9));
  assert.deepEqual(pasosDibujados(out).map((p) => nota(p)), ['a1', 'a2', 'a9']);
  // Insertar CONSERVA todo lo que había, una sola vez cada cosa.
  assert.equal(out.length, pasos.length + 1, 'insertar duplicó o perdió un paso');
  assert.equal(out.filter((x) => x === ESPERA).length, 1, 'el `esperar` quedó duplicado');
});

test('Insistir y esperar SOBREVIVEN a un alta y a una baja', () => {
  // Son del MENSAJE, no de la cadena de pasos: una edición de la cadena que los
  // tire apaga los recordatorios de alguien sin decírselo.
  const pasos = [INSISTE, accion(1), ESPERA];
  const conNuevo = insertarPasoTras(pasos, 'paso-0', accion(9));
  assert.ok(conNuevo.includes(INSISTE) && conNuevo.includes(ESPERA));
  const sinUno = quitarPasoDibujado(pasos, 0);
  assert.ok(sinUno.includes(INSISTE) && sinUno.includes(ESPERA));
  assert.equal(pasosDibujados(sinUno).length, 0, 'no sacó el paso que se le pidió');
});

test('Quitar usa el índice de lo DIBUJADO, no del array', () => {
  const pasos = [ESPERA, accion(1), accion(2)];
  const out = quitarPasoDibujado(pasos, 0);
  assert.deepEqual(pasosDibujados(out).map((p) => nota(p)), ['a2']);
});

// ── BORRADOR Y PUBLICAR ──────────────────────────────────────────────────────

test('⚠️ EL MOTOR NO PUEDE LEER UN BORRADOR', () => {
  // Es el modo de falla más caro de esta tanda: MaKo mandando texto que nadie
  // publicó. El motor resuelve el texto por `referenciaPlantilla` → `ejemplo`, y
  // `ejemplo` sale de `texto`. Nadie más puede mirar el campo.
  const store = leer('../lib/plantillas.ts');
  assert.match(store, /ejemplo: \(e\?\.texto/, 'el texto que sale dejó de salir de `texto`');
  for (const f of ['../lib/avisos.ts', '../lib/notify.ts', '../lib/flujos.ts', '../lib/insistencias.ts']) {
    assert.ok(!/\bborrador\b/.test(leer(f)), `${f} mira el borrador`);
  }
});

test('⚠️ El borrador NO se hereda del dueño', () => {
  // Lo del dueño es el DEFAULT de todos; un borrador no es un default, es trabajo
  // a medio escribir de UNA persona. Heredado, cada cliente abre el mensaje con un
  // «Sin publicar» que no escribió — y al publicar, publica el de la agencia.
  const store = leer('../lib/plantillas.ts');
  const merge = store.slice(store.indexOf('async function leerStore('), store.indexOf('guardarStore(s: Store)'));
  assert.match(merge, /borrador: \w+, \.\.\./, 'el merge volvió a heredar el borrador');
});

test('⚠️ Publicar manda el borrador ANTES de publicar', () => {
  // `publicar` promueve lo GUARDADO. Sin mandar el borrador primero —y sin el
  // debounce— se publica el texto de hace un segundo: nada falla y sale la versión
  // anterior.
  const src = leer('../app/agencia/TemplateDetalleModal.tsx');
  const cuerpo = src.slice(src.indexOf('const publicar = async'), src.indexOf('const intentarCerrar'));
  const iB = cuerpo.indexOf("action: 'borrador'");
  const iP = cuerpo.indexOf("action: 'publicar'");
  assert.ok(iB > 0 && iP > iB, 'publicar dejó de mandar el borrador primero');
  assert.match(cuerpo, /clearTimeout\(timerBorrador/, 'el debounce puede pisar lo que se acaba de publicar');
});

test('⚠️ Salir de la vista guarda como borrador', () => {
  // «Siempre que me salgo de la vista, de la manera que sea, se guarde como
  // borrador, que no se pierda nada.» El desmonte cubre cerrar y cambiar de
  // mensaje; `visibilitychange` cubre cambiar de pestaña, donde el desmonte no
  // corre.
  const src = leer('../app/agencia/TemplateDetalleModal.tsx');
  // ⚠️ NO alcanza con buscar la palabra: aparece también en el `removeEventListener`
  // y en el comentario, así que sacar el `addEventListener` pasaba en VERDE. Lo
  // delató romperlo (exit 0 con el listener borrado); ahora se pide el ALTA.
  assert.match(src, /addEventListener\('visibilitychange', alEsconder\)/, 'cambiar de pestaña dejó de guardar');
  assert.match(src, /return \(\) => \{ document\.removeEventListener\('visibilitychange', alEsconder\); vaciar\(\); \}/,
    'el desmonte dejó de guardar el borrador');
});

test('⚠️ El botón de abajo dice PUBLICAR, y agregar un paso salió de ahí', () => {
  // «El botón de abajo en lugar de guardar, que se llame Publicar», y «Acción
  // debería estar al acercar el cursor sobre una tarjeta». Y el mensaje al lead se
  // va: «no estamos configurando el chatbot».
  const modal = leer('../app/agencia/TemplateDetalleModal.tsx');
  assert.match(modal, /pie=\{/, 'el pie del lienzo dejó de venir del detalle');
  assert.match(modal, />\s*\{busy === 'pub' \? 'Publicando…' : 'Publicar'\}/, 'el botón de abajo dejó de ser Publicar');
  const flujo = leer('../app/agencia/FlujoAviso.tsx');
  assert.ok(!/Mensaje al lead/.test(flujo), 'volvió el botón de mensaje al lead');
  assert.match(flujo, /onAgregarTras=\{/, 'el ＋ de la tarjeta dejó de estar enchufado');
  const lienzo = leer('../app/_components/Lienzo.tsx');
  assert.match(lienzo, /onAgregarTras\(n\.id\)/, 'el ＋ dejó de decir SOBRE QUÉ tarjeta se agrega');
});

test('⚠️ El título y la categoría se editan, y el `id` no cambia', () => {
  // Renombrar es un override POR WORKSPACE sobre el catálogo: el `id` es lo que
  // nombran los call sites y las emisiones, así que cambiar el rótulo no puede
  // tocar nada más.
  const store = leer('../lib/plantillas.ts');
  assert.match(store, /titulo: \(e\?\.titulo && e\.titulo\.trim\(\)\) \|\| cat\.titulo/, 'el override del título dejó de aplicarse');
  assert.match(store, /categoria: e\?\.categoria \?\? cat\.categoria/, 'el override de la categoría dejó de aplicarse');
  // Las dos rutas tienen que aceptar las cuatro actions, o la pantalla del cliente
  // ofrece controles que contestan «action inválida».
  for (const r of ['../app/api/perfil/plantillas/route.ts', '../app/api/admin/plantillas/route.ts']) {
    const src = leer(r);
    for (const a of ['borrador', 'publicar', 'titulo', 'categoria']) {
      assert.match(src, new RegExp(`case '${a}'`), `${r} no acepta '${a}'`);
    }
  }
});

test('⚠️ Las cuatro categorías salen de UN lugar', () => {
  // La pantalla las OFRECE y las rutas las VALIDAN: con dos listas, una quinta
  // categoría deja la ruta rechazando lo que el desplegable pintó.
  assert.match(leer('../lib/avisos-catalogo.ts'), /export const CATEGORIAS_AVISO/);
  assert.match(leer('../app/agencia/TemplateDetalleModal.tsx'), /const ORDEN = CATEGORIAS_AVISO/,
    'el detalle volvió a escribir su propia lista de categorías');
});

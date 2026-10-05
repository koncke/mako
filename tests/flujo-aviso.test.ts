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
  grafoDeAviso, porDondeLlega, podarPosiciones, textoDisparador, disparadorCorto,
  pasosDibujados, insertarPasoTras, quitarPasoDibujado,
  type AvisoParaGrafo,
} from '../lib/flujo-aviso';
import type { Paso } from '../lib/flujos-tipos';
import { ANCHO_NODO } from '../lib/lienzo-grafo';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

const aviso = (p: Partial<AvisoParaGrafo> = {}): AvisoParaGrafo => ({
  disparador: 'Cron los lunes a la mañana', frecuenciaMin: 0, texto: 'Hola',
  canales: { wa: true, email: false }, insistir: null, evento: null, pasos: [], ...p,
});

// ⚠️ PROBADOS ROMPIENDO LA PIEZA, 04/10/2026. Las cuatro roturas se cazan: volver el
// título de WhatsApp a «MENSAJE» → 2 fallos · no dibujar la tarjeta de EMAIL → 3 ·
// dejar la advertencia del recordatorio sin canal → 1 · apilar las dos tarjetas en la
// misma Y (una encima de la otra) → 1. Sin esa comprobación serían cuatro
// afirmaciones: el de la lista de títulos pasaba igual con el nodo viejo.
//
// Y las cinco de la tanda del Delay y el Condicional, el mismo día: devolver la segunda
// lista de pasos ocultos (el bug de la duplicación) → 2 · no dibujar la rama «si no» → 1
// · hacerla saltar a +1 en vez de +2 → 1 · dibujar la rama condicional como una segura
// → 1 · dejar que la rama que salta ofrezca el ＋ del medio → 1. La sexta —que el LIENZO
// ignore `sinMas`— salió CIEGA acá, porque vive en el componente: la caza el guard de
// cableado de `tests/lienzo.test.ts`.
test('UNA TARJETA POR CANAL PRENDIDO, y el título es el canal', () => {
  // Eran tres nodos, después dos, y ahora son uno por canal. «Si no contestas» se
  // dibujaba SIEMPRE, con o sin recordatorio prendido, así que era literalmente la
  // caja que aparece sin que nadie la pida — y un nodo es algo que OCURRE, mientras
  // que «si no contestas» es una CONDICIÓN del mensaje. Su interruptor se mudó
  // adentro del panel del mensaje.
  //
  // ⚠️ Y EL TÍTULO «MENSAJE» PASÓ A SER EL CANAL, por pedido del 04/10/2026: «cambia
  // la tarjeta de "Mensaje" por "WhatsApp" y agrega la tarjeta de "Email"». Las dos
  // se DERIVAN de `canales`, el campo del mensaje: el canal no volvió a ser un nodo
  // (ver el test de abajo), lo que hay es un mensaje por cada lado por el que sale.
  const soloWa = grafoDeAviso(aviso({ canales: { wa: true, email: false } }));
  assert.deepEqual(soloWa.nodos.map((n) => n.id), ['entrada', 'mensaje']);
  assert.deepEqual(soloWa.nodos.map((n) => n.titulo), ['CRON', 'WHATSAPP']);

  const soloMail = grafoDeAviso(aviso({ canales: { wa: false, email: true } }));
  assert.deepEqual(soloMail.nodos.map((n) => n.id), ['entrada', 'mensaje-email']);
  assert.deepEqual(soloMail.nodos.map((n) => n.titulo), ['CRON', 'EMAIL']);

  const losDos = grafoDeAviso(aviso({ canales: { wa: true, email: true } }));
  assert.deepEqual(losDos.nodos.map((n) => n.titulo), ['CRON', 'WHATSAPP', 'EMAIL']);
  // ⚠️ El id de WhatsApp sigue siendo `mensaje` A PROPÓSITO: las posiciones guardadas
  // se podan por id, y `FlujoAviso.tsx` pregunta `n.id === 'mensaje'` en tres lugares
  // para decidir dónde se puede agregar un paso. Renombrarlo borraba la coordenada de
  // todo el que había movido su tarjeta, en el primer arrastre y sin error.
  assert.deepEqual(losDos.nodos.map((n) => n.id), ['entrada', 'mensaje', 'mensaje-email']);
  // Y no se pisan: la del mail va DEBAJO, no encima.
  const wa = losDos.nodos.find((n) => n.id === 'mensaje')!;
  const mail = losDos.nodos.find((n) => n.id === 'mensaje-email')!;
  assert.equal(wa.x, mail.x, 'las dos tarjetas del mensaje van en la misma columna');
  assert.ok(mail.y >= wa.y + (wa.alto ?? 0), 'la tarjeta del mail se dibuja encima de la de WhatsApp');
});

test('⚠️ «Te llega al grupo» NO es un nodo: un nodo es algo que OCURRE', () => {
  // Por dónde sale un mensaje es una PROPIEDAD del mensaje, no un paso del flujo.
  // Dibujarla como paso hace que el grafo cuente un hecho de más — y encima uno
  // que no se puede tocar desde ahí, porque el canal se elige al entrar.
  const g = grafoDeAviso(aviso({ canales: { wa: true, email: true } }));
  assert.ok(!g.nodos.some((n) => n.id === 'salida'), 'volvió el nodo que no hacía nada');
  // ⚠️ Y EL HECHO VOLVIÓ AL TÍTULO, QUE ES DONDE SE LEE SIN ABRIR NADA. Pasó por los
  // tres lugares: era el título («Te llega al grupo de WhatsApp»), bajó al `detalle`
  // cuando el título se volvió «MENSAJE» a pedido, y el 04/10/2026 volvió arriba como
  // el NOMBRE de cada tarjeta. Lo que el test cuida no es dónde está: es que el dato
  // no se pueda ir sin que nada falle. Por eso pide los dos canales por su nombre.
  const titulos = g.nodos.map((n) => n.titulo);
  assert.ok(titulos.includes('WHATSAPP'), 'el destino tiene que leerse en la tarjeta');
  assert.ok(titulos.includes('EMAIL'), 'el destino tiene que leerse en la tarjeta');
  // Y sigue siendo un CAMPO, no un nodo: apagar un canal saca su tarjeta, no agrega
  // una que diga «por acá no». Un nodo es algo que ocurre.
  const unaSola = grafoDeAviso(aviso({ canales: { wa: true, email: false } }));
  assert.equal(unaSola.nodos.filter((n) => n.tipo === 'mensaje').length, 1);
});

test('⚠️ El recordatorio se lee EN el mensaje, y no tiene nodo propio', () => {
  // Pedido dos veces: «no debería ser una nueva sección, sino una opción dentro de la
  // sección de mensaje», y después «te dije que el RECORDATORIO se debe configurar
  // dentro del MENSAJE». El estado no se pierde al sacar la tarjeta: baja al `detalle`.
  const g = grafoDeAviso(aviso({ insistir: { cadaMin: 30, veces: 3 } }));
  assert.ok(!g.nodos.some((n) => n.id === 'recordatorio'), 'volvió la tarjeta del recordatorio');
  assert.ok(!g.nodos.some((n) => n.id === 'respuesta'), 'volvió la caja que se dibujaba siempre');
  assert.equal(g.aristas.length, 1, 'quedó una flecha apuntando a un nodo que ya no existe');
  assert.match(g.nodos.find((n) => n.id === 'mensaje')?.detalle ?? '', /cada 30 minutos, hasta 3 veces/);
  // Sin recordatorio, el detalle no lo menciona: no hay un «se manda una vez» que
  // ocupe un renglón para decir que no pasa nada.
  assert.ok(!/recuerda/i.test(grafoDeAviso(aviso()).nodos.find((n) => n.id === 'mensaje')?.detalle ?? ''));
});

test('La cadencia se dice en unidades que alguien puede leer', () => {
  // «Cada 43200 minutos» no es una frase. Pedido: «se debería poder recordar 1 vez al
  // día, a la semana, al mes».
  const det = (min: number) => grafoDeAviso(aviso({ insistir: { cadaMin: min, veces: 2 } }))
    .nodos.find((n) => n.id === 'mensaje')?.detalle ?? '';
  assert.match(det(1440), /cada día/);
  assert.match(det(10080), /cada semana/);
  assert.match(det(43200), /cada mes/);
  assert.match(det(45), /cada 45 minutos/);
});

test('⚠️ Con los DOS canales apagados, el MENSAJE lo dice y la flecha se pone mala', () => {
  // El aviso no sale por ningún lado y eso no se veía en ninguna pantalla: los
  // chips de canal se fueron del detalle a propósito, así que el único lugar donde
  // puede aparecer es acá.
  const g = grafoDeAviso(aviso({ canales: { wa: false, email: false } }));
  const m = g.nodos.find((n) => n.id === 'mensaje')!;
  assert.match(m.detalle ?? '', /ning[úu]n lado/i);
  assert.ok(m.advertencia, 'un mensaje que no sale por ningún lado tiene que estar marcado');
  assert.equal(g.aristas.find((a) => a.hasta === 'mensaje')?.tono, 'mala');
});

test('⚠️ Un recordatorio sin WhatsApp está dibujando algo que no puede ocurrir', () => {
  // El choke point abre la insistencia ADENTRO del `if` del envío al grupo: sin
  // WhatsApp, no hay recordatorio posible. Se dice, no se esconde.
  // ⚠️ AHORA ES DEL NODO `mensaje`, que es el que se quedó con el recordatorio. Y la
  // versión vieja de este assert PASABA EN VERDE por vacío: sin el nodo,
  // `find(...)?.advertencia` da undefined y el `assert.equal(..., undefined)` no mira
  // nada. Por eso los dos lados piden el nodo que sí existe.
  const conWa = grafoDeAviso(aviso({ insistir: { cadaMin: 30, veces: 2 }, canales: { wa: true, email: true } }));
  assert.equal(conWa.nodos.find((n) => n.id === 'mensaje')!.advertencia, undefined);
  // ⚠️ SIN WHATSAPP YA NO HAY TARJETA `mensaje`: la advertencia viaja a la del MAIL,
  // que es la única que queda dibujada y por lo tanto la única que alguien va a mirar.
  // Puesta en una tarjeta que no se dibuja, el aviso existía y no se leía nunca.
  const sinWa = grafoDeAviso(aviso({ insistir: { cadaMin: 30, veces: 2 }, canales: { wa: false, email: true } }));
  assert.equal(sinWa.nodos.find((n) => n.id === 'mensaje'), undefined, 'sin WhatsApp no hay tarjeta de WhatsApp');
  assert.match(sinWa.nodos.find((n) => n.id === 'mensaje-email')!.advertencia ?? '', /WhatsApp/);
  // Y sin NINGÚN canal manda la otra: el mensaje no sale, que es más grave.
  const sinNada = grafoDeAviso(aviso({ insistir: { cadaMin: 30, veces: 2 }, canales: { wa: false, email: false } }));
  assert.match(sinNada.nodos.find((n) => n.id === 'mensaje')!.advertencia ?? '', /no sale/);
});

// ── Los disparadores que se suman ───────────────────────────────────────────

test('Un evento elegido se suma al hecho nativo, no lo reemplaza', () => {
  // El aviso sigue saliendo por su camino de siempre. Lo que se elige acá es un
  // disparador MÁS, y el nodo tiene que decir las dos cosas: si dijera sólo el
  // evento, apagaría en la pantalla un camino que en el motor sigue vivo.
  // ⚠️ Y EL NATIVO VA ÚLTIMO Y ROTULADO «Hoy sale solo». Iba primero y pelado, así
  // que la tarjeta titulada «CRON» arrancaba con «Cron los lunes a la mañana» y se
  // leyó como una preconfiguración: «estás PRECONFIGURANDO el cron, pusiste Los lunes
  // a la mañana pero hard codeado, cuando JUSTAMENTE lo estamos haciendo editable».
  const t = textoDisparador({ disparador: 'Cron los lunes', evento: { tipo: 'evento', evento: 'lead.agendo' } });
  assert.match(t, /Hoy sale solo: cron los lunes/);
  assert.ok(t.indexOf('Cuando') < t.indexOf('Hoy sale solo'), 'lo configurado va primero');
  assert.equal(textoDisparador({ disparador: 'Cron los lunes', evento: null }), 'Hoy sale solo: cron los lunes');
  // Y sin nada, la tarjeta no inventa un horario.
  assert.equal(textoDisparador({ disparador: '', evento: null }), 'Sin configurar');
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
  const g = grafoDeAviso(aviso({ posiciones: { mensaje: { x: 1500, y: 700 } } }));
  assert.ok(g.ancho > 1500);
  assert.ok(g.alto > 700);
  // ⚠️ Y LA HOLGURA DERECHA TIENE QUE METER AL ＋ ADENTRO. Cuelga 8 px a la derecha de
  // la última tarjeta, mide 26 y tira 6 de sombra: con el MARGEN de 28 quedaba cortado
  // contra el `overflow: hidden` de la caja, y «Centrar» no lo traía de vuelta.
  assert.ok(g.ancho >= 1500 + ANCHO_NODO + 40, 'el ＋ de la última tarjeta queda fuera de cuadro');
});

// ── El resto ────────────────────────────────────────────────────────────────

test('⚠️ La flecha ya NO dice «cada cuánto»: ese control salió de la pantalla', () => {
  // «Realmente no me hace ningun tipo de sentido» — y una etiqueta que describe un
  // control que no está es una afirmación sin dueño. Con la etiqueta fuera, el rótulo
  // `cadaCuanto` se quedó sin UN SOLO lector y se fue con ella (medido con un grep: el
  // `cadaCuanto` de lib/alerta-critica.ts es otra función, local y numérica).
  assert.equal(grafoDeAviso(aviso()).aristas.find((a) => a.hasta === 'mensaje')?.etiqueta, undefined);
  assert.ok(!/export function cadaCuanto/.test(leer('../lib/flujo-aviso.ts')), 'volvió un rótulo que nadie lee');
  // ⚠️ Pero el CAMPO no se toca: es el único espaciado de los tres reportes, y
  // borrarlo sería borrar el lugar donde un día se enchufa.
  assert.match(leer('../lib/notify.ts'), /frecuenciaEfectiva\(/, 'se fue el espaciado de los reportes');
  assert.match(leer('../lib/plantillas.ts'), /frecuenciaMin: frecuenciaDe/, 'se fue el campo de la vista');
});

test('El disparador nativo se dice en UNA línea, cortando y sin reescribir', () => {
  // «El menor texto posible». Cortar es TIRAR: no se resume ni se parafrasea — se
  // corta en el primer punto, porque la primera oración es el disparador y el resto
  // son las salvedades.
  assert.equal(disparadorCorto('Sale los lunes. Si no hay datos, no sale.'), 'Sale los lunes');
  assert.equal(disparadorCorto('Cron cada hora; sólo si hay campañas activas'), 'Cron cada hora');
  assert.equal(disparadorCorto('Sin puntuación'), 'Sin puntuación');
  // El caso REAL que lo hizo cambiar, visto en pantalla: 82 caracteres sin un solo
  // punto en un panel de 328 px. Los dos puntos y el paréntesis final entraron por esto.
  assert.equal(
    disparadorCorto('Cron los lunes a la mañana (hora local del workspace): ads, cierres, CAC, cash, ritmo'),
    'Cron los lunes a la mañana',
  );
  assert.ok(disparadorCorto('x'.repeat(200)).length <= 96, 'sin tope, un disparador largo ahoga el panel');
});

test('⚠️ El nodo CRON dice el agendado Y lo nativo, no uno de los dos', () => {
  // Agendar NO apaga el código que produce el aviso, así que una tarjeta que sólo
  // dijera «todos los lunes a las 9» estaría contando la mitad — y es la mitad que
  // nadie va a auditar, porque suena completa.
  const txt = textoDisparador({
    disparador: 'Sale cuando entra un lead. Con condiciones.',
    evento: null,
    cron: { unidad: 'semana', cada: 1, hora: 9, minuto: 0, diaSemana: 1 },
    tz: 'America/Tijuana',
  });
  assert.match(txt, /Hoy sale solo: sale cuando entra un lead/, 'se perdió el disparador nativo');
  assert.match(txt, /lunes a las 09:00 de America\/Tijuana/, 'se perdió el agendado');
  assert.ok(txt.indexOf('lunes a las') < txt.indexOf('Hoy sale solo'), 'el nativo tiene que ir último');
  assert.ok(!/Con condiciones/.test(txt), 'volvió el texto largo del catálogo');
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
  // `Disparador` salió de esta lista porque el componente YA NO EXISTE: la sección
  // CRON lo reemplazó, y de él quedó lo único que tenía de propio —que guardar al
  // elegir revierta si falla—, perseguido en tests/disparador-frecuencia.test.ts.
  assert.match(src, /<EditorMensaje[\s\n]/, 'el nodo dejó de montar EditorMensaje: ¿se copió su control?');
  assert.ok(!/action: 'frecuencia'/.test(src), 'el lienzo escribió la frecuencia por su cuenta');
  assert.ok(!/from '\.\/Disparador'/.test(src), 'volvió el componente que la sección CRON reemplazó');
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

test('⚠️ Un paso OCULTO en el medio NO corre el índice del ＋', () => {
  // Los ids del grafo son `paso-<i>` sobre lo DIBUJADO, así que un paso que no se
  // dibuja no puede correr la cuenta. Contar sobre el array crudo mandaría el paso
  // nuevo un lugar más adelante, sin un solo error: por eso el filtro y la inserción
  // viven en el mismo módulo.
  //
  // ⚠️ EL PASO OCULTO ES `insistir`, Y ANTES ERA `esperar`. Cambió el 04/10/2026, no
  // por estilo: el `esperar` pasó a DIBUJARSE porque el motor pasó a ejecutarlo
  // (mig 0186, `flujo_corridas`). Lo que este test cuida no cambió —que el ＋ caiga
  // donde dice— y por eso sigue existiendo con el otro oculto. El día que no quede
  // ninguno escondido, este test deja de poder fallar y hay que decirlo, no borrarlo.
  const pasos = [accion(1), INSISTE, accion(2)];
  // `paso-1` es el SEGUNDO DIBUJADO, que acá es el tercero del array. La primera
  // versión insertaba tras `paso-0` y pasaba en VERDE con el índice contado sobre el
  // array crudo: el orden dibujado salía igual y lo único roto era que el paso oculto
  // quedaba DUPLICADO. Lo delató romperlo.
  const out = insertarPasoTras(pasos, 'paso-1', accion(9));
  assert.deepEqual(pasosDibujados(out).map((p) => nota(p)), ['a1', 'a2', 'a9']);
  // Insertar CONSERVA todo lo que había, una sola vez cada cosa.
  assert.equal(out.length, pasos.length + 1, 'insertar duplicó o perdió un paso');
  assert.equal(out.filter((x) => x === INSISTE).length, 1, 'el paso oculto quedó duplicado');
});

test('El paso oculto SOBREVIVE a un alta y a una baja', () => {
  // `insistir` es del MENSAJE, no de la cadena: una edición de la cadena que lo tire
  // apaga los recordatorios de alguien sin decírselo. Y el `esperar`, que ahora SÍ se
  // dibuja, tiene que comportarse como cualquier otro paso: se cuenta y se puede
  // quitar. Las dos mitades en el mismo test, porque lo que se mide es la frontera.
  const pasos = [INSISTE, accion(1), ESPERA];
  const conNuevo = insertarPasoTras(pasos, 'paso-0', accion(9));
  assert.ok(conNuevo.includes(INSISTE), 'el paso oculto se perdió al insertar');
  assert.ok(conNuevo.includes(ESPERA), 'la espera se perdió al insertar');
  const sinUno = quitarPasoDibujado(pasos, 0);
  assert.ok(sinUno.includes(INSISTE), 'quitar un paso dibujado se llevó el oculto');
  assert.equal(pasosDibujados(sinUno).map((p) => nota(p)).join(','), 'esperar',
    'no sacó el paso que se le pidió, o se llevó la espera puesta');
});

test('Quitar usa el índice de lo DIBUJADO, no del array', () => {
  const pasos = [INSISTE, accion(1), accion(2)];
  const out = quitarPasoDibujado(pasos, 0);
  assert.deepEqual(pasosDibujados(out).map((p) => nota(p)), ['a2']);
});

test('⚠️ El `esperar` AHORA se dibuja, porque ahora se ejecuta', () => {
  // Es el cambio de hecho del 04/10/2026, y el que hace funcional el Delay. Estaba
  // excluido del dibujo por una razón correcta —el motor hacía `break` y no lo
  // corría— y esconderlo ahora sería el error inverso: un paso que ocurre y no se ve.
  assert.equal(pasosDibujados([accion(1), ESPERA]).length, 2, 'la espera volvió a esconderse');
  assert.equal(pasosDibujados([accion(1), INSISTE]).length, 1, 'el insistir dejó de estar oculto');
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
  // ⚠️ EL RECORTE MIRA `leerPar`, y antes miraba `leerStore`. El merge se mudó ahí el
  // 05/10/2026 al juntar las dos lecturas del store en una sola ida (el POST del ＋ hacía
  // cuatro oleadas contra la misma fila). El guard hizo su trabajo: se puso rojo cuando
  // la pieza que vigila cambió de casa, que es para lo que está.
  const store = leer('../lib/plantillas.ts');
  const merge = store.slice(store.indexOf('async function leerPar('), store.indexOf('guardarStore(s: Store)'));
  assert.ok(merge.length > 200 && merge.length < 3000, `el recorte del merge mide ${merge.length}: mira otra cosa`);
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
  // ⚠️ AHORA LLEVA UN SEGUNDO ARGUMENTO: el ＋ pregunta QUÉ crear (04/10/2026), así
  // que la llamada es `onAgregarTras(n.id, …)`. Lo que el assert cuida no cambió —
  // que el ＋ diga SOBRE QUÉ tarjeta se agrega, que es lo que un botón suelto en una
  // esquina no puede decir— y por eso sigue exigiendo el `n.id` como primer argumento.
  assert.match(lienzo, /onAgregarTras\(n\.id,/, 'el ＋ dejó de decir SOBRE QUÉ tarjeta se agrega');
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

const COND: Paso = { tipo: 'condicional', condicion: 'contestaron' };
test('⚠️ insertar NO DUPLICA la espera, que ahora se dibuja', () => {
  // ⚠️ ES UN BUG QUE PASÓ, no una hipótesis. `insertarPasoTras` partía los pasos en dos
  // listas —`pasosDibujados` y una enumeración aparte de lo oculto— y el día que
  // `esperar` pasó a dibujarse quedó en LAS DOS: cada inserción duplicaba todas las
  // esperas. Medido en el navegador el 04/10/2026: un click en «Delay» dejaba 3 tarjetas
  // ⏳ donde había 1, y el siguiente 6. Y `npm test` estaba en VERDE, porque los tests
  // del índice de acá arriba usan `insistir` como el paso oculto: ninguno tenía una
  // espera adentro. Lo delató la pantalla.
  const pasos = [accion(1), ESPERA, accion(2)];
  const out = insertarPasoTras(pasos, 'paso-2', accion(9));
  assert.equal(out.length, pasos.length + 1, 'insertar duplicó o perdió un paso');
  assert.equal(out.filter((p) => p.tipo === 'esperar').length, 1, 'la espera quedó duplicada');
  assert.deepEqual(pasosDibujados(out).map((p) => nota(p)), ['a1', 'esperar', 'a2', 'a9']);
});

test('⚠️ y tampoco duplica con la espera PRIMERA ni con las dos cosas ocultas', () => {
  // Las dos posiciones y la mezcla: lo que se persigue es que `otros` sea el complemento
  // de lo dibujado, no una lista escrita al lado.
  const conEsperaAlFrente = insertarPasoTras([ESPERA, accion(1)], 'paso-0', accion(9));
  assert.equal(conEsperaAlFrente.length, 3, 'duplicó con la espera adelante');
  const mezcla = insertarPasoTras([INSISTE, ESPERA, accion(1)], 'paso-1', accion(9));
  assert.equal(mezcla.length, 4, 'duplicó con insistir y esperar juntos');
  assert.equal(mezcla.filter((p) => p.tipo === 'esperar').length, 1);
  assert.equal(mezcla.filter((p) => p.tipo === 'insistir').length, 1, 'el insistir se perdió o se duplicó');
});

test('⚠️ un condicional dibuja SUS DOS RAMAS, y la que salta no ofrece el ＋', () => {
  // `decidir` contesta `paso + 2` cuando la condición no se cumple, o sea que SALTEA el
  // de al lado. Sin la flecha «si no» el lienzo afirma que después del condicional viene
  // ese paso y punto. Y esa flecha no lleva ＋: el del medio inserta tras el ORIGEN, o
  // sea en la otra rama — un control que hace algo distinto de lo que dice la flecha de
  // la que cuelga es peor que no tenerlo.
  const g = grafoDeAviso(aviso({ pasos: [COND, accion(1), accion(2)] }));
  const desdeCond = g.aristas.filter((a) => a.desde === 'paso-0');
  assert.equal(desdeCond.length, 2, 'el condicional no dibuja sus dos ramas');
  const siCumple = desdeCond.find((a) => a.hasta === 'paso-1');
  const siNo = desdeCond.find((a) => a.hasta === 'paso-2');
  assert.ok(siCumple && siNo, 'las ramas no van a los pasos que el motor elige (+1 y +2)');
  assert.equal(siCumple.etiqueta, 'si se cumple');
  assert.equal(siNo.etiqueta, 'si no');
  assert.equal(siCumple.tono, 'condicional', 'la rama que puede no ocurrir se dibuja igual que una segura');
  assert.equal(siNo.tono, 'condicional');
  assert.ok(!siCumple.sinMas, 'la rama normal SÍ ofrece el ＋ del medio');
  assert.equal(siNo.sinMas, true, 'la rama que salta ofrece un ＋ que inserta en la otra');
  // Y sin un paso dos más allá, el motor termina: no hay salto que dibujar — queda la
  // rama normal y nada más.
  const corto = grafoDeAviso(aviso({ pasos: [COND, accion(1)] }));
  const desdeCorto = corto.aristas.filter((a) => a.desde === 'paso-0');
  assert.equal(desdeCorto.length, 1, 'dibujó un salto a un paso que no existe');
  assert.equal(desdeCorto[0].hasta, 'paso-1');
});

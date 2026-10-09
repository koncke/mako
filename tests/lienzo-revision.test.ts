// =============================================================================
// La revisión adversarial del lienzo de /chatbot (08/10/2026): lo que la pantalla AFIRMA
// tiene que ser lo que el motor HACE, y lo que frena tiene que poder encontrarse
// =============================================================================
// Cada bloque lleva el id del hallazgo (docs/chatbot-flujo-ramas-diseno.md, la revisión).
// Las funciones puras viven en lib/flujo-conversacion.ts y lib/lienzo-grafo.ts (sin
// `server-only`, para esto); lo que es de React se fija con un guard de CABLEADO sobre el
// fuente, sin comentarios y con los saltos CRLF normalizados (en un worktree llegan así).
//
// PROBADO ROMPIÉNDOLO (08/10/2026; con todo puesto: 12 pasan, 0 fallan). Cada rotura de a
// una, aplicada y restaurada DE MEMORIA (nunca con `git checkout`). Pasan / fallan:
//   1. `agregarCaso` sin `revisar: true`                                          -> 11 / 1
//   2. `revisarHeredado` sin la excepción del «MaKo contesta» de «Si responde»    -> 11 / 1
//   3. FlujoLienzo sin reenviar `paraGuion` al editor del mensaje                 -> 11 / 1
//   4. `vistaDeArchivo` vuelve a devolver un documento sin URL                    -> 11 / 1
//   5. la nota de voz vuelve a medir 108 fijo                                     -> 11 / 1
//   6. `cambioApila` vuelve a apilar una tecla en una variante                    -> 11 / 1
//   7. SecuenciaPerfil vuelve a pedir las etiquetas sin `?archivadas=1`           -> 11 / 1
//   8. `vistaConPanel` vuelve a contar el inset izquierdo dos veces               -> 11 / 1
//   9. el Lienzo sin pasarle el tope derecho (`insetDer`) a `vistaConPanel`       -> 11 / 1
//  10. `nombreDeTarjeta` vuelve a numerar («Mensaje 4»)                           -> 11 / 1
//  11. Publicar frena sin abrir la tarjeta (`frenar` sin `setFoco`)               -> 11 / 1
//  12. `estrategiaConLimpieza(null)` vuelve a inventar `objetivo: 'agendar'`      -> 11 / 1
//  13. la fila «Otra cosa» sin su marca de pendientes                            -> 11 / 1
//
// Correr: node --import tsx --test tests/lienzo-revision.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  agregarCaso, crearRespuesta, cambiarNodo, insertarDesdeLienzo, revisarHeredado, cambioApila, nombreEtiqueta,
  vistaDeArchivo, altoDeMensaje, grafoDeSecuencia, nombreDeTarjeta, tituloDeTarjeta, errorLegible, tarjetaDelError,
  faltaEscribir, estrategiaConLimpieza, seccionesDisparo, detalleDisparador,
  type PasoParaGrafo, type NodoFlujo,
} from '../lib/flujo-conversacion';
import { vistaConPanel, ALTO_PUERTO } from '../lib/lienzo-grafo';
import { escenariosDeRespuesta, nodoPorId, idDe, validarGrafo } from '../lib/flujo-grafo';
import { saleSolo } from '../lib/nutricion-grafo-motor';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas ANTES que los bloques: un `/*` adentro de un `//` se comería código (AGENTS.md).
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, abre: string, cierra: string, tope: number): string => {
  const ini = src.indexOf(abre);
  assert.ok(ini >= 0, `no encontré «${abre}»`);
  const fin = src.indexOf(cierra, ini + abre.length);
  assert.ok(fin > ini, `no encontré el cierre «${cierra}»`);
  const b = src.slice(ini, fin);
  assert.ok(b.length < tope, `el recorte mide ${b.length}: está mirando otra cosa`);
  return b;
};
const LIENZO_FLUJO = sinComentarios(leer('../app/chatbot/FlujoLienzo.tsx'));
const PERFIL = sinComentarios(leer('../app/chatbot/SecuenciaPerfil.tsx'));
const LIENZO = sinComentarios(leer('../app/_components/Lienzo.tsx'));

const rndDe = (semilla = 1) => { let s = semilla; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
const msg = (id: string, extra: Partial<PasoParaGrafo> = {}): PasoParaGrafo => ({ id, canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', siguiente: null, ...extra });
const nodo = (g: { nodos: NodoFlujo[] }, id: string): NodoFlujo => { const n = g.nodos.find((x) => x.id === id); assert.ok(n, `no está el nodo ${id}`); return n; };

/** Una salida (un texto y un «IA») y «Si responde» con UN caso: su «MaKo contesta» y, en la misma rama, un texto. */
function conCaso(): { pasos: PasoParaGrafo[]; contesta: string; textoRama: string } {
  const r = crearRespuesta([msg('a', { siguiente: 'b' }), msg('b', { tipo: 'ia' })], rndDe());
  const c = agregarCaso(r.pasos, r.id, rndDe(5));
  const ins = insertarDesdeLienzo(c.pasos, c.mensaje!, 'sig', 'mensaje', rndDe(9));
  return { pasos: cambiarNodo(ins.pasos, ins.id!, { cuerpo: 'te paso el link' }), contesta: c.mensaje!, textoRama: ins.id! };
}

// ── costuras-3: la casilla «Revisar antes de enviar» dice lo que hace el motor ─────────

test('costuras-3: un caso nuevo nace con su «MaKo contesta» en `revisar: true`, y el motor lo lee como borrador', () => {
  const { pasos, contesta } = conCaso();
  assert.equal(nodoPorId(pasos, contesta)!.revisar, true, 'el «MaKo contesta» nació sin `revisar` explícito');
  const [esc] = escenariosDeRespuesta(pasos);
  assert.equal(esc.contestaSolo, undefined, 'el motor lo tomaría como «contesta solo»');
});

test('costuras-3: lo que la casilla PINTA es, para cada mensaje, lo contrario de lo que el MOTOR manda solo', () => {
  const base = conCaso();
  const ids = [...base.pasos.map((p, i) => idDe(p, i))].filter((id) => {
    const p = nodoPorId(base.pasos, id)!;
    return !p.nodo && !p.accion;
  });
  assert.ok(ids.includes(base.contesta) && ids.includes('a') && ids.includes('b') && ids.includes(base.textoRama));
  for (const envio of [true, false]) {
    for (const revisar of [undefined, true, false] as const) {
      for (const id of ids) {
        const pasos = cambiarNodo(base.pasos, id, { revisar } as Partial<PasoParaGrafo>);
        const p = nodoPorId(pasos, id)!;
        // Lo que el editor pinta (EditorMensajeWhatsApp: `paso.revisar ?? !!revisarHeredado`).
        const pinta = p.revisar ?? revisarHeredado(pasos, id, envio);
        // Lo que el motor hace: el primer «MaKo contesta» de un caso, por `escenariosDeRespuesta`;
        // lo demás (la salida y el resto de la rama), por `saleSolo`.
        const esc = escenariosDeRespuesta(pasos).find((e) => e.siguiente === id && p.tipo === 'ia');
        const sale = esc ? esc.contestaSolo === true : saleSolo(p, envio);
        assert.equal(pinta, !sale, `${id} con revisar=${String(revisar)} y envio_automatico=${envio}: la casilla dice ${pinta ? 'revisar' : 'sale sola'} y el motor ${sale ? 'manda solo' : 'deja borrador'}`);
      }
    }
  }
  // Y el lienzo le pasa ESO al editor, no la secuencia a secas.
  assert.match(LIENZO_FLUJO, /mostrarRevisar\s+revisarHeredado=\{revisarHeredado\(pasos, id, envioAutoSecuencia\)\}/);
});

// ── costuras-4: «✦ guion» recibe la estrategia ─────────────────────────────────────────

test('costuras-4: el objetivo, el gancho y las preguntas llegan hasta el editor del mensaje', () => {
  assert.match(PERFIL, /const paraGuion = useMemo\(\(\) => \(est \? \{ objetivo: est\.objetivo, gancho: est\.gancho, preguntas: est\.preguntas \} : undefined\), \[est\]\);/);
  assert.match(PERFIL, /<FlujoLienzo[\s\S]*?paraGuion=\{paraGuion\}/);
  // FlujoLienzo → EditorDeNodo → EditorMensaje → EditorMensajeWhatsApp: cada salto, contado.
  assert.match(LIENZO_FLUJO, /<EditorDeNodo[\s\S]*?paraGuion=\{paraGuion\}/);
  const ed = bloque(LIENZO_FLUJO, '<EditorMensajeWhatsApp', '/>', 2_000);
  assert.match(ed, /paraGuion=\{paraGuion\}/, 'el editor del mensaje no recibe `paraGuion`: «✦ guion» sin la secuencia');
  assert.match(LIENZO_FLUJO, /function EditorMensaje\(\{[^}]*paraGuion[^}]*\}/);
});

// ── costuras-6: la tarjeta de un archivo no dice «(no disponible)» ────────────────────

test('costuras-6: la tarjeta de un archivo dice CUÁL es, o «Archivo»; «ya no está» sólo si se leyó la biblioteca', () => {
  const pdf = { id: 7, titulo: 'Catálogo', media_mime: 'application/pdf', nombre_archivo: 'catalogo.pdf', url: 'https://x/catalogo.pdf' };
  assert.deepEqual(vistaDeArchivo(7, [pdf]), { modo: 'documento', url: pdf.url, mime: 'application/pdf', nombre: 'catalogo.pdf' });
  // Cargando, sin poder leerla, o sin URL firmada: «Archivo», sin afirmar nada.
  assert.deepEqual(vistaDeArchivo(7, null), { modo: 'fila', nombre: 'Archivo', falta: false });
  assert.deepEqual(vistaDeArchivo(7, 'error'), { modo: 'fila', nombre: 'Archivo', falta: false });
  assert.deepEqual(vistaDeArchivo(7, [{ ...pdf, url: null }]), { modo: 'fila', nombre: 'catalogo.pdf', falta: false });
  // Leída y sin el archivo: eso sí se dice.
  assert.deepEqual(vistaDeArchivo(9, [pdf]), { modo: 'fila', nombre: 'Un archivo que ya no está', falta: true });
  // Ninguna salida es un documento sin URL (la burbuja lo pintaría «(no disponible)»).
  for (const b of [null, 'error', [], [pdf], [{ ...pdf, url: null }]] as const) {
    const v = vistaDeArchivo(7, b as never);
    if (v.modo === 'documento') assert.ok(v.url, 'un documento sin URL');
  }
  // Y la tarjeta no le pasa a la burbuja un archivo con `url: null`.
  assert.doesNotMatch(LIENZO_FLUJO, /media: paso\.tipo === 'media' \? \{ url: null/);
  assert.match(LIENZO_FLUJO, /const v = vistaDeArchivo\(paso\.media_id,/);
});

// ── costuras-7: la nota de voz entra en su tarjeta ─────────────────────────────────────

test('costuras-7: el alto de una nota de voz se suma por partes (reproductor, título, pie), sin la transcripción', () => {
  const voz = (cuerpo: string) => msg('v', { tipo: 'audio', audio_id: 3, cuerpo });
  const sola = altoDeMensaje(voz(''));
  // La cuenta de la revisión: marco 3 + relleno 19 + cabecera ≈24 + burbuja 18 + reproductor 34 +
  // título 14 = 112. Con 108 el título salía cortado.
  assert.ok(sola >= 112, `una nota de voz sola mide ${sola}: el título no entra`);
  const conPie = altoDeMensaje(voz('Te dejo el link abajo 👇 https://hola-mako.com/agenda'));
  assert.ok(conPie - sola >= 22, `el pie suma ${conPie - sola}: no entra ni un renglón`);
  // La tarjeta ya NO dibuja la transcripción (cuarta tanda, punto 15: «que no se vea la transcripción
  // del audio»), así que no suma: medirla dejaba aire abajo de la burbuja.
  const conDice = altoDeMensaje(voz(''), { transcript: 'Hola, ¿cómo estás? Te cuento lo que vamos a ver el martes en la llamada, que es corto.' });
  assert.equal(conDice, sola, `la transcripción suma ${conDice - sola} y la tarjeta no la dibuja`);
  assert.ok(altoDeMensaje(voz('x'.repeat(2000)), { transcript: 'y'.repeat(500) }) <= 260, 'sin tope');
  // El árbol usa la biblioteca para saber si hay transcripción.
  const g = grafoDeSecuencia([voz('')], { disparador: 'X', audioDe: () => ({ transcript: 'Hola, te cuento algo largo que dice la nota de voz.' }) });
  // Más la fila de su salida al pie (sexta tanda, punto 4: «Entonces ●»).
  assert.equal(nodo(g, 'v').alto, altoDeMensaje(voz(''), { transcript: 'Hola, te cuento algo largo que dice la nota de voz.' }) + ALTO_PUERTO);
  assert.match(LIENZO_FLUJO, /audioDe: \(id\) => audios\.find\(\(a\) => a\.id === id\) \?\? null/);
});

// ── costuras-9 / lienzo-7: tipear en una variante no apila ─────────────────────────────

test('costuras-9 y lienzo-7: escribir en una variante NO apila una foto; quitar una, sí', () => {
  const paso = { variantes: ['uno', 'dos'] };
  assert.equal(cambioApila({ cuerpo: 'h' }, paso), false);
  assert.equal(cambioApila({ asunto: 'h' }, paso), false);
  assert.equal(cambioApila({ variantes: ['unox', 'dos'] }, paso), false, 'una tecla en una variante apila una foto');
  assert.equal(cambioApila({ variantes: ['dos'] }, paso), true, 'quitar una variante tiene que poder deshacerse');
  assert.equal(cambioApila({ variantes: [] }, paso), true);
  assert.equal(cambioApila({ tipo: 'ia' }, paso), true);
  assert.equal(cambioApila({ revisar: true }, paso), true);
  assert.equal(cambioApila({ cuerpo: 'h', tipo: 'texto' }, paso), true);
  // 30 teclas seguidas en una variante: cero fotos (con una por tecla, la pila de 30 perdía todo lo de antes).
  let fotos = 0; let v = 'dos';
  for (let i = 0; i < 30; i++) { v += 'x'; if (cambioApila({ variantes: ['uno', v] }, paso)) fotos++; }
  assert.equal(fotos, 0);
  assert.match(LIENZO_FLUJO, /cambiar\(patch, cambioApila\(patch, paso\)\);/);
});

// ── costuras-11: las etiquetas archivadas se nombran donde siguen puestas ─────────────

test('costuras-11: el lienzo pide las archivadas y las nombra «(archivada)», sin ofrecerlas', () => {
  // Segunda tanda: la lista es la COMPARTIDA (useEtiquetasTodas), que pide las archivadas y se
  // relee cuando el selector exportado crea una. Verificado volviendo a la lectura propia: 1 fallo.
  assert.match(PERFIL, /useEtiquetasTodas\(\) \?\? \[\]/);
  assert.doesNotMatch(PERFIL, /fetch\('\/api\/crm\/etiquetas/);
  assert.match(leer('../app/_components/etiquetas-cliente.tsx'), /etiquetas\?archivadas=1/);
  const etiquetas = [{ id: 3, nombre: 'Cualificado', archivada_at: '2026-10-08' }, { id: 4, nombre: 'Seguimiento' }];
  assert.equal(nombreEtiqueta(etiquetas, 3), 'Cualificado (archivada)');
  assert.equal(nombreEtiqueta(etiquetas, 4), 'Seguimiento');
  assert.equal(nombreEtiqueta(etiquetas, 9), null);
  assert.equal(nombreEtiqueta(etiquetas, null), null);
  // El disparador puesto la dice archivada; el desplegable no la ofrece (salvo como «la que tiene puesta»).
  assert.equal(detalleDisparador({ trigger_tipo: 'etiqueta_puesta', nombreEtiqueta: nombreEtiqueta(etiquetas, 3) }), 'Se le puso «Cualificado (archivada)»');
  const secs = seccionesDisparo({ disparadores: [], productos: [], etiquetas, actual: { trigger_tipo: 'manual' }, textoActual: 'x' });
  assert.deepEqual(secs.find((s) => s.title === 'Etiquetas')?.options.map((o) => o.value), ['etiqueta:4']);
  // Y la condición «Tiene la etiqueta» la nombra con lo mismo.
  const cond: PasoParaGrafo = { id: 'c', canal: 'whatsapp', delay_horas: 0, cuerpo: '', nodo: 'condicion', si_no: null,
    ramas: [{ id: 'r', modo: 'todas', filas: [{ campo: 'etiqueta', valor: 3 }], siguiente: null }] };
  const g = grafoDeSecuencia([cond], { disparador: 'X', nombres: { etiqueta: (id) => nombreEtiqueta(etiquetas, id) } });
  assert.equal(nodo(g, 'c').puertos![0].rotulo, 'Tiene «Cualificado (archivada)»');
  assert.match(PERFIL, /nombreEtiqueta: nombreEtiqueta\(etiquetas, disparo\.etiqueta_id\),/);
  // (Con la tercera tanda el objeto suma `catalogo` y va en varios renglones: el `\s*` lo tolera.)
  assert.match(LIENZO_FLUJO, /const nombres: NombresParaTexto = \{\s*etiqueta: \(id\) => nombreEtiqueta\(etiquetas, id\)/);
});

// ── lienzo-4: con «Probar» abierto, la tarjeta no queda debajo del teléfono ───────────

test('lienzo-4: el panel corre la tarjeta al borde libre REAL, y nunca más allá de lo que se ve', () => {
  // El caso medido: lienzo de 1300, la lista de 304 a la izquierda, el panel del nodo de 392, y
  // «Probar» (360 + 32) a la derecha: el teléfono empieza en x = 924.
  const W = 1300, IZQ = 304, DER = 392, PANEL = 392, M = 12, ANCHO = 252;
  const libre = M + IZQ + PANEL + M;   // 720
  const v = vistaConPanel({ k: 1, tx: 0, ty: 0 }, 400, PANEL, M + IZQ, { separacion: M, nodoAncho: ANCHO, tope: W - DER });
  assert.ok(v, 'la tarjeta estaba debajo del panel: se tenía que correr');
  const izq = v.tx + 400;
  assert.ok(izq + ANCHO <= W - DER, `la tarjeta termina en ${izq + ANCHO}, debajo del teléfono (que empieza en ${W - DER})`);
  assert.ok(izq <= libre, `la tarjeta se corrió a ${izq}: el inset izquierdo se contó dos veces`);
  // Sin «Probar», al borde libre exacto (no a 1024, la cuenta vieja).
  const sin = vistaConPanel({ k: 1, tx: 0, ty: 0 }, 400, PANEL, M + IZQ, { separacion: M, nodoAncho: ANCHO, tope: W });
  assert.equal(sin!.tx + 400, libre);
  // /mensajes (sin inset izquierdo): la misma cuenta que antes.
  assert.equal(vistaConPanel({ k: 1, tx: 0, ty: 0 }, 28, 460, M)!.tx + 28, 460 + M * 2);
  // Si correrla no mejora nada (no hay lugar), no se corre.
  assert.equal(vistaConPanel({ k: 1, tx: 0, ty: 0 }, 400, PANEL, M + IZQ, { separacion: M, nodoAncho: ANCHO, tope: 600 }), null);
  // Y el lienzo le pasa el tope de la derecha.
  assert.match(LIENZO, /vistaConPanel\(vista\.current, n\.x, panelAncho, PANEL_MARGEN \+ insetIzq, \{\s*separacion: PANEL_MARGEN, nodoAncho: n\.ancho, tope: caja\.current\.clientWidth - insetDer,\s*\}\)/);
});

// ── lienzo-6: lo que frena Publicar se encuentra ───────────────────────────────────────

test('lienzo-6: una tarjeta se nombra por lo que DIBUJA (su título y lo que dice), nunca por un número', () => {
  const { pasos, contesta } = conCaso();
  const g = grafoDeSecuencia(pasos, { disparador: 'X' });
  for (const n of g.nodos) {
    if (!nodoPorId(pasos, n.id)) continue;
    const nombre = nombreDeTarjeta(pasos, n.id);
    assert.ok(nombre === n.titulo || nombre.startsWith(`${n.titulo}: `), `«${nombre}» no empieza por lo que dice la tarjeta («${n.titulo}»)`);
    assert.doesNotMatch(nombre, new RegExp(`^${n.titulo} \\d+$`), 'volvió el número que no se dibuja');
  }
  // Tercera tanda (decisión 5): los títulos en inglés, y todo lo que sale por WhatsApp es WHATSAPP
  // (también el «MaKo contesta» de un caso: lo que lo distingue es el ✦ de la burbuja, no el título).
  assert.equal(nombreDeTarjeta(pasos, contesta), 'WHATSAPP');
  assert.equal(nombreDeTarjeta(pasos, 'a'), 'WHATSAPP: hola');
  assert.equal(tituloDeTarjeta(nodoPorId(pasos, 'b')!, false), 'WHATSAPP');
  // El error nombra la tarjeta como se ve, sin «la condición «Condición»», y dice CUÁL es.
  const irA: PasoParaGrafo = { id: 'n0irax', canal: 'whatsapp', delay_horas: 0, cuerpo: '', nodo: 'ir_a', destino: null };
  const malos = [msg('m', { siguiente: 'n0irax' }), irA];
  const err = validarGrafo(malos)[0];
  assert.match(err, /n0irax/);
  assert.equal(errorLegible(err, malos), '«GO TO» no dice a dónde');
  assert.equal(tarjetaDelError(err, malos), 'n0irax');
  assert.equal(tarjetaDelError('tarjetas sueltas: m, n0irax', malos), 'm', 'la primera que nombra');
  assert.equal(tarjetaDelError('ids repetidos', malos), null);
  assert.deepEqual(faltaEscribir([msg('x', { cuerpo: '' })]), { id: 'x', error: 'Falta completar «WHATSAPP»' });
});

test('lienzo-6: Publicar ABRE la tarjeta culpable, y el lienzo la abre una vez por pedido', () => {
  const frenar = bloque(PERFIL, 'const frenar = (mensaje: string, tarjeta: string | null) => {', '\n  };', 400);
  assert.match(frenar, /setErr\(mensaje\);/);
  assert.match(frenar, /if \(tarjeta\) setFoco\(\(f\) => \(\{ id: tarjeta, vez: \(f\?\.vez \?\? 0\) \+ 1 \}\)\);/);
  const pub = bloque(PERFIL, 'const publicar = async () => {', '\n  };', 2_600);
  // Tercera tanda: la forma y lo vacío los arma `frenoDelFlujo` (el mismo que frena «Probar»), con
  // el error legible y la tarjeta a abrir (lo fija tests/flujo-conversacion.test.ts).
  assert.match(pub, /if \(freno\) \{ frenar\(freno\.error, freno\.tarjeta\); return; \}/);
  assert.match(pub, /frenar\(e \? errorLegible\(e, pasos\) : 'No se pudo publicar\.', e \? tarjetaDelError\(e, pasos\) : null\)/, 'el error del server tampoco abre nada');
  assert.match(PERFIL, /<FlujoLienzo[\s\S]*?foco=\{foco\}/);
  assert.match(LIENZO_FLUJO, /if \(foco && foco\.vez !== focoVisto\) \{ setFocoVisto\(foco\.vez\); setSel\(foco\.id\); \}/);
});

// ── lienzo-8: Publicar no inventa una estrategia ───────────────────────────────────────

test('lienzo-8: sin estrategia no hay nada que limpiar: no se manda `guardar-estrategia`', () => {
  assert.equal(estrategiaConLimpieza(null), null);
  const con = estrategiaConLimpieza({ objetivo: 'reactivar', modo: 'asistido', antiguedad_max_horas: 72 });
  assert.equal(con?.objetivo, 'reactivar', 'pisó el objetivo de la secuencia');
  assert.equal(con?.modo, 'automatico');
  assert.equal(con?.antiguedad_max_horas, null);
  const pub = bloque(PERFIL, 'const publicar = async () => {', '\n  };', 2_600);
  assert.match(pub, /const limpia = estrategiaConLimpieza\(est\);\s*if \(limpia\) \{/);
  assert.match(PERFIL, /convertida \? \(\(estrategiaConLimpieza\(est\) \?\? est\)/, '«Probar» prueba con una estrategia inventada');
});

// ── costuras-5 (la parte del lienzo): «Otra cosa» dice cuántas esperan ────────────────

test('costuras-5: la fila «Otra cosa» marca cuántas respuestas quedaron sin caso', () => {
  const r = crearRespuesta([msg('a')], rndDe());
  const fila = (n?: number) => nodo(grafoDeSecuencia(r.pasos, { disparador: 'X', pendientesOtraCosa: n }), r.id).puertos!.find((p) => p.id === 'si_no')!;
  assert.equal(fila(2).marca, '2 sin caso');
  assert.equal(fila(0).marca, undefined);
  assert.equal(fila().marca, undefined);
  assert.equal(fila(2).rotulo, 'Otra cosa', 'la marca no reemplaza al rótulo');
  // La tarjeta la dibuja, y el perfil cuenta las de ESTA automatización.
  // Hasta `tinteDeControl`, que desde la segunda tanda va entre la tarjeta y `BotonChico`.
  const tarjeta = bloque(LIENZO, 'export function TarjetaNodo(', '\nexport function tinteDeControl', 4_600);
  assert.match(tarjeta, /\{p\.marca && \(/);
  assert.match(PERFIL, /const pendientesOtraCosa = \(handoffs \?\? \[\]\)\.filter\(\(h\) => h\.secuenciaId === secuencia\.id\)\.length;/);
  assert.match(PERFIL, /<FlujoLienzo[\s\S]*?pendientesOtraCosa=\{pendientesOtraCosa\}/);
});

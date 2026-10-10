// =============================================================================
// El lienzo de /automations, tercera tanda (09/10/2026): títulos en inglés, WhatsApp y Email con su
// identidad, la tarjeta MAKO, el emoji del título, «Publicar» sin cartel y «Probar» por canal
// =============================================================================
// El pedido literal (Martín, 09/10/2026) está en app/admin/dev/chatbot/bitacora.ts y las decisiones
// en docs/chatbot-flujo-ramas-diseno.md → «TERCERA TANDA». Las de esta parte (B):
//   · 5  «todos los títulos de las tarjetas estén en inglés, "CRON - DELAY - WHATSAPP" no pongas
//        "Nota de voz" es simplemente "WhatsApp"... un diseño característico a las tarjetas de
//        WhatsApp e Email, que hagan recordar a esas Apps»;
//   · 8  «No puedo editar el emoji del título, y si debería»;
//   · 11 «Falta una tarjeta de "WhatsApp de MaKo"... un mensaje que envíe MaKo al grupo»;
//   · 13 «No debería dejarme "Probar" si hay cosas inconclusas... que me lleve al lugar»;
//   · 14 «al darle probar debería ser un desplegable para probar WhatsApp o Email»;
//   · 15 «Elimina lo de "Sin publicar"... se sobre entiende que si se puede apretar, es porque hay
//        cambios sin publicar».
// El tamaño del editor (1) lo mide tests/lienzo-muelles.test.ts; el CRON por pasos (4) y «Ir a»
// fuera del ＋ (3), tests/flujo-conversacion.test.ts.
//
// PROBADO ROMPIÉNDOLO (09/10/2026; con todo puesto: 10 pasan, 0 fallan). Cada rotura de a una,
// aplicada y restaurada DE MEMORIA por un arnés (nunca con `git checkout`). Pasan / fallan:
//   1. una nota de voz vuelve a titularse «Nota de voz»                              -> 9 / 1
//   2. la identidad de WhatsApp con `#25D366` puro de fondo (sin `color-mix`)        -> 9 / 1
//   3. `esMako` mira otra operación (la tarjeta MAKO vuelve a ser ACTION)            -> 7 / 3
//   4. `canalesParaProbar` ofrece Email aunque el flujo no tenga ninguno             -> 9 / 1
//   5. `emojiDeSecuencia` sin el chequeo de letras (acepta «a🚀»)                     -> 9 / 1
//      ⚠️ Sacar el chequeo de PICTOGRÁFICO sale ciega (10 / 0): «hola» lo frena igual el de letras.
//      No es un agujero del test: son dos redes sobre lo mismo, y la de letras es la que decide.
//   6. «Probar» llama `onProbar` sin pasar por `frenoDelFlujo`                       -> 9 / 1
//   7. vuelve el cartel «Sin publicar» (o «Publicar» prendido sin cambios)           -> 9 / 1
//   8. la ruta sin la acción `emoji`                                                 -> 9 / 1
//   9. el editor de la tarjeta MAKO no se monta (cae al de una Acción)               -> 9 / 1
//  10. el recordatorio con su título en castellano                                   -> 9 / 1
//
// Sexta tanda, segunda pasada (09/10/2026, parte «flujo»; base en verde 10 / 0). Pasan / fallan:
//   S1. «Si responde» vuelve a titularse REPLY                                  -> 9 / 1
//   S2. la tarjeta MAKO vuelve a llamarse «MAKO»                                -> 8 / 2
//   S3. «Probar» vuelve a colapsar todo canal a WhatsApp o Email                -> 9 / 1
//   S4. los datos de la tarjeta MAKO son los del lead y no los del equipo       -> 9 / 1
//
// Correr: node --import tsx --test tests/lienzo-tercera-tanda.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  grafoDeSecuencia, nombreDeTarjeta, canalesParaProbar, emojiDeSecuencia, esMako, makoDeAccion,
  insertarDesdeLienzo, TITULO, ID_ENTRADA, ALTO_MAKO,
  type PasoParaGrafo, type NodoFlujo,
} from '../lib/flujo-conversacion';
import { ICONO_MAKO, ICONO_GMAIL, ALTO_PUERTO } from '../lib/lienzo-grafo';
import { ID_INICIO, condicionARespuesta } from '../lib/flujo-grafo';
import { identidadDeTarjeta } from '../app/_components/Lienzo';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
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
const rndDe = (semilla = 1) => { let s = semilla; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
const msg = (id: string, extra: Partial<PasoParaGrafo> = {}): PasoParaGrafo => ({ id, canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', siguiente: null, ...extra });
/**
 * «Si responde» SIN casos y con su «Otra cosa» avisando al equipo: la forma que tienen los flujos
 * convertidos de la primera tanda. Desde la segunda pasada de la sexta tanda no hay una función que la
 * arme desde el CRON (lo nuevo nace de una CONDITION vacía, `condicionARespuesta`): es un fixture.
 */
const conRespuestaVacia = (pasos: PasoParaGrafo[]): { pasos: PasoParaGrafo[]; id: string } => ({
  pasos: [
    ...pasos,
    { id: 'R', canal: 'whatsapp', delay_horas: 0, cuerpo: '', nodo: 'respuesta', casos: [], si_no: 'otra' },
    { id: 'otra', canal: 'whatsapp', delay_horas: 0, cuerpo: '', siguiente: null, accion: { operacion: 'avisar_al_equipo', params: { leadId: 'evento', mensaje: 'Te escribió algo que no sé contestar' } } },
  ],
  id: 'R',
});
const nodo = (g: { nodos: NodoFlujo[] }, id: string): NodoFlujo => { const n = g.nodos.find((x) => x.id === id); assert.ok(n, `no está el nodo ${id}`); return n; };
const mako = (id: string, mensaje: string, extra: Partial<PasoParaGrafo> = {}): PasoParaGrafo =>
  msg(id, { cuerpo: '', accion: { operacion: 'avisar_al_equipo', params: { leadId: 'evento', mensaje } }, ...extra });

test('⚠️ los títulos, en inglés: CRON · WHATSAPP · EMAIL · DELAY · CONDITION · TAG · ACTION · MAKO · REPLY', () => {
  const pasos: PasoParaGrafo[] = [
    msg('t', { siguiente: 'au' }),
    msg('au', { tipo: 'audio', audio_id: 3, cuerpo: '', siguiente: 'ar' }),
    msg('ar', { tipo: 'media', media_id: 4, cuerpo: '', siguiente: 'ia' }),
    msg('ia', { tipo: 'ia', cuerpo: 'Saluda', siguiente: 'em' }),
    msg('em', { canal: 'email', asunto: 'Hola', siguiente: 'w' }),
    { id: 'w', canal: 'whatsapp', delay_horas: 0, cuerpo: '', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: 'c' },
    { id: 'c', canal: 'whatsapp', delay_horas: 0, cuerpo: '', nodo: 'condicion', si_no: 'tag', ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'ac' }] },
    msg('ac', { cuerpo: '', accion: { operacion: 'mover_etapa', params: {} } }),
    msg('tag', { cuerpo: '', accion: { operacion: 'poner_etiqueta_lead', params: { leadId: 'evento', etiquetaId: 2 } }, siguiente: 'mk' }),
    mako('mk', 'Llámalo hoy', { siguiente: 'ir' }),
    // Un «Ir a» que ya existía: se sigue dibujando (decisión 3: lo que se va es crearlo).
    { id: 'ir', canal: 'whatsapp', delay_horas: 0, cuerpo: '', nodo: 'ir_a', destino: { nodo: 't' } },
  ];
  const r = conRespuestaVacia(pasos);
  const g = grafoDeSecuencia(r.pasos, { disparador: 'X' });
  const titulo = (id: string) => nodo(g, id).titulo;
  assert.equal(titulo(ID_ENTRADA), 'CRON');
  for (const id of ['t', 'au', 'ar', 'ia']) assert.equal(titulo(id), 'WHATSAPP', `«${id}» no es WHATSAPP: un WhatsApp puede llevar audio, texto o archivo`);
  assert.equal(titulo('em'), 'EMAIL');
  assert.equal(titulo('w'), 'DELAY');
  assert.equal(titulo('c'), 'CONDITION');
  assert.equal(titulo('ac'), 'ACTION');
  assert.equal(titulo('tag'), 'TAG');
  // Sexta tanda: «MaKo en WhatsApp» (MaKo en WhatsApp 1: «Sino se confunde con una ayuda de la IA»), y
  // «Si responde» es la CONDITION que escucha (punto 12), sin el título REPLY.
  assert.equal(titulo('mk'), 'MAKO EN WHATSAPP');
  assert.equal(titulo(r.id), 'CONDITION');
  assert.equal(titulo('ir'), 'GO TO');
  // Todos salen del catálogo (`TITULO`): ningún título de tarjeta queda en castellano.
  const del = new Set<string>(Object.values(TITULO));
  for (const n of g.nodos) assert.ok(del.has(n.titulo), `«${n.titulo}» no sale de TITULO`);
  // La identidad: el logo de WhatsApp para todo lo que sale por ahí, el sobre de Gmail para el email.
  for (const id of ['t', 'au', 'ar', 'ia']) assert.deepEqual([nodo(g, id).icono, nodo(g, id).canal], ['whatsapp', 'whatsapp']);
  assert.deepEqual([nodo(g, 'em').icono, nodo(g, 'em').canal], [ICONO_GMAIL, 'email']);
  assert.equal(nodo(g, 'c').canal, undefined, 'una condición no lleva identidad de app');
});

test('⚠️ WhatsApp y Email con la identidad de su app, con colores que se MEZCLAN con tokens que existen en oscuro', () => {
  const wa = identidadDeTarjeta({ canal: 'whatsapp', tipo: 'mensaje' })!;
  const em = identidadDeTarjeta({ canal: 'email', tipo: 'mensaje' })!;
  const mk = identidadDeTarjeta({ tipo: 'mako' })!;
  assert.ok(wa && em && mk);
  assert.equal(identidadDeTarjeta({ tipo: 'mensaje' }), null, 'una tarjeta sin canal (/mensajes) cambió');
  assert.match(wa.borde + wa.titulo + wa.fondo, /#25D366|#128C7E/i, 'la de WhatsApp no lleva el verde');
  assert.ok(wa.patron, 'la de WhatsApp no lleva el fondo de chat');
  assert.match(em.titulo, /#EA4335/i, 'la de Email no lleva el rojo de Gmail');
  assert.equal(em.fondo, 'var(--surface)', 'la de Email no es blanca como Gmail');
  // Ningún color de marca va SOLO: se mezcla con un token (en oscuro, un #25D366 de fondo es un rectángulo fosforescente).
  const css = leer('../app/globals.css');
  const oscuro = css.slice(css.indexOf('[data-tema="oscuro"] {'), css.indexOf('}', css.indexOf('[data-tema="oscuro"] {')));
  for (const id of [wa, em, mk]) {
    for (const v of [id.fondo, id.borde, id.titulo]) {
      if (/#[0-9a-f]{6}/i.test(v)) assert.match(v, /^color-mix\(in srgb, #[0-9a-f]{6} \d+%, var\(--[\w-]+\)\)$/i, `«${v}» usa un color de marca sin mezclarlo con un token`);
      for (const [, t] of v.matchAll(/var\((--[\w-]+)\)/g)) assert.match(oscuro, new RegExp(`\\n\\s*${t}:`), `${t} no se redefine en oscuro`);
    }
  }
  // Y TarjetaNodo la usa (después del tinte de control, que no cambia).
  const lienzo = sinComentarios(leer('../app/_components/Lienzo.tsx'));
  assert.match(lienzo, /const tinte = tinteDeControl\(nodo\) \?\? identidadDeTarjeta\(nodo\);/);
  // El ícono de MaKo y el sobre de Gmail los dibuja `IconoNodo`.
  assert.match(lienzo, /if \(icono === ICONO_MAKO\) return <MakoLogo /);
  assert.match(lienzo, /if \(icono === ICONO_GMAIL\) \{/);
});

test('⚠️ la tarjeta MAKO: la Acción `avisar_al_equipo`, dibujada como su tarjeta, con el mensaje recortado', () => {
  const largo = 'Hay que llamarlo antes de las 6 porque preguntó por el precio del plan anual y quiere pagar hoy mismo';
  const g = grafoDeSecuencia([mako('mk', largo, { siguiente: 'v' }), mako('v', '')], { disparador: 'X' });
  const n = nodo(g, 'mk');
  assert.equal(n.tipo, 'mako');
  assert.equal(n.icono, ICONO_MAKO);
  assert.equal(n.familia, 'contenido', 'manda algo: es de contenido');
  // Más la fila de su salida al pie (sexta tanda, punto 4: «Entonces ●»).
  assert.equal(n.alto, ALTO_MAKO + ALTO_PUERTO);
  assert.ok(n.detalle!.length <= 90 && n.detalle!.endsWith('…'), `el mensaje no se recorta: «${n.detalle}»`);
  assert.equal(n.advertencia, undefined);
  assert.equal(nodo(g, 'v').advertencia, 'Sin escribir', 'una tarjeta MAKO sin mensaje no se marca');
  assert.deepEqual(n.puertos, [{ id: 'sig', vacio: false, paralelo: true }], 'la tarjeta MAKO sigue con una salida, como una Acción');
  assert.ok(esMako(mako('x', 'y')) && !esMako(msg('x')) && !esMako(msg('x', { accion: { operacion: 'poner_etiqueta_lead', params: {} } })));
  assert.deepEqual(makoDeAccion(mako('x', 'Llámalo', { accion: { operacion: 'avisar_al_equipo', params: { mensaje: 'Llámalo', titulo: 'Urgente' } } })), { mensaje: 'Llámalo', titulo: 'Urgente' });
  // El «Si no» con el que nace la condición que escucha es una tarjeta MAKO (el aviso al grupo): se crea
  // eligiendo «Su respuesta trata de» en una CONDITION vacía (`condicionARespuesta`).
  const vacia: PasoParaGrafo = { id: 'k', canal: 'whatsapp', delay_horas: 0, cuerpo: '', nodo: 'condicion', si_no: null, ramas: [{ id: 'kr', modo: 'todas', filas: [], siguiente: null }] };
  const cr = condicionARespuesta([msg('a', { siguiente: 'k' }), vacia], 'k', rndDe());
  assert.ok(!('error' in cr));
  const rp = (cr as { pasos: PasoParaGrafo[] }).pasos;
  const otra = rp.find((p) => p.id === rp.find((q) => q.id === 'k')!.si_no)!;
  assert.equal(nodo(grafoDeSecuencia(rp, { disparador: 'X' }), otra.id!).tipo, 'mako');
  assert.equal(nombreDeTarjeta(rp, otra.id!), 'MAKO EN WHATSAPP: Te escribió algo que no s…');
  // Y el editor de la tarjeta MAKO es el de WhatsApp en modo grupo (sexta tanda, MaKo en WhatsApp 2:
  // «la misma interfaz»): el mensaje con los datos del lead en «{ }». El título salió de la pantalla y
  // el guardado lo conserva (`params` viaja entero).
  const flujo = sinComentarios(leer('../app/automations/FlujoLienzo.tsx'));
  assert.match(flujo, /if \(esMako\(paso\)\) return <EditorMako key=\{`mako-\$\{id\}`\} /);
  const ed = bloque(flujo, 'function EditorMako(', '\n}\n', 3_200);
  assert.match(ed, /<EditorMensajeGrupo texto=\{m\.mensaje\} onTexto=\{poner\} datos=\{GRUPOS_MAKO\}/);
  assert.match(ed, /\.\.\.params, leadId: params\.leadId \?\? LEAD_DEL_EVENTO, mensaje/, 'el aviso perdió el lead del evento o el título guardado');
  // Segunda pasada: el catálogo de lo que un mensaje AL EQUIPO sobre un lead puede resolver, no los 4
  // datos del motor (MaKo en WhatsApp 4: «falta muchísimos datos posibles»).
  assert.match(flujo, /const GRUPOS_MAKO = datosOfrecidos\(\{ destino: 'equipo', conLead: true \}\);/);
  // Integración: va como ÁRBOL (prop `datos`), no aplanado con el grupo en el rótulo.
  assert.doesNotMatch(flujo, /DATOS_MAKO/, 'volvió la lista plana de la tarjeta MAKO');
  // ⚠️ Y EL RUNNER LOS REEMPLAZA (integración): «＋ Dato del lead» inserta `{{nombre}}`, y sin esto
  // salía crudo al grupo. Mensaje Y título, con la función del motor y el nombre CRUDO del lead (el
  // `nombre` del aviso trae el respaldo «el lead #N», que no es un nombre).
  // Rotura (el runner arma el texto con el mensaje crudo): 1 fallo.
  // ⚠️ Y desde la sexta tanda (segunda pasada), con el CATÁLOGO ENTERO del «{ }» para el EQUIPO
  // (`conVariables`, destino 'equipo', el workspace del ctx): lo que el árbol ofrece se resuelve.
  // Lo del motor que ya estaba en la mano va como `datos` (gana), y `aplicarVariables` cubre lo de antes
  // con una llave. Roturas en tests/motor-segunda-pasada.test.ts.
  const run = sinComentarios(leer('../lib/api-mako/areas/chatbot.run.ts'));
  assert.match(run, /\.select\('id, nombre, telefono, empresa'\)/);
  assert.match(run, /const base = lead \? valoresVariablesLead\(\{ nombre: lead\.nombreCrudo, empresa: lead\.empresa \}\) : \{\};/);
  assert.match(run, /await conVariables\(t, \{ ws, leadId: lead\?\.id \?\? null, leadNombre: lead\?\.nombreCrudo \?\? null, destino: 'equipo' \}, base\);/);
  assert.match(run, /const mensaje = await textoDelAviso\(mensajeCrudo, lead, ctx\.ws\);/);
  assert.match(run, /const titulo = \(await textoDelAviso\(String\(payload\.titulo \?\? ''\), lead, ctx\.ws\)\) \|\|/);
});

test('«Probar» ofrece sólo los canales que el flujo usa', () => {
  assert.deepEqual(canalesParaProbar([msg('a')]), ['whatsapp']);
  assert.deepEqual(canalesParaProbar([msg('a', { canal: 'email', asunto: 'x' })]), ['email']);
  assert.deepEqual(canalesParaProbar([msg('a', { siguiente: 'b' }), msg('b', { canal: 'email', asunto: 'x' })]), ['whatsapp', 'email']);
  // Una acción, una espera o la tarjeta MAKO no son un canal para probar.
  assert.deepEqual(canalesParaProbar([mako('m', 'x'), { id: ID_INICIO, nodo: 'inicio', siguiente: 'm', canal: 'email', delay_horas: 0, cuerpo: '' }]), ['whatsapp']);
  assert.deepEqual(canalesParaProbar([]), ['whatsapp'], 'sin mensajes, el teléfono (lo que «Probar» abre por default)');
});

test('⚠️ «Probar» se frena con lo mismo que Publicar, abre la tarjeta, y es un desplegable con los canales del flujo', () => {
  const perfil = sinComentarios(leer('../app/automations/SecuenciaPerfil.tsx'));
  const probar = bloque(perfil, 'const probar = (canal:', '\n  };', 400);
  const freno = probar.indexOf('const freno = frenoDelFlujo(pasos, faltanEnAccion);');
  assert.ok(freno >= 0 && freno < probar.indexOf('onProbar(canal)'), '«Probar» abre sin frenar lo inconcluso');
  assert.match(probar, /if \(freno\) \{ frenar\(freno\.error, freno\.tarjeta\); return; \}/);
  assert.match(perfil, /const canales = canalesParaProbar\(pasos\);/);
  assert.match(perfil, /: canales\.length > 1 \? \(\s*<Dropdown value="" resetAfterSelect sinFlecha=\{false\} botonLabel="▶ Probar"/);
  assert.match(perfil, /<button onClick=\{\(\) => probar\(canales\[0\]\)\} title="Probar esta automatización" style=\{estiloProbar\}>▶ Probar<\/button>/);
  // El tipo del canal es el del panel (`CanalProbar`, app/automations/PanelProbar.tsx): uno en las dos puntas.
  assert.match(perfil, /onProbar\?: \(canal: CanalProbar\) => void;/);
  assert.match(perfil, /import \{ CANALES_PROBAR, type CanalProbar \} from '\.\/PanelProbar';/);
  // Sexta tanda, segunda pasada: WhatsApp, Email, Instagram y Messenger, cada uno con su nombre y su logo
  // del MISMO lugar que el panel (`CANALES_PROBAR`). Hasta acá lo que no era email se rotulaba «WhatsApp»
  // y se probaba como WhatsApp.
  assert.match(perfil, /options=\{canales\.map\(\(c\) => \(\{ value: c, label: CANALES_PROBAR\[c\]\.nombre, icono: CANALES_PROBAR\[c\]\.logo \}\)\)\}/);
  assert.match(perfil, /if \(v && v in CANALES_PROBAR\) probar\(v as CanalProbar\);/);
  assert.doesNotMatch(perfil, /probar\(v === 'email' \? 'email' : 'whatsapp'\)/, 'volvió el desplegable que colapsa todo a WhatsApp');
  // El «⋯» de la lista prende o pausa sin remontar el lienzo: el interruptor se resiembra de la prop.
  assert.match(perfil, /if \(secuencia\.activa !== activaVista\) \{ setActivaVista\(secuencia\.activa\); setActiva\(secuencia\.activa\); \}/);
});

test('⚠️ «Publicar» sin el cartel «Sin publicar»: apagado si no hay cambios', () => {
  const perfil = sinComentarios(leer('../app/automations/SecuenciaPerfil.tsx'));
  assert.doesNotMatch(perfil, />Sin publicar</, 'volvió el cartel «Sin publicar»');
  assert.match(perfil, /<button onClick=\{\(\) => void publicar\(\)\} disabled=\{busy === 'save' \|\| !sinPublicar\}/);
});

test('el emoji del título: se guarda sólo un emoji, null vuelve al del objetivo', () => {
  assert.equal(emojiDeSecuencia('🚀'), '🚀');
  assert.equal(emojiDeSecuencia(' 👩‍👩‍👧 '), '👩‍👩‍👧', 'una familia con ZWJ');
  assert.equal(emojiDeSecuencia('👍🏽'), '👍🏽', 'un tono de piel');
  assert.equal(emojiDeSecuencia('🇲🇽'), '🇲🇽', 'una bandera');
  assert.equal(emojiDeSecuencia('hola'), null);
  assert.equal(emojiDeSecuencia('a🚀'), null, 'texto con un emoji no es un emoji');
  assert.equal(emojiDeSecuencia(''), null);
  assert.equal(emojiDeSecuencia(null), null);
  assert.equal(emojiDeSecuencia('🚀'.repeat(9)), null, 'más del tope');
});

test('⚠️ el emoji se toca en el chrome, se guarda por su acción y el GET lo devuelve (mig 0229, antes del deploy)', () => {
  const perfil = sinComentarios(leer('../app/automations/SecuenciaPerfil.tsx'));
  assert.match(perfil, /<EmojiPickerMini value=\{emojiVisto\} onPick=\{\(e\) => void guardarEmoji\(e\)\} \/>/);
  // El DTO declara `emoji` (integración): sin el cast estructural, y la lista de la izquierda dice el
  // mismo emoji que el chrome, con el mismo respaldo (el del objetivo).
  assert.match(perfil, /const emojiProp = secuencia\.emoji \?\? null;/);
  assert.match(sinComentarios(leer('../app/automations/ChatAgentApp.tsx')), /emoji\?: string \| null;/);
  assert.match(sinComentarios(leer('../app/automations/SimuladorWhatsApp.tsx')), /const emojiSecuencia = \(j: Pick<SecuenciaDto, 'emoji' \| 'estrategia'>\): string =>\n\s+j\.emoji \|\| \(j\.estrategia/);
  assert.match(perfil, /const j = await api\(\{ action: 'emoji', secuenciaId: secuencia\.id, emoji: e \}\);/);
  assert.match(perfil, /const emojiVisto = emojiGuardado \|\| \(est \? \(EMOJI_OBJ\[est\.objetivo as Objetivo\] \?\? '🎯'\) : '⚑'\);/, 'sin emoji guardado, el del objetivo');
  const ruta = sinComentarios(leer('../app/api/chat-agent/secuencias/route.ts'));
  assert.match(ruta, /if \(body\.action === 'emoji'\) \{[\s\S]{0,300}await setEmojiSecuencia\(id, body\.emoji \?\? null\);/);
  const lib = sinComentarios(leer('../lib/setting-secuencias.ts'));
  assert.match(lib, /const e = emoji == null \|\| emoji === '' \? null : emojiDeSecuencia\(emoji\);/, 'el emoji no pasa por el saneo de una sola función');
  assert.match(lib, /emoji: emojis\.get\(s\.id\) \?\? null,/, 'el GET no devuelve el emoji');
  assert.match(lib, /\.select\('id, emoji'\)\.is\('archivada_at', null\);\n\s+if \(error\) throw new Error/, 'la lectura del emoji traga el error');
  const mig = leer('../supabase/migrations/0229_secuencia_emoji.sql');
  assert.match(mig, /ORDEN DE DESPLIEGUE: ANTES DEL DEPLOY/);
  assert.match(mig, /alter table public\.nutricion_secuencias add column if not exists emoji text;/);
});

test('el recordatorio usa los MISMOS títulos que el lienzo (y la tarjeta de WhatsApp con su identidad)', () => {
  const r = sinComentarios(leer('../app/automations/RecordatorioFlujo.tsx'));
  assert.doesNotMatch(r, /titulo: '(Esperar|WhatsApp|CRON)'/, 'un título del recordatorio quedó escrito a mano');
  assert.match(r, /titulo: TITULO\.whatsapp, icono: 'whatsapp', canal: 'whatsapp'/);
});

test('la tarjeta MAKO entra por el ＋ con su logo, sobre el lead del evento', () => {
  const r = insertarDesdeLienzo([msg('a')], 'a', 'sig', 'mako', rndDe(4));
  const p = r.pasos.find((x) => x.id === r.id)!;
  assert.deepEqual(p.accion, { operacion: 'avisar_al_equipo', params: { leadId: 'evento', mensaje: '' } });
  assert.equal(p.siguiente, null);
  assert.equal(nodo(grafoDeSecuencia(r.pasos, { disparador: 'X' }), r.id!).tipo, 'mako');
});

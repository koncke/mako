// =============================================================================
// Los {{datos}} AZULES y CLICKEABLES al editar (undécima tanda, punto 7)
// =============================================================================
// Martín, textual: «Y los datos, al momento de EDITAR, también se deben marcar en azul y ser clickeables, si los
// clickeo que salte el desplegable con el dato que elegí y que se pueda cambiar allí mismo por otro dato.» Y el 6:
// «El desplegable de datos solo me muestra 5 opciones, cuando normalmente hay muchos datos que se pueden citar».
//
// Lo que este archivo EJECUTA:
//   · el espejo de `CampoConDatos` (app/_components/CampoConDatos.tsx): cada token en un span con su color, el que
//     ESTE mensaje no puede mandar en rojo, sin peso (con 600 el cursor se corre) y el texto del campo INTACTO;
//   · la lógica pura: qué token tiene el cursor, el reemplazo (guarda el TOKEN, nunca el rótulo) y que el rojo es la
//     MISMA pregunta que Publicar (`problemasDeTokens`, lib/tokens-del-flujo.ts);
//   · el «{ }» con el dato elegido (`ArbolDeDatos seleccionado`): abre SU rama, lo marca y nada más;
//   · la decoración del cuerpo rico del email (`DatosResaltados`, app/_ui/EditorRico.tsx): pinta sin tocar el
//     documento (el HTML que sale no cambia), y un token partido por una marca no se pinta;
//   · el cableado: los cinco campos donde se escriben tokens montan la pieza, y su «{ }» abre el dato del cursor;
//   · «Probar» resuelve con `textoConDatos` (el envío) y con los ejemplos de los datos de cada evento.
//
// PROBADO ROMPIÉNDOLO (11/10/2026, arnés scratchpad/wf-undecima/w3-datos-editores/romper.mjs: rompe UNA cosa, corre,
// cuenta y restaura; base: 12 tests, 12 pases):
//   R1. `cambiarDato` guarda el RÓTULO del dato (`datoDe(nuevo).label`) en vez de `{{clave}}`      → 11 / 1
//   R2. el span del token en el espejo con `fontWeight: 600`                                      → 11 / 1
//   R3. `ArbolDeDatos` abre siempre la primera rama (ignora `seleccionado` al abrir)              → 11 / 1
//   R4. `fueraDelContexto` sin la línea de `{{mensaje_mako}}` (Publicar lo rechaza siempre)       → 11 / 1
//   R5. el composer sin pasarle `datos` a la pieza → 11 / 1 acá (CABLEADO) y 14 / 1 en tests/composer-whatsapp
//   R6. `textoDeEjemplo` con un reemplazo simple (sin el renglón opcional del envío)              → 11 / 1
//   R7. `ejemplosDelEvento` sin los del pago                                                       → 11 / 1
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { EditorState } from '@tiptap/pm/state';
import {
  CampoConDatos, tramosDelCampo, tokenEnCursor, cambiarDato, fueraDelContexto, fueraDelArbol, puntoEnCajas, colorDelDato,
} from '../app/_components/CampoConDatos';
import { ArbolDeDatos, ramaDelDato } from '../app/_components/SelectorDatos';
import { datosDelDoc, decoracionesDeDatos, DatosResaltados } from '../app/_ui/EditorRico';
import { datosOfrecidos, datoDe, VARIABLES_AVISO, CLAVE_MENSAJE_MAKO } from '../lib/variables-aviso';
import { problemasDeTokens, contextoDeTarjeta } from '../lib/tokens-del-flujo';
import { EVENTOS_MAKO, TRIGGER_AVISO_MAKO, TRIGGER_SOLO_GRUPO } from '../lib/disparadores';
import { OP_AVISAR } from '../lib/flujo-legado';
import type { PasoGrafo } from '../lib/flujo-grafo';
import { textoDeEjemplo } from '../lib/simulador-grafo';
import { ejemplosDelEvento } from '../app/automations/PanelProbar';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const sinEtiquetas = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
const ARBOL_LEAD = datosOfrecidos({ destino: 'lead', conLead: true });
const FUERA_LEAD = fueraDelContexto({ destino: 'lead', conLead: true });

// ── El espejo, dibujado ──────────────────────────────────────────────────────────────────────────────────────

test('el espejo: cada token en su span azul, el que no se puede mandar en rojo, sin peso, y el texto INTACTO', () => {
  const texto = 'Hola {{nombre}}, mira {{link_lead}}\n';
  const html = renderToStaticMarkup(createElement(CampoConDatos, {
    datos: ARBOL_LEAD, fuera: FUERA_LEAD, onValor: () => {},
    children: createElement('textarea', { value: texto, onChange: () => {}, style: { background: 'var(--surface-2)', color: 'var(--ink)' } }) as never,
  }));
  assert.match(html, /^<div data-campo-datos=""/, 'sin la caja del espejo');
  const tokens = [...html.matchAll(/<span data-dato="([a-z_]+)" data-ini="(\d+)" data-fin="(\d+)" style="([^"]*)">([^<]*)<\/span>/g)];
  assert.deepEqual(tokens.map((m) => [m[1], Number(m[2]), Number(m[3]), m[5]]), [['nombre', 5, 15, '{{nombre}}'], ['link_lead', 22, 35, '{{link_lead}}']],
    'el espejo tiene que mostrar el TOKEN (con sus offsets), no su rótulo');
  assert.equal(tokens[0]![4], 'color:var(--primary-strong)');
  assert.equal(tokens[1]![4], 'color:var(--bad)', 'un dato del equipo en un mensaje al lead va en rojo');
  for (const m of tokens) assert.doesNotMatch(m[4]!, /font-weight|font-style/, 'con otro peso el texto del espejo es más ancho y el cursor se corre');
  // El campo sigue siendo el textarea de siempre, con su texto plano, transparente y con el cursor visible.
  const campo = html.slice(html.indexOf('<textarea'));
  assert.ok(campo.includes(`>${texto}</textarea>`), 'el texto del campo cambió');
  assert.match(campo, /color:transparent/);
  assert.match(campo, /caret-color:var\(--ink\)/);
  assert.match(campo, /class="mk-campo-datos"/);
  // El espejo lleva el fondo del campo (el campo queda transparente) y dice el MISMO texto (más el renglón final).
  const espejo = html.slice(html.indexOf('<div aria-hidden="true"'), html.indexOf('<textarea'));
  assert.match(espejo, /background:var\(--surface-2\)/);
  assert.equal(sinEtiquetas(espejo).replace('​', ''), texto);
  assert.ok(!html.includes('<style'), 'el CSS del campo va al head una vez, no en cada editor');
});

test('sin `datos`, el campo queda TAL CUAL (los chats de /whatsapp); un <input> lleva su value y el espejo en una línea', () => {
  const area = () => createElement('textarea', { value: 'Hola {{nombre}}', onChange: () => {}, style: { color: 'var(--ink)' } }) as never;
  assert.equal(
    renderToStaticMarkup(createElement(CampoConDatos, { onValor: () => {}, children: area() })),
    renderToStaticMarkup(area()),
  );
  assert.equal(renderToStaticMarkup(createElement(CampoConDatos, { datos: [], onValor: () => {}, children: area() })), renderToStaticMarkup(area()));
  const input = renderToStaticMarkup(createElement(CampoConDatos, {
    datos: ARBOL_LEAD, onValor: () => {},
    children: createElement('input', { value: 'Tu reunión {{reunion_cuando}}', onChange: () => {} }) as never,
  }));
  assert.match(input, /<input[^>]*value="Tu reunión \{\{reunion_cuando\}\}"/);
  assert.match(input, /<span data-dato="reunion_cuando"/);
  assert.match(input, /display:flex;align-items:center;white-space:pre/, 'el texto de un input va centrado y sin cortar');
});

// ── Lo puro ──────────────────────────────────────────────────────────────────────────────────────────────────

test('los tramos del espejo suman el texto entero, con la clave de cada token en minúsculas', () => {
  const t = 'A {{Nombre}} y {{inventada}}, {{lead_nombre}}.';
  const tramos = tramosDelCampo(t, fueraDelArbol(ARBOL_LEAD));
  assert.equal(tramos.map((x) => x.txt).join(''), t);
  assert.deepEqual(tramos.filter((x) => x.dato).map((x) => [x.dato, x.fuera]), [['nombre', false], ['inventada', true], ['lead_nombre', false]],
    'un nombre viejo del catálogo (oculto) se resuelve: no va en rojo');
  assert.deepEqual(tramosDelCampo(''), []);
  assert.equal(colorDelDato(true), 'var(--bad)');
});

test('el token del cursor: ADENTRO o seleccionado entero; pegado antes o después, no', () => {
  const t = 'Hola {{nombre}}!';
  assert.deepEqual(tokenEnCursor(t, 8, 8), { ini: 5, fin: 15, key: 'nombre' });
  assert.deepEqual(tokenEnCursor(t, 5, 15), { ini: 5, fin: 15, key: 'nombre' });
  assert.equal(tokenEnCursor(t, 5, 5), null, 'antes del token el «{ }» inserta otro');
  assert.equal(tokenEnCursor(t, 15, 15), null, 'después, también');
  assert.equal(tokenEnCursor(t, 3, 9), null, 'una selección que lo corta no es el token');
  assert.equal(tokenEnCursor(t, null, null), null);
});

test('cambiar un dato guarda el TOKEN nuevo en su lugar (nunca el rótulo) y deja el cursor después', () => {
  const r = cambiarDato('Hola {{nombre}}!', { ini: 5, fin: 15, key: 'nombre' }, 'reunion_hora');
  assert.deepEqual(r, { valor: 'Hola {{reunion_hora}}!', cursor: 21 });
  assert.ok(!r!.valor.includes(datoDe('reunion_hora')!.label), 'se guardó el rótulo: el motor no lo resuelve y el dato desaparece');
  assert.equal(cambiarDato('Hola X{{nombre}}!', { ini: 5, fin: 15, key: 'nombre' }, 'empresa'), null, 'el texto se movió: no se pisa otra cosa');
  assert.deepEqual(cambiarDato('{{NOMBRE}}', { ini: 0, fin: 10, key: 'nombre' }, 'Empresa'), { valor: '{{empresa}}', cursor: 11 });
  assert.ok(puntoEnCajas([{ left: 10, top: 10, right: 50, bottom: 30 }, { left: 0, top: 30, right: 20, bottom: 50 }], 5, 40));
  assert.ok(!puntoEnCajas([{ left: 10, top: 10, right: 50, bottom: 30 }], 60, 20));
});

test('⚠️ el ROJO es la MISMA pregunta que Publicar (`problemasDeTokens`), tarjeta por tarjeta y dato por dato', () => {
  const claves = [...VARIABLES_AVISO.map((v) => v.key), 'inventada', CLAVE_MENSAJE_MAKO];
  const mensaje = (cuerpo: string, proveedor: string): PasoGrafo => ({ canal: 'whatsapp', cuerpo, proveedor } as PasoGrafo);
  const mako = (mensaje: string): PasoGrafo => ({ accion: { operacion: OP_AVISAR, params: { mensaje } } } as unknown as PasoGrafo);
  const filas: Array<{ trigger: string; subtipo?: string }> = [
    { trigger: 'etapa_actual' }, { trigger: TRIGGER_SOLO_GRUPO },
    ...EVENTOS_MAKO.map((e) => ({ trigger: TRIGGER_AVISO_MAKO, subtipo: e.subtipo })),
  ];
  let comparados = 0;
  for (const f of filas) {
    for (const hacer of [(c: string) => mensaje(c, 'no_oficial'), (c: string) => mensaje(c, 'oficial'), mako]) {
      const ctx = contextoDeTarjeta(hacer('x'), { trigger_tipo: f.trigger, subtipo: f.subtipo });
      if (!ctx) continue;
      const fuera = fueraDelContexto(ctx.tipo === 'oficial' ? 'oficial' : ctx.datos);
      for (const k of claves) {
        const publicar = problemasDeTokens([hacer(`{{${k}}}`)], f.trigger, f.subtipo).length > 0;
        assert.equal(fuera(k), publicar, `${f.trigger}/${f.subtipo ?? ''}: {{${k}}} — el editor y Publicar no dicen lo mismo`);
        comparados++;
      }
    }
  }
  assert.ok(comparados > 500, `comparó ${comparados}`);
});

// ── El «{ }» con el dato elegido ─────────────────────────────────────────────────────────────────────────────

/** Las ramas (y sub-ramas) del árbol dibujado: su nombre y si están abiertas. */
const ramas = (html: string) => [...html.matchAll(/<button type="button" class="mk-dato" aria-expanded="(true|false)"[^>]*>([\s\S]*?)<\/button>/g)]
  .map((m) => ({ abierta: m[1] === 'true', texto: sinEtiquetas(m[2]!) }));

test('`seleccionado` abre SU rama, lo marca con ✓ (aria-current) y no marca nada más', () => {
  assert.deepEqual(ramaDelDato(ARBOL_LEAD, 'REUNION_HORA'), { grupo: 'reuniones', rama: 'Próxima reunión' });
  assert.equal(ramaDelDato(ARBOL_LEAD, 'inventada'), null);
  const html = renderToStaticMarkup(createElement(ArbolDeDatos, { grupos: ARBOL_LEAD, seleccionado: 'reunion_hora', onElegir: () => {} }));
  const r = ramas(html);
  assert.ok(r.find((x) => x.texto.startsWith('Reuniones'))?.abierta, 'la rama del dato elegido no se abrió');
  assert.equal(r.find((x) => x.texto.startsWith('Lead'))?.abierta, false, 'una rama a la vez');
  assert.ok(r.find((x) => x.texto.startsWith('Próxima reunión'))?.abierta, 'la sub-rama del dato, abierta');
  const marcados = [...html.matchAll(/<button[^>]*aria-current="true"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => sinEtiquetas(m[1]!));
  assert.equal(marcados.length, 1);
  assert.match(marcados[0]!, /^Hora10:00 a\. m\.✓$/);
  // Sin `seleccionado`, lo de siempre: la primera rama abierta y nada marcado.
  const sin = renderToStaticMarkup(createElement(ArbolDeDatos, { grupos: ARBOL_LEAD, onElegir: () => {} }));
  assert.ok(ramas(sin).find((x) => x.texto.startsWith('Lead'))?.abierta);
  assert.ok(!sin.includes('aria-current'));
  // Un dato que no está en el árbol (uno rojo) no rompe nada: abre como siempre.
  const rojo = renderToStaticMarkup(createElement(ArbolDeDatos, { grupos: ARBOL_LEAD, seleccionado: 'link_lead', onElegir: () => {} }));
  assert.ok(ramas(rojo).find((x) => x.texto.startsWith('Lead'))?.abierta);
});

test('el «{ }» de un mensaje al lead: el árbol entero, con la sub-rama «Próxima reunión» (no los 5 de antes)', () => {
  const claves = ARBOL_LEAD.flatMap((g) => g.items.map((d) => d.key));
  assert.ok(claves.length > 40, `${claves.length} datos`);
  for (const k of ['reunion_cuando', 'reunion_hora', 'reunion_faltan', 'reunion_link', 'reunion_cual']) assert.ok(claves.includes(k), k);
  assert.ok(!claves.includes(CLAVE_MENSAJE_MAKO));
});

// ── «Probar» con los datos nuevos ────────────────────────────────────────────────────────────────────────────

test('«Probar» resuelve como el envío (`textoConDatos`): el renglón sin valor se va, y el evento trae sus ejemplos', () => {
  // Sin el nombre del negocio (no se inventa uno), su renglón se va entero, como en el envío; con él, se pone.
  assert.equal(textoDeEjemplo('Hola\nTe escribe {{negocio}}', null), 'Hola');
  assert.equal(textoDeEjemplo('Hola\nTe escribe {{negocio}}', 'Valle Sur'), 'Hola\nTe escribe Valle Sur');
  assert.equal(textoDeEjemplo('Hola {{inventada}}', null), 'Hola {{inventada}}', 'lo desconocido queda crudo: se nota');
  assert.equal(textoDeEjemplo('Es {{reunion_cuando}} a las {{reunion_hora}}', null), 'Es mañana a las 10:00 a. m.', 'la próxima reunión, con sus ejemplos');
  // Los datos de cada evento de MaKo, del catálogo: el pago y lo que escribió el lead (nuevos), la cuota (de antes).
  const pago = ejemplosDelEvento('pago_recibido');
  assert.equal(pago.pago_monto, datoDe('pago_monto')!.ejemplo);
  assert.equal(pago.pago_pasarela, datoDe('pago_pasarela')!.ejemplo);
  assert.equal('cuota_monto' in pago, false, 'el pago no trae la cuota');
  assert.equal(ejemplosDelEvento('lead_contesta').lead_escribio, datoDe('lead_escribio')!.ejemplo);
  assert.equal('lead_escribio' in ejemplosDelEvento('cuota_vencida'), false);
});

// ── El cuerpo rico del email ─────────────────────────────────────────────────────────────────────────────────

const SCHEMA = getSchema([StarterKit]);
const DOC = SCHEMA.nodeFromJSON({
  type: 'doc',
  content: [{
    type: 'paragraph',
    content: [
      { type: 'text', text: 'Hola {{nombre}}, ' },
      { type: 'text', text: '{{empresa}}', marks: [{ type: 'bold' }] },
      { type: 'text', text: ' y {{nom' },
      { type: 'text', text: 'bre}} {{link_lead}}', marks: [{ type: 'italic' }] },
    ],
  }],
});

test('la decoración: cada token entero en azul (rojo el que no se manda); partido por una marca, no se pinta', () => {
  const datos = datosDelDoc(DOC);
  assert.deepEqual(datos.map((d) => [d.key, DOC.textBetween(d.desde, d.hasta)]), [['nombre', '{{nombre}}'], ['empresa', '{{empresa}}'], ['link_lead', '{{link_lead}}']],
    '«{{nom» + «bre}}» en dos marcas no es un dato (tampoco se resuelve al mandar)');
  const decos = decoracionesDeDatos(DOC, FUERA_LEAD).find();
  const attrs = decos.map((d) => (d as unknown as { type: { attrs: Record<string, string> } }).type.attrs);
  assert.deepEqual(attrs.map((a) => [a['data-dato'], a.style]), [
    ['nombre', 'color:var(--primary-strong);cursor:pointer'],
    ['empresa', 'color:var(--primary-strong);cursor:pointer'],
    ['link_lead', 'color:var(--bad);cursor:pointer'],
  ]);
});

test('la decoración NO toca el documento: ni nodo ni marca nuevos, y el estado con el plugin guarda lo mismo', () => {
  const con = getSchema([StarterKit, DatosResaltados]);
  assert.deepEqual(Object.keys(con.nodes), Object.keys(SCHEMA.nodes), 'la extensión agregó un nodo: el HTML guardado cambiaría');
  assert.deepEqual(Object.keys(con.marks), Object.keys(SCHEMA.marks), 'la extensión agregó una marca: el HTML guardado cambiaría');
  const ext = DatosResaltados.configure({ leer: () => ({ onDato: () => {}, fuera: FUERA_LEAD }) });
  const plugins = ext.config.addProseMirrorPlugins!.call({ options: ext.options } as never);
  const estado = EditorState.create({ doc: DOC, plugins });
  assert.ok(estado.doc.eq(DOC));
  const sig = estado.apply(estado.tr.insertText('¡', 1));
  assert.deepEqual(sig.doc.toJSON(), EditorState.create({ doc: DOC }).apply(EditorState.create({ doc: DOC }).tr.insertText('¡', 1)).doc.toJSON());
  const decos = plugins[0]!.props.decorations!.call(plugins[0]!, sig) as ReturnType<typeof decoracionesDeDatos>;
  assert.equal(decos.find().length, 3, 'las decoraciones siguen al texto que cambia');
});

// ── El cableado ──────────────────────────────────────────────────────────────────────────────────────────────

test('CABLEADO: los cinco campos donde se escriben tokens montan la pieza, y su «{ }» abre el dato del cursor', () => {
  const comp = sinComentarios(leer('app/whatsapp/_shared/ComposerWhatsApp.tsx'));
  assert.match(comp, /<CampoConDatos ref=\{campoDatos\} datos=\{datos\} fuera=\{datosFuera\} onValor=\{escribirCampo\} estiloCaja=\{\{ flex: 1, minWidth: 0 \}\}>\s*<textarea ref=\{campo\}/);
  assert.match(comp, /abrirDatoEnCursor: \(\) => campoDatos\.current\?\.abrirDatoEnCursor\(\) \?\? false/);
  const wa = sinComentarios(leer('app/automations/EditorMensajeWhatsApp.tsx'));
  assert.equal((wa.match(/datos=\{grupos\}\s*datosFuera=\{datosFuera\}/g) ?? []).length, 2, 'las dos barras del editor (varias partes y un mensaje)');
  assert.match(wa, /if \(abierto !== 'datos' && composer\.current\?\.abrirDatoEnCursor\(\)\) return;/);
  const social = sinComentarios(leer('app/automations/EditorMensajeSocial.tsx'));
  assert.match(social, /<CampoConDatos ref=\{campoDatos\} datos=\{datos\} onValor=\{escribir\}[^>]*>\s*<textarea ref=\{area\}/);
  assert.match(social, /campoDatos\.current\?\.abrirDatoEnCursor\(\)/);
  const mail = sinComentarios(leer('app/automations/EditorEmailGmail.tsx'));
  // (15/10/2026: el rojo es el de ESTE email —el del lead, o el de la persona de un evento—: `fuera`.)
  assert.match(mail, /const \[fuera\] = useState\(\(\) => \(persona \? fueraDelContexto\(persona\.contexto\) : FUERA_EMAIL\)\);/);
  assert.match(mail, /<CampoConDatos ref=\{datosAsunto\} datos=\{datos\} fuera=\{fuera\} onValor=\{\(v\) => onChange\(\{ asunto: v \}\)\} estiloCaja=\{\{ flex: 1 \}\}>\s*<input ref=\{campoAsunto\}/);
  assert.match(mail, /<CampoConDatos ref=\{datosHtml\} datos=\{datos\} fuera=\{fuera\} onValor=\{alCambiarCrudo\}[^>]*>\s*<textarea ref=\{campoHtml\}/);
  assert.match(mail, /botonesExtra=\{botonesBarra\} datos=\{datosRico\} \/>/, 'el cuerpo rico sin sus datos azules');
  assert.match(mail, /if \(tipo === 'datos-cuerpo' && modo === 'visual' && abierto !== tipo && datoEnCursorRico\.current\) \{ setDatoRico\(datoEnCursorRico\.current\); return; \}/);
  assert.match(mail, /datosAsunto\.current\?\.abrirDatoEnCursor\(\)/);
  assert.match(mail, /datosHtml\.current\?\.abrirDatoEnCursor\(\)/);
  assert.match(mail, /<ArbolDeDatos grupos=\{datos\} seleccionado=\{datoRico\.key\} onElegir=\{\(k\) => \{ datoRico\.reemplazar\(k\); setDatoRico\(null\); \}\} \/>/);
  const aviso = sinComentarios(leer('app/agencia/FlujoAviso.tsx'));
  assert.match(aviso, /<CampoConDatos ref=\{datosCuerpo\} datos=\{datos\} onValor=\{onTexto\}>\s*<textarea ref=\{cuerpo\}/);
  const pieza = sinComentarios(leer('app/_components/CampoConDatos.tsx'));
  assert.match(pieza, /<ArbolDeDatos grupos=\{datos \?\? \[\]\} seleccionado=\{tocado\.key\} onElegir=\{elegir\} \/>/);
  const rico = sinComentarios(leer('app/_ui/EditorRico.tsx'));
  assert.match(rico, /\.\.\.\(datosRef\.current \? \[DatosResaltados\.configure\(\{ leer: \(\) => datosRef\.current \}\)\] : \[\]\)/, 'las lecciones del curso tienen que quedar como estaban');
  // Y el «{ }» de un mensaje del lienzo sale del contexto con que Publicar lo valida.
  const lienzo = sinComentarios(leer('app/automations/FlujoLienzo.tsx'));
  const ed = lienzo.slice(lienzo.indexOf('function EditorMensaje('), lienzo.indexOf('\nfunction EditorMako('));
  assert.match(ed, /contextoDeTarjeta\(paso, \{ trigger_tipo: triggerTipo \?\? '' \}\)/);
  assert.match(ed, /datosOfrecidos\(tarjeta\.datos\)/);
  assert.match(ed, /datos=\{datosTarjeta\}\s*contexto=\{tarjeta\?\.tipo === 'catalogo' \? tarjeta\.datos : tarjeta\?\.tipo\}/);
});

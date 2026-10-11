// =============================================================================
// Los datos que se meten adentro de un mensaje: que no se rompan al dibujarse
// =============================================================================
// Pedido textual (30/09/2026): «hace falta configurar llamados a datos dentro de
// MaKo... Por ejemplo, llamados al CRM, traer el nombre, el número, el email... Y
// revisa también que hoy en día tenemos varios LINKS dentro de MaKo que podrían ser
// de utilidad... Para evitar poner mucha info dentro de un mensaje».
//
// Lo que se persigue acá falla EN SILENCIO y en la pantalla: un token partido por la
// mitad por el guión bajo de la itálica, un chip que el serializador aplana y borra la
// variable entera, una variable que se ofrece en un mensaje que no la puede resolver y
// sale cruda al WhatsApp del cliente.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TextoMarcas } from '../app/_components/TextoMarcas';
import {
  VARIABLES_AVISO, RUTA_DE_LINK, tramosConVariables, variablesPara,
  resolverVariables, valoresDeEjemplo, GRUPOS_VARIABLES, CLAVES_DEL_LEAD,
  necesitaFichaDelLead, agruparVariables, variablesPorGrupo, RE_VARIABLE,
  variablesOfrecidas,
} from '../lib/variables-aviso';
import { valoresDelLead, plata, fecha } from '../lib/variables-del-lead';
import { CATALOGO_AVISOS } from '../lib/avisos-catalogo';
import type { Lead } from '../lib/leads';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
/** ⚠️ Sin comentarios: un guard que busca el nombre de lo que NO tiene que estar se
 *  acusa a sí mismo por el párrafo que explica por qué no está. */
/** Gente y negocios REALES de este producto. Vive acá arriba y no adentro de un test
 *  porque la miran DOS: el catálogo de variables y los placeholders de los formularios.
 *  Son nombres que YA están en el repo (bitácoras, hallazgos, catálogos), así que el guard
 *  no agrega información que no esté — caza LOS CONOCIDOS, que es lo automatizable. */
const REALES = [
  'Mauricio', 'Leila', 'Martín', 'Joan', 'Juan Francisco',
  'Código Inmobiliario', 'Negocio que Escala', 'MasteryHaus', 'Vértice', 'AvatarHype',
  // Un lead de un cliente: el ejemplo de `reunion-recordatorio` lo nombraba, y un agendado
  // se lo mandó al grupo de otro (06/10/2026).
  'Francisco Ramos', 'Dental Ramos',
  // Clientes de Mauricio que nombraban los ejemplos del catálogo de mensajes (revisión del ws9, 10/10/2026).
  'Sergio Esquer', 'BG Trucking', 'Aspro',
];
const sinAcentos = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const sinComentarios = (src: string): string =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── el token sobrevive al pintado ───────────────────────────────────────────

test('⚠️ DOS TOKENS EN UNA LÍNEA NO SE COMEN ENTRE SÍ POR EL GUIÓN BAJO', () => {
  // La itálica de WhatsApp es `_texto_`, y `{{lead_nombre}}` trae un `_` adentro: sin
  // separarlos, el `_` de un token cierra con el del siguiente y la línea se dibuja
  // «Hola {{leadnombre}}, mirá {{linkcrm}}» en itálica. Es el bug que hace que la
  // feature entregue un control que se ve roto.
  const tr = tramosConVariables('Hola {{lead_nombre}}, mirá {{link_crm}} hoy');
  assert.deepEqual(tr.map((t) => t.esVar), [false, true, false, true, false]);
  assert.deepEqual(tr.filter((t) => t.esVar).map((t) => t.txt), ['{{lead_nombre}}', '{{link_crm}}']);
  // Y el texto se conserva ENTERO: partir no puede perder ni un carácter.
  assert.equal(tr.map((t) => t.txt).join(''), 'Hola {{lead_nombre}}, mirá {{link_crm}} hoy');
});

test('Una línea sin tokens vuelve entera, en un solo tramo', () => {
  const tr = tramosConVariables('*Reporte semanal* — todo bien');
  assert.deepEqual(tr, [{ txt: '*Reporte semanal* — todo bien', esVar: false }]);
});

test('⚠️ LA BURBUJA DIBUJA EL TOKEN ENTERO, sin partirlo en itálica', () => {
  // ⚠️ ESTE TEST MIDE EL COMPORTAMIENTO, NO EL TEXTO DEL ARCHIVO. La primera versión
  // comprobaba que `tramosConVariables(` apareciera en el fuente: apagando el `if` que
  // lo llama, el nombre seguía ahí y el test daba VERDE sobre el bug. Lo delató
  // romperlo. Ahora se renderiza de verdad.
  const html = renderToStaticMarkup(
    createElement(TextoMarcas, { texto: 'Hola {{lead_nombre}}, mira {{link_crm}} hoy' }),
  );
  assert.ok(html.includes('{{lead_nombre}}'), `el token salió partido: ${html}`);
  assert.ok(html.includes('{{link_crm}}'), `el segundo token salió partido: ${html}`);
  assert.ok(!/<i>/.test(html), `el guión bajo de los tokens abrió una itálica: ${html}`);
  // Y las marcas de verdad siguen funcionando al lado de un token.
  const conNegrita = renderToStaticMarkup(
    createElement(TextoMarcas, { texto: '*Hola* {{lead_nombre}}' }),
  );
  assert.match(conNegrita, /font-weight:700/);
  assert.ok(conNegrita.includes('{{lead_nombre}}'));
});

test('Y el EDITOR de los avisos es el de WhatsApp: escribe en una caja de texto y la burbuja pinta con la misma regla', () => {
  // Hasta la sexta tanda el otro renderer era el editor de marcas de /mensajes
  // (app/agencia/EditorMensaje.tsx, un contentEditable que partía el token si no usaba
  // `tramosConVariables`). Martín (MaKo en WhatsApp 2 y 3): «El editable de MaKo en WhatsApp
  // debe ser lo mismo que el editable de WhatsApp» y «tienen una interfaz vieja, elimina eso».
  // El editor ahora es el composer de WhatsApp (una caja de texto: lo que se tipea es lo que se
  // guarda, sin serializador que pueda partir un token) y lo único que PINTA es la burbuja, que
  // va por `TextoMarcas` — el renderer que el test de arriba cuida.
  //
  // PROBADO ROMPIÉNDOLO (09/10/2026, segunda pasada, parte «datos», arnés w2-datos/romper.mjs,
  // restaurado de memoria): FlujoAviso montando otro editor en lugar de `<EditorMensajeGrupo` → 2
  // fallos (éste y «Los nodos montan…» de tests/flujo-aviso); la burbuja de la tarjeta como saliente
  // (la del negocio, no la de MaKo) → 1 fallo. Restaurado → en verde.
  const flujo = sinComentarios(leer('../app/agencia/FlujoAviso.tsx'));
  assert.match(flujo, /<EditorMensajeGrupo texto=\{texto\} onTexto=\{onTexto\}/, 'el aviso volvió a otro editor que el de WhatsApp');
  assert.doesNotMatch(flujo, /<EditorMensaje\b|from '\.\/EditorMensaje'/, 'volvió el editor de marcas de /mensajes');
  assert.match(flujo, /<BurbujaHilo compacta saliente=\{false\} autor="MaKo" contenido=\{\{ texto \}\}/, 'la tarjeta dejó de ser la burbuja de MaKo');
  assert.match(sinComentarios(leer('../app/whatsapp/_shared/BurbujaHilo.tsx')), /<TextoMarcas texto=\{texto!\} \/>/, 'la burbuja pinta por otro lado');
});

// ── el catálogo ─────────────────────────────────────────────────────────────

test('Cada link del catálogo tiene su ruta, y cada ruta su link', () => {
  // Un link ofrecido sin ruta sale como `{{link_x}}` crudo al WhatsApp del cliente; una
  // ruta sin link es código que no ofrece nadie. Se cruzan en las dos direcciones.
  // `link_lead` (lleva el id del evento) y `link_pago` (el /pagar/<token> de su cobro, 11/10/2026) no
  // son una pantalla de MaKo: no tienen ruta fija.
  const delCatalogo = VARIABLES_AVISO.filter((v) => v.key.startsWith('link_') && v.key !== 'link_lead' && v.key !== 'link_pago').map((v) => v.key).sort();
  assert.deepEqual(delCatalogo, Object.keys(RUTA_DE_LINK).sort());
  for (const r of Object.values(RUTA_DE_LINK)) assert.match(r, /^\/[a-z-]+$/, `ruta rara: ${r}`);
});

test('⚠️ Lo que necesita un LEAD no se ofrece en un mensaje que no habla de ninguno', () => {
  // El resolvedor deja intacto lo que no sabe —a propósito: crudo se nota, borrado no—
  // así que el filtro de la pantalla es lo ÚNICO que evita que un `{{lead_nombre}}`
  // llegue crudo al WhatsApp del cliente.
  const sinLead = variablesPara({ conLead: false }).map((v) => v.key);
  assert.ok(!sinLead.includes('nombre'), 'ofreció un dato del lead sin lead');
  assert.ok(!sinLead.includes('link_lead'));
  assert.ok(sinLead.includes('link_crm'), 'los links no dependen de ningún lead');
  assert.ok(variablesPara({ conLead: true }).map((v) => v.key).includes('nombre'));
  // `lead_nombre` (el nombre de antes de los avisos) se resuelve y ya no se ofrece: el árbol tiene
  // `nombre_completo`, y dos filas iguales en un desplegable son una pregunta que no se entiende.
  assert.ok(!variablesPara({ conLead: true }).some((v) => v.key === 'lead_nombre'));
});

test('⚠️ NO entran los números de un proveedor: un aviso no puede pagar 900 ms', () => {
  // La regla de admisión es «sólo lo que quien emite YA TIENE en la mano». Para el
  // presupuesto y el gasto está el link, que lleva a donde el número está fresco — que
  // es, textual, «para evitar poner mucha info dentro de un mensaje».
  for (const prohibida of ['presupuesto', 'gasto', 'cpl', 'roas', 'saldo']) {
    assert.ok(!VARIABLES_AVISO.some((v) => v.key === prohibida), `entró ${prohibida}, que cuesta una llamada a Meta`);
  }
  assert.ok(VARIABLES_AVISO.some((v) => v.key === 'link_anuncios'), 'se fue el link que los reemplaza');
});

// ── la sustitución ──────────────────────────────────────────────────────────

test('Lo conocido se reemplaza y lo desconocido queda CRUDO', () => {
  // Crudo se ve raro y se nota; borrado deja el mensaje cojo y nadie se entera de que
  // faltaba algo. Es una decisión, y por eso tiene test.
  const out = resolverVariables('Hola {{lead_nombre}}, {{inventada}} y {{link_crm}}', {
    lead_nombre: 'Sofía', link_crm: 'https://hola-mako.com/crm',
  });
  assert.equal(out, 'Hola Sofía, {{inventada}} y https://hola-mako.com/crm');
});

test('⚠️ NO reusa `aplicarVariables`, que es de la NUTRICIÓN', () => {
  // Aquélla acepta `{una llave}` y su regex no tiene dígitos, porque la comparte el
  // copy de Meta: ampliarla convertiría un `{1}` de una plantilla de nutrición en un
  // candidato, y esa misma función decide qué parámetros se registran en Meta.
  const src = sinComentarios(leer('../lib/variables-aviso.ts'));
  assert.ok(!/aplicarVariables/.test(src), 'volvió a colgarse de la regex de la nutrición');
  // Y la prueba de que son dos preguntas: una llave sola NO es un token de aviso.
  assert.equal(resolverVariables('{lead_nombre}', { lead_nombre: 'Sofía' }), '{lead_nombre}');
});

test('Todo lo del catálogo tiene un ejemplo con el que dibujar la previa', () => {
  const ej = valoresDeEjemplo();
  for (const v of VARIABLES_AVISO) {
    assert.ok(ej[v.key] && ej[v.key]!.trim(), `${v.key} no tiene ejemplo: la previa mostraría el token`);
  }
});

// ── el editor inserta TEXTO, no un chip ─────────────────────────────────────

test('⚠️ EL «{ }» INSERTA TEXTO PLANO: el `{{clave}}` donde está el cursor, en los tres editores', () => {
  // El token es TEXTO y no un chip (lib/variables-aviso.ts: un `<span>` lo borra cualquier
  // serializador). Desde la segunda pasada de la sexta tanda el «{ }» es UNO —el árbol de
  // app/_components/SelectorDatos.tsx— y cada editor escribe lo que el árbol le da: el composer
  // de WhatsApp (que también es el de los avisos al grupo) y los dos campos del email.
  //
  // PROBADO ROMPIÉNDOLO (09/10/2026, parte «datos»): el composer insertando `k` pelado en vez de
  // `{{k}}` → 1 fallo; el asunto del email con `MenuWA` de vuelta → 1 fallo. Restaurado → verde.
  const wa = sinComentarios(leer('../app/automations/EditorMensajeWhatsApp.tsx'));
  assert.match(wa, /<ArbolDeDatos grupos=\{grupos\} onElegir=\{\(k\) => \{ composer\.current\?\.insertar\(`\{\{\$\{k\}\}\}`, \{ enfocar: true \}\); setAbierto\(null\); \}\} \/>/,
    'el composer dejó de insertar el token como texto');
  const mail = sinComentarios(leer('../app/automations/EditorEmailGmail.tsx'));
  assert.match(mail, /<ArbolDeDatos grupos=\{datos\} onElegir=\{\(k\) => \{ insertarEnAsunto\(`\{\{\$\{k\}\}\}`\); setAbierto\(null\); \}\} \/>/, 'el asunto');
  assert.match(mail, /<ArbolDeDatos grupos=\{datos\} onElegir=\{\(k\) => \{ insertarEnCuerpo\(`\{\{\$\{k\}\}\}`\); setAbierto\(null\); \}\} \/>/, 'el cuerpo');
  assert.ok(!/chip/i.test(sinComentarios(leer('../app/_components/SelectorDatos.tsx'))), 'apareció un chip en el selector');
});

// ── dónde se resuelve ───────────────────────────────────────────────────────

test('⚠️ El camino SIN modelo resuelve las variables', () => {
  // Es el del cron por tiempo, y es el correcto para esto: un dato exacto que pasa por
  // un LLM deja de ser exacto, y un link mal copiado abre la ficha de OTRO lead sin
  // verse roto. Acá sustituye el código.
  assert.match(sinComentarios(leer('../lib/avisos-programados.ts')), /conVariables\(/, 'el drenador manda el token crudo');
});

test('⚠️ Y el camino CON modelo sustituye ANTES, en los TRES retornos', () => {
  // `generarMensajeAviso` tiene tres salidas y dos se saltean el modelo (la vacía y el
  // `catch`). Con la sustitución sólo en el camino feliz, la variable falla exactamente
  // cuando falla la IA — que es cuando menos se la mira.
  const src = sinComentarios(leer('../lib/plantillas.ts'));
  const cuerpo = src.slice(src.indexOf('export async function generarMensajeAviso'));
  assert.match(cuerpo, /const ref = ws == null \? refCruda : await conVariables\(refCruda/,
    'la sustitución dejó de cubrir los tres retornos');
  // Los tres retornos siguen saliendo de `ref`, que es el ya resuelto.
  assert.match(cuerpo, /out\.trim\(\) \|\| ref/);
  assert.match(cuerpo, /return ref;/);
});

// ── El catálogo extenso del CRM (04/10/2026) ────────────────────────────────
// Pedido textual: «Hay muy pocas acciones o datos que extraer dentro de MaKo… Faltan
// muchas cosas del CRM, que se debería poder extraer… Te invito a que hagas un listado
// extenso, y que sea fácil de llegar a eso, que esté categorizado, y que tenga una barra
// de busqueda el desplegable para acceder facil.»
//
// ⚠️ PROBADOS ROMPIENDO LAS PIEZAS, 04/10/2026. Las seis roturas se cazan, 1 fallo cada
// una: sacarle el resolvedor a una fila del catálogo —una fila que se ofrece y nadie
// resuelve, que es el modo de falla que esta tanda vino a cerrar— · meter `lead_nombre`
// en las claves que piden la ficha (una lectura por un dato que ya estaba en la mano) ·
// hacer que `necesitaFichaDelLead` conteste siempre que sí · poner una fila en un grupo
// que no existe · formatear la plata sin el `US$` · y tratar el 0 como un faltante.
//
// ⚠️ La última salió CIEGA en el primer intento (0 fallos) y está contada adentro de su
// test: el único 0 que miraba venía del saldo, que se calcula en su propia rama y no pasa
// por el camino de los montos.

test('⚠️ TODA fila del catálogo que pide la ficha del lead TIENE quien la resuelva', () => {
  // Es la regla de la casa aplicada a este catálogo: escribir la salida no es ofrecerla.
  // La tanda anterior midió que el resolvedor casi no se usaba y que 23 de 26 call sites
  // del emisor pasan el texto ya armado; lo que NO puede pasar es que el selector ofrezca
  // un dato que ninguna función sabe poner — eso sale al WhatsApp del cliente como
  // `{{lead_saldo}}` crudo, y la pantalla lo ofreció.
  const l = leadCompleto();
  const puestos = valoresDelLead(l);
  const faltan = [...CLAVES_DEL_LEAD].filter((k) => !(k in puestos));
  assert.deepEqual(faltan, [], `el selector ofrece datos que nadie resuelve: ${faltan.join(', ')}`);
});

test('⚠️ y la ficha se lee SÓLO si el texto la nombra', () => {
  // Es la regla de admisión nueva —una lectura por ENTIDAD que el texto nombra— y acá es
  // donde se mide. La vieja («cero queries») ya era falsa el día que se escribió: el
  // resolvedor hacía dos lecturas.
  assert.equal(necesitaFichaDelLead('Hola, ¿cómo va?'), false, 'sin tokens no hay lectura');
  assert.equal(necesitaFichaDelLead('Mirá {{link_crm}} y {{fecha}}'), false, 'los de siempre no piden la ficha');
  // Los dos que el EVENTO ya trae: pedir la fila por ellos sería una lectura por un dato
  // que estaba en la mano.
  assert.equal(necesitaFichaDelLead('Hola {{lead_nombre}}'), false);
  assert.equal(necesitaFichaDelLead('Abrí {{link_lead}}'), false);
  // Y cualquier dato del CRM sí.
  assert.equal(necesitaFichaDelLead('Debe {{lead_saldo}}'), true);
  assert.equal(necesitaFichaDelLead('Está {{lead_estado}} y agendó el {{lead_fecha_r1}}'), true);
  assert.ok(!CLAVES_DEL_LEAD.has('lead_nombre') && !CLAVES_DEL_LEAD.has('link_lead'));
});

test('El catálogo está bien formado: claves únicas, tokeneables y con grupo', () => {
  const grupos = new Set(GRUPOS_VARIABLES.map((g) => g.key));
  const vistas = new Set<string>();
  for (const v of VARIABLES_AVISO) {
    assert.ok(!vistas.has(v.key), `la clave ${v.key} está dos veces`);
    vistas.add(v.key);
    // Si la clave no matchea el molde del token, el botón inserta algo que el
    // sustituidor no va a encontrar nunca: sale crudo y nadie entiende por qué.
    assert.match(`{{${v.key}}}`, new RegExp(`^${RE_VARIABLE.source}$`, 'i'), `${v.key} no es un token válido`);
    assert.ok(grupos.has(v.grupo), `${v.key} está en un grupo que no existe: ${v.grupo}`);
    assert.ok(v.label.trim() && v.ejemplo.trim(), `${v.key} sin rótulo o sin ejemplo`);
  }
  assert.ok(VARIABLES_AVISO.length >= 35, `el catálogo tiene ${VARIABLES_AVISO.length} filas: se pidió uno EXTENSO`);
});

test('⚠️ sin lead, los datos del CRM NO SE MUESTRAN', () => {
  // ⚠️ ESTE TEST AFIRMÓ LO CONTRARIO DURANTE MEDIO DÍA, y el cambio es una decisión de
  // Martín con la pantalla delante: «si no está disponible porque elegí por tiempo y no
  // por acción, no lo muestres directamente, no que esté en gris, eso confunde»
  // (05/10/2026). Antes se ofrecían los 42 con 31 apagados y su motivo al lado.
  //
  // Lo que queda de la versión anterior, porque sigue siendo cierto: ofrecer un valor que
  // va a salir CRUDO al WhatsApp del cliente es prometer un dato que no existe. Lo que
  // cambió es qué se hace con el resto: antes se grisaba, ahora no se dibuja. Un
  // desplegable de 42 filas con 31 en gris esconde lo que sirve entre lo que no.
  const sinLead = variablesPara({ conLead: false });
  assert.deepEqual(sinLead.filter((v) => v.alcance !== 'siempre'), [],
    'sin lead ni cuota sólo se puede resolver lo de alcance `siempre`');

  const gs = variablesOfrecidas({ conLead: false });
  const filas = gs.flatMap((g) => g.items);
  assert.equal(filas.length, sinLead.length, 'el selector dibuja algo que no se puede resolver');
  assert.ok(filas.every((f) => f.alcance === 'siempre'), 'se coló un dato que este mensaje no resuelve');
  // (Sexta tanda: el Second Brain y la fecha no dependen de ningún lead.)
  assert.deepEqual(gs.map((g) => g.titulo), ['Second Brain', 'Fecha y hora', 'Links de MaKo']);

  // Con lead entran los del lead y NO los de la cuota; con los dos, todo lo que vale para el equipo.
  const conLead = variablesOfrecidas({ conLead: true }).flatMap((g) => g.items);
  assert.ok(conLead.some((f) => f.alcance === 'lead'), 'con lead tiene que haber datos del CRM');
  assert.ok(!conLead.some((f) => f.alcance === 'cuota'), 'ofreció datos de una cuota en un mensaje que no la tiene');
  // (11/10/2026: «Lo que arma MaKo» pide además el texto del código: `conMensaje`, sólo un evento de MaKo.)
  assert.equal(
    variablesOfrecidas({ conLead: true, conCuota: true, conMensaje: true }).flatMap((g) => g.items).length,
    VARIABLES_AVISO.filter((v) => !v.oculta && v.soloPara !== 'lead').length,
    'con lead, cuota y el texto del código se puede resolver TODO lo del equipo',
  );
  // Y los grupos vacíos no se dibujan: un título sin filas promete algo que no está.
  assert.ok(gs.every((g) => g.items.length > 0), 'quedó un grupo vacío en el desplegable');
  // Agrupar lo YA filtrado da el mismo orden: dos caminos, una regla.
  assert.deepEqual(
    agruparVariables(sinLead).map((g) => g.titulo),
    variablesPorGrupo({ conLead: false }).map((g) => g.titulo),
  );
});

test('⚠️ y el EDITOR no dibuja NADA apagado en ese selector', () => {
  // Un guard de cableado: el test de arriba prueba el catálogo, no la barra. Si la barra
  // volviera a pasar `disabled`, se vería el gris que Martín mandó sacar; si dejara de
  // preguntarle al catálogo, se vería de más.
  //
  // ⚠️ Segunda pasada de la sexta tanda: el selector ya no es el desplegable por secciones del
  // editor de /mensajes (que se fue) sino el ÁRBOL de la casa (app/_components/SelectorDatos.tsx).
  // Lo que se cuida es lo mismo: cada dato con su valor de ejemplo, ninguno apagado.
  //
  // PROBADO ROMPIÉNDOLO (09/10/2026, parte «datos»): el árbol sin el `ejemplo` en la hoja → 1
  // fallo; FlujoAviso sin `destino: 'equipo'` → 1 fallo; sin `conCuota` → 1 fallo. Restaurado → verde.
  const src = sinComentarios(leer('../app/_components/SelectorDatos.tsx'));
  const hoja = src.slice(src.indexOf('function Dato('), src.indexOf('export function ArbolDeDatos('));
  assert.ok(hoja.length > 0 && hoja.length < 1600, `el recorte de la hoja mide ${hoja.length}: mira otra cosa`);
  assert.ok(!/disabled/.test(hoja), 'el selector volvió a dibujar opciones apagadas');
  assert.match(hoja, /\{ejemplo\.split\('\\n'\)\[0\]\}/, 'el renglón dejó de mostrar el valor de ejemplo');
  // Y el que lo monta pregunta por las cosas que deciden qué se puede resolver: el lead, la cuota
  // y el DESTINO (el aviso va al grupo: el link al portal de un alumno no se ofrece ahí).
  const flujo = leer('../app/agencia/FlujoAviso.tsx');
  const i2 = flujo.indexOf('datos={variablesOfrecidas(');
  assert.ok(i2 > 0, 'el lienzo dejó de pasarle los datos al editor');
  const llamada = flujo.slice(i2, flujo.indexOf('})}', i2));
  assert.match(llamada, /destino: 'equipo'/, 'el aviso al grupo dejó de pedir los datos del EQUIPO');
  assert.match(llamada, /conLead:/, 'el selector dejó de preguntar por el lead');
  assert.match(llamada, /conCuota: aporta\.includes\('cuota'\)/, 'los datos de cobranza no se ofrecen en ningún mensaje');
  assert.match(llamada, /aporta\.includes\('lead'\)/, 'un cron que trae el lead volvería a esconder el CRM');
});

test('⚠️ el formato lo pone el RESOLVEDOR, y el 0 no es un faltante', () => {
  // Tres formas de escribir el mismo monto en tres canales es cómo se arma una
  // contradicción entre el WhatsApp y el correo. Y `0` es un hecho: «no debe nada».
  assert.equal(plata(1500), 'US$ 1.500');
  assert.equal(plata(0), 'US$ 0');
  assert.equal(fecha('2026-10-14'), '14/10');
  assert.equal(fecha('mañana'), 'mañana', 'lo que no es fecha se deja como vino');

  const l = leadCompleto({ monto_cierre_usd: 1500, total_cobrado_usd: 1500, asistio_j1: false });
  const v = valoresDelLead(l);
  assert.equal(v.lead_saldo, 'US$ 0', 'un saldo en cero tiene que SALIR: es el hecho de que ya pagó');
  assert.equal(v.lead_asistio_r1, 'no', 'un booleano en false no es un faltante');
  // ⚠️ Y UN 0 QUE VIENE DE LA COLUMNA, no del cálculo. La primera versión de este test
  // sólo miraba el saldo —que tiene su propia rama— así que un `if (v)` en el camino de
  // los montos daba CERO fallos: el caso que perseguía no pasaba por ahí. Medido.
  assert.equal(valoresDelLead(leadCompleto({ total_cobrado_usd: 0 })).lead_cobrado, 'US$ 0',
    '«todavía no pagó nada» es un hecho, y con `if (v)` desaparece');
  assert.equal(valoresDelLead(leadCompleto({ dia_de_pago: 0 })).lead_dia_de_pago, '0');

  // Lo que está en null NO entra, y entonces su token sale crudo. Es la decisión que ya
  // estaba escrita para los otros alcances: crudo se nota, vacío deja el mensaje cojo.
  const pelado = valoresDelLead(leadCompleto({ monto_cierre_usd: null, total_cobrado_usd: null, asistio_j1: null, empresa: null }));
  for (const k of ['lead_monto_cierre', 'lead_saldo', 'lead_asistio_r1', 'lead_empresa']) {
    assert.ok(!(k in pelado), `${k} entró al mapa con un null: el mensaje diría «undefined»`);
  }
  // Y el saldo NO se calcula sin monto de cierre: sería el negativo de lo pagado.
  assert.ok(!('lead_saldo' in valoresDelLead(leadCompleto({ monto_cierre_usd: null, total_cobrado_usd: 500 }))));
});

test('El estado se dice en palabras, no con el slug de la base', () => {
  assert.equal(valoresDelLead(leadCompleto({ estado_lead: 'no_responde' })).lead_estado, 'no responde');
  assert.equal(valoresDelLead(leadCompleto({ estado_lead: 'ganado' })).lead_estado, 'ganado');
});

/** Un lead con TODO puesto: es lo que hace medible «toda fila tiene quien la resuelva». */
function leadCompleto(over: Partial<Lead> = {}): Lead {
  return {
    id: 2498, nombre: 'Sofía Contreras', email: 'sofia@ejemplo.com', telefono: '+5215512345678',
    empresa: 'Inmobiliaria del Valle', web: 'inmobiliariadelvalle.com', created_at: '2026-10-02T15:00:00Z', updated_at: '2026-10-02T15:00:00Z',
    // Las columnas que el tipo no declara y `getLead` (select *) sí trae (mig 0204).
    junta_1_url: 'https://meet.google.com/abc-defg-hij', junta_2_url: 'https://meet.google.com/klm-nopq-rst',
    fecha_agenda: '2026-10-12', fecha_junta_1: '2026-10-14', fecha_junta_2: '2026-10-21',
    junta_1_at: null, junta_2_at: null,
    asistio_j1: true, asistio_j2: false, calificado: true, cerro: true,
    estado_lead: 'ganado', motivo_perdida: 'sin presupuesto',
    monto_cierre_usd: 1500, fecha_cierre: '2026-09-28', fecha_confirmacion: null,
    fecha_primer_pago: '2026-09-29', monto_primer_pago: 500, total_cobrado_usd: 500,
    fecha_inicio_servicio: null, cobro_inicial_usd: 500, monto_cuota_usd: 250,
    total_cuotas: 4, dia_de_pago: 10,
    venta_tipo: 'suscripcion', suscripcion_monto_usd: 500, suscripcion_meses: 6,
    adset_id_origen: null,
    utm_source: 'facebook', utm_medium: 'cpc', utm_campaign: 'oct-leads', utm_content: 'video-3',
    fbclid: null,
    respuesta_facturacion: 'US$ 10k - 30k', respuesta_colaboradores: '5 a 10',
    respuesta_objetivo: 'duplicar las ventas', respuesta_cuando_empezar: 'este mes',
    respuesta_inversion: 'US$ 1k - 3k', respuesta_decisor: 'sí',
    meta_lead_id: null, meta_ad_id: null, meta_ad_name: 'Video testimonio 3',
    meta_campaign_name: 'Inmobiliario · Octubre', meta_adset_name: 'Dueños 35-55',
    origen_lead: 'instant_form', telefono_normalizado: '5215512345678',
    visitor_id: null, nutricion_realizada: false,
    closer: 'Mauricio', setter: 'Leila',
    // Con la forma que manda Meta (medida el 07/10/2026): la pregunta como CLAVE y la
    // opción como clave. `{{lead_formulario}}` sale de acá.
    meta_field_data: [
      { name: 'full_name', values: ['Sofía Contreras'] },
      { name: '¿qué_tipo_de_propiedad_buscas_vender?', values: ['una_casa'] },
    ],
    ...over,
  } as Lead;
}

test('⚠️ NINGÚN ejemplo del catálogo nombra a una persona o un negocio REAL', () => {
  // ⚠️ ESTE GUARD EXISTE PORQUE LA REGLA SE ROMPIÓ EL MISMO DÍA QUE SE ESCRIBIÓ. El
  // 04/10/2026 se cosechó que «el ejemplo que una pantalla dibuja con datos de un cliente
  // REAL se lee como un dato» —el caso fue un aviso cuyo ejemplo salía del workspace de un
  // cliente, y alguien lo contó en una reunión como si fuera propio— y ese mismo día estas
  // 42 filas salieron con el closer «Mauricio», el setter «Leila» y el negocio «Código
  // Inmobiliario»: dos clientes y una clienta, dibujados como ejemplo en la pantalla que
  // abre cualquiera de los demás. Un comentario no alcanzó; esto sí.
  //
  // La lista son los nombres que ya están en el repo (bitácoras, hallazgos, catálogos), o
  // sea que el guard no agrega información que no esté — y caza LOS CONOCIDOS, que es lo
  // que se puede automatizar. La regla general, para los que no están acá, vive en
  // AGENTS.md: un ejemplo de UI es ficticio por regla, como cualquier placeholder.
  for (const v of VARIABLES_AVISO) {
    for (const r of REALES) {
      assert.ok(!sinAcentos(v.ejemplo).includes(sinAcentos(r)),
        `el ejemplo de ${v.key} nombra a ${r}, que es real: esa pantalla la abren los demás clientes`);
    }
  }
});


test('⚠️ NINGÚN ejemplo de un AVISO del catálogo nombra a una persona o un negocio REAL', () => {
  // El catálogo de variables tenía su guard y el de los avisos no, y era el más caro: el
  // `ejemplo` de un aviso no sólo se DIBUJA en la pantalla que abren todos — hasta el
  // 06/10/2026 un agendado por tiempo lo MANDABA tal cual. Así le llegó al grupo de Leila,
  // cuatro días, «En 30 min tienes la R2 con» un lead real de otro cliente. Y el barrido
  // encontró un segundo: «Mau <> Martín» en el de las reuniones de equipo.
  //
  // PROBADO ROMPIÉNDOLO: devolviendo «Francisco Ramos (Dental Ramos)» al ejemplo de
  // `reunion-recordatorio` → 1 fallo; devolviendo «Mau <> Martín» → 1 fallo.
  assert.ok(CATALOGO_AVISOS.length > 40, 'el catálogo vino vacío: el guard no miró nada');
  for (const c of CATALOGO_AVISOS) {
    for (const r of REALES) {
      assert.ok(!sinAcentos(c.ejemplo).includes(sinAcentos(r)),
        `el ejemplo del aviso ${c.id} nombra a ${r}, que es real: se dibuja en la pantalla de todos`);
    }
  }
});


// ── y los mismos nombres en los PLACEHOLDERS de los formularios ─────────────

test('⚠️ NINGÚN placeholder de un formulario nombra a una persona o un negocio REAL', () => {
  // El catálogo de variables no era el único lugar, y el que faltaba era peor. El mismo
  // 04/10/2026 el onboarding preguntaba «¿Cómo se llama tu oferta?» proponiendo «Negocio
  // que Escala™» — la oferta de Mauricio, la misma que aparece en sus campañas de Meta,
  // ofrecida de ejemplo a todos los demás clientes— y el remitente de mail proponía
  // «Mauricio <hola@tudominio.com>» tres veces. Un placeholder es copy: lo ve todo el que
  // abre esa pantalla, igual que un ejemplo.
  //
  // Se lee el FUENTE y no el módulo importado a propósito: `lib/metodo-catalogo.ts` pesa
  // 145 KB y lleva `server-only`.
  //
  // PROBADO ROMPIÉNDOLO: devolviendo el placeholder 'Negocio que Escala™' a
  // lib/onboarding.ts → 1 fallo. Devolviendo 'Mauricio <hola@tudominio.com>' a
  // lib/metodo-catalogo.ts → 1 fallo. Restaurados los dos → en verde.
  for (const a of ['../lib/onboarding.ts', '../lib/metodo-catalogo.ts']) {
    const src = sinComentarios(leer(a));
    // Sólo lo que se DIBUJA. El resto del archivo nombra clientes con todo derecho.
    const dibujado = [...src.matchAll(/(?:placeholder|nota):\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
    assert.ok(dibujado.length > 0, `no encontré un solo placeholder en ${a}: el regex quedó viejo`);
    for (const txt of dibujado) {
      for (const real of REALES) {
        assert.ok(!sinAcentos(txt).includes(sinAcentos(real)),
          `un placeholder de ${a} nombra a ${real}, que es real: esa pantalla la abren los demás — «${txt.slice(0, 70)}»`);
      }
    }
  }
});

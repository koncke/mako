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
  resolverVariables, valoresDeEjemplo,
} from '../lib/variables-aviso';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
/** ⚠️ Sin comentarios: un guard que busca el nombre de lo que NO tiene que estar se
 *  acusa a sí mismo por el párrafo que explica por qué no está. */
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

test('Y el EDITOR pinta con la misma regla', () => {
  // Es el otro renderer, y el que decide qué se GUARDA: si el editor parte el token, el
  // navegador reparenta las etiquetas cruzadas y el serializador devuelve un texto
  // distinto del que se escribió, sin que nada falle.
  assert.match(sinComentarios(leer('../app/agencia/EditorMensaje.tsx')), /tramosConVariables\(l\)/,
    'el editor pinta los tokens con las marcas encima');
});

// ── el catálogo ─────────────────────────────────────────────────────────────

test('Cada link del catálogo tiene su ruta, y cada ruta su link', () => {
  // Un link ofrecido sin ruta sale como `{{link_x}}` crudo al WhatsApp del cliente; una
  // ruta sin link es código que no ofrece nadie. Se cruzan en las dos direcciones.
  const delCatalogo = VARIABLES_AVISO.filter((v) => v.key.startsWith('link_') && v.key !== 'link_lead').map((v) => v.key).sort();
  assert.deepEqual(delCatalogo, Object.keys(RUTA_DE_LINK).sort());
  for (const r of Object.values(RUTA_DE_LINK)) assert.match(r, /^\/[a-z-]+$/, `ruta rara: ${r}`);
});

test('⚠️ Lo que necesita un LEAD no se ofrece en un mensaje que no habla de ninguno', () => {
  // El resolvedor deja intacto lo que no sabe —a propósito: crudo se nota, borrado no—
  // así que el filtro de la pantalla es lo ÚNICO que evita que un `{{lead_nombre}}`
  // llegue crudo al WhatsApp del cliente.
  const sinLead = variablesPara({ conLead: false }).map((v) => v.key);
  assert.ok(!sinLead.includes('lead_nombre'), 'ofreció un dato del lead sin lead');
  assert.ok(!sinLead.includes('link_lead'));
  assert.ok(sinLead.includes('link_crm'), 'los links no dependen de ningún lead');
  assert.ok(variablesPara({ conLead: true }).map((v) => v.key).includes('lead_nombre'));
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

test('⚠️ EL BOTÓN INSERTA TEXTO PLANO: un chip lo borra el serializador', () => {
  // `domAMarcas` —la mitad que decide qué se GUARDA— aplana todo lo que no sea b/i/s y
  // NO avisa: un `<span>` que dijera «Nombre del lead» se serializa como ese texto y la
  // variable desaparece entera, sin un error y sin que nada quede rojo.
  const src = sinComentarios(leer('../app/agencia/EditorMensaje.tsx'));
  assert.match(src, /insertarVariable/, 'se fue el camino que mete el dato');
  assert.match(src, /execCommand\('insertText', false, `\{\{\$\{key\}\}\}`\)/, 'el token dejó de insertarse como texto');
  // Y el serializador sigue conociendo sólo las tres etiquetas: si alguien le agrega el
  // span del chip, este assert es el que lo cuenta.
  assert.ok(!/chip/i.test(src), 'apareció un chip en el editor');
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

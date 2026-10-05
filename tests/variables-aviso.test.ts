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
  variablesOfrecidas, PORQUE_NO_SE_PUEDE,
} from '../lib/variables-aviso';
import { valoresDelLead, plata, fecha } from '../lib/variables-del-lead';
import type { Lead } from '../lib/leads';

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

test('⚠️ sin lead, los datos del CRM se OFRECEN APAGADOS, nunca resolubles', () => {
  // Las dos mitades de la misma decisión:
  //
  // · `variablesPara` (lo que se puede RESOLVER) no devuelve ni un dato del CRM sin
  //   lead. Ofrecer un valor que va a salir crudo al WhatsApp del cliente es lo que
  //   esta función impide, y sigue siendo la regla.
  // · `variablesOfrecidas` (lo que se DIBUJA) los trae igual, con `resoluble: false`.
  //   Medido en el navegador: filtrándolos, un mensaje con disparador por tiempo —que
  //   son casi todos— ofrecía NUEVE datos de 42, o sea que el catálogo extenso no
  //   existía para quien lo abría. Apagada y con su motivo, la fila es información.
  const sinLead = variablesPara({ conLead: false });
  assert.deepEqual(sinLead.filter((v) => v.alcance === 'lead'), []);

  const gs = variablesOfrecidas({ conLead: false });
  const filas = gs.flatMap((g) => g.items);
  assert.equal(filas.length, VARIABLES_AVISO.length, 'el selector dejó de ofrecer el catálogo entero');
  assert.deepEqual(gs.map((g) => g.titulo), GRUPOS_VARIABLES.map((g) => g.titulo), 'faltan grupos en el desplegable');
  // ⚠️ POR ALCANCE, no «todo lo que no es lead». Desde el 04/10/2026 hay un tercero
  // (`cuota`, los datos de cobranza que aporta su cron) y una condición escrita en
  // negativo lo habría declarado resoluble sin que nadie lo note: es la regla de la casa
  // sobre los guards en positivo, en un test.
  for (const f of filas) {
    assert.equal(f.resoluble, f.alcance === 'siempre', `${f.key} (alcance ${f.alcance}) dice que se puede resolver sin nada`);
  }
  // Con lead se puede todo lo del lead; lo de la CUOTA sigue apagado, porque no se
  // consigue cambiando el disparador — lo aporta el cron de cobranza y nada más. Por eso
  // su motivo es otro, y por eso `porqueNoSePuede` es una función y no una constante.
  const conLead = variablesOfrecidas({ conLead: true }).flatMap((g) => g.items);
  assert.ok(conLead.filter((f) => f.alcance === 'lead').every((f) => f.resoluble));
  assert.ok(conLead.filter((f) => f.alcance === 'cuota').every((f) => !f.resoluble));
  assert.ok(variablesOfrecidas({ conLead: true, conCuota: true }).flatMap((g) => g.items).every((f) => f.resoluble));
  assert.ok(PORQUE_NO_SE_PUEDE.includes('acción'), 'el motivo tiene que decir CÓMO se consigue');
  // Y los grupos vacíos no se dibujan: un título sin filas promete algo que no está.
  assert.ok(gs.every((g) => g.items.length > 0), 'quedó un grupo vacío en el desplegable');
  // Agrupar lo YA filtrado da el mismo orden: dos caminos, una regla.
  assert.deepEqual(
    agruparVariables(sinLead).map((g) => g.titulo),
    variablesPorGrupo({ conLead: false }).map((g) => g.titulo),
  );
});

test('⚠️ y el EDITOR apaga exactamente eso, con el motivo en el renglón', () => {
  // Un guard de cableado: el test de arriba prueba el catálogo, no la barra. Si la barra
  // se olvida el `disabled`, el token entra al texto y sale crudo al WhatsApp.
  const src = leer('../app/agencia/EditorMensaje.tsx');
  const i = src.indexOf('columns={[grupos.map(');
  const bloque = src.slice(i, src.indexOf('onChange=', i));
  assert.ok(i > 0 && bloque.length < 1400, `el recorte del selector mide ${bloque.length}: mira otra cosa`);
  assert.match(bloque, /disabled: !v\.resoluble/, 'el selector dejó de apagar lo que no se puede poner');
  assert.match(bloque, /v\.resoluble \? v\.ejemplo : porqueNoSePuede\(v\.alcance\)/, 'el renglón apagado no dice por qué, o dice el motivo de otro alcance');
  // Y el que lo monta pasa el catálogo ENTERO, no el filtrado.
  const flujo = leer('../app/agencia/FlujoAviso.tsx');
  // El `conLead` ya no es una sola condición (un cron puede traer el lead), así que la
  // llamada quedó multilínea: se busca la llamada y sus dos preguntas, no su formato.
  const i2 = flujo.indexOf('variables={variablesOfrecidas(');
  assert.ok(i2 > 0, 'volvió a pasar sólo lo resoluble, o se fue el selector');
  const llamada = flujo.slice(i2, flujo.indexOf('})}', i2));
  assert.match(llamada, /conLead:/, 'el selector dejó de preguntar por el lead');
  assert.match(llamada, /conCuota: aporta\.includes\('cuota'\)/, 'los datos de cobranza no se ofrecen en ningún mensaje');
  assert.match(llamada, /aporta\.includes\('lead'\)/, 'un cron que trae el lead volvería a mostrar el CRM apagado');
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
    empresa: 'Inmobiliaria del Valle',
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
    utm_source: 'facebook', utm_medium: 'cpc', utm_campaign: 'oct-leads', utm_content: null,
    fbclid: null,
    respuesta_facturacion: 'US$ 10k - 30k', respuesta_colaboradores: '5 a 10',
    respuesta_objetivo: 'duplicar las ventas', respuesta_cuando_empezar: 'este mes',
    respuesta_inversion: 'US$ 1k - 3k', respuesta_decisor: 'sí',
    meta_lead_id: null, meta_ad_id: null, meta_ad_name: 'Video testimonio 3',
    meta_campaign_name: 'Inmobiliario · Octubre', meta_adset_name: null,
    origen_lead: 'instant_form', telefono_normalizado: '5215512345678',
    visitor_id: null, nutricion_realizada: false,
    closer: 'Mauricio', setter: 'Leila',
    ...over,
  } as Lead;
}

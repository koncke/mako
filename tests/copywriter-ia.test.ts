// =============================================================================
// El Copywriter, tanda 2: MaKo escribiendo EN el guion — lo que se rompe sin un error
// =============================================================================
// Fija:
//   · los PROMPTS editables: cada clave de PROMPTS_COPY y PROMPTS_EDITAR está en lib/prompt-registry.ts con TODAS sus
//     ranuras (una ranura que el registro no declara se borra al editar el prompt desde /configuraciones-prompts, y el
//     modelo deja de recibir ese dato sin un error); y la salida de «Editar» lleva su {{formato}};
//   · las DOS validaciones de lo que vuelve: el server sanea contra el guion que mandó la pantalla y la pantalla vuelve a
//     sanear contra el de AHORA (la persona pudo escribir mientras MaKo pensaba);
//   · PROPONER, NO APLICAR: la pantalla pausa el guion ANTES de construir, construye fuera del historial, y aceptar es UN
//     paso de deshacer; al soltar la pausa, se guarda sólo si quedó distinto (descartar no escribe);
//   · la API: las 13 operaciones del Copywriter van al FINAL del área `contenido`, con sus palabras («documento»,
//     «copywriter») y sin las del Ads Writer («guion de anuncio»), y su runner pregunta la puerta en cada una. Con
//     «Copywriter = Notion» (29/10/2026): los templates y `editar_documento_copywriter` (MaKo escribe con IA por la API,
//     con las MISMAS herramientas del chat, aplicadas sobre lo de AHORA al confirmar).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROMPTS_COPY } from '../lib/copywriter/ia-reglas';
import { PROMPTS_EDITAR, FORMATO_EDITAR } from '../lib/copywriter/ia-editar';
import { PROMPTS_EXPERTO } from '../lib/copywriter/experto';
import { OPERACIONES_IA } from '../lib/copywriter/operaciones';
import { slotsDe } from '../lib/editor-landing/ia-reglas';
import { REGISTRO } from '../lib/api-mako/registro';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('los prompts del Copywriter están en el registro editable, cada uno con TODAS sus ranuras', () => {
  const reg = leer('lib/prompt-registry.ts');
  for (const p of [...Object.values(PROMPTS_COPY), ...Object.values(PROMPTS_EDITAR)]) {
    const i = reg.indexOf(`key: '${p.key}'`);
    assert.ok(i >= 0, `${p.key} no está en lib/prompt-registry.ts`);
    const bloque = reg.slice(i, reg.indexOf('context:', i));
    for (const s of slotsDe(p.tpl)) assert.ok(bloque.includes(`v('${s}'`), `${p.key}: la ranura {{${s}}} no está declarada en el registro`);
  }
});

test('el experto y «Adaptar»: keys NUEVAS en el registro (sin slots nuevos en las de antes), el método en los dos system', () => {
  const reg = leer('lib/prompt-registry.ts');
  for (const p of Object.values(PROMPTS_EXPERTO)) {
    const i = reg.indexOf(`key: '${p.key}'`);
    assert.ok(i >= 0, `${p.key} no está en lib/prompt-registry.ts`);
    const bloque = reg.slice(i, reg.indexOf('context:', i));
    const declarados = [...bloque.matchAll(/v\('([a-z_]+)'/g)].map((m) => m[1]).sort();
    assert.deepEqual(declarados, slotsDe(p.tpl).sort(), `${p.key}: el registro y el template no tienen las mismas ranuras`);
  }
  assert.deepEqual(slotsDe(PROMPTS_EXPERTO.experto.tpl), [], 'el método va entero: sin slots');
  // Un slot nuevo en un prompt que alguien ya editó no llegaría nunca (su override no lo tiene): los de antes, intactos.
  assert.deepEqual(slotsDe(PROMPTS_EDITAR.editarUser.tpl).sort(), ['adjuntos', 'angulo', 'biblioteca', 'charla', 'estructura', 'instruccion', 'metodologia', 'negocio', 'props', 'referencias', 'titulo', 'guion'].sort());
  const ia = sinComentarios(leer('lib/copywriter/ia.ts'));
  assert.equal((ia.match(/\$\{await metodo\(\)\}\\n\\n\$\{REGLA_NO_EXISTE\}/g) ?? []).length, 2, 'el método antes de la regla de lo que no existe, en Discutir y en Editar');
  assert.match(ia, /const pl = p\.adaptar \? plantillaPorId\(lite, g\.props\.plantilla\) : null;/);
  assert.match(ia, /guion: contenidoNoConfiable\(guionParaIA\(g\.doc\), 'guion'\),\n\s+estructura:/, 'el guion del ejemplo, como dato');
  assert.match(leer('app/api/copywriter/ia/route.ts'), /case 'adaptar': \{[\s\S]*?adaptar: b\.accion === 'adaptar'/);
  // El ejemplo nunca es un dato del negocio: el método y el pedido lo dicen.
  assert.match(PROMPTS_EXPERTO.experto.tpl, /Usar los datos del ejemplo de una plantilla/);
  assert.match(PROMPTS_EXPERTO.adaptarUser.tpl, /NINGUNO puede quedar en la versión nueva/);
});

test('la página nace con la ESTRUCTURA y el ejemplo se ve aparte («Ver ejemplo»): nunca entra solo', () => {
  // Martín (29/10/2026): «al crear un template ya te crea un guion de ejemplo; eso es confuso… Poné la estructura, la
  // misma, y en algún lado un botón de "ver ejemplo"».
  assert.match(leer('app/copywriter/Copywriter.tsx'), /pedirCrear\(\{ tipo, padre, titulo, props, contenido: plantilla\.esqueleto\(\) \}\)/);
  assert.match(leer('app/m/copywriter/ListaGuionesM.tsx'), /pedirCrear\(\{ tipo: pl\.tipo, props, contenido: pl\.esqueleto\(\) \}\)/);
  // La página recuerda de qué plantilla nació (sólo las que traen un ejemplo).
  assert.match(leer('app/copywriter/Copywriter.tsx'), /plantilla: plantilla\.ejemplo \? plantilla\.id : null, duracion: plantilla\.duracion/);
  assert.match(leer('app/m/copywriter/ListaGuionesM.tsx'), /plantilla: pl\.ejemplo \? pl\.id : null, duracion: pl\.duracion/);
  const editor = sinComentarios(leer('app/copywriter/editor/EditorGuion.tsx'));
  assert.match(editor, /onClick=\{\(\) => setVerEjemplo\(true\)\}>Ver ejemplo<\/button>/);
  assert.match(editor, /encabezado="Negocio ficticio"/, 'el ejemplo dice que el negocio es ficticio');
  assert.match(editor, /<CuerpoNotion inicial=\{ejemploDoc\} editable=\{false\}/, 'el ejemplo no se edita: se lee');
  // Al documento, sólo con «Usar como base», en UN paso de deshacer y con «Deshacer» en el aviso.
  assert.match(editor, /onClick=\{usarComoBase\}>Usar como base<\/Button>/);
  assert.match(editor, /if \(!doc\.poner\(plantilla\.contenido\(\), \{ historial: true \}\)\)/);
  assert.match(editor, /p\.avisar\('El ejemplo quedó como base', \(\) => \{ if \(doc\.poner\(antes, \{ historial: true \}\)\)/);
  assert.match(editor, /Todavía tiene \$\{queda\.bloques === 1/, 'copiar avisa lo que queda del ejemplo');
  // Adaptar lo ofrece MaKo en el chat, no la barra (Martín: «EN LUGAR de que esté en la top bar arriba»).
  assert.doesNotMatch(editor, /Adaptar con MaKo|onAdaptar|soloLaEstructura/);
  const panel = sinComentarios(leer('app/copywriter/PanelMaKo.tsx'));
  assert.match(panel, /accion: adaptar \? 'adaptar' : 'editar'/);
  assert.match(panel, /setAdaptando\(adaptar && !cambiaAlgo\)/, 'una pregunta de MaKo deja el panel adaptando');
  assert.match(panel, /return adaptando \? pedirEdicion\(t, archivos, citadas, true\)/);
  assert.match(panel, /void pedirEdicion\(instruccion, \[\], citadas, !!adaptar\)/, 'reintentar una adaptación vuelve a adaptar');
  // Como la página ya no trae el ejemplo, la IA lo recibe aparte, como forma y nunca como dato.
  assert.match(sinComentarios(leer('lib/copywriter/ia.ts')), /EL EJEMPLO COMPLETO \(de \$\{pl\.ejemplo\.negocio\}, un negocio FICTICIO: sólo la forma, ningún dato\):\\n\$\{textoDelDoc\(pl\.contenido\(\)\)\}/);
});

test('«Editar» le pasa al modelo las herramientas (el {{formato}}) y el catálogo entero está en el formato', () => {
  assert.ok(slotsDe(PROMPTS_EDITAR.editarSystem.tpl).includes('formato'));
  for (const op of OPERACIONES_IA) assert.ok(FORMATO_EDITAR.includes(op), `el formato no nombra ${op}`);
  const ia = leer('lib/copywriter/ia.ts');
  assert.match(ia, /formato: FORMATO_EDITAR/);
  assert.match(ia, /REGLA_NO_EXISTE/);
  // Cada respuesta (la primera y la de la segunda pasada) se sanea con `medir`, contra el guion que mandó la pantalla.
  assert.match(ia, /const s = sanearOperaciones\(x\.operaciones, g\.doc, catalogo\)/, 'el server sanea contra el guion que mandó la pantalla');
  assert.match(ia, /marcasDeVoseo\(escrito\)/, 'la segunda capa de la voz del negocio');
});

test('la pantalla vuelve a sanear contra lo de AHORA, pausa antes de construir y acepta en un paso', () => {
  const panel = leer('app/copywriter/PanelMaKo.tsx');
  const iAhora = panel.indexOf('const antes = ed.leer();');
  const iSanear = panel.indexOf('sanearOperaciones(r.operaciones, antes,');
  const iPausa = panel.indexOf('onPausa(true);');
  const iConstruir = panel.indexOf('await construir(ed, cuadrosDeConstruccion(antes, s.ops)');
  assert.ok(iAhora > 0 && iSanear > iAhora, 'se sanea contra el documento de AHORA');
  assert.ok(iPausa > 0 && iConstruir > iPausa, 'la pausa va ANTES de construir (si no, el autoguardado escribe la propuesta)');
  assert.match(panel, /aceptarEnDoc\(ed, m\.propuesta\.antes, m\.propuesta\.final\)/);
  assert.match(panel, /!appEscritorio\.bloqueada/);
  // Desde el 29/10/2026 el cuerpo es BlockNote (CuerpoNotion): lo que pone MaKo va fuera del historial y no se manda a
  // guardar como un cambio de la persona (`poniendo`); la propuesta habla con el documento vivo (DocVivo).
  const cuerpo = leer('app/copywriter/editor/CuerpoNotion.tsx');
  assert.match(cuerpo, /if \(!op\.historial\) tr\.setMeta\('addToHistory', false\);/, 'construir va fuera del historial');
  assert.match(cuerpo, /const alCambiar = useCallback\(\(\) => \{\n\s+if \(poniendo\.current\) return;/, 'lo que pone MaKo no se marca para guardar');
  const prop = leer('app/copywriter/editor/propuesta.ts');
  assert.match(prop, /return ponerDoc\(doc, antes\) && ponerDoc\(doc, final, \{ historial: true \}\);/, 'aceptar: la foto de antes y el resultado en UN paso');
  assert.ok(!/@tiptap/.test(prop), 'la propuesta no conoce al editor');
  const editor = leer('app/copywriter/editor/EditorGuion.tsx');
  assert.match(editor, /if \(foto != null && JSON\.stringify\(ahora\) !== foto\) \{ marcar\(/, 'al soltar la pausa se guarda sólo si cambió');
  assert.match(editor, /const alCambiar = useCallback\(\(d: JsonNodo\) => \{\n\s+if \(pausaRef\.current\) return;/, 'en pausa no se marca para guardar');
});

test('la API: las del Copywriter al FINAL de `contenido`, con sus palabras, y la puerta en cada runner', () => {
  // 8 de la tanda 2, 3 de «Compartir para editar» (tanda 4: enlaces, compartir y revocar_enlace_copywriter) y 2 de
  // «Copywriter = Notion» (29/10/2026: listar_plantillas y editar_documento_copywriter).
  const contenido = REGISTRO.filter((d) => d.area === 'contenido').map((d) => d.id);
  const copy = contenido.filter((id) => id.endsWith('_copywriter'));
  // 15 desde el 11/11/2026: los outliers de copy (outliers_copywriter y replicar_outlier_copywriter, D18). 16 desde el 14/11/2026:
  // replicar lo que trae la persona (replicar_link_o_texto_copywriter, lib/copywriter/pegado.ts).
  assert.equal(copy.length, 16);
  assert.deepEqual(contenido.slice(-16), copy, 'van al final del área');
  for (const d of REGISTRO.filter((x) => x.id.endsWith('_copywriter'))) {
    assert.ok(!/guion de anuncio/i.test(`${d.titulo} ${d.descripcion}`), `${d.id} usa las palabras del Ads Writer`);
    assert.equal(d.gating?.tab, 'copywriter');
  }
  const run = leer('lib/api-mako/areas/copywriter.run.ts');
  const runners = [...run.matchAll(/^ {2}([a-z_]+_copywriter): \{/gm)].map((m) => m[1]);
  assert.equal(runners.length, 16);
  // Cada runner pregunta la puerta: 5 lecturas (leer) y 11 acciones (preparar).
  assert.equal((run.match(/if \(await cerrada\(ctx\)\) return/g) ?? []).length, 16);
  // MaKo por la API escribe con las MISMAS herramientas del chat y, al confirmar, sobre lo de AHORA (por id).
  assert.match(run, /const ia = await editarConIA\(\{ instruccion, guion:/);
  assert.match(run, /const s = sanearOperaciones\(payload\.operaciones, r\.doc\.contenido, catalogo\);/);
  assert.match(run, /await guardar\(\{ id, version: r\.doc\.version, contenido: res\.doc/);
});

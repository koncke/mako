// =============================================================================
// Los bloques de General, rediseñados (14/10/2026, la segunda vuelta)
// =============================================================================
// Martín, con dos capturas de General editándose: «Pon muchos menos gráficos disponibles en General, justamente para eso
// ya tenemos una tab de dashboard», «Diseña nuevamente todos los "Bloque general", la mayoría son solamente texto... Si no
// hay datos aún, se debería ver el placeholder siempre», «Todos los desplegables de edición de un bloque y en general la
// edición del bloque hazlo mejor», «Debería poder editar el tamaño de un bloque desde cualquiera de sus costados... Y
// elimina la flecha que aparece detrás del contorno azul... Esto también para dashboard», «Tenemos un diseño de tarjetas
// para las tareas y proyectos del plan e hiciste cualquier cosa», «Hay bloques que en la configuración se deben definir
// allí mismo ciertas cosas... Como el objetivo del trimestre, que me gustaría que se llamen (OKRs)», «El desplegable de
// "Bloques de General" que no tenga titulos internos y que sean una preview», «limitar los gráficos que se traen» y
// «Elimina lo de insertar codigo, conclusiones de mako y acción».
//
// Lo que fija, y por qué cada cosa es invisible sin el test:
//   · LAS OPCIONES DE UN BLOQUE se sanean contra lo que el bloque declara: un valor inventado o una opción de OTRO bloque
//     no se guarda (se dibujaría el default sin decir nada), y el default no se escribe (un informe lleno de defaults
//     deja de seguir al catálogo cuando cambie).
//   · GENERAL OFRECE POCO del editor del Dashboard, y sus plantillas no usan nada de afuera: una plantilla con un gráfico
//     que la galería de General no ofrece sería un gráfico que nadie puede volver a elegir.
//   · CADA BLOQUE SE DIBUJA, TIENE VISTA PREVIA Y, SI ESTÁ VACÍO, PLACEHOLDER: un bloque nuevo del catálogo sin su caso en
//     `dibujarBloque` dice «No pude armar» sin un error.
//   · LAS TARJETAS DEL PLAN SON LAS DEL PLAN (importadas de BoardShell, no copiadas), y la vista Prioridades del Plan
//     dibuja la MISMA que General.
//   · LO QUE DEPENDE DE LA HORA se dibuja después de montar (la hidratación).
//   · EL EDITOR (los dos informes): los ocho tiradores y sin la flecha de react-grid-layout.
// Correr: npx tsx --test tests/general-bloques.test.ts
//
// PROBADO ROMPIÉNDOLO (14/10/2026; base en verde: 9 pasan, 0 fallan). Una rotura por vez, restaurando de memoria;
// pasan / fallan:
//   · `sanearOpciones` sin el chequeo del valor (guarda «7» en «cuantas»)                      -> 8 / 1 «las opciones…»
//   · un def que no está entre sus valores (`def: '4'` en «Tareas» de Prioridades)              -> 7 / 2 «las opciones…» y «cada opción…»
//   · `lugaresInsertar` sin el filtro de General                                                -> 8 / 1 «General ofrece…»
//   · la plantilla «Foco» con un gráfico `dispersion`                                            -> 8 / 1 «las plantillas…»
//   · `dibujarBloque` sin el caso 'proyectos'                                                    -> 8 / 1 «cada bloque…»
//   · la vista Prioridades del Plan con su tarjeta en línea otra vez (sin `<TarjetaPrioridad`)   -> 8 / 1 «las tarjetas…»
//   · el `Placeholder` dibujando la muestra antes de montar                                      -> 8 / 1 «lo que depende…»
//   · los tiradores de vuelta en `['se', 'e', 's']`                                               -> 8 / 1 «el editor…»
//   · el menú «Bloques de General» con sus títulos de grupo otra vez (`lk-lista-grupo`)           -> 8 / 1 «el menú…»

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FUENTES, TIPOS, sanearElemento } from '../lib/graficos-catalogo';
import {
  ELEMENTOS_FUERA_DE_GENERAL, FUENTES_GENERAL, PIEZAS_GENERAL, TIPOS_GENERAL, opcionDe, opcionesDePieza, sanearOpciones,
} from '../lib/general-piezas';
import { DEFINICIONES_GENERAL } from '../lib/general-plantillas';
import { BARRA_INSERTAR, lugaresInsertar } from '../app/dashboard/Galeria';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('las opciones de un bloque: sólo las que declara, con un valor que existe, y nunca el default', () => {
  assert.deepEqual(sanearOpciones('prioridades', { cuantas: '5', objetivo: 'no' }), { cuantas: '5', objetivo: 'no' });
  assert.equal(sanearOpciones('prioridades', { cuantas: '7' }), undefined, 'un valor que no existe');
  assert.equal(sanearOpciones('prioridades', { cuantas: '3' }), undefined, 'el default no se escribe');
  assert.equal(sanearOpciones('prioridades', { dias: '7' }), undefined, 'la opción de otro bloque');
  assert.equal(sanearOpciones('pendientes', { cuantas: '5' }), undefined, 'un bloque sin opciones');
  assert.equal(sanearOpciones('prioridades', 'cuantas=5'), undefined);
  assert.equal(opcionDe('llamadas', undefined, 'dias'), '7');
  assert.equal(opcionDe('llamadas', { dias: '14' }, 'dias'), '14');
  assert.equal(opcionDe('llamadas', { dias: '99' }, 'dias'), '7', 'un valor viejo que ya no existe vuelve al default');
  // Y el elemento guardado las conserva (y tira las que no son de su bloque).
  const e = sanearElemento({ id: 'b', tipo: 'general', general: { pieza: 'llamadas', opciones: { dias: '14', limite: '5', estilo: 'x' } } });
  assert.deepEqual(e?.general, { pieza: 'llamadas', opciones: { dias: '14' } });
});

test('cada opción de cada bloque: su default entre sus valores, valores únicos, y a la vista (2 a 4)', () => {
  let n = 0;
  for (const p of PIEZAS_GENERAL) {
    for (const o of opcionesDePieza(p.id)) {
      const ids = o.valores.map((v) => v.id);
      assert.ok(ids.includes(o.def), `${p.id}.${o.id}: el default «${o.def}» no es uno de sus valores`);
      assert.equal(new Set(ids).size, ids.length, `${p.id}.${o.id}: valores repetidos`);
      assert.ok(ids.length >= 2 && ids.length <= 4, `${p.id}.${o.id}: ${ids.length} valores no entran en botones a la vista`);
      n++;
    }
  }
  assert.ok(n >= 15, `revisé ${n} opciones: el recorrido no está mirando`);
  // El nombre que pidió Martín.
  assert.equal(PIEZAS_GENERAL.find((p) => p.id === 'objetivos')?.nombre, 'OKRs');
});

test('General ofrece poco del editor: menos gráficos, menos datos, y sin código, MaKo ni Acción', () => {
  for (const t of TIPOS_GENERAL) assert.ok(TIPOS.some((x) => x.id === t), `el tipo «${t}» no existe`);
  for (const f of FUENTES_GENERAL) assert.ok(FUENTES.some((x) => x.id === f), `el conjunto «${f}» no existe`);
  assert.ok(TIPOS_GENERAL.length <= TIPOS.length / 4, 'ya no son «muchos menos» gráficos');
  assert.ok(FUENTES_GENERAL.length <= FUENTES.length / 2, 'ya no son los más importantes');
  const tipos = (ls: ReturnType<typeof lugaresInsertar>) => ls.flatMap((l) => (l.clase === 'suelto' ? [l.tipo] : l.opciones.map((o) => o.tipo)));
  const enGeneral = tipos(lugaresInsertar(false, true));
  for (const t of ELEMENTOS_FUERA_DE_GENERAL) assert.ok(!enGeneral.includes(t), `General ofrece «${t}»`);
  assert.ok(enGeneral.includes('texto') && enGeneral.includes('seccion'), 'el filtro se llevó lo que sí va');
  assert.deepEqual(tipos(lugaresInsertar(false)), tipos(BARRA_INSERTAR.filter((l) => l.clase !== 'suelto' || !l.soloPopup)), 'el Dashboard perdió algo');
  // La galería, «Añadir datos» y el panel de un gráfico, acotados en General.
  const editor = leer('app/dashboard/EditorInforme.tsx');
  assert.match(editor, /tipos=\{esGeneral \? TIPOS_GENERAL : undefined\}/);
  assert.match(editor, /soloFuentes=\{esGeneral \? FUENTES_GENERAL : undefined\}/);
  assert.match(editor, /lugaresInsertar\(!!dueno, esGeneral\)/);
  assert.match(editor, /enGeneral=\{esGeneral\}/);
  assert.match(leer('app/dashboard/Propiedades.tsx'), /opciones=\{fuentesOfrecidas\.map\(/);
});

test('las plantillas de General usan sólo lo que General ofrece', () => {
  let graficos = 0;
  for (const d of DEFINICIONES_GENERAL) {
    for (const p of d.piezas) {
      const g = p as { tipo?: string; fuente?: string };
      if (!g.tipo || !g.fuente) continue;
      assert.ok((TIPOS_GENERAL as readonly string[]).includes(g.tipo), `${d.id}/${p.local}: el gráfico «${g.tipo}» no está en la galería de General`);
      assert.ok((FUENTES_GENERAL as readonly string[]).includes(g.fuente), `${d.id}/${p.local}: el conjunto «${g.fuente}» no está en «Añadir datos» de General`);
      graficos++;
    }
  }
  assert.ok(graficos >= 20, `revisé ${graficos} gráficos: el recorrido no está mirando`);
});

test('cada bloque se dibuja, tiene vista previa, y vacío muestra su placeholder', () => {
  const prov = leer('app/general/ProveedorGeneral.tsx');
  const dibujar = prov.slice(prov.indexOf('export function dibujarBloque'), prov.indexOf('export function muestraDeBloque'));
  const muestra = prov.slice(prov.indexOf('export function muestraDeBloque'), prov.indexOf('export function configurarBloque'));
  assert.ok(dibujar.length > 200 && muestra.length > 200, 'no encontré las dos funciones');
  for (const p of PIEZAS_GENERAL) {
    assert.match(dibujar, new RegExp(`case '${p.id}': return <Bloque`), `«${p.id}» no se dibuja`);
    assert.match(muestra, new RegExp(`case '${p.id}': return <`), `«${p.id}» no tiene vista previa`);
  }
  // Los bloques que pueden estar vacíos dibujan el placeholder (el bloque con datos de ejemplo y la acción encima).
  const bloques = ['Norte', 'Plan', 'Agenda', 'Negocio'].map((f) => leer(`app/general/bloques/${f}.tsx`)).join('\n');
  assert.ok((bloques.match(/<Placeholder\b/g) ?? []).length >= 9, 'menos placeholders que bloques que pueden estar vacíos');
  // Los OKRs se crean y se editan ahí mismo: desde el bloque y desde su panel.
  assert.match(leer('app/general/bloques/Norte.tsx'), /accion=\{<NuevoOkr anio=\{anio\} quarter=\{quarter\} \/>\}/);
  assert.match(prov, /if \(\(pieza !== 'objetivos' && pieza !== 'cabecera'\) \|\| !d\.okrs\.ok\) return null;/);
  // El panel: los desplegables de la casa, nada nativo, y cada opción a la vista.
  const elemento = leer('app/dashboard/Elemento.tsx');
  const panel = elemento.slice(elemento.indexOf('function PropsGeneral('), elemento.indexOf('function AyudaVariables('));
  assert.ok(panel.length > 500, 'no encontré el panel');
  assert.doesNotMatch(panel, /<select\b/, 'volvió un <select> nativo');
  assert.equal((panel.match(/<Dropdown\b/g) ?? []).length, 2, 'Bloque y Funnel con el desplegable de la casa');
  assert.match(panel, /\{opciones\.map\(\(o\) => \(\s*<Seccion key=\{o\.id\} titulo=\{o\.nombre\}>\s*<Opciones /);
  assert.match(panel, /const extra = general\?\.configurar\(e\) \?\? null;/);
});

test('las tarjetas del Plan son LAS del Plan: General las importa y la vista Prioridades dibuja la misma', () => {
  const plan = leer('app/general/bloques/Plan.tsx');
  assert.match(plan, /dynamic\(\(\) => import\('@\/app\/plan\/board\/BoardShell'\)\.then\(\(m\) => m\.ProyectoCardTile\)\)/);
  assert.match(plan, /dynamic\(\(\) => import\('@\/app\/plan\/board\/BoardShell'\)\.then\(\(m\) => m\.TarjetaPrioridad\)\)/);
  assert.match(plan, /await marcarHechaAction\(t\.id, true\)/, '«Completar» no es la escritura del Plan');
  const shell = leer('app/plan/board/BoardShell.tsx');
  assert.match(shell, /export function TarjetaPrioridad\(/);
  const prioridades = shell.slice(shell.indexOf('function Prioridades('), shell.indexOf('function ObjetivoCard('));
  assert.match(prioridades, /<TarjetaPrioridad key=\{t\.id\} t=\{t\} puesto=\{i \+ 1\}/, 'la vista Prioridades volvió a su propia tarjeta');
  assert.doesNotMatch(prioridades, /WebkitLineClamp/, 'una segunda copia del dibujo de la tarjeta');
  // Al navegador viajan las tareas sin su detalle ni su historial.
  assert.match(leer('app/general/datos.ts'), /const liviana = \(t: BoardTask\): BoardTask => \(\{ \.\.\.t, detalle: '', notas: undefined, checklist: \[\], historial: \[\] \}\);/);
});

test('lo que depende de la hora se dibuja después de montar (el bloque se dibuja también en el server)', () => {
  const comun = leer('app/general/bloques/comun.tsx');
  assert.match(comun, /<div className="gb-ph-fondo" aria-hidden>\{montado \? muestra : null\}<\/div>/);
  assert.match(comun, /const \[ahora, setAhora\] = useState<string \| null>\(null\);/);
  const agenda = leer('app/general/bloques/Agenda.tsx');
  assert.doesNotMatch(agenda, /new Date\(\)\.toISOString\(\)/, 'una hora leída al dibujar');
  assert.doesNotMatch(agenda, /Date\.now\(\)/, 'una hora leída al dibujar');
});

test('el editor (Dashboard y General): se agranda desde los ocho lados, y sin la flecha de react-grid-layout', async () => {
  const editor = leer('app/dashboard/EditorInforme.tsx');
  assert.match(editor, /const TIRADORES = \['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'\] as const;/);
  assert.match(editor, /resizeConfig=\{\{ enabled: editando && !conectando, handles: TIRADORES \}\}/);
  const { CSS } = await import('../app/dashboard/editor-css');
  assert.match(CSS, /\.lk \.react-grid-item > \.react-resizable-handle::after \{ content: none; \}/, 'volvió la flecha');
  assert.match(CSS, /\.lk \.react-grid-item > \.react-resizable-handle \{ opacity: 1; background: none; transform: none;/, 'los tiradores heredan el giro de la flecha');
  // Los lados son franjas a lo largo del borde, no el cuadradito de 20 px del medio.
  assert.match(CSS, /\.lk \.react-grid-item > \.react-resizable-handle-n, \.lk \.react-grid-item > \.react-resizable-handle-s \{ left: 14px; right: 14px; width: auto; height: 8px; \}/);
  assert.match(CSS, /\.lk \.react-grid-item > \.react-resizable-handle-e, \.lk \.react-grid-item > \.react-resizable-handle-w \{ top: 14px; bottom: 14px; width: 8px; height: auto; \}/);
});

test('el menú «Bloques de General»: sin títulos de grupo, una vista previa por bloque, tres por fila', async () => {
  const editor = leer('app/dashboard/EditorInforme.tsx');
  const menu = editor.slice(editor.indexOf("{menu?.tipo === 'piezas' && ("), editor.indexOf("{menu?.tipo === 'estilo' && ("));
  assert.ok(menu.length > 200 && menu.length < 1500, `el recorte mide ${menu.length}`);
  assert.doesNotMatch(menu, /lk-lista-grupo/, 'volvieron los títulos internos');
  assert.match(menu, /<Flotante ancla=\{menu\.ancla\} onCerrar=\{\(\) => setMenu\(null\)\} ancho=\{812\}>/);
  assert.match(menu, /\{general\?\.muestra\(x\.id\)\}/, 'sin vista previa');
  const { CSS } = await import('../app/dashboard/editor-css');
  assert.match(CSS, /\.lk-bloques \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
});

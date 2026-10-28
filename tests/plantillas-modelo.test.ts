// =============================================================================
// Las plantillas por modelo de negocio: la base de una cuenta en un clic (MAU-01, 27/10/2026)
// =============================================================================
// Mauricio: «una base tipo copy paste que disminuya mi intervención de iniciar de cero», para sus tres modelos de
// cliente (tienda B2C, B2B con CRM, manufactura). Lo que fija:
//   1. las tres plantillas: etapas con las claves CANÓNICAS del CRM, KPIs de fuentes que existen, la guía con la meta y el
//      compromiso primero, y ningún número inventado;
//   2. aplicarla dos veces no duplica (los nombres se comparan sin tildes ni mayúsculas);
//   3. el servidor lee todo ANTES de escribir, crea el proyecto del Plan antes que sus tareas y sin IA, y el funnel
//      nace principal sólo si no hay otro;
//   4. la puerta: la agencia sobre SU cartera (o el super admin), por la pantalla y por la API;
//   5. la Inmobiliaria (MK-15, Joan): sin reuniones, y la hoja del Dashboard con SUS números, sólo los que MaKo guarda,
//      primera en el informe de cada persona del equipo, sin duplicarla ni revivir la que alguien archivó.
//
// Probado rompiéndolo (con todo puesto: 0 fallos). Cada rotura, sola:
//   · una etapa de manufactura con una clave inventada                                      → 1 fallo (1)
//   · la meta del objetivo sale con un número (`metaValor: 100`)                             → 1 fallo (3)
//   · `queFalta` compara los nombres crudos                                                   → 1 fallo (2)
//   · se escribe aunque no se pudieron leer los funnels                                       → 1 fallo (3)
//   · las tareas de la guía van sin el proyecto creado antes                                  → 1 fallo (3)
//   · la guía se carga con IA (sin `sinIA: true`)                                            → 1 fallo (3)
//   · el funnel nace principal siempre                                                        → 1 fallo (3)
//   · `aplicarPlantillaACliente` sin preguntar la cartera                                    → 1 fallo (4)
//   · la API propone sobre un cliente sin preguntar si es Agency                              → 1 fallo (4)
//   · la ficha ofrece la plantilla a una cuenta que no está habilitada                        → 1 fallo (4)
//   · la Tasación de la inmobiliaria vuelve a ser una reunión (`kind: 'reunion'`)               → 1 fallo (1)
//   · la hoja inmobiliaria trae el embudo del VSL (`vistas_vsl`)                                → 1 fallo (5)
//   · `conHojaDeModelo` revive una hoja archivada                                             → 1 fallo (5)
//   · `conHojaDeModelo` la pone al final en vez de primera                                     → 1 fallo (5)
//   · la hoja se guarda sin la versión leída (pisa a quien está editando)                      → 1 fallo (5)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_STAGES } from '../lib/pipeline';
import { FUENTES_KPI } from '../lib/objectives-modelo';
import { DEFS } from '../lib/api-mako/areas/cs.def';
import { MAX_HOJAS, fuenteDe, type Hoja, type Tablero } from '../lib/graficos-catalogo';
import { instanciarPlantilla, tableroInicial } from '../lib/graficos-plantillas';
import {
  HOJA_INMOBILIARIA, MODELOS_CLIENTE, PLANTILLAS_MODELO, conHojaDeModelo, esModeloCliente, nombreComparable, queFalta, resumenDePlantilla,
} from '../lib/plantillas-modelo-reglas';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));

test('las tres plantillas: claves canónicas, KPIs que existen, la guía con la meta primero y ningún número inventado', () => {
  assert.deepEqual([...MODELOS_CLIENTE], ['tienda-b2c', 'b2b-crm', 'manufactura', 'inmobiliaria']);
  const canonicas = new Set([...DEFAULT_STAGES.map((s) => s.key), 'conversando']);
  const fuentes = new Set(FUENTES_KPI.map((f) => f.id));
  for (const id of MODELOS_CLIENTE) {
    const p = PLANTILLAS_MODELO[id];
    assert.equal(p.id, id);
    const etapas = p.funnel.pipeline;
    for (const e of etapas) {
      // Una etapa propia (la clave `stN` del editor del CRM) sólo si se llega a mano: `paso` y marcada «no es reunión».
      const propia = /^st\d+$/.test(e.key) && e.kind === 'paso' && e.marcadaComo === 'etapa';
      assert.ok(canonicas.has(e.key) || propia, `${id}: «${e.label}» con la clave ${e.key}, que el CRM no conoce`);
    }
    assert.equal(new Set(etapas.map((e) => e.key)).size, etapas.length, `${id}: dos etapas con la misma clave`);
    assert.equal(etapas[0].kind, 'entrada', `${id}: la primera etapa es la entrada`);
    assert.equal(etapas[etapas.length - 1].kind, 'cierre', `${id}: la última es el cierre`);
    assert.equal(p.kpis.length, 4);
    for (const k of p.kpis) if (k.fuente === 'auto') assert.ok(fuentes.has(k.fuenteId), `${id}: la fuente ${k.fuenteId} no existe`);
    const titulos = p.guia.map((g) => g.titulo);
    assert.ok(titulos.includes('Poner la meta del trimestre') && titulos.includes('Ponerle el compromiso semanal a cada KPI'), `${id}: sin la meta el tablero no mide`);
    assert.equal(p.guia.filter((g) => g.recurrente).length, 1, `${id}: la revisión semanal es UNA recurrente`);
    assert.equal(new Set(titulos.map(nombreComparable)).size, titulos.length, `${id}: un paso repetido`);
  }
  // Joan: «me pone lo de R1 Y R2. En el caso de los inmobiliarios esa lógica no se utiliza».
  assert.ok(PLANTILLAS_MODELO.inmobiliaria.funnel.pipeline.every((e) => e.kind !== 'reunion'), 'la inmobiliaria cierra en persona: sin R1 ni R2');
  assert.deepEqual(PLANTILLAS_MODELO.inmobiliaria.funnel.pipeline.map((e) => e.label), ['Formulario', 'Calificado', 'Tasación / pre listing', 'Captación']);
  assert.equal(esModeloCliente('manufactura'), true);
  assert.equal(esModeloCliente('retail'), false);
});

test('aplicarla dos veces no duplica: se compara sin tildes ni mayúsculas', () => {
  const p = PLANTILLAS_MODELO['b2b-crm'];
  const todo = queFalta(p, { funnels: [], objetivos: [], kpis: [], tareas: [] });
  assert.deepEqual([todo.funnel, todo.objetivo, todo.kpis.length, todo.guia.length], [true, true, 4, p.guia.length]);
  const grita = (s: string) => s.toUpperCase().replace(/o/gi, 'Ó');
  const nada = queFalta(p, {
    funnels: [grita(p.funnel.nombre)], objetivos: [`  ${p.objetivo.titulo.toLowerCase()} `],
    kpis: p.kpis.map((k) => grita(k.nombre)), tareas: p.guia.map((g) => grita(g.titulo)),
  });
  assert.deepEqual([nada.funnel, nada.objetivo, nada.kpis.length, nada.guia.length], [false, false, 0, 0]);
  const media = queFalta(p, { funnels: [p.funnel.nombre], objetivos: [], kpis: [p.kpis[0].nombre], tareas: [] });
  assert.deepEqual([media.funnel, media.objetivo, media.kpis.map((k) => k.nombre)], [false, true, p.kpis.slice(1).map((k) => k.nombre)]);
  assert.equal(resumenDePlantilla(p, { funnel: false, objetivo: false, kpis: 0, pasos: 0, hojas: 0 }), 'La plantilla B2B con CRM ya estaba aplicada: no faltaba nada.');
  assert.equal(resumenDePlantilla(p, { funnel: true, objetivo: true, kpis: 4, pasos: 6, hojas: 0 }),
    'Listo: el funnel «Ventas a empresas» con 5 etapas, el objetivo del trimestre y 4 KPIs y 6 pasos de la guía en su Plan («Arranque · B2B»).');
});

test('el servidor: lee todo antes de escribir, el proyecto antes que sus tareas y sin IA, y sin números inventados', () => {
  const srv = leer('lib/plantillas-modelo.ts');
  const lee = srv.indexOf('if (!funnels) return { ok: false');
  assert.ok(lee > 0 && lee < srv.indexOf('await crearFunnel('), 'sin poder leer los funnels no se escribe nada');
  assert.match(srv, /const \[funnels, q, kpis, board\] = await Promise\.all\(\[leerFunnels\(\), quarterActual\(\), listKpis\(false\), listPlanBoard\(\)\]\);/);
  const proyecto = srv.indexOf('await crearPlanProyecto(');
  assert.ok(proyecto > 0 && proyecto < srv.indexOf('await agregarTareasPlanOwner('), 'sin el proyecto, la guía cae en «Sin proyecto»');
  assert.match(srv, /\{ sinIA: true \},/);
  assert.match(srv, /esDefault: !hay\.funnels\.some\(\(f\) => f\.esDefault\)/);
  assert.match(srv, /metaValor: 0, unidad: p\.objetivo\.unidad/);
  assert.match(srv, /cadencia: 'semanal', compromiso: 0,/);
});

test('la puerta: la agencia sobre SU cartera (o el super admin), por la pantalla y por la API', () => {
  const srv = leer('lib/plantillas-modelo.ts');
  const a = srv.slice(srv.indexOf('export async function aplicarPlantillaACliente('));
  const cartera = a.indexOf('if (!(await puedeEntrarAhora(quien.agenciaWs, clienteWs))) return');
  assert.ok(a.indexOf('if (!quien.superAdmin) {') < cartera && cartera < a.indexOf('runWithWorkspace(clienteWs'), 'la cartera, antes de escribir en la cuenta del cliente');
  assert.match(a, /if \(!\(await esAgencia\(quien\.agenciaWs\)\)\) return/);
  const accion = leer('app/agency/actions.ts');
  const ap = accion.slice(accion.indexOf('export async function aplicarPlantillaAction('));
  assert.match(ap, /if \(!esModeloCliente\(modelo\)\) return/);
  assert.match(ap, /const superAdmin = \(await getSesionAdmin\(\)\) != null;\s*const agenciaWs = superAdmin \? null : await adminDeWorkspaceActual\(\);/);
  // La API: lo mismo, por el chat (la «conexión a IA» que propuso Martín).
  const d = DEFS.find((x) => x.id === 'aplicar_plantilla_de_modelo');
  assert.ok(d && d.tipo === 'accion' && d.area === 'cs', 'falta la operación');
  assert.equal(d.gating?.rolMinimo, 'admin');
  assert.ok(!d.canales.includes('http' as never), 'cuentas de terceros: sin HTTP');
  assert.deepEqual(d.parametros.find((x) => x.nombre === 'modelo')?.enum, [...MODELOS_CLIENTE]);
  const run = leer('lib/api-mako/areas/cs.run.ts');
  const r = run.slice(run.indexOf('  aplicar_plantilla_de_modelo: {'), run.indexOf('  ver_avance_curso_cs: {'));
  assert.match(r, /if \(clienteWs != null\) \{\s*if \(!\(await esAgencia\(ctx\.ws\)\)\) return \{ error:[^\n]*\n\s*if \(!\(await puedeEntrarAhora\(ctx\.ws, clienteWs\)\)\) return/);
  assert.match(r, /aplicarPlantillaACliente\(\{ agenciaWs: ctx\.ws, superAdmin: false \}, clienteWs, modelo, 'ia'\)/);
  // La ficha: sólo con la cuenta habilitada y para quien la administra, en la computadora y en el teléfono.
  assert.match(leer('app/agency/AgencyApp.tsx'), /\{abierta\.estado === 'aprobado' && \(puedeAbrir \|\| superAdmin\) && \(\s*<>\s*<h3 className="ad-sub">Plantilla del negocio<\/h3>/);
  assert.match(leer('app/m/agency/AgencyM.tsx'), /\{c\.estado === 'aprobado' && \(puedeAbrir \|\| superAdmin\) && \(\s*<FilaDatoM k="Plantilla"/);
});

test('la Inmobiliaria: su hoja con sus números (sólo los que MaKo guarda), primera y sin duplicar ni revivir', () => {
  const hoja = instanciarPlantilla(HOJA_INMOBILIARIA);
  assert.equal(PLANTILLAS_MODELO.inmobiliaria.hoja, HOJA_INMOBILIARIA);
  assert.equal(hoja.componentes.length, 7, 'el saneo de la hoja tiró un componente: una fuente o una métrica que no existe');
  for (const c of hoja.componentes as Array<{ fuente?: string; metricas?: string[]; dimension?: string; titulo?: string }>) {
    const f = fuenteDe(c.fuente ?? '');
    assert.ok(f, `«${c.titulo}»: la fuente ${c.fuente} no existe`);
    for (const m of c.metricas ?? []) assert.ok(f.metricas.some((x) => x.id === m), `«${c.titulo}»: ${c.fuente} no tiene ${m}`);
  }
  const titulos = (hoja.componentes as Array<{ titulo?: string }>).map((c) => c.titulo);
  assert.deepEqual(titulos.slice(0, 4), ['Inversión', 'Impresiones', 'Clics', 'Formularios'], 'el orden de Joan, con lo que existe');
  assert.ok(!titulos.some((t) => /alcance|visualizaciones/i.test(t ?? '')), 'un número que MaKo no guarda no se rotula como si lo tuviera');
  assert.doesNotMatch(JSON.stringify(hoja), /vistas_vsl|vistas_landing/, 'el embudo del VSL es justo el que no les sirve');

  // En el informe de una persona: primera; si ya la tiene o la archivó, no se toca; lleno, tampoco.
  const inicial = tableroInicial();
  const r = conHojaDeModelo(inicial, hoja);
  assert.ok('tablero' in r && r.tablero.hojas[0].plantilla === 'inmobiliaria' && r.tablero.hojas.length === inicial.hojas.length + 1, 'primera, y las otras siguen');
  if ('tablero' in r) assert.deepEqual(conHojaDeModelo(r.tablero, instanciarPlantilla(HOJA_INMOBILIARIA)), { motivo: 'ya-estaba' });
  const archivada: Tablero = { ...inicial, archivadas: [hoja] };
  assert.deepEqual(conHojaDeModelo(archivada, instanciarPlantilla(HOJA_INMOBILIARIA)), { motivo: 'ya-estaba' }, 'la archivó: fue su decisión');
  const vacio: Tablero = { ...inicial, enBlanco: true };
  const rv = conHojaDeModelo(vacio, hoja);
  assert.ok('tablero' in rv && rv.tablero.hojas.length === 1 && !rv.tablero.enBlanco, 'un informe vacío queda con ésta sola');
  const lleno: Tablero = { ...inicial, hojas: Array.from({ length: MAX_HOJAS }, (_, i) => ({ ...inicial.hojas[0], id: `h${i}` }) as Hoja) };
  assert.deepEqual(conHojaDeModelo(lleno, hoja), { motivo: 'lleno' });

  // El servidor: el equipo de la cuenta, con la versión leída (no pisa a quien está editando).
  const srv = leer('lib/plantillas-modelo.ts');
  assert.match(srv, /equipo = \(await equipoDe\(ws\)\)/);
  assert.match(srv, /const leido = await leerTableroVersionado\(String\(u\.id\)\);[\s\S]*?await guardarTableroSi\(String\(u\.id\), r\.tablero, leido\.version\);/);
});

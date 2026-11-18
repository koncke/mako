// =============================================================================
// Una hoja del Dashboard como PLANTILLA (lib/creaciones-dashboard.ts, 18/11/2026)
// =============================================================================
// Leila (30/10/2026): plantillas propias en todas las tabs; Martín (13/10/2026): «los dashboards… que los usuarios hagan sus
// creaciones y otros usuarios puedan puntuarles». El enchufe `dashboard` (lib/creaciones-enchufes.ts) guarda UNA hoja del
// informe; acá se prueba lo que se decide sin la base, EJECUTANDO las funciones:
//   · privada, la hoja viaja tal cual y vuelve igual;
//   · compartida, sin los filtros sobre personas ni los que nombran cosas del negocio, sin las direcciones de imágenes, videos
//     y enlaces de afuera, sin un experimento ya arrancado, y con los textos limpios (`definicionParaTodos`);
//   · al usarla, entra con ids nuevos y al final del informe (o como la única, si estaba en blanco), con el tope de hojas.
//
// Probado rompiéndolo (base: 9 verdes, 0 rojos; 18/11/2026):
//   · `dashboardParaPublico` devolviendo `def` tal cual                       → 8/1 (el closer y la foto siguen; «todo
//     junto» pasa igual porque la limpieza de textos cambia el link por [DATO: link], que es justo la red de atrás);
//   · sin la línea de `experimento.id` en `elementoParaPublico`               → 8/1;
//   · `informeConHoja` sin el corte de `MAX_HOJAS`                            → 8/1;
//   · `informeConHoja` conservando `enBlanco` (con `{ ...t }`)                → 8/1;
//   · `hojaParaUsar` devolviendo la hoja sin `hojaConIdsNuevos`               → 8/1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_HOJAS, hojaVacia, nuevoGrafico, sanearHoja, type Componente, type ControlVista, type Elemento, type Grafico, type Hoja, type Tablero } from '../lib/graficos-catalogo';
import {
  LLENO_DE_HOJAS, dashboardParaPublico, definicionDeHoja, hojaParaUsar, hojasPublicables, informeConHoja,
  leerDefinicionDashboard, resumenDashboard,
} from '../lib/creaciones-dashboard';
import { definicionParaTodos, type NegocioQueComparte } from '../lib/plantillas-propias-reglas';
import { PLANTILLAS_OFRECIDAS, instanciarPlantilla } from '../lib/graficos-plantillas';

// Datos INVENTADOS (AGENTS.md: nada de clientes reales en tests/).
const NEGOCIO: NegocioQueComparte = { nombres: ['Estudio Brújula Norte'], personas: ['Renata Villaseñor'] };
const FOTO = 'https://xyz.supabase.co/storage/v1/object/public/graficos/ws77/renata.webp';

const control = (o: Partial<ControlVista> & Pick<ControlVista, 'id' | 'tipo'>): Record<string, unknown> =>
  ({ campo: null, preset: 'ult30', desde: null, hasta: null, valores: null, texto: '', agrupar: 'auto', ...o });
const elemento = (o: Partial<Elemento> & Pick<Elemento, 'id' | 'tipo'>): Record<string, unknown> =>
  ({ clase: 'elemento', texto: '', x: 0, y: 6, w: 4, h: 2, ...o });

function hojaDePrueba(): Hoja {
  const g1 = { ...nuevoGrafico('tabla', [], 'leads'), id: 'g-leads', x: 0, y: 0 } as Grafico;
  const pop = { ...nuevoGrafico('tabla', [], 'leads'), id: 'g-pop', x: 0, y: 0 } as Grafico;
  const raw = {
    id: 'hoja-origen', nombre: 'Ventas de Estudio Brújula Norte', emoji: '📈',
    controles: [
      control({ id: 'c-closer', tipo: 'lista', campo: 'closer', valores: ['Renata Villaseñor'] }),
      control({ id: 'c-campana', tipo: 'lista', campo: 'campana', valores: ['Campaña Octubre'] }),
      control({ id: 'c-periodo', tipo: 'periodo', preset: 'ult7' }),
    ],
    componentes: [
      { ...g1, alClic: 'popup', popup: { titulo: 'Detalle', componentes: [
        { ...pop, controles: [control({ id: 'c-pop-closer', tipo: 'lista', campo: 'closer', valores: ['Renata Villaseñor'] })] },
        elemento({ id: 'e-pop-foto', tipo: 'imagen', url: FOTO, texto: 'La foto' }),
      ] } },
      elemento({ id: 'e-texto', tipo: 'texto', texto: 'Lo de Estudio Brújula Norte, con Renata Villaseñor' }),
      elemento({ id: 'e-foto', tipo: 'imagen', url: FOTO, texto: 'El equipo' }),
      elemento({ id: 'e-afuera', tipo: 'enlace', url: 'https://agenda.brujulanorte.mx', texto: 'Agenda' }),
      elemento({ id: 'e-crm', tipo: 'enlace', url: '/crm', texto: 'El CRM' }),
      elemento({ id: 'e-ia', tipo: 'ia', texto: 'Conclusiones',
        ia: { pedido: 'Qué cambió', fuentes: ['g-leads'], vista: 'resumen', largo: 'corto', formato: 'parrafo', lee: 'hoja', cron: null } }),
      elemento({ id: 'e-exp', tipo: 'experimento', texto: 'La prueba', experimento: { id: 4521, propuesta: null } }),
    ],
  };
  const h = sanearHoja(raw, 0);
  assert.ok(h, 'el fixture no sanea');
  return h;
}

const porId = (cs: readonly Componente[], id: string) => cs.find((c) => c.id === id);
function controles(h: Hoja): Map<string, ControlVista> {
  const out = new Map<string, ControlVista>();
  const en = (cs: readonly Componente[]) => {
    for (const c of cs) {
      if (c.clase !== 'grafico') continue;
      for (const k of c.controles) out.set(k.id, k);
      if (c.popup) en(c.popup.componentes);
    }
  };
  for (const k of h.controles) out.set(k.id, k);
  en(h.componentes);
  return out;
}

test('el fixture llega entero al saneo (si no, los demás tests prueban otra cosa)', () => {
  const h = hojaDePrueba();
  assert.deepEqual(controles(h).get('c-closer')?.valores, ['Renata Villaseñor']);
  assert.deepEqual(controles(h).get('c-pop-closer')?.valores, ['Renata Villaseñor']);
  assert.equal((porId(h.componentes, 'e-foto') as Elemento).url, FOTO);
  assert.equal((porId(h.componentes, 'e-exp') as Elemento).experimento?.id, 4521);
  const g = porId(h.componentes, 'g-leads') as Grafico;
  assert.equal((porId(g.popup?.componentes ?? [], 'e-pop-foto') as Elemento).url, FOTO);
});

test('privada: la hoja viaja tal cual y se lee igual', () => {
  const h = hojaDePrueba();
  const d = leerDefinicionDashboard(JSON.parse(JSON.stringify(definicionDeHoja(h))));
  assert.ok(d);
  assert.deepEqual(d.hoja, h);
  assert.equal(leerDefinicionDashboard({ hoja: { nombre: 'x', componentes: [] } }), null, 'una hoja vacía no es una plantilla');
  assert.equal(leerDefinicionDashboard('una hoja'), null);
});

test('compartida: sin filtros sobre personas ni sobre cosas del negocio, sin las direcciones y sin el experimento arrancado', () => {
  const pub = leerDefinicionDashboard(dashboardParaPublico(definicionDeHoja(hojaDePrueba())));
  assert.ok(pub, 'la compartida tiene que seguir siendo una hoja');
  const c = controles(pub.hoja);
  assert.equal(c.get('c-closer')?.valores, null, 'el filtro del closer nombra a una persona');
  assert.equal(c.get('c-pop-closer')?.valores, null, 'el del pop-up también');
  assert.equal(c.get('c-campana')?.valores, null, 'una campaña es del negocio');
  assert.equal(c.get('c-periodo')?.preset, 'ult7', 'el período no nombra nada: se queda');
  assert.equal((porId(pub.hoja.componentes, 'e-foto') as Elemento).url, '', 'la foto es un link al storage del negocio');
  assert.equal((porId(pub.hoja.componentes, 'e-afuera') as Elemento).url, '', 'el enlace a su sitio');
  assert.equal((porId(pub.hoja.componentes, 'e-crm') as Elemento).url, '/crm', 'un enlace a una pantalla de MaKo no es de nadie');
  assert.equal(porId(pub.hoja.componentes, 'e-exp'), undefined, 'un experimento arrancado es una fila del negocio');
  const g = porId(pub.hoja.componentes, 'g-leads') as Grafico;
  assert.equal((porId(g.popup?.componentes ?? [], 'e-pop-foto') as Elemento).url, '', 'la foto del pop-up');
});

test('todo junto (lo que hace el server): la compartida no trae el negocio ni su gente, y sigue siendo la hoja', () => {
  const r = definicionParaTodos(definicionDeHoja(hojaDePrueba()), NEGOCIO, dashboardParaPublico);
  assert.ok(r.ok, 'no se pudo compartir');
  const txt = JSON.stringify(r.definicion);
  assert.doesNotMatch(txt, /Brújula|Renata|supabase\.co|brujulanorte/);
  const d = leerDefinicionDashboard(r.definicion);
  assert.ok(d);
  assert.equal(d.hoja.componentes.filter((x) => x.clase === 'grafico').length, 1);
  assert.match((porId(d.hoja.componentes, 'e-texto') as Elemento).texto, /\[DATO: tu negocio\]/);
});

test('las plantillas de MaKo del Dashboard se pueden compartir y vuelven con todos sus gráficos', () => {
  assert.ok(PLANTILLAS_OFRECIDAS.length > 0);
  for (const p of PLANTILLAS_OFRECIDAS) {
    const h = instanciarPlantilla(p);
    const r = definicionParaTodos(definicionDeHoja(h), NEGOCIO, dashboardParaPublico);
    assert.ok(r.ok, `${p.id}: no se pudo compartir`);
    const d = leerDefinicionDashboard(r.definicion);
    assert.ok(d, `${p.id}: la compartida no se lee`);
    assert.equal(d.hoja.componentes.length, h.componentes.length, `${p.id}: perdió componentes`);
  }
});

test('usarla: entra con todos los ids nuevos, y lo que apunta a un id lo sigue', () => {
  const h = hojaDePrueba();
  const u = hojaParaUsar(definicionDeHoja(h));
  assert.ok(u);
  assert.notEqual(u.id, h.id);
  const viejos = new Set(h.componentes.map((c) => c.id));
  for (const c of u.componentes) assert.ok(!viejos.has(c.id), `«${c.id}» quedó con el id de la plantilla`);
  const ia = u.componentes.find((c) => c.clase === 'elemento' && c.tipo === 'ia') as Elemento;
  const g = u.componentes.find((c) => c.clase === 'grafico');
  assert.deepEqual(ia.ia?.fuentes, [g?.id], 'la caja de MaKo tiene que leer el gráfico NUEVO');
  assert.equal(hojaParaUsar({ v: 1 }), null);
});

test('al informe: al final, o como la única si estaba en blanco; con el tope de hojas', () => {
  const a = { ...hojaVacia('Uno'), componentes: hojaDePrueba().componentes };
  const t: Tablero = { v: 3, nombre: 'Dashboard', hojas: [a] };
  const nueva = hojaParaUsar(definicionDeHoja(hojaDePrueba()))!;
  const r = informeConHoja(t, nueva);
  assert.ok(!('error' in r));
  assert.deepEqual(r.tablero.hojas.map((x) => x.id), [a.id, nueva.id]);
  const blanco: Tablero = { v: 3, nombre: 'Dashboard', hojas: [hojaVacia('Página 1')], enBlanco: true, archivadas: [a] };
  const rb = informeConHoja(blanco, nueva);
  assert.ok(!('error' in rb));
  assert.deepEqual(rb.tablero.hojas.map((x) => x.id), [nueva.id], 'en blanco, la de la plantilla es la ÚNICA');
  assert.equal(rb.tablero.enBlanco, undefined, 'el informe deja de estar en blanco');
  assert.deepEqual(rb.tablero.archivadas?.map((x) => x.id), [a.id], 'lo archivado no se toca');
  const lleno: Tablero = { v: 3, nombre: 'Dashboard', hojas: Array.from({ length: MAX_HOJAS }, (_, i) => hojaVacia(`H${i}`)) };
  assert.deepEqual(informeConHoja(lleno, nueva), { error: LLENO_DE_HOJAS });
});

test('lo que se puede guardar: las hojas con algo, y nada si el informe está en blanco', () => {
  const llena = hojaDePrueba();
  const vacia = hojaVacia('Vacía');
  assert.deepEqual(hojasPublicables({ hojas: [llena, vacia] }).map((h) => h.id), [llena.id]);
  assert.deepEqual(hojasPublicables({ hojas: [llena], enBlanco: true }), []);
});

test('el resumen de la galería: el nombre y cuántos gráficos y filtros', () => {
  const r = resumenDashboard(definicionDeHoja(hojaDePrueba()));
  assert.deepEqual(r, { nombre: '📈 Ventas de Estudio Brújula Norte', detalle: '1 gráfico · 3 filtros' });
  assert.equal(resumenDashboard(null), null);
});

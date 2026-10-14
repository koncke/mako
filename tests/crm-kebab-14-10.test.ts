// =============================================================================
// El «⋯» del CRM (14/10/2026): sin subtítulos, y sin Avisos, Resumen ni «CRM automático»
// =============================================================================
// Pedido de Martín, textual (app/admin/dev/crm/bitacora.ts, el último hito «prompt»):
// «ya eliminarías en los 3 puntos los botones de "avisos y resumen". También elimina todos
// los subtitulos de los botones de los 3 puntos. Y elimina el botón de "CRM Automático",
// para eso ya llevamos todo a Automations».
//
// Lo que queda en el menú: Importar leads · Exportar leads · Editar las etapas. Lo que se
// fue sólo se fue del MENÚ: los dos modales siguen abriéndose desde el engranaje de la ficha
// y el motor del CRM automático sigue corriendo. Eso también se fija acá, porque «sacar el
// botón» y «apagar la función» se confunden fácil.
//
// Verificado rompiéndolo el 14/10/2026, una rotura por vez con un arnés que restaura de
// memoria (base: 3 pass / 0 fail; restaurado: 3 / 0):
//   · `desc="Baja los leads a planilla o documento"` de vuelta en «Exportar leads» → 2 / 1
//   · `MenuItem` vuelve a aceptar `desc?: string` y a dibujar su span               → 2 / 1
//   · el renglón «Qué muestra el Resumen» con su `<ResumenModal>` de vuelta          → 1 / 2
//     (cae también el conteo de renglones: el menú pasa a tener cuatro)
//   · `const crmAuto = useCrmAuto();` de vuelta en AccionesHeader                    → 2 / 1
//   · el title viejo del «⋯» («Importar, exportar y editar el funnel»)              → 2 / 1
//   · InfoPrincipalCard sin su `<ResumenModal>` (el Resumen se queda sin puerta)     → 2 / 1
//   · `activar_crm_automatico` renombrado en crm.def.ts (el flag sin manija)        → 2 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const TOOLBAR = sinComentarios(leer('app/crm/CrmToolbar.tsx'));

/** El clúster de la derecha de la barra: «+ Nuevo lead» y el «⋯» con su menú. */
function acciones(): string {
  const ini = TOOLBAR.indexOf('export function AccionesHeader');
  const fin = TOOLBAR.indexOf('export function VistaSelector');
  assert.ok(ini > 0 && fin > ini, 'no se encontró AccionesHeader (o cambió de lugar respecto de VistaSelector)');
  return TOOLBAR.slice(ini, fin);
}

test('ningún renglón del «⋯» lleva subtítulo, y el renglón ni siquiera lo acepta', () => {
  const acc = acciones();
  // Los tres que quedan, para que el resto del test no pase en vacío sobre un menú que se fue.
  for (const label of ['Importar leads', 'Exportar leads', 'Editar las etapas']) {
    assert.ok(acc.includes(`label="${label}"`), `falta el renglón «${label}» en el «⋯»`);
  }
  const renglones = (acc.match(/<MenuItem\b/g) ?? []).length;
  assert.equal(renglones, 3, `el «⋯» tiene ${renglones} renglones; quedan tres`);
  // ⚠️ SE BUSCA EN TODO EL CLÚSTER, NO RENGLÓN POR RENGLÓN. Cortar cada `<MenuItem … />` con
  // una regex no sirve: el ícono va adentro como JSX (`icon={<UploadIcon size={15} />}`) y el
  // primer `/>` que aparece es el del ícono, así que el `desc=` que viene después quedaba
  // afuera del recorte. En AccionesHeader no hay ningún otro `desc=` legítimo.
  assert.doesNotMatch(acc, /\bdesc=/, 'volvió el subtítulo a un renglón del «⋯»');

  // ⚠️ Y EL COMPONENTE NO TIENE DÓNDE PONERLO. Si `MenuItem` vuelve a aceptar un `desc`, el
  // próximo renglón nace con uno: es lo que pasó con los cinco que había.
  const ini = TOOLBAR.indexOf('function MenuItem(');
  assert.ok(ini > 0, 'no se encontró el renglón del menú');
  const def = TOOLBAR.slice(ini, TOOLBAR.indexOf('\n}\n', ini));
  assert.doesNotMatch(def, /\bdesc\b/, 'MenuItem volvió a aceptar (o a dibujar) un subtítulo');
});

test('no vuelven al «⋯» «Avisos de datos sin marcar», «Qué muestra el Resumen» ni «CRM automático»', () => {
  const acc = acciones();
  // Por el RÓTULO y por lo que ABREN: un rótulo nuevo para la misma puerta es la misma puerta.
  for (const [que, re] of [
    ['el renglón de avisos', /Avisos de datos sin marcar|<AvisosDatosModal\b|setAvisos\(/],
    ['el renglón del Resumen', /Qué muestra el Resumen|<ResumenModal\b|setResumenAbierto\(/],
    ['el interruptor del CRM automático', /CRM automático|useCrmAuto\(|<MenuSwitch\b|<Switch\b/],
  ] as const) {
    assert.doesNotMatch(acc, re, `volvió ${que} al «⋯»`);
  }
  // Y en el resto del archivo tampoco: el interruptor se dibujaba en un componente aparte
  // (`MenuSwitch`) y el estado venía de un hook importado; volver por ahí también es volver.
  assert.doesNotMatch(TOOLBAR, /from '\.\/CrmAutoToggle'|function MenuSwitch\b|\/api\/crm-auto/,
    'volvió el interruptor del CRM automático a la barra del CRM');
  assert.doesNotMatch(TOOLBAR, /from '\.\/lead-view\/(AvisosDatosModal|ResumenModal)'/,
    'la barra del CRM volvió a abrir los modales de la ficha');
  // El `title` del «⋯» describe lo que queda, no lo que había.
  assert.match(acc, /title="Importar, exportar y editar las etapas"/, 'el title del «⋯» no describe lo que hay adentro');
});

test('se fue la PERILLA, no la función: los modales tienen otra puerta y el motor su manija', () => {
  // Los dos modales siguen abriéndose desde la ficha hasta que llegue el constructor por
  // bloques. Se barre el repo (y no tres archivos fijos) para que mover la puerta de lugar no
  // rompa el test: lo que no puede pasar es que no quede NINGUNA.
  const archivos = execFileSync('git', ['ls-files', 'app', 'components'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/).map((f) => f.trim()).filter((f) => /\.tsx$/.test(f));
  assert.ok(archivos.length > 100, `git ls-files devolvió ${archivos.length} archivos: esto no corrió en el repo`);
  const puertas = (modal: string) => archivos.filter((f) =>
    !f.endsWith(`/${modal}.tsx`) && existsSync(resolve(RAIZ, f)) && new RegExp(`<${modal}\\b`).test(sinComentarios(leer(f))));
  assert.ok(puertas('AvisosDatosModal').length > 0, '«Avisos de datos sin marcar» se quedó sin ninguna puerta');
  assert.ok(puertas('ResumenModal').length > 0, '«Qué muestra el Resumen» se quedó sin ninguna puerta');

  // El motor NO se apaga con el botón: lo pidió el chat de Automations hasta que sus
  // plantillas lo reemplacen. El flag sigue a mano por la API de MaKo.
  for (const f of ['lib/crm-auto.ts', 'app/api/crm-auto/route.ts']) {
    assert.ok(existsSync(resolve(RAIZ, f)), `se fue ${f}: el botón se sacó, el motor no`);
  }
  assert.match(sinComentarios(leer('lib/api-mako/areas/crm.def.ts')), /id: 'activar_crm_automatico'/,
    'sin el botón y sin `activar_crm_automatico`, el CRM automático no se puede prender ni apagar');
});

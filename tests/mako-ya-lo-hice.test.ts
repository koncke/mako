// =============================================================================
// «Ya lo hice» por WhatsApp: MaKo ofrece cerrar la tarea del Plan, no anotar una nueva (17/10/2026)
// =============================================================================
// docs/hallazgos-plan.md → «Marcar hecha una tarea cuando algo YA ESTÁ», Sin hacer: «Que MaKo en WhatsApp ofrezca
// `cerrar_tareas_plan` cuando la persona dice "ya lo hice". Hoy lo elige por la descripción, sin un test que lo mida».
// Medido antes de tocar: «ya lo hice», «ya terminé la landing de octubre» y «ya está hecha la #412» eran `capturar`
// (dudosa) y llegaban SIN una herramienta: material para anotar una tarea nueva, lo contrario de lo pedido. El turno se
// arma con lo MISMO que corre (molde: tests/agenda-whatsapp.test.ts).
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez y vuelta atrás:
//   1. sin la regla 3-bis-ya en `clasificarIntencion` ...................................... 1 fallo
//   2. la regla sin el freno de la PREGUNTA («¿ya lo hiciste?») ............................ 1 fallo
//   3. sin `areas: ['plan']` (el turno no trae el Plan) ....................................... 1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import type { Vista } from '../lib/api-mako/registro';

const RAIZ = join(__dirname, '..');
/** Los NOMBRES de las herramientas de siempre (viven en módulos con `server-only`: un node aparte, como agenda-whatsapp). */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  const nombres: string[] = JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  }));
  return nombres;
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
const vista: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };

function turno(mensaje: string) {
  const veredicto = clasificarIntencion(mensaje, {});
  const t = herramientasDelTurno({ veredicto, texto: mensaje, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista, hayPendientes: false, contextoDelSi: null });
  return { veredicto, nombres: t.tools.map((x) => x.name) };
}

test('«ya lo hice» trae cerrar la tarea Y leer el plan para encontrarla', () => {
  for (const m of ['ya lo hice', 'Ya terminé la landing de octubre', 'ya está hecha la #412', 'listo, ya subí los anuncios', 'hola mako, ya lo hice']) {
    const r = turno(m);
    assert.equal(r.veredicto.intencion, 'actuar', `«${m}» → ${r.veredicto.intencion}: ${r.veredicto.porque}`);
    assert.ok(r.nombres.includes('cerrar_tareas_plan'), `«${m}»: no viaja cerrar_tareas_plan`);
    assert.ok(r.nombres.includes('listar_tareas_plan'), `«${m}»: no viaja con qué encontrar la tarea`);
  }
});

test('una pregunta o algo que no es «lo hice» no se vuelve un cierre', () => {
  assert.notEqual(turno('¿ya lo hiciste?').veredicto.intencion, 'actuar', 'una pregunta no es un cierre');
  assert.ok(!turno('ya lo subí?').nombres.includes('cerrar_tareas_plan'), '«ya lo subí?» pregunta, no avisa que lo hizo');
  assert.ok(!turno('ya lo vi').nombres.includes('cerrar_tareas_plan'), '«ya lo vi» no es «ya lo hice»');
});

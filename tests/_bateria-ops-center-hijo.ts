// =============================================================================
// Hijo de tests/ops-center-bateria.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre cada frase de tests/fixtures/ops-center-frases.json por el MISMO camino que un turno real: el clasificador
// (`clasificarIntencion`) y la selección de herramientas, la del chat de la app (`herramientasDelChat`, como
// lib/mako-turno-app.ts) y la de WhatsApp (`herramientasDelTurno`, como lib/mako-doer-in.ts), con las de siempre reales
// (MAKO_TOOLS, MAKO_ACCION_TOOLS y `levantar_ticket`). En un node aparte con `--conditions=react-server`: las de siempre
// llevan `server-only`. Imprime, por frase, cuáles de SUS operaciones viajan en cada canal, y cuáles no existen.
// =============================================================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Par = { area: string; frase: string; operacion: string };

async function main() {
  const { clasificarIntencion } = await import('../lib/mako-intencion');
  const { herramientasDelChat } = await import('../lib/mako-turno-app-reglas');
  const { herramientasDelTurno } = await import('../lib/doer-herramientas');
  const { porId } = await import('../lib/api-mako/registro');
  const { MAKO_TOOLS } = await import('../lib/mako-tools');
  const { MAKO_ACCION_TOOLS } = await import('../lib/mako-doer-acciones');

  const pares = (JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'ops-center-frases.json'), 'utf8')) as { frases: Par[] }).frases;
  const deSiempre = [...MAKO_TOOLS, ...MAKO_ACCION_TOOLS, ...(porId('levantar_ticket') ? [{ name: 'levantar_ticket' }] : [])];
  const nombresDeSiempre = new Set(deSiempre.map((t) => t.name));
  // Un negocio cualquiera que no es el 1, admin, con todas las tabs: lo que se mide es el ruteo, no el permiso.
  const base = { ws: 9, rol: 'admin' as const, tabs: null, plataforma: false };
  const vistaApp = { ...base, canal: 'app' as const, alcance: 'proponer' as const };
  const vistaWa = { ...base, canal: 'whatsapp' as const, alcance: 'ejecutar' as const };

  const opsDe = new Map<string, Set<string>>();
  for (const p of pares) opsDe.set(p.frase, (opsDe.get(p.frase) ?? new Set()).add(p.operacion));
  const porFrase: Record<string, { app: string[]; whatsapp: string[] }> = {};
  for (const [frase, ops] of opsDe) {
    const veredicto = clasificarIntencion(frase, { hayMedia: false });
    const entrada = { veredicto, texto: frase, agendaAbierta: false, deSiempre, hayPendientes: false };
    const app = new Set(herramientasDelChat({ ...entrada, vista: vistaApp }).tools.map((t) => t.name));
    const wa = new Set(herramientasDelTurno({ ...entrada, vista: vistaWa }).tools.map((t) => t.name));
    porFrase[frase] = { app: [...ops].filter((o) => app.has(o)), whatsapp: [...ops].filter((o) => wa.has(o)) };
  }
  const inexistentes = [...new Set(pares.map((p) => p.operacion))].filter((o) => !porId(o) && !nombresDeSiempre.has(o));
  process.stdout.write(JSON.stringify({ porFrase, inexistentes }));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });

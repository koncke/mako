// =============================================================================
// Hijo de tests/curso-invitar-sacado.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/curso-invitar.ts y lib/comunidad-moderacion.ts llevan `server-only`: este archivo corre en un node aparte con
// `--conditions=react-server` y contesta con un JSON. Corre las funciones REALES —`invitarAlCurso`, `estaSacado` (la
// guarda nueva, contra la tabla `comunidad_baneos`) y `admitirAlumno` («Volver a admitir» de Members)— contra un PostgREST
// de mentira (tests/_postgrest-de-mentira.ts). De mentira es sólo lo que la invitación necesita del resto del mundo (el
// lead, los cursos, el link, el mail): eso no es lo que se prueba acá, y ya lo cubre tests/curso-invitar.test.ts.

import { crearPostgrest, type Fila } from './_postgrest-de-mentira';
import { decirYSalir } from './_salir-cuando-salio';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

let id = 7000;
const pg = crearPostgrest({
  tablas: ['comunidad_baneos', 'curso_accesos', 'leads', 'workspaces', 'app_settings'],
  defaults: (_t, f) => ({ id: ++id, created_at: new Date().toISOString(), ...f }),
});
/** Las tablas que contestan 500 en la escena (la base que no contesta). */
const caidas = new Set<string>();
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host !== 'supa.test') return new Response(JSON.stringify({ error: `red de mentira: ${u.href}` }), { status: 500 });
  const tabla = u.pathname.replace('/rest/v1/', '');
  if (caidas.has(tabla)) return new Response(JSON.stringify({ code: 'XX000', message: `se cayó ${tabla}` }), { status: 500, headers: { 'content-type': 'application/json' } });
  return pg.responder(u, init);
}) as typeof fetch;

const WS = 9, OTRO_WS = 8, LEAD = 21, OTRO_LEAD = 33;
const FIESTA = 39, OTRO_CURSO = 10;
const SACADO_AT = '2026-11-10T15:00:00.000Z';

async function main() {
  const db = pg.db as Record<string, Fila[]>;
  // Lo sacaron de Fiesta en Members: el baneo vigente, y su acceso con la lista ya achicada (le quedó el otro curso).
  db.comunidad_baneos.push(
    { id: 1, workspace_id: WS, producto_id: FIESTA, miembro: `l:${LEAD}`, lead_id: LEAD, motivo: '', por: 'Equipo', borro_contenido: false, levantado_at: null, created_at: SACADO_AT },
    // Del otro curso lo habían sacado y ya lo volvieron a admitir: ese baneo no cuenta.
    { id: 2, workspace_id: WS, producto_id: OTRO_CURSO, miembro: `l:${LEAD}`, lead_id: LEAD, motivo: '', por: 'Equipo', borro_contenido: false, levantado_at: '2026-11-01T00:00:00.000Z', created_at: '2026-10-30T00:00:00.000Z' },
    // Un baneo de OTRO negocio, del mismo programa y otra persona: no le corta nada a este negocio.
    { id: 3, workspace_id: OTRO_WS, producto_id: FIESTA, miembro: `l:${OTRO_LEAD}`, lead_id: OTRO_LEAD, motivo: '', por: 'Otro', borro_contenido: false, levantado_at: null, created_at: SACADO_AT },
  );
  db.curso_accesos.push({ id: 501, workspace_id: WS, lead_id: LEAD, area: null, productos: [OTRO_CURSO], revocado_at: null, invitacion_enviada_at: null });

  const { invitarAlCurso, aContrato, TEXTO_NO_INVITA } = await import('../lib/curso-invitar');
  const { estaSacado, admitirAlumno } = await import('../lib/comunidad-moderacion');
  const { runWithWorkspace } = await import('../lib/workspace');

  function deps(o: { ganado?: boolean } = {}) {
    const log: string[] = [];
    const d = {
      enWorkspace: <T,>(ws: number, fn: () => Promise<T>) => { log.push(`ws:${ws}`); return runWithWorkspace(ws, fn); },
      capaConCs: async () => true,
      lead: async () => ({ nombre: 'Ana Pérez', email: 'ana@x.mx', ganado: o.ganado !== false }),
      acceso: async () => null,
      // LA GUARDA DE VERDAD: la consulta a `comunidad_baneos`, sobre la base de mentira.
      sacado: async (ws: number, l: number, p: number) => { log.push(`sacado:${p}`); return estaSacado(ws, l, p); },
      esCliente: async () => true,
      cursos: async () => ['Fiesta Music'],
      linkDeEntrada: async () => { log.push('link'); return 'https://x/api/compartido/curso/entrar?t=c1.9.21.1.f'; },
      reclamar: async () => { log.push('reclamar'); return true; },
      soltar: async () => { log.push('soltar'); },
      negocio: async () => 'Casa Luna',
      entrarConGoogle: () => 'https://x/login',
      mandar: async (m: { email: string; enlace: string }) => { log.push(`mandar:${m.email}`); return { enviado: true, enlace: m.enlace }; },
      mandarWhatsapp: async () => ({ enviado: false, motivo: 'no se pidió' }),
      marcar: async (_l: number, e: string, _a: string, p: number | null) => { log.push(`marcar:${e}:${p}`); },
      guardarEmailDelLead: async () => {},
    };
    return { d, log };
  }
  const out: Record<string, unknown> = {};
  async function caso(nombre: string, p: Record<string, unknown>, o: { ganado?: boolean } = {}) {
    const { d, log } = deps(o);
    const r = await invitarAlCurso({ ws: WS, leadId: LEAD, autor: 'Equipo', ...p } as Parameters<typeof invitarAlCurso>[0], d);
    out[nombre] = { r, contrato: aContrato(r), log };
  }

  // ── Con el baneo vigente ──
  await caso('sacado', { productoId: FIESTA });
  await caso('sacadoReenviando', { productoId: FIESTA, reenviar: true });
  await caso('sacadoDesdeElBuscador', { productoId: FIESTA, cualquierEtapa: true }, { ganado: false });
  await caso('otroCursoAdmitido', { productoId: OTRO_CURSO });
  await caso('sinProducto', {});
  // El baneo de OTRO negocio no le corta nada a éste: otra persona, mismo programa, invitada en el ws 9.
  {
    const { d, log } = deps();
    const r = await invitarAlCurso({ ws: WS, leadId: OTRO_LEAD, autor: 'Equipo', productoId: FIESTA }, d);
    out.baneoDeOtroNegocio = { r, log };
  }
  // ── La base no contesta: falla cerrada, no sale nada ──
  caidas.add('comunidad_baneos');
  await caso('baseCaida', { productoId: FIESTA });
  caidas.delete('comunidad_baneos');

  // ── «Volver a admitir» en Members (la función REAL): después, invitar a ese curso anda ──
  const equipo = { ws: WS, productoId: FIESTA, clave: 'u:1', equipo: true, adminWs: true, leadId: null, nombre: 'Equipo' };
  const admitido = await admitirAlumno(equipo, `l:${LEAD}`);
  const sigueSacado = await runWithWorkspace(WS, () => estaSacado(WS, LEAD, FIESTA));
  await caso('trasAdmitir', { productoId: FIESTA });
  out.admitir = { admitido, sigueSacado, baneo: db.comunidad_baneos.find((f) => f.id === 1)?.levantado_at ?? null, acceso: db.curso_accesos[0]?.productos ?? null };
  out.textos = TEXTO_NO_INVITA;

  await decirYSalir(`@@SACADO@@${JSON.stringify(out)}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });

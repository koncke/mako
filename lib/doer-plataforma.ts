// =============================================================================
// doer-plataforma — en el grupo de SuperAdmin, MaKo sabe quiénes son los negocios y las agencias (12/11/2026)
// =============================================================================
// Martín, en el grupo «MaKo · SuperAdmin»: «Y dime cuánto va a pagar Código Inmobiliario el mes entrante con todos los clientes». MaKo
// contestó «Necesito saber a qué me refiero con "código inmobiliario". ¿Es el nombre de una campaña, un lead…?». En ese grupo escribe
// el equipo de MaKo SOBRE los negocios de la plataforma, por su nombre, y el turno no sabía ni que Código Inmobiliario es una agencia
// (la cuenta 13) con sus clientes en `agencia_clientes`. Esto le pone al system de ESE grupo la lista de negocios (cuenta, nombre, si es
// agencia y sus clientes), y —sólo si la herramienta viaja en el turno— de dónde sale lo que paga una agencia.
//
// ⚠️ Sólo en el grupo de la plataforma y nunca con un invitado (lo arma lib/mako-doer-in.ts), y nunca al system de la red gratis: son
// nombres de clientes. Puro, con test (tests/hilo-del-superadmin.test.ts); el lector va aparte y no tira.
// =============================================================================

export type NegocioDeLaPlataforma = { ws: number; nombre: string | null; capa: string | null };
export type FilaDeCartera = { agencia_ws: number; cliente_ws: number; estado: string | null };

/** Cuántos negocios entran, como mucho: el bloque es contexto, no un listado. */
export const TOPE_NEGOCIOS = 80;

const nombreDe = (n: NegocioDeLaPlataforma | undefined, ws: number): string => (n?.nombre || `Cuenta ${ws}`).replace(/\s+/g, ' ').slice(0, 40);

export function bloqueDeLaPlataforma(negocios: readonly NegocioDeLaPlataforma[], cartera: readonly FilaDeCartera[], o: { conMensualidades?: boolean } = {}): string {
  const porWs = new Map(negocios.map((n) => [n.ws, n]));
  const agencias = negocios.filter((n) => n.capa === 'agencia').sort((a, b) => a.ws - b.ws);
  const deAgencia = new Set<number>();
  const lineas: string[] = [];
  for (const a of agencias) {
    const suyos = cartera.filter((c) => c.agencia_ws === a.ws && c.estado !== 'revocado').map((c) => c.cliente_ws).sort((x, y) => x - y);
    suyos.forEach((w) => deAgencia.add(w));
    lineas.push(`· ${a.ws} ${nombreDe(a, a.ws)} — AGENCIA${suyos.length ? `; sus clientes: ${suyos.map((w) => `${w} ${nombreDe(porWs.get(w), w)}`).join(', ')}` : ', sin clientes todavía'}`);
  }
  const otros = negocios.filter((n) => n.capa !== 'agencia' && n.capa !== 'superadmin' && !deAgencia.has(n.ws)).sort((a, b) => a.ws - b.ws);
  for (const n of otros) lineas.push(`· ${n.ws} ${nombreDe(n, n.ws)}`);
  if (!lineas.length) return '';
  const recortadas = lineas.slice(0, TOPE_NEGOCIOS);
  const paga = o.conMensualidades
    ? '\nLo que paga una agencia —este mes, el mes que viene, lo que debe hoy, con cada renglón— sale de ver_mensualidades_agencias (con agenciaWs, el desglose de una): nunca lo calcules de memoria.'
    : '';
  return [
    'ESTE ES EL GRUPO DE SUPERADMIN: aquí escribe el equipo de MaKo, y habla de los NEGOCIOS de la plataforma por su nombre («Código», «Código Inmobiliario», «Leila»). Un nombre de esta lista es ese negocio, no una campaña ni un lead: no preguntes qué es.',
    `Los negocios (cuenta · nombre):\n${recortadas.join('\n')}${lineas.length > recortadas.length ? `\n(y ${lineas.length - recortadas.length} más)` : ''}${paga}`,
  ].join('\n');
}

/** Los negocios y las carteras de las agencias, para el bloque. null si no se pudo leer: el turno sigue sin el bloque. */
export async function leerLaPlataforma(): Promise<{ negocios: NegocioDeLaPlataforma[]; cartera: FilaDeCartera[] } | null> {
  try {
    const { getSupabaseServer } = await import('./supabase');
    const db = getSupabaseServer();
    const [w, c] = await Promise.all([
      db.from('workspaces').select('id, nombre, capa').order('id', { ascending: true }).limit(500),
      db.from('agencia_clientes').select('agencia_ws, cliente_ws, estado').limit(2000),
    ]);
    if (w.error) return null;
    const negocios = ((w.data ?? []) as Array<{ id: number; nombre: string | null; capa: string | null }>).map((x) => ({ ws: Number(x.id), nombre: x.nombre, capa: x.capa }));
    const cartera = c.error ? [] : ((c.data ?? []) as FilaDeCartera[]).map((x) => ({ agencia_ws: Number(x.agencia_ws), cliente_ws: Number(x.cliente_ws), estado: x.estado }));
    return { negocios, cartera };
  } catch {
    return null;
  }
}

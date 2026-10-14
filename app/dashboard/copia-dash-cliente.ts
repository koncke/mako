// =============================================================================
// copia-dash-cliente — copiar un dashboard como TOKEN y leer lo pegado (lo del navegador)
// =============================================================================
// Las reglas viven en lib/graficos-copia.ts y la ruta en app/api/graficos/copia/route.ts. Acá lo que comparten las dos
// pantallas: el ⋮ de una hoja («Copiar dashboard», app/dashboard/EditorInforme.tsx) y la caja de «Nueva hoja»
// (app/dashboard/NuevaHoja.tsx: el token pegado, «Pegar un dashboard» del «+» y «Pegar lo copiado» de la grilla).
// Es el molde de app/automations/copia-flujo-cliente.ts.
//
// ⚠️ SIN EL TEXTO ENTERO DE RESPALDO (a diferencia de «Copiar flujo»): una hoja no se pega como texto en ningún lado, y
// un JSON de 30 KB en el portapapeles de alguien que lo manda por WhatsApp no es una copia, es un problema. Si el server
// no la guarda, «Copiar dashboard» lo dice.

import { avisoDeVaciados, tokenDashDeTexto } from '@/lib/graficos-copia';
import { sanearHoja, type Hoja } from '@/lib/graficos-catalogo';

const API = '/api/graficos/copia';

/** Lo pegado, ya resuelto: su nombre, la hoja lista para ESTE negocio y el aviso de lo que se vació (o null). */
export type DashPegado = { nombre: string; hoja: Hoja; aviso: string | null };

/** Lo que el server ya dijo de cada token (una vez por pestaña: la caja y la grilla preguntan por el mismo). */
const lecturas = new Map<string, Promise<DashPegado | null>>();

/**
 * ¿Qué dashboard hay detrás de este token? null = no existe, o no se pudo preguntar (sin red, sin la tabla: no se
 * recuerda, se vuelve a preguntar). Un 404 se recuerda.
 */
export function leerDashPegado(texto: string): Promise<DashPegado | null> {
  const token = tokenDashDeTexto(texto);
  if (!token) return Promise.resolve(null);
  const ya = lecturas.get(token);
  if (ya) return ya;
  const p = fetch(API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({ action: 'leer', copia: token }),
  })
    .then(async (r) => {
      const j = await r.json().catch(() => null) as { ok?: boolean; nombre?: unknown; hoja?: unknown; vaciados?: unknown; falta?: string; error?: string } | null;
      if (j?.falta) console.warn(`[copiar dashboard] ${j.error ?? 'falta la tabla dashboard_copias'}`);
      // Lo que llega por la red se vuelve a sanear: la hoja vale por lo que dice el catálogo de acá.
      const hoja = j?.ok ? sanearHoja(j.hoja, 0) : null;
      if (!hoja || typeof j?.nombre !== 'string') {
        if (r.status !== 404) lecturas.delete(token);
        return null;
      }
      return { nombre: j.nombre, hoja, aviso: avisoDeVaciados(Number(j.vaciados) || 0) };
    })
    .catch(() => { lecturas.delete(token); return null; });
  lecturas.set(token, p);
  return p;
}

/** «COPIAR DASHBOARD»: el server guarda la hoja y devuelve su TOKEN, que es lo que va al portapapeles. Tira con el motivo. */
export async function tokenDeDashboard(h: Hoja): Promise<string> {
  let r: Response;
  try {
    r = await fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({ action: 'copiar', hoja: h }),
    });
  } catch {
    throw new Error('Sin conexión');
  }
  const j = await r.json().catch(() => null) as { ok?: boolean; token?: unknown; error?: string; falta?: string } | null;
  const token = j?.ok ? tokenDashDeTexto(j.token) : null;
  if (!token) {
    if (j?.falta) console.warn(`[copiar dashboard] ${j.error}`);
    throw new Error(r.status === 400 ? (j?.error ?? 'No se pudo copiar') : 'No se pudo copiar');
  }
  return token;
}

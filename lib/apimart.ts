import 'server-only';

// =============================================================================
// apimart — generar video e imagen con la cuenta de MaKo (7/11/2026)
// =============================================================================
// Martín, 7/11: «no quiero que sólo dependamos de Flow, **muchos clientes no tienen Flow**… quiero poder
// ofrecerles otra API» y «implementalo de punta a punta en MaKo, **para que nosotros costeemos eso**».
//
// Las reglas puras —qué modelos hay, cuánto cuestan, cómo se arma el pedido y cómo se lee si arrancó— viven en
// `./apimart-reglas.ts`, que se puede probar sin red y sin gastar. Acá está lo que toca la red.
//
// ── DE QUIÉN ES LA KEY: DE LA PLATAFORMA, Y NO ES UN DETALLE ────────────────────────────────────────────────
//
// ⚠️ **NO VA POR `credWs`.** `credWs` resuelve por el workspace en curso y sólo cae al entorno cuando el ws es
// `OWNER_WS` — que vale 1, y el 1 es **Mauricio, un CLIENTE** (el mismo aviso que dejó escrito
// `lib/elevenlabs.ts`). Con `credWs` pasarían las dos cosas malas a la vez: para cualquier cliente devolvería
// `null` y **ninguna generación andaría** (filas en `status='error'`, que es reintentable, y el cron
// levantándolas a fallar para siempre), y para el ws1 entregaría la clave de la plataforma dentro del
// workspace de un cliente.
//
// Va por `envCred`, que resuelve contra `wsDelEntorno` → `wsSuperAdmin()` **porque `APIMART_API_KEY` está en
// `IA_DE_UNA_CUENTA`** (lib/ia-keys.ts). Si alguien la saca de ese set, esto sigue compilando y empieza a leer
// la fila de un cliente sin que nada falle. Lo mira `tests/apimart-clave-de-plataforma.test.ts`.
//
// ── EL FRENO ES EL MEDIDOR, NO LA CREDENCIAL ───────────────────────────────────────────────────────────────
//
// Como la clave es de MaKo, **la clave no limita a nadie**: cualquier workspace podría generar. Lo que impide
// gastar más de lo cobrado es `alcanzaElSaldo` / `alcanzaParaVideo` (lib/mako-tokens-reglas.ts) ANTES de
// llamar, y el descuento atómico del ledger. Este módulo no decide si se puede: **lo exige el llamador.**
// =============================================================================

import { envCred } from './credenciales';
import {
  comoQuedo, cuerpoDePedido, usdDeVideo, MODELOS_VIDEO, MODELO_VIDEO_POR_DEFECTO,
  type Arranque, type IdModeloVideo,
} from './apimart-reglas';

const API = 'https://api.apimart.ai/v1';

/** La clave de la PLATAFORMA. `null` = no está configurada (y entonces no se genera: falla cerrado). */
export async function apimartKey(): Promise<string | null> {
  return envCred('APIMART_API_KEY');
}

async function pedir(ruta: string, init: RequestInit, key: string, ms = 120_000): Promise<{ status: number; cuerpo: unknown }> {
  const r = await fetch(`${API}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    signal: AbortSignal.timeout(ms),
  });
  const cuerpo = await r.json().catch(() => null);
  return { status: r.status, cuerpo };
}

/**
 * Manda a generar un video a partir de UNA foto.
 *
 * ⚠️ `fotoUrl` tiene que ser **http(s)**: la ruta de video rechaza `data:` («Only http/https URLs or asset://
 * private asset URLs are supported»). Para una foto del bucket privado va una **URL firmada** — ver
 * `urlFirmadaDeArchivero` abajo, que es el camino de producción.
 *
 * ⚠️ Y devuelve un `Arranque` de TRES estados, no un ok/error. `desconocido` **no** es «no arrancó»: puede
 * estar corriendo y cobrándose, y reintentarlo paga dos veces la misma pieza. El llamador decide, y la regla
 * está en `sePuedeReintentar`.
 */
export async function generarVideo(p: {
  fotoUrl: string;
  prompt: string;
  segundos: number;
  modelo?: IdModeloVideo;
}): Promise<Arranque> {
  const key = await apimartKey();
  if (!key) {
    return { estado: 'rechazado', porque: 'Falta configurar la clave de generación de MaKo. Avísanos y lo resolvemos.' };
  }
  const modelo = p.modelo ?? MODELO_VIDEO_POR_DEFECTO;
  let cuerpoPedido: Record<string, unknown>;
  try {
    cuerpoPedido = cuerpoDePedido(modelo, p.fotoUrl, p.prompt, p.segundos);
  } catch (e) {
    // Lo arma la regla pura y tira si la URL no sirve: eso es un rechazo nuestro, antes de gastar nada.
    return { estado: 'rechazado', porque: e instanceof Error ? e.message : 'No pude armar el pedido.' };
  }
  try {
    const { status, cuerpo } = await pedir('/videos/generations', { method: 'POST', body: JSON.stringify(cuerpoPedido) }, key);
    return comoQuedo(cuerpo, status);
  } catch (e) {
    // ⚠️ UN TIMEOUT NO ES UN RECHAZO. El pedido pudo haber llegado: queda `desconocido` y NO se reintenta solo.
    return {
      estado: 'desconocido',
      porque: 'Se cortó la conexión con el proveedor antes de saber si la generación arrancó.',
      crudo: e instanceof Error ? e.message.slice(0, 200) : '',
    };
  }
}

export type EstadoTarea =
  | { fase: 'esperando'; progreso: number }
  | { fase: 'listo'; url: string; usdReal: number }
  | { fase: 'error'; detalle: string };

/**
 * Cómo va una tarea.
 *
 * ⚠️ `usdReal` sólo existe cuando terminó: el catálogo de ApiMart NO trae precios y el costo llega recién acá,
 * en `data.cost`. Por eso el medidor cobra una ESTIMACIÓN antes y el ledger ajusta al cerrar — y por eso
 * `mtDeUsd` redondea hacia arriba, porque la diferencia se descubre tarde.
 */
export async function estadoDeTarea(taskId: string): Promise<EstadoTarea> {
  const key = await apimartKey();
  if (!key) return { fase: 'error', detalle: 'Falta configurar la clave de generación de MaKo.' };
  try {
    const { cuerpo } = await pedir(`/tasks/${encodeURIComponent(taskId)}`, { method: 'GET' }, key, 30_000);
    const d = (cuerpo as { data?: Record<string, unknown> } | null)?.data ?? {};
    const estado = String(d.status ?? '');
    if (estado === 'failed') {
      return { fase: 'error', detalle: String((d.error as { message?: string } | undefined)?.message ?? 'La generación falló.') };
    }
    if (estado !== 'completed') return { fase: 'esperando', progreso: Number(d.progress ?? 0) };
    // El resultado viene anidado y la url puede ser string o lista, según el modelo. Misma familia que el
    // `task_id` de dos formas: se tolera, no se asume.
    const r = d.result as { videos?: Array<{ url?: string | string[] }>; images?: Array<{ url?: string | string[] }> } | undefined;
    const bruto = r?.videos?.[0]?.url ?? r?.images?.[0]?.url;
    const url = Array.isArray(bruto) ? bruto[0] : bruto;
    if (!url) return { fase: 'error', detalle: 'El proveedor dijo que terminó pero no devolvió el archivo.' };
    return { fase: 'listo', url: String(url), usdReal: Number(d.cost ?? 0) };
  } catch {
    // Preguntar y no poder NO es un fallo de la generación: sigue corriendo. Se reporta como espera para que
    // el que sondea vuelva a preguntar, igual que el `a_ciegas` del puente de Flow.
    return { fase: 'esperando', progreso: 0 };
  }
}

/** Lo que va a costar, en US$, antes de llamar. Es una estimación: el real llega al terminar. */
export const costoEstimado = (segundos: number, modelo: IdModeloVideo = MODELO_VIDEO_POR_DEFECTO): number =>
  usdDeVideo(modelo, segundos);

/** Los modelos que se le pueden ofrecer, con su precio medido. Para la pantalla. */
export const modelosDisponibles = () => Object.values(MODELOS_VIDEO);

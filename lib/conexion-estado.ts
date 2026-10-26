// =============================================================================
// conexion-estado — ¿está conectada esa cosa? Para `como_conectar` y para el «listo» de la guía de WhatsApp (25/10/2026)
// =============================================================================
// Dos preguntas distintas, y por eso dos funciones:
//   · `conectadaSinProbar`: lo que hay guardado (la credencial, la computadora, el QR, el permiso de Google). Es lo que dice
//     `como_conectar` antes de guiar: barato y sin tocar al proveedor.
//   · `conectadaProbando`: además le pega al proveedor con lo guardado (`verificarServicio`, lib/metodo-verificar.ts). Es lo
//     que contesta el «listo» de la guía (lib/doer-ayuda.ts): «guardé la clave» no es «la clave anda».
// ⚠️ `verificarServicio` se escribió para el tilde del formulario y tiene `ok` que no le pegaron a nadie (Clarity, Zernio sin
// key, Cal.com sin API key: docs/hallazgos-integraciones.md). Acá se usa sólo para lo que la guía ofrece conectar desde
// WhatsApp (su GPT, su Claude por clave, Fathom…), donde el ping es un pedido real.
// null = no se sabe (no se pudo leer, o no tiene cómo medirse): nunca se lo toma como «no está».
// =============================================================================

import 'server-only';
import type { Conexion } from './conexiones-catalogo';
import { integracionConectada } from './credenciales';
import { listarPcDelNegocio } from './ia-pc';
import { getInstanciaRow } from './evolution';
import { googleCalendarConectado } from './google-calendar';
import { verificarServicio } from './metodo-verificar';
import { runWithWorkspace } from './workspace';

export type EstadoConexion = { conectada: boolean | null; motivo?: string | null };

/** Lo guardado, sin tocar al proveedor. Nunca tira. */
export async function conectadaSinProbar(c: Conexion, ws: number): Promise<boolean | null> {
  try {
    return await runWithWorkspace(ws, async () => {
      if (c.key === 'pc') return (await listarPcDelNegocio(ws)).length > 0;
      if (c.key === 'whatsapp') return (await getInstanciaRow())?.estado === 'conectado';
      if (c.key === 'google') return await googleCalendarConectado();
      if (c.verifica === 'probar_conexion') return await integracionConectada(c.key, ws);
      return null;
    });
  } catch { return null; }
}

/**
 * Lo guardado Y que ande: la computadora EN LÍNEA (no sólo emparejada) y la credencial probada contra el proveedor. Con el
 * motivo cuando no anda, para el ticket. Nunca tira.
 */
export async function conectadaProbando(c: Conexion, ws: number): Promise<EstadoConexion> {
  try {
    return await runWithWorkspace(ws, async (): Promise<EstadoConexion> => {
      if (c.key === 'pc') {
        const pcs = await listarPcDelNegocio(ws);
        if (!pcs.length) return { conectada: false, motivo: 'no hay ninguna computadora conectada' };
        return pcs.some((p) => p.enLinea) ? { conectada: true } : { conectada: false, motivo: 'la computadora está conectada pero apagada o sin internet' };
      }
      if (c.verifica !== 'probar_conexion') return { conectada: await conectadaSinProbar(c, ws) };
      if (!(await integracionConectada(c.key, ws))) return { conectada: false, motivo: 'no hay nada guardado' };
      const r = await verificarServicio(c.key, {});
      if (r.ok) return { conectada: true };
      // Un servicio sin prueba desde acá: lo guardado es lo único que se sabe.
      if (r.error === 'servicio inválido') return { conectada: true };
      return { conectada: false, motivo: r.error ?? 'el proveedor no aceptó lo guardado' };
    });
  } catch { return { conectada: null }; }
}

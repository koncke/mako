// =============================================================================
// registro-lineas — anota y lee los cambios de la voz y del canal de MaKo (el porqué, en lib/registro-lineas-reglas.ts)
// =============================================================================
// La voz (`mako.voz.instancia`) y el canal (`mako.canal.instancia`) viven en `app_settings` del dueño (OWNER_WS); el registro,
// al lado. Todo con `runWithWorkspace(OWNER_WS)` explícito: la ruta corre en /agencia, donde el parche de fetch le pega el `?ws=`
// del cliente que se esté mirando (el mismo cuidado que lib/mako-canal.ts con «tu número»).

import 'server-only';
import { cambiarSettingSi, getSettingEstricto } from './settings';
import { runWithWorkspace, OWNER_WS, wsSuperAdmin } from './workspace';
import { KEY_CANAL_INSTANCIA, KEY_VOZ_INSTANCIA } from './linea-plataforma';
import { getInstanciaRow, numeroDeInstancia } from './evolution';
import {
  KEY_REGISTRO_LINEAS, NO_SE_LEYO, conElCambio, instanciasDe, leerRegistroLineas,
  type CambioDeLinea, type FotoLineas,
} from './registro-lineas-reglas';

const leerClave = (k: string) =>
  runWithWorkspace(OWNER_WS, () => getSettingEstricto(k)).then((v) => (v ?? '').trim() || null, () => NO_SE_LEYO);

/** La voz y el canal ahora. Nunca tira: lo que no se pudo leer vuelve como `NO_SE_LEYO`. */
export async function fotoDeLineas(): Promise<FotoLineas> {
  const [voz, canal] = await Promise.all([leerClave(KEY_VOZ_INSTANCIA), leerClave(KEY_CANAL_INSTANCIA)]);
  return { voz, canal };
}

/** La línea personal de Martín: la de por defecto del negocio del super admin (el …3479). null si no se pudo leer. */
async function lineaPersonalDeMartin(): Promise<string | null> {
  try {
    return (await runWithWorkspace(await wsSuperAdmin(), () => getInstanciaRow()))?.instance_name ?? null;
  } catch {
    return null;
  }
}

/** El número de cada instancia que nombra el cambio y la línea personal de Martín (best-effort, con tope corto). */
async function conDatos(c: CambioDeLinea): Promise<CambioDeLinea> {
  const [pares, personal] = await Promise.all([
    Promise.all(instanciasDe(c).map(async (i) => [i, await numeroDeInstancia(i, 2500).catch(() => null)] as const)),
    lineaPersonalDeMartin(),
  ]);
  const numeros: Record<string, string> = { ...c.numeros };
  for (const [i, n] of pares) if (n) numeros[i] = n;
  return { ...c, numeros, personal };
}

/**
 * Anota el cambio al frente del registro. Compare-and-set con dos reintentos (`cambiarSettingSi`): dos pedidos a la vez no se
 * pisan. Devuelve si quedó escrito; nunca tira (el cambio de línea ya pasó, y no puede fallar por el renglón).
 */
export async function anotarCambioDeLinea(cambio: CambioDeLinea): Promise<boolean> {
  try {
    const c = await conDatos(cambio);
    return await runWithWorkspace(OWNER_WS, async () => {
      for (let intento = 0; intento < 3; intento++) {
        const raw = await getSettingEstricto(KEY_REGISTRO_LINEAS);
        if (await cambiarSettingSi(KEY_REGISTRO_LINEAS, raw, conElCambio(raw, c))) return true;
      }
      return false;
    });
  } catch (e) {
    console.error(`[registro-lineas] no pude anotar el cambio de ${cambio.accion}: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

/** Los cambios guardados, de lo más nuevo a lo más viejo. Tira si la base no contestó: «no pude leer» no es «no hubo». */
export async function leerCambiosDeLinea(): Promise<CambioDeLinea[]> {
  const raw = await runWithWorkspace(OWNER_WS, () => getSettingEstricto(KEY_REGISTRO_LINEAS));
  return leerRegistroLineas(raw);
}

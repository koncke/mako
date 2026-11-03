// =============================================================================
// lineas-de-mako-vigilante — la vigilancia de las dos líneas de Martín, con la red enchufada
// =============================================================================
// Lo que decide está en lib/lineas-de-mako.ts, puro y con test. Acá sólo se conectan las lecturas y los envíos reales.
//
// ⚠️ NO TOCA LA SESIÓN: ni logout, ni delete, ni create, ni restart (tests/lineas-de-mako.test.ts lo exige). Volver a vincular
// es un QR que escanea Martín (`conectarCanalMaKo`). Lo único que abre es `reabrirSesion`, que no borra nada.
//
// ⚠️ La línea se pasa SIEMPRE por nombre en el envío. En la plataforma, `enviarTexto` sin línea sale por la de MaKo
// (lib/linea-plataforma.ts), que puede ser justo la que se cayó.
// =============================================================================

import 'server-only';
import { enviarTexto, fotoDeLinea, reabrirSesion, sondearSocketDetalle } from './evolution';
import { avisarPorEmail } from './canal-vigilante';
import { instanciaVoz } from './mako-grupo';
import { cambiarSettingSi, getSettingEstricto, setSetting } from './settings';
import { getSupabaseServer } from './supabase';
import { runWithWorkspace, wsSuperAdmin } from './workspace';
import { APP_BASE_URL, linkApp } from './app-url';
import { esLineaDeMaKo } from './linea-plataforma';
import { esLineaDelWorkspace, lineaPorDefault } from './lineas-whatsapp';
import { correrVigilancia, type ResultadoLinea } from './lineas-de-mako';

const TOPE_FOTO_MS = 8000;
const TOPE_SONDA_MS = 8000;
const TOPE_REABRIR_MS = 10_000;

/** La línea por default del negocio del super admin. La de MaKo no tiene fila en esta tabla, así que no puede salir de acá. */
async function lineaSecundaria(ws: number): Promise<string | null> {
  const { data, error } = await getSupabaseServer()
    .from('evolution_instancias').select('id, instance_name, es_default').eq('workspace_id', ws);
  if (error) throw new Error(error.message);
  const filas = ((data ?? []) as Array<{ id: number; instance_name: string; es_default: boolean | null }>)
    .filter((f) => esLineaDelWorkspace(f.instance_name, ws));
  return lineaPorDefault(filas)?.instance_name ?? null;
}

export async function vigilarLineasDeMako(): Promise<{ lineas: ResultadoLinea[]; error?: string }> {
  const ws = await wsSuperAdmin();
  const linkDeLinea = (instancia: string) => linkApp(`/whatsapp?canal=no-oficial&linea=${encodeURIComponent(instancia)}`, ws);
  return correrVigilancia({
    voz: () => instanciaVoz({ estricto: true }),
    secundaria: () => lineaSecundaria(ws),
    foto: (instancia) => fotoDeLinea(instancia, TOPE_FOTO_MS),
    sondear: (instancia) => sondearSocketDetalle(instancia, TOPE_SONDA_MS),
    leer: (key) => runWithWorkspace(ws, () => getSettingEstricto(key)),
    escribir: (key, valor) => runWithWorkspace(ws, () => setSetting(key, valor)),
    cambiarSi: (key, esperado, nuevo) => runWithWorkspace(ws, () => cambiarSettingSi(key, esperado, nuevo)),
    enviar: async (linea, numero, texto) => {
      const r = await runWithWorkspace(ws, () => enviarTexto(numero, texto, linea, { sinVistaPrevia: true }));
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    },
    mail: (asunto, cuerpo) => avisarPorEmail(ws, asunto, cuerpo),
    reabrir: (instancia) => reabrirSesion(instancia, TOPE_REABRIR_MS),
    // ⚠️ /agencia sólo reconecta el canal (`conectarCanalMaKo`). Con la voz en una línea de negocio, ese link ofrece escanear el número baneado.
    linkPrincipal: (instancia) => (esLineaDeMaKo(instancia) ? `${APP_BASE_URL}/agencia?canal=1` : linkDeLinea(instancia)),
    linkSecundaria: (instancia) => linkDeLinea(instancia),
    ahoraMs: () => Date.now(),
  });
}

// =============================================================================
// lineas-vigilante — que la línea de WhatsApp de un CLIENTE no se muera en silencio
// =============================================================================
// La hermana de lib/canal-vigilante.ts. Aquélla mira la VOZ de MaKo y avisa por mail,
// porque el aviso no puede viajar por el canal que se rompió. Ésta mira las líneas por QR
// de cada negocio y el aviso SÍ puede ir por WhatsApp: sale por la voz de MaKo al grupo
// del cliente, que no pasa por la línea caída. Por eso vive aparte, y el guard de
// «la alarma de la voz nunca va por WhatsApp» (tests/canal-vigilante.test.ts) sigue
// diciendo lo que dice.
//
// Decisión de Martín, 06/10/2026: «c: solo al cliente» — el aviso le llega al negocio
// dueño de la línea (`emitirDelCatalogo('wa-desconectado', { ws })`, que respeta su
// interruptor y sus canales) y a nadie más. Lo que decide cuándo avisar está en
// lib/linea-vigilancia.ts, puro y con test.
//
// ⚠️ SE RECORREN LAS FILAS DE `evolution_instancias`, NUNCA SE DERIVA EL NOMBRE DE LA LÍNEA
// DEL WORKSPACE. Desde las migs 0198/0199 un negocio tiene N líneas, con sufijo al azar:
// `instanceNameDeWs(ws)` contesta una sola y puede contestar una que ya no existe.
//
// ⚠️ Y LA VOZ DE MaKo QUEDA AFUERA: la mira canal-vigilante y la avisa por mail a la
// agencia. Medido el 06/10/2026 no está en esta tabla (`mako.voz.instancia` apunta a una
// instancia de la plataforma), pero se excluye igual, por nombre y por workspace: si
// mañana se registra ahí, un cliente no puede recibir «se cayó tu WhatsApp» sobre la
// línea de MaKo. Si no se puede leer cuál es la voz, no se vigila nada esa corrida: un
// chequeo que no puede mirar se abstiene.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from './supabase';
import { sondearSocketDetalle, motivoCaida } from './evolution';
import { esInstanciaInexistente, type Sondeo } from './evolution-sonda';
import { instanciaVoz } from './mako-grupo';
import { getSettingEstricto, setSetting } from './settings';
import { listarWorkspaces, runWithWorkspace, wsSuperAdmin } from './workspace';
import { emitirDelCatalogo } from './avisos';
import { linkApp } from './app-url';
import { tzDeWorkspace } from './timezone';
import {
  decidirLinea, textoCaida, textoVolvio, lineaLegible, keyDesde, keyAvisado, DEDUP_LINEA_MIN,
  type DecisionLinea, type MarcasLinea,
} from './linea-vigilancia';

type FilaLinea = {
  workspace_id: number;
  instance_name: string;
  numero: string | null;
  etiqueta: string | null;
  ultima_conexion_at: string | null;
};

export type ResultadoLinea = {
  ws: number; linea: string; sondeo: Sondeo; que: DecisionLinea['que'];
  /** sólo cuando `que` es `avisar` o `volvio`: si le llegó al negocio por algún canal. */
  llego?: boolean;
  error?: string;
};

/** Tope de la sonda por línea, y de la lectura del motivo: este cron corre cada 10 minutos. */
const TOPE_SONDA_MS = 8000;
const TOPE_MOTIVO_MS = 4000;
/** Cuántas líneas se sondean a la vez. */
const EN_PARALELO = 4;

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export async function vigilarLineasClientes(): Promise<{ lineas: ResultadoLinea[]; error?: string }> {
  let voz: string;
  try {
    voz = await instanciaVoz({ estricto: true });
  } catch (e) {
    return { lineas: [], error: `no pude leer cuál es la línea de voz de MaKo: ${msg(e)}` };
  }
  const plataforma = await wsSuperAdmin();
  const activos = new Set((await listarWorkspaces()).filter((w) => w.estado === 'activo').map((w) => w.id));

  // La ÚNICA lectura entre workspaces de este módulo, y es a propósito: el universo son
  // todas las líneas de todos los negocios. Todo lo demás corre adentro del suyo.
  const { data, error } = await getSupabaseServer()
    .from('evolution_instancias')
    .select('workspace_id, instance_name, numero, etiqueta, ultima_conexion_at');
  if (error) return { lineas: [], error: `no pude leer las líneas: ${error.message}` };

  const filas = ((data ?? []) as FilaLinea[]).filter((f) =>
    !!f.instance_name && activos.has(f.workspace_id) && f.workspace_id !== plataforma && f.instance_name !== voz);

  const lineas: ResultadoLinea[] = [];
  for (let i = 0; i < filas.length; i += EN_PARALELO) {
    lineas.push(...(await Promise.all(filas.slice(i, i + EN_PARALELO).map(vigilarUna))));
  }
  return { lineas };
}

async function vigilarUna(f: FilaLinea): Promise<ResultadoLinea> {
  const ws = f.workspace_id;
  const linea = f.instance_name;
  const d = await sondearSocketDetalle(linea, TOPE_SONDA_MS)
    .catch((e) => ({ sondeo: 'sin_respuesta' as Sondeo, status: 0, detalle: msg(e) }));

  // Estrictas: una marca que no se pudo leer leída como «no hay marca» repite el aviso.
  let marcas: MarcasLinea;
  try {
    marcas = await runWithWorkspace(ws, async () => ({
      desde: (await getSettingEstricto(keyDesde(linea))) || null,
      avisado: (await getSettingEstricto(keyAvisado(linea))) || null,
    }));
  } catch (e) {
    return { ws, linea, sondeo: d.sondeo, que: 'nada', error: `no pude leer las marcas: ${msg(e)}` };
  }

  const decision = decidirLinea({
    sondeo: d.sondeo, vinculadaAlgunaVez: !!f.ultima_conexion_at,
    // `desconectar()` borra la instancia y deja la fila de la de por default: eso no es una caída.
    sinInstancia: esInstanciaInexistente({ status: d.status, error: d.detalle }),
    marcas, ahoraMs: Date.now(),
  });
  const base = { ws, linea, sondeo: d.sondeo, que: decision.que };
  const ahora = new Date().toISOString();
  try {
    if (decision.que === 'fijar_desde') {
      await runWithWorkspace(ws, () => setSetting(keyDesde(linea), ahora));
      return base;
    }
    if (decision.que === 'limpiar' || decision.que === 'volvio') {
      await runWithWorkspace(ws, async () => {
        await setSetting(keyDesde(linea), '');
        await setSetting(keyAvisado(linea), '');
      });
      if (decision.que === 'limpiar') return base;
      // ⚠️ LAS MARCAS SE LIMPIAN AUNQUE EL «VOLVIÓ» NO LLEGUE. Al revés que la caída: si se
      // quedaran puestas esperando que el aviso salga, la próxima caída de esta línea arrancaría
      // con un «desde» viejo y se avisaría sin la segunda medición que la confirma. Un «volvió»
      // perdido es lo menos caro de los dos. El dedup va con su propia clave: no comparte ventana
      // con el «se cortó» de la misma línea.
      const r = await emitirDelCatalogo('wa-reconectado', {
        ws, texto: textoVolvio({ linea: lineaLegible(f) }), dedupKey: `volvio:${linea}`, dedupTtlMin: DEDUP_LINEA_MIN,
      });
      const llego = r.wa || r.email === true;
      return {
        ...base, llego,
        ...(llego ? {} : { error: r.waError ?? (r.apagado ? 'el negocio lo tiene apagado' : r.deduped ? 'ya avisado hace poco' : 'no salió por ningún canal') }),
      };
    }
    if (decision.que !== 'avisar') return base;

    const motivo = await motivoCaida(linea, TOPE_MOTIVO_MS).catch(() => null);
    const tz = await tzDeWorkspace(ws).catch(() => 'America/Tijuana');
    const texto = textoCaida({
      motivo, desde: marcas.desde, linea: lineaLegible(f), tz,
      link: linkApp(`/whatsapp?canal=no-oficial&linea=${encodeURIComponent(linea)}`, ws),
    });
    const r = await emitirDelCatalogo('wa-desconectado', {
      ws, texto, dedupKey: linea, dedupTtlMin: DEDUP_LINEA_MIN,
    });
    // ⚠️ LA MARCA SE PONE SÓLO SI LE LLEGÓ. Si el aviso no salió (el negocio no tiene grupo
    // todavía, la voz de MaKo está caída, lo apagó), la próxima corrida vuelve a probar: el
    // dedup del catálogo es el que impide repetirlo cada 10 minutos.
    const llego = r.wa || r.email === true;
    if (llego) await runWithWorkspace(ws, () => setSetting(keyAvisado(linea), ahora));
    return {
      ...base, llego,
      ...(llego ? {} : { error: r.waError ?? (r.apagado ? 'el negocio lo tiene apagado' : r.deduped ? 'ya avisado hace poco' : 'no salió por ningún canal') }),
    };
  } catch (e) {
    return { ...base, error: msg(e) };
  }
}

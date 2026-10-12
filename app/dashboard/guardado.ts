// =============================================================================
// guardado — la COLA del autoguardado del Dashboard: uno detrás del otro, con la versión que leyó
// =============================================================================
// Tanda v5 (12/10/2026; docs/hallazgos-graficos.md, «Dos escritores del mismo tablero»): el autoguardado
// hacía un upsert ciego del informe ENTERO y la API de MaKo escribía con compare-and-set, así que ganaba el
// último que escribía — y una pestaña vieja, con el saneo de antes, borraba en su primer guardado todo lo que
// su versión no conoce (filtros fijos, pop-ups, conectores, secciones, cajas de IA). Desde v5 el editor manda
// la VERSIÓN que leyó (`{ accion: 'guardar', version, tablero }`) y la ruta contesta la nueva, o 409.
//
// Lo que no se ve en la firma:
//   · UNO DETRÁS DEL OTRO. Con compare-and-set, dos guardados en vuelo con la misma versión chocan ENTRE SÍ:
//     el segundo recibe un 409 y la pantalla diría «Cambió en otra pestaña» sobre un cambio propio. Mientras
//     uno está en vuelo, el siguiente espera; y si llegan varios, sólo vale el ÚLTIMO (es el informe entero).
//   · LA VERSIÓN SE TOMA DE LA RESPUESTA, nunca se calcula acá: es la huella de lo guardado en el server.
//   · UN 409 PARA LA COLA, con o sin `conflicto`: con conflicto, otro escritor guardó en el medio; sin él, la
//     ruta no reconoce el pedido (una pestaña vieja). En los dos casos seguir guardando pisaría algo: se avisa
//     UNA vez y no se manda nada más (la persona recarga).
//   · Un fallo que no es 409 (la red, un 500) avisa y NO para: lo escrito queda pendiente (`alFallar` recibe
//     el JSON que no entró) para el próximo cambio o para cuando la pestaña se oculte, con la MISMA versión
//     (el server no la cambió).
//
// Puro (sin React): lo usa app/dashboard/EditorInforme.tsx y lo fija tests/dashboard-guardado.test.ts.

/** Lo que contestó la ruta de guardar, ya leído. */
export type RespuestaGuardado = { ok: true; version: string | null } | { ok: false; status: number; conflicto: boolean };

/** Manda UN guardado (el `fetch` de la pantalla). `keepalive` cuando la pestaña se oculta o el editor se va. */
export type EnviarGuardado = (json: string, version: string | null, keepalive: boolean) => Promise<RespuestaGuardado>;

export type ColaGuardado = {
  /** Pide guardar este informe (el JSON entero). Lo igual a lo último guardado no se manda. */
  pedir: (json: string, keepalive?: boolean) => Promise<void>;
  /** La versión con la que va el próximo guardado. */
  version: () => string | null;
  /** Lo último que el server confirmó. */
  ultimo: () => string;
  /** Hay algo esperando o en vuelo. */
  pendiente: () => boolean;
  /** Se paró por un 409: no se guarda nada más hasta recargar. */
  parada: () => boolean;
};

export function crearColaGuardado(opts: {
  version: string | null;
  /** El JSON del informe que vino del server: no se vuelve a mandar igual. */
  ultimo: string;
  enviar: EnviarGuardado;
  alGuardar?: (json: string) => void;
  /** Falló sin ser un 409 (se reintenta con el próximo cambio): `json` es lo que no entró. */
  alFallar?: (keepalive: boolean, json: string) => void;
  /** Un 409: la cola se para. Se llama UNA vez. */
  alConflicto: (conflicto: boolean) => void;
}): ColaGuardado {
  let version = opts.version;
  let ultimo = opts.ultimo;
  let espera: { json: string; keepalive: boolean } | null = null;
  let enVuelo: Promise<void> | null = null;
  /** Lo que está viajando ahora: contra eso se compara un pedido nuevo (si no, volver a lo de antes mientras
   *  viaja otra cosa no se mandaría nunca: sería «igual a lo guardado» con el server a punto de cambiar). */
  let viajando: string | null = null;
  let parada = false;

  const correr = async () => {
    while (espera && !parada) {
      const { json, keepalive } = espera;
      espera = null;
      if (json === ultimo) continue;
      let r: RespuestaGuardado;
      viajando = json;
      try { r = await opts.enviar(json, version, keepalive); } catch { r = { ok: false, status: 0, conflicto: false }; }
      viajando = null;
      if (r.ok) {
        version = r.version;
        ultimo = json;
        opts.alGuardar?.(json);
      } else if (r.status === 409) {
        parada = true;
        espera = null;
        opts.alConflicto(r.conflicto);
      } else {
        opts.alFallar?.(keepalive, json);
      }
    }
    enVuelo = null;
  };

  return {
    pedir: (json, keepalive = false) => {
      if (parada) return enVuelo ?? Promise.resolve();
      if (espera) {
        // Ya había uno esperando: éste lo reemplaza (es el informe entero), y el keepalive no se pierde.
        espera = { json, keepalive: keepalive || espera.keepalive };
        return enVuelo ?? Promise.resolve();
      }
      if (json === (viajando ?? ultimo)) return enVuelo ?? Promise.resolve();
      espera = { json, keepalive };
      // En un microtask y no en el acto: si `correr` terminara sin esperar nada, su `enVuelo = null` correría
      // ANTES de esta asignación y la cola quedaría «en vuelo» para siempre.
      if (!enVuelo) enVuelo = Promise.resolve().then(correr);
      return enVuelo;
    },
    version: () => version,
    ultimo: () => ultimo,
    pendiente: () => !!espera || !!enVuelo,
    parada: () => parada,
  };
}

/** Lee la respuesta de la ruta de guardar. Un 200 sin `version` es un guardado de antes (null). */
export async function leerRespuestaGuardado(r: Response): Promise<RespuestaGuardado> {
  if (r.ok) {
    const j = (await r.json().catch(() => null)) as { version?: unknown } | null;
    return { ok: true, version: typeof j?.version === 'string' ? j.version : null };
  }
  let conflicto = false;
  if (r.status === 409) {
    const j = (await r.json().catch(() => null)) as { conflicto?: unknown } | null;
    conflicto = j?.conflicto === true;
  }
  return { ok: false, status: r.status, conflicto };
}

// =============================================================================
// agencia-mes-avisos — reclamar un aviso de cobro y mandarlo, sin dejar la marca puesta si no salió (6/11/2026)
// =============================================================================
// El aviso de las entradas de una agencia se manda UNA vez por cliente y por día límite, y lo que lo cuida es una marca en
// `app_settings` de la plataforma (`agencia.mensualidad.<ag>.avisoentrada.<cliente>.<día>`). Acá se reclama esa marca y se
// manda, con la base INYECTADA (`DepsAviso`): así el test corre la misma función con una base y un envío que fallan, o que
// TIRAN, y comprueba que no queda ni una marca puesta.
//
// ⚠️ ESA MARCA NO ES SÓLO «NO LO REPITAS»: `lecturaParaPausas` (lib/agencia-mes.ts) la lee como «a ese cliente ya se le avisó
//    su entrada», y `quienVaEnPausa` sólo pausa al que se le avisó. Una marca escrita sin que el PDF haya salido cierra las
//    dos puertas a la vez: el aviso queda filtrado para siempre (no se vuelve a mandar nunca) y el cliente queda en «Paga
//    para entrar» el día de su vencimiento por una entrada que nadie le mandó. Por eso:
//      1. lo que se manda se arma ANTES de reclamar (un PDF que tira no deja ninguna marca), y
//      2. se suelta todo lo reclamado cuando el envío devuelve `ok: false` Y TAMBIÉN cuando algo TIRA en el medio
//         (`cambiarSettingSi` tira con un error de la base, y el envío puede tirar antes de contestar).
//    El `for` que reclamaba de a una y soltaba sólo en el `else` del `ok` dejaba las dos cosas afuera.
//
// Sin `server-only`: lo prueba tests/agencia-mes.test.ts con una base de mentira. La de verdad la pone lib/agencia-mes.ts.
// =============================================================================

/** Una marca a reclamar: su clave en `app_settings` y el valor que se escribe. */
export type Reclamo = { clave: string; valor: string };

export type DepsAviso = {
  /** Compare-and-set contra «la fila no existe»: true = la reclamó esta corrida. Tira si la base falla. */
  reclamar: (clave: string, valor: string) => Promise<boolean>;
  /** Borra la marca sólo si sigue valiendo lo que escribimos (nunca pisa la de otra corrida). */
  soltar: (clave: string, valor: string) => Promise<unknown>;
};

export type ResultadoAviso = {
  /** Salió el aviso (o no había nada que reclamar). */
  ok: boolean;
  /** Cuántas marcas quedaron puestas: 0 si no salió. */
  mandadas: number;
  error?: string;
};

/**
 * RECLAMA LAS MARCAS Y MANDA UNA SOLA COSA. Si no salió —devuelva `ok: false` o TIRE— suelta todo lo que reclamó, para que
 * la corrida de mañana lo vuelva a intentar. Lo que se manda se arma antes de llamar acá (ver la cabecera).
 *
 * De dos corridas a la vez, cada una se queda con las marcas que ganó: la que no ganó ninguna no manda nada (`mandadas: 0`,
 * `ok: true`), que es lo que ya hacía el código de antes.
 */
export async function reclamarYMandar(
  reclamos: readonly Reclamo[],
  mandar: () => Promise<{ ok: boolean; error?: string }>,
  d: DepsAviso,
): Promise<ResultadoAviso> {
  const ganadas: Reclamo[] = [];
  const soltarTodo = async (): Promise<void> => {
    // Se sueltan todas aunque una falle: una marca que queda puesta es un cliente que se pausa sin aviso.
    for (const g of ganadas) await Promise.resolve(d.soltar(g.clave, g.valor)).catch(() => false);
  };
  try {
    for (const r of reclamos) if (await d.reclamar(r.clave, r.valor)) ganadas.push(r);
    if (!ganadas.length) return { ok: true, mandadas: 0 };
    const r = await mandar();
    if (r.ok) return { ok: true, mandadas: ganadas.length };
    await soltarTodo();
    return { ok: false, mandadas: 0, error: r.error };
  } catch (e) {
    // ⚠️ También acá: `cambiarSettingSi` tira con un error de la base, y el envío puede tirar antes de contestar.
    await soltarTodo();
    throw e;
  }
}

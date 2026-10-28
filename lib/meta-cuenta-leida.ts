// =============================================================================
// Qué cuenta de Meta está leyendo MaKo, dicho como lo dice Meta
// =============================================================================
// Pedido del 23/10/2026: Mauricio creó campañas para tres clientes en el
// Administrador de anuncios de Meta y «no aparecían» en MaKo. MaKo no filtraba
// nada: Meta no las tenía en la cuenta conectada a esos negocios (borrador sin
// publicar, u otra cuenta). Nada en pantalla decía QUÉ cuenta se estaba leyendo,
// así que la única lectura posible era «MaKo no las trae» (docs/hallazgos-ads.md,
// «Creé la campaña en Meta y no me aparece en MaKo»).
//
// Lo usan la pestaña Campañas del Media Buyer (app/ads-manager/Lienzo.tsx, desde el
// 27/10: el CampanasBrowser que lo decía se borró el 25/10 con el rediseño, y la
// tab volvió a no decir qué cuenta leía; MK-03) y el selector de campañas del CRM
// (app/crm/CampanasModal.tsx): los dos dicen lo
// mismo, con el número como lo muestra Meta arriba a la izquierda (sin «act_»),
// que es contra lo que el cliente lo compara.
//
// Pura y sin imports de servidor: la importan componentes de cliente.
// =============================================================================

export type CuentaLeida = { id: string | null; nombre: string | null };

/** Días sin una campaña creada a partir de los cuales se avisa. Un mes: lo que tarda en
 *  notarse que «la que creé no está», sin pintar el aviso a quien lanza todas las semanas. */
export const DIAS_SIN_CAMPANAS_NUEVAS = 30;

/** El número de la cuenta como lo muestra Meta: sin el prefijo `act_`. */
export function numeroDeCuenta(id: string | null | undefined): string | null {
  const n = (id ?? '').trim().replace(/^act_/, '');
  return n || null;
}

/**
 * «Cuenta Patricia Contreras · 1551449682972756», el texto entero que se dibuja. Sin nombre
 * —o cuando el nombre ES el número, como en las cuentas que nadie bautizó (ws20)— va sólo el
 * número. `null` sin cuenta.
 *
 * ⚠️ El «Cuenta» va ACÁ y no en cada pantalla: la cuenta del ws1 se llama «Cuenta 2», y con
 * el prefijo puesto afuera la tab decía «Cuenta Cuenta 2 · …» (medido en producción, 23/10).
 */
export function etiquetaCuentaMeta(c: CuentaLeida | null | undefined): string | null {
  const numero = numeroDeCuenta(c?.id);
  if (!numero) return null;
  const nombre = (c?.nombre ?? '').trim();
  const texto = nombre && nombre !== numero ? `${nombre} · ${numero}` : numero;
  return /^cuenta\b/i.test(texto) ? texto : `Cuenta ${texto}`;
}

/** La fecha de creación más nueva (ISO de Meta, con o sin offset), o null. */
export function ultimaCreada(fechas: ReadonlyArray<string | null | undefined>): string | null {
  let mejor: { iso: string; t: number } | null = null;
  for (const f of fechas) {
    if (!f) continue;
    const t = Date.parse(f);
    if (Number.isNaN(t)) continue;
    if (!mejor || t > mejor.t) mejor = { iso: f, t };
  }
  return mejor?.iso ?? null;
}

/**
 * La frase que va cuando la cuenta no tiene campañas nuevas, para que no se lea como un
 * error de MaKo. `null` si hay alguna creada en los últimos `DIAS_SIN_CAMPANAS_NUEVAS`.
 *
 * ⚠️ Sólo con Meta CONTESTANDO (quien llama no la pide con un error de Meta): sin
 * respuesta no se sabe qué campañas hay, y afirmar «no tiene» mandaría a buscar mal.
 * `hayCampanas` aparte de `ultima`: una cuenta con campañas sin fecha no es una vacía.
 */
export function avisoSinCampanasNuevas(
  { hayCampanas, ultima }: { hayCampanas: boolean; ultima: string | null },
  ahora: Date = new Date(),
): string | null {
  if (!hayCampanas) return 'Esta cuenta de Meta no tiene campañas: si creaste una, publícala o revisa que sea esta cuenta.';
  if (!ultima) return null;
  const dias = (ahora.getTime() - Date.parse(ultima)) / 86_400_000;
  if (dias < DIAS_SIN_CAMPANAS_NUEVAS) return null;
  return 'Sin campañas nuevas en esta cuenta de Meta: si creaste una, publícala o revisa que sea esta cuenta.';
}

/**
 * Las campañas de la cuenta en el Administrador de anuncios, con una seleccionada si va `campanaId`. Es donde está
 * «Revisar y publicar»: un BORRADOR del Administrador no existe para la API (medido el 23/10/2026: `act_<id>/addrafts`
 * da #100 con el token de cada cliente), así que MaKo no lo puede listar; lo publica la persona ahí. `null` sin cuenta.
 */
export function linkCampanasEnMeta(cuentaId: string | null | undefined, campanaId?: string | null): string | null {
  const act = numeroDeCuenta(cuentaId);
  if (!act) return null;
  const qs = new URLSearchParams({ act });
  if (campanaId && /^\d+$/.test(campanaId)) qs.set('selected_campaign_ids', campanaId);
  return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?${qs.toString()}`;
}

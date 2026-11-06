// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.
// =============================================================================
// Admin › Billing — lo que lee el servidor para la página de finanzas de Studio Admin (6/11/2026)
// =============================================================================
// Reemplaza a Contenido.tsx (la lista de tarjetas de antes). Lee lo mismo de siempre —los cobros de la plataforma
// (cobrosDeMakoAction), sus precios, el libro de recibos y `vistaDeIngresos`— y lo pone en las piezas de Studio
// (./_components/finance.tsx, con las cuentas de ./billing-vista.ts). Con `?recibo=nuevo`, el recibo de Studio (dashboard/invoice).
//
// ⚠️ NO ES UNA MÁQUINA DE COBRO APARTE: los cobros son los del workspace de la plataforma (`wsSuperAdmin()`), creados con la
//    misma pasarela que conecta cualquier cliente en /integraciones (lib/cobros.ts).
// ⚠️ EL GUARD LO PONE QUIEN LA MONTA (app/admin/page.tsx: `getSesionAdmin`), y cada action vuelve a preguntar: el `rol_ws` vale
//    'admin' para el dueño de CADA workspace y abriría esto a todos los clientes.

import { ErrorSeccion } from "@/app/admin/_studio/error-seccion";
import { vistaDeIngresos } from "@/lib/admin-ingresos";
import { zonaDelNegocio } from "@/lib/timezone";

import { cobrosDeMakoAction, precioClienteAgenciaAction, preciosLocalesAction } from "./actions";
import { avisoDe, cifrasDe, comoEntra, desdeDe, fechaLarga, proximosDe } from "./billing-vista";
import { Finance, VISTAS_BILLING, type VistaBilling } from "./_components/finance";
import { Invoice } from "./recibo/invoice";
import { recibosAction } from "./recibos-actions";

export async function Billing({ vista, recibo }: { vista?: string; recibo?: string }) {
  const datos = await cobrosDeMakoAction();
  if (!datos.ok) return <ErrorSeccion titulo="No pude leer los cobros" detalle={datos.error} href="/admin?tab=billing" />;

  if (recibo === "nuevo") {
    const r = await recibosAction();
    if (!r.ok) return <ErrorSeccion titulo="No pude abrir el recibo" detalle={r.error} href="/admin?tab=billing&vista=recibos" />;
    if (r.faltaLaMigracion) return <ErrorSeccion titulo="Los recibos todavía no están listos" detalle="Falta aplicar la migración 0397." href="/admin?tab=billing" />;
    const tz = await zonaDelNegocio(datos.ws).catch(() => "UTC");
    return <Invoice cuentas={r.cuentas} planes={r.planes} emisor={r.emisor} hoy={new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date())} />;
  }

  const [precio, locales, recibos, ingresos, tz] = await Promise.all([
    precioClienteAgenciaAction(),
    preciosLocalesAction(),
    recibosAction(),
    vistaDeIngresos().catch((e: unknown) => ({ error: e instanceof Error ? e.message : String(e) })),
    zonaDelNegocio(datos.ws).catch(() => "UTC"),
  ]);
  const hoy = "error" in ingresos ? new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()) : ingresos.hoy;
  const v: VistaBilling = (VISTAS_BILLING as readonly string[]).includes(vista ?? "") ? (vista as VistaBilling) : "resumen";

  return (
    <Finance
      fecha={fechaLarga(new Date(), tz)}
      hoy={hoy}
      vista={v}
      wsPlataforma={datos.ws}
      resumen={
        "error" in ingresos
          ? null
          : {
              cifras: cifrasDe(ingresos),
              comoEntra: comoEntra(ingresos.entradas, desdeDe("12m", hoy), hoy),
              aviso: avisoDe({ pasarelas: datos.pasarelas, cobros: datos.cobros, porCobrar: ingresos.porCobrar, wsPlataforma: datos.ws }),
              entradas: ingresos.entradas,
              porCobrar: ingresos.porCobrar,
              proximos: proximosDe(ingresos),
            }
      }
      errorResumen={"error" in ingresos ? <ErrorSeccion titulo="No pude leer lo cobrado" detalle={ingresos.error} href="/admin?tab=billing" /> : null}
      pasarelas={datos.pasarelas}
      cobros={datos.cobros}
      truncado={datos.truncado}
      recibos={recibos}
      locales={locales.ok ? { moneda: locales.moneda, planes: locales.planes } : null}
      precio={precio.ok ? precio.precio : null}
      emisor={recibos.ok ? recibos.emisor : null}
      waSolo={recibos.ok ? recibos.waSolo : false}
    />
  );
}

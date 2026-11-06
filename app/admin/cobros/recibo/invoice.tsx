"use client";
// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/invoice/page.tsx e
// _components/invoice.tsx.

// =============================================================================
// Billing › Cargar pago — el recibo de plata que entra por FUERA de la pasarela, como la factura de Studio (6/11/2026)
// =============================================================================
// El formulario a la izquierda y la vista previa a la derecha; arriba, «Save as Draft» y «Send Invoice» → «Emitir sin enviar» y
// «Emitir y enviar». El `formId` se genera al abrir y viaja en cada intento: un doble clic no da dos recibos (lib/recibos.ts,
// `emitirReciboManual`, con la clave `form:<uuid>`). Lo que importa lo valida el servidor; acá se avisa antes.
// ⚠️ No marca meses pagados ni escribe cuotas: eso es de la rama de agencias (docs/relevo/nube-recibos.md).

import * as React from "react";

import { ArrowLeft, Save, Send } from "lucide-react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import Link, { useRouter } from "@/app/_ui/Link";
import { reportarASoporte } from "@/app/_ui/ReportarASoporte";
import { Button } from "@/app/admin/_studio/components/ui/button";
import type { Emisor } from "@/lib/recibos-reglas";

import { cargarPagoAction } from "../recibos-actions";
import { pedidoDe, problemaDe, type ReciboForm, valoresIniciales } from "./data";
import { InvoiceForm } from "./invoice-form";
import { InvoicePreview } from "./invoice-preview";

const nuevoId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16).padStart(8, "0")}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;

const fallo = (texto: string) => toast.error(texto, { action: { label: "Reportar a Soporte", onClick: () => reportarASoporte({ error: texto }) } });

export function Invoice({ cuentas, planes, emisor, hoy }: {
  cuentas: Array<{ id: number; nombre: string }>;
  planes: Array<{ nombre: string; precioUsd: number }>;
  emisor: Emisor;
  hoy: string;
}) {
  const router = useRouter();
  const [formId] = React.useState(nuevoId);
  const form = useForm<ReciboForm>({ defaultValues: valoresIniciales(hoy) });
  const recibo = useWatch({ control: form.control }) as ReciboForm;
  const [subiendo, setSubiendo] = React.useState<ReadonlySet<string>>(new Set());
  const [enviando, setEnviando] = React.useState<"enviar" | "sin" | null>(null);
  const [emitido, setEmitido] = React.useState<{ id: number; numero: number } | null>(null);

  async function subir(pagoId: string, archivo: File) {
    setSubiendo((s) => new Set(s).add(pagoId));
    const fd = new FormData();
    fd.append("archivo", archivo);
    const r = (await fetch("/api/admin/recibos/comprobante", { method: "POST", body: fd })
      .then(async (res) => (res.ok ? res.json() : { ok: false, error: (await res.json().catch(() => null))?.error ?? "No pude subir el comprobante." }))
      .catch(() => ({ ok: false, error: "No pude subir el comprobante." }))) as { ok: boolean; path?: string; nombre?: string; error?: string };
    setSubiendo((s) => {
      const n = new Set(s);
      n.delete(pagoId);
      return n;
    });
    const i = form.getValues("pagos").findIndex((p) => p.id === pagoId);
    if (r.ok && r.path && i >= 0) form.setValue(`pagos.${i}.comprobante`, { path: r.path, nombre: r.nombre ?? archivo.name });
    else if (!r.ok) fallo(r.error ?? "No pude subir el comprobante.");
  }

  async function emitir(enviar: boolean) {
    const f = form.getValues();
    const problema = problemaDe(f, subiendo.size > 0);
    if (problema) {
      toast.error(problema);
      return;
    }
    setEnviando(enviar ? "enviar" : "sin");
    const r = await cargarPagoAction(pedidoDe(f, formId, enviar)).catch(() => ({ ok: false as const, error: "No pude emitir el recibo." }));
    setEnviando(null);
    if (!r.ok) {
      fallo(r.error);
      return;
    }
    setEmitido({ id: r.id, numero: r.numero });
    const n = String(r.numero).padStart(4, "0");
    toast.success(r.yaEstaba ? `Ya estaba: recibo N.º ${n}` : `${enviar ? "Emitido y enviado" : "Emitido sin enviar"}: N.º ${n}`, {
      description: "aviso" in r && r.aviso ? r.aviso : undefined,
      action: { label: "Ver los recibos", onClick: () => router.push("/admin?tab=billing&vista=recibos") },
    });
    router.refresh();
  }

  const cuenta = cuentas.find((c) => String(c.id) === recibo.cuenta)?.nombre ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <Link prefetch={false} href="/admin?tab=billing&vista=recibos" className="text-muted-foreground mb-1 flex w-fit items-center gap-1 text-sm hover:underline">
            <ArrowLeft className="size-4" />
            Recibos
          </Link>
          <h1 className="text-3xl leading-none font-medium tracking-tight">Cargar pago</h1>
          <p className="text-muted-foreground text-sm">El recibo de lo que entró por fuera de la pasarela: revisa la vista previa y emítelo.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" disabled={!!enviando} onClick={() => void emitir(false)}>
            <Save data-icon="inline-start" />
            {enviando === "sin" ? "Emitiendo…" : "Emitir sin enviar"}
          </Button>
          <Button type="button" disabled={!!enviando} onClick={() => void emitir(true)}>
            <Send data-icon="inline-start" />
            {enviando === "enviar" ? "Emitiendo…" : "Emitir y enviar"}
          </Button>
        </div>
      </div>

      <FormProvider {...form}>
        <form className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2" noValidate onSubmit={(event) => event.preventDefault()}>
          <InvoiceForm cuentas={cuentas} planes={planes} subiendo={subiendo} onSubir={(id, a) => void subir(id, a)} />
          <InvoicePreview recibo={recibo} emisor={emisor} cuenta={cuenta} numero={emitido?.numero ?? null} hoy={hoy} emitido={emitido} />
        </form>
      </FormProvider>
    </div>
  );
}

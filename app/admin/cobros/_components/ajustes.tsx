// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. El botón «Settings» de su dashboard/finance abre acá
// su Sheet (src/components/ui/sheet.tsx), con sus campos (field, input-group, switch).
"use client";

// =============================================================================
// Billing › Ajustes — lo que se configura una vez para cobrar (6/11/2026)
// =============================================================================
// En Studio, «Settings» no hace nada. Acá abre lo que antes eran tres tarjetas sueltas de Billing:
//   · el precio de cada plan en la moneda de la Mercado Pago de MaKo (sin él, /planes no la ofrece: nunca se inventa una tasa);
//   · lo que paga una agencia por cada cliente (#866);
//   · los «Datos del recibo» (el emisor: nunca se inventa un dato fiscal) y «WhatsApp a quien paga solo».

import * as React from "react";

import { Eye } from "lucide-react";
import { toast } from "sonner";

import { reportarASoporte } from "@/app/_ui/ReportarASoporte";
import { Button } from "@/app/admin/_studio/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/app/admin/_studio/components/ui/field";
import { Input } from "@/app/admin/_studio/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/app/admin/_studio/components/ui/input-group";
import { Separator } from "@/app/admin/_studio/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/app/admin/_studio/components/ui/sheet";
import { Switch } from "@/app/admin/_studio/components/ui/switch";
import type { PrecioClienteAgencia } from "@/lib/agencia-cobro-reglas";
import type { Emisor } from "@/lib/recibos-reglas";
import { formatoMonto } from "@/lib/pasarela-moneda";

import { guardarPrecioClienteAgenciaAction, guardarPrecioLocalAction, type PrecioLocalPlan } from "../actions";
import { guardarEmisorAction, guardarWaSoloAction } from "../recibos-actions";

const fallo = (texto: string) => toast.error(texto, { action: { label: "Reportar a Soporte", onClick: () => reportarASoporte({ error: texto }) } });

export function Ajustes({ abierto, onAbierto, locales, precio, conMercadoPago, emisor, waSolo }: {
  abierto: boolean;
  onAbierto: (v: boolean) => void;
  /** La moneda de la Mercado Pago de MaKo (null = no conectada) y los planes. null = no se pudo leer. */
  locales: { moneda: string | null; planes: PrecioLocalPlan[] } | null;
  precio: PrecioClienteAgencia | null;
  conMercadoPago: boolean;
  emisor: Emisor | null;
  waSolo: boolean;
}) {
  return (
    <Sheet open={abierto} onOpenChange={onAbierto}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Ajustes</SheetTitle>
          <SheetDescription>Precios y datos del recibo.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-6">
          {locales?.moneda && <PreciosMp moneda={locales.moneda} planes={locales.planes} />}
          {precio && <ClienteAgencia inicial={precio} conMercadoPago={conMercadoPago} />}
          {emisor && <DatosRecibo inicial={emisor} waSolo={waSolo} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Titulo({ children, detalle }: { children: React.ReactNode; detalle: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="font-medium tracking-tight">{children}</h3>
      <p className="text-muted-foreground text-xs">{detalle}</p>
    </div>
  );
}

/** «130.000» y «130.000,50» son pesos con punto de miles (revisión del 23/10/2026). Vacío saca el precio. */
const numeroLocal = (s: string): number | null => {
  const x = Number(s.replace(/[\s.]/g, "").replace(",", "."));
  return s.trim() && Number.isFinite(x) && x > 0 ? x : null;
};

function PreciosMp({ moneda, planes }: { moneda: string; planes: PrecioLocalPlan[] }) {
  const [valores, setValores] = React.useState<Record<string, string>>(() => Object.fromEntries(planes.map((p) => [p.id, p.local != null ? String(p.local) : ""])));
  const [guardando, setGuardando] = React.useState<string | null>(null);

  async function guardar(id: string) {
    const texto = (valores[id] ?? "").trim();
    // Un valor que no se entiende NO borra el precio: se dice.
    if (texto && numeroLocal(texto) == null) {
      fallo("Ese precio no se entiende: escribe sólo el número.");
      return;
    }
    setGuardando(id);
    const r = await guardarPrecioLocalAction(id, numeroLocal(texto)).catch(() => ({ ok: false as const, error: "No pude guardar el precio." }));
    setGuardando(null);
    if (!r.ok) fallo(r.error);
    else toast.success("Precio guardado");
  }

  return (
    <section className="flex flex-col gap-3">
      <Titulo detalle={`Su precio por mes en ${moneda}. Sin precio, ese plan sólo se paga con tarjeta, en dólares.`}>Planes en Mercado Pago</Titulo>
      <FieldGroup className="gap-3">
        {planes
          .filter((p) => p.activo)
          .map((p) => (
            <Field key={p.id} orientation="horizontal" className="items-end">
              <div className="flex flex-1 flex-col gap-1">
                <FieldLabel className="text-xs" htmlFor={`mp-${p.id}`}>
                  {p.nombre} · {formatoMonto(p.precioUsd, "USD")}
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id={`mp-${p.id}`}
                    inputMode="decimal"
                    placeholder="Sin cargar"
                    value={valores[p.id] ?? ""}
                    onChange={(e) => setValores((v) => ({ ...v, [p.id]: e.target.value }))}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>{moneda}</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </div>
              <Button variant="outline" size="sm" disabled={guardando === p.id} onClick={() => void guardar(p.id)}>
                Guardar
              </Button>
            </Field>
          ))}
      </FieldGroup>
      <Separator />
    </section>
  );
}

function ClienteAgencia({ inicial, conMercadoPago }: { inicial: PrecioClienteAgencia; conMercadoPago: boolean }) {
  const [usd, setUsd] = React.useState(String(inicial.usd));
  const [monto, setMonto] = React.useState(inicial.mp ? String(inicial.mp.monto) : "");
  const [moneda, setMoneda] = React.useState(inicial.mp?.moneda ?? "ARS");
  const [guardando, setGuardando] = React.useState(false);
  const n = (s: string): number | null => {
    const x = Number(s.replace(",", "."));
    return s.trim() && Number.isFinite(x) && x > 0 ? x : null;
  };

  async function guardar() {
    const u = n(usd);
    if (u == null) {
      fallo("El precio en dólares tiene que ser mayor a cero.");
      return;
    }
    setGuardando(true);
    const r = await guardarPrecioClienteAgenciaAction({ usd: u, moneda, monto: n(monto) }).catch(() => ({ ok: false as const, error: "No pude guardar el precio." }));
    setGuardando(false);
    if (!r.ok) fallo(r.error);
    else toast.success("Precio guardado");
  }

  return (
    <section className="flex flex-col gap-3">
      <Titulo detalle={`Lo que paga una agencia por cada cliente, cada mes. ${conMercadoPago ? "Se cobra con tu Mercado Pago." : "Conecta Mercado Pago para cobrarlo."}`}>
        Cliente de agencia
      </Titulo>
      <div className="grid grid-cols-3 gap-3">
        <Field className="gap-1">
          <FieldLabel className="text-xs" htmlFor="ag-usd">
            Por mes (USD)
          </FieldLabel>
          <Input id="ag-usd" inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} />
        </Field>
        <Field className="gap-1">
          <FieldLabel className="text-xs" htmlFor="ag-mp">
            En Mercado Pago
          </FieldLabel>
          <Input id="ag-mp" inputMode="decimal" placeholder="Sin cargar" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </Field>
        <Field className="gap-1">
          <FieldLabel className="text-xs" htmlFor="ag-moneda">
            Moneda
          </FieldLabel>
          <Input id="ag-moneda" maxLength={3} value={moneda} onChange={(e) => setMoneda(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button size="sm" disabled={guardando} onClick={() => void guardar()}>
          Guardar el precio
        </Button>
      </div>
      <Separator />
    </section>
  );
}

function DatosRecibo({ inicial, waSolo }: { inicial: Emisor; waSolo: boolean }) {
  const [base, setBase] = React.useState<Emisor>(inicial);
  const [e, setE] = React.useState<Emisor>(inicial);
  const [wa, setWa] = React.useState(waSolo);
  const [guardando, setGuardando] = React.useState(false);
  const cambio = JSON.stringify(e) !== JSON.stringify(base);

  async function guardar() {
    setGuardando(true);
    const r = await guardarEmisorAction(e).catch(() => ({ ok: false as const, error: "No pude guardar." }));
    setGuardando(false);
    if (!r.ok) {
      fallo(r.error);
      return;
    }
    setBase(r.emisor);
    setE(r.emisor);
    toast.success("Datos guardados");
  }
  async function cambiarWa(v: boolean) {
    setWa(v);
    const r = await guardarWaSoloAction(v).catch(() => ({ ok: false as const, error: "No pude guardar." }));
    if (!r.ok) {
      setWa(!v);
      fallo(r.error);
    }
  }
  const campo = (k: keyof Emisor, label: string, ayuda?: string) => (
    <Field className="gap-1">
      <FieldLabel className="text-xs" htmlFor={`emisor-${k}`}>
        {label}
      </FieldLabel>
      <Input id={`emisor-${k}`} value={e[k] ?? ""} maxLength={k === "intro" ? 400 : 200} onChange={(ev) => setE((x) => ({ ...x, [k]: ev.target.value }))} />
      {ayuda && <FieldDescription className="text-xs">{ayuda}</FieldDescription>}
    </Field>
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <Titulo detalle="Salen en cada recibo y en su correo.">Datos del recibo</Titulo>
        <Button variant="ghost" size="sm" asChild>
          <a href="/api/admin/recibos/ejemplo" target="_blank" rel="noopener noreferrer">
            <Eye data-icon="inline-start" />
            Ver ejemplo
          </a>
        </Button>
      </div>
      <FieldGroup className="gap-3">
        {campo("nombre", "Nombre")}
        {campo("documento", "Documento", "Vacío no se imprime.")}
        {campo("direccion", "Dirección")}
        {campo("correo", "Correo de contacto")}
        {campo("asunto", "Asunto del correo", "Puedes usar {{numero}} y {{nombre}}.")}
        {campo("intro", "Primera frase del correo", "Con {{monto}}, {{concepto}}, {{fecha}} y {{medio}}.")}
      </FieldGroup>
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={wa} onCheckedChange={(v) => void cambiarWa(v)} />
          WhatsApp a quien paga solo
        </label>
        <Button size="sm" disabled={!cambio || guardando} onClick={() => void guardar()}>
          Guardar
        </Button>
      </div>
    </section>
  );
}

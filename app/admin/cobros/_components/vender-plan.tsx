// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Hecho con sus piezas (Dialog, Field, Select, InputGroup).
"use client";

// =============================================================================
// «Vender un plan» — el link de pago de un plan de MaKo, en el diálogo de Studio (6/11/2026)
// =============================================================================
// Lo abre «Vender un plan» (el «Quick Transfer» de Studio, con el monto ya escrito) y el atajo. Al pagarse, lib/cobros.ts crea
// la cuenta sola con ese plan. Studio no tiene esta pieza: se arma con su Dialog y sus campos (docs/relevo/nube-admin-copia.md).
//
// ⚠️ LA PASARELA VA ANTES DEL MONTO: la moneda depende de ella (Mercado Pago cobra SÓLO en la de su cuenta).
// ⚠️ LOS PLANES SON `CAPAS_VENDIBLES`, nunca el catálogo entero: la capa `superadmin` no es un plan (tests/admin-cobros.test.ts),
//    y la action lo vuelve a preguntar.

import * as React from "react";

import { Check, Copy } from "lucide-react";

import { useRouter } from "@/app/_ui/Link";
import { ReportarASoporte } from "@/app/_ui/ReportarASoporte";
import { Button } from "@/app/admin/_studio/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/admin/_studio/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/app/admin/_studio/components/ui/field";
import { Input } from "@/app/admin/_studio/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from "@/app/admin/_studio/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/app/admin/_studio/components/ui/select";
import { CAPAS_VENDIBLES } from "@/lib/capas";
import { NOMBRE_PASARELA, type Pasarela, type TipoCobro } from "@/lib/cobros-tipos";
import { formatoMonto } from "@/lib/pasarela-moneda";

import { venderPlanAction } from "../actions";

/** Lo que Stripe cobra desde acá. Mercado Pago no elige: cobra en la moneda de su cuenta. */
const MONEDAS_STRIPE = ["USD", "MXN", "EUR"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function VenderPlan({ abierto, onAbierto, pasarelas, montoInicial }: {
  abierto: boolean;
  onAbierto: (v: boolean) => void;
  /** Las pasarelas conectadas en el workspace de la plataforma (sin ninguna no se abre). */
  pasarelas: Pasarela[];
  /** El monto que se escribió en «Vender un plan», si se escribió. */
  montoInicial?: string;
}) {
  const router = useRouter();
  const [capa, setCapa] = React.useState<string>("");
  const [pasarela, setPasarela] = React.useState<Pasarela | "">("");
  const [tipo, setTipo] = React.useState<TipoCobro>("suscripcion");
  const [monto, setMonto] = React.useState("");
  const [moneda, setMoneda] = React.useState<string>("USD");
  const [montoUsd, setMontoUsd] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [nombre, setNombre] = React.useState("");
  const [refCodigo, setRefCodigo] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hecho, setHecho] = React.useState<{ link: string; monto: number; moneda: string } | null>(null);
  const [copiado, setCopiado] = React.useState<"si" | "no" | null>(null);

  // Cada vez que se abre, de cero (con el monto que trajo «Vender un plan»).
  React.useEffect(() => {
    if (!abierto) return;
    setCapa(""); setPasarela(""); setTipo("suscripcion"); setMonto(montoInicial ?? ""); setMoneda("USD"); setMontoUsd("");
    setEmail(""); setNombre(""); setRefCodigo(""); setError(null); setHecho(null); setCopiado(null);
  }, [abierto, montoInicial]);

  // Con UNA pasarela no se pregunta: es ésa.
  const efectiva: Pasarela | null = pasarelas.length === 1 ? pasarelas[0] : pasarela || null;
  const enMp = efectiva === "mercadopago";
  const monedaFinal: string | null = enMp ? null : moneda;
  const pideUsd = monedaFinal !== "USD";
  const montoNum = Number(monto.replace(",", "."));
  const listo = !!capa && !!efectiva && Number.isFinite(montoNum) && montoNum > 0 && EMAIL_RE.test(email.trim()) && nombre.trim().length > 1;

  async function crear() {
    if (!listo) {
      setError("Falta el plan, la pasarela, el monto, el email o el nombre.");
      return;
    }
    setPending(true);
    setError(null);
    const usd = Number(montoUsd.replace(",", "."));
    const r = await venderPlanAction({
      capa, monto: montoNum, moneda: monedaFinal, tipo,
      montoUsd: pideUsd && Number.isFinite(usd) && usd > 0 ? usd : null,
      email: email.trim(), nombre: nombre.trim(), pasarela: efectiva, refCodigo: refCodigo.trim() || null,
    }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "No pude crear el link." }));
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setHecho({ link: r.link, monto: r.monto, moneda: r.moneda });
    // La lista de cobros es del server: que se vuelva a leer con el nuevo.
    router.refresh();
  }

  async function copiar() {
    if (!hecho) return;
    try {
      await navigator.clipboard.writeText(hecho.link);
      setCopiado("si");
    } catch {
      setCopiado("no");
    }
  }

  const planNombre = CAPAS_VENDIBLES.find((c) => c.id === capa)?.nombre ?? "";

  return (
    <Dialog open={abierto} onOpenChange={(v) => !pending && onAbierto(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{hecho ? "Link listo" : "Vender un plan"}</DialogTitle>
          <DialogDescription>
            {hecho
              ? `${planNombre} · ${formatoMonto(hecho.monto, hecho.moneda)}${tipo === "suscripcion" ? " por mes" : ""} · ${nombre.trim()}`
              : "Al pagar, MaKo crea su cuenta y le manda el acceso."}
          </DialogDescription>
        </DialogHeader>

        {hecho ? (
          <div className="flex flex-col gap-2">
            <InputGroup>
              <InputGroupInput readOnly value={hecho.link} onFocus={(e) => e.currentTarget.select()} aria-label="Link de pago" />
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" onClick={() => void copiar()} aria-label="Copiar el link">
                  {copiado === "si" ? <Check /> : <Copy />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {copiado === "no" && <p className="text-muted-foreground text-xs">No pude copiarlo: selecciónalo y cópialo a mano.</p>}
          </div>
        ) : (
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="gap-1">
                <FieldLabel className="text-xs">Plan</FieldLabel>
                <Select value={capa} onValueChange={setCapa}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elige el plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {CAPAS_VENDIBLES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field className="gap-1">
                <FieldLabel className="text-xs">Cada cuánto</FieldLabel>
                <Select value={tipo} onValueChange={(v) => setTipo(v as TipoCobro)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="suscripcion">Todos los meses</SelectItem>
                      <SelectItem value="unico">Una vez</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {pasarelas.length > 1 && (
                <Field className="gap-1">
                  <FieldLabel className="text-xs">Pasarela</FieldLabel>
                  <Select value={pasarela} onValueChange={(v) => setPasarela(v as Pasarela)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Con qué cobras" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {pasarelas.map((p) => (
                          <SelectItem key={p} value={p}>
                            {NOMBRE_PASARELA[p]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
              {!enMp && (
                <Field className="gap-1">
                  <FieldLabel className="text-xs">Moneda</FieldLabel>
                  <Select value={moneda} onValueChange={setMoneda}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {MONEDAS_STRIPE.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="gap-1">
                <FieldLabel className="text-xs" htmlFor="vp-monto">
                  Monto
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput id="vp-monto" inputMode="decimal" placeholder="0.00" value={monto} onChange={(e) => setMonto(e.target.value)} />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>{enMp ? "su moneda" : moneda}</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              {pideUsd && (
                // Sin el valor en dólares el cobro sale igual, pero no entra al cash del CRM: nunca se inventa una tasa.
                <Field className="gap-1">
                  <FieldLabel className="text-xs" htmlFor="vp-usd">
                    Equivale a (opcional)
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput id="vp-usd" inputMode="decimal" placeholder="0.00" value={montoUsd} onChange={(e) => setMontoUsd(e.target.value)} />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>USD</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="gap-1">
                <FieldLabel className="text-xs" htmlFor="vp-email">
                  Email
                </FieldLabel>
                <Input id="vp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field className="gap-1">
                <FieldLabel className="text-xs" htmlFor="vp-nombre">
                  Nombre
                </FieldLabel>
                <Input id="vp-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </Field>
            </div>
            <Field className="gap-1">
              <FieldLabel className="text-xs" htmlFor="vp-ref">
                Código de partner (si lo trajo alguien)
              </FieldLabel>
              <Input id="vp-ref" value={refCodigo} onChange={(e) => setRefCodigo(e.target.value)} />
            </Field>
            {error && (
              <div role="alert" className="text-destructive flex flex-col items-start gap-2 text-sm">
                <p>{error}</p>
                <ReportarASoporte error={error} />
              </div>
            )}
          </FieldGroup>
        )}

        <DialogFooter>
          {hecho ? (
            <Button type="button" onClick={() => onAbierto(false)}>
              Listo
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={pending} onClick={() => onAbierto(false)}>
                Cancelar
              </Button>
              <Button type="button" disabled={pending} onClick={() => void crear()}>
                {pending ? "Creando…" : "Crear el link"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

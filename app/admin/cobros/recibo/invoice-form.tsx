"use client";
// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/invoice/_components/invoice-form.tsx.
// Las tres pestañas de Studio (Invoice, Payment, Business, que allá no cambian nada) → Recibo, Pago y Notas, que muestran cada
// parte del formulario. Las secciones van separadas como en Studio.

import * as React from "react";

import { useFormContext } from "react-hook-form";

import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/app/admin/_studio/components/ui/field";
import { Separator } from "@/app/admin/_studio/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/app/admin/_studio/components/ui/tabs";
import { Textarea } from "@/app/admin/_studio/components/ui/textarea";

import { ClientSelector } from "./client-selector";
import type { ReciboForm } from "./data";
import { InvoiceItems } from "./invoice-items";
import { InvoicePayments } from "./invoice-payments";

type Parte = "recibo" | "pago" | "notas";

export function InvoiceForm({ cuentas, planes, subiendo, onSubir }: {
  cuentas: Array<{ id: number; nombre: string }>;
  planes: Array<{ nombre: string; precioUsd: number }>;
  subiendo: ReadonlySet<string>;
  onSubir: (pagoId: string, archivo: File) => void;
}) {
  const [parte, setParte] = React.useState<Parte>("recibo");
  const { register } = useFormContext<ReciboForm>();

  return (
    <div className="bg-card flex flex-col gap-4 rounded-xl border p-4">
      <Tabs value={parte} onValueChange={(v) => setParte(v as Parte)}>
        <TabsList className="w-full">
          <TabsTrigger value="recibo">Recibo</TabsTrigger>
          <TabsTrigger value="pago">Pago</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
        </TabsList>
      </Tabs>

      {parte === "recibo" && (
        <>
          <ClientSelector cuentas={cuentas} />
          <Separator />
          <InvoiceItems planes={planes} />
        </>
      )}

      {parte === "pago" && <InvoicePayments subiendo={subiendo} onSubir={onSubir} />}

      {parte === "notas" && (
        <section className="flex flex-col gap-4">
          <h2 className="font-medium tracking-tight">Notas</h2>
          <FieldGroup className="gap-4">
            <Field className="gap-1">
              <FieldLabel className="text-xs" htmlFor="nota-pdf">
                Nota del PDF (opcional)
              </FieldLabel>
              <Textarea id="nota-pdf" placeholder="Cubre hasta el 4/12." maxLength={500} {...register("notaPdf")} />
            </Field>
            <Field className="gap-1">
              <FieldLabel className="text-xs" htmlFor="nota-interna">
                Nota interna (opcional)
              </FieldLabel>
              <Textarea id="nota-interna" maxLength={500} {...register("notaInterna")} />
              <FieldDescription className="text-xs">Sólo se ve aquí.</FieldDescription>
            </Field>
          </FieldGroup>
          <Separator />
          <p className="text-muted-foreground text-xs">Le llega por correo a los admins de la cuenta, y al grupo de MaKo si la cuenta no es de una agencia.</p>
        </section>
      )}
    </div>
  );
}

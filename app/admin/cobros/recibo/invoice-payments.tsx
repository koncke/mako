"use client";
// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Hecho con las piezas de
// src/app/(main)/dashboard/invoice/_components/invoice-details.tsx (su DatePicker, copiado) e invoice-adjustments.tsx (sus campos).
// Studio no tiene «cómo se pagó»: MaKo lo necesita para el recibo de lo que entra por fuera de la pasarela (Binance, una
// transferencia), con su referencia y la foto del comprobante. Va en la pestaña «Pago» del formulario.

import * as React from "react";

import { format, parseISO } from "date-fns";
import { es as esFecha } from "date-fns/locale";
import { CalendarIcon, ImageUp, Plus, Trash2 } from "lucide-react";
import { es } from "react-day-picker/locale";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { Button } from "@/app/admin/_studio/components/ui/button";
import { Calendar } from "@/app/admin/_studio/components/ui/calendar";
import { Field, FieldGroup, FieldLabel } from "@/app/admin/_studio/components/ui/field";
import { Input } from "@/app/admin/_studio/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/admin/_studio/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/app/admin/_studio/components/ui/select";
import { Separator } from "@/app/admin/_studio/components/ui/separator";
import { MEDIOS, ROTULO_MEDIO, ROTULO_REFERENCIA, type MedioRecibo } from "@/lib/recibos-reglas";

import { MONEDAS, nuevoIdFila, type ReciboForm } from "./data";

export function InvoicePayments({ subiendo, onSubir }: { subiendo: ReadonlySet<string>; onSubir: (pagoId: string, archivo: File) => void }) {
  const { control, register, getValues } = useFormContext<ReciboForm>();
  const { append, fields, remove } = useFieldArray({ control, name: "pagos", keyName: "fieldKey" });
  const pagos = useWatch({ control, name: "pagos" }) ?? [];

  function sumarPago() {
    const ultimo = getValues("pagos").at(-1);
    append({
      id: nuevoIdFila("p"),
      medio: ultimo?.medio ?? "binance",
      referencia: "",
      fecha: ultimo?.fecha ?? "",
      hora: ultimo?.hora ?? "12:00",
      monto: Number.NaN,
      moneda: ultimo?.moneda ?? "USDT",
      de: "",
      comprobante: null,
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium tracking-tight">Cómo se pagó</h2>
        <Button type="button" variant="ghost" size="sm" onClick={sumarPago}>
          <Plus data-icon="inline-start" />
          Sumar otro pago
        </Button>
      </div>

      {fields.map((f, i) => {
        const p = pagos[i];
        const medio = (p?.medio ?? "binance") as MedioRecibo;
        return (
          <div key={f.fieldKey} className="flex flex-col gap-3">
            {i > 0 && <Separator />}
            <FieldGroup className="gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Controller
                  control={control}
                  name={`pagos.${i}.medio`}
                  render={({ field }) => (
                    <Field className="gap-1">
                      <FieldLabel className="text-xs">Medio</FieldLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {MEDIOS.map((m) => (
                              <SelectItem key={m} value={m}>
                                {ROTULO_MEDIO[m]}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
                <Field className="gap-1">
                  <FieldLabel className="text-xs" htmlFor={`ref-${f.fieldKey}`}>
                    {ROTULO_REFERENCIA[medio]}
                  </FieldLabel>
                  <Input id={`ref-${f.fieldKey}`} maxLength={200} {...register(`pagos.${i}.referencia` as const)} />
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_112px]">
                <Controller
                  control={control}
                  name={`pagos.${i}.fecha`}
                  render={({ field }) => (
                    <Field className="gap-1">
                      <FieldLabel className="text-xs" htmlFor={`fecha-${f.fieldKey}`}>
                        Fecha
                      </FieldLabel>
                      <DatePicker id={`fecha-${f.fieldKey}`} value={field.value} onChange={field.onChange} />
                    </Field>
                  )}
                />
                <Field className="gap-1">
                  <FieldLabel className="text-xs" htmlFor={`hora-${f.fieldKey}`}>
                    Hora
                  </FieldLabel>
                  <Input id={`hora-${f.fieldKey}`} type="time" {...register(`pagos.${i}.hora` as const)} />
                </Field>
              </div>

              <div className="grid grid-cols-[1fr_112px] gap-3">
                <Field className="gap-1">
                  <FieldLabel className="text-xs" htmlFor={`monto-${f.fieldKey}`}>
                    Monto
                  </FieldLabel>
                  <Input id={`monto-${f.fieldKey}`} type="number" step="0.01" {...register(`pagos.${i}.monto` as const, { valueAsNumber: true })} />
                </Field>
                <Controller
                  control={control}
                  name={`pagos.${i}.moneda`}
                  render={({ field }) => (
                    <Field className="gap-1">
                      <FieldLabel className="text-xs">Moneda</FieldLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {MONEDAS.map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
              </div>

              <Field className="gap-1">
                <FieldLabel className="text-xs" htmlFor={`de-${f.fieldKey}`}>
                  De (opcional)
                </FieldLabel>
                <Input id={`de-${f.fieldKey}`} maxLength={120} {...register(`pagos.${i}.de` as const)} />
              </Field>

              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                <Button type="button" variant="outline" size="sm" asChild disabled={subiendo.has(f.id)}>
                  <label className="cursor-pointer">
                    <ImageUp data-icon="inline-start" />
                    {subiendo.has(p?.id ?? "") ? "Subiendo…" : p?.comprobante ? "Cambiar la foto" : "Subir la foto"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      hidden
                      onChange={(e) => {
                        const archivo = e.target.files?.[0];
                        if (archivo && p) onSubir(p.id, archivo);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </Button>
                <span className="min-w-0 flex-1 truncate">{p?.comprobante ? p.comprobante.nombre : "JPEG o PNG, hasta 4 MB."}</span>
                {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Quitar el pago ${i + 1}`} onClick={() => remove(i)}>
                    <Trash2 />
                  </Button>
                )}
              </div>
            </FieldGroup>
          </div>
        );
      })}
    </section>
  );
}

/** El DatePicker de Studio (invoice-details.tsx), con el calendario y la fecha en español. */
function DatePicker({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const date = parseDateValue(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" data-empty={!date} className="data-[empty=true]:text-muted-foreground w-full justify-between text-left font-normal">
          {date ? format(date, "PPP", { locale: esFecha }) : <span>Elige la fecha</span>}
          <CalendarIcon className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Calendar
          className="w-full"
          mode="single"
          locale={es}
          selected={date}
          onSelect={(selectedDate) => {
            if (!selectedDate) return;

            onChange(format(selectedDate, "yyyy-MM-dd"));
            setOpen(false);
          }}
          defaultMonth={date}
        />
      </PopoverContent>
    </Popover>
  );
}

function parseDateValue(value: string) {
  const date = parseISO(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

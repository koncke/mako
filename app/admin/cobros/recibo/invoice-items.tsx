// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/invoice/_components/invoice-items.tsx.
// «Invoice Items» → qué se pagó: un renglón por concepto (se arrastran para ordenarlos, como en Studio). Units, Unit cost y
// Line total → Mes, Importe y el importe en su moneda (un renglón de MaKo no tiene cantidad). La moneda es UNA por recibo.
// «Add Item» suma un renglón vacío o el de un plan con su precio (el atajo de la pantalla de antes).
"use client";

import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { cn } from "cn";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import type { UseFormRegister } from "react-hook-form";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { Button } from "@/app/admin/_studio/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/app/admin/_studio/components/ui/dropdown-menu";
import { Input } from "@/app/admin/_studio/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/app/admin/_studio/components/ui/select";
import { formatoMonto } from "@/lib/pasarela-moneda";

import { type LineaForm, MONEDAS, nuevoIdFila, type ReciboForm } from "./data";

export function InvoiceItems({ planes }: { planes: Array<{ nombre: string; precioUsd: number }> }) {
  const { control, register, setValue, getValues } = useFormContext<ReciboForm>();
  const { append, fields, move, remove } = useFieldArray({
    control,
    name: "lineas",
    keyName: "fieldKey",
  });
  const items = useWatch({ control, name: "lineas" }) ?? [];
  const moneda = useWatch({ control, name: "moneda" });

  function handleDragEnd(event: DragEndEvent) {
    const { source } = event.operation;

    if (event.canceled || !isSortable(source) || source.initialIndex === source.index) {
      return;
    }

    move(source.initialIndex, source.index);
  }

  function sumarPlan(p: { nombre: string; precioUsd: number }) {
    // Un renglón vacío se reemplaza; el plan va en dólares.
    const vacios = getValues("lineas").map((l, i) => (!l.concepto.trim() && !Number.isFinite(l.monto) ? i : -1)).filter((i) => i >= 0);
    for (const i of vacios.reverse()) remove(i);
    setValue("moneda", "USD");
    append({ id: nuevoIdFila("l"), concepto: `Plan ${p.nombre}`, mes: "", monto: p.precioUsd });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium tracking-tight whitespace-nowrap">Qué se pagó</h2>
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="moneda"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger size="sm" className="w-24" aria-label="Moneda de los renglones">
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
            )}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm">
                <Plus data-icon="inline-start" />
                Sumar un renglón
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => append({ id: nuevoIdFila("l"), concepto: "", mes: getValues("lineas").at(-1)?.mes ?? "", monto: Number.NaN })}>
                Renglón vacío
              </DropdownMenuItem>
              {planes.length > 0 && <DropdownMenuSeparator />}
              {planes.map((p) => (
                <DropdownMenuItem key={p.nombre} onSelect={() => sumarPlan(p)}>
                  Plan {p.nombre} · {formatoMonto(p.precioUsd, "USD")}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-muted-foreground hidden items-center gap-2 px-1 text-xs font-medium md:grid md:grid-cols-[24px_minmax(0,1fr)_72px_96px_96px_32px]">
          <span />
          <span>Concepto</span>
          <span className="px-2">Mes</span>
          <span className="px-2">Importe</span>
          <span className="text-right">Total</span>
          <span />
        </div>

        <DragDropProvider onDragEnd={handleDragEnd}>
          <div className="flex flex-col gap-3">
            {fields.map((field, index) => (
              <SortableInvoiceItemRow
                key={field.fieldKey}
                id={field.fieldKey}
                index={index}
                item={items[index]}
                moneda={moneda}
                register={register}
                puedeQuitar={fields.length > 1}
                onRemove={() => remove(index)}
              />
            ))}
          </div>
        </DragDropProvider>
      </div>
    </section>
  );
}

function SortableInvoiceItemRow({
  id,
  index,
  item,
  moneda,
  register,
  puedeQuitar,
  onRemove,
}: {
  id: string;
  index: number;
  item?: LineaForm;
  moneda: string;
  register: UseFormRegister<ReciboForm>;
  puedeQuitar: boolean;
  onRemove: () => void;
}) {
  const { handleRef, isDragging, ref } = useSortable({
    id,
    index,
    type: "invoice-item",
    accept: "invoice-item",
    group: "invoice-items",
    modifiers: [RestrictToVerticalAxis],
  });

  return (
    <div
      ref={ref}
      className={cn(
        "grid min-w-0 grid-cols-[24px_minmax(0,0.8fr)_minmax(0,1fr)_32px] items-center gap-2 rounded-lg md:grid-cols-[24px_minmax(0,1fr)_72px_96px_96px_32px]",
        isDragging && "relative z-10 opacity-50",
      )}
    >
      <Button
        ref={handleRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground -ml-2 cursor-grab active:cursor-grabbing"
        aria-label={`Mover el renglón ${index + 1}`}
      >
        <GripVertical />
      </Button>
      <Input
        className="min-w-0 text-sm max-md:col-span-3"
        aria-label={`Concepto del renglón ${index + 1}`}
        maxLength={200}
        {...register(`lineas.${index}.concepto` as const)}
      />
      <Input
        className="text-sm max-md:col-start-2 max-md:row-start-2"
        placeholder="nov"
        aria-label={`Mes del renglón ${index + 1}`}
        maxLength={40}
        {...register(`lineas.${index}.mes` as const)}
      />
      <Input
        type="number"
        step="0.01"
        className="text-sm max-md:col-start-3 max-md:row-start-2"
        aria-label={`Importe del renglón ${index + 1}`}
        {...register(`lineas.${index}.monto` as const, { valueAsNumber: true })}
      />
      <div className="min-w-0 text-right text-sm font-medium max-md:col-span-3 max-md:col-start-2 max-md:row-start-3 max-md:flex max-md:items-center max-md:justify-between max-md:text-left">
        <span className="text-muted-foreground hidden max-md:inline">Total</span>
        <span>{formatoMonto(item && Number.isFinite(item.monto) ? item.monto : 0, moneda)}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="max-md:col-start-4 max-md:row-start-2"
        aria-label={`Quitar el renglón ${index + 1}`}
        disabled={!puedeQuitar}
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

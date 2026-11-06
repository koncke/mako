"use client";
// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/invoice/_components/client-selector.tsx
// e invoice-details.tsx (su campo de referencia). «Billed To» → la cuenta de MaKo que pagó, y «A nombre de»: así sale en el
// recibo (con la cuenta elegida se completa solo; se corrige si hace falta). «Add New Client» no va: una cuenta nace de su alta.

import { UserRound } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";

import { Avatar, AvatarFallback } from "@/app/admin/_studio/components/ui/avatar";
import { Field, FieldDescription, FieldLabel } from "@/app/admin/_studio/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/app/admin/_studio/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/app/admin/_studio/components/ui/select";
import { getInitials } from "@/app/admin/_studio/lib/utils";

import type { ReciboForm } from "./data";

export function ClientSelector({ cuentas }: { cuentas: Array<{ id: number; nombre: string }> }) {
  const { control, register, getValues, setValue } = useFormContext<ReciboForm>();

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium tracking-tight">¿De quién?</h2>
      </div>

      <Controller
        control={control}
        name="cuenta"
        render={({ field }) => {
          const elegida = cuentas.find((c) => String(c.id) === field.value);
          return (
            <Field className="gap-1">
              <FieldLabel className="text-xs">Cuenta</FieldLabel>
              <Select
                value={field.value}
                onValueChange={(id) => {
                  const antes = cuentas.find((c) => String(c.id) === field.value)?.nombre ?? "";
                  const aNombre = getValues("aNombre");
                  field.onChange(id);
                  // Se completa sola sólo si no la escribieron a mano.
                  if (!aNombre.trim() || aNombre === antes) setValue("aNombre", cuentas.find((c) => String(c.id) === id)?.nombre ?? "");
                }}
              >
                <SelectTrigger className="w-full data-[size=default]:h-auto">
                  <SelectValue placeholder="Elige la cuenta">
                    {elegida && (
                      <div className="flex items-center gap-1.5">
                        <Avatar className="after:rounded-md">
                          <AvatarFallback className="bg-card text-foreground rounded-md">{getInitials(elegida.nombre).slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="text-left text-xs">
                          <div>{elegida.nombre}</div>
                          <div className="text-muted-foreground">ws {elegida.id}</div>
                        </div>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-80">
                  <SelectGroup>
                    {cuentas.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          );
        }}
      />

      <Field className="gap-1">
        <FieldLabel className="text-xs" htmlFor="a-nombre">
          A nombre de
        </FieldLabel>
        <InputGroup>
          <InputGroupInput id="a-nombre" maxLength={200} {...register("aNombre")} />
          <InputGroupAddon align="inline-end">
            <UserRound />
          </InputGroupAddon>
        </InputGroup>
        <FieldDescription className="text-xs">Así sale en el recibo. Revisa tildes y apellidos.</FieldDescription>
      </Field>
    </section>
  );
}

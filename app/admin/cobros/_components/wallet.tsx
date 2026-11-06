// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/finance/_components/wallet.tsx.
// «Wallet» de Studio → las pasarelas de MaKo: arriba las conectadas (sus tarjetas de banco), abajo los otros medios por los que
// entró plata en 12 meses (sus cripto). El pie de Studio («Physical Vault», «Air-Gapped») no tiene nada de MaKo y se sacó.
import { Banknote, CircleDollarSign, Landmark } from "lucide-react";
import { siBinance, siMercadopago, siStripe } from "simple-icons";

import { SimpleIcon } from "@/app/admin/_studio/components/simple-icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/admin/_studio/components/ui/card";
import { Separator } from "@/app/admin/_studio/components/ui/separator";
import type { Entrada } from "@/lib/admin-ingresos-reglas";
import type { Pasarela } from "@/lib/cobros-tipos";

import { desdeDe, nombreMedio, porMedio, usd } from "../billing-vista";

const MARCA = { stripe: siStripe, mercadopago: siMercadopago, binance: siBinance } as const;
const ICONO = { transferencia: Landmark, efectivo: Banknote } as const;

function Icono({ medio }: { medio: string }) {
  if (medio in MARCA) return <SimpleIcon icon={MARCA[medio as keyof typeof MARCA]} />;
  const Lucide = ICONO[medio as keyof typeof ICONO] ?? CircleDollarSign;
  return <Lucide className="size-5" />;
}

function Fila({ titulo, detalle, medio }: { titulo: string; detalle: string; medio: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-foreground text-sm leading-none font-medium">{titulo}</span>
        </div>
        <span className="text-muted-foreground text-xs font-normal">{detalle}</span>
      </div>
      <div className="bg-background flex size-9 shrink-0 items-center justify-center rounded-md border">
        <Icono medio={medio} />
      </div>
    </div>
  );
}

export function Wallet({ pasarelas, entradas, hoy }: { pasarelas: Pasarela[]; entradas: Entrada[]; hoy: string }) {
  const porcion = new Map(porMedio(entradas, desdeDe("12m", hoy), hoy).map((p) => [p.id, p.usd]));
  const otros = [...porcion.keys()].filter((m) => m !== "otros" && m !== "sin-medio" && !pasarelas.includes(m as Pasarela));
  const en12 = (m: string) => (porcion.get(m) ? `${usd(porcion.get(m) ?? 0)} en 12 meses` : "Nada en 12 meses");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">Pasarelas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-4">
          {pasarelas.length === 0 ? (
            <p className="text-muted-foreground text-sm">Ninguna conectada.</p>
          ) : (
            pasarelas.map((p) => <Fila key={p} titulo={`${nombreMedio(p)} • conectada`} detalle={en12(p)} medio={p} />)
          )}
        </div>

        {otros.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-4">
              {otros.map((m) => (
                <Fila key={m} titulo={`${nombreMedio(m)} • a mano`} detalle={en12(m)} medio={m} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

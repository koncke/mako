// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/finance/_components/finance-notification.tsx.
// La tarjeta del aviso de Studio → lo que más espera a Martín (billing-vista.ts → avisoDe). Sin nada que esperar, no se dibuja.
import Link from "@/app/_ui/Link";
import { Button } from "@/app/admin/_studio/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/app/admin/_studio/components/ui/item";
import { CircleAlert, Plug, UserX } from "lucide-react";

import type { Aviso } from "../billing-vista";

const ICONO = { "sin-pasarela": Plug, alta: UserX, atrasado: CircleAlert } as const;

export function FinanceNotification({ aviso }: { aviso: Aviso | null }) {
  if (!aviso) return null;
  const Icono = ICONO[aviso.id];
  return (
    <Item className="rounded-xl" variant="outline">
      <ItemMedia variant="icon">
        <Icono />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{aviso.titulo}</ItemTitle>
        <ItemDescription>{aviso.detalle}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="sm" variant="outline" asChild>
          <Link prefetch={false} href={aviso.href}>
            {aviso.accion}
          </Link>
        </Button>
      </ItemActions>
    </Item>
  );
}

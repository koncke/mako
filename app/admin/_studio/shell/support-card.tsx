// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.
// El lugar de la tarjeta del pie del sidebar de Studio Admin (src/app/(main)/dashboard/_components/sidebar/support-card.tsx,
// la del autor pidiendo ideas): la MISMA tarjeta, con lo que espera a Martín (quién quiere entrar, qué pidieron las
// agencias). Antes era el cartel de arriba de las pestañas (30/10/2026). Sin nada que esperar, no se dibuja.

import Link from "@/app/_ui/Link"
import { Card, CardDescription, CardHeader, CardTitle } from "@/app/admin/_studio/components/ui/card"
import { RUTA_QUIEREN_ENTRAR } from "@/lib/pedidos-ingreso-reglas"

export function SupportCard({ texto }: { texto: string | null }) {
  if (!texto) return null
  return (
    <Card size="sm" className="overflow-hidden shadow-none group-data-[collapsible=icon]:hidden">
      <CardHeader className="min-w-0 px-4">
        <CardTitle className="truncate text-sm">Te esperan</CardTitle>
        <CardDescription className="line-clamp-3">
          <Link prefetch={false} href={RUTA_QUIEREN_ENTRAR} className="text-foreground hover:underline">
            {texto}
          </Link>
        </CardDescription>
      </CardHeader>
    </Card>
  )
}

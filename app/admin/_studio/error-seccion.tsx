// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.
// Lo que dibuja una sección de Admin cuando no pudo leer lo suyo: el `Empty` de Studio Admin (MIT, src/components/ui/
// empty.tsx) con el error y «Volver a cargar», como aviso (`role="alert"`) con «Reportar a Soporte» (AGENTS.md, todo aviso de
// error lo lleva).

import { CircleAlert } from "lucide-react"

import Link from "@/app/_ui/Link"
import { ReportarASoporte } from "@/app/_ui/ReportarASoporte"
import { Button } from "@/app/admin/_studio/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/app/admin/_studio/components/ui/empty"

export function ErrorSeccion({ titulo, detalle, href }: { titulo: string; detalle: string; href: string }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3">
      <Empty className="w-full border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CircleAlert />
          </EmptyMedia>
          <EmptyTitle>{titulo}</EmptyTitle>
          <EmptyDescription>{detalle}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild size="sm" variant="outline">
            <Link prefetch={false} href={href}>Volver a cargar</Link>
          </Button>
        </EmptyContent>
      </Empty>
      <ReportarASoporte error={`${titulo}: ${detalle}`} />
    </div>
  )
}

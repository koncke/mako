'use client'

// No está en Polar (Polar no reenvía recibos): «Reenviar» es del libro de recibos de MaKo (lib/recibos.ts, `reenviarRecibo`), y lo
// pidió Martín (6/11/2026). Va como los modales de Polar (InlineModal, a la derecha). Un lote nuevo a los mismos correos (o a otro)
// y, si el recibo no es «sólo correo», también al grupo de MaKo de su cuenta. Sólo un recibo emitido se reenvía.

import { useState } from 'react'
import { useRouter } from '@/app/_ui/Link'
import type { ReciboVenta } from '@/app/admin/_polar/datos/ventas'
import { reenviarReciboAction } from '@/app/admin/cobros/recibos-actions'
import { ROTULO_CORREO, ROTULO_WA } from '@/lib/recibos-reglas'
import { Button, Checkbox, InlineModalHeader, Input, Text } from '@/app/admin/_polar/orbit'
import { AvisoDeError, AvisoHecho } from './Aviso'

export const ResendReceiptModal = ({ recibo, hide }: { recibo: ReciboVenta; hide: () => void }) => {
  const router = useRouter()
  const [correo, setCorreo] = useState('')
  const [whatsapp, setWhatsapp] = useState(!recibo.soloCorreo)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)
  const numero = String(recibo.numero).padStart(4, '0')

  const reenviar = async () => {
    setEnviando(true)
    setError(null)
    const r = await reenviarReciboAction(recibo.id, { correo: correo.trim() || null, whatsapp }).catch(() => ({ ok: false as const, error: 'No pude reenviar el recibo.' }))
    setEnviando(false)
    if (!r.ok) return setError(r.error)
    setHecho(`Correo: ${ROTULO_CORREO[r.correo] ?? r.correo}${whatsapp && !recibo.soloCorreo ? ` · WhatsApp: ${ROTULO_WA[r.whatsapp] ?? r.whatsapp}` : ''}`)
    router.refresh()
  }

  return (
    <div className="flex flex-col">
      <InlineModalHeader hide={hide}>
        <h2>Reenviar el recibo N.º {numero}</h2>
      </InlineModalHeader>
      <div className="flex flex-col gap-y-6 px-8 pb-8">
        <Text color="muted">
          Sale otra vez por correo a {recibo.correoA.length ? recibo.correoA.join(', ') : 'los admins de su cuenta'}
          {recibo.soloCorreo ? '.' : ', y al grupo de su cuenta si lo marcas.'}
        </Text>
        <div className="flex flex-col gap-y-2">
          <label htmlFor="reenviar-correo" className="text-sm">Otro correo (opcional)</label>
          <Input id="reenviar-correo" type="email" placeholder="ana@ejemplo.com" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </div>
        {!recibo.soloCorreo && (
          <Checkbox checked={whatsapp} onCheckedChange={(v) => setWhatsapp(v === true)} label="También al grupo de WhatsApp de su cuenta" />
        )}
        <AvisoDeError texto={error} />
        <AvisoHecho texto={hecho} />
        <div className="flex flex-row gap-x-4">
          <Button onClick={reenviar} loading={enviando} disabled={enviando || !!hecho}>
            Reenviar
          </Button>
          <Button variant="ghost" onClick={hide} disabled={enviando}>
            {hecho ? 'Cerrar' : 'No cambiar nada'}
          </Button>
        </div>
      </div>
    </div>
  )
}

'use client'

// «Habilitado sin cobro» (19/11/2026): el interruptor de super admin por negocio. Ver lib/cuenta-sin-cobro-reglas.ts. La server action llega por prop
// (la ficha no la importa, como `desconectar`). Antes de APAGAR pide confirmar en una línea.

import { Alert, Text } from '@/app/admin/_polar/orbit'
import { Switch } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { ConfirmModal } from '@/app/admin/_polar/web/Modal/ConfirmModal'
import { TEXTO_CONFIRMAR_APAGAR, TEXTO_SIN_COBRO, TEXTO_SIN_COBRO_DE_HECHO, habilitadoSinCobro, textoDelApagado, type SinCobro } from '@/lib/cuenta-sin-cobro-reglas'
import { useState } from 'react'

export type PonerSinCobro = (ws: number, activo: boolean) => Promise<{ ok: true; sinCobro: SinCobro } | { ok: false; error: string }>

export const CustomerSinCobro = ({ ws, inicial, paga = null, poner }: { ws: number; inicial: SinCobro | null; paga?: boolean | null; poner: PonerSinCobro }) => {
  const [estado, setEstado] = useState<SinCobro | null>(inicial)
  const [confirmando, setConfirmando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Nunca tocado y sin pagar por ninguna vía (P2P, cargado a mano): entra sin cobro DE HECHO, así que el interruptor se ve prendido y apagarlo es
  // lo que lo pasa a la prueba (19/11/2026, Martín: «si desactivo eso, simplemente entra en la configuración de siempre»).
  const deHecho = estado == null && paga === false
  const prendido = habilitadoSinCobro(estado) || deHecho

  async function guardar(activo: boolean) {
    setGuardando(true)
    const r = await poner(ws, activo).catch(() => ({ ok: false as const, error: 'No pude guardarlo. Prueba otra vez.' }))
    setGuardando(false)
    if (!r.ok) { setError(r.error); return }
    setError(null)
    setEstado(r.sinCobro)
  }

  return (
    <Box as="section" flexDirection="column" rowGap="s">
      <Text as="h3">Cobro</Text>
      <Box alignItems="center" justifyContent="between" columnGap="l">
        <Box flexDirection="column" rowGap="xs">
          <Text>Habilitado sin cobro</Text>
          <Text variant="caption" color="muted">
            {deHecho ? TEXTO_SIN_COBRO_DE_HECHO : prendido ? TEXTO_SIN_COBRO : estado ? textoDelApagado(estado) : paga ? 'Paga su lugar (su plan, su mensualidad o su agencia): no hace falta tocarlo.' : 'Sin tocar: como hasta hoy.'}
          </Text>
        </Box>
        <Switch
          aria-label="Habilitado sin cobro"
          checked={prendido}
          disabled={guardando}
          onCheckedChange={(v) => { if (v) void guardar(true); else setConfirmando(true) }}
        />
      </Box>
      {error && <Alert variant="danger" title="No se guardó" description={error} onDismiss={() => setError(null)} />}
      <ConfirmModal
        isShown={confirmando}
        hide={() => setConfirmando(false)}
        title="¿Apagar «Habilitado sin cobro»?"
        description={TEXTO_CONFIRMAR_APAGAR}
        confirmText="Apagar"
        cancelText="Dejarlo prendido"
        onConfirm={() => { setConfirmando(false); void guardar(false) }}
      />
    </Box>
  )
}

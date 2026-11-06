'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Settings/OrganizationPaymentSettings.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Settings › Payments: los precios con que MaKo cobra, con los grupos y los renglones de ajustes de Polar
// (`SettingsGroup` / `SettingsGroupItem`: el nombre a la izquierda, el control a la derecha).
//   · «Mercado Pago»: el precio de cada plan activo en la moneda de la Mercado Pago de MaKo (`guardarPrecioLocalAction`).
//     Sin ese precio, /planes no ofrece Mercado Pago para ese plan: nunca se inventa una tasa.
//   · «Cliente de agencia»: lo que paga una agencia por cada cliente, en dólares y en Mercado Pago
//     (`guardarPrecioClienteAgenciaAction`).
// ⚠️ GUARDA AL SALIR DEL CAMPO, NO CON LA DEMORA DE POLAR (`useAutoSave` a 200 ms): un precio a medio escribir («1» de
//    «130000») se guardaría y saldría en /planes. Un valor que no se entiende NO borra el precio: se dice.
// ⚠️ LO QUE SE SACÓ: la moneda por defecto y el comportamiento de impuestos de Polar (MaKo cobra en dólares por Stripe y en
//    la moneda de su cuenta por Mercado Pago, sin elegirla; no calcula impuestos).

import { guardarPrecioClienteAgenciaAction, guardarPrecioLocalAction } from '@/app/admin/cobros/actions'
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte'
import { Alert, Input, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { useRouter } from '@/app/_ui/Link'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import React, { useState } from 'react'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'
import { numeroLocal, numeroSimple, type DatosPagos, type PrecioClienteAgencia, type PrecioPlanLocal } from '@/app/admin/_polar/datos/ajustes'

const usd = (n: number) => formatCurrency('statistics')(Math.round(n * 100), 'usd')

function Fallo({ texto }: { texto: string }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2">
      <Text color="error">{texto}</Text>
      <ReportarASoporte error={texto} />
    </div>
  )
}

function PrecioDePlan({ plan, moneda }: { plan: PrecioPlanLocal; moneda: string }) {
  const router = useRouter()
  const [valor, setValor] = useState(plan.local != null ? String(plan.local) : '')
  const [guardado, setGuardado] = useState(plan.local != null ? String(plan.local) : '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    if (valor.trim() === guardado.trim()) return
    const n = numeroLocal(valor)
    if (n === undefined) {
      setError('Ese precio no se entiende: escribe sólo el número.')
      return
    }
    setGuardando(true)
    const r = await guardarPrecioLocalAction(plan.id, n).catch(() => ({ ok: false as const, error: 'No pude guardar el precio.' }))
    setGuardando(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setError(null)
    setGuardado(valor)
    router.refresh()
  }

  return (
    <SettingsGroupItem title={plan.nombre} description={`${usd(plan.precioUsd)} por mes en dólares.`}>
      <Box flexDirection="column" rowGap="s" width="100%">
        <Input
          aria-label={`Precio de ${plan.nombre} en ${moneda}`}
          inputMode="decimal"
          placeholder="Sin cargar"
          value={valor}
          disabled={guardando}
          onChange={(e) => setValor(e.target.value)}
          onBlur={() => void guardar()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void guardar()
          }}
          postSlot={<span className="dark:text-polar-500 text-xs text-gray-500">{moneda}</span>}
        />
        {error && <Fallo texto={error} />}
      </Box>
    </SettingsGroupItem>
  )
}

function ClienteDeAgencia({ inicial, conMercadoPago }: { inicial: PrecioClienteAgencia; conMercadoPago: boolean }) {
  const router = useRouter()
  const [usdTxt, setUsdTxt] = useState(String(inicial.usd))
  const [monto, setMonto] = useState(inicial.mp ? String(inicial.mp.monto) : '')
  const [moneda, setMoneda] = useState(inicial.mp?.moneda ?? 'ARS')
  const [guardado, setGuardado] = useState(JSON.stringify([String(inicial.usd), inicial.mp ? String(inicial.mp.monto) : '', inicial.mp?.moneda ?? 'ARS']))
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    const ahora = JSON.stringify([usdTxt.trim(), monto.trim(), moneda])
    if (ahora === guardado) return
    const u = numeroSimple(usdTxt)
    if (u == null) {
      setError('El precio en dólares tiene que ser mayor a cero.')
      return
    }
    const m = numeroSimple(monto)
    if (m === undefined) {
      setError('El monto en Mercado Pago no se entiende: escribe sólo el número.')
      return
    }
    if (m != null && !/^[A-Z]{3}$/.test(moneda)) {
      setError('La moneda son tres letras (ARS, MXN…).')
      return
    }
    const r = await guardarPrecioClienteAgenciaAction({ usd: u, moneda, monto: m }).catch(() => ({ ok: false as const, error: 'No pude guardar el precio.' }))
    if (!r.ok) {
      setError(r.error)
      return
    }
    setError(null)
    setGuardado(ahora)
    router.refresh()
  }

  const alSalir = () => void guardar()
  const conEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void guardar()
  }

  return (
    <SettingsGroup
      title="Cliente de agencia"
      description={`Lo que paga una agencia por cada cliente, cada mes. ${conMercadoPago ? 'Se cobra con la Mercado Pago de MaKo.' : 'Conecta Mercado Pago para cobrarlo.'}`}
    >
      <SettingsGroupItem title="Por mes, en dólares">
        <Input aria-label="Por mes, en dólares" inputMode="decimal" value={usdTxt} onChange={(e) => setUsdTxt(e.target.value)} onBlur={alSalir} onKeyDown={conEnter} postSlot={<span className="dark:text-polar-500 text-xs text-gray-500">USD</span>} />
      </SettingsGroupItem>
      <SettingsGroupItem title="En Mercado Pago" description="Sin este monto no sale el link del primer mes: no se inventa una tasa.">
        <Box columnGap="s" width="100%">
          <Input aria-label="Monto en Mercado Pago" inputMode="decimal" placeholder="Sin cargar" value={monto} onChange={(e) => setMonto(e.target.value)} onBlur={alSalir} onKeyDown={conEnter} />
          <Input
            aria-label="Moneda de Mercado Pago"
            className="w-20"
            maxLength={3}
            value={moneda}
            onChange={(e) => setMoneda(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            onBlur={alSalir}
            onKeyDown={conEnter}
          />
        </Box>
      </SettingsGroupItem>
      {error ? (
        <Box paddingHorizontal="xl" paddingVertical="l">
          <Fallo texto={error} />
        </Box>
      ) : null}
    </SettingsGroup>
  )
}

const OrganizationPaymentSettings: React.FC<{ datos: DatosPagos }> = ({ datos }) => {
  const { locales } = datos
  const activos = locales?.planes.filter((p) => p.activo) ?? []

  return (
    <Box flexDirection="column" rowGap="2xl">
      {!locales ? (
        <Box flexDirection="column" rowGap="s">
          <Alert variant="danger" title="No pude leer los precios de los planes" description={datos.errorLocales ?? undefined} />
          {datos.errorLocales && <ReportarASoporte error={datos.errorLocales} />}
        </Box>
      ) : !locales.moneda ? (
        <SettingsGroup title="Mercado Pago">
          <SettingsGroupItem title="No está conectada" description="Sin ella, los planes se pagan sólo con tarjeta, en dólares." />
        </SettingsGroup>
      ) : (
        <SettingsGroup title="Mercado Pago" description={`El precio de cada plan por mes, en ${locales.moneda}. Sin precio, ese plan se paga sólo con tarjeta, en dólares.`}>
          {activos.map((p) => (
            <PrecioDePlan key={p.id} plan={p} moneda={locales.moneda as string} />
          ))}
        </SettingsGroup>
      )}

      {datos.precioAgencia ? (
        <ClienteDeAgencia inicial={datos.precioAgencia} conMercadoPago={datos.conMercadoPago} />
      ) : (
        <Box flexDirection="column" rowGap="s">
          <Alert variant="danger" title="No pude leer el precio del cliente de agencia" description={datos.errorAgencia ?? undefined} />
          {datos.errorAgencia && <ReportarASoporte error={datos.errorAgencia} />}
        </Box>
      )}
    </Box>
  )
}

export default OrganizationPaymentSettings

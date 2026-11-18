'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Settings/OrganizationPaymentSettings.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Settings › Payments: los precios con que MaKo cobra, con los grupos y los renglones de ajustes de Polar
// (`SettingsGroup` / `SettingsGroupItem`: el nombre a la izquierda, el control a la derecha).
//   · «Mercado Pago»: el precio de cada plan activo en la moneda de la Mercado Pago de MaKo (`guardarPrecioLocalAction`).
//     Sin ese precio, /planes no ofrece Mercado Pago para ese plan: nunca se inventa una tasa.
//     En pesos, con el cartel del dólar blue (`CARTEL_DEL_BLUE`, 16/11/2026): un cron los pone al día todos los días, no pisa uno
//     cambiado a mano (se apaga solo y avisa) y se apaga con un ajuste. Sin el cartel, un precio puesto acá parecía quedar fijo.
//   · «Cliente de agencia»: lo que paga una agencia por cada cliente, en dólares y en Mercado Pago
//     (`guardarPrecioClienteAgenciaAction`).
// ⚠️ GUARDA AL SALIR DEL CAMPO, NO CON LA DEMORA DE POLAR (`useAutoSave` a 200 ms): un precio a medio escribir («1» de
//    «130000») se guardaría y saldría en /planes. Un valor que no se entiende NO borra el precio: se dice.
// ⚠️ Y DICE QUE GUARDÓ (punto 16 de la revisión del 6/11/2026): «Guardado», en gris, dos segundos en la misma fila
//    (`marcaDeGuardado`). Estos precios salen en /planes, y sin la marca la pantalla no cambiaba: no se distinguía «se guardó»
//    de «no pasó nada». Los errores, con el `Alert` de Orbit (punto 42).
// ⚠️ LO QUE SE SACÓ: la moneda por defecto y el comportamiento de impuestos de Polar (MaKo cobra en dólares por Stripe y en
//    la moneda de su cuenta por Mercado Pago, sin elegirla; no calcula impuestos).

import { guardarPagoDirectoAction, guardarPrecioClienteAgenciaAction, guardarPrecioLocalAction } from '@/app/admin/cobros/actions'
import type { DatosDePagoDirecto } from '@/lib/pago-directo-reglas'
import { Alert, Input, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { useRouter } from '@/app/_ui/Link'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { CARTEL_DEL_BLUE, MONEDA_PESOS } from '@/lib/dolar-blue-reglas'
import React, { useEffect, useState } from 'react'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'
import {
  marcaDeGuardado,
  numeroLocal,
  numeroSimple,
  type DatosPagos,
  type PrecioClienteAgencia,
  type PrecioPlanLocal,
} from '@/app/admin/_polar/datos/ajustes'

const usd = (n: number) => formatCurrency('statistics')(Math.round(n * 100), 'usd')

/** «Guardado» un rato después de guardar (la marca se limpia si la fila se va antes). */
function useMarcaDeGuardado() {
  const [visible, setVisible] = useState(false)
  const [marca] = useState(() => marcaDeGuardado(setVisible))
  useEffect(() => () => marca.limpiar(), [marca])
  return { visible, marcar: marca.marcar }
}

const Guardado = ({ visible }: { visible: boolean }) =>
  visible ? (
    <Text as="span" variant="caption" color="muted">
      Guardado
    </Text>
  ) : null

function PrecioDePlan({ plan, moneda }: { plan: PrecioPlanLocal; moneda: string }) {
  const router = useRouter()
  const [valor, setValor] = useState(plan.local != null ? String(plan.local) : '')
  const [guardado, setGuardado] = useState(plan.local != null ? String(plan.local) : '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const marca = useMarcaDeGuardado()

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
    marca.marcar()
    router.refresh()
  }

  return (
    <SettingsGroupItem title={plan.nombre} description={`${usd(plan.precioUsd)} por mes en dólares.`}>
      <Box flexDirection="column" rowGap="s" width="100%" alignItems="end">
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
        <Guardado visible={marca.visible} />
        {error && <Alert variant="danger" title="No se guardó el precio" description={error} onDismiss={() => setError(null)} />}
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
  const marca = useMarcaDeGuardado()

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
    marca.marcar()
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
        <Box flexDirection="column" rowGap="s" width="100%" alignItems="end">
          <Input aria-label="Por mes, en dólares" inputMode="decimal" value={usdTxt} onChange={(e) => setUsdTxt(e.target.value)} onBlur={alSalir} onKeyDown={conEnter} postSlot={<span className="dark:text-polar-500 text-xs text-gray-500">USD</span>} />
          <Guardado visible={marca.visible} />
        </Box>
      </SettingsGroupItem>
      <SettingsGroupItem title="En Mercado Pago" description="Sin este monto no sale el link del primer mes.">
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
          <Alert variant="danger" title="No se guardó el precio" description={error} onDismiss={() => setError(null)} />
        </Box>
      ) : null}
    </SettingsGroup>
  )
}

const CAMPOS_PAGO_DIRECTO: ReadonlyArray<{ campo: keyof DatosDePagoDirecto; titulo: string; ayuda?: string; modo?: 'text' | 'tel' | 'email' }> = [
  { campo: 'binancePayId', titulo: 'Binance Pay ID', ayuda: 'Sin él, no se ofrece pagar por Binance.' },
  { campo: 'alias', titulo: 'Alias de la Mercado Pago', ayuda: 'Con el alias o el CVU, se ofrece la transferencia.' },
  { campo: 'cvu', titulo: 'CVU' },
  { campo: 'titular', titulo: 'Titular de las cuentas' },
  { campo: 'whatsapp', titulo: 'WhatsApp para comprobantes', ayuda: 'Con el código de país, sin signos (5491122334455). Sin él no sale ese botón.', modo: 'tel' },
  { campo: 'email', titulo: 'Email de cobros', ayuda: 'Sin él no sale el botón de email.', modo: 'email' },
]

/** «Transferencia o Binance · 5% OFF» (18/11/2026): los datos que ve quien elige pagar así en /planes. Sin ninguno cargado, la opción no se muestra. */
function PagoDirecto({ inicial }: { inicial: DatosDePagoDirecto }) {
  const router = useRouter()
  const [valores, setValores] = useState<Record<keyof DatosDePagoDirecto, string>>(() => Object.fromEntries(CAMPOS_PAGO_DIRECTO.map((c) => [c.campo, inicial[c.campo] ?? ''])) as Record<keyof DatosDePagoDirecto, string>)
  const [guardado, setGuardado] = useState(JSON.stringify(valores))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const marca = useMarcaDeGuardado()

  async function guardar() {
    if (JSON.stringify(valores) === guardado) return
    setGuardando(true)
    const r = await guardarPagoDirectoAction(valores as unknown as DatosDePagoDirecto).catch(() => ({ ok: false as const, error: 'No pude guardar los datos.' }))
    setGuardando(false)
    if (!r.ok) { setError(r.error); return }
    setError(null)
    // Lo que no se entendió (un WhatsApp con pocos dígitos, un email roto) vuelve vacío: se ve que no se guardó.
    const limpio = Object.fromEntries(CAMPOS_PAGO_DIRECTO.map((c) => [c.campo, r.datos[c.campo] ?? ''])) as Record<keyof DatosDePagoDirecto, string>
    setValores(limpio)
    setGuardado(JSON.stringify(limpio))
    marca.marcar()
    router.refresh()
  }

  return (
    <SettingsGroup title="Transferencia o Binance · 5% OFF" description="Los datos que ve quien elige pagar así en el checkout, con el 5% de descuento. Sin ninguno cargado, la opción no se muestra. La activación la haces tú a mano.">
      {CAMPOS_PAGO_DIRECTO.map((c) => (
        <SettingsGroupItem key={c.campo} title={c.titulo} description={c.ayuda}>
          <Box flexDirection="column" rowGap="s" width="100%" alignItems="end">
            <Input
              aria-label={c.titulo}
              inputMode={c.modo === 'tel' ? 'tel' : c.modo === 'email' ? 'email' : 'text'}
              placeholder="Sin cargar"
              value={valores[c.campo]}
              disabled={guardando}
              onChange={(e) => setValores((v) => ({ ...v, [c.campo]: e.target.value }))}
              onBlur={() => void guardar()}
              onKeyDown={(e) => { if (e.key === 'Enter') void guardar() }}
            />
          </Box>
        </SettingsGroupItem>
      ))}
      <Box paddingHorizontal="xl" paddingVertical="l" flexDirection="column" rowGap="s">
        <Guardado visible={marca.visible} />
        {error && <Alert variant="danger" title="No se guardaron los datos" description={error} onDismiss={() => setError(null)} />}
      </Box>
    </SettingsGroup>
  )
}

const OrganizationPaymentSettings: React.FC<{ datos: DatosPagos }> = ({ datos }) => {
  const { locales } = datos
  const activos = locales?.planes.filter((p) => p.activo) ?? []

  return (
    <Box flexDirection="column" rowGap="2xl">
      {!locales ? (
        <Alert variant="danger" title="No pude leer los precios de los planes" description={datos.errorLocales ?? undefined} />
      ) : !locales.moneda ? (
        <SettingsGroup title="Mercado Pago">
          <SettingsGroupItem title="No está conectada" description="Sin ella, los planes se pagan sólo con tarjeta, en dólares." />
        </SettingsGroup>
      ) : (
        <SettingsGroup title="Mercado Pago" description={`El precio de cada plan por mes, en ${locales.moneda}. Sin precio, ese plan se paga sólo con tarjeta, en dólares.`}>
          {locales.moneda === MONEDA_PESOS ? (
            <Box paddingHorizontal="xl" paddingVertical="l">
              <Alert variant="info" title={CARTEL_DEL_BLUE.titulo} description={CARTEL_DEL_BLUE.texto} />
            </Box>
          ) : null}
          {activos.map((p) => (
            <PrecioDePlan key={p.id} plan={p} moneda={locales.moneda as string} />
          ))}
        </SettingsGroup>
      )}

      {datos.pagoDirecto ? <PagoDirecto inicial={datos.pagoDirecto} /> : <Alert variant="danger" title="No pude leer los datos de «Transferencia o Binance»" />}

      {datos.precioAgencia ? (
        <ClienteDeAgencia inicial={datos.precioAgencia} conMercadoPago={datos.conMercadoPago} />
      ) : (
        <Alert variant="danger" title="No pude leer el precio del cliente de agencia" description={datos.errorAgencia ?? undefined} />
      )}
    </Box>
  )
}

export default OrganizationPaymentSettings

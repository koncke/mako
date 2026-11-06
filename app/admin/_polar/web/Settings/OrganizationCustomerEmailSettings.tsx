'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Settings/OrganizationCustomerEmailSettings.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Settings › Customer Notifications: lo que le llega a quien paga a MaKo, con los grupos de avisos de Polar. MaKo manda UN
// aviso: el recibo de cada pago (lib/recibos.ts), por correo siempre y por WhatsApp a quien paga solo. Va en el grupo
// «Purchases» de Polar (cuyo primer aviso es la confirmación de una compra): el nombre en inglés, como las secciones.
//   · «Correo del recibo»: el asunto y la primera frase (los campos `asunto` e `intro` del `Emisor`, con `{{numero}}`,
//     `{{monto}}`, `{{concepto}}`, `{{fecha}}`, `{{medio}}` y `{{nombre}}`). Se guarda sola, un segundo después de escribir,
//     SÓLO lo que se tocó (el server lo mezcla sobre lo guardado y revalida Settings: punto 15 de la revisión del 6/11/2026), y
//     al salir antes del segundo se guarda igual (`guardadoDiferido`, punto 16).
//   · «Recibo por WhatsApp»: el interruptor (`guardarWaSoloAction`), optimista como el `useOptimisticSave` de Polar: si
//     falla, vuelve a como estaba y lo dice. Los errores, con el `Alert` de Orbit (punto 42).
// ⚠️ LO QUE SE SACÓ: los demás avisos de Polar (pruebas, renovaciones, tarjeta por vencer, cambios de la suscripción): MaKo
//    no manda ninguno de ésos a quien le paga. ⚠️ LO QUE NO ESTÁ EN LA FUENTE: los dos campos de texto del correo (Polar
//    sólo prende y apaga avisos; MaKo deja escribirlos).

import { guardarEmisorAction, guardarWaSoloAction } from '@/app/admin/cobros/recibos-actions'
import { Alert, Input, Switch, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import React, { useEffect, useRef, useState } from 'react'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'
import { cambiosDelEmisor, guardadoDiferido, type CambiosEmisor, type Emisor } from '@/app/admin/_polar/datos/ajustes'

interface OrganizationCustomerEmailSettingsProps {
  emisor: Emisor
  waSolo: boolean
}

const OrganizationCustomerEmailSettings: React.FC<OrganizationCustomerEmailSettingsProps> = ({ emisor, waSolo }) => {
  const [asunto, setAsunto] = useState(emisor.asunto ?? '')
  const [intro, setIntro] = useState(emisor.intro ?? '')
  // Lo último guardado y lo escrito, en refs: el guardado que corre al salir los lee después de que el componente se fue.
  const guardado = useRef<Emisor>(emisor)
  const escrito = useRef({ asunto: emisor.asunto ?? '', intro: emisor.intro ?? '' })
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null)

  const [guardador] = useState(() =>
    guardadoDiferido<CambiosEmisor>({
      demoraMs: 1000,
      pendiente: () => {
        const cambios = cambiosDelEmisor(guardado.current, escrito.current)
        return Object.keys(cambios).length ? cambios : null
      },
      enviar: async (cambios) => {
        const r = await guardarEmisorAction(cambios).catch(() => ({ ok: false as const, error: 'No pude guardar el correo del recibo.' }))
        if (!r.ok) {
          setErrorCorreo(r.error)
          return
        }
        setErrorCorreo(null)
        guardado.current = r.emisor
      },
    }),
  )

  useEffect(() => {
    escrito.current = { asunto, intro }
    guardador.cambio()
  }, [asunto, intro, guardador])

  // Al salir con algo pendiente, se guarda (punto 16): el cleanup aparte, que corre una vez (el guardador no cambia).
  useEffect(() => () => void guardador.salir(), [guardador])

  const [wa, setWa] = useState(waSolo)
  const [errorWa, setErrorWa] = useState<string | null>(null)
  const cambiarWa = async (v: boolean) => {
    setWa(v)
    const r = await guardarWaSoloAction(v).catch(() => ({ ok: false as const, error: 'No pude guardar el interruptor.' }))
    if (!r.ok) {
      setWa(!v)
      setErrorWa(r.error)
      return
    }
    setErrorWa(null)
  }

  return (
    <Box flexDirection="column" rowGap="2xl">
      <SettingsGroup title="Purchases">
        <SettingsGroupItem layout="stacked" title="Correo del recibo" description="Sale con cada pago. Vacío, va el texto de siempre.">
          <Box flexDirection="column" rowGap="m" width="100%">
            <Box flexDirection="column" rowGap="xs">
              <Text variant="caption" color="muted">
                Asunto (puedes usar {'{{numero}}'} y {'{{nombre}}'})
              </Text>
              <Input aria-label="Asunto del correo" value={asunto} maxLength={120} placeholder="Tu recibo de MaKo N.º {{numero}}" onChange={(e) => setAsunto(e.target.value)} />
            </Box>
            <Box flexDirection="column" rowGap="xs">
              <Text variant="caption" color="muted">
                Primera frase (con {'{{monto}}'}, {'{{concepto}}'}, {'{{fecha}}'} y {'{{medio}}'})
              </Text>
              <Input
                aria-label="Primera frase del correo"
                value={intro}
                maxLength={400}
                placeholder="Recibimos tu pago de {{monto}} por {{concepto}}, el {{fecha}}, por {{medio}}."
                onChange={(e) => setIntro(e.target.value)}
              />
            </Box>
            {errorCorreo && (
              <Alert variant="danger" title="No se guardó el correo del recibo" description={errorCorreo} onDismiss={() => setErrorCorreo(null)} />
            )}
          </Box>
        </SettingsGroupItem>
        <SettingsGroupItem layout="inline" title="Recibo por WhatsApp" description="También por WhatsApp a quien paga solo, sin una agencia en el medio.">
          <Switch checked={wa} onCheckedChange={(checked) => void cambiarWa(checked)} aria-label="Recibo por WhatsApp" />
        </SettingsGroupItem>
        {errorWa ? (
          <Box paddingHorizontal="xl" paddingVertical="l">
            <Alert variant="danger" title="No se guardó el recibo por WhatsApp" description={errorWa} onDismiss={() => setErrorWa(null)} />
          </Box>
        ) : null}
      </SettingsGroup>
    </Box>
  )
}

export default OrganizationCustomerEmailSettings

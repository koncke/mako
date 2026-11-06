'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Settings/OrganizationCustomerEmailSettings.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Settings › Customer Notifications: lo que le llega a quien paga a MaKo, con los grupos de avisos de Polar. MaKo manda UN
// aviso: el recibo de cada pago (lib/recibos.ts), por correo siempre y por WhatsApp a quien paga solo. Va en el grupo
// «Compras» (el «Purchases» de Polar, cuyo primer aviso es la confirmación de una compra).
//   · «Correo del recibo»: el asunto y la primera frase (los campos `asunto` e `intro` del `Emisor`, que pueden llevar los
//     datos de cada pago: el número, el monto, el concepto, la fecha, el medio y a nombre de quién). En pantalla esos datos
//     van con su NOMBRE (`DATOS_DEL_ASUNTO`, `DATOS_DE_LA_FRASE`) y el ejemplo con un pago de mentira ya puesto
//     (`vistaPreviaDelCorreo`); las llaves sólo existen adentro del texto guardado. Se guarda sola, un segundo después de
//     escribir, con el emisor ENTERO (`guardarEmisorAction` pisa todo: app/admin/_polar/datos/ajustes.ts).
//   · «Recibo por WhatsApp»: el interruptor (`guardarWaSoloAction`), optimista como el `useOptimisticSave` de Polar: si
//     falla, vuelve a como estaba y lo dice.
// ⚠️ LO QUE SE SACÓ: los demás avisos de Polar (pruebas, renovaciones, tarjeta por vencer, cambios de la suscripción): MaKo
//    no manda ninguno de ésos a quien le paga. ⚠️ LO QUE NO ESTÁ EN LA FUENTE: los dos campos de texto del correo (Polar
//    sólo prende y apaga avisos; MaKo deja escribirlos).

import { guardarEmisorAction, guardarWaSoloAction } from '@/app/admin/cobros/recibos-actions'
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte'
import { Input, Switch, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import React, { useEffect, useRef, useState } from 'react'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'
import {
  DATOS_DE_LA_FRASE,
  DATOS_DEL_ASUNTO,
  conDato,
  emisorConCambios,
  mismoEmisor,
  vistaPreviaDelCorreo,
  type DatoDelCorreo,
  type Emisor,
} from '@/app/admin/_polar/datos/ajustes'

/**
 * MaKo: los datos que el campo puede llevar, con su nombre (nunca con las llaves): tocar uno lo agrega al final del texto.
 * (6/11/2026: los rótulos decían «Asunto (puedes usar {{numero}} y {{nombre}})» y el ejemplo traía las llaves crudas.)
 */
function DatosQuePuedeLlevar({ datos, onAgregar }: { datos: readonly DatoDelCorreo[]; onAgregar: (marca: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Text variant="caption" color="muted">
        Agregar:
      </Text>
      {datos.map((d) => (
        <button
          key={d.marca}
          type="button"
          onClick={() => onAgregar(d.marca)}
          className="dark:border-polar-700 dark:text-polar-300 dark:hover:bg-polar-700 cursor-pointer rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-600 transition-colors hover:bg-gray-100"
        >
          {d.rotulo}
        </button>
      ))}
    </div>
  )
}

function Fallo({ texto }: { texto: string }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2">
      <Text color="error">{texto}</Text>
      <ReportarASoporte error={texto} />
    </div>
  )
}

interface OrganizationCustomerEmailSettingsProps {
  emisor: Emisor
  waSolo: boolean
}

const OrganizationCustomerEmailSettings: React.FC<OrganizationCustomerEmailSettingsProps> = ({ emisor, waSolo }) => {
  const [asunto, setAsunto] = useState(emisor.asunto ?? '')
  const [intro, setIntro] = useState(emisor.intro ?? '')
  const guardado = useRef<Emisor>(emisor)
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null)

  useEffect(() => {
    const siguiente = emisorConCambios(guardado.current, { asunto, intro })
    if (mismoEmisor(siguiente, guardado.current)) return
    const t = setTimeout(async () => {
      const r = await guardarEmisorAction(siguiente).catch(() => ({ ok: false as const, error: 'No pude guardar el correo del recibo.' }))
      if (!r.ok) {
        setErrorCorreo(r.error)
        return
      }
      setErrorCorreo(null)
      guardado.current = r.emisor
    }, 1000)
    return () => clearTimeout(t)
  }, [asunto, intro])

  // El texto de siempre con un pago de ejemplo (lo que se ve en un campo vacío) y cómo llega lo que se escribió.
  const porDefecto = vistaPreviaDelCorreo('', '')
  const previa = vistaPreviaDelCorreo(asunto, intro)

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
      <SettingsGroup title="Compras">
        <SettingsGroupItem layout="stacked" title="Correo del recibo" description="Sale con cada pago. Vacío, va el texto de siempre.">
          <Box flexDirection="column" rowGap="m" width="100%">
            <Box flexDirection="column" rowGap="xs">
              <Text variant="caption" color="muted">
                Asunto
              </Text>
              <Input aria-label="Asunto del correo" value={asunto} maxLength={120} placeholder={porDefecto.asunto} onChange={(e) => setAsunto(e.target.value)} />
              <DatosQuePuedeLlevar datos={DATOS_DEL_ASUNTO} onAgregar={(m) => setAsunto((v) => conDato(v, m))} />
            </Box>
            <Box flexDirection="column" rowGap="xs">
              <Text variant="caption" color="muted">
                Primera frase
              </Text>
              <Input
                aria-label="Primera frase del correo"
                value={intro}
                maxLength={400}
                placeholder={porDefecto.intro}
                onChange={(e) => setIntro(e.target.value)}
              />
              <DatosQuePuedeLlevar datos={DATOS_DE_LA_FRASE} onAgregar={(m) => setIntro((v) => conDato(v, m))} />
            </Box>
            {(asunto.trim() || intro.trim()) && (
              <Box flexDirection="column" rowGap="xs">
                <Text variant="caption" color="muted">
                  Así llega, con un pago de ejemplo
                </Text>
                <Text>{previa.asunto}</Text>
                <Text color="muted">{previa.intro}</Text>
              </Box>
            )}
            {errorCorreo && <Fallo texto={errorCorreo} />}
          </Box>
        </SettingsGroupItem>
        <SettingsGroupItem layout="inline" title="Recibo por WhatsApp" description="También por WhatsApp a quien paga solo, sin una agencia en el medio.">
          <Switch checked={wa} onCheckedChange={(checked) => void cambiarWa(checked)} aria-label="Recibo por WhatsApp" />
        </SettingsGroupItem>
        {errorWa ? (
          <Box paddingHorizontal="xl" paddingVertical="l">
            <Fallo texto={errorWa} />
          </Box>
        ) : null}
      </SettingsGroup>
    </Box>
  )
}

export default OrganizationCustomerEmailSettings

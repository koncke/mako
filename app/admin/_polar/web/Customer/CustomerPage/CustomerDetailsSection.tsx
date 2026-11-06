'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/CustomerDetailsSection.tsx
// (y `ClickToCopy`/`copyable` de components/Shared/ClickToCopy.tsx). Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: las mismas secciones de renglones con su filete, dos por fila desde md. Los títulos van en inglés, como los de Polar y
// el resto de la ficha (Metrics, Timeline, Subscriptions: punto 39 de la revisión del 6/11/2026); lo que dice cada renglón, en
// español. Lo que Polar pone en cada una lo reemplaza lo que un negocio de MaKo tiene:
//   · Details: su id, su nombre, su plan, su estado y su alta (Polar: id, external id, email, name, type, created);
//   · Activity (punto 27): si lo usan — el último ingreso de su equipo, sus leads (cuántos y el último) y las sesiones del agente
//     en 30 días. Es lo que mostraba la ficha anterior y ya se calcula para la lista; no es la pantalla de actividad descartada;
//   · Onboarding (en el lugar de Billing): el estado del alta, la prueba, el plan a mano y si es de una agencia. Polar pone ahí el saldo,
//     el nombre fiscal, el Tax ID, la dirección y el país: MaKo no los guarda de un negocio-cliente (se sacaron). Y lo que
//     mostraba la grilla vieja de Admin (decisión del Cerebro, 6/11/2026): el primer mes con el 50%, cómo llegó, qué quería
//     resolver y lo que dijo que había que corregir en su oferta;
//   · Integrations (en el lugar de Metadata): las integraciones que tiene conectadas y sus computadoras, cada una con
//     «Desconectar» (decisión del Cerebro, 6/11/2026; la acción del Centro, `desconectarComputadoraAction`, que vuelve a pedir
//     `puedeOperar`: el segundo factor). Sin la guarda, las computadoras no llegan a la pantalla (`'oculto'`). La acción llega
//     por prop desde la página del server (`desconectar`): esta vista no importa la server action (ver `DesconectarComputadora`),
//     y sin la prop no hay botón.
// ⚠️ `ClickToCopy` copia sin el toast de Polar (Admin no tiene un Toaster): el renglón dice «Copiado» un momento.

import type { AltaNegocio, ComputadorasDeLaFicha, ConexionNegocio, DesconectarComputadora, NegocioCabecera } from '@/app/admin/_polar/datos/cliente'
import { computadorasDeLaFicha, conexionesConectadas, textoDeLeads, textoDeSesiones } from '@/app/admin/_polar/datos/cliente'
import { Alert, Button, Grid, Status, Text } from '@/app/admin/_polar/orbit'
import { ConfirmModal } from '@/app/admin/_polar/web/Modal/ConfirmModal'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import FormattedDateTime from '@/app/admin/_polar/atoms/FormattedDateTime'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { PropsWithChildren, ReactNode, useState } from 'react'

interface CustomerDetailsSectionProps {
  negocio: NegocioCabecera
  alta: AltaNegocio
  /** `null` = no se pudieron leer. */
  conexiones: ConexionNegocio[] | null
  /** `'oculto'` = quien mira no pasa la guarda del Centro (`puedeOperar`): no se dibujan; `null` = no se pudieron leer. */
  computadoras: ComputadorasDeLaFicha
  /** «Desconectar» (la server action del Centro, que pasa la página). Sin ella, el botón no se dibuja. */
  desconectar?: DesconectarComputadora
}

const ClickToCopy = ({ children, value }: { children: ReactNode; value?: string }) => {
  const [copiado, setCopiado] = useState(false)
  const copy = async (element: HTMLElement) => {
    if (window.getSelection()?.toString()) {
      return
    }
    const text = value ?? element.textContent ?? ''
    if (!text) {
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1200)
    } catch {
      // Sin permiso para el portapapeles: el texto sigue ahí para copiarlo a mano.
    }
  }
  return (
    <Box
      as="span"
      role="button"
      tabIndex={0}
      title={copiado ? 'Copiado' : 'Toca para copiar'}
      onClick={(event) => copy(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          copy(event.currentTarget)
        }
      }}
    >
      {copiado ? 'Copiado' : children}
    </Box>
  )
}

const copyable = (value: string | null | undefined) =>
  value ? <ClickToCopy>{value}</ClickToCopy> : value

const Section = ({ title, children }: PropsWithChildren<{ title: string }>) => (
  <Box as="section" flexDirection="column" rowGap="s">
    <Text as="h3">{title}</Text>
    <Box flexDirection="column">{children}</Box>
  </Box>
)

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
  <Box
    alignItems="baseline"
    justifyContent="between"
    columnGap="m"
    paddingVertical="s"
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-secondary"
  >
    <Box flexShrink={0}>
      <Text color="muted">{label}</Text>
    </Box>
    <Box minWidth={0} justifyContent="end" textAlign="right">
      {value ? (
        <Text as="div" truncate>
          {value}
        </Text>
      ) : (
        <Text color="muted">—</Text>
      )}
    </Box>
  </Box>
)

const siNo = (v: boolean | null, si: string, no: string) =>
  v == null ? <Text as="span" color="muted">No se pudo leer</Text> : v ? si : no

// Titled sections of hairline label/value rows, side by side from md, with long values
// truncated (copying still takes the full value).
export const CustomerDetailsSection = ({
  negocio,
  alta,
  conexiones,
  computadoras,
  desconectar: desconectarAccion,
}: CustomerDetailsSectionProps) => {
  const conectadas = conexiones ? conexionesConectadas(conexiones) : null
  // La lista de computadoras se actualiza con lo que devuelve «Desconectar» (la lectura nueva de ESE negocio).
  const [pcs, setPcs] = useState<ComputadorasDeLaFicha>(computadoras)
  const [aDesconectar, setADesconectar] = useState<{ id: number; nombre: string } | null>(null)
  const [errorPc, setErrorPc] = useState<string | null>(null)
  const desconectar = async (id: number) => {
    if (!desconectarAccion) return
    setErrorPc(null)
    const r = await desconectarAccion(negocio.ws, id)
    if (!r.ok) {
      setErrorPc(r.error)
      return
    }
    setPcs(computadorasDeLaFicha(true, r.pcs))
  }

  return (
    <Grid
      templateColumns={{
        base: 'minmax(0, 1fr)',
        md: 'repeat(2, minmax(0, 1fr))',
      }}
      columnGap="3xl"
      rowGap="2xl"
      alignItems="start"
    >
      <Section title="Details">
        <Row label="ID" value={copyable(String(negocio.ws))} />
        <Row label="Nombre" value={copyable(negocio.nombre)} />
        <Row label="Plan" value={negocio.plan} />
        <Row
          label="Estado"
          value={
            <Status
              color={negocio.estado === 'pausado' ? 'gray' : 'green'}
              size="small"
              status={negocio.estado === 'pausado' ? 'Pausado' : 'Activo'}
            />
          }
        />
        <Row
          label="Creado"
          value={<FormattedDateTime datetime={alta.creado} />}
        />
      </Section>
      <Section title="Activity">
        <Row
          label="Último ingreso"
          value={
            alta.actividad.ultimoIngreso === 'no-leida' ? (
              <Text as="span" color="muted">No se pudo leer</Text>
            ) : alta.actividad.ultimoIngreso ? (
              <FormattedDateTime datetime={alta.actividad.ultimoIngreso} />
            ) : (
              'Nunca'
            )
          }
        />
        <Row label="Leads" value={textoDeLeads(alta.actividad.leads) ?? <Text as="span" color="muted">No se pudieron leer</Text>} />
        <Row
          label="Sesiones del agente"
          value={textoDeSesiones(alta.actividad.sesionesAgente) ?? <Text as="span" color="muted">No se pudieron leer</Text>}
        />
      </Section>
      <Section title="Onboarding">
        <Row
          label="Estado del alta"
          value={siNo(alta.onboardingHecho, 'Terminado', 'Sin terminar')}
        />
        <Row label="Prueba" value={siNo(alta.prueba, 'En su prueba', 'No')} />
        <Row label="Plan a mano" value={alta.planAMano} />
        <Row label="Tipo" value={alta.segmentos.join(' · ') || null} />
        <Row label="Agencia" value={alta.agencia} />
        <Row
          label="Primer mes"
          value={
            alta.primerMesUsd == null ? (
              <Text as="span" color="muted">No se pudo leer</Text>
            ) : alta.primerMesUsd === 'no' ? null : (
              `${formatCurrency('compact')(Math.round(alta.primerMesUsd * 100), 'usd')} con el 50%`
            )
          }
        />
        {alta.llegada === 'no-leida' ? (
          <Row label="Llegó por" value={<Text as="span" color="muted">No se pudo leer</Text>} />
        ) : (
          <>
            <Row label="Llegó por" value={alta.llegada?.origen ?? null} />
            <Row label="Quería resolver" value={alta.llegada?.interes ?? null} />
            {alta.llegada?.pdfNota && (
              <Row label="A corregir en su oferta" value={<span title={alta.llegada.pdfNota}>{alta.llegada.pdfNota}</span>} />
            )}
          </>
        )}
      </Section>
      <Section title="Integrations">
        {conectadas == null ? (
          <Row label="Integraciones" value={<Text as="span" color="muted">No se pudieron leer</Text>} />
        ) : conectadas.length === 0 ? (
          <Row label="Integraciones" value={null} />
        ) : (
          conectadas.map((c) => (
            <Row
              key={c.key}
              label={c.nombre}
              value={<Status color="green" size="small" status="Conectada" />}
            />
          ))
        )}
        {pcs === 'oculto' ? null : pcs == null ? (
          <Row label="Computadoras" value={<Text as="span" color="muted">No se pudieron leer</Text>} />
        ) : pcs.length === 0 ? (
          <Row label="Computadoras" value={null} />
        ) : (
          pcs.map((pc) => (
            <Row
              key={pc.id}
              label={pc.sistema ? `${pc.nombre} · ${pc.sistema}` : pc.nombre}
              value={
                // Lo único que cede es el nombre de la persona (se corta con «…»); el estado y el botón no se achican.
                <Box as="div" display="flex" flexDirection="row" alignItems="center" justifyContent="end" columnGap="s" minWidth={0}>
                  <Box minWidth={0}>
                    <Text as="span" variant="caption" color="muted" truncate>
                      {pc.persona}
                    </Text>
                  </Box>
                  <Box flexShrink={0}>
                    <Status
                      color={pc.enLinea ? 'green' : 'gray'}
                      size="small"
                      status={pc.enLinea ? 'En línea' : 'Sin conexión'}
                    />
                  </Box>
                  {desconectarAccion && (
                    <Button
                      className="shrink-0"
                      size="sm"
                      variant="secondary"
                      onClick={() => setADesconectar({ id: pc.id, nombre: pc.nombre })}
                    >
                      Desconectar
                    </Button>
                  )}
                </Box>
              }
            />
          ))
        )}
        {errorPc && (
          <Alert variant="danger" title="No se pudo desconectar" description={errorPc} onDismiss={() => setErrorPc(null)} />
        )}
        <ConfirmModal
          isShown={aDesconectar != null}
          hide={() => setADesconectar(null)}
          title={`¿Desconectar «${aDesconectar?.nombre ?? ''}»?`}
          description="Deja de trabajar con la IA de esa computadora al instante. Para volver, la persona la conecta de nuevo."
          destructive
          destructiveText="Desconectar"
          cancelText="No desconectar"
          onConfirm={() => (aDesconectar ? desconectar(aDesconectar.id) : undefined)}
        />
      </Section>
    </Grid>
  )
}

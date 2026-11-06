'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/CustomerDetailsSection.tsx
// (y `ClickToCopy`/`copyable` de components/Shared/ClickToCopy.tsx). Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: las mismas secciones de renglones con su filete, dos por fila desde md. Lo que Polar pone en cada una lo reemplaza lo
// que un negocio de MaKo tiene:
//   · Details: su id, su nombre, su plan, su estado y su alta (Polar: id, external id, email, name, type, created);
//   · Alta (en el lugar de Billing): el onboarding, la prueba, el plan a mano y si es de una agencia. Polar pone ahí el saldo,
//     el nombre fiscal, el Tax ID, la dirección y el país: MaKo no los guarda de un negocio-cliente (se sacaron);
//   · Conexiones (en el lugar de Metadata): las integraciones que tiene conectadas y sus computadoras.
// ⚠️ `ClickToCopy` copia sin el toast de Polar (Admin no tiene un Toaster): el renglón dice «Copiado» un momento.

import type { AltaNegocio, ComputadorasDeLaFicha, ConexionNegocio, NegocioCabecera } from '@/app/admin/_polar/datos/cliente'
import { conexionesConectadas } from '@/app/admin/_polar/datos/cliente'
import { Grid, Status, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import FormattedDateTime from '@/app/admin/_polar/atoms/FormattedDateTime'
import { PropsWithChildren, ReactNode, useState } from 'react'

interface CustomerDetailsSectionProps {
  negocio: NegocioCabecera
  alta: AltaNegocio
  /** `null` = no se pudieron leer. */
  conexiones: ConexionNegocio[] | null
  /** `'oculto'` = quien mira no pasa la guarda del Centro (`puedeOperar`): no se dibujan; `null` = no se pudieron leer. */
  computadoras: ComputadorasDeLaFicha
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
}: CustomerDetailsSectionProps) => {
  const conectadas = conexiones ? conexionesConectadas(conexiones) : null

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
      <Section title="Datos">
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
      <Section title="Alta">
        <Row
          label="Onboarding"
          value={siNo(alta.onboardingHecho, 'Terminado', 'Sin terminar')}
        />
        <Row label="Prueba" value={siNo(alta.prueba, 'En su prueba', 'No')} />
        <Row label="Plan a mano" value={alta.planAMano} />
        <Row label="Tipo" value={alta.segmentos.join(' · ') || null} />
        <Row label="Agencia" value={alta.agencia} />
      </Section>
      <Section title="Conexiones">
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
        {computadoras === 'oculto' ? null : computadoras == null ? (
          <Row label="Computadoras" value={<Text as="span" color="muted">No se pudieron leer</Text>} />
        ) : computadoras.length === 0 ? (
          <Row label="Computadoras" value={null} />
        ) : (
          computadoras.map((pc) => (
            <Row
              key={pc.id}
              label={pc.sistema ? `${pc.nombre} · ${pc.sistema}` : pc.nombre}
              value={
                <Box as="span" alignItems="center" columnGap="xs">
                  <Text as="span" variant="caption" color="muted">
                    {pc.persona}
                  </Text>
                  <Status
                    color={pc.enLinea ? 'green' : 'gray'}
                    size="small"
                    status={pc.enLinea ? 'En línea' : 'Sin conexión'}
                  />
                </Box>
              }
            />
          ))
        )}
      </Section>
    </Grid>
  )
}

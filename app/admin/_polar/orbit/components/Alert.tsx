// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/packages/orbit/src/components/Alert.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: TODO AVISO DE ERROR LLEVA «Reportar a Soporte» (AGENTS.md). El de `variant="danger"` lo trae solo, al final de su
// descripción, con el título y lo que dice la descripción (`textoDeAviso`, ./alert-texto.ts); un aviso que dice que algo no se
// pudo leer (un `warning`) lo pide con `soporte`, y un `danger` que no es un error (una urgencia) lo apaga con `soporte={false}`.
// Así el botón vive en UN lugar y no se repite al lado de cada aviso. El «Dismiss» de Polar, en español.

import {
  CircleAlert,
  CircleCheck,
  Info,
  LoaderCircle,
  type LucideIcon,
  TriangleAlert,
  X,
} from '../icons'
import type { CSSProperties, ReactNode } from 'react'
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte'
import { textoDeAviso } from './alert-texto'
import { Box } from './Box'
import { ButtonGroup, type ButtonGroupActions } from './ButtonGroup'
import { Grid } from './Grid'
import { GridItem } from './GridItem'
import { Text, type TextColor } from './Text'

export type AlertVariant = 'info' | 'warning' | 'danger' | 'success'

// The variant is the only styling lever: it picks the icon and its accent
// color so callers never reach for an icon or a color token.
const variantStyles: Record<
  AlertVariant,
  {
    icon: LucideIcon
    accentColor: TextColor
  }
> = {
  info: {
    icon: Info,
    accentColor: 'default',
  },
  warning: {
    icon: TriangleAlert,
    accentColor: 'warning',
  },
  danger: {
    icon: CircleAlert,
    accentColor: 'danger',
  },
  success: {
    icon: CircleCheck,
    accentColor: 'success',
  },
}

export interface AlertProps {
  /**
   * Picks the icon and its accent color in one go. Use it to map the
   * alert to its meaning rather than styling icon and colors by hand.
   */
  variant?: AlertVariant
  /**
   * The headline of the alert, in the default text color.
   */
  title: string
  /**
   * Supporting copy shown beneath the title. Accepts inline elements (links,
   * bold text, …), not just a plain string. Omit for a title-only alert.
   */
  description?: ReactNode
  /**
   * Swaps the variant icon for a spinner, for an alert whose subject is still
   * resolving. Colors and layout are unchanged.
   */
  loading?: boolean
  /**
   * Called when the dismiss button is pressed. Provide it to render a dismiss
   * button; omit it for a persistent alert.
   */
  onDismiss?: () => void
  /**
   * One or two call-to-action buttons, rendered bottom-right via ButtonGroup.
   * The first is the primary action, the second a quieter ghost button.
   */
  actions?: ButtonGroupActions
  /**
   * MaKo: si lleva «Reportar a Soporte». Por default, sólo `danger` (un error). Un `warning` de «no pude leer» lo pide con
   * `true`; un `danger` que no es un error, con `false`.
   */
  soporte?: boolean
}

// A button has no Box equivalent, so the dismiss control is a native button
// with its chrome reset; the grid places it and the Box inside carries the
// visible icon, its color and the hover affordance.
const dismissResetStyle: CSSProperties = {
  display: 'inline-flex',
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  color: 'inherit',
}

// Collapsing the color-bearing span to a flex box drops the inline-SVG baseline
// gap, so the icon's box is exactly its 16px and the grid can center it cleanly
// against the title.
const iconBoxStyle: CSSProperties = { display: 'flex' }

// Styling is intentionally closed: no `className` escape hatch. The variant
// abstracts away the icon and every color decision.
export const Alert = ({
  variant = 'info',
  title,
  description,
  loading,
  onDismiss,
  actions,
  soporte,
}: AlertProps) => {
  const { icon: VariantIcon, accentColor } = variantStyles[variant]
  const Icon = loading ? LoaderCircle : VariantIcon
  const conSoporte = soporte ?? variant === 'danger'

  return (
    <Grid
      templateColumns={onDismiss ? 'auto 1fr auto' : 'auto 1fr'}
      columnGap="m"
      rowGap="xs"
      alignItems="center"
      backgroundColor="background-secondary"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
      borderRadius="m"
      paddingVertical="l"
      paddingHorizontal="xl"
      flexGrow={1}
    >
      <Text as="span" color={accentColor} style={iconBoxStyle}>
        <Icon
          size={16}
          aria-hidden
          className={loading ? 'animate-spin' : undefined}
        />
      </Text>
      <Text variant="title" wrap="pretty">
        {title}
      </Text>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar el aviso"
          style={dismissResetStyle}
        >
          <Box
            as="span"
            display="inline-flex"
            opacity={{ base: 0.6, hover: 1 }}
            transitionProperty="opacity"
            transitionDuration="fast"
          >
            <Text as="span" color="muted" style={iconBoxStyle}>
              <X size={16} aria-hidden />
            </Text>
          </Box>
        </button>
      )}
      {(description || conSoporte) && (
        <GridItem colStart={2}>
          <Text color="muted">
            {description}
            {conSoporte && (
              <ReportarASoporte
                error={textoDeAviso(title, description, (t) => t === ReportarASoporte)}
                style={description ? undefined : { marginLeft: 0 }}
              />
            )}
          </Text>
        </GridItem>
      )}
      {actions && (
        <GridItem colStart={2} marginTop="l">
          <ButtonGroup actions={actions} size="sm" />
        </GridItem>
      )}
    </Grid>
  )
}

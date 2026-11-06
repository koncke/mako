'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/packages/orbit/src/components/Box.tsx y utils/resolvers.ts.
// Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// ⚠️ LO ÚNICO REESCRITO: Orbit arma Box con StyleX (un plugin de Babel que MaKo no tiene: agregarlo cambiaría el compilador
//    de toda la app). Se conserva la API entera (los mismos props, tokens y valores, `display: flex` por defecto, los
//    valores por breakpoint y por estado) y el mismo mecanismo de Orbit para lo responsive: una clase propia por Box y un
//    <style> con sus media queries. Lo que StyleX resolvía en clases atómicas acá va como estilo en línea; los valores de
//    cada token son los de tokens/value.stylex.ts y semantics.stylex.ts, sin tocar uno.

import React, { useId } from 'react'

type BoxElement =
  | 'div' | 'span' | 'section' | 'article' | 'aside' | 'main' | 'nav' | 'header' | 'footer' | 'form' | 'fieldset' | 'label' | 'ul' | 'ol' | 'li'

const NON_FLEX_DEFAULT_ELEMENTS = new Set<BoxElement>(['span', 'label', 'li'])

// ── Tokens (tokens/value.stylex.ts) ─────────────────────────────────────────────────────────────────────────────
export const SPACING = { none: '0', xs: '4px', s: '8px', m: '12px', l: '16px', xl: '24px', '2xl': '32px', '3xl': '48px', '4xl': '64px', '5xl': '96px' } as const
export const RADII = { none: '0', s: '8px', m: '12px', l: '16px', xl: '32px', full: '9999px' } as const
export const SHADOWS = {
  none: 'none',
  s: '0 1px 2px rgba(0, 0, 0, 0.05)',
  m: '0 0px 15px rgba(0, 0, 0, 0.04), 0 0px 2px rgba(0, 0, 0, 0.06)',
  l: '0 0px 20px rgba(0, 0, 0, 0.04), 0 0px 5px rgba(0, 0, 0, 0.06)',
  xl: '0 0px 30px rgba(0, 0, 0, 0.04), 0 0px 10px rgba(0, 0, 0, 0.06)',
} as const
const DURATIONS = { instant: '0ms', fast: '120ms', base: '200ms', slow: '320ms', slower: '480ms' } as const
const EASINGS = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)', decelerate: 'cubic-bezier(0, 0, 0, 1)', accelerate: 'cubic-bezier(0.3, 0, 1, 1)', spring: 'cubic-bezier(0.5, 1.25, 0.4, 1)',
} as const
const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const
const PSEUDO = { hover: ':hover', focus: ':focus', active: ':active', focusVisible: ':focus-visible', focusWithin: ':focus-within' } as const
const TRANSITION_PROPERTY_VALUES = {
  none: 'none', all: 'all', common: 'color, background-color, border-color, box-shadow, opacity, transform',
  colors: 'color, background-color, border-color', opacity: 'opacity', shadow: 'box-shadow', transform: 'transform',
} as const

// ── Semánticos (tokens/semantics.stylex.ts): viven como variables CSS en app/admin/_polar/polar.css ──────────────
const BACKGROUNDS = ['background-primary', 'background-secondary', 'background-card', 'background-inverse', 'background-accent', 'background-warning', 'background-success', 'background-danger'] as const
const TEXTS = ['text-primary', 'text-secondary', 'text-tertiary', 'text-disabled', 'text-success', 'text-danger', 'text-warning', 'text-accent'] as const
const BORDERS = ['border-primary', 'border-secondary', 'border-warning'] as const

type Spacing = keyof typeof SPACING
type NegSpacing = `-${Exclude<Spacing, 'none'>}`
type Pseudo = keyof typeof PSEUDO
export type ResponsiveValue<T> = T | Partial<Record<'base' | keyof typeof BREAKPOINTS | Pseudo, T>>
type OffsetValue = Spacing | NegSpacing | (string & {}) | number

const ALIGN = { start: 'flex-start', end: 'flex-end', center: 'center', baseline: 'baseline', stretch: 'stretch', auto: 'auto' } as const
const JUSTIFY = { start: 'flex-start', end: 'flex-end', center: 'center', between: 'space-between', around: 'space-around', evenly: 'space-evenly', stretch: 'stretch' } as const
const AUTOFLOW = { row: 'row', column: 'column', dense: 'dense', 'row-dense': 'row dense', 'column-dense': 'column dense' } as const

export type BoxStyleProps = {
  padding?: ResponsiveValue<Spacing>; paddingTop?: ResponsiveValue<Spacing>; paddingRight?: ResponsiveValue<Spacing>; paddingBottom?: ResponsiveValue<Spacing>; paddingLeft?: ResponsiveValue<Spacing>
  paddingHorizontal?: ResponsiveValue<Spacing>; paddingVertical?: ResponsiveValue<Spacing>
  p?: ResponsiveValue<Spacing>; pt?: ResponsiveValue<Spacing>; pr?: ResponsiveValue<Spacing>; pb?: ResponsiveValue<Spacing>; pl?: ResponsiveValue<Spacing>; px?: ResponsiveValue<Spacing>; py?: ResponsiveValue<Spacing>
  margin?: ResponsiveValue<Spacing | NegSpacing | 'auto'>; marginTop?: ResponsiveValue<Spacing | NegSpacing | 'auto'>; marginRight?: ResponsiveValue<Spacing | NegSpacing | 'auto'>
  marginBottom?: ResponsiveValue<Spacing | NegSpacing | 'auto'>; marginLeft?: ResponsiveValue<Spacing | NegSpacing | 'auto'>
  marginHorizontal?: ResponsiveValue<Spacing | NegSpacing | 'auto'>; marginVertical?: ResponsiveValue<Spacing | NegSpacing | 'auto'>
  m?: ResponsiveValue<Spacing | NegSpacing | 'auto'>; mt?: ResponsiveValue<Spacing | NegSpacing | 'auto'>; mr?: ResponsiveValue<Spacing | NegSpacing | 'auto'>; mb?: ResponsiveValue<Spacing | NegSpacing | 'auto'>
  ml?: ResponsiveValue<Spacing | NegSpacing | 'auto'>; mx?: ResponsiveValue<Spacing | NegSpacing | 'auto'>; my?: ResponsiveValue<Spacing | NegSpacing | 'auto'>
  gap?: ResponsiveValue<Spacing>; rowGap?: ResponsiveValue<Spacing>; columnGap?: ResponsiveValue<Spacing>; g?: ResponsiveValue<Spacing>
  backgroundColor?: ResponsiveValue<(typeof BACKGROUNDS)[number]>; color?: ResponsiveValue<(typeof TEXTS)[number]>; borderColor?: ResponsiveValue<(typeof BORDERS)[number]>
  borderRadius?: ResponsiveValue<keyof typeof RADII>; borderTopLeftRadius?: ResponsiveValue<keyof typeof RADII>; borderTopRightRadius?: ResponsiveValue<keyof typeof RADII>
  borderBottomLeftRadius?: ResponsiveValue<keyof typeof RADII>; borderBottomRightRadius?: ResponsiveValue<keyof typeof RADII>
  borderWidth?: ResponsiveValue<number>; borderTopWidth?: ResponsiveValue<number>; borderRightWidth?: ResponsiveValue<number>; borderBottomWidth?: ResponsiveValue<number>; borderLeftWidth?: ResponsiveValue<number>
  borderStyle?: ResponsiveValue<'solid' | 'dashed' | 'dotted' | 'none'>
  boxShadow?: ResponsiveValue<keyof typeof SHADOWS>
  display?: ResponsiveValue<'flex' | 'grid' | 'block' | 'inline' | 'inline-flex' | 'inline-grid' | 'inline-block' | 'none' | 'contents'>
  overflow?: ResponsiveValue<'hidden' | 'auto' | 'scroll' | 'visible'>; overflowX?: ResponsiveValue<'hidden' | 'auto' | 'scroll' | 'visible'>; overflowY?: ResponsiveValue<'hidden' | 'auto' | 'scroll' | 'visible'>
  width?: ResponsiveValue<string | number>; height?: ResponsiveValue<string | number>; minWidth?: ResponsiveValue<string | number>; maxWidth?: ResponsiveValue<string | number>
  minHeight?: ResponsiveValue<string | number>; maxHeight?: ResponsiveValue<string | number>; aspectRatio?: ResponsiveValue<string>
  flex?: ResponsiveValue<number | string>; flexDirection?: ResponsiveValue<'row' | 'column' | 'row-reverse' | 'column-reverse'>
  flexWrap?: ResponsiveValue<'wrap' | 'nowrap' | 'wrap-reverse'>; flexGrow?: ResponsiveValue<number>; flexShrink?: ResponsiveValue<number>; flexBasis?: ResponsiveValue<string | number>
  alignItems?: ResponsiveValue<'start' | 'end' | 'center' | 'baseline' | 'stretch'>; alignSelf?: ResponsiveValue<keyof typeof ALIGN>
  justifyContent?: ResponsiveValue<'start' | 'end' | 'center' | 'between' | 'around' | 'evenly'>; alignContent?: ResponsiveValue<keyof typeof JUSTIFY>
  gridTemplateColumns?: ResponsiveValue<string>; gridTemplateRows?: ResponsiveValue<string>; gridTemplateAreas?: ResponsiveValue<string>
  gridColumn?: ResponsiveValue<string | number>; gridRow?: ResponsiveValue<string | number>; gridArea?: ResponsiveValue<string>
  gridColumnStart?: ResponsiveValue<number | string>; gridColumnEnd?: ResponsiveValue<number | string>; gridRowStart?: ResponsiveValue<number | string>; gridRowEnd?: ResponsiveValue<number | string>
  gridAutoFlow?: ResponsiveValue<keyof typeof AUTOFLOW>; gridAutoColumns?: ResponsiveValue<string>; gridAutoRows?: ResponsiveValue<string>
  position?: ResponsiveValue<'relative' | 'absolute' | 'fixed' | 'sticky' | 'static'>
  top?: ResponsiveValue<OffsetValue>; right?: ResponsiveValue<OffsetValue>; bottom?: ResponsiveValue<OffsetValue>; left?: ResponsiveValue<OffsetValue>; inset?: ResponsiveValue<OffsetValue>
  zIndex?: ResponsiveValue<number | string>
  transitionProperty?: ResponsiveValue<keyof typeof TRANSITION_PROPERTY_VALUES>; transitionDuration?: ResponsiveValue<keyof typeof DURATIONS>
  transitionTimingFunction?: ResponsiveValue<keyof typeof EASINGS>; ease?: ResponsiveValue<keyof typeof EASINGS>; transitionDelay?: ResponsiveValue<keyof typeof DURATIONS>
  transform?: ResponsiveValue<string>; transformOrigin?: ResponsiveValue<string>; willChange?: ResponsiveValue<string>; opacity?: ResponsiveValue<number>
  cursor?: ResponsiveValue<'pointer' | 'default' | 'not-allowed' | 'grab' | 'grabbing' | 'text' | 'move' | 'wait'>
  pointerEvents?: ResponsiveValue<'none' | 'auto'>; visibility?: ResponsiveValue<'visible' | 'hidden'>; userSelect?: ResponsiveValue<'none' | 'text' | 'all' | 'auto'>
  textAlign?: ResponsiveValue<'left' | 'center' | 'right' | 'justify'>
}

type Valor = string | number
const px = (v: Valor) => (typeof v === 'number' ? `${v}px` : v)
const espacio = (v: Valor): string => {
  if (typeof v === 'number') return `${v}px`
  if (v === 'auto') return 'auto'
  if (v.startsWith('-') && (v.slice(1) in SPACING)) return `calc(${SPACING[v.slice(1) as Spacing]} * -1)`
  return SPACING[v as Spacing] ?? v
}
const desdeMapa = (mapa: Record<string, string>) => (v: Valor) => mapa[String(v)] ?? String(v)
const variable = (v: Valor) => `var(--pl-${v})`
const tal = (v: Valor) => (typeof v === 'number' ? String(v) : v)

/** prop → [propiedades CSS, cómo se traduce el valor]. El mismo reparto que utils/resolvers.ts. */
const PROPS: Record<string, [string[], (v: Valor) => string]> = {
  padding: [['padding'], espacio], p: [['padding'], espacio],
  paddingTop: [['paddingTop'], espacio], pt: [['paddingTop'], espacio],
  paddingRight: [['paddingRight'], espacio], pr: [['paddingRight'], espacio],
  paddingBottom: [['paddingBottom'], espacio], pb: [['paddingBottom'], espacio],
  paddingLeft: [['paddingLeft'], espacio], pl: [['paddingLeft'], espacio],
  paddingHorizontal: [['paddingLeft', 'paddingRight'], espacio], px: [['paddingLeft', 'paddingRight'], espacio],
  paddingVertical: [['paddingTop', 'paddingBottom'], espacio], py: [['paddingTop', 'paddingBottom'], espacio],
  margin: [['margin'], espacio], m: [['margin'], espacio],
  marginTop: [['marginTop'], espacio], mt: [['marginTop'], espacio],
  marginRight: [['marginRight'], espacio], mr: [['marginRight'], espacio],
  marginBottom: [['marginBottom'], espacio], mb: [['marginBottom'], espacio],
  marginLeft: [['marginLeft'], espacio], ml: [['marginLeft'], espacio],
  marginHorizontal: [['marginLeft', 'marginRight'], espacio], mx: [['marginLeft', 'marginRight'], espacio],
  marginVertical: [['marginTop', 'marginBottom'], espacio], my: [['marginTop', 'marginBottom'], espacio],
  gap: [['gap'], espacio], g: [['gap'], espacio], rowGap: [['rowGap'], espacio], columnGap: [['columnGap'], espacio],
  backgroundColor: [['backgroundColor'], variable], color: [['color'], variable], borderColor: [['borderColor'], variable],
  borderRadius: [['borderRadius'], desdeMapa(RADII)], borderTopLeftRadius: [['borderTopLeftRadius'], desdeMapa(RADII)],
  borderTopRightRadius: [['borderTopRightRadius'], desdeMapa(RADII)], borderBottomLeftRadius: [['borderBottomLeftRadius'], desdeMapa(RADII)],
  borderBottomRightRadius: [['borderBottomRightRadius'], desdeMapa(RADII)],
  borderWidth: [['borderWidth'], px], borderTopWidth: [['borderTopWidth'], px], borderRightWidth: [['borderRightWidth'], px],
  borderBottomWidth: [['borderBottomWidth'], px], borderLeftWidth: [['borderLeftWidth'], px], borderStyle: [['borderStyle'], tal],
  boxShadow: [['boxShadow'], desdeMapa(SHADOWS)], display: [['display'], tal],
  overflow: [['overflow'], tal], overflowX: [['overflowX'], tal], overflowY: [['overflowY'], tal],
  width: [['width'], px], height: [['height'], px], minWidth: [['minWidth'], px], maxWidth: [['maxWidth'], px],
  minHeight: [['minHeight'], px], maxHeight: [['maxHeight'], px], aspectRatio: [['aspectRatio'], tal],
  flex: [['flex'], tal], flexDirection: [['flexDirection'], tal], flexWrap: [['flexWrap'], tal], flexGrow: [['flexGrow'], tal],
  flexShrink: [['flexShrink'], tal], flexBasis: [['flexBasis'], px],
  alignItems: [['alignItems'], desdeMapa(ALIGN)], alignSelf: [['alignSelf'], desdeMapa(ALIGN)],
  justifyContent: [['justifyContent'], desdeMapa(JUSTIFY)], alignContent: [['alignContent'], desdeMapa(JUSTIFY)],
  gridTemplateColumns: [['gridTemplateColumns'], tal], gridTemplateRows: [['gridTemplateRows'], tal], gridTemplateAreas: [['gridTemplateAreas'], tal],
  gridColumn: [['gridColumn'], tal], gridRow: [['gridRow'], tal], gridArea: [['gridArea'], tal],
  gridColumnStart: [['gridColumnStart'], tal], gridColumnEnd: [['gridColumnEnd'], tal], gridRowStart: [['gridRowStart'], tal], gridRowEnd: [['gridRowEnd'], tal],
  gridAutoFlow: [['gridAutoFlow'], desdeMapa(AUTOFLOW)], gridAutoColumns: [['gridAutoColumns'], tal], gridAutoRows: [['gridAutoRows'], tal],
  position: [['position'], tal], top: [['top'], espacio], right: [['right'], espacio], bottom: [['bottom'], espacio], left: [['left'], espacio], inset: [['inset'], espacio],
  zIndex: [['zIndex'], tal],
  transitionProperty: [['transitionProperty'], desdeMapa(TRANSITION_PROPERTY_VALUES)], transitionDuration: [['transitionDuration'], desdeMapa(DURATIONS)],
  transitionTimingFunction: [['transitionTimingFunction'], desdeMapa(EASINGS)], ease: [['transitionTimingFunction'], desdeMapa(EASINGS)],
  transitionDelay: [['transitionDelay'], desdeMapa(DURATIONS)],
  transform: [['transform'], tal], transformOrigin: [['transformOrigin'], tal], willChange: [['willChange'], tal], opacity: [['opacity'], tal],
  cursor: [['cursor'], tal], pointerEvents: [['pointerEvents'], tal], visibility: [['visibility'], tal], userSelect: [['userSelect'], tal], textAlign: [['textAlign'], tal],
}
export const BOX_STYLE_PROP_KEYS = new Set(Object.keys(PROPS))

const kebab = (p: string) => p.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

/** Los props → estilo en línea (lo de base) y el CSS de la clase propia (breakpoints y estados). */
export function resolveBoxStyles(props: Record<string, unknown>, scope: string): { inlineStyle: React.CSSProperties; responsiveCSS: string } {
  const inline: Record<string, string> = {}
  const porBp: Record<string, Record<string, string>> = {}
  const porPseudo: Record<string, Record<string, string>> = {}
  for (const [k, v] of Object.entries(props)) {
    const def = PROPS[k]
    if (!def || v == null) continue
    const [css, t] = def
    if (typeof v === 'object') {
      for (const [clave, x] of Object.entries(v as Record<string, Valor>)) {
        if (x == null) continue
        const destino = clave === 'base' ? inline : clave in BREAKPOINTS ? (porBp[clave] ??= {}) : clave in PSEUDO ? (porPseudo[clave] ??= {}) : null
        if (!destino) continue
        for (const c of css) destino[c] = t(x)
      }
    } else {
      for (const c of css) inline[c] = t(v as Valor)
    }
  }
  const decl = (o: Record<string, string>) => Object.entries(o).map(([p, x]) => `${kebab(p)}:${x} !important`).join(';')
  let out = ''
  for (const bp of Object.keys(BREAKPOINTS) as (keyof typeof BREAKPOINTS)[]) {
    if (porBp[bp]) out += `@media (min-width:${BREAKPOINTS[bp]}px){.${scope}{${decl(porBp[bp])}}}`
  }
  for (const ps of Object.keys(porPseudo) as Pseudo[]) out += `.${scope}${PSEUDO[ps]}{${decl(porPseudo[ps])}}`
  return { inlineStyle: inline as React.CSSProperties, responsiveCSS: out }
}

type BoxOwnProps<E extends BoxElement = 'div'> = BoxStyleProps & { as?: E; className?: string; children?: React.ReactNode }
export type BoxProps<E extends BoxElement = 'div'> = BoxOwnProps<E> & Omit<React.ComponentPropsWithoutRef<E>, keyof BoxOwnProps<E>>

function BoxInner<E extends BoxElement = 'div'>(
  { as, className, children, style: styleProp, ...rest }: BoxProps<E> & { style?: React.CSSProperties },
  ref: React.ForwardedRef<HTMLElement>,
) {
  const id = useId()
  const scopeClass = `ds${id.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const Component = (as || 'div') as React.ElementType
  const styleProps: Record<string, unknown> = {}
  const domProps: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rest)) {
    if (BOX_STYLE_PROP_KEYS.has(key)) styleProps[key] = value
    else domProps[key] = value
  }
  if (styleProps.display === undefined && !NON_FLEX_DEFAULT_ELEMENTS.has((as ?? 'div') as BoxElement)) styleProps.display = 'flex'
  const { inlineStyle, responsiveCSS } = resolveBoxStyles(styleProps, scopeClass)
  const mergedStyle = { ...inlineStyle, ...styleProp }
  const classes = [responsiveCSS ? scopeClass : null, className].filter(Boolean).join(' ') || undefined
  return (
    <>
      {responsiveCSS && <style dangerouslySetInnerHTML={{ __html: responsiveCSS }} />}
      <Component ref={ref} className={classes} style={Object.keys(mergedStyle).length ? mergedStyle : undefined} {...domProps}>
        {children}
      </Component>
    </>
  )
}

export const Box = React.forwardRef(BoxInner) as <E extends BoxElement = 'div'>(
  props: BoxProps<E> & { ref?: React.ForwardedRef<HTMLElement> },
) => React.ReactElement | null

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/packages/ui/src/components/atoms/CopyToClipboardInput.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: «Copiado» sale SÓLO cuando el portapapeles dijo que sí (punto 24 de docs/admin/revision-cerebro-6-11.md). Polar marca
// el tilde apenas se toca el botón, sin esperar a `writeText`: si el navegador lo niega (sin permiso, una pestaña sin foco, un
// contexto sin HTTPS), el tilde miente y se le pega otra cosa a un cliente en vez del link de pago. Ahora el tilde va en el
// `.then` y el `.catch` dice «No pude copiar». La misma señal la usan los dos menús de un plan (Copiar el ID) y la barra de
// Checkout Links: `copiarTexto` y `useCopiar` viven acá para que sea una sola.

import { Check } from '@/app/admin/_polar/orbit/icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '@/app/admin/_polar/orbit'
import { Input } from '@/app/admin/_polar/orbit'

/** Lo que pasó al copiar: `null` = todavía nada (o ya se borró la señal). */
export type EstadoCopia = 'copiado' | 'fallo' | null

/** Lo que dice la pantalla después de copiar. */
export const ROTULO_COPIA: Readonly<Record<'copiado' | 'fallo', string>> = {
  copiado: 'Copiado',
  fallo: 'No pude copiar',
}

/** Cuánto se ve la señal antes de volver al rótulo de siempre (el de Polar). */
export const MS_SENAL_COPIA = 2000

/** El rótulo de un botón o de una fila de menú de copiar: el suyo, o la señal mientras dura. */
export const rotuloDeCopia = (estado: EstadoCopia, base: string): string => (estado ? ROTULO_COPIA[estado] : base)

/**
 * Copia `texto` y contesta si DE VERDAD quedó en el portapapeles. Sin portapapeles (un navegador sin la API, un contexto sin
 * HTTPS) es un fallo, no un éxito callado. `portapapeles` es para los tests: por defecto, el del navegador.
 */
export async function copiarTexto(
  texto: string,
  portapapeles?: Pick<Clipboard, 'writeText'> | null,
): Promise<'copiado' | 'fallo'> {
  const p = portapapeles !== undefined ? portapapeles : typeof navigator !== 'undefined' ? navigator.clipboard : null
  if (!p || typeof p.writeText !== 'function') return 'fallo'
  try {
    await p.writeText(texto)
    return 'copiado'
  } catch {
    return 'fallo'
  }
}

/**
 * La señal de copiar: el estado (lo dibuja quien llama) y la función que copia. El estado vuelve a `null` a los
 * `MS_SENAL_COPIA`, y un segundo toque reinicia la cuenta.
 */
export function useCopiar(ms: number = MS_SENAL_COPIA): [EstadoCopia, (texto: string) => Promise<'copiado' | 'fallo'>] {
  const [estado, setEstado] = useState<EstadoCopia>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  const copiar = useCallback(
    async (texto: string) => {
      const r = await copiarTexto(texto)
      setEstado(r)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setEstado(null), ms)
      return r
    },
    [ms],
  )
  return [estado, copiar]
}

const CopyToClipboardInput = ({
  value,
  onCopy,
  buttonLabel,
  disabled = false,
  className = '',
  variant = 'default',
  ariaLabel,
}: {
  value: string
  onCopy?: () => void
  buttonLabel?: string
  disabled?: boolean
  className?: string
  variant?: 'default' | 'mono'
  ariaLabel?: string
}) => {
  const [estado, copiar] = useCopiar()

  const copyToClipboard = () => {
    void copiar(value ?? '').then((r) => {
      // `onCopy` es «se copió»: no se avisa de un copiado que no pasó.
      if (r === 'copiado' && onCopy) onCopy()
    })
  }

  return (
    <div
      className={twMerge(
        'dark:border-polar-700 dark:bg-polar-800 flex w-full flex-row items-center overflow-hidden rounded-xl border bg-white shadow-xs',
        className,
      )}
    >
      <Input
        className={twMerge(
          'dark:text-polar-400 !focus:border-transparent !focus:ring-transparent !dark:focus:border-transparent !dark:focus:ring-transparent w-full grow border-none bg-transparent text-gray-600 shadow-none! focus-visible:ring-transparent dark:bg-transparent dark:focus-visible:ring-transparent',
          variant === 'mono' ? 'font-mono text-sm' : '',
        )}
        value={value ?? ''}
        readOnly={true}
        aria-label={ariaLabel}
      />
      {!disabled && (
        <Button
          className={twMerge('mr-1 text-xs', estado === 'fallo' ? 'text-red-500 dark:text-red-400' : '')}
          type="button"
          size="sm"
          variant="ghost"
          onClick={copyToClipboard}
          aria-label={estado ? ROTULO_COPIA[estado] : undefined}
        >
          {estado === 'copiado' ? (
            <Check className="text-sm" fontSize="inherit" />
          ) : (
            rotuloDeCopia(estado, buttonLabel || 'Copiar')
          )}
        </Button>
      )}
      {/* Para el lector de pantalla: el tilde solo no se oye. */}
      <span role="status" aria-live="polite" className="sr-only">
        {estado ? ROTULO_COPIA[estado] : ''}
      </span>
    </div>
  )
}

export default CopyToClipboardInput

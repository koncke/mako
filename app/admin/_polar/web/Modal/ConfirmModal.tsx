// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Modal/ConfirmModal.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: los textos en español, y los dos botones se pueden nombrar (`confirmText`, `cancelText`): un botón dice su acción
// («Pausar la cuenta»), no «Confirmar» a secas. Por defecto, «Confirmar» y «No cambiar nada» (el de los otros modales de Admin).

import { Button } from '@/app/admin/_polar/orbit'
import { Input } from '@/app/admin/_polar/orbit'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/app/admin/_polar/ui/form'
import { MouseEvent, useCallback, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Modal, type ModalProps } from '@/app/admin/_polar/orbit'

// Collapses runs of any Unicode whitespace (including non-breaking spaces,
// common in labels pasted from design tools) into a single regular space, so
// the confirmation text stays typeable on a regular keyboard.
const normalizeWhitespace = (value: string) =>
  value.replace(/\s+/gu, ' ').trim()

export interface ConfirmModalProps extends Omit<
  ModalProps,
  'title' | 'modalContent'
> {
  title: string
  description?: string
  body?: React.ReactNode
  destructive?: boolean
  destructiveText?: string
  /** MaKo: el botón de confirmar cuando no es destructivo (nombra su acción: «Pausar la cuenta»). */
  confirmText?: string
  /** MaKo: el botón que cierra sin hacer nada. */
  cancelText?: string
  confirmPrompt?: string
  onConfirm: () => unknown
  onCancel?: () => void
}

export const ConfirmModal = ({
  title,
  description,
  body,
  destructive,
  destructiveText = 'Eliminar',
  confirmText = 'Confirmar',
  cancelText = 'No cambiar nada',
  confirmPrompt = undefined,
  onConfirm,
  onCancel,
  ...props
}: ConfirmModalProps) => {
  const [isConfirming, setIsConfirming] = useState(false)
  const isConfirmingRef = useRef(false)
  const form = useForm<{ prompt?: string }>({
    defaultValues: {
      prompt: '',
    },
  })
  const { control, handleSubmit, reset } = form
  const prompt = useWatch({ control, name: 'prompt' })
  const normalizedConfirmPrompt =
    confirmPrompt !== undefined ? normalizeWhitespace(confirmPrompt) : undefined

  const hide = useCallback(() => {
    if (isConfirmingRef.current) {
      return
    }
    props.hide()
  }, [props])

  const handleConfirm = useCallback(async () => {
    if (isConfirmingRef.current) {
      return
    }

    isConfirmingRef.current = true
    setIsConfirming(true)
    try {
      await onConfirm()
      reset()
      props.hide()
    } finally {
      isConfirmingRef.current = false
      setIsConfirming(false)
    }
  }, [onConfirm, props, reset])

  const handleCancel = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      if (isConfirmingRef.current) {
        return
      }
      reset()
      onCancel?.()
      props.hide()
    },
    [onCancel, props, reset],
  )

  const promptMismatch = normalizedConfirmPrompt
    ? normalizeWhitespace(prompt ?? '') !== normalizedConfirmPrompt
    : false

  return (
    <Modal
      title={title}
      className="md:min-w-[300px] lg:max-w-[600px]"
      {...props}
      hide={hide}
      modalContent={
        <div className="flex flex-col gap-y-4 p-8">
          <h3 className="text-xl font-medium">{title}</h3>
          {description && (
            <p className="dark:text-polar-400 max-w-full text-sm text-gray-500">
              {description}
            </p>
          )}
          {body}
          <Form {...form}>
            <form
              className="flex w-full flex-col gap-y-2"
              onSubmit={(e) => {
                e.stopPropagation()
                void handleSubmit(handleConfirm)(e)
              }}
            >
              {confirmPrompt && (
                <>
                  <p className="dark:text-polar-400 max-w-full text-sm text-gray-500">
                    Escribe «{normalizedConfirmPrompt}» para confirmar:
                  </p>
                  <FormField
                    control={control}
                    name="prompt"
                    rules={{
                      validate: (value) =>
                        normalizeWhitespace(value ?? '') ===
                          normalizedConfirmPrompt ||
                        'Escribe el texto exacto para confirmar',
                    }}
                    render={({ field }) => {
                      return (
                        <FormItem>
                          <FormControl className="w-full">
                            <div className="flex w-full flex-row gap-2">
                              <Input
                                type="input"
                                required
                                placeholder={normalizedConfirmPrompt}
                                autoComplete="off"
                                disabled={isConfirming}
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )
                    }}
                  />
                </>
              )}
              <div className="flex flex-row-reverse gap-x-4 pt-2">
                <Button
                  type="submit"
                  variant={destructive ? 'destructive' : 'default'}
                  loading={isConfirming}
                  disabled={promptMismatch || isConfirming}
                >
                  {destructive ? destructiveText : confirmText}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  disabled={isConfirming}
                >
                  {cancelText}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      }
    />
  )
}

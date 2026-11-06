'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/CheckoutLinks/CheckoutLinkForm.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// El formulario de un Checkout Link = «Vender un plan»: arma el link de cobro de un plan para una persona con la acción que
// ya existe, `venderPlanAction` (app/admin/cobros/actions.ts → lib/vender-plan.ts). Al pagarse, lib/cobros.ts crea la cuenta
// con ese plan y le manda el acceso. Con un link ya armado (`checkoutLink`) se muestra lo que tiene, sin poder cambiarlo:
// MaKo no edita un cobro (el de Polar, «Save Link», no tiene acción detrás).
//
// ⚠️ LO QUE SE SACÓ de Polar: Success URL, Return URL, el descuento preseteado, «Allow discount codes», «Require billing
//    address», los asientos, la prueba gratis del link y la metadata. Ninguno existe en un cobro de MaKo.
// ⚠️ LO QUE MaKo NECESITA Y POLAR NO TIENE (anotado en el informe del porte, 6/11/2026; lo pide la acción): el email de quien
//    paga, cada cuánto (todos los meses o una vez), la pasarela (sólo con más de una conectada), la moneda (Stripe; Mercado
//    Pago cobra en la de su cuenta), el monto (se propone el precio del plan en esa moneda, nunca con una tasa inventada), lo
//    que equivale en dólares (opcional) y el código de partner. El «Label» de Polar es acá el nombre de quien paga.
// ⚠️ LA PASARELA VA ANTES DEL MONTO: la moneda depende de ella. Y el plan es UNO: un link de MaKo da de alta UNA capa (Polar
//    deja elegir varios productos para que el cliente cambie en el checkout).

import { venderPlanAction } from '@/app/admin/cobros/actions'
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte'
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Text } from '@/app/admin/_polar/orbit'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/app/admin/_polar/ui/form'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SubmitHandler, useForm, useWatch } from 'react-hook-form'
import { NOMBRE_PASARELA, type Pasarela, type TipoCobro } from '@/lib/cobros-tipos'
import { MONEDAS_STRIPE, montoSugerido, type LinkDeVenta, type ProductoMako } from '@/app/admin/_polar/datos/productos'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type CheckoutLinkCreateForm = {
  label: string
  plan: string
  email: string
  tipo: TipoCobro
  pasarela: Pasarela | ''
  moneda: string
  monto: string
  montoUsd: string
  refCodigo: string
}

export interface CheckoutLinkFormProps {
  productos: ProductoMako[]
  /** Las pasarelas conectadas en la plataforma. */
  pasarelas: Pasarela[]
  /** La moneda de la cuenta de Mercado Pago de MaKo (para proponer el precio del plan en esa moneda). */
  monedaMp: string | null
  /** Con un link ya armado, se muestra lo que tiene (sólo lectura). */
  checkoutLink?: LinkDeVenta
  productIds?: string[]
  onClose: (cobroId: number) => void
}

const numero = (s: string): number => Number(String(s).replace(',', '.'))

export const CheckoutLinkForm = ({ productos, pasarelas, monedaMp, checkoutLink, onClose, productIds }: CheckoutLinkFormProps) => {
  const readOnly = !!checkoutLink
  const activos = useMemo(() => productos.filter((p) => p.activo), [productos])

  const defaultValues = useMemo<CheckoutLinkCreateForm>(() => {
    if (checkoutLink) {
      return {
        label: checkoutLink.nombre ?? '',
        plan: productos.find((p) => p.capa === checkoutLink.capa && p.nombre === checkoutLink.producto)?.id ?? '',
        email: checkoutLink.email ?? '',
        tipo: checkoutLink.tipo,
        pasarela: checkoutLink.pasarela,
        moneda: checkoutLink.moneda,
        monto: String(checkoutLink.monto),
        montoUsd: checkoutLink.montoUsd != null ? String(checkoutLink.montoUsd) : '',
        refCodigo: '',
      }
    }
    const plan = activos.find((p) => productIds?.includes(p.id))?.id ?? ''
    return { label: '', plan, email: '', tipo: 'suscripcion', pasarela: '', moneda: 'USD', monto: '', montoUsd: '', refCodigo: '' }
  }, [checkoutLink, productos, activos, productIds])

  const form = useForm<CheckoutLinkCreateForm>({ defaultValues })
  const { control, handleSubmit, setError, setValue, reset, formState } = form

  useEffect(() => {
    if (!checkoutLink) return
    reset(defaultValues)
  }, [checkoutLink, reset, defaultValues])

  // oxlint-disable-next-line react-hooks/incompatible-library
  const planId = useWatch({ control, name: 'plan' })
  const pasarelaElegida = useWatch({ control, name: 'pasarela' })
  const moneda = useWatch({ control, name: 'moneda' })

  // Con UNA pasarela no se pregunta: es ésa.
  const efectiva: Pasarela | null = readOnly ? (checkoutLink?.pasarela ?? null) : pasarelas.length === 1 ? pasarelas[0] : pasarelaElegida || null
  const enMp = efectiva === 'mercadopago'
  const monedaFinal: string | null = enMp ? null : moneda
  const monedaDelLink = enMp ? monedaMp : monedaFinal
  const pideUsd = readOnly ? checkoutLink?.moneda !== 'USD' : monedaDelLink !== 'USD'

  // El precio del plan en la moneda en que va a cobrar el link (si no lo tiene en esa moneda, queda para escribirlo).
  useEffect(() => {
    if (readOnly) return
    const sugerido = montoSugerido(productos.find((p) => p.id === planId), monedaDelLink)
    setValue('monto', sugerido != null ? String(sugerido) : '', { shouldDirty: false })
  }, [readOnly, planId, monedaDelLink, productos, setValue])

  const [pending, setPending] = useState(false)

  const onSubmit: SubmitHandler<CheckoutLinkCreateForm> = useCallback(
    async (data) => {
      const plan = productos.find((p) => p.id === data.plan)
      if (!plan) {
        setError('plan', { message: 'Elige el plan.' })
        return
      }
      if (!efectiva) {
        setError('pasarela', { message: 'Elige con qué se cobra.' })
        return
      }
      setPending(true)
      const usd = numero(data.montoUsd)
      const r = await venderPlanAction({
        capa: plan.capa,
        monto: numero(data.monto),
        moneda: monedaFinal,
        tipo: data.tipo,
        montoUsd: pideUsd && Number.isFinite(usd) && usd > 0 ? usd : null,
        email: data.email.trim(),
        nombre: data.label.trim(),
        pasarela: efectiva,
        refCodigo: data.refCodigo.trim() || null,
      }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'No pude crear el link.' }))
      setPending(false)
      if (!r.ok) {
        setError('root', { message: r.error })
        return
      }
      onClose(r.cobroId)
    },
    [productos, efectiva, monedaFinal, pideUsd, setError, onClose],
  )

  const sinPasarela = !readOnly && pasarelas.length === 0

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-6">
        <FormField
          control={control}
          name="label"
          rules={{ validate: (v) => (readOnly || v.trim().length > 1 ? true : 'Falta el nombre de quien paga.') }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input placeholder="Ana Gómez" {...field} disabled={readOnly} />
              </FormControl>
              <FormDescription className="text-xs">De quien paga: así queda su ficha en el CRM de MaKo.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="plan"
          rules={{ validate: (v) => (readOnly || v ? true : 'Elige el plan.') }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plan</FormLabel>
              {readOnly ? (
                <Input value={checkoutLink?.producto ?? ''} disabled readOnly />
              ) : (
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Elige el plan" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {activos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <FormMessage />
              <FormDescription className="text-xs">Al pagar, MaKo crea su cuenta con este plan y le manda el acceso.</FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="email"
          rules={{ validate: (v) => (readOnly || EMAIL_RE.test(v.trim()) ? true : 'Revisa el email: por ahí le llega el acceso.') }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="ana@ejemplo.com" {...field} disabled={readOnly} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="tipo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cada cuánto</FormLabel>
              <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="suscripcion">Todos los meses</SelectItem>
                  <SelectItem value="unico">Una vez</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {(readOnly || pasarelas.length > 1) && (
          <FormField
            control={control}
            name="pasarela"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pasarela</FormLabel>
                <Select value={field.value || undefined} onValueChange={field.onChange} disabled={readOnly}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Con qué cobras" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(readOnly && checkoutLink ? [checkoutLink.pasarela] : pasarelas).map((p) => (
                      <SelectItem key={p} value={p}>
                        {NOMBRE_PASARELA[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        {!enMp && !readOnly && (
          <FormField
            control={control}
            name="moneda"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Moneda</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {MONEDAS_STRIPE.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={control}
          name="monto"
          rules={{ validate: (v) => (readOnly || (Number.isFinite(numero(v)) && numero(v) > 0) ? true : 'Falta el monto.') }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monto</FormLabel>
              <FormControl>
                <Input
                  inputMode="decimal"
                  placeholder="0.00"
                  {...field}
                  disabled={readOnly}
                  postSlot={<span className="dark:text-polar-500 text-xs text-gray-500">{readOnly ? checkoutLink?.moneda : (monedaDelLink ?? 'su moneda')}</span>}
                />
              </FormControl>
              {!readOnly && (
                <FormDescription className="text-xs">
                  {enMp && !monedaMp ? 'Mercado Pago cobra en la moneda de su cuenta.' : 'Se propone el precio del plan; si no tiene precio en esa moneda, escríbelo.'}
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        {pideUsd && (
          // Sin el valor en dólares el cobro sale igual, pero no entra al cash del CRM: nunca se inventa una tasa.
          <FormField
            control={control}
            name="montoUsd"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Equivale a (opcional)</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="0.00" {...field} disabled={readOnly} postSlot={<span className="dark:text-polar-500 text-xs text-gray-500">USD</span>} />
                </FormControl>
                <FormDescription className="text-xs">Sin esto el cobro sale igual, pero no suma a lo cobrado en dólares.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        {!readOnly && (
          <FormField
            control={control}
            name="refCodigo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código de partner</FormLabel>
                <FormControl>
                  <Input placeholder="" {...field} />
                </FormControl>
                <FormDescription className="text-xs">Si lo trajo alguien de MaKo Partners.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {sinPasarela && (
          <Text color="muted">Conecta Stripe o Mercado Pago en la plataforma para armar un link.</Text>
        )}
        {formState.errors.root?.message ? (
          <div role="alert" className="flex flex-col items-start gap-2">
            <Text color="error">{formState.errors.root.message}</Text>
            <ReportarASoporte error={formState.errors.root.message} />
          </div>
        ) : null}
        {!readOnly && (
          <div className="flex flex-row gap-x-4">
            <Button className="self-start" type="submit" loading={pending} disabled={sinPasarela}>
              Crear el link
            </Button>
          </div>
        )}
      </form>
    </Form>
  )
}

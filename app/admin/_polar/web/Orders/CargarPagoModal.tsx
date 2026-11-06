'use client'

// No está en Polar (en Polar todo pedido sale de un checkout): «Cargar pago» registra un pago que entró POR FUERA de la pasarela
// (Binance, transferencia…) y le emite su recibo. Lo pidió Martín (6/11/2026) y la acción ya existía (`cargarPagoAction`,
// app/admin/cobros/recibos-actions.ts → `emitirReciboManual`, lib/recibos.ts, que vuelve a validar todo). Va como los modales de
// Polar (InlineModal, a la derecha). El `formId` se genera al abrir y viaja en cada intento: un doble clic no da dos recibos.
// ⚠️ No escribe una cuota ni marca un mes pagado en el CRM: el recibo es del libro (lib/recibos.ts lo dice en su cabecera).

import { useState } from 'react'
import { useRouter } from '@/app/_ui/Link'
import {
  MONEDAS_RECIBO, formCargarPagoInicial, pedidoCargarPago, problemaCargarPago,
  type FormCargarPago, type LineaCargarPago, type PagoCargarPago,
} from '@/app/admin/_polar/datos/ventas'
import { cargarPagoAction } from '@/app/admin/cobros/recibos-actions'
import { MEDIOS, ROTULO_MEDIO, ROTULO_REFERENCIA, esMedio } from '@/lib/recibos-reglas'
import {
  Button, InlineModalHeader, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Text, TextArea,
} from '@/app/admin/_polar/orbit'
import { AvisoDeError, AvisoHecho } from './Aviso'
import { DownloadReceiptDashboard } from './DownloadReceipt'

const nuevoId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16).padStart(8, '0')}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`

const Campo = ({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-y-2">
    <label htmlFor={htmlFor} className="text-sm">{label}</label>
    {children}
  </div>
)

export const CargarPagoModal = ({
  cuentas,
  planes,
  hoy,
  hide,
}: {
  cuentas: ReadonlyArray<{ id: number; nombre: string }>
  planes: ReadonlyArray<{ nombre: string; precioUsd: number }>
  hoy: string
  hide: () => void
}) => {
  const router = useRouter()
  const [formId] = useState(nuevoId)
  const [f, setF] = useState<FormCargarPago>(() => formCargarPagoInicial(hoy))
  const [subiendo, setSubiendo] = useState<ReadonlySet<number>>(new Set())
  const [enviando, setEnviando] = useState<'enviar' | 'sin' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [emitido, setEmitido] = useState<{ id: number; numero: number; texto: string } | null>(null)

  const linea = (i: number, cambio: Partial<LineaCargarPago>) => setF((x) => ({ ...x, lineas: x.lineas.map((l, j) => (j === i ? { ...l, ...cambio } : l)) }))
  const pago = (i: number, cambio: Partial<PagoCargarPago>) => setF((x) => ({ ...x, pagos: x.pagos.map((p, j) => (j === i ? { ...p, ...cambio } : p)) }))

  async function subir(i: number, archivo: File) {
    setSubiendo((s) => new Set(s).add(i))
    const fd = new FormData()
    fd.append('archivo', archivo)
    const r = (await fetch('/api/admin/recibos/comprobante', { method: 'POST', body: fd })
      .then(async (res) => (res.ok ? res.json() : { ok: false, error: (await res.json().catch(() => null))?.error ?? 'No pude subir el comprobante.' }))
      .catch(() => ({ ok: false, error: 'No pude subir el comprobante.' }))) as { ok: boolean; path?: string; nombre?: string; error?: string }
    setSubiendo((s) => {
      const n = new Set(s)
      n.delete(i)
      return n
    })
    if (r.ok && r.path) pago(i, { comprobante: { path: r.path, nombre: r.nombre ?? archivo.name } })
    else setError(r.error ?? 'No pude subir el comprobante.')
  }

  async function emitir(enviar: boolean) {
    const problema = problemaCargarPago(f, subiendo.size > 0)
    if (problema) return setError(problema)
    setError(null)
    setEnviando(enviar ? 'enviar' : 'sin')
    const r = await cargarPagoAction(pedidoCargarPago(f, formId, enviar)).catch(() => ({ ok: false as const, error: 'No pude emitir el recibo.' }))
    setEnviando(null)
    if (!r.ok) return setError(r.error)
    const n = String(r.numero).padStart(4, '0')
    setEmitido({ id: r.id, numero: r.numero, texto: `${r.yaEstaba ? 'Ya estaba' : enviar ? 'Emitido y enviado' : 'Emitido sin enviar'}: recibo N.º ${n}.${r.aviso ? ` ${r.aviso}` : ''}` })
    router.refresh()
  }

  return (
    <div className="flex flex-col">
      <InlineModalHeader hide={hide}>
        <h2>Cargar pago</h2>
      </InlineModalHeader>
      <div className="flex flex-col gap-y-6 px-8 pb-8">
        <Text color="muted">El recibo de un pago que entró por fuera de la pasarela.</Text>

        <Campo label="Cuenta">
          <Select value={f.cuenta} onValueChange={(v) => setF((x) => ({ ...x, cuenta: v, aNombre: x.aNombre || cuentas.find((c) => String(c.id) === v)?.nombre || '' }))}>
            <SelectTrigger>
              <SelectValue placeholder="Elige la cuenta" />
            </SelectTrigger>
            <SelectContent>
              {cuentas.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo label="A nombre de" htmlFor="cp-a-nombre">
          <Input id="cp-a-nombre" value={f.aNombre} onChange={(e) => setF((x) => ({ ...x, aNombre: e.target.value }))} placeholder="Estudio Norte" />
        </Campo>

        <div className="flex flex-col gap-y-4">
          <div className="flex items-center justify-between">
            <Text variant="heading-xxs" as="h3">Qué se pagó</Text>
            <div className="w-28">
              <Select value={f.moneda} onValueChange={(v) => setF((x) => ({ ...x, moneda: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONEDAS_RECIBO.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {planes.length > 0 && (
            <Select
              value=""
              onValueChange={(v) => {
                const p = planes.find((x) => x.nombre === v)
                if (p) linea(0, { concepto: p.nombre, monto: String(p.precioUsd) })
              }}
            >
              <SelectTrigger><SelectValue placeholder="Usar el precio de un plan" /></SelectTrigger>
              <SelectContent>
                {planes.map((p) => <SelectItem key={p.nombre} value={p.nombre}>{p.nombre} · US$ {p.precioUsd}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {f.lineas.map((l, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_7rem_7rem] items-end gap-2">
              <Campo label="Concepto"><Input value={l.concepto} onChange={(e) => linea(i, { concepto: e.target.value })} placeholder="Mensualidad de noviembre" /></Campo>
              <Campo label="Mes (opcional)"><Input value={l.mes} onChange={(e) => linea(i, { mes: e.target.value })} placeholder="noviembre" /></Campo>
              <Campo label="Importe"><Input inputMode="decimal" value={l.monto} onChange={(e) => linea(i, { monto: e.target.value })} placeholder="0" /></Campo>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setF((x) => ({ ...x, lineas: [...x.lineas, { concepto: '', mes: '', monto: '' }] }))}>Sumar un renglón</Button>
            {f.lineas.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => setF((x) => ({ ...x, lineas: x.lineas.slice(0, -1) }))}>Sacar el último</Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-y-4">
          <Text variant="heading-xxs" as="h3">Cómo se pagó</Text>
          {f.pagos.map((p, i) => (
            <div key={i} className="dark:border-polar-700 flex flex-col gap-y-3 rounded-2xl border border-gray-200 p-4">
              <div className="grid grid-cols-2 gap-2">
                <Campo label="Medio">
                  <Select value={p.medio} onValueChange={(v) => { if (esMedio(v)) pago(i, { medio: v }) }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MEDIOS.map((m) => <SelectItem key={m} value={m}>{ROTULO_MEDIO[m]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Campo>
                <Campo label={ROTULO_REFERENCIA[p.medio]}>
                  <Input value={p.referencia} onChange={(e) => pago(i, { referencia: e.target.value })} />
                </Campo>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_6rem_minmax(0,1fr)_6rem] items-end gap-2">
                <Campo label="Fecha"><Input type="date" value={p.fecha} onChange={(e) => pago(i, { fecha: e.target.value })} /></Campo>
                <Campo label="Hora"><Input type="time" value={p.hora} onChange={(e) => pago(i, { hora: e.target.value })} /></Campo>
                <Campo label="Monto"><Input inputMode="decimal" value={p.monto} onChange={(e) => pago(i, { monto: e.target.value })} placeholder="0" /></Campo>
                <Campo label="Moneda">
                  <Select value={p.moneda} onValueChange={(v) => pago(i, { moneda: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONEDAS_RECIBO.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Campo>
              </div>
              <Campo label="Quién pagó (opcional)"><Input value={p.de} onChange={(e) => pago(i, { de: e.target.value })} placeholder="Ana Gómez" /></Campo>
              <Campo label="Comprobante (JPEG o PNG, opcional)">
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="text-sm"
                  onChange={(e) => { const a = e.target.files?.[0]; if (a) void subir(i, a) }}
                />
                {subiendo.has(i) && <Text color="muted">Subiendo…</Text>}
                {p.comprobante && <Text color="muted">{p.comprobante.nombre}</Text>}
              </Campo>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setF((x) => ({ ...x, pagos: [...x.pagos, { ...formCargarPagoInicial(hoy).pagos[0] }] }))}>Sumar un pago</Button>
            {f.pagos.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => setF((x) => ({ ...x, pagos: x.pagos.slice(0, -1) }))}>Sacar el último</Button>
            )}
          </div>
        </div>

        <Campo label="Nota en el recibo (opcional)" htmlFor="cp-nota-pdf">
          <TextArea id="cp-nota-pdf" value={f.notaPdf} onChange={(e) => setF((x) => ({ ...x, notaPdf: e.target.value }))} />
        </Campo>
        <Campo label="Nota interna (opcional, no sale en el recibo)" htmlFor="cp-nota-interna">
          <TextArea id="cp-nota-interna" value={f.notaInterna} onChange={(e) => setF((x) => ({ ...x, notaInterna: e.target.value }))} />
        </Campo>

        <AvisoDeError texto={error} />
        <AvisoHecho texto={emitido?.texto ?? null} />
        {emitido ? (
          <div className="flex flex-row gap-x-4">
            <DownloadReceiptDashboard reciboId={emitido.id} variant="default" />
            <Button variant="ghost" onClick={hide}>Cerrar</Button>
          </div>
        ) : (
          <div className="flex flex-row flex-wrap gap-4">
            <Button onClick={() => void emitir(true)} loading={enviando === 'enviar'} disabled={!!enviando}>Emitir y enviar</Button>
            <Button variant="secondary" onClick={() => void emitir(false)} loading={enviando === 'sin'} disabled={!!enviando}>Emitir sin enviar</Button>
          </div>
        )}
      </div>
    </div>
  )
}

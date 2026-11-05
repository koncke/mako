'use client';

// =============================================================================
// CargarPago — el recibo de plata que entra por FUERA de la pasarela (Binance, transferencia…), un paso por pantalla (5/11/2026)
// =============================================================================
// ¿De quién? → Qué se pagó → Cómo se pagó → Revisar → «Emitir y enviar» o «Emitir sin enviar». El `formId` se genera al abrir y
// viaja en cada intento: un doble clic no da dos recibos (lib/recibos.ts, `emitirReciboManual`, con la clave `form:<uuid>`).
// Lo que importa lo valida el servidor (la orden de Binance, los montos, la cuenta que paga su agencia); acá se avisa antes.
// ⚠️ No marca meses pagados ni escribe cuotas: eso es de la rama de agencias (docs/relevo/nube-recibos.md).

import { useMemo, useState } from 'react';
import { Alert, Button, Input, Modal, Select, TextField } from '@/app/_ui';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { MEDIOS, ROTULO_MEDIO, ROTULO_REFERENCIA, diferencia, referenciaNormal, type MedioRecibo } from '@/lib/recibos-reglas';
import { cargarPagoAction } from './recibos-actions';

type Linea = { concepto: string; mes: string; monto: string; moneda: string };
type Pago = { medio: MedioRecibo; referencia: string; fecha: string; monto: string; moneda: string; de: string; comprobante: { path: string; nombre: string } | null; subiendo: boolean };

const MONEDAS = ['USD', 'USDT', 'USDC', 'ARS', 'MXN', 'EUR'].map((m) => ({ value: m, label: m }));
const PASOS = ['¿De quién?', 'Qué se pagó', 'Cómo se pagó', 'Revisar'] as const;

const ahoraLocal = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const nuevoId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(16).padStart(8, '0')}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`);

export default function CargarPago({ cuentas, planes, onCerrar, onEmitido }: {
  cuentas: Array<{ id: number; nombre: string }>;
  planes: Array<{ nombre: string; precioUsd: number }>;
  onCerrar: () => void;
  onEmitido: (mensaje: string) => void;
}) {
  const [formId] = useState(nuevoId);
  const [paso, setPaso] = useState(0);
  const [cuenta, setCuenta] = useState('');
  const [aNombre, setANombre] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([{ concepto: '', mes: '', monto: '', moneda: 'USD' }]);
  const [pagos, setPagos] = useState<Pago[]>([{ medio: 'binance', referencia: '', fecha: ahoraLocal(), monto: '', moneda: 'USDT', de: '', comprobante: null, subiendo: false }]);
  const [notaPdf, setNotaPdf] = useState('');
  const [notaInterna, setNotaInterna] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<'enviar' | 'sin' | null>(null);

  const nombreCuenta = cuentas.find((c) => String(c.id) === cuenta)?.nombre ?? '';
  const total = (xs: Array<{ monto: string; moneda: string }>) => {
    const t: Record<string, number> = {};
    for (const x of xs) if (Number(x.monto) > 0) t[x.moneda] = Math.round(((t[x.moneda] ?? 0) + Number(x.monto)) * 100) / 100;
    return Object.entries(t).map(([moneda, monto]) => ({ moneda, monto }));
  };
  const detalle = useMemo(() => total(lineas), [lineas]);
  const recibido = useMemo(() => total(pagos), [pagos]);
  const dif = detalle.length === 1 ? diferencia(detalle[0].monto, detalle[0].moneda, recibido) : null;

  function validar(): string | null {
    if (paso === 0) {
      if (!cuenta) return 'Elige la cuenta.';
      if (!aNombre.trim()) return 'Falta a nombre de quién va.';
    }
    if (paso === 1) {
      if (lineas.some((l) => !l.concepto.trim() || !(Number(l.monto) > 0))) return 'Cada renglón necesita concepto e importe.';
      if (new Set(lineas.map((l) => l.moneda)).size > 1) return 'Los renglones van en una sola moneda.';
    }
    if (paso === 2) {
      for (const p of pagos) {
        if (!referenciaNormal(p.medio, p.referencia)) return p.medio === 'binance' ? 'La orden de Binance son los 18 dígitos del «Order ID».' : 'Falta la referencia del pago.';
        if (!(Number(p.monto) > 0) || !p.fecha) return 'Cada pago necesita fecha y monto.';
        if (p.subiendo) return 'Espera a que termine de subir el comprobante.';
      }
    }
    return null;
  }

  function siguiente() {
    const e = validar();
    setError(e);
    if (!e) setPaso((p) => Math.min(PASOS.length - 1, p + 1));
  }

  async function subir(i: number, archivo: File) {
    setPagos((xs) => xs.map((x, j) => (j === i ? { ...x, subiendo: true } : x)));
    setError(null);
    const fd = new FormData();
    fd.append('archivo', archivo);
    const r = await fetch('/api/admin/recibos/comprobante', { method: 'POST', body: fd })
      .then(async (res) => (res.ok ? res.json() : { ok: false, error: (await res.json().catch(() => null))?.error ?? 'No pude subir el comprobante.' }))
      .catch(() => ({ ok: false, error: 'No pude subir el comprobante.' })) as { ok: boolean; path?: string; nombre?: string; error?: string };
    setPagos((xs) => xs.map((x, j) => (j === i ? { ...x, subiendo: false, comprobante: r.ok && r.path ? { path: r.path, nombre: r.nombre ?? archivo.name } : x.comprobante } : x)));
    if (!r.ok) setError(r.error ?? 'No pude subir el comprobante.');
  }

  async function emitir(enviar: boolean) {
    setEnviando(enviar ? 'enviar' : 'sin');
    setError(null);
    const r = await cargarPagoAction({
      formId, destinoWs: Number(cuenta), aNombre: aNombre.trim(), mes: null,
      lineas: lineas.map((l) => ({ concepto: l.concepto, mes: l.mes.trim() || null, monto: Number(l.monto), moneda: l.moneda })),
      pagos: pagos.map((p) => ({ medio: p.medio, referencia: p.referencia, fecha: p.fecha, monto: Number(p.monto), moneda: p.moneda, de: p.de.trim() || null, comprobante_path: p.comprobante?.path ?? null, comprobante_nombre: p.comprobante?.nombre ?? null })),
      notaPdf: notaPdf.trim() || null, notaInterna: notaInterna.trim() || null, enviar,
    }).catch(() => ({ ok: false as const, error: 'No pude emitir el recibo.' }));
    setEnviando(null);
    if (!r.ok) { setError(r.error); return; }
    const n = String(r.numero).padStart(4, '0');
    onEmitido(r.yaEstaba ? `Ya estaba: recibo N.º ${n}` : `${enviar ? 'Emitido y enviado' : 'Emitido sin enviar'}: N.º ${n}${r.aviso ? `. ${r.aviso}` : ''}`);
  }

  const pie = (
    <>
      {paso > 0 && <Button variant="tertiary" onClick={() => { setError(null); setPaso((p) => p - 1); }}>Atrás</Button>}
      {paso < PASOS.length - 1 ? (
        <Button onClick={siguiente}>Siguiente</Button>
      ) : (
        <>
          <Button variant="secondary" loading={enviando === 'sin'} disabled={!!enviando} onClick={() => void emitir(false)}>Emitir sin enviar</Button>
          <Button loading={enviando === 'enviar'} disabled={!!enviando} onClick={() => void emitir(true)}>Emitir y enviar</Button>
        </>
      )}
    </>
  );

  return (
    <Modal titulo={`Cargar pago · ${PASOS[paso]}`} onCerrar={onCerrar} pie={pie} ancho={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <Alert tono="bad">{error}</Alert>}

        {paso === 0 && (
          <>
            <Select label="Cuenta" value={cuenta} onChange={(v) => { setCuenta(v); if (!aNombre.trim() || aNombre === nombreCuenta) setANombre(cuentas.find((c) => String(c.id) === v)?.nombre ?? ''); }}
              options={cuentas.map((c) => ({ value: String(c.id), label: c.nombre }))} placeholder="Elige la cuenta" />
            <TextField label="A nombre de" hint="Así sale en el recibo. Revisa tildes y apellidos." value={aNombre} onChange={(e) => setANombre(e.target.value)} maxLength={200} />
          </>
        )}

        {paso === 1 && (
          <>
            {planes.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {planes.map((p) => (
                  <Button key={p.nombre} size="sm" variant="secondary" onClick={() => setLineas((xs) => [...xs.filter((x) => x.concepto.trim() || x.monto), { concepto: `Plan ${p.nombre}`, mes: '', monto: String(p.precioUsd), moneda: 'USD' }])}>
                    + {p.nombre} · {formatoMonto(p.precioUsd, 'USD')}
                  </Button>
                ))}
              </div>
            )}
            {lineas.map((l, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) 92px auto', gap: 8, alignItems: 'end' }}>
                <TextField label={i === 0 ? 'Concepto' : undefined} value={l.concepto} onChange={(e) => setLineas((xs) => xs.map((x, j) => (j === i ? { ...x, concepto: e.target.value } : x)))} maxLength={200} />
                <TextField label={i === 0 ? 'Mes' : undefined} placeholder="noviembre" value={l.mes} onChange={(e) => setLineas((xs) => xs.map((x, j) => (j === i ? { ...x, mes: e.target.value } : x)))} maxLength={40} />
                <TextField label={i === 0 ? 'Importe' : undefined} inputMode="decimal" value={l.monto} onChange={(e) => setLineas((xs) => xs.map((x, j) => (j === i ? { ...x, monto: e.target.value.replace(',', '.') } : x)))} />
                <Select label={i === 0 ? 'Moneda' : undefined} value={l.moneda} onChange={(v) => setLineas((xs) => xs.map((x, j) => (j === i ? { ...x, moneda: v } : x)))} options={MONEDAS} />
                <Button size="sm" variant="tertiary" disabled={lineas.length === 1} onClick={() => setLineas((xs) => xs.filter((_, j) => j !== i))} aria-label="Quitar el renglón">Quitar</Button>
              </div>
            ))}
            <div><Button size="sm" variant="secondary" onClick={() => setLineas((xs) => [...xs, { concepto: '', mes: xs[xs.length - 1]?.mes ?? '', monto: '', moneda: xs[0]?.moneda ?? 'USD' }])}>Sumar un renglón</Button></div>
          </>
        )}

        {paso === 2 && (
          <>
            {pagos.map((p, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: '1px solid var(--border)', borderRadius: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                  <Select label="Medio" value={p.medio} onChange={(v) => setPagos((xs) => xs.map((x, j) => (j === i ? { ...x, medio: v as MedioRecibo } : x)))} options={MEDIOS.map((m) => ({ value: m, label: ROTULO_MEDIO[m] }))} />
                  <TextField label={ROTULO_REFERENCIA[p.medio]} value={p.referencia} onChange={(e) => setPagos((xs) => xs.map((x, j) => (j === i ? { ...x, referencia: e.target.value } : x)))} maxLength={200} />
                  <div>
                    <label className="mk-label">Fecha y hora</label>
                    <Input type="datetime-local" value={p.fecha} onChange={(e) => setPagos((xs) => xs.map((x, j) => (j === i ? { ...x, fecha: e.target.value } : x)))} />
                  </div>
                  <TextField label="Monto" inputMode="decimal" value={p.monto} onChange={(e) => setPagos((xs) => xs.map((x, j) => (j === i ? { ...x, monto: e.target.value.replace(',', '.') } : x)))} />
                  <Select label="Moneda" value={p.moneda} onChange={(v) => setPagos((xs) => xs.map((x, j) => (j === i ? { ...x, moneda: v } : x)))} options={MONEDAS} />
                  <TextField label="De (opcional)" value={p.de} onChange={(e) => setPagos((xs) => xs.map((x, j) => (j === i ? { ...x, de: e.target.value } : x)))} maxLength={120} />
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
                  <label className="mk-btn mk-btn--secondary mk-btn--sm" style={{ cursor: 'pointer' }}>
                    {p.subiendo ? 'Subiendo…' : p.comprobante ? 'Cambiar la foto' : 'Subir la foto'}
                    <input type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void subir(i, f); e.currentTarget.value = ''; }} />
                  </label>
                  <span>{p.comprobante ? p.comprobante.nombre : 'JPEG o PNG, hasta 4 MB.'}</span>
                  {pagos.length > 1 && <Button size="sm" variant="tertiary" onClick={() => setPagos((xs) => xs.filter((_, j) => j !== i))}>Quitar el pago</Button>}
                </div>
              </div>
            ))}
            <div><Button size="sm" variant="secondary" onClick={() => setPagos((xs) => [...xs, { ...xs[xs.length - 1], referencia: '', monto: '', de: '', comprobante: null, subiendo: false, fecha: ahoraLocal() }])}>Sumar otro pago</Button></div>
          </>
        )}

        {paso === 3 && (
          <>
            <Fila nombre="Cuenta" valor={`${nombreCuenta} · a nombre de ${aNombre.trim()}`} />
            <Fila nombre="Qué se pagó" valor={detalle.map((t) => formatoMonto(t.monto, t.moneda)).join(' + ')} />
            <Fila nombre="Recibido" valor={recibido.map((t) => formatoMonto(t.monto, t.moneda)).join(' + ')} />
            {dif != null && dif !== 0 && <Fila nombre="Diferencia" valor={`${dif > 0 ? 'De más' : 'De menos'}: ${formatoMonto(Math.abs(dif), detalle[0].moneda)}. No queda como saldo: anótalo en la nota.`} />}
            <Fila nombre="Le llega" valor="Por correo a los admins de la cuenta, y al grupo de MaKo si la cuenta no es de una agencia." />
            <TextField label="Nota del PDF (opcional)" placeholder="Cubre hasta el 4/12." value={notaPdf} onChange={(e) => setNotaPdf(e.target.value)} maxLength={500} />
            <TextField label="Nota interna (opcional)" hint="Sólo se ve aquí." value={notaInterna} onChange={(e) => setNotaInterna(e.target.value)} maxLength={500} />
          </>
        )}
      </div>
    </Modal>
  );
}

function Fila({ nombre, valor }: { nombre: string; valor: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 'var(--fs-md)' }}>
      <span style={{ width: 110, flex: 'none', color: 'var(--dim)' }}>{nombre}</span>
      <span style={{ color: 'var(--ink)', overflowWrap: 'anywhere' }}>{valor}</span>
    </div>
  );
}

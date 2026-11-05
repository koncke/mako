'use client';

// =============================================================================
// RecibosMako — el libro de recibos de MaKo, en Admin › Billing (5/11/2026)
// =============================================================================
// Martín: «me gustaría que todo esto lo vayamos evidentemente guardando dentro de la aplicación, dentro de SuperAdmin tal vez,
// para que tengamos un registro». Una fila por recibo (el N.º, a nombre de quién, lo recibido, el medio, la fecha, el estado y
// cómo salió por correo y por WhatsApp), «Cargar pago» para la plata que entra por fuera de la pasarela (Binance), los «Datos
// del recibo» (el emisor: nunca se inventa un dato fiscal) y el interruptor «WhatsApp a quien paga solo».
//
// Es un componente PROPIO: la pantalla de cobros la rehace el chat «Admin» (docs/relevo/admin-encargo.md), que lo monta donde
// quiera. Sólo necesita el super admin (cada action lo vuelve a preguntar: app/admin/cobros/recibos-actions.ts).
// Copiado del molde de la lista de cobros de al lado (ListaCobrosMako.tsx): misma fila, mismas celdas, mismo Status.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Button, Checkbox, EmptyState, Input, Select, SkeletonLines, Status, Switch, Tag, TextField, Toast, useConfirm, useToast, type Tono } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import { formatoMonto } from '@/lib/pasarela-moneda';
import {
  ROTULO_CORREO, ROTULO_ESTADO_RECIBO, ROTULO_MEDIO, ROTULO_WA, MEDIOS, esMedio, numeroEnTexto, totalesEnTexto, type Emisor, type EstadoRecibo,
} from '@/lib/recibos-reglas';
import type { FiltroRecibos, ReciboListado } from '@/lib/recibos';
import {
  anularReciboAction, guardarEmisorAction, guardarWaSoloAction, marcarDevueltoReciboAction, recibosAction, reenviarReciboAction, type DatosRecibos,
} from './recibos-actions';
import CargarPago from './CargarPago';

const TONO_ESTADO: Record<EstadoRecibo, Tono> = { emitido: 'good', devuelto: 'warn', devuelto_parcial: 'warn', contracargo: 'bad', anulado: 'neutral' };
const TONO_ENVIO: Record<string, Tono> = {
  pendiente: 'info', enviando: 'info', enviado: 'good', en_app: 'good', fallo: 'bad', reboto: 'bad', sin_destino: 'bad', sin_grupo: 'neutral', no_va: 'neutral',
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** «5 nov 2026», leído del ISO tal cual: el server y el navegador dibujan lo mismo. */
function fechaCorta(iso: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1] ?? ''} ${m[1]}` : '';
}
/** Los últimos 12 meses, para el filtro. */
function ultimosMeses(): Array<{ value: string; label: string }> {
  const hoy = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 1));
    const v = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return { value: v, label: `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
  });
}

export default function RecibosMako() {
  const router = useRouter();
  const { confirm, confirmNode } = useConfirm();
  const { toast, show, clear } = useToast();
  const [filtro, setFiltro] = useState<FiltroRecibos>({});
  const [datos, setDatos] = useState<DatosRecibos | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [falla, setFalla] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(async (f: FiltroRecibos) => {
    setCargando(true);
    const r = await recibosAction(f).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : 'No pude leer los recibos.' }));
    setDatos(r);
    setCargando(false);
  }, []);
  useEffect(() => { void cargar(filtro); }, [cargar, filtro]);

  const meses = useMemo(ultimosMeses, []);

  async function reenviar(r: ReciboListado) {
    let otro = '';
    const a = r.correo_a?.length ? r.correo_a.join(', ') : 'los admins de su cuenta';
    const ok = await confirm(
      <>
        Sale otra vez por correo a <strong>{a}</strong>{r.solo_correo ? '' : ', y al grupo de su cuenta'}.
        <div style={{ marginTop: 12 }}>
          <Input type="email" placeholder="Otro correo (opcional)" onChange={(e) => { otro = e.target.value; }} aria-label="Otro correo" />
        </div>
      </>,
      { title: `¿Reenviar el recibo N.º ${numeroEnTexto(r.numero)}?`, confirmLabel: 'Reenviar', danger: false },
    );
    if (!ok) return;
    setOcupado(r.id); setFalla(null);
    const x = await reenviarReciboAction(r.id, { correo: otro.trim() || null }).catch(() => ({ ok: false as const, error: 'No pude reenviarlo.' }));
    setOcupado(null);
    if (!x.ok) { setFalla(x.error); return; }
    show(`Correo: ${ROTULO_CORREO[x.correo] ?? x.correo}`);
    void cargar(filtro);
  }

  async function anular(r: ReciboListado) {
    let avisar = r.correo_estado === 'enviado';
    const ok = await confirm(
      <>
        El N.º {numeroEnTexto(r.numero)} queda gastado y sus órdenes se liberan: se corrige cargando otro.
        {r.correo_estado === 'enviado' && (
          <div style={{ marginTop: 12 }}>
            <Checkbox checked={avisar} onChange={(v) => { avisar = v; }} label="Avisarle a quien lo recibió" />
          </div>
        )}
      </>,
      { title: `¿Anular el recibo N.º ${numeroEnTexto(r.numero)}?`, confirmLabel: 'Anular el recibo' },
    );
    if (!ok) return;
    setOcupado(r.id); setFalla(null);
    const x = await anularReciboAction(r.id, avisar).catch(() => ({ ok: false as const, error: 'No pude anularlo.' }));
    setOcupado(null);
    if (!x.ok) { setFalla(x.error); return; }
    show('Recibo anulado');
    void cargar(filtro);
  }

  async function devuelto(r: ReciboListado) {
    const ok = await confirm(<>Queda marcado devuelto, con el mismo número. Si el correo ya le llegó, le avisamos una vez.</>,
      { title: `¿Marcar devuelto el N.º ${numeroEnTexto(r.numero)}?`, confirmLabel: 'Marcar devuelto' });
    if (!ok) return;
    setOcupado(r.id); setFalla(null);
    const x = await marcarDevueltoReciboAction(r.id).catch(() => ({ ok: false as const, error: 'No pude marcarlo.' }));
    setOcupado(null);
    if (!x.ok) { setFalla(x.error); return; }
    show('Marcado devuelto');
    void cargar(filtro);
  }

  if (!datos) {
    return (
      <Seccion titulo="Recibos">
        <div aria-busy="true" style={{ padding: '6px 2px' }}><SkeletonLines lines={4} /></div>
      </Seccion>
    );
  }
  if (!datos.ok) return <Seccion titulo="Recibos"><Alert tono="bad">{datos.error}</Alert></Seccion>;
  if (datos.faltaLaMigracion) {
    return (
      <Seccion titulo="Recibos">
        <EmptyState inline titulo="Los recibos todavía no están listos" detalle="Falta aplicar la migración 0397 en la base." />
      </Seccion>
    );
  }

  const opcionesCuenta = [{ value: '', label: 'Todas las cuentas' }, ...datos.cuentas.map((c) => ({ value: String(c.id), label: c.nombre }))];
  const vigentes = Object.entries(datos.totales.vigentes);
  const devueltos = Object.entries(datos.totales.devueltos);

  return (
    <Seccion titulo="Recibos" accion={<Button size="sm" onClick={() => setAbierto(true)}>Cargar pago</Button>}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <div style={{ width: 160 }}>
          <Select label="Mes" value={filtro.mes ?? ''} onChange={(v) => setFiltro((f) => ({ ...f, mes: v || null }))} options={[{ value: '', label: 'Todos' }, ...meses]} />
        </div>
        <div style={{ width: 220 }}>
          <Select label="Cuenta" value={filtro.destinoWs ? String(filtro.destinoWs) : ''} onChange={(v) => setFiltro((f) => ({ ...f, destinoWs: v ? Number(v) : null }))} options={opcionesCuenta} />
        </div>
        <div style={{ width: 160 }}>
          <Select label="Medio" value={filtro.medio ?? ''} onChange={(v) => setFiltro((f) => ({ ...f, medio: v || null }))} options={[{ value: '', label: 'Todos' }, ...MEDIOS.map((m) => ({ value: m, label: ROTULO_MEDIO[m] }))]} />
        </div>
        <div style={{ width: 170 }}>
          <Select label="Estado" value={filtro.estado ?? ''} onChange={(v) => setFiltro((f) => ({ ...f, estado: (v || null) as EstadoRecibo | null }))}
            options={[{ value: '', label: 'Todos' }, ...(Object.keys(ROTULO_ESTADO_RECIBO) as EstadoRecibo[]).map((e) => ({ value: e, label: ROTULO_ESTADO_RECIBO[e] }))]} />
        </div>
        <div style={{ paddingBottom: 8 }}>
          <Checkbox checked={!!filtro.soloFallas} onChange={(v) => setFiltro((f) => ({ ...f, soloFallas: v }))} label="Sólo los que no salieron" />
        </div>
      </div>

      {falla && <div style={{ marginBottom: 10 }}><Alert tono="bad" onCerrar={() => setFalla(null)}>{falla}</Alert></div>}

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginBottom: 10, fontVariantNumeric: 'tabular-nums' }}>
        <span>Total: <strong style={{ color: 'var(--ink)' }}>{vigentes.length ? vigentes.map(([m, v]) => formatoMonto(v, m)).join(' + ') : '—'}</strong></span>
        {devueltos.length > 0 && <span>Devuelto: {devueltos.map(([m, v]) => formatoMonto(v, m)).join(' + ')}</span>}
        {datos.alTope && <span>Se muestran los 200 más nuevos.</span>}
        {cargando && <span>Actualizando…</span>}
      </div>

      {datos.recibos.length === 0 ? (
        <EmptyState inline titulo="Todavía no hay recibos" detalle="Cuando entre un pago, su recibo aparece aquí." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {datos.recibos.map((r) => {
            const medios = [...new Set(r.pagos.map((p) => (esMedio(p.medio) ? ROTULO_MEDIO[p.medio] : p.medio)))].join(' y ');
            const conComprobante = r.pagos.filter((p) => p.comprobante_path && !p.anulado);
            return (
              <div key={r.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '10px 18px', padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)' }}>
                <Celda ancho={70} rotulo="N.º"><div style={{ fontWeight: 650, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{numeroEnTexto(r.numero)}</div></Celda>
                <Celda ancho={190} rotulo="A nombre de">
                  <div style={{ fontWeight: 600, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{r.a_nombre}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2, overflowWrap: 'anywhere' }}>{r.lineas.map((l) => l.concepto).join(', ')}</div>
                  {r.nota_interna && <Nota>{r.nota_interna}</Nota>}
                </Celda>
                <Celda ancho={130} rotulo="Recibido">
                  <div style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{totalesEnTexto(r.totales_recibido)}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>{medios}{r.origen === 'manual' && <Tag>a mano</Tag>}</div>
                </Celda>
                <Celda ancho={110} rotulo="Fecha"><div style={{ color: 'var(--ink)' }}>{fechaCorta(r.fecha_pago)}</div></Celda>
                <Celda ancho={130} rotulo="Estado">
                  <Status tono={TONO_ESTADO[r.estado]}>{ROTULO_ESTADO_RECIBO[r.estado]}</Status>
                  {r.disputa_texto && <Nota>{r.disputa_texto}</Nota>}
                </Celda>
                <Celda ancho={170} rotulo="Correo · WhatsApp">
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Status tono={TONO_ENVIO[r.correo_estado] ?? 'neutral'}>{ROTULO_CORREO[r.correo_estado] ?? r.correo_estado}</Status>
                    <Status tono={TONO_ENVIO[r.wa_estado] ?? 'neutral'}>{ROTULO_WA[r.wa_estado] ?? r.wa_estado}</Status>
                  </div>
                  {(r.correo_error || r.wa_error) && <Nota>{r.correo_error ?? r.wa_error}</Nota>}
                </Celda>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <a className="mk-btn mk-btn--secondary mk-btn--sm" href={`/api/admin/recibos/${r.id}/pdf`}>Bajar</a>
                  {conComprobante.map((p, i) => (
                    <a key={p.id} className="mk-btn mk-btn--tertiary mk-btn--sm" href={`/api/admin/recibos/${r.id}/comprobante/${p.id}`} target="_blank" rel="noopener noreferrer">
                      {conComprobante.length > 1 ? `Comprobante ${i + 1}` : 'Comprobante'}
                    </a>
                  ))}
                  {r.estado === 'emitido' && <Button size="sm" variant="tertiary" loading={ocupado === r.id} onClick={() => void reenviar(r)}>Reenviar</Button>}
                  {r.origen === 'manual' && r.estado === 'emitido' && <Button size="sm" variant="tertiary" loading={ocupado === r.id} onClick={() => void devuelto(r)}>Marcar devuelto</Button>}
                  {r.origen === 'manual' && r.estado !== 'anulado' && <Button size="sm" variant="tertiary" loading={ocupado === r.id} onClick={() => void anular(r)}>Anular</Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DatosDelRecibo emisor={datos.emisor} waSolo={datos.waSolo} onError={setFalla} onGuardado={(m) => show(m)} />

      {abierto && (
        <CargarPago
          cuentas={datos.cuentas}
          planes={datos.planes}
          onCerrar={() => setAbierto(false)}
          onEmitido={(m) => { setAbierto(false); show(m); void cargar(filtro); router.refresh(); }}
        />
      )}
      {confirmNode}
      <Toast state={toast} onClose={clear} />
    </Seccion>
  );
}

/** «Datos del recibo»: el emisor (se copia como foto a cada recibo) y el asunto y la primera frase del correo. */
function DatosDelRecibo({ emisor, waSolo, onError, onGuardado }: { emisor: Emisor; waSolo: boolean; onError: (e: string) => void; onGuardado: (m: string) => void }) {
  const [e, setE] = useState<Emisor>(emisor);
  const [wa, setWa] = useState(waSolo);
  const [guardando, setGuardando] = useState(false);
  const cambio = JSON.stringify(e) !== JSON.stringify(emisor);
  async function guardar() {
    setGuardando(true);
    const r = await guardarEmisorAction(e).catch(() => ({ ok: false as const, error: 'No pude guardar.' }));
    setGuardando(false);
    if (!r.ok) { onError(r.error); return; }
    setE(r.emisor);
    onGuardado('Datos guardados');
  }
  async function cambiarWa(v: boolean) {
    setWa(v);
    const r = await guardarWaSoloAction(v).catch(() => ({ ok: false as const, error: 'No pude guardar.' }));
    if (!r.ok) { setWa(!v); onError(r.error); }
  }
  const campo = (k: keyof Emisor, label: string, hint?: string) => (
    <TextField label={label} hint={hint} value={e[k] ?? ''} onChange={(ev) => setE((x) => ({ ...x, [k]: ev.target.value }))} maxLength={k === 'intro' ? 400 : 200} />
  );
  return (
    <div style={{ marginTop: 22, padding: '16px 18px', border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <strong style={{ color: 'var(--ink)' }}>Datos del recibo</strong>
        <a className="mk-btn mk-btn--tertiary mk-btn--sm" href="/api/admin/recibos/ejemplo" target="_blank" rel="noopener noreferrer">Ver ejemplo</a>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {campo('nombre', 'Nombre')}
        {campo('documento', 'Documento', 'Vacío no se imprime.')}
        {campo('direccion', 'Dirección')}
        {campo('correo', 'Correo de contacto')}
        {campo('asunto', 'Asunto del correo', 'Puedes usar {{numero}} y {{nombre}}.')}
        {campo('intro', 'Primera frase del correo', 'Con {{monto}}, {{concepto}}, {{fecha}} y {{medio}}.')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
        <Switch checked={wa} onChange={(v) => void cambiarWa(v)} label="WhatsApp a quien paga solo" />
        <Button size="sm" disabled={!cambio} loading={guardando} onClick={() => void guardar()}>Guardar</Button>
      </div>
    </div>
  );
}

function Seccion({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 'var(--fs-sect)', fontWeight: 650, color: 'var(--ink)' }}>{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}

function Celda({ ancho, rotulo, children }: { ancho: number; rotulo?: string; children: ReactNode }) {
  return (
    <div style={{ flex: `1 1 ${ancho}px`, minWidth: 0, fontSize: 14 }}>
      {rotulo && <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 4 }}>{rotulo}</div>}
      {children}
    </div>
  );
}

function Nota({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 4, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{children}</div>;
}

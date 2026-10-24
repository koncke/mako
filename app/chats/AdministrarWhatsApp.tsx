'use client';

// =============================================================================
// AdministrarWhatsApp — un número de WhatsApp, administrado sin salir de Chats (24/10/2026)
// =============================================================================
// docs/diseno-chats.md §8.4. Martín (por el Cerebro, 24/10): «Mira como se ve toda la tab vieja de WhatsApp por detrás eso
// está muy mal... Y también el modal que salta con mucho texto y no se entiende». Es lo que era «WhatsApp de empresa»
// (app/whatsapp/EvolutionConnect.tsx, sobre la tab vieja), corto y sobre Chats:
//   · arriba, el estado y el número;
//   · el nombre y «Usar por default», sólo con más de un número (con uno no distinguen nada);
//   · «Las automatizaciones envían», el «Chatbot: ON/OFF» que vivía en la cabecera de la tab vieja (sólo el admin);
//   · el espejo de mensajes, SÓLO si está roto («Los mensajes nuevos no llegan» y Reparar);
//   · «Sincronizar conversaciones», un botón secundario;
//   · abajo, en texto y con confirmación, lo que borra: «Borrar el historial» y «Desconectar».
// Sin la instrucción de vincular: el número ya está vinculado.
//
// ⚠️ SINCRONIZAR SE PREGUNTA UNA SOLA VEZ: recién conectado (`recien`, o el QR escaneado acá mismo), en una pantalla que no
//    tiene otra cosa. La tab vieja lo preguntaba en un bloque y además lo ofrecía en otro, con un párrafo cada uno.
// ⚠️ DESCONECTADO, EL MISMO MODAL MUESTRA EL QR (EvolutionConnect `inline`, el de ConectarMedio): administrar un número
//    caído es volver a vincularlo, y la otra salida («Quitar este número», si es uno extra) está ahí mismo.

import { useCallback, useEffect, useState } from 'react';
import { Button, Modal, Switch, useConfirm } from '@/app/_ui';
import { EvolutionConnect } from '@/app/whatsapp/EvolutionConnect';
import { avisarMedioConectado } from '@/app/automations/ConectarMedio';
import { IconoCanal } from './iconos-canal';
import './administrar-whatsapp.css';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

type Estado = 'desconectado' | 'conectando' | 'conectado' | 'error';
type Espejo = 'ok' | 'sin_secret' | 'secret_prod' | 'no_registrado' | 'url_distinta' | 'error';
/** Los que arregla el botón; los demás son de la configuración de la plataforma (el equipo técnico). */
const REPARABLE: readonly Espejo[] = ['no_registrado', 'error'];

type Leido = { estado: Estado; numero: string | null; etiqueta: string; esDefault: boolean; total: number };

async function pedir<T>(url: string, cuerpo?: unknown): Promise<{ status: number; j: T | null }> {
  try {
    const r = await fetch(url, cuerpo === undefined ? { cache: 'no-store' }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    return { status: r.status, j: (await r.json().catch(() => null)) as T | null };
  } catch {
    return { status: 0, j: null };
  }
}

export function AdministrarWhatsApp({ linea, rotulo, recien = false, onCerrar, onCambio }: {
  /** `evolution_instancias.instance_name` de la línea. */
  linea: string;
  /** Cómo se llama en Chats («Ventas», o el número). */
  rotulo: string;
  /** Se acaba de conectar (el QR de «Conectar un canal»): la única pantalla es la pregunta de sincronizar. */
  recien?: boolean;
  onCerrar: () => void;
  /** Algo cambió (el nombre, el default, desconectó, sincronizó): Chats relee la lista. */
  onCambio: () => void;
}) {
  const { confirm, confirmNode } = useConfirm();
  const [leido, setLeido] = useState<Leido | null>(null);
  const [errorLectura, setErrorLectura] = useState(false);
  const [preguntar, setPreguntar] = useState(recien);
  const [espejo, setEspejo] = useState<Espejo | null>(null);
  const [envio, setEnvio] = useState<boolean | null>(null);
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState<'sync' | 'borrar' | 'desconectar' | 'default' | 'reparar' | 'envio' | null>(null);
  const [nota, setNota] = useState<{ texto: string; mal?: boolean } | null>(null);

  const leer = useCallback(async () => {
    const { status, j } = await pedir<{ ok: boolean; estado: Estado; numero: string | null; linea?: string | null; lineas?: Array<{ linea: string; etiqueta: string | null; esDefault: boolean }> }>(
      `/api/whatsapp/evolution?linea=${encodeURIComponent(linea)}`);
    if (!j?.ok) { setErrorLectura(status !== 403); return; }
    const esta = (j.lineas ?? []).find((l) => l.linea === linea);
    setLeido({ estado: j.estado, numero: j.numero, etiqueta: esta?.etiqueta ?? '', esDefault: esta?.esDefault ?? true, total: (j.lineas ?? []).length });
    setNombre(esta?.etiqueta ?? '');
    setErrorLectura(false);
  }, [linea]);
  useEffect(() => { void leer(); }, [leer]);

  const conectado = leido?.estado === 'conectado';
  // El espejo y el interruptor, sólo con el número conectado (desconectado, el modal es el QR).
  useEffect(() => {
    if (!conectado) return;
    let vivo = true;
    void pedir<{ ok: boolean; estado: Espejo }>('/api/whatsapp/evolution', { action: 'webhook-estado', linea }).then(({ j }) => { if (vivo && j?.ok) setEspejo(j.estado); });
    // 403 = no es admin: el interruptor no se dibuja (lo cambia el admin; /api/whatsapp/envio).
    void pedir<{ ok: boolean; envioHabilitado?: boolean }>('/api/whatsapp/envio').then(({ j }) => { if (vivo && j?.ok) setEnvio(Boolean(j.envioHabilitado)); });
    return () => { vivo = false; };
  }, [conectado, linea]);

  async function accion<T extends { ok: boolean; error?: string }>(cual: NonNullable<typeof ocupado>, cuerpo: Record<string, unknown>): Promise<T | null> {
    setOcupado(cual); setNota(null);
    const { j } = await pedir<T>('/api/whatsapp/evolution', { ...cuerpo, linea });
    setOcupado(null);
    if (!j?.ok) { setNota({ texto: j?.error || 'No se pudo. Prueba de nuevo.', mal: true }); return null; }
    return j;
  }

  async function sincronizar() {
    const j = await accion<{ ok: boolean; error?: string; chats?: number; mensajes?: number }>('sync', { action: 'sincronizar' });
    setPreguntar(false);
    if (j) { setNota({ texto: `Listo: ${j.chats ?? 0} chats y ${j.mensajes ?? 0} mensajes.` }); onCambio(); }
  }
  async function borrarHistorial() {
    if (!(await confirm('Se borran los mensajes guardados en MaKo. Tu WhatsApp no cambia.', { title: 'Borrar el historial', confirmLabel: 'Borrar' }))) return;
    const j = await accion<{ ok: boolean; error?: string; borrados?: number }>('borrar', { action: 'borrar-chats' });
    if (j) { setNota({ texto: 'Historial borrado.' }); onCambio(); }
  }
  async function desconectar() {
    if (!(await confirm('Para volver a usarlo vas a escanear el QR otra vez.', { title: `Desconectar ${rotulo}`, confirmLabel: 'Desconectar' }))) return;
    if (await accion('desconectar', { action: 'desconectar' })) { onCambio(); onCerrar(); }
  }
  async function guardarNombre() {
    if (!leido || nombre.trim() === leido.etiqueta.trim()) return;
    if (await accion('default', { action: 'renombrar-linea', etiqueta: nombre })) { setLeido({ ...leido, etiqueta: nombre.trim() }); onCambio(); }
  }
  async function usarPorDefault() {
    if (leido && await accion('default', { action: 'predeterminar-linea' })) { setLeido({ ...leido, esDefault: true }); onCambio(); }
  }
  async function reparar() {
    const j = await accion<{ ok: boolean; error?: string; estado?: Espejo }>('reparar', { action: 'reparar-webhook' });
    if (j?.estado) setEspejo(j.estado);
  }
  async function cambiarEnvio(on: boolean) {
    setOcupado('envio'); setNota(null);
    const { j } = await pedir<{ ok: boolean; envioHabilitado?: boolean; error?: string }>('/api/whatsapp/envio', { on });
    setOcupado(null);
    if (j?.ok) setEnvio(Boolean(j.envioHabilitado));
    else setNota({ texto: j?.error || 'No se pudo cambiar.', mal: true });
  }

  // El nombre del número («Ventas»); sin uno propio, «Tu número» (arriba ya dice que es WhatsApp: no se repite).
  const titulo = rotulo && rotulo !== 'WhatsApp' ? rotulo : 'Tu número';
  const encabezado = <span className="rio-adm-tipo"><IconoCanal canal="whatsapp" size={14} />WhatsApp</span>;

  // ── Leyendo / no se pudo leer ──
  if (!leido) {
    return (
      <Modal titulo={titulo} encabezado={encabezado} onCerrar={onCerrar} ancho={440}>
        <div className="rio-adm-estado" role="status">
          {errorLectura
            ? <><span>No pude leer este número.</span><Button variant="secondary" size="sm" onClick={() => void leer()}>Reintentar</Button></>
            : <span className="rio-adm-dim">Leyendo…</span>}
        </div>
      </Modal>
    );
  }

  // ── Desconectado: el QR, como al conectarlo ──
  if (!conectado) {
    return (
      <Modal titulo={titulo} encabezado={encabezado} onCerrar={onCerrar} ancho={440}>
        <div className="rio-adm-qr">
          <EvolutionConnect key={`linea-${linea}`} linea={linea} inline panelVisible ocultarChip
            onEstado={(e) => { if (e === 'conectado') { avisarMedioConectado(); setPreguntar(true); void leer(); onCambio(); } }}
            onLineasCambiaron={() => { onCambio(); onCerrar(); }} />
        </div>
      </Modal>
    );
  }

  const numero = leido.numero;

  // ── Recién conectado: una sola pregunta ──
  if (preguntar) {
    return (
      <Modal titulo={titulo} encabezado={encabezado} onCerrar={onCerrar} ancho={440}>
        <div className="rio-adm-recien">
          <span className="rio-adm-check" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 6.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <strong className="rio-adm-recien-tit">Conectado</strong>
          {numero && <span className="rio-adm-numero">{numero}</span>}
          <p className="rio-adm-pregunta">¿Traes las conversaciones que ya tienes en este número?</p>
          <div className="rio-adm-botones">
            <Button variant="secondary" onClick={() => setPreguntar(false)} disabled={ocupado === 'sync'}>Ahora no</Button>
            <Button onClick={() => void sincronizar()} loading={ocupado === 'sync'}>Traerlas</Button>
          </div>
          {nota?.mal && <p className="rio-adm-nota" data-mal="">{nota.texto}</p>}
        </div>
      </Modal>
    );
  }

  const espejoRoto = espejo && espejo !== 'ok';
  return (
    <Modal titulo={titulo} encabezado={encabezado} onCerrar={onCerrar} ancho={440}
      pie={(
        // Lo que borra, abajo y en texto (Cerebro, 24/10): no compite con lo de todos los días.
        <div className="rio-adm-pie">
          <button type="button" className="rio-adm-peligro" onClick={() => void borrarHistorial()} disabled={!!ocupado}>
            {ocupado === 'borrar' ? 'Borrando…' : 'Borrar el historial'}
          </button>
          <button type="button" className="rio-adm-peligro" onClick={() => void desconectar()} disabled={!!ocupado}>
            {ocupado === 'desconectar' ? 'Desconectando…' : 'Desconectar'}
          </button>
        </div>
      )}>
      {confirmNode}
      <div className="rio-adm-estado">
        <span className="rio-adm-punto" aria-hidden="true" />
        <span>Conectado</span>
        {numero && <span className="rio-adm-numero">{numero}</span>}
      </div>

      {leido.total > 1 && (
        <div className="rio-adm-fila">
          <label className="rio-adm-campo">
            <span className="rio-adm-rotulo">Nombre</span>
            <input className="rio-adm-entrada" value={nombre} maxLength={40} placeholder="Ventas, Soporte…" onChange={(e) => setNombre(e.target.value)}
              onBlur={() => void guardarNombre()} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
          </label>
          {leido.esDefault
            ? <span className="rio-adm-dim">Por default</span>
            : <Button variant="secondary" size="sm" onClick={() => void usarPorDefault()} disabled={!!ocupado}>Usar por default</Button>}
        </div>
      )}

      {envio !== null && (
        <div>
          <Switch checked={envio} disabled={ocupado === 'envio'} onChange={(v) => void cambiarEnvio(v)}
            label="Las automatizaciones envían"
            hint={envio ? undefined : 'En pausa: los pasos quedan esperando.'} />
        </div>
      )}

      {espejoRoto && (
        <div className="rio-adm-aviso" role="alert">
          <span>Los mensajes nuevos no están llegando.</span>
          {REPARABLE.includes(espejo)
            ? <Button variant="secondary" size="sm" onClick={() => void reparar()} loading={ocupado === 'reparar'}>Reparar</Button>
            : <span className="rio-adm-dim">Avísale a soporte.</span>}
          <ReportarASoporte />
        </div>
      )}

      <div className="rio-adm-fila">
        <Button variant="secondary" size="sm" onClick={() => void sincronizar()} loading={ocupado === 'sync'}>Sincronizar conversaciones</Button>
        {nota && <span className="rio-adm-nota" data-mal={nota.mal ? '' : undefined} role="status">{nota.texto}</span>}
      </div>
    </Modal>
  );
}

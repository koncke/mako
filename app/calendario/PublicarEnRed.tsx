'use client';

// =============================================================================
// PublicarEnRed — programar una Publicación del Calendario en la red, por Zernio (28/10/2026)
// =============================================================================
// Martín a Teo: «publicás reels e historias desde el Calendar los días y a la hora que elijas». Va dentro del modal del
// evento (EventoModal), sólo para una Publicación que ya existe: la cuenta donde sale, el archivo, el texto y «Programar».
//
// Lo que no se ve en la firma:
//   · SALE A LA HORA GUARDADA: si la fecha o la hora del modal cambiaron y no se guardaron, «Programar» espera (`sinGuardar`).
//   · PROGRAMAR SE CONFIRMA: publica afuera, a la vista de los seguidores de esa cuenta.
//   · LO PROGRAMADO NO SE TOCA: el archivo, la cuenta y el texto se cambian después de «Cancelar la programación»; el modal
//     esconde «Borrar» y «Ya se publicó» mientras tanto (`onProgramada`).
//   · EL ARCHIVO lo sube el navegador a una URL firmada que arma el server (la ruta no la elige el navegador).
//   · LO QUE MaKo NO PUEDE ACLARAR SOLO (la verificación del 29/10): una en duda que sí quedó en Zernio, o una programada con
//     OTRA clave de Zernio (no se relee ni se cancela desde acá), se suelta con «Ya lo resolví en Zernio».

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useConectarIntegracion } from '@/app/_components/ConectarIntegracion';
import { Button } from '@/app/_ui/Button';
import { Select } from '@/app/_ui/Select';
import { TextField } from '@/app/_ui/Field';
import { useConfirm } from '@/app/_ui/Confirm';
import { subirConProgreso } from '@/app/customer-success/curso/subir-video';
import {
  cancelarPublicacionAction, guardarPublicacionAction, noQuedoProgramadaAction, programarAction, publicacionAction, resolverEnZernioAction,
  subidaArchivoAction,
} from './actions';
import { MIMES_PUBLICAR, ROTULO_RED, TOPE_TEXTO, type DatosPublicacion } from '@/lib/calendario-publicar-reglas';
import type { CuentaParaPublicar } from '@/lib/calendario-publicar';

type Cuentas = { ok: true; cuentas: CuentaParaPublicar[] } | { ok: false; motivo: string };

export function PublicarEnRed({ id, sinGuardar, onProgramada, onCambio }: {
  id: string;
  /** La fecha, la hora o el formato cambiaron en el modal y no se guardaron. */
  sinGuardar: boolean;
  /** Avisa si está esperando a Zernio (el modal esconde «Borrar» y «Ya se publicó»). */
  onProgramada: (programada: boolean) => void;
  /** Algo cambió en el server: el Calendario se refresca. */
  onCambio: () => void;
}) {
  const [datos, setDatos] = useState<DatosPublicacion | null | undefined>(undefined);
  const [cuentas, setCuentas] = useState<Cuentas | null>(null);
  const [otraClave, setOtraClave] = useState(false);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [subida, setSubida] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm, confirmNode } = useConfirm();
  const cargarRef = useRef<() => void>(() => {});
  const integracion = useConectarIntegracion({ onConectado: () => cargarRef.current() });

  const cargar = useCallback(async () => {
    const r = await publicacionAction(id).catch(() => null);
    if (!r) { setError('No pude leer la publicación.'); return; }
    setDatos(r.datos);
    setCuentas(r.cuentas);
    setOtraClave(r.otraClave === true);
    setTexto(r.datos?.texto ?? '');
    onProgramada(r.datos?.publicacion === 'programada' || r.datos?.publicacion === 'programando' || r.datos?.publicacion === 'dudosa');
  }, [id, onProgramada]);
  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => { cargarRef.current = () => { void cargar(); }; }, [cargar]);

  const guardar = async (cambio: Parameters<typeof guardarPublicacionAction>[1]) => {
    setError(null);
    const r = await guardarPublicacionAction(id, cambio);
    if (!r.ok) { setError(r.error); return false; }
    await cargar();
    return true;
  };

  const subir = async (f: File) => {
    setError(null);
    const firma = await subidaArchivoAction(id, f.type);
    if (!firma.ok) { setError(firma.error); return; }
    setSubida(0);
    try {
      await subirConProgreso(firma.url, f, firma.apikey, setSubida, 'JPG, PNG, WEBP, MP4 o MOV').promesa;
      await guardar({ archivo: firma.ruta, archivoTipo: firma.tipo });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir.');
    } finally {
      setSubida(null);
    }
  };

  const programar = async () => {
    if (!(await confirm('Se publica sola a esa hora y la ven los seguidores de esa cuenta. Puedes cancelarla antes de que salga.', { title: 'Programar la publicación', confirmLabel: 'Programar', danger: false }))) return;
    setOcupado(true);
    setError(null);
    try {
      if (texto !== (datos?.texto ?? '') && !(await guardar({ texto }))) return;
      const r = await programarAction([id]);
      if ('error' in r) setError(r.error);
      else if (r.fallidas.length) setError(r.fallidas[0].motivo);
      await cargar();
      onCambio();
    } finally {
      setOcupado(false);
    }
  };

  // Una en duda: reintentar repite el MISMO pedido a Zernio si fue hace unos minutos (el server decide); si no, lo dice.
  const reintentar = async () => {
    setOcupado(true);
    setError(null);
    try {
      const r = await programarAction([id]);
      if ('error' in r) setError(r.error);
      else if (r.fallidas.length) setError(r.fallidas[0].motivo);
      await cargar();
      onCambio();
    } finally {
      setOcupado(false);
    }
  };

  const noQuedo = async () => {
    if (!(await confirm('Revisaste en Zernio y la publicación NO está programada. Vuelve a quedar lista para programarla.', { title: 'No quedó programada', confirmLabel: 'No quedó programada', danger: false }))) return;
    setOcupado(true);
    try {
      const r = await noQuedoProgramadaAction(id);
      if (!r.ok) setError(r.error);
      await cargar();
      onCambio();
    } finally {
      setOcupado(false);
    }
  };

  const resolver = async () => {
    if (!(await confirm('MaKo deja de seguirla. El evento queda en el Calendario sin cuenta: si la vuelves a programar, sale otra.', { title: 'Ya lo resolví en Zernio', confirmLabel: 'Ya lo resolví', danger: false }))) return;
    setOcupado(true);
    try {
      const r = await resolverEnZernioAction(id);
      if (!r.ok) setError(r.error);
      await cargar();
      onCambio();
    } finally {
      setOcupado(false);
    }
  };

  const cancelar = async () => {
    if (!(await confirm('Se saca de la red antes de que salga. El evento queda en el Calendario.', { title: 'Cancelar la programación', confirmLabel: 'Cancelar la programación' }))) return;
    setOcupado(true);
    try {
      const r = await cancelarPublicacionAction(id);
      if (!r.ok) setError(r.error);
      await cargar();
      onCambio();
    } finally {
      setOcupado(false);
    }
  };

  if (datos === undefined && !error) return <div style={CAJA}><span style={DIM}>Cargando la publicación…</span></div>;
  if (datos === null) return <div style={CAJA}><span style={DIM}>Programar en la red todavía no está disponible en tu cuenta.</span></div>;

  const d = datos as DatosPublicacion;
  const lista = cuentas && cuentas.ok ? cuentas.cuentas : [];
  const cuenta = lista.find((c) => c.accountId === d.cuenta_red) ?? null;
  const nombreCuenta = cuenta ? `${ROTULO_RED[cuenta.red]} · ${cuenta.usuario ? `@${cuenta.usuario}` : cuenta.nombre}` : d.red ? ROTULO_RED[d.red] : '';
  const bloqueada = d.publicacion === 'programada' || d.publicacion === 'programando';

  return (
    <div style={CAJA} data-publicar-en-red="">
      <strong style={{ fontSize: 14 }}>Publicar en la red</strong>
      {d.publicacion === 'publicada' && (
        <span style={{ fontSize: 13.5 }}>Publicada en {nombreCuenta}.{d.publicacion_url && <> <a href={d.publicacion_url} target="_blank" rel="noreferrer">Ver la publicación</a></>}</span>
      )}
      {bloqueada && (
        <>
          {otraClave && d.publicacion === 'programada' ? (
            <>
              {/* Con otra clave, Zernio no la encuentra: ni se relee ni se cancela desde acá (la verificación del 29/10). */}
              <span style={{ fontSize: 13.5 }}>Se programó con otra clave de Zernio: cancélala (o déjala) desde esa cuenta.</span>
              <Button variant="secondary" size="sm" loading={ocupado} onClick={() => void resolver()}>Ya lo resolví en Zernio</Button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 13.5 }}>{d.publicacion === 'programando' ? 'Programándose…' : `Programada en ${nombreCuenta}: sale sola a la hora del evento.`}</span>
              <Button variant="secondary" size="sm" loading={ocupado} disabled={d.publicacion !== 'programada'} onClick={() => void cancelar()}>Cancelar la programación</Button>
            </>
          )}
        </>
      )}
      {d.publicacion === 'dudosa' && (
        <>
          {/* Zernio no contestó: puede haberla creado. Reprogramar la duplicaría (la verificación del 28/10): primero se aclara. */}
          <span role="alert" style={{ fontSize: 13, color: 'var(--bad)' }}>{d.publicacion_motivo}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" size="sm" loading={ocupado} onClick={() => void reintentar()}>Reintentar</Button>
            <Button variant="tertiary" size="sm" disabled={ocupado} onClick={() => void noQuedo()}>No quedó programada</Button>
            <Button variant="tertiary" size="sm" disabled={ocupado} onClick={() => void resolver()}>Ya lo resolví en Zernio</Button>
          </div>
        </>
      )}
      {!bloqueada && d.publicacion !== 'publicada' && d.publicacion !== 'dudosa' && (
        <>
          {d.publicacion === 'fallo' && d.publicacion_motivo && <span role="alert" style={{ fontSize: 13, color: 'var(--bad)' }}>No salió: {d.publicacion_motivo}</span>}
          {d.publicacion === null && d.publicacion_motivo && <span style={DIM}>{d.publicacion_motivo}</span>}
          {cuentas && !cuentas.ok ? (
            <span style={{ ...DIM, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {cuentas.motivo === 'sin-clave' ? 'Conecta Instagram, Facebook, TikTok o YouTube para programar desde aquí.' : 'No pude leer tus cuentas conectadas.'}
              {/* Sin salir de la tab (tests/integracion-sin-salir.test.ts): el modal de Zernio de /integraciones, acá. */}
              <Button variant="secondary" size="sm" onClick={() => integracion.abrir('zernio')}>Conectar una cuenta</Button>
            </span>
          ) : (
            <Select label="Dónde se publica" value={d.cuenta_red ?? ''} disabled={ocupado || !lista.length}
              onChange={(v) => { const c = lista.find((x) => x.accountId === v); if (c) void guardar({ red: c.red, cuentaRed: c.accountId }); }}
              options={[
                ...(d.cuenta_red ? [] : [{ value: '', label: lista.length ? 'Elige una cuenta' : 'No hay cuentas conectadas', icono: 'enviar' as const }]),
                ...lista.map((c) => ({ value: c.accountId, label: `${ROTULO_RED[c.red]} · ${c.usuario ? `@${c.usuario}` : c.nombre}${c.vencida ? ' (reconectar)' : ''}`, icono: 'enviar' as const })),
              ]} />
          )}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={DIM}>{d.archivo ? `Archivo: ${d.archivo_tipo === 'video' ? 'un video' : 'una imagen'} subido` : 'El archivo (imagen o video)'}</span>
            <input type="file" accept={MIMES_PUBLICAR.join(',')} disabled={ocupado || subida != null}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void subir(f); }} />
            {subida != null && <span style={DIM}>Subiendo… {subida}%</span>}
          </label>
          <TextField label="Texto de la publicación" multiline value={texto} maxLength={TOPE_TEXTO} disabled={ocupado}
            onChange={(e) => setTexto(e.target.value)} onBlur={() => { if (texto !== d.texto) void guardar({ texto }); }} />
          {d.red === 'youtube' && <span style={DIM}>En YouTube, el título del evento sale como título del video (hasta 100 caracteres).</span>}
          {sinGuardar && <span style={DIM}>Guarda los cambios de la fecha y la hora antes de programarla.</span>}
          <Button variant="primary" size="sm" loading={ocupado} disabled={sinGuardar || !d.cuenta_red || !d.archivo || subida != null}
            onClick={() => void programar()}>Programar</Button>
        </>
      )}
      {error && <span role="alert" style={{ fontSize: 13, color: 'var(--bad)' }}>{error}</span>}
      {confirmNode}
      {integracion.modal}
    </div>
  );
}

const CAJA: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2, transparent)' };
const DIM: CSSProperties = { fontSize: 13, color: 'var(--dim)' };

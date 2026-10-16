'use client';

// =============================================================================
// Información personal — la primera sección de «Tu cuenta» (15/10/2026)
// =============================================================================
// Copiada de «Información personal» de Google (myaccount.google.com/personal-info): tarjetas con filas
// —el dato a la izquierda, su valor al lado— y la fila ENTERA abre su edición, de a un dato por vez.
// Reemplaza a la grilla de campos pegados de antes (PerfilTabs), que Martín marcó: «esto se ve horrible».
//
// Los datos llegan del server (lib/perfil.ts → leerPerfil) en el primer render: sin el «Cargando…» de
// antes. Se guarda por POST /api/perfil, que es el mismo de siempre.
//
// En una «vista de otro» (la agencia o el super admin parados en un cliente) el perfil es el del
// CLIENTE, y se rotula: sin rótulo, los datos de otra persona se leen como los propios.

import { useRef, useState, type ChangeEvent } from 'react';
import type { Perfil, VistaPerfil } from '@/lib/perfil';
import { DIAL_DEFAULT, splitTelefono, unirTelefono } from '@/lib/paises';
import { Dropdown } from '../components/Dropdown';
import { TelefonoConPais } from '../_components/TelefonoConPais';
import { CuerpoGrupo, FilaAjustes, GrupoAjustes, TituloAjustes } from '../_ui/Ajustes';

const TZ_OPTS = [
  { value: 'America/Tijuana', label: 'Tijuana (PT)' },
  { value: 'America/Hermosillo', label: 'Hermosillo (MST)' },
  { value: 'America/Mexico_City', label: 'CDMX / Monterrey (CT)' },
  { value: 'America/New_York', label: 'Nueva York (ET)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET)' },
];

type Campo = 'nombre' | 'cargo' | 'empresa' | 'web' | 'bio' | 'telefono' | 'timezone';
const ROTULO: Record<Campo, string> = {
  nombre: 'Nombre', cargo: 'Cargo', empresa: 'Empresa', web: 'Sitio web', bio: 'Sobre ti', telefono: 'Teléfono', timezone: 'Zona horaria',
};
// Inventado: un placeholder con el nombre de un cliente real (era el de Mauricio y su negocio) se le
// muestra a todos los workspaces, y desde el 15/10/2026 también en la hoja del teléfono (/m/cuenta).
const EJEMPLO: Partial<Record<Campo, string>> = { nombre: 'Ana Torres', cargo: 'Fundadora', empresa: 'Estudio Norte', web: 'https://…' };

export function InformacionPersonal({ inicial, vista, sinTitulo = false }: {
  inicial: Perfil;
  vista: VistaPerfil;
  /** En la hoja del teléfono (/m/cuenta) el título lo pone la hoja. */
  sinTitulo?: boolean;
}) {
  const [perfil, setPerfil] = useState<Perfil>(inicial);
  const [editando, setEditando] = useState<Campo | null>(null);
  const [borrador, setBorrador] = useState('');
  // ⚠️ EL TELÉFONO CON EL PAÍS PRIMERO (punto 5 del 12/10/2026: «en todos lados que se configure
  // telefono es así»). La lada y el número viven aparte mientras se escribe —derivarlos del texto en
  // cada render tiraría la lada elegida con el número todavía vacío— y lo que se guarda sale en la MISMA
  // forma que enseña el ejemplo: «+» y los dígitos con el código de país (`+5216861234567`).
  const [tel, setTel] = useState<{ lada: string; numero: string }>({ lada: DIAL_DEFAULT, numero: '' });
  const [ocupado, setOcupado] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const persistir = async (p: Perfil): Promise<boolean> => {
    try {
      const j = await (await fetch('/api/perfil', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'perfil', perfil: p }) })).json();
      if (j.ok) { setPerfil(j.perfil as Perfil); return true; }
      // Un rechazo del server se dice: un botón que no hace nada se lee como guardado.
      setError(j.error ?? 'No se pudo guardar');
      return false;
    } catch {
      setError('No se pudo guardar');
      return false;
    }
  };

  const abrir = (c: Campo) => {
    setError(null);
    setEditando(c);
    if (c === 'telefono') {
      const { lada, resto } = splitTelefono(perfil.telefono ?? '');
      setTel({ lada, numero: resto });
    } else setBorrador(String(perfil[c] ?? ''));
  };

  const guardar = async () => {
    if (!editando) return;
    const valor = editando === 'telefono'
      ? (tel.numero.replace(/\D/g, '') ? `+${unirTelefono(tel.lada, tel.numero)}` : '')
      : borrador;
    setOcupado(true); setError(null);
    if (await persistir({ ...perfil, [editando]: valor })) setEditando(null);
    setOcupado(false);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null); setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const j = await (await fetch('/api/perfil/avatar', { method: 'POST', body: fd })).json();
      if (!j.ok) { setError(j.error ?? 'No se pudo subir la foto'); return; }
      await persistir({ ...perfil, avatarUrl: j.url as string }); // ya, para que se vea en la barra
    } catch (e2) { setError(e2 instanceof Error ? e2.message : String(e2)); }
    finally { setSubiendo(false); }
  };

  const titulo = vista.deOtro ? `Perfil de ${vista.cuenta || 'esta cuenta'}` : 'Información personal';
  const bajada = vista.deOtro ? 'Los datos de esta cuenta, no los tuyos.' : 'Tus datos y cómo te contactan. Los ve tu equipo.';

  if (vista.deOtro && (vista.sinNadie || vista.sinLeer)) {
    // «No hay nadie» y «no pude leer» son dos hechos: con la lectura caída, decir «nadie» sería afirmar
    // algo que no se miró. Y en ninguno de los dos hay formulario: no hay fila a la que guardarle nada.
    return (
      <>
        {!sinTitulo && <TituloAjustes titulo={titulo} />}
        <GrupoAjustes descripcion={vista.sinLeer ? 'No pude leer el perfil de esta cuenta.' : 'Esta cuenta todavía no tiene a nadie adentro.'} />
      </>
    );
  }

  /** Una fila: cerrada muestra el valor; abierta, su campo y los dos botones. */
  const fila = (c: Campo, valor: string) => {
    if (editando !== c) {
      return <FilaAjustes key={c} titulo={ROTULO[c]} detalle={valor || <span style={{ color: 'var(--faint)' }}>Agregar</span>} onClick={() => abrir(c)} />;
    }
    return (
      <div key={c} className="aj-fila" data-quieta="true" style={{ display: 'block', paddingTop: 18, paddingBottom: 18 }}>
        <label className="aj-rotulo" htmlFor={`perfil-${c}`}>{ROTULO[c]}</label>
        {c === 'telefono' ? (
          <TelefonoConPais lada={tel.lada} numero={tel.numero} placeholder="1 686 123 4567" anchoLada={112}
            inputStyle={{ height: 44, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 15, outline: 'none', width: '100%' }}
            onLada={(v) => setTel((t) => ({ ...t, lada: v }))} onNumero={(v) => setTel((t) => ({ ...t, numero: v }))} />
        ) : c === 'timezone' ? (
          <Dropdown value={borrador} options={TZ_OPTS} onChange={setBorrador} width="100%" />
        ) : c === 'bio' ? (
          <textarea id={`perfil-${c}`} className="aj-campo" style={{ height: 'auto', minHeight: 96, padding: 12, lineHeight: 1.5, resize: 'vertical' }}
            value={borrador} autoFocus onChange={(e) => setBorrador(e.target.value)} placeholder="Algo sobre ti o tu negocio (opcional)." />
        ) : (
          <input id={`perfil-${c}`} className="aj-campo" value={borrador} autoFocus placeholder={EJEMPLO[c]}
            onChange={(e) => setBorrador(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void guardar(); if (e.key === 'Escape') setEditando(null); }} />
        )}
        <div className="aj-acciones">
          <button type="button" className="aj-boton" disabled={ocupado} onClick={() => void guardar()}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
          <button type="button" className="aj-boton" data-variante="texto" onClick={() => { setEditando(null); setError(null); }}>Cancelar</button>
        </div>
      </div>
    );
  };

  const letra = (perfil.nombre || perfil.email || 'M').trim().slice(0, 1).toUpperCase();
  const zona = TZ_OPTS.find((o) => o.value === perfil.timezone)?.label ?? perfil.timezone;

  return (
    <>
      {!sinTitulo && <TituloAjustes titulo={titulo} bajada={bajada} />}
      {sinTitulo && vista.deOtro && <p className="aj-texto">{titulo}</p>}
      {error && <div className="aj-error" role="alert">{error}</div>}

      <GrupoAjustes titulo="Información básica" descripcion={vista.deOtro ? undefined : 'Tu nombre y tu foto aparecen en los chats, el tablero y los avisos.'}>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
        <FilaAjustes
          titulo="Foto"
          detalle={subiendo ? 'Subiendo…' : perfil.avatarUrl ? 'Toca para cambiarla' : 'Agrega una foto para que tu equipo te reconozca'}
          onClick={() => { if (!subiendo) fileRef.current?.click(); }}
          fin={
            <span style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--primary-bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 22, overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {perfil.avatarUrl ? <img src={perfil.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : letra}
            </span>
          }
        />
        {fila('nombre', perfil.nombre)}
        {fila('cargo', perfil.cargo)}
        {fila('empresa', perfil.empresa)}
        {fila('web', perfil.web)}
        {fila('bio', perfil.bio)}
        {perfil.avatarUrl && editando === null && !subiendo && (
          <CuerpoGrupo>
            <button type="button" className="aj-boton" data-variante="texto" style={{ marginTop: 10, marginLeft: -12 }}
              onClick={() => void persistir({ ...perfil, avatarUrl: '' })}>Quitar la foto</button>
          </CuerpoGrupo>
        )}
      </GrupoAjustes>

      <GrupoAjustes titulo="Contacto">
        {/* El correo es el del acceso: no se edita acá (es la cuenta de Google con la que entras). */}
        <FilaAjustes titulo="Correo" detalle={perfil.email || '—'} />
        {fila('telefono', perfil.telefono)}
      </GrupoAjustes>

      <GrupoAjustes titulo="Preferencias">
        {fila('timezone', zona)}
      </GrupoAjustes>
    </>
  );
}

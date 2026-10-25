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
import { FilaAjustes, GrupoAjustes, TituloAjustes } from '../_ui/Ajustes';
import { useRouter } from '@/app/_ui/Link';
import { guardarNombreNegocioAction } from '@/app/configuraciones/negocio-actions';
import { NOMBRE_NEGOCIO_MAX, muestraNegocio, type NegocioDelPerfil } from '@/lib/nombre-negocio';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
export type { NegocioDelPerfil };

const TZ_OPTS = [
  { value: 'America/Tijuana', label: 'Tijuana (PT)' },
  { value: 'America/Hermosillo', label: 'Hermosillo (MST)' },
  { value: 'America/Mexico_City', label: 'CDMX / Monterrey (CT)' },
  { value: 'America/New_York', label: 'Nueva York (ET)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET)' },
];

type Campo = 'nombre' | 'cargo' | 'empresa' | 'negocio' | 'web' | 'bio' | 'telefono' | 'timezone';
const ROTULO: Record<Campo, string> = {
  nombre: 'Nombre', cargo: 'Cargo', empresa: 'Empresa', negocio: 'Nombre del negocio', web: 'Sitio web', bio: 'Sobre ti', telefono: 'Teléfono', timezone: 'Zona horaria',
};
// Inventado: un placeholder con el nombre de un cliente real (era el de Mauricio y su negocio) se le
// muestra a todos los workspaces, y desde el 15/10/2026 también en la hoja del teléfono (/m/cuenta).
const EJEMPLO: Partial<Record<Campo, string>> = { nombre: 'Ana Torres', cargo: 'Fundadora', empresa: 'Estudio Norte', negocio: 'Estudio Norte', web: 'https://…' };

export function InformacionPersonal({ inicial, vista, sinTitulo = false, negocio = null }: {
  inicial: Perfil;
  vista: VistaPerfil;
  /** El nombre del negocio, leído en el server con `nombreDelNegocioAction`. null = no se muestra. */
  negocio?: NegocioDelPerfil | null;
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
  const router = useRouter();
  const [nombreNegocio, setNombreNegocio] = useState(negocio?.nombre ?? '');

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
    } else if (c === 'negocio') setBorrador(nombreNegocio);
    else setBorrador(String(perfil[c] ?? ''));
  };

  /** El nombre del negocio se guarda con la MISMA acción y la MISMA regla que «Tu negocio», y se vuelve a dibujar la app
   *  (el encabezado y la barra lo muestran). */
  const guardarNegocio = async () => {
    setOcupado(true); setError(null);
    try {
      const r = await guardarNombreNegocioAction(borrador);
      if (!r.ok) { setError(r.error); return; }
      setNombreNegocio(r.nombre);
      setEditando(null);
      router.refresh();
    } catch { setError('No se pudo guardar'); }
    finally { setOcupado(false); }
  };

  const guardar = async () => {
    if (!editando) return;
    if (editando === 'negocio') { await guardarNegocio(); return; }
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

  // «Perfil», como en el índice (24/10/2026, Martín: «"Perfil" primero en lugar de "Información personal"»).
  const titulo = vista.deOtro ? `Perfil de ${vista.cuenta || 'esta cuenta'}` : 'Perfil';
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
          <input id={`perfil-${c}`} className="aj-campo" value={borrador} autoFocus placeholder={EJEMPLO[c]} maxLength={c === 'negocio' ? NOMBRE_NEGOCIO_MAX : undefined}
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
      {error && <div className="aj-error" role="alert">{error}<ReportarASoporte /></div>}

      {/* LA FOTO, CON QUIÉN ERES (25/10/2026, Martín: «Fijate pagina por pagina como lo hacen otras apps»). Era una fila más
          («Foto · Toca para cambiarla») y el «Quitar la foto» suelto al pie de la tarjeta. Ahora es la cabecera del perfil, como
          la tarjeta de avatar de Vercel y Catalyst: la foto grande, tu nombre y tu correo, y los dos botones al lado. */}
      <GrupoAjustes titulo="Tu foto" descripcion={vista.deOtro ? undefined : 'Aparece en los chats, el tablero y los avisos, para que tu equipo te reconozca.'}>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
        <div className="aj-perfil">
          <span className="aj-perfil__foto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {perfil.avatarUrl ? <img src={perfil.avatarUrl} alt="" /> : letra}
          </span>
          <span className="aj-perfil__quien">
            <span className="aj-perfil__nombre">{perfil.nombre || 'Sin nombre'}</span>
            <span className="aj-perfil__correo">{perfil.email}</span>
          </span>
          <span className="aj-perfil__acciones">
            <button type="button" className="aj-boton" data-variante="borde" disabled={subiendo} onClick={() => fileRef.current?.click()}>
              {subiendo ? 'Subiendo…' : perfil.avatarUrl ? 'Cambiar foto' : 'Subir una foto'}
            </button>
            {perfil.avatarUrl && !subiendo && (
              <button type="button" className="aj-boton" data-variante="texto" onClick={() => void persistir({ ...perfil, avatarUrl: '' })}>Quitar</button>
            )}
          </span>
        </div>
      </GrupoAjustes>

      <GrupoAjustes titulo="Información básica" descripcion={vista.deOtro ? undefined : 'Tu nombre y tu cargo: tu equipo los ve en los chats y en el tablero.'}>
        {fila('nombre', perfil.nombre)}
        {fila('cargo', perfil.cargo)}
        {/* El nombre del NEGOCIO, para quien lo puede cambiar. «Empresa» queda como está (pendiente: lib/nombre-negocio.ts). */}
        {muestraNegocio(negocio) && fila('negocio', nombreNegocio)}
        {fila('empresa', perfil.empresa)}
        {fila('web', perfil.web)}
        {fila('bio', perfil.bio)}
      </GrupoAjustes>

      <GrupoAjustes titulo="Contacto" descripcion={vista.deOtro ? undefined : 'Por dónde te escriben tu equipo y MaKo.'}>
        {/* El correo es el del acceso: no se edita acá (es la cuenta de Google con la que entras). */}
        <FilaAjustes titulo="Correo" detalle={perfil.email || '—'} />
        {fila('telefono', perfil.telefono)}
      </GrupoAjustes>

      <GrupoAjustes titulo="Preferencias" descripcion={vista.deOtro ? undefined : 'Las horas de tus avisos y del tablero salen de aquí.'}>
        {fila('timezone', zona)}
      </GrupoAjustes>
    </>
  );
}

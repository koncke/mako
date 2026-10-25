'use client';

// =============================================================================
// Perfil — la primera sección de Settings, copiada del Profile de LINEAR (25/10/2026)
// =============================================================================
// Martín, 25/10/2026: «rediseño completo… Tanto en diseño como en funcionalidad. Fijate como lo hacen otras apps». Linear
// (Settings › My Account › Profile y Preferences, docs/settings/referencia.md): una tarjeta con filas y el campo YA PUESTO
// a la derecha de cada una. Se escribe y, al salir del campo (o con Enter), se guarda solo; un aviso chico lo confirma. No hay
// «Guardar» ni «Cancelar»: Escape vuelve al valor guardado.
// Reemplaza a las filas de Google (15/10) que abrían un formulario por dato, y a la columna de párrafos (25/10 mañana) que
// Martín marcó como «texto de sobra».
//
// Lo que cambió de FUNCIÓN (inventario en docs/settings/referencia.md):
//   · Zona horaria con la lista entera de países (la de Horario de envío), la del navegador sugerida primero. Antes, 6 fijas.
//     Ahora gobierna algo: el «No molestar» de Notificaciones se mide en ESTA zona (lib/notif-catalogo.ts → enSilencio).
//   · Tema (claro u oscuro): la misma preferencia del botón de la barra (`aplicarModo`), de este navegador.
//   · «Empresa» NO se ofrece a quien ve «Nombre del negocio» (el admin): una cambiaba el nombre en toda la app y la otra no
//     cambiaba nada visible (docs/hallazgos-ajustes.md). Lo guardado no se borra; a un closer o setter se le sigue ofreciendo.
//
// Los datos llegan del server (lib/perfil.ts → leerPerfil) en el primer render. Se guarda por POST /api/perfil, el de siempre.
// En una «vista de otro» (la agencia o el super admin parados en un cliente) el perfil es el del CLIENTE, y se rotula.

import { useEffect, useRef, useState, type ChangeEvent, type FocusEvent, type ReactNode } from 'react';
import type { Perfil, VistaPerfil } from '@/lib/perfil';
import { DIAL_DEFAULT, splitTelefono, unirTelefono } from '@/lib/paises';
import { Dropdown } from '../components/Dropdown';
import { TelefonoConPais } from '../_components/TelefonoConPais';
import { FilaAjustes, GrupoAjustes, SELECT_AJUSTES, TituloAjustes } from '../_ui/Ajustes';
import { Toast, useToast } from '../_ui/Toast';
import { useRouter } from '@/app/_ui/Link';
import { guardarNombreNegocioAction } from '@/app/configuraciones/negocio-actions';
import { opcionesDeZona } from '@/app/configuraciones/HorarioEnvioPanel';
import { aplicarModo } from '@/app/_components/InterruptorModo';
import { ATTR_MODO } from '@/lib/temas-candidatos';
import { zonaCanonica } from '@/lib/zona-negocio-reglas';
import { NOMBRE_NEGOCIO_MAX, muestraNegocio, type NegocioDelPerfil } from '@/lib/nombre-negocio';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { iniciales } from '@/lib/unicode-seguro';
export type { NegocioDelPerfil };

type Campo = 'nombre' | 'cargo' | 'empresa' | 'web' | 'bio';
// Inventado: un placeholder con el nombre de un cliente real (era el de Mauricio y su negocio) se le
// muestra a todos los workspaces, y también en la hoja del teléfono (/m/cuenta).
const EJEMPLO: Record<Campo | 'negocio', string> = {
  nombre: 'Ana Torres', cargo: 'Fundadora', empresa: 'Estudio Norte', negocio: 'Estudio Norte', web: 'https://…', bio: 'A qué te dedicas',
};

/** Lo que se guarda del teléfono: «+» y los dígitos con el código de país (la forma del resto de la app), o vacío. */
const telefonoGuardable = (tel: { lada: string; numero: string }) => (tel.numero.replace(/\D/g, '') ? `+${unirTelefono(tel.lada, tel.numero)}` : '');

/** La zona del navegador de quien mira, canónica, o null: la que se sugiere primera en la lista. */
function zonaDelNavegador(): string | null {
  try { return zonaCanonica(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { return null; }
}

/**
 * Un campo EN LA FILA, como los del Profile de Linear: muestra lo guardado, se escribe, y al salir (o con Enter) llama a
 * `onGuardar` si cambió. Si el server lo rechaza, vuelve a lo guardado (dejarlo escrito afirmaría un guardado que no pasó).
 */
function CampoEnLinea({ valor, onGuardar, placeholder, maxLength, largo, etiqueta, disabled }: {
  valor: string;
  onGuardar: (v: string) => Promise<boolean>;
  placeholder?: string;
  maxLength?: number;
  /** Un texto de varias líneas («Sobre ti»): Enter hace un renglón; se guarda al salir. */
  largo?: boolean;
  etiqueta: string;
  disabled?: boolean;
}) {
  const [borrador, setBorrador] = useState(valor);
  // Lo guardado cambió por afuera (otro campo releyó el perfil): el campo lo sigue, salvo que se esté escribiendo en él o
  // guardando. ⚠️ Sin el «guardando», al salir del campo volvía un instante el valor VIEJO (el efecto corría con el foco ya
  // afuera y lo guardado todavía sin llegar) y después el nuevo: un parpadeo que se lee como «no se guardó».
  const [enFoco, setEnFoco] = useState(false);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (!enFoco && !guardando) setBorrador(valor); }, [valor, enFoco, guardando]);

  const confirmar = async () => {
    const v = borrador.trim() === valor.trim() ? valor : borrador;
    if (v === valor || guardando) return;
    setGuardando(true);
    const ok = await onGuardar(v.trim());
    setGuardando(false);
    if (!ok) setBorrador(valor);
  };
  const comun = {
    className: 'aj-en-linea', value: borrador, placeholder, maxLength, disabled, 'aria-label': etiqueta,
    onFocus: () => setEnFoco(true),
    onBlur: () => { setEnFoco(false); void confirmar(); },
  };
  if (largo) {
    return (
      <textarea {...comun} rows={3} onChange={(e) => setBorrador(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { setBorrador(valor); (e.target as HTMLTextAreaElement).blur(); } }} />
    );
  }
  return (
    <input {...comun} onChange={(e) => setBorrador(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setBorrador(valor); requestAnimationFrame(() => (e.target as HTMLInputElement).blur()); }
      }} />
  );
}

/** Una fila con su campo: el nombre a la izquierda y el campo a la derecha (debajo, en el teléfono). */
function FilaCampo({ titulo, children, alta }: { titulo: string; children: ReactNode; alta?: boolean }) {
  return (
    <div className="aj-fila" data-quieta="true" data-campo="true" data-alta={alta || undefined}>
      <span className="aj-fila-texto"><span className="aj-fila-titulo">{titulo}</span></span>
      <span className="aj-fila-fin">{children}</span>
    </div>
  );
}

export function InformacionPersonal({ inicial, vista, sinTitulo = false, negocio = null }: {
  inicial: Perfil;
  vista: VistaPerfil;
  /** El nombre del negocio, leído en el server con `nombreDelNegocioAction`. null = no se muestra. */
  negocio?: NegocioDelPerfil | null;
  /** En la hoja del teléfono (/m/cuenta) el título lo pone la hoja. */
  sinTitulo?: boolean;
}) {
  const [perfil, setPerfil] = useState<Perfil>(inicial);
  // El perfil MÁS NUEVO, para guardar: dos campos que se guardan seguidos (salir de uno entrando a otro) no se pisan con una
  // copia vieja del render anterior.
  const ultimo = useRef<Perfil>(inicial);
  // ⚠️ EL TELÉFONO CON EL PAÍS PRIMERO (12/10/2026: «en todos lados que se configure telefono es así»). La lada y el número
  // viven aparte mientras se escribe, y lo que se guarda sale como «+» y los dígitos con el código de país.
  const [tel, setTel] = useState(() => { const { lada, resto } = splitTelefono(inicial.telefono ?? ''); return { lada: lada || DIAL_DEFAULT, numero: resto }; });
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const [nombreNegocio, setNombreNegocio] = useState(negocio?.nombre ?? '');
  const { toast, show, clear } = useToast();
  const [zonaNav, setZonaNav] = useState<string | null>(null);
  const [oscuro, setOscuro] = useState(false);

  useEffect(() => {
    setZonaNav(zonaDelNavegador());
    const sync = () => setOscuro(document.documentElement.getAttribute(ATTR_MODO) === 'oscuro');
    sync();
    window.addEventListener('mako-modo', sync);
    return () => window.removeEventListener('mako-modo', sync);
  }, []);

  const persistir = async (cambio: Partial<Perfil>): Promise<boolean> => {
    setError(null);
    const p = { ...ultimo.current, ...cambio };
    try {
      const j = await (await fetch('/api/perfil', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'perfil', perfil: p }) })).json();
      if (j.ok) { ultimo.current = j.perfil as Perfil; setPerfil(j.perfil as Perfil); show('Guardado', undefined, 'good'); return true; }
      // Un rechazo del server se dice: un campo que vuelve solo a lo de antes, sin decir por qué, se lee como roto.
      setError(j.error ?? 'No se pudo guardar');
      return false;
    } catch {
      setError('No se pudo guardar');
      return false;
    }
  };
  const guardarCampo = (c: Campo) => (v: string) => persistir({ [c]: v });

  /** El nombre del negocio se guarda con la MISMA acción y la MISMA regla que «Tu negocio», y se vuelve a dibujar la app
   *  (el encabezado y la barra lo muestran). */
  const guardarNegocio = async (v: string): Promise<boolean> => {
    setError(null);
    try {
      const r = await guardarNombreNegocioAction(v);
      if (!r.ok) { setError(r.error); return false; }
      setNombreNegocio(r.nombre);
      show('Guardado', undefined, 'good');
      router.refresh();
      return true;
    } catch { setError('No se pudo guardar'); return false; }
  };

  /** El teléfono se guarda al salir de la fila (el número o el país), si cambió. */
  const guardarTelefono = async (t = tel) => {
    const valor = telefonoGuardable(t);
    if (valor === (ultimo.current.telefono ?? '')) return;
    if (!(await persistir({ telefono: valor }))) {
      const { lada, resto } = splitTelefono(ultimo.current.telefono ?? '');
      setTel({ lada: lada || DIAL_DEFAULT, numero: resto });
    }
  };
  const alSalirDelTelefono = (e: FocusEvent<HTMLDivElement>) => {
    // El menú de países se abre en otra capa: salir hacia él no es salir de la fila.
    const hacia = e.relatedTarget as Node | null;
    if (hacia && (e.currentTarget.contains(hacia) || (hacia as HTMLElement).closest?.('[role="listbox"], [role="menu"]'))) return;
    void guardarTelefono();
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
      await persistir({ avatarUrl: j.url as string }); // ya, para que se vea en la barra
    } catch (e2) { setError(e2 instanceof Error ? e2.message : String(e2)); }
    finally { setSubiendo(false); }
  };

  const titulo = vista.deOtro ? `Perfil de ${vista.cuenta || 'esta cuenta'}` : 'Perfil';

  if (vista.deOtro && (vista.sinNadie || vista.sinLeer)) {
    // «No hay nadie» y «no pude leer» son dos hechos: con la lectura caída, decir «nadie» sería afirmar algo que no se miró.
    return (
      <>
        {!sinTitulo && <TituloAjustes titulo={titulo} />}
        <GrupoAjustes>
          <FilaAjustes titulo={vista.sinLeer ? 'No pude leer el perfil de esta cuenta.' : 'Esta cuenta todavía no tiene a nadie adentro.'} />
        </GrupoAjustes>
      </>
    );
  }

  const letra = iniciales(perfil.nombre || perfil.email, 1, 'M');
  const conNegocio = muestraNegocio(negocio);
  const zonas = opcionesDeZona(perfil.timezone, zonaNav);

  return (
    <>
      {/* Mirando a un cliente, la única línea: de quién son estos datos (sin ella, se leen como los propios). */}
      {!sinTitulo && <TituloAjustes titulo={titulo} bajada={vista.deOtro ? 'Los datos de esta cuenta, no los tuyos.' : undefined} />}
      {sinTitulo && vista.deOtro && <p className="aj-texto">{titulo}</p>}
      {error && <div className="aj-error" role="alert">{error}<ReportarASoporte /></div>}

      <GrupoAjustes>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
        <FilaAjustes titulo="Foto" fin={(
          <>
            <button type="button" className="aj-boton" data-variante="texto" disabled={subiendo} onClick={() => fileRef.current?.click()}>
              {subiendo ? 'Subiendo…' : perfil.avatarUrl ? 'Cambiar' : 'Subir'}
            </button>
            {perfil.avatarUrl && !subiendo && (
              <button type="button" className="aj-boton" data-variante="texto" onClick={() => void persistir({ avatarUrl: '' })}>Quitar</button>
            )}
            <button type="button" className="aj-foto" onClick={() => fileRef.current?.click()} aria-label="Cambiar la foto" style={{ border: 'none', padding: 0, cursor: 'pointer' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {perfil.avatarUrl ? <img src={perfil.avatarUrl} alt="" /> : letra}
            </button>
          </>
        )} />
        <FilaCampo titulo="Nombre">
          <CampoEnLinea etiqueta="Nombre" valor={perfil.nombre} placeholder={EJEMPLO.nombre} onGuardar={guardarCampo('nombre')} />
        </FilaCampo>
        {/* El correo es el del acceso: no se edita acá (es la cuenta con la que entras). */}
        <FilaAjustes titulo="Correo" valor={perfil.email || '—'} />
        <FilaCampo titulo="Teléfono">
          <div onBlur={alSalirDelTelefono} style={{ width: 300, maxWidth: '100%' }}>
            <TelefonoConPais lada={tel.lada} numero={tel.numero} placeholder="1 686 123 4567" anchoLada={104} estiloLada={SELECT_AJUSTES}
              inputStyle={{ height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, outline: 'none', width: '100%', minWidth: 0 }}
              onLada={(v) => { const t = { ...tel, lada: v }; setTel(t); if (t.numero.trim()) void guardarTelefono(t); }}
              onNumero={(v) => setTel((t) => ({ ...t, numero: v }))}
              onEnter={() => void guardarTelefono()} />
          </div>
        </FilaCampo>
        <FilaCampo titulo="Cargo">
          <CampoEnLinea etiqueta="Cargo" valor={perfil.cargo} placeholder={EJEMPLO.cargo} onGuardar={guardarCampo('cargo')} />
        </FilaCampo>
        {/* El nombre del NEGOCIO, para quien lo puede cambiar (lib/nombre-negocio.ts). */}
        {conNegocio && (
          <FilaCampo titulo="Nombre del negocio">
            <CampoEnLinea etiqueta="Nombre del negocio" valor={nombreNegocio} placeholder={EJEMPLO.negocio} maxLength={NOMBRE_NEGOCIO_MAX} onGuardar={guardarNegocio} />
          </FilaCampo>
        )}
      </GrupoAjustes>

      <GrupoAjustes titulo="Sobre ti">
        {/* «Empresa» sólo a quien NO ve «Nombre del negocio» (docs/hallazgos-ajustes.md): al lado, confundía. */}
        {!conNegocio && (
          <FilaCampo titulo="Empresa">
            <CampoEnLinea etiqueta="Empresa" valor={perfil.empresa} placeholder={EJEMPLO.empresa} onGuardar={guardarCampo('empresa')} />
          </FilaCampo>
        )}
        <FilaCampo titulo="Sitio web">
          <CampoEnLinea etiqueta="Sitio web" valor={perfil.web} placeholder={EJEMPLO.web} onGuardar={guardarCampo('web')} />
        </FilaCampo>
        <FilaCampo titulo="Descripción" alta>
          <CampoEnLinea etiqueta="Descripción" largo valor={perfil.bio} placeholder={EJEMPLO.bio} onGuardar={guardarCampo('bio')} />
        </FilaCampo>
      </GrupoAjustes>

      <GrupoAjustes titulo="Preferencias">
        <FilaCampo titulo="Zona horaria">
          <Dropdown value={perfil.timezone} options={zonas} width={300} search ariaLabel="Zona horaria" buttonStyle={SELECT_AJUSTES}
            onChange={(v) => { if (v !== perfil.timezone) void persistir({ timezone: v }); }} />
        </FilaCampo>
        {/* El tema es de ESTE navegador (el botón de la barra): mirando a un cliente no es un dato suyo. */}
        {!vista.deOtro && (
          <FilaCampo titulo="Tema">
            <Dropdown value={oscuro ? 'oscuro' : 'claro'} width={160} ariaLabel="Tema" buttonStyle={SELECT_AJUSTES}
              options={[{ value: 'claro', label: 'Claro' }, { value: 'oscuro', label: 'Oscuro' }]}
              onChange={(v) => aplicarModo(v === 'oscuro')} />
          </FilaCampo>
        )}
      </GrupoAjustes>

      <Toast state={toast} onClose={clear} />
    </>
  );
}

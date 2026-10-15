'use client';

// =============================================================================
// /m/cuenta — quién eres, los avisos de este teléfono, el tema y las salidas
// =============================================================================
// v2 (docs/prototipos/mako-mobile-v2.html, «Cuenta»): listas agrupadas estilo Ajustes, sin
// frases de más. En orden: tu cuenta · (viendo a un cliente) · avisos de este teléfono ·
// Apariencia (Claro | Oscuro) · Cerrar sesión. Se llega desde la primera fila de More, y vuelve
// a More (cabecera.ts). «Versión de computadora» NO se repite acá: vive una sola vez, en More
// (app/m/mas/VersionComputadora.tsx), como en el prototipo.
//
// ⚠️ EL PERMISO DE NOTIFICACIONES SE PIDE DENTRO DEL TOQUE, nunca al cargar:
// `activarAvisos()` es la PRIMERA llamada del handler (lib/push-cliente.ts pide el
// permiso antes de su primer await). iOS lo exige, y un permiso pedido al cargar es
// un veto de la casa. El interruptor llega acá sincrónico (InterruptorM → onCambio).
//
// ⚠️ TODO LO QUE DEPENDE DEL TELÉFONO SE LEE DESPUÉS DE MONTAR (`useEffect`): el
// server no sabe si es un iPhone, si está instalada ni qué permiso hay. Pintarlo en
// el primer render sería un desfase de hidratación — y peor, una fila que cambia de
// opinión al segundo. Mientras tanto el interruptor está quieto y apagado.
//
// ⚠️ «VIENDO A UN CLIENTE» ES LA ÚNICA SALIDA: en /m no hay banner de impersonación
// (el cromo de escritorio está apagado) y la pill del header trae acá. Si esta
// pantalla no la dibuja, no hay salida (AGENTS.md, «si la única salida vive adentro
// de una pantalla condicional, no hay salida»).
//
// Las dos salidas (la de la vista y cerrar sesión) son las primitivas de app/m/_ui
// (SalirDeLaVista, CerrarSesion): la lógica vive UNA vez ahí. Acá se dibujan como filas de
// la lista con la CSS de esta carpeta (.m-cuenta-boton).
// =============================================================================

import { useEffect, useState, useSyncExternalStore } from 'react';
import { aplicarModo } from '@/app/_components/InterruptorModo';
import { ATTR_MODO } from '@/lib/temas-candidatos';
import { haptico } from '@/lib/haptico';
import { esIOS, estaInstalada, pedirInstalacion, puedeOfrecerInstalacion, suscribirInstalacion } from '@/lib/movil-instalar';
import { activarAvisos, desactivarAvisos, estadoSuscripcion, probar, type EstadoAvisos } from '@/lib/push-cliente';
import { PUSH_SOLO_ADMINS, PUSH_TIPOS, type AvisoWaDef, type NotifPush } from '@/lib/notif-catalogo';
import {
  AvatarM, CerrarSesion, FilaM, InterruptorM, ListaM, SalirDeLaVista, SegmentadoM, SheetM, useConexion, useToastM,
} from '../_ui';
import type { Perfil, VistaPerfil } from '@/lib/perfil';
import { SECCIONES_CUENTA } from '@/lib/ajustes-secciones';
import { InformacionPersonal } from '@/app/perfil/InformacionPersonal';
import {
  comoDesbloquear, ofertaInstalar, resumenAvisos, segundaAvisos, tiposParaRol, toastDeActivar, toastDePrueba, vistaAvisos,
} from './cuenta-ui';

export type DatosCuenta = {
  nombre: string;
  email: string;
  /** Viendo a un cliente (super admin o agencia): su nombre y por dónde se sale. */
  vista: { cliente: string; salida: string; modoAgencia: boolean } | null;
  push: NotifPush;
  /** false = la sesión no tiene fila propia (no se pueden guardar preferencias). */
  guardable: boolean;
  esAdmin: boolean;
  /** «Información personal» (la misma de la computadora, en una hoja). null = no se pudo leer. */
  perfil: { perfil: Perfil; vista: VistaPerfil } | null;
};

/** Los rótulos de «Tu cuenta», los MISMOS de la computadora (lib/ajustes-secciones.ts). */
const ROTULO = Object.fromEntries(SECCIONES_CUENTA.map((s) => [s.key, s.label])) as Record<'info' | 'seguridad' | 'notificaciones' | 'instalar', string>;

export function CuentaM({ datos }: { datos: DatosCuenta }) {
  const [hojaInfo, setHojaInfo] = useState(false);
  return (
    <div className="m-cuenta">
      <ListaM>
        <FilaM
          leading={<AvatarM nombre={datos.nombre} email={datos.email} />}
          titulo={datos.nombre || datos.email}
          segunda={datos.nombre ? datos.email : undefined}
        />
      </ListaM>

      {datos.vista && (
        <ListaM>
          <FilaM navegacion titulo={`Viendo a ${datos.vista.cliente}`} />
          <div className="m-cuenta-boton m-cuenta-boton--azul">
            <SalirDeLaVista salida={datos.vista.salida} modoAgencia={datos.vista.modoAgencia}
              variante="tertiary" rotulo={`Salir de ${datos.vista.cliente}`} />
          </div>
        </ListaM>
      )}

      {/* «Tu cuenta» (15/10/2026): las secciones de la computadora, en el mismo orden y con los mismos
          rótulos. Información personal abre en una hoja; Seguridad es su pantalla (/perfil/seguridad);
          Notificaciones son los avisos de este teléfono; Instalar la app vive adentro de los avisos,
          porque en el teléfono sólo hace falta para prenderlos. */}
      <ListaM>
        <FilaM navegacion titulo={ROTULO.info} onClick={() => setHojaInfo(true)} />
        <FilaM navegacion titulo={ROTULO.seguridad} href="/m/cuenta/seguridad" />
      </ListaM>
      {datos.perfil && (
        <SheetM abierto={hojaInfo} onCerrar={() => setHojaInfo(false)} titulo={ROTULO.info} id="info" snap="alto">
          <div className="m-cuenta-seguridad">
            <InformacionPersonal inicial={datos.perfil.perfil} vista={datos.perfil.vista} sinTitulo />
          </div>
        </SheetM>
      )}

      <h2 className="m-cuenta-subt">{ROTULO.notificaciones}</h2>
      <AvisosTelefono push={datos.push} guardable={datos.guardable} esAdmin={datos.esAdmin} />

      <h2 className="m-cuenta-subt">Apariencia</h2>
      <Apariencia />

      <ListaM>
        <div className="m-cuenta-boton"><CerrarSesion variante="tertiary" /></div>
      </ListaM>
    </div>
  );
}

// ── Avisos en este teléfono ──────────────────────────────────────────────────

type Plataforma = { ios: boolean; instalada: boolean };

function AvisosTelefono({ push, guardable, esAdmin }: { push: NotifPush; guardable: boolean; esAdmin: boolean }) {
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [estado, setEstado] = useState<EstadoAvisos | null>(null);
  const [plat, setPlat] = useState<Plataforma | null>(null);
  const [ocupado, setOcupado] = useState<'activar' | 'probar' | 'apagar' | 'instalar' | null>(null);
  const [prefs, setPrefs] = useState<NotifPush>(push);
  const [hojaTipos, setHojaTipos] = useState(false);
  const puedePedir = useSyncExternalStore(suscribirInstalacion, puedeOfrecerInstalacion, () => false);

  useEffect(() => {
    setPlat({ ios: esIOS(), instalada: estaInstalada() });
    estadoSuscripcion().then(setEstado).catch(() => setEstado('no-soportado'));
  }, []);

  const vista = vistaAvisos(estado);
  const instalar = plat ? ofertaInstalar({ ...plat, puedePedir }) : null;
  const tipos = tiposParaRol(PUSH_TIPOS, PUSH_SOLO_ADMINS, esAdmin);

  // ⚠️ Primera línea del handler: el permiso se pide DENTRO del gesto.
  const activar = () => {
    const pedido = activarAvisos();
    setOcupado('activar');
    pedido.then((r) => {
      if (r.ok) { haptico('success'); toast('Avisos activados'); setEstado('activo'); return; }
      if (r.estado === 'bloqueado' || r.estado === 'instalar-primero' || r.estado === 'no-soportado' || r.estado === 'apagado') {
        setEstado(r.estado);
        return;
      }
      haptico('error');
      toast(toastDeActivar(r.estado));
    }).catch(() => toast('No se pudo activar'))
      .finally(() => setOcupado(null));
  };

  const apagar = async () => {
    setOcupado('apagar');
    try {
      if (await desactivarAvisos()) { toast('Avisos apagados'); setEstado('apagado'); }
      else toast('No se pudo apagar');
    } finally { setOcupado(null); }
  };

  const probarAviso = async () => {
    setOcupado('probar');
    try { toast(toastDePrueba(await probar())); } finally { setOcupado(null); }
  };

  const instalarAndroid = async () => {
    setOcupado('instalar');
    try {
      const r = await pedirInstalacion();
      if (r === 'aceptada') { haptico('success'); toast('MaKo instalada'); }
    } finally { setOcupado(null); }
  };

  /** Qué avisos le llegan a ESTA persona (en todos sus teléfonos): /api/perfil/notif-push. */
  const guardar = async (nuevo: NotifPush) => {
    const antes = prefs;
    setPrefs(nuevo);
    try {
      const r = await fetch('/api/perfil/notif-push', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ push: nuevo }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; guardado?: boolean; push?: NotifPush } | null;
      if (!r.ok || !j?.ok || j.guardado === false) throw new Error('no guardado');
      if (j.push) setPrefs(j.push);
    } catch {
      setPrefs(antes);
      toast('No se guardó');
    }
  };

  // El interruptor: prendido si este teléfono está suscripto (o se está activando). Quieto
  // mientras se revisa el teléfono y cuando sólo se destraba afuera (instalar, ajustes).
  const prendido = vista === 'activo' || ocupado === 'activar';
  const quieto = ocupado != null
    || vista === 'cargando' || vista === 'instalar-ios' || vista === 'no-soportado' || vista === 'bloqueado'
    || (vista === 'activar' && !enLinea);
  const spinner = (cual: typeof ocupado) => (ocupado === cual ? <span className="mk-spin" aria-hidden /> : undefined);

  return (
    <>
      <ListaM>
        <FilaM
          navegacion
          titulo="Avisos en este teléfono"
          segunda={segundaAvisos(vista) ?? undefined}
          control={(
            <InterruptorM
              etiqueta="Avisos en este teléfono"
              activo={prendido}
              deshabilitado={quieto}
              onCambio={(v) => { if (v) activar(); else void apagar(); }}
            />
          )}
        />
        {instalar === 'pasos-ios' && (
          <FilaM navegacion titulo={ROTULO.instalar} href="/m/cuenta/instalar" />
        )}
        {instalar === 'boton' && (
          <FilaM navegacion titulo={ROTULO.instalar} chevron={false} riel={spinner('instalar')}
            deshabilitada={ocupado != null} onClick={() => void instalarAndroid()} />
        )}
        {vista === 'activo' && (guardable ? (
          <FilaM navegacion titulo="Qué te avisa" riel={resumenAvisos(prefs, tipos)} onClick={() => setHojaTipos(true)} />
        ) : (
          <FilaM navegacion titulo="Qué te avisa" riel="No disponible" />
        ))}
        {vista === 'activo' && (
          <FilaM navegacion titulo="Probar aviso" chevron={false} riel={spinner('probar')}
            deshabilitada={!enLinea || ocupado != null} onClick={() => void probarAviso()} />
        )}
      </ListaM>
      {vista === 'bloqueado' && <p className="m-cuenta-nota">{comoDesbloquear(!!plat?.ios, !!plat?.instalada)}</p>}

      {guardable && (
        <SheetM abierto={hojaTipos} onCerrar={() => setHojaTipos(false)} titulo="Qué te avisa" id="avisos" snap="alto">
          <TiposDeAviso prefs={prefs} tipos={tipos} onGuardar={(p) => void guardar(p)} />
        </SheetM>
      )}
    </>
  );
}

/** El maestro (de la PERSONA, en todos sus teléfonos) y, debajo, cada tipo por separado. */
function TiposDeAviso({ prefs, tipos, onGuardar }: {
  prefs: NotifPush;
  tipos: readonly AvisoWaDef[];
  onGuardar: (p: NotifPush) => void;
}) {
  return (
    <div className="m-cuenta-tipos">
      <ListaM>
        <FilaM navegacion titulo="Recibir avisos"
          control={<InterruptorM etiqueta="Recibir avisos" activo={prefs.activo} onCambio={(v) => onGuardar({ ...prefs, activo: v })} />} />
      </ListaM>
      {prefs.activo && (
        <ListaM etiqueta="Tipos de aviso">
          {tipos.map((t) => (
            <FilaM key={t.id} navegacion titulo={t.titulo}
              control={(
                <InterruptorM etiqueta={t.titulo} activo={prefs.items[t.id] !== false}
                  onCambio={(v) => onGuardar({ ...prefs, items: { ...prefs.items, [t.id]: v } })} />
              )} />
          ))}
        </ListaM>
      )}
    </div>
  );
}

// ── Claro / oscuro ───────────────────────────────────────────────────────────

/**
 * La MISMA preferencia que el escritorio (`aplicarModo`, la que usa InterruptorModo): se
 * recuerda en el navegador y el shell de /m la sigue (claro por defecto; oscuro sólo si se
 * eligió). El botón de escritorio no se monta tal cual: está pintado para la barra lateral.
 */
function Apariencia() {
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => {
    const sync = () => setOscuro(document.documentElement.getAttribute(ATTR_MODO) === 'oscuro');
    sync();
    window.addEventListener('mako-modo', sync);
    return () => window.removeEventListener('mako-modo', sync);
  }, []);
  return (
    <SegmentadoM
      etiqueta="Apariencia"
      valor={oscuro ? 'oscuro' : 'claro'}
      onCambio={(v) => aplicarModo(v === 'oscuro')}
      opciones={[{ id: 'claro', label: 'Claro' }, { id: 'oscuro', label: 'Oscuro' }]}
    />
  );
}

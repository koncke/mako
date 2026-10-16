'use client';

// =============================================================================
// /m/cuenta — «Tu cuenta»: quién eres, tus secciones, el tema y las salidas
// =============================================================================
// v3 (15/10/2026, «Tu cuenta» y «Configuración del negocio», como Google): la cuenta de Google en el
// celular. Arriba, al centro, tu foto (o tus iniciales), tu nombre y tu correo; debajo, en este orden:
//   · (viendo a un cliente) «Viendo a X» y «Salir de X»;
//   · las secciones de «Tu cuenta» de la computadora, como filas con su ícono, en el MISMO orden y con
//     los MISMOS rótulos (lib/ajustes-secciones.ts): Información personal (una hoja con la misma
//     pantalla de la computadora) · Seguridad (/m/cuenta/seguridad) · Notificaciones (una hoja con los
//     avisos de ESTE teléfono) · Instalar la app (los pasos, o el aviso de Chrome);
//   · Modo oscuro (la misma preferencia que el botón de la barra de escritorio);
//   · «Configuración del negocio · En la computadora», sólo para quien lo administra;
//   · Cerrar sesión.
// «Versión de computadora» NO se repite acá: vive una sola vez, en More (app/m/mas/VersionComputadora.tsx).
//
// ⚠️ EL PERMISO DE NOTIFICACIONES SE PIDE DENTRO DEL TOQUE, nunca al cargar:
// `activarAvisos()` es la PRIMERA llamada del handler (lib/push-cliente.ts pide el
// permiso antes de su primer await). iOS lo exige, y un permiso pedido al cargar es
// un veto de la casa. El interruptor llega acá sincrónico (InterruptorM → onCambio).
//
// ⚠️ TODO LO QUE DEPENDE DEL TELÉFONO SE LEE DESPUÉS DE MONTAR (`useEffect`): el
// server no sabe si es un iPhone, si está instalada ni qué permiso hay. Pintarlo en
// el primer render sería un desfase de hidratación — y peor, una fila que cambia de
// opinión al segundo. Mientras tanto el interruptor está quieto y apagado. Y se vuelve a
// leer al VOLVER a la app (quien destrabó el permiso en los Ajustes del teléfono vuelve y
// tiene que ver el interruptor libre) y al tirar para refrescar (llegan props nuevas).
//
// ⚠️ «VIENDO A UN CLIENTE» ES LA ÚNICA SALIDA: en /m no hay banner de impersonación
// (el cromo de escritorio está apagado) y la pill del header trae acá. Si esta
// pantalla no la dibuja, no hay salida (AGENTS.md, «si la única salida vive adentro
// de una pantalla condicional, no hay salida»). Mirando a un cliente, «Tu cuenta» ofrece
// sólo SU Información personal (`seccionesCuenta`, la regla de la computadora): tu seguridad,
// tus avisos y tu app vuelven al salir.
//
// Las dos salidas (la de la vista y cerrar sesión) son las primitivas de app/m/_ui
// (SalirDeLaVista, CerrarSesion): la lógica vive UNA vez ahí. Acá se dibujan como filas de
// la lista con la CSS de esta carpeta (.m-cuenta-boton).
// =============================================================================

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { aplicarModo } from '@/app/_components/InterruptorModo';
import { ATTR_MODO } from '@/lib/temas-candidatos';
import { haptico } from '@/lib/haptico';
import { esIOS, estaInstalada, pedirInstalacion, puedeOfrecerInstalacion, suscribirInstalacion } from '@/lib/movil-instalar';
import { activarAvisos, desactivarAvisos, estadoSuscripcion, probar, type EstadoAvisos } from '@/lib/push-cliente';
import { PUSH_SOLO_ADMINS, PUSH_TIPOS, type AvisoWaDef, type NotifPush } from '@/lib/notif-catalogo';
import {
  AvatarM, CerrarSesion, ComputadoraM, FilaM, InterruptorM, ListaM, SalirDeLaVista, SeccionM, SheetM, useConexion, useToastM,
} from '../_ui';
import type { Perfil, VistaPerfil } from '@/lib/perfil';
import { SECCIONES_CUENTA } from '@/lib/ajustes-secciones';
import { InformacionPersonal } from '@/app/perfil/InformacionPersonal';
import {
  comoDesbloquear, filaInstalar, resumenAvisos, rielNotificaciones, segundaAvisos, tiposParaRol, toastDeActivar,
  toastDePrueba, vistaAvisos, type VistaAvisos,
} from './cuenta-ui';

export type DatosCuenta = {
  /** Tu nombre (el de Información personal; si no hay, el de la sesión). Vacío = sólo el correo. */
  nombre: string;
  email: string;
  /** Tu foto de Información personal. null = las iniciales. */
  foto: string | null;
  /** Viendo a un cliente (super admin o agencia): su nombre y por dónde se sale. */
  vista: { cliente: string; salida: string; modoAgencia: boolean } | null;
  /** Las keys de «Tu cuenta» que se ofrecen (`seccionesCuenta`): mirando a un cliente, sólo 'info'. */
  secciones: string[];
  /** El rótulo de «Configuración del negocio» si quien mira lo administra; null = no lo ve. */
  negocio: string | null;
  push: NotifPush;
  /** false = la sesión no tiene fila propia (no se pueden guardar preferencias). */
  guardable: boolean;
  esAdmin: boolean;
  /** «Información personal» (la misma de la computadora, en una hoja). null = no se pudo leer. */
  perfil: { perfil: Perfil; vista: VistaPerfil } | null;
};

type ClaveCuenta = 'info' | 'seguridad' | 'notificaciones' | 'instalar';

/** Los rótulos y los íconos de «Tu cuenta», los MISMOS de la computadora (lib/ajustes-secciones.ts). */
const ROTULO = Object.fromEntries(SECCIONES_CUENTA.map((s) => [s.key, s.label])) as Record<ClaveCuenta, string>;
const ICONO = Object.fromEntries(SECCIONES_CUENTA.map((s) => [s.key, s.icono])) as Record<ClaveCuenta, NombreIconoMenu>;

/** El ícono de una sección en la baldosa de las filas de /m (`.m-icono` del shell), con el dibujo del índice de escritorio. */
function IconoSeccion({ k }: { k: ClaveCuenta }) {
  return <span className="m-icono" aria-hidden><IconoMenu nombre={ICONO[k]} size={18} /></span>;
}

export function CuentaM({ datos }: { datos: DatosCuenta }) {
  const router = useRouter();
  const [hoja, setHoja] = useState<'info' | 'notificaciones' | null>(null);
  const avisos = useAvisosTelefono(datos.push);
  const tipos = tiposParaRol(PUSH_TIPOS, PUSH_SOLO_ADMINS, datos.esAdmin);
  const ve = (k: ClaveCuenta) => datos.secciones.includes(k);
  const fila = filaInstalar(avisos.plat ? { ...avisos.plat, puedePedir: avisos.puedePedir } : null);

  return (
    <div className="m-cuenta">
      <div className="m-cuenta-cab">
        {datos.foto
          // eslint-disable-next-line @next/next/no-img-element -- la foto que subió la persona (una URL de Storage), como en la barra de escritorio
          ? <img className="m-cuenta-cab__foto" src={datos.foto} alt="" width={88} height={88} />
          : <AvatarM nombre={datos.nombre} email={datos.email} tam="xl" />}
        <p className="m-cuenta-cab__nombre">{datos.nombre || datos.email}</p>
        {datos.nombre && <p className="m-cuenta-cab__correo">{datos.email}</p>}
      </div>

      {datos.vista && (
        <ListaM>
          <FilaM navegacion titulo={`Viendo a ${datos.vista.cliente}`} />
          <div className="m-cuenta-boton m-cuenta-boton--azul">
            <SalirDeLaVista salida={datos.vista.salida} modoAgencia={datos.vista.modoAgencia}
              variante="tertiary" rotulo={`Salir de ${datos.vista.cliente}`} />
          </div>
        </ListaM>
      )}

      {/* «Tu cuenta»: las secciones de la computadora, en su orden y con sus rótulos. */}
      <ListaM>
        {ve('info') && (
          <FilaM navegacion leading={<IconoSeccion k="info" />} titulo={ROTULO.info}
            // Mirando a un cliente, el perfil es el SUYO: la fila lo dice (sin rótulo se leería como el tuyo).
            segunda={datos.vista ? datos.vista.cliente : undefined}
            riel={datos.perfil ? undefined : 'No disponible'}
            onClick={datos.perfil ? () => setHoja('info') : undefined} />
        )}
        {ve('seguridad') && (
          <FilaM navegacion leading={<IconoSeccion k="seguridad" />} titulo={ROTULO.seguridad} href="/m/cuenta/seguridad" />
        )}
        {ve('notificaciones') && (
          <FilaM navegacion leading={<IconoSeccion k="notificaciones" />} titulo={ROTULO.notificaciones}
            riel={rielNotificaciones(avisos.vista, datos.guardable ? resumenAvisos(avisos.prefs, tipos) : null) ?? undefined}
            onClick={() => setHoja('notificaciones')} />
        )}
        {ve('instalar') && (
          fila === 'pasos-ios' || fila === 'pasos'
            ? <FilaM navegacion leading={<IconoSeccion k="instalar" />} titulo={ROTULO.instalar} href="/m/cuenta/instalar" />
            : fila === 'boton'
              ? <FilaM navegacion leading={<IconoSeccion k="instalar" />} titulo={ROTULO.instalar} chevron={false}
                  riel={avisos.ocupado === 'instalar' ? <span className="mk-spin" aria-hidden /> : undefined}
                  deshabilitada={avisos.ocupado != null} onClick={() => void avisos.instalar()} />
              : <FilaM navegacion leading={<IconoSeccion k="instalar" />} titulo={ROTULO.instalar}
                  riel={fila === 'instalada' ? 'Instalada' : undefined} />
        )}
      </ListaM>

      <ListaM>
        <ModoOscuro />
      </ListaM>

      {datos.negocio && <ComputadoraM que={datos.negocio} />}

      <ListaM>
        <div className="m-cuenta-boton"><CerrarSesion variante="tertiary" /></div>
      </ListaM>

      {datos.perfil && ve('info') && (
        <SheetM abierto={hoja === 'info'} titulo={ROTULO.info} id="info" snap="alto"
          // Al cerrar, el server vuelve a leer: si cambiaste el nombre o la foto, arriba se ve. Después
          // del «atrás» con que la hoja saca su `?sheet=` (SheetM, asíncrono): un refresh pedido antes
          // lo pisaría la restauración de esa entrada del historial.
          onCerrar={() => { setHoja(null); window.setTimeout(() => router.refresh(), 400); }}>
          <div className="m-cuenta-ajustes">
            <InformacionPersonal inicial={datos.perfil.perfil} vista={datos.perfil.vista} sinTitulo />
          </div>
        </SheetM>
      )}
      {ve('notificaciones') && (
        <SheetM abierto={hoja === 'notificaciones'} onCerrar={() => setHoja(null)} titulo={ROTULO.notificaciones} id="notificaciones" snap="alto">
          <HojaNotificaciones avisos={avisos} tipos={tipos} guardable={datos.guardable} />
        </SheetM>
      )}
    </div>
  );
}

// ── Avisos en este teléfono ──────────────────────────────────────────────────

type Plataforma = { ios: boolean; instalada: boolean };
type Ocupado = 'activar' | 'probar' | 'apagar' | 'instalar' | null;
type AvisosTelefono = ReturnType<typeof useAvisosTelefono>;

/**
 * El estado de ESTE teléfono (permiso, suscripción, instalada) y lo que se hace con él. Vive en un hook
 * porque lo leen dos lugares: la fila «Notificaciones» (lo que dice a la derecha) y su hoja.
 */
function useAvisosTelefono(push: NotifPush) {
  const toast = useToastM();
  const [estado, setEstado] = useState<EstadoAvisos | null>(null);
  const [plat, setPlat] = useState<Plataforma | null>(null);
  const [ocupado, setOcupadoEstado] = useState<Ocupado>(null);
  const puedePedir = useSyncExternalStore(suscribirInstalacion, puedeOfrecerInstalacion, () => false);

  // Lo que se está haciendo, también en un ref: releer el teléfono A MITAD de activar pisaría el
  // «activo» que llega con un «apagado» viejo.
  const ocupadoRef = useRef<Ocupado>(null);
  const setOcupado = (v: Ocupado) => { ocupadoRef.current = v; setOcupadoEstado(v); };
  // Chrome no avisa que se instaló: la pestaña sigue siendo una pestaña (`estaInstalada` da false).
  const instaloAca = useRef(false);

  // Las preferencias son de la PERSONA y llegan del server: si llegan otras (tirar para refrescar),
  // mandan las nuevas. Copiarlas a un estado sin esto hacía que refrescar no trajera nada.
  const [prefs, setPrefs] = useState<NotifPush>(push);
  const [pushVisto, setPushVisto] = useState<NotifPush>(push);
  if (pushVisto !== push) { setPushVisto(push); setPrefs(push); }

  const revisar = useCallback(() => {
    if (ocupadoRef.current) return;
    setPlat({ ios: esIOS(), instalada: estaInstalada() || instaloAca.current });
    estadoSuscripcion().then((e) => { if (!ocupadoRef.current) setEstado(e); }).catch(() => setEstado('no-soportado'));
  }, []);
  // Al montar y con cada refresco (el server manda un `push` nuevo).
  useEffect(() => { revisar(); }, [push, revisar]);
  // Al volver a la app: quien destrabó el permiso en los Ajustes del teléfono vuelve y lo ve.
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') revisar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [revisar]);

  const vista: VistaAvisos = vistaAvisos(estado);

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

  const instalar = async () => {
    setOcupado('instalar');
    try {
      const r = await pedirInstalacion();
      if (r === 'aceptada') {
        haptico('success');
        toast('MaKo instalada');
        instaloAca.current = true;
        setPlat((p) => (p ? { ...p, instalada: true } : p));
      }
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

  return { vista, plat, puedePedir, ocupado, prefs, activar, apagar, probarAviso, instalar, guardar };
}

/** La hoja «Notificaciones»: el interruptor de este teléfono, cómo destrabarlo, probar y qué te avisa. */
function HojaNotificaciones({ avisos, tipos, guardable }: { avisos: AvisosTelefono; tipos: readonly AvisoWaDef[]; guardable: boolean }) {
  const { enLinea } = useConexion();
  const { vista, ocupado } = avisos;

  // El interruptor: prendido si este teléfono está suscripto (o se está activando). Quieto
  // mientras se revisa el teléfono y cuando sólo se destraba afuera (instalar, ajustes).
  const prendido = vista === 'activo' || ocupado === 'activar';
  const quieto = ocupado != null
    || vista === 'cargando' || vista === 'instalar-ios' || vista === 'no-soportado' || vista === 'bloqueado'
    || (vista === 'activar' && !enLinea);

  return (
    <div className="m-cuenta-hoja">
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
              onCambio={(v) => { if (v) avisos.activar(); else void avisos.apagar(); }}
            />
          )}
        />
        {vista === 'instalar-ios' && (
          <FilaM navegacion titulo={ROTULO.instalar} href="/m/cuenta/instalar" />
        )}
        {vista === 'activo' && (
          <FilaM navegacion titulo="Probar aviso" chevron={false}
            riel={ocupado === 'probar' ? <span className="mk-spin" aria-hidden /> : undefined}
            deshabilitada={!enLinea || ocupado != null} onClick={() => void avisos.probarAviso()} />
        )}
      </ListaM>
      {vista === 'bloqueado' && <p className="m-cuenta-nota">{comoDesbloquear(!!avisos.plat?.ios, !!avisos.plat?.instalada)}</p>}

      {vista === 'activo' && (guardable ? (
        <SeccionM titulo="Qué te avisa">
          <TiposDeAviso prefs={avisos.prefs} tipos={tipos} onGuardar={(p) => void avisos.guardar(p)} />
        </SeccionM>
      ) : (
        <ListaM>
          <FilaM navegacion titulo="Qué te avisa" riel="No disponible" />
        </ListaM>
      ))}
    </div>
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

// ── Modo oscuro ──────────────────────────────────────────────────────────────

/**
 * La MISMA preferencia que el botón de la barra de escritorio (`aplicarModo`, InterruptorModo): se
 * recuerda en el navegador y el shell de /m la sigue (claro por defecto; oscuro sólo si se eligió).
 * Como en los ajustes de Google, una fila con interruptor, y la fila entera lo cambia. El botón de
 * escritorio no se monta tal cual: está pintado para la barra lateral.
 */
function ModoOscuro() {
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => {
    const sync = () => setOscuro(document.documentElement.getAttribute(ATTR_MODO) === 'oscuro');
    sync();
    // El tema candidato también toca el atributo (lo mismo que escucha InterruptorModo).
    window.addEventListener('mako-modo', sync);
    window.addEventListener('mako-tema-candidato', sync);
    return () => {
      window.removeEventListener('mako-modo', sync);
      window.removeEventListener('mako-tema-candidato', sync);
    };
  }, []);
  return (
    <FilaM navegacion titulo="Modo oscuro"
      onClick={() => { haptico('light'); aplicarModo(!oscuro); }}
      control={<InterruptorM etiqueta="Modo oscuro" activo={oscuro} onCambio={(v) => aplicarModo(v)} />} />
  );
}

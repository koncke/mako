'use client';

// =============================================================================
// «Tus cuentas de IA» — las computadoras del negocio que piensan su Ops Center con SU Claude (docs/ia-del-cliente.md §6 y §7)
// =============================================================================
// Martín (21/10/2026): «Quiero que este al 100% eso, que puedan conectarlo, que haya un tutorial, que este 100%
// funcional». Copia de `ListaUso` (app/admin/operaciones/Uso.tsx, la lista de cuentas de Martín): cada cuenta con su
// logo, su email, su plan y las dos barras («Sesión de 5 horas», «Semana») con el % usado y cuándo se reinicia. El % lo
// mide la computadora del cliente después de cada turno (el `rate_limit_event` de Claude Code): sin turnos, «Sin medir».
//
// El tutorial es un paso por pantalla (copiado de Tailscale: un programa que corre solo, se conecta por el navegador y
// aparece en la consola web). El último paso espera solo a que la computadora aparezca «En línea».
// =============================================================================

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import { LogoClaude } from '@/app/admin/operaciones/Uso';
import { Modal } from '@/app/_ui/Modal';
import { Skeleton } from '@/app/_ui/Feedback';
import { BotonIntegracion } from '@/app/_components/ConectarIntegracion';
import { DEFS as DEFS_INTEGRACIONES } from '@/lib/integraciones-catalogo';
import { integracionAction } from './servicio-actions';
import { BrandDefs, SvcIcon } from '@/app/_components/ServicioVisual';
import { ABRIR_IA, AVISO_GATEKEEPER, AVISO_SMARTSCREEN, CONSENTIMIENTO_DE, PROGRAMA_IA_PC, abreEnlacesMako, cuentasDeLaIA, resumenDeCuentas, type CuentaPc, type CuentasIA, type SistemaPc, type ProveedorPc } from '@/lib/ia-pc-reglas';
import { IAS_DEL_CLIENTE, NOMBRE_IA, SERVICIO_DE_CLAVE, comoConectar, dondeSacarLaClave, iaDeLaPcPara, notaDeConectar, type IaDelCliente } from '@/lib/conectar-ia-reglas';
import { CuentasYDispositivos, DescargarElOtro, DescargarMaKo, NuevoDispositivo, avisoAlAbrir } from './CuentasYDispositivos';
import { Icon } from '@/app/_components/icons';
import { Criatura } from '@/app/_components/Criatura';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import './tus-cuentas-ia.css';

type Pc = { id: number; nombre: string; esMia: boolean; de?: string; enLinea: boolean; ultimoLatido: string | null; version: string | null; cuentas: CuentaPc[]; sinClaude?: boolean; conectadaAt?: string | null; sistema?: string | null; ubicacion?: string | null };
/**
 * Lo que devuelve GET /api/ia-pc/estado. `grupos`: las cuentas con sus dispositivos, agrupadas en el servidor (lib/ia-pc-reglas.ts
 * → agruparPorCuenta); `pcs`, cada computadora suelta (el tutorial mira cuál apareció). Ni las claves ni el modelo se muestran
 * acá (23/10/2026): el modelo se elige en cada chat, y la clave y el crédito no le sirven al cliente en este panel.
 */
type Estado = { ok: boolean; esAdmin: boolean; modelo: string; pcs: Pc[]; grupos?: CuentasIA; /** A quien no es admin: el nombre del admin («Pídele a…»). */ admin?: string };
/** Dónde se pega la línea de respaldo: SÓLO para una PC de la 0.3.x, que no abre mako:// (`abreEnlacesMako`). */
const DONDE_PEGAR: Record<SistemaPc, string> = {
  windows: 'Abre «PowerShell» desde el menú Inicio, pega esto y aprieta Enter.',
  mac: 'Abre «Terminal» (Aplicaciones → Utilidades), pega esto y aprieta Enter.',
};
/**
 * El login con la RUTA COMPLETA: el instalador oficial deja `claude` en ~/.local/bin y no toca el PATH de la ventana
 * abierta (ni el de una nueva, en Windows), así que `claude` a secas da «no se reconoce» en una instalación nueva
 * (revisión del Cerebro, 21/10/2026). `auth login` va directo al navegador, sin el tema ni «¿confías en esta carpeta?».
 */
const LOGIN_CLAUDE: Record<SistemaPc, string> = {
  windows: '& "$env:USERPROFILE\\.local\\bin\\claude.exe" auth login',
  mac: '~/.local/bin/claude auth login',
};

function Copiar({ texto }: { texto: string }) {
  const [listo, setListo] = useState(false);
  return (
    <div className="tci-comando">
      <code>{texto}</code>
      <button type="button" className="tci-boton tci-boton--chico" onClick={() => { void navigator.clipboard?.writeText(texto); setListo(true); setTimeout(() => setListo(false), 1500); }}>
        {listo ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

/** Cuánto se espera a que la app conteste antes de ofrecer «Probar de nuevo» y la descarga (la página de Zoom hace lo mismo). */
const PLAZO_AYUDA_MS = 6000;

/**
 * El tutorial (25/10/2026, Martín, con la captura del «Paso 3 de 3 · Conecta MaKo»: «rediseña eso, que se vea facil, mira la
 * cantidad de texto»). Eran tres pasos con párrafos, «¿No funciona? Con la línea de comandos», un código que vencía y «Pedir
 * otro código». Ahora son DOS pantallas, cada una con UN botón grande, y casi sin texto:
 *   · 2, «Descarga MaKo» (sólo si viene de «Nuevo dispositivo» o de «¿Cómo la conectas?»; el sistema se detecta solo);
 *   · 4, «Conecta esta computadora»: el botón ES el «acepto» (el texto que se acepta va abajo, chico) y abre la app con el
 *     código. Lo demás pasa solo: el código no se ve, si vence se pide otro al volver a tocar, y si la persona dice «No» en la
 *     ventana vuelve al botón. Mientras tanto la pantalla dice qué tocar, y si en unos segundos no pasa nada ofrece «Probar
 *     de nuevo» y la descarga. Es la página con la que Zoom abre su app desde el navegador (un botón, el diálogo del navegador
 *     y «¿No la tienes? Descárgala»).
 * Los números de paso quedan porque el instalador vuelve al 4 (RUTA_TRAS_INSTALAR) y «Nuevo dispositivo» abre el 2.
 * Nada de comandos: el respaldo con la terminal se fue del tutorial (lo ve sólo una PC de la 0.3.x, abajo, en las cuentas).
 * En la Mac un enlace mako:// no le llega al programa: el botón deja el código en el portapapeles y la app lo toma de ahí.
 * `ia` (la ola 3): con qué IA va a contestar esa computadora; cambia el nombre, el programa y el texto que se acepta.
 */
function Tutorial({ onCerrar, pcsAntes, recargar, pasoInicial = 2, ia = 'claude' }: { onCerrar: () => void; pcsAntes: number[]; recargar: () => Promise<Estado | null>; pasoInicial?: number; ia?: ProveedorPc }) {
  const nombre = NOMBRE_IA[ia];
  const programa = PROGRAMA_IA_PC[ia];
  const conClaude = ia === 'claude';
  const sistema: SistemaPc = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent) ? 'mac' : 'windows';
  const [paso, setPaso] = useState(pasoInicial >= 4 ? 4 : 2);
  const [bajado, setBajado] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [venceAt, setVenceAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lista, setLista] = useState(false);
  // Se conectó pero su Claude no tiene la sesión iniciada: no es «¡Listo!», es iniciarla (o instalar el programa, sin él).
  const [sinSesion, setSinSesion] = useState<'sesion' | 'claude' | null>(null);
  // Cómo quedó el código en MaKo: gastado sin conectar (dijo que no, o cerró la ventana) o esperando su «sí».
  const [delCodigo, setDelCodigo] = useState<'gastado' | 'eligiendo' | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  // Tocó «Conectar»: con ese toque acepta el texto de abajo del botón (CONSENTIMIENTO_DE) y recién ahí se pide el código.
  const [acepto, setAcepto] = useState(false);
  const [abiertoAt, setAbiertoAt] = useState<number | null>(null);
  // La Mac: si el código quedó en el portapapeles (null: todavía no se intentó).
  const [copiado, setCopiado] = useState<boolean | null>(null);
  const pedirCodigo = useCallback(async (): Promise<string | null> => {
    setError(null);
    const r = await fetch('/api/ia-pc/codigo', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acepto: CONSENTIMIENTO_DE[ia].version }),
    }).then((x) => x.json()).catch(() => null);
    // Con SU reloj: la hora del servidor contra una PC adelantada hacía nacer «vencido» cada código (segunda revisión).
    if (r?.ok && r.codigo) { setCodigo(r.codigo); setDelCodigo(null); setVenceAt(Date.now() + (Number(r.duraMs) || 10 * 60_000)); setAhora(Date.now()); return r.codigo as string; }
    setError(r?.error ?? 'No pude preparar la conexión. Intenta de nuevo.');
    return null;
  }, [ia]);
  // Con el código ya usado (esperando su «sí» en la ventana), la cuenta de 10 minutos no corre: el código no vence ahí.
  const vencido = !!codigo && venceAt != null && ahora >= venceAt && delCodigo !== 'eligiendo';
  // Espera a que aparezca una computadora nueva en línea, CON un Claude con sesión. Y mira el código: si se gastó sin
  // conectar, no se queda «Esperando…» con un código que ya no sirve (segunda revisión del Cerebro, 21/10/2026).
  useEffect(() => {
    if (paso !== 4 || !codigo || lista) return;
    const t = setInterval(async () => {
      setAhora(Date.now());
      const e = await recargar();
      const nueva = e?.pcs.find((p) => p.enLinea && p.esMia && !pcsAntes.includes(p.id));
      if (nueva && cuentasDeLaIA(nueva.cuentas, ia).length) { setLista(true); setSinSesion(null); setPaso(5); return; }
      if (nueva) { setSinSesion(conClaude && nueva.sinClaude ? 'claude' : 'sesion'); return; }
      const c = await fetch(`/api/ia-pc/codigo?codigo=${encodeURIComponent(codigo)}`, { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
      if (c?.ok) setDelCodigo(c.estado === 'cancelado' ? 'gastado' : c.estado === 'eligiendo' ? 'eligiendo' : null);
    }, 3000);
    return () => clearInterval(t);
  }, [paso, codigo, lista, pcsAntes, recargar, ia, conClaude]);

  /**
   * La Mac: el código al portapapeles. En Safari la escritura tiene que salir DEL TOQUE, y el código llega después (un fetch):
   * por eso va un ClipboardItem con la promesa adentro, que es lo que WebKit pide para esto. Sin eso, `writeText` al llegar.
   */
  const copiarEnLaMac = async (pedido: Promise<string | null>) => {
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': pedido.then((c) => { if (!c) throw new Error('sin código'); return new Blob([c], { type: 'text/plain' }); }) })]);
      } else {
        const c = await pedido;
        if (!c) return;
        await navigator.clipboard.writeText(c);
      }
      setCopiado(true);
    } catch { setCopiado(false); }
  };
  /** El enlace que abre la app (Windows): el navegador pregunta «¿Abrir?», y la app, en su ventana, a qué negocio. */
  const abrirEnWindows = (c: string) => { window.location.href = `mako://conectar?codigo=${c}`; };
  /** «Conectar» y «Probar de nuevo»: con el código que sirve, lo abre de nuevo; si no (venció, o dijo que no), pide otro. */
  const conectar = () => {
    setAcepto(true); setSinSesion(null); setAbiertoAt(Date.now()); setAhora(Date.now());
    if (codigo && !vencido && delCodigo !== 'gastado') {
      if (sistema === 'windows') abrirEnWindows(codigo); else void copiarEnLaMac(Promise.resolve(codigo));
      return;
    }
    // Uno nuevo: el de antes se suelta primero, para que la espera no mire uno que ya no sirve.
    setCodigo(null); setVenceAt(null); setDelCodigo(null); setCopiado(null);
    const pedido = pedirCodigo();
    if (sistema === 'windows') void pedido.then((c) => { if (c) abrirEnWindows(c); });
    else void copiarEnLaMac(pedido);
  };
  // Acaba de tocar «Conectar» y nada lo frenó: la pantalla dice qué tocar. Un «No» en la ventana, un error o el código
  // vencido vuelven al botón.
  const esperando = acepto && !error && delCodigo !== 'gastado' && !vencido;
  const eligiendo = delCodigo === 'eligiendo';
  const tarde = abiertoAt != null && ahora - abiertoAt >= PLAZO_AYUDA_MS && !eligiendo;
  const descarga = `/api/ia-pc/descargar?os=${sistema}`;

  return (
    <div className="tci-tutorial tci-tutorial--grande" role="dialog" aria-label="Conectar mi computadora">
      <button type="button" className="tci-cerrar tci-tutorial__x" aria-label="Cerrar" onClick={onCerrar}>×</button>
      {paso === 2 && (
        <>
          <span className="tci-instalar__icono" aria-hidden><Icon name="descargar" size={26} /></span>
          <h3 className="tci-tutorial__titulo">Descarga MaKo</h3>
          <a className="tci-instalar__boton" href={descarga} onClick={() => setBajado(true)}>
            <Icon name="descargar" size={18} />{`Descargar para ${sistema === 'mac' ? 'Mac' : 'Windows'}`}
          </a>
          <p className="tci-tutorial__linea">{bajado ? (sistema === 'mac' ? AVISO_GATEKEEPER : AVISO_SMARTSCREEN) : `Instala MaKo y, si falta, ${programa}.`}</p>
          <button type="button" className="tci-tutorial__enlace" onClick={() => setPaso(4)}>Ya lo instalé</button>
          <DescargarElOtro className="tci-instalar__otro" />
        </>
      )}
      {paso === 4 && sinSesion === 'claude' && (
        <>
          <span className="tci-instalar__icono" aria-hidden><Icon name="computadora" size={26} /></span>
          <h3 className="tci-tutorial__titulo">{`Falta ${programa}`}</h3>
          {sistema === 'windows'
            ? <a className="tci-instalar__boton" href={descarga}><Icon name="descargar" size={18} />Descargar MaKo</a>
            : null}
          <p className="tci-tutorial__linea">{sistema === 'windows' ? `Ábrelo de nuevo: instala ${programa}.` : `Vuelve a abrir MaKo: instala ${programa}.`}</p>
        </>
      )}
      {paso === 4 && sinSesion === 'sesion' && (
        <>
          <span className="tci-instalar__icono" aria-hidden><Icon name="computadora" size={26} /></span>
          <h3 className="tci-tutorial__titulo">{`Inicia sesión en ${nombre}`}</h3>
          {sistema === 'windows' ? (
            <>
              <a className="tci-instalar__boton" href={conClaude ? 'mako://iniciar-sesion' : 'mako://iniciar-sesion?ia=chatgpt'}>Iniciar sesión</a>
              {/* El login de Codex termina solo en el navegador; el de Claude muestra un código que se pega en la página de la PC. */}
              <p className="tci-tutorial__linea">Se abre el navegador.</p>
            </>
          ) : <p className="tci-tutorial__linea">Vuelve a abrir MaKo: te ofrece iniciarla.</p>}
        </>
      )}
      {paso === 4 && !sinSesion && esperando && (
        <>
          <span className="tci-tutorial__criatura" aria-hidden><Criatura nombre="MaKo" estrella size={44} /></span>
          <h3 className="tci-tutorial__titulo" aria-live="polite">
            {sistema === 'mac'
              ? (eligiendo ? 'Contesta «Sí, conectar» en MaKo' : 'Abre MaKo')
              : (eligiendo ? 'Contesta «Sí» en MaKo' : 'Toca «Abrir» y después «Sí»')}
          </h3>
          {sistema === 'mac' && !eligiendo && copiado && <p className="tci-tutorial__linea">Tu código ya está copiado: MaKo lo toma solo.</p>}
          {sistema === 'mac' && copiado === false && codigo && <Copiar texto={codigo} />}
          {tarde && (
            <p className="tci-tutorial__linea">
              {sistema === 'windows' ? <>¿No se abrió? <button type="button" className="tci-tutorial__enlace" onClick={conectar}>Probar de nuevo</button>{' · '}</> : '¿No la tienes? '}
              <a className="tci-tutorial__enlace" href={descarga}>Descargar MaKo</a>
            </p>
          )}
        </>
      )}
      {paso === 4 && !sinSesion && !esperando && (
        <>
          <span className="tci-instalar__icono" aria-hidden><Icon name="computadora" size={26} /></span>
          <h3 className="tci-tutorial__titulo">Conecta esta computadora</h3>
          {error && <p className="tci-tutorial__aviso" role="alert">{error}<ReportarASoporte /></p>}
          {!error && delCodigo === 'gastado' && <p className="tci-tutorial__aviso">No se conectó.</p>}
          <button type="button" className="tci-instalar__boton" onClick={conectar}>Conectar</button>
          <p className="tci-tutorial__linea">{CONSENTIMIENTO_DE[ia].texto}</p>
        </>
      )}
      {paso === 5 && (
        <>
          <span className="tci-instalar__icono tci-instalar__icono--bien" aria-hidden><Icon name="check" size={26} /></span>
          <h3 className="tci-tutorial__titulo">Tu computadora está en línea</h3>
          <p className="tci-tutorial__linea">{`Tu Ops Center ya contesta con tu ${nombre}.`}</p>
          <button type="button" className="tci-instalar__boton" onClick={onCerrar}>Listo</button>
        </>
      )}
    </div>
  );
}

/** El «?» de «Mi computadora»: por qué no es lo mismo que la clave de API (una línea). */
const NO_ES_LO_MISMO = 'No es lo mismo que la clave: tu computadora contesta lo que le pides en el chat, con tu suscripción y mientras esté prendida; la clave hace lo que MaKo hace solo, a toda hora.';

/** El logo de cada IA (el de su integración): grande para los botones del paso 1, chico para la fila de «Nueva cuenta». */
const LogoIA = ({ ia, chico = false }: { ia: IaDelCliente; chico?: boolean }) => (ia === 'claude'
  ? <LogoClaude size={chico ? 16 : 28} />
  : <SvcIcon k={SERVICIO_DE_CLAVE[ia]} size={chico ? 11 : 18} box={chico ? 18 : 28} radius={chico ? 5 : 7} />);

/**
 * «Conectar tu IA» (IA4, 22/10/2026), un paso por pantalla: ¿qué IA? (Claude, ChatGPT o Gemini) → ¿cómo? (mi computadora, o una
 * clave de API que carga el admin; a los demás, «Pídele a <admin>»). Las opciones y sus textos: lib/conectar-ia-reglas.ts.
 * La computadora abre el tutorial de siempre; la clave, el modal de la integración (el mismo de /integraciones).
 */
function ConectarTuIA({ esAdmin, admin, listo: puedeComputadora, onComputadora, onCerrar, onConectada, iaInicial }: {
  esAdmin: boolean; admin?: string; listo: boolean;
  onComputadora: (ia: IaDelCliente) => void; onCerrar: () => void; onConectada: () => void;
  /** La que se eligió en «Nueva cuenta» (23/10/2026): arranca en «¿Cómo la conectas?». */
  iaInicial?: IaDelCliente;
}) {
  const [ia, setIa] = useState<IaDelCliente | null>(iaInicial ?? null);
  const [conectada, setConectada] = useState(false);
  const idAyuda = useId();
  const donde = ia ? dondeSacarLaClave(ia) : null;
  return (
    <div className="tci-tutorial" role="dialog" aria-label="Conectar tu IA">
      <BrandDefs />
      <div className="tci-tutorial__cab">
        <span className="tci-paso">{conectada ? '¡Listo!' : `Paso ${ia ? 2 : 1} de 2`}</span>
        <button type="button" className="tci-cerrar" aria-label="Cerrar" onClick={onCerrar}>×</button>
      </div>
      {!ia && (
        <>
          <h3>¿Qué IA usas?</h3>
          <div className="tci-grandes">
            {IAS_DEL_CLIENTE.map((x) => (
              <button key={x} type="button" className="tci-grande" onClick={() => setIa(x)}>
                <LogoIA ia={x} /><span className="tci-grande__titulo">{NOMBRE_IA[x]}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {ia && !conectada && (
        <>
          <h3>¿Cómo la conectas?</h3>
          {donde && (
            <p className="tci-nota">
              <a href={donde.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>{donde.url.replace(/^https:\/\//, '')}</a>
              {' · '}{donde.texto}
            </p>
          )}
          <div className="tci-grandes">
            {comoConectar(ia, { esAdmin, admin }).map((o) => {
              const contenido = <><span className="tci-grande__titulo">{o.titulo}</span><span className="tci-grande__detalle">{o.detalle}</span></>;
              if (o.que === 'clave') {
                return (
                  <BotonIntegracion key={o.que} servicio={SERVICIO_DE_CLAVE[ia]} className="tci-grande"
                    onConectado={() => { setConectada(true); onConectada(); }}>
                    {contenido}
                  </BotonIntegracion>
                );
              }
              // A quien no es admin no se le ofrece la clave (es del negocio): se le dice a quién pedírsela, sin botón.
              if (o.que === 'pedir') return <div key={o.que} className="tci-grande tci-grande--pedir" role="note">{contenido}</div>;
              const anda = o.habilitada && (o.que !== 'pc' || puedeComputadora);
              return (
                <button key={o.que} type="button" className="tci-grande" disabled={!anda} onClick={o.que === 'pc' ? () => onComputadora(ia) : undefined}
                  aria-describedby={o.que === 'pc' ? idAyuda : undefined}>
                  {contenido}
                  {/* «Y ACLARA QUE NO ES LO MISMO, EN ALGÚN LUGAR SUTIL, TAL VEZ EN "?"» (Martín, 25/10/2026): la clave atiende lo que
                      MaKo hace solo; la computadora, lo que le pides tú. A la vista, el `title` del «?»; al lector, la DESCRIPCIÓN del
                      botón (`aria-describedby`), no su nombre: en el nombre se leía la oración entera en cada opción (MaKo Desktop). */}
                  {o.que === 'pc' && <><span className="tci-ayuda" title={NO_ES_LO_MISMO} aria-hidden>?</span><span id={idAyuda} hidden>{NO_ES_LO_MISMO}</span></>}
                </button>
              );
            })}
          </div>
          {notaDeConectar(ia) && <p className="tci-nota">{notaDeConectar(ia)}</p>}
        </>
      )}
      {ia && conectada && (
        <>
          <h3>{`Tu ${NOMBRE_IA[ia]} está conectado`}</h3>
          <p>Desde ahora MaKo usa tu clave, también para lo que hace solo.</p>
        </>
      )}
      <div className="tci-tutorial__pie">
        {ia && !conectada && <button type="button" className="tci-boton tci-boton--suave" onClick={() => (iaInicial ? onCerrar() : setIa(null))}>Atrás</button>}
        {conectada && <button type="button" className="tci-boton" onClick={onCerrar}>Listo</button>}
      </div>
    </div>
  );
}

/**
 * LAS CLAVES DE API (25/10/2026, Martín, docs/feedback-25-10-tarde.md: «elimina las IA dentro de las integraciones, para eso
 * tenemos el bloque que dice "Tus cuentas de IA" arriba del todo. Ahí solo agrega a Groq y listo»). Las cuatro IA que eran
 * tarjetas de /integraciones viven acá, con su NOMBRE REAL (el del catálogo, lib/integraciones-catalogo.ts) y su estado. La
 * fila de Anthropic API y la de OpenAI API llevaban a «¿Cómo la conectas?» (la clave o tu computadora).
 *
 * LA CLAVE NO ES LA SUSCRIPCIÓN (27/10/2026, Leila en la llamada con Martín): «Anthropic API · Conectada» arriba y su Claude Max
 * abajo se leían como lo mismo, y no sabía con cuál contestaba MaKo. Cada fila es SÓLO la clave: dice «Clave cargada» o «Sin
 * clave» y abre el modal de SU clave (ya no la elección con la computadora, que vive en «Nueva cuenta»). La suscripción lleva su
 * nombre en cada cuenta («Suscripción Max», CuentasYDispositivos.tsx), y el «?» del título dice la diferencia, el MISMO de
 * «¿Cómo la conectas?».
 *
 * GEMINI YA NO SE OFRECE (25/10/2026, lib/conectar-ia-reglas.ts → IAS_DEL_CLIENTE): su fila sale. Salvo donde ya está cargada
 * (once negocios, medido el 27/10): MaKo la sigue usando (escuchar audios, lib/ai-cheap.ts), así que ahí se ve, para cambiarla o
 * quitarla, y dice que ya no se ofrece. Sacarla de la vista sería esconder una clave en uso.
 */
const CLAVES_API = ['anthropic', 'openai', 'groq', 'gemini'] as const;
/** Las que ya no se ofrecen: sólo se ven si el negocio ya las tiene cargadas. */
const CLAVES_RETIRADAS: ReadonlySet<string> = new Set(['gemini']);
const nombreDeClave = (key: string): string => DEFS_INTEGRACIONES.find((d) => d.key === key)?.nombre ?? key;
/** Lo que dice cada fila: la clave, nunca «Conectada» a secas (se leía como la suscripción). */
const estadoDeClave = (cargada: boolean, retirada: boolean): string =>
  (cargada ? (retirada ? 'Cargada · ya no se ofrece' : 'Clave cargada') : 'Sin clave');

function ClavesDeApi({ esAdmin }: { esAdmin: boolean }) {
  // El estado de cada una, con la MISMA cuenta que la grilla (`integracionAction` → getIntegracion). Sólo quien administra
  // conecta una clave (es del negocio): a los demás, la lista sin acciones (y sin las retiradas: no se sabe si están).
  const [estados, setEstados] = useState<Record<string, { conectada: boolean; detalle: string }>>({});
  const idAyuda = useId();
  const leer = useCallback(async () => {
    const r = await Promise.all(CLAVES_API.map((key) => integracionAction(key).catch(() => null)));
    const e: Record<string, { conectada: boolean; detalle: string }> = {};
    r.forEach((x, i) => { if (x?.ok) e[CLAVES_API[i]] = { conectada: x.integracion.estado === 'conectada', detalle: x.integracion.detalle }; });
    setEstados(e);
  }, []);
  useEffect(() => { if (esAdmin) void leer(); }, [esAdmin, leer]);
  const fila = (key: (typeof CLAVES_API)[number]) => {
    const st = estados[key];
    const retirada = CLAVES_RETIRADAS.has(key);
    if (retirada && !st?.conectada) return null;
    const contenido = (
      <>
        <SvcIcon k={key} size={13} box={22} radius={6} />
        <span className="tci-api__nombre">{nombreDeClave(key)}</span>
        {st && (
          <span className="tci-api__estado" data-conectada={(st.conectada && !retirada) || undefined} data-retirada={retirada || undefined}>
            {estadoDeClave(st.conectada, retirada)}
          </span>
        )}
      </>
    );
    if (!esAdmin) return <div key={key} className="tci-api" role="listitem">{contenido}</div>;
    return <BotonIntegracion key={key} servicio={key} className="tci-api" onConectado={() => void leer()}>{contenido}</BotonIntegracion>;
  };
  return (
    <section className="tci-bloque" aria-label="Claves de API" aria-describedby={idAyuda}>
      <BrandDefs />
      <h3 className="tci-bloque__titulo tci-bloque__titulo--ayuda">
        Claves de API
        <span className="tci-ayuda tci-ayuda--titulo" title={NO_ES_LO_MISMO} aria-hidden>?</span>
      </h3>
      <span id={idAyuda} hidden>{NO_ES_LO_MISMO}</span>
      <div className="tci-apis" role="list">{CLAVES_API.map(fila)}</div>
    </section>
  );
}

/**
 * «Nueva cuenta» (23/10/2026, Martín): arriba de todo, y sin el botón «Conectar tu IA» de antes: las opciones Claude y ChatGPT
 * se ven directo, también sin nada conectado. Se distingue de «Nuevo dispositivo» (otra computadora para una cuenta que ya está).
 * Sigue arriba, pero en UNA fila (24/10/2026, Martín: «mucha información, mucho scroll»; eran 155 px de dos tarjetas): las dos
 * opciones como botones chicos al lado del título. Las tarjetas grandes quedan para cuando no hay NADA conectado (`vacia`): ahí
 * es lo único que hay para hacer.
 */
function NuevaCuenta({ onElegir, vacia }: { onElegir: (ia: IaDelCliente) => void; vacia: boolean }) {
  return (
    <section className={`tci-bloque tci-bloque--nueva${vacia ? '' : ' tci-bloque--nueva-fila'}`} aria-label="Nueva cuenta">
      <BrandDefs />
      <h3 className="tci-bloque__titulo">Nueva cuenta</h3>
      <div className={vacia ? 'tci-grandes' : 'tci-chicas'}>
        {IAS_DEL_CLIENTE.map((x) => (
          <button key={x} type="button" className={vacia ? 'tci-grande' : 'tci-chica'} onClick={() => onElegir(x)}>
            <LogoIA ia={x} chico={!vacia} /><span className="tci-grande__titulo">{NOMBRE_IA[x]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * «Tus cuentas de IA» (23/10/2026, el feedback de Martín con capturas del ws1), en bloques bien separados:
 *   1. arriba, «Nueva cuenta» (Claude o ChatGPT), en una fila desde el 24/10/2026 (grande sólo sin nada conectado);
 *   2. cada cuenta conectada es UN bloque, «Cuenta 1», «Cuenta 2», con su email (la regla del enmascarado), su plan y su uso;
 *   3. abajo, dentro de esa cuenta, sus dispositivos (nombre, en línea o no, dónde está; al tocarlos, «Desconectar»);
 *   4. y ahí, «Nuevo dispositivo»: desde el 24/10/2026 una fila que abre el tutorial en la descarga (el recuadro con la descarga
 *      a la vista se fue: la descarga para quien no tiene la app vive en el cartel del chat, app/_chat/AppPrimero.tsx).
 * Fuera el «Modelo» (se elige en cada chat: el «+» del Ops Center), «Tu clave de Claude» y el crédito de MaKo (sólo SuperAdmin).
 * El mismo dibujo que SuperAdmin › Uso → Computadoras (CuentasYDispositivos.tsx).
 * `sinCabecera`: donde la página ya pone el título (/perfil/ia, el Uso del Ops Center). `computadora`: abre directo «Conecta MaKo»
 * (adonde vuelve el instalador de Windows al terminar: RUTA_TRAS_INSTALAR). `conectar` (el Ops Center lo pasa al abrirlo desde
 * «Conectar tu IA»): ya no hace falta, «Nueva cuenta» está siempre a la vista.
 */
/** El bloque de una cuenta mientras llega el estado: el nombre, el email, las dos ventanas y un dispositivo, en gris. Con la
 *  forma del bloque de hoy (24/10/2026: cada ventana en una fila y el dispositivo en una fila): si no, al llegar, salta. */
export function EsqueletoDeCuentas() {
  return (
    <div className="tci-esqueleto" role="status" aria-label="Cargando tus cuentas de IA" data-esqueleto="">
      <Skeleton w="38%" h={18} />
      <Skeleton w="62%" h={14} />
      <div className="tci-esqueleto__ventana"><Skeleton w="75%" h={12} /><Skeleton h={6} radius={999} /></div>
      <div className="tci-esqueleto__ventana"><Skeleton w="45%" h={12} /><Skeleton h={6} radius={999} /></div>
      <Skeleton w="28%" h={11} style={{ marginTop: 6 }} />
      <Skeleton h={44} radius={11} />
    </div>
  );
}

export function TusCuentasIA({ sinCabecera = false, computadora = false }: { sinCabecera?: boolean; conectar?: boolean; computadora?: boolean } = {}) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [eligiendo, setEligiendo] = useState<IaDelCliente | null>(null);
  const [tutorial, setTutorial] = useState(false);
  const [pasoInicial, setPasoInicial] = useState(1);
  const [iaTutorial, setIaTutorial] = useState<ProveedorPc>('claude');
  const [ahora, setAhora] = useState(() => Date.now());
  const antes = useRef<number[]>([]);
  /** Ya se intentó leer una vez: sin estado después de eso (no se pudo), lo de siempre, no el esqueleto para siempre. */
  const [leido, setLeido] = useState(false);
  const recargar = useCallback(async (): Promise<Estado | null> => {
    const e = await fetch('/api/ia-pc/estado', { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
    setLeido(true);
    if (e?.ok) { setEstado(e); setAhora(Date.now()); return e; }
    return null;
  }, []);
  useEffect(() => {
    void recargar();
    const t = setInterval(() => void recargar(), 20_000);
    return () => clearInterval(t);
  }, [recargar]);
  const desconectar = async (id: number) => {
    await fetch('/api/ia-pc/desconectar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => null);
    await recargar();
  };
  // Sólo una IA que tiene computadora (`iaDeLaPcPara`): Gemini no tiene, y el paso 2 ni lo ofrece.
  const abrirTutorialEn = (paso: number, ia: IaDelCliente = 'claude') => {
    const deLaPc = iaDeLaPcPara(ia);
    if (!deLaPc) return;
    antes.current = (estado?.pcs ?? []).map((p) => p.id); setPasoInicial(paso); setIaTutorial(deLaPc); setEligiendo(null); setTutorial(true);
  };
  // Desde el instalador: con las PC de antes YA leídas (si no, una que ya estaba en línea se tomaba por la nueva).
  const abiertoDesdeElInstalador = useRef(false);
  useEffect(() => {
    if (!computadora || !estado || abiertoDesdeElInstalador.current) return;
    abiertoDesdeElInstalador.current = true;
    antes.current = estado.pcs.map((p) => p.id);
    setPasoInicial(4); setEligiendo(null); setTutorial(true);
  }, [computadora, estado]);
  const grupos: CuentasIA = estado?.grupos ?? { cuentas: [], sinCuenta: [] };
  // Sin nada conectado (y ya leído: mientras carga no se sabe), «Nueva cuenta» es lo único que hay: va con las tarjetas grandes.
  const vacia = !!estado && !grupos.cuentas.length && !grupos.sinCuenta.length;

  return (
    // `sinCabecera` es adentro de un modal o de una página que ya pone el título: sin el marco de tarjeta, que quedaba una
    // tarjeta dentro de otra (24/10/2026).
    <section className={`tci${sinCabecera ? ' tci--suelta' : ''}`} aria-labelledby="tci-titulo">
      {sinCabecera ? <span id="tci-titulo" hidden>Tus cuentas de IA</span> : (
        <div className="tci-cab">
          <div>
            <h2 id="tci-titulo" className="tci-titulo">Tus cuentas de IA</h2>
            <p className="tci-bajada">Tu Ops Center contesta con tu Claude o tu GPT.</p>
          </div>
        </div>
      )}

      {/* Hasta que llegue el estado no se sabe qué PC ya estaban: una en línea de antes contaba como la nueva y el
          tutorial decía «¡Listo!» sin que se conectara nada (segunda revisión, 21/10/2026). Por eso «Mi computadora»
          espera al estado (`listo`). */}
      {eligiendo && (
        <ConectarTuIA esAdmin={!!estado?.esAdmin} admin={estado?.admin} listo={!!estado} iaInicial={eligiendo}
          onComputadora={(ia) => abrirTutorialEn(1, ia)} onCerrar={() => { setEligiendo(null); void recargar(); }} onConectada={() => void recargar()} />
      )}
      {tutorial && <Tutorial onCerrar={() => { setTutorial(false); void recargar(); }} pcsAntes={antes.current} recargar={recargar} pasoInicial={pasoInicial} ia={iaTutorial} />}

      {/* MIENTRAS CARGA, EL ESQUELETO DEL BLOQUE (23/10/2026, Martín: «al principio me aparecen solo los botones de "Conectar GPT o
          Claude"... Si hay cuentas conectadas debería aparecer el loader para que se sepa que falta info que cargar»). Antes del
          estado no se sabe si hay cuentas: «Nueva cuenta» sola se leía como «no tienes nada». */}
      {!estado && !leido && !eligiendo && !tutorial && <EsqueletoDeCuentas />}
      {/* SIN LA APP, SÓLO EL BOTÓN (24/10/2026, Martín: «si no tengo instalada no tengo que ver el modal de siempre, solo el botón
          bien diseñado de "Instalar MaKo desktop"»): sin ninguna computadora, ni cuentas ni «Nueva cuenta». */}
      {vacia && !eligiendo && !tutorial && <InstalarDesktop onConectar={() => abrirTutorialEn(4)} />}
      {/* Las claves de API, siempre (con o sin computadora): las cuatro IA que salieron de la grilla de /integraciones. */}
      {(estado || leido) && !eligiendo && !tutorial && <ClavesDeApi esAdmin={!!estado?.esAdmin} />}
      {(estado || leido) && !vacia && !eligiendo && !tutorial && (
        <>
          <NuevaCuenta onElegir={setEligiendo} vacia={vacia} />
          <CuentasYDispositivos grupos={grupos} ahora={ahora} onDesconectar={(d) => desconectar(d.id)}
            nuevoDispositivo={(c) => <NuevoDispositivo onAbrir={() => abrirTutorialEn(2, c.proveedor)} />}
            extraSinCuenta={(d) => (d.esMia && d.enLinea && !d.sinClaude
              // En la Mac un mako:// no le llega al programa: MaKo.app, al abrirla, ofrece la sesión.
              ? (d.sistema === 'Mac' ? <p className="tci-nota">Abre MaKo en esa Mac para iniciar sesión.</p> : (
                <>
                  <a className="tci-boton tci-boton--suave" href="mako://iniciar-sesion">Iniciar sesión en Claude</a>
                  {/* SÓLO una PC de la 0.3.x (instalada con la línea de comandos, como la del ws1) no abre mako://: ahí, la
                      de siempre, plegada. Con la app de hoy no se ve un comando (25/10/2026). */}
                  {!abreEnlacesMako(d.version) && (
                    <details className="tci-respaldo">
                      <summary>¿No funciona? Con la línea de comandos</summary>
                      <p>{DONDE_PEGAR.windows}</p>
                      <Copiar texto={LOGIN_CLAUDE.windows} />
                    </details>
                  )}
                </>
              ))
              : null)} />
        </>
      )}
    </section>
  );
}

/**
 * Sin ninguna computadora conectada, el modal es ESTO (24/10/2026, Martín: «solo el botón bien diseñado de "Instalar MaKo
 * desktop"»): la computadora, una línea y el botón, que descarga el de esta computadora (la descarga de IA del cliente, no una
 * copia). Tocado, el mismo lugar dice qué hacer con el instalador y ofrece «Ya lo instalé: conectar» (el tutorial en «Conecta
 * MaKo»). Abajo, chico, el instalador del otro sistema.
 */
function InstalarDesktop({ onConectar }: { onConectar: () => void }) {
  const [descargado, setDescargado] = useState(false);
  return (
    <div className="tci-instalar" data-instalar-desktop="">
      <span className="tci-instalar__icono" aria-hidden><Icon name="computadora" size={28} /></span>
      <h3 className="tci-instalar__titulo">{descargado ? 'Ábrelo y sigue los pasos' : 'MaKo, en tu computadora'}</h3>
      <p className="tci-instalar__texto">{descargado ? avisoAlAbrir() : 'Desde ahí tu Ops Center contesta con tu Claude.'}</p>
      {descargado
        ? <button type="button" className="tci-instalar__boton" onClick={onConectar}><Icon name="check" size={18} />Ya lo instalé: conectar</button>
        : <DescargarMaKo className="tci-instalar__boton" texto="Instalar MaKo desktop" onClick={() => setDescargado(true)}><Icon name="descargar" size={18} /></DescargarMaKo>}
      <DescargarElOtro className="tci-instalar__otro" />
    </div>
  );
}

/**
 * «Tus cuentas de IA» en /integraciones (24/10/2026): la tarjeta DESTACADA, arriba —el lugar del carrusel de Vercel Marketplace—,
 * con su estado en una línea; al tocarla, el MISMO modal «Tus cuentas de IA» del Ops Center (app/admin/operaciones/Uso.tsx y
 * app/second-brain/ChatSecondBrain.tsx). Antes el bloque entero —cuentas, uso, dispositivos— iba desplegado arriba del catálogo
 * y era lo más grande de la página. Sigue ARRIBA porque sin IA el Ops Center no contesta (21/10/2026). Lee el estado una vez y
 * al cerrar el modal: el bloque lo releía cada 20 s aunque nadie lo mirara. Su casa completa, para todos, sigue en /perfil/ia.
 */
export function TarjetaTusCuentasIA() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [leido, setLeido] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const leer = useCallback(async () => {
    const e = await fetch('/api/ia-pc/estado', { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
    setLeido(true);
    if (e?.ok) setEstado(e);
  }, []);
  useEffect(() => { void leer(); }, [leer]);
  // `?abrir=ia` (25/10/2026, tanda 3d de docs/conexiones-y-ayuda.md): el link de «Tus cuentas de IA» abre este modal, como
  // `?abrir=<key>` abre el de una integración (IntegracionesBoard). Se limpia después: un F5 no lo vuelve a abrir.
  const params = useSearchParams();
  const router = useRouter();
  const pedida = params?.get('abrir') === ABRIR_IA;
  useEffect(() => {
    if (!pedida) return;
    setAbierto(true);
    const q = new URLSearchParams(params?.toString() ?? '');
    q.delete('abrir');
    router.replace(`/integraciones${q.size ? `?${q}` : ''}`, { scroll: false });
  }, [pedida, params, router]);
  const { linea, tono } = resumenDeCuentas(estado, leido);
  return (
    <>
      <button type="button" className="tci-destacada" aria-haspopup="dialog" onClick={() => setAbierto(true)}>
        <span className="tci-destacada__logos" aria-hidden>
          <span className="tci-destacada__logo"><LogoClaude size={16} /></span>
          <SvcIcon k={SERVICIO_DE_CLAVE.chatgpt} size={13} box={26} radius={8} />
        </span>
        <span className="tci-destacada__texto">
          <span className="tci-destacada__titulo">Tus cuentas de IA</span>
          <span className="tci-destacada__linea"><span className={`tci-destacada__punto tci-destacada__punto--${tono}`} aria-hidden />{linea}</span>
        </span>
        <span className="tci-destacada__flecha" aria-hidden />
      </button>
      {abierto && (
        <Modal titulo="Tus cuentas de IA" onCerrar={() => { setAbierto(false); void leer(); }} ancho={640}>
          <TusCuentasIA sinCabecera />
        </Modal>
      )}
    </>
  );
}

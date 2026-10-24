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

import { useCallback, useEffect, useRef, useState } from 'react';
import { LogoClaude } from '@/app/admin/operaciones/Uso';
import { Modal } from '@/app/_ui/Modal';
import { Skeleton } from '@/app/_ui/Feedback';
import { BotonIntegracion } from '@/app/_components/ConectarIntegracion';
import { BrandDefs, SvcIcon } from '@/app/_components/ServicioVisual';
import { AVISO_GATEKEEPER, AVISO_SMARTSCREEN, CONSENTIMIENTO_DE, PROGRAMA_IA_PC, cuentasDeLaIA, lineaDeInstalacion, resumenDeCuentas, type CuentaPc, type CuentasIA, type SistemaPc, type ProveedorPc } from '@/lib/ia-pc-reglas';
import { IAS_DEL_CLIENTE, NOMBRE_IA, SERVICIO_DE_CLAVE, comoConectar, dondeSacarLaClave, iaDeLaPcPara, notaDeConectar, type IaDelCliente } from '@/lib/conectar-ia-reglas';
import { CuentasYDispositivos, NuevoDispositivo } from './CuentasYDispositivos';
import './tus-cuentas-ia.css';

type Pc = { id: number; nombre: string; esMia: boolean; de?: string; enLinea: boolean; ultimoLatido: string | null; version: string | null; cuentas: CuentaPc[]; sinClaude?: boolean; conectadaAt?: string | null; sistema?: string | null; ubicacion?: string | null };
/**
 * Lo que devuelve GET /api/ia-pc/estado. `grupos`: las cuentas con sus dispositivos, agrupadas en el servidor (lib/ia-pc-reglas.ts
 * → agruparPorCuenta); `pcs`, cada computadora suelta (el tutorial mira cuál apareció). Ni las claves ni el modelo se muestran
 * acá (23/10/2026): el modelo se elige en cada chat, y la clave y el crédito no le sirven al cliente en este panel.
 */
type Estado = { ok: boolean; esAdmin: boolean; modelo: string; pcs: Pc[]; grupos?: CuentasIA; /** A quien no es admin: el nombre del admin («Pídele a…»). */ admin?: string };
const COMANDO_CLAUDE: Record<SistemaPc, string> = {
  windows: 'irm https://claude.ai/install.ps1 | iex',
  mac: 'curl -fsSL https://claude.ai/install.sh | bash',
};
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

/**
 * El tutorial: un paso por pantalla. El último pide el código y espera a que la computadora aparezca. `ia` (la ola 3): con
 * qué IA va a contestar esa computadora; cambia el nombre, el programa (Claude Code o Codex) y el texto que se acepta. Los
 * respaldos con la terminal son sólo de Claude: el cliente no tiene Node para instalar Codex a mano.
 */
function Tutorial({ onCerrar, pcsAntes, recargar, pasoInicial = 1, ia = 'claude' }: { onCerrar: () => void; pcsAntes: number[]; recargar: () => Promise<Estado | null>; pasoInicial?: number; ia?: ProveedorPc }) {
  const nombre = NOMBRE_IA[ia];
  const programa = PROGRAMA_IA_PC[ia];
  const conClaude = ia === 'claude';
  const detectado: SistemaPc = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent) ? 'mac' : 'windows';
  const [sistema, setSistema] = useState<SistemaPc>(detectado);
  const [paso, setPaso] = useState(pasoInicial);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [venceAt, setVenceAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lista, setLista] = useState(false);
  // Se conectó pero su Claude no tiene la sesión iniciada: no es «¡Listo!», es volver al paso 3 (o al 2, sin Claude).
  const [sinSesion, setSinSesion] = useState<'sesion' | 'claude' | null>(null);
  // Cómo quedó el código en MaKo: gastado sin conectar (dijo que no, o cerró la ventana) o esperando su «sí».
  const [delCodigo, setDelCodigo] = useState<'gastado' | 'eligiendo' | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  // El código se pide recién cuando la persona acepta con un toque cómo funciona (TEXTO_CONSENTIMIENTO).
  const [acepto, setAcepto] = useState(false);
  // TRES pasos y ninguno abre una terminal: en Windows (0.4.0) el instalador con asistente pone MaKo y Claude Code, y la
  // sesión de Claude la inicia el programa en una página local (mako://iniciar-sesion); en la Mac (0.4.2) MaKo.app hace lo
  // mismo y toma el código del portapapeles (en la Mac un enlace mako:// no le llega al programa). La terminal, plegada.
  const pasos = [1, 2, 4];
  const anterior = pasos[pasos.indexOf(paso) - 1];
  const siguiente = pasos[pasos.indexOf(paso) + 1];
  const pedirCodigo = useCallback(async () => {
    setError(null);
    const r = await fetch('/api/ia-pc/codigo', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acepto: CONSENTIMIENTO_DE[ia].version }),
    }).then((x) => x.json()).catch(() => null);
    // Con SU reloj: la hora del servidor contra una PC adelantada hacía nacer «vencido» cada código (segunda revisión).
    if (r?.ok && r.codigo) { setCodigo(r.codigo); setDelCodigo(null); setVenceAt(Date.now() + (Number(r.duraMs) || 10 * 60_000)); setAhora(Date.now()); }
    else setError(r?.error ?? 'No pude crear el código. Intenta de nuevo.');
  }, [ia]);
  useEffect(() => { if (paso === 4 && acepto && !codigo) void pedirCodigo(); }, [paso, acepto, codigo, pedirCodigo]);
  // Con el código ya usado (esperando su «sí» en la ventana), la cuenta de 10 minutos no corre: el código no vence ahí.
  const vencido = !!codigo && venceAt != null && ahora >= venceAt && delCodigo !== 'eligiendo';
  // Espera a que aparezca una computadora nueva en línea, CON un Claude con sesión. Y mira el código: si se gastó sin
  // conectar, no se queda «Esperando…» con una línea que ya no sirve (segunda revisión del Cerebro, 21/10/2026).
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
  // Otro código sin volver a aceptar: la persona ya aceptó en esta misma pantalla.
  // Con un código en pantalla, alcanza con soltarlo: el efecto de arriba pide el nuevo. Pedirlo acá TAMBIÉN creaba dos, y
  // el segundo anula al primero (lib/ia-pc.ts → crearCodigo), que podía quedar en pantalla.
  const otroCodigo = () => { setDelCodigo(null); setSinSesion(null); if (codigo) { setCodigo(null); setVenceAt(null); } else void pedirCodigo(); };

  return (
    <div className="tci-tutorial" role="dialog" aria-label="Conectar mi computadora">
      <div className="tci-tutorial__cab">
        <span className="tci-paso">{paso < 5 ? `Paso ${Math.max(1, pasos.indexOf(paso) + 1)} de ${pasos.length}` : '¡Listo!'}</span>
        <button type="button" className="tci-cerrar" aria-label="Cerrar" onClick={onCerrar}>×</button>
      </div>
      {paso === 1 && (
        <>
          <h3>¿Qué computadora usas?</h3>
          <p>{`Tu Ops Center va a contestar con tu ${nombre}, en esa computadora. Tiene que quedar prendida.`}</p>
          <div className="tci-opciones">
            {(['windows', 'mac'] as const).map((s) => (
              <button key={s} type="button" className={`tci-opcion${sistema === s ? ' is-on' : ''}`} onClick={() => setSistema(s)}>{s === 'windows' ? 'Windows' : 'Mac'}</button>
            ))}
          </div>
        </>
      )}
      {paso === 2 && sistema === 'windows' && (
        <>
          <h3>Descarga MaKo</h3>
          <p>{`Ábrelo y sigue el asistente: Siguiente › Instalar › Finalizar. Instala MaKo y, si no lo tienes, ${programa}.`}</p>
          <a className="tci-boton" href="/api/ia-pc/descargar?os=windows">Descargar MaKo para Windows</a>
          <p className="tci-nota">{AVISO_SMARTSCREEN}</p>
          <p className="tci-nota">Si ya lo instalaste, sigue al próximo paso.</p>
        </>
      )}
      {paso === 2 && sistema === 'mac' && (
        <>
          <h3>Descarga MaKo</h3>
          <p>{`Abre el archivo y después MaKo: instala ${programa} si no lo tienes, sin Terminal.`}</p>
          <a className="tci-boton" href="/api/ia-pc/descargar?os=mac">Descargar MaKo para Mac</a>
          <p className="tci-nota">{AVISO_GATEKEEPER}</p>
          <p className="tci-nota">Si ya la abriste, sigue al próximo paso.</p>
          {conClaude && (
            <details className="tci-respaldo">
              <summary>¿No funciona? Con la Terminal</summary>
              <p>{DONDE_PEGAR.mac} Es Claude Code, no la app de escritorio de Claude.</p>
              <Copiar texto={COMANDO_CLAUDE.mac} />
              <Copiar texto={LOGIN_CLAUDE.mac} />
            </details>
          )}
        </>
      )}
      {paso === 4 && (
        <>
          <h3>Conecta MaKo</h3>
          {!acepto ? (
            <>
              <p className="tci-acepto">{CONSENTIMIENTO_DE[ia].texto}</p>
              <button type="button" className="tci-boton" onClick={() => setAcepto(true)}>Acepto, conectar</button>
            </>
          ) : (
            <>
              {sistema === 'windows' ? (
                <>
                  <p>Toca «Conectar esta computadora»: MaKo te pregunta en una ventana a qué negocio se conecta. Después arranca cada vez que prendas la computadora.</p>
                  {codigo && !vencido && delCodigo !== 'gastado'
                    ? <a className="tci-boton" href={`mako://conectar?codigo=${codigo}`}>Conectar esta computadora</a>
                    : !codigo && <p className="tci-nota">{error ?? 'Preparando tu código…'}</p>}
                  <p className="tci-nota">Si no pasa nada, primero instala MaKo (paso 2).</p>
                  {/* La línea de comandos queda SÓLO de respaldo, plegada (el Cerebro, 22/10/2026). */}
                  {codigo && !vencido && delCodigo !== 'gastado' && (
                    <details className="tci-respaldo">
                      <summary>¿No funciona? Con la línea de comandos</summary>
                      <p>{DONDE_PEGAR.windows}</p>
                      <Copiar texto={lineaDeInstalacion(window.location.origin, 'windows', codigo)} />
                    </details>
                  )}
                </>
              ) : (
                <>
                  <p>Copia el código y abre MaKo: lo toma solo, te dice a qué negocio se conecta y te pregunta si es el tuyo. Después arranca cada vez que prendas la Mac.</p>
                  {codigo && !vencido && delCodigo !== 'gastado' ? <Copiar texto={codigo} /> : !codigo && <p className="tci-nota">{error ?? 'Preparando tu código…'}</p>}
                  <p className="tci-nota">Si no lo encuentra, te lo pide en una ventana: pégalo ahí.</p>
                  {codigo && !vencido && delCodigo !== 'gastado' && (
                    <details className="tci-respaldo">
                      <summary>¿No funciona? Con la Terminal</summary>
                      <p>{DONDE_PEGAR.mac}</p>
                      <Copiar texto={lineaDeInstalacion(window.location.origin, 'mac', codigo)} />
                    </details>
                  )}
                </>
              )}
            </>
          )}
          {(error || vencido || delCodigo === 'gastado') && (
            <>
              {delCodigo === 'gastado'
                ? <p className="tci-nota">Ese código ya se usó y la computadora no quedó conectada.</p>
                : vencido && <p className="tci-nota">El código venció.</p>}
              <button type="button" className="tci-boton" onClick={otroCodigo}>Pedir otro código</button>
            </>
          )}
          {codigo && !vencido && !sinSesion && delCodigo !== 'gastado' && (
            <>
              <p className="tci-espera">
                <span className="tci-punto tci-punto--esperando" aria-hidden />{' '}
                {delCodigo === 'eligiendo' ? 'Tu computadora te pregunta si es tu negocio: contesta en esa ventana.' : 'Esperando a tu computadora… (el código dura 10 minutos)'}
              </p>
              <button type="button" className="tci-boton tci-boton--suave" onClick={otroCodigo}>Pedir otro código</button>
            </>
          )}
          {sinSesion === 'claude' && (
            <>
              <p className="tci-nota">{sistema === 'windows' ? `Tu computadora se conectó, pero no tiene ${programa}: vuelve a abrir el instalador de MaKo, que lo instala.` : `Tu Mac se conectó, pero no tiene ${programa}: vuelve a abrir MaKo, que lo instala.`}</p>
              <button type="button" className="tci-boton tci-boton--suave" onClick={() => setPaso(2)}>{sistema === 'windows' ? 'Volver a instalar (paso 2)' : 'Volver al paso 2'}</button>
            </>
          )}
          {sinSesion === 'sesion' && (
            <>
              <p className="tci-nota">{`Tu computadora se conectó, pero tu ${nombre} no tiene la sesión iniciada.`}</p>
              {sistema === 'windows' ? (
                <>
                  <a className="tci-boton" href={conClaude ? 'mako://iniciar-sesion' : 'mako://iniciar-sesion?ia=chatgpt'}>{`Iniciar sesión en ${nombre}`}</a>
                  {/* El login de Codex termina solo en el navegador: no hay código que pegar (docs/hallazgos-ia.md, la ola 3). */}
                  <p className="tci-nota">{conClaude ? 'Se abre el navegador: entra con tu cuenta de Claude y pega el código que te muestra.' : 'Se abre el navegador: entra con tu cuenta de ChatGPT.'}</p>
                  {/* Una PC instalada con la línea de comandos (la 0.3.2, como la del ws1) no abre mako://: ahí, la de siempre. */}
                  {conClaude && (
                    <details className="tci-respaldo">
                      <summary>¿No funciona? Con la línea de comandos</summary>
                      <p>{DONDE_PEGAR.windows}</p>
                      <Copiar texto={LOGIN_CLAUDE.windows} />
                    </details>
                  )}
                </>
              ) : (
                <>
                  <p className="tci-nota">{`Vuelve a abrir MaKo: te ofrece iniciar la sesión de ${nombre} en el navegador.`}</p>
                  {conClaude && (
                    <details className="tci-respaldo">
                      <summary>¿No funciona? Con la Terminal</summary>
                      <p>{DONDE_PEGAR.mac}</p>
                      <Copiar texto={LOGIN_CLAUDE.mac} />
                    </details>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
      {paso === 5 && (
        <>
          <h3>Tu computadora está en línea</h3>
          <p>{`Desde ahora tu Ops Center contesta con tu ${nombre}. Si la apagas, el chat te avisa hasta que la prendas.`}</p>
        </>
      )}
      <div className="tci-tutorial__pie">
        {paso > 1 && paso < 5 && anterior != null && <button type="button" className="tci-boton tci-boton--suave" onClick={() => setPaso(anterior)}>Atrás</button>}
        {paso < 4 && siguiente != null && <button type="button" className="tci-boton" onClick={() => setPaso(siguiente)}>Siguiente</button>}
        {paso === 5 && <button type="button" className="tci-boton" onClick={onCerrar}>Listo</button>}
      </div>
    </div>
  );
}

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
                <button key={o.que} type="button" className="tci-grande" disabled={!anda} onClick={o.que === 'pc' ? () => onComputadora(ia) : undefined}>
                  {contenido}
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
            <p className="tci-bajada">Tu Ops Center contesta con tu Claude, tu GPT o tu Gemini.</p>
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
      {(estado || leido) && !eligiendo && !tutorial && (
        <>
          <NuevaCuenta onElegir={setEligiendo} vacia={vacia} />
          <CuentasYDispositivos grupos={grupos} ahora={ahora} onDesconectar={(d) => desconectar(d.id)}
            nuevoDispositivo={(c) => <NuevoDispositivo onAbrir={() => abrirTutorialEn(2, c.proveedor)} />}
            extraSinCuenta={(d) => (d.esMia && d.enLinea && !d.sinClaude
              ? (
                <>
                  <a className="tci-boton tci-boton--suave" href="mako://iniciar-sesion">Iniciar sesión en Claude</a>
                  {/* Una PC de la 0.3.2 (instalada con la línea de comandos) no abre mako://: ahí, la de siempre. */}
                  <details className="tci-respaldo">
                    <summary>¿No funciona? Con la línea de comandos</summary>
                    <p>{DONDE_PEGAR.windows}</p>
                    <Copiar texto={LOGIN_CLAUDE.windows} />
                  </details>
                </>
              )
              : null)} />
        </>
      )}
    </section>
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
  const { linea, tono } = resumenDeCuentas(estado, leido);
  return (
    <>
      <button type="button" className="tci-destacada" aria-haspopup="dialog" onClick={() => setAbierto(true)}>
        <span className="tci-destacada__logos" aria-hidden>
          <span className="tci-destacada__logo"><LogoClaude size={16} /></span>
          <SvcIcon k={SERVICIO_DE_CLAVE.chatgpt} size={13} box={26} radius={8} />
          <SvcIcon k={SERVICIO_DE_CLAVE.gemini} size={13} box={26} radius={8} />
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

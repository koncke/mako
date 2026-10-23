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
import { BotonIntegracion } from '@/app/_components/ConectarIntegracion';
import { BrandDefs, SvcIcon } from '@/app/_components/ServicioVisual';
import { hace } from '@/lib/progreso-reglas';
import { TEXTO_CONSENTIMIENTO, VERSION_CONSENTIMIENTO, detalleDeLaPc, estadoDeLaPc, lineaDeInstalacion, yaPaso, type CuentaPc, type SistemaPc } from '@/lib/ia-pc-reglas';
import { nombreDeSuClave, queHacer, textoDeSuClave, type EstadoSuClave, type ProvSuClave } from '@/lib/su-clave-reglas';
import { IAS_DEL_CLIENTE, NOMBRE_IA, SERVICIO_DE_CLAVE, comoConectar, notaDeConectar, type IaDelCliente } from '@/lib/conectar-ia-reglas';
import './tus-cuentas-ia.css';

type Pc = { id: number; nombre: string; esMia: boolean; de?: string; enLinea: boolean; ultimoLatido: string | null; version: string | null; cuentas: CuentaPc[]; sinClaude?: boolean; conectadaAt?: string | null; sistema?: string | null };
/** «22/10»: cuándo se conectó una PC (en la zona de quien mira). */
const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' });
type SuClave = EstadoSuClave & { es: 'propia' | 'copia' | 'ilegible' | 'credito'; modelo?: 'haiku' | 'sonnet'; soloHaiku?: boolean };
/** El modelo de su Claude por clave (IA5). Lo paga su cuenta. */
const MODELOS_SU_CLAUDE: Array<{ v: 'haiku' | 'sonnet'; t: string }> = [{ v: 'haiku', t: 'Haiku' }, { v: 'sonnet', t: 'Sonnet' }];
/** `claves`: sólo para el admin. `null` = no se pudo leer (no se inventa «Todavía no se usó»). */
type Estado = { ok: boolean; esAdmin: boolean; modelo: string; pcs: Pc[]; claves?: SuClave[] | null; /** A quien no es admin: el nombre del admin («Pídele a…»). */ admin?: string };

const MODELOS: Array<{ v: string; t: string }> = [{ v: 'sonnet', t: 'Sonnet (recomendado)' }, { v: 'opus', t: 'Opus' }, { v: 'haiku', t: 'Haiku' }];
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

/** «a las 15:30» o «mañana a las 09:00», en la hora del navegador de quien mira (es de cualquier negocio, no de Martín). */
function cuandoSeReinicia(t: number, ahora: number): string {
  const hora = new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const dia = (x: number) => { const d = new Date(x); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const dias = Math.round((dia(t) - dia(ahora)) / 86_400_000);
  return dias <= 0 ? `a las ${hora}` : dias === 1 ? `mañana a las ${hora}` : `el ${new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' })} a las ${hora}`;
}

function Barra({ titulo, pct, repone, ahora }: { titulo: string; pct?: number; repone?: string; ahora: number }) {
  const tono = pct == null ? 'apagado' : pct >= 90 ? 'mal' : pct >= 75 ? 'ojo' : 'bien';
  return (
    <div className="tci-ventana">
      <div className="tci-fila">
        <span className="tci-nombre">{titulo}</span>
        <span className={`tci-pct${pct == null ? ' tci-pct--sin' : ''}`}>{pct == null ? 'Sin medir' : `${pct}% usado`}</span>
      </div>
      <div className="tci-barra" aria-hidden><span className={`tci-lleno tci-lleno--${tono}`} style={{ width: `${pct ?? 0}%` }} /></div>
      {repone && pct != null && !yaPaso(repone, ahora) && <p className="tci-nota">{`Se reinicia ${cuandoSeReinicia(Date.parse(repone), ahora)}`}</p>}
    </div>
  );
}

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

/** El tutorial: un paso por pantalla. El último pide el código y espera a que la computadora aparezca. */
function Tutorial({ onCerrar, pcsAntes, recargar }: { onCerrar: () => void; pcsAntes: number[]; recargar: () => Promise<Estado | null> }) {
  const detectado: SistemaPc = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent) ? 'mac' : 'windows';
  const [sistema, setSistema] = useState<SistemaPc>(detectado);
  const [paso, setPaso] = useState(1);
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
  const pedirCodigo = useCallback(async () => {
    setError(null);
    const r = await fetch('/api/ia-pc/codigo', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acepto: VERSION_CONSENTIMIENTO }),
    }).then((x) => x.json()).catch(() => null);
    // Con SU reloj: la hora del servidor contra una PC adelantada hacía nacer «vencido» cada código (segunda revisión).
    if (r?.ok && r.codigo) { setCodigo(r.codigo); setDelCodigo(null); setVenceAt(Date.now() + (Number(r.duraMs) || 10 * 60_000)); setAhora(Date.now()); }
    else setError(r?.error ?? 'No pude crear el código. Intenta de nuevo.');
  }, []);
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
      if (nueva && nueva.cuentas.length) { setLista(true); setSinSesion(null); setPaso(5); return; }
      if (nueva) { setSinSesion(nueva.sinClaude ? 'claude' : 'sesion'); return; }
      const c = await fetch(`/api/ia-pc/codigo?codigo=${encodeURIComponent(codigo)}`, { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
      if (c?.ok) setDelCodigo(c.estado === 'cancelado' ? 'gastado' : c.estado === 'eligiendo' ? 'eligiendo' : null);
    }, 3000);
    return () => clearInterval(t);
  }, [paso, codigo, lista, pcsAntes, recargar]);
  // Otro código sin volver a aceptar: la persona ya aceptó en esta misma pantalla.
  // Con un código en pantalla, alcanza con soltarlo: el efecto de arriba pide el nuevo. Pedirlo acá TAMBIÉN creaba dos, y
  // el segundo anula al primero (lib/ia-pc.ts → crearCodigo), que podía quedar en pantalla.
  const otroCodigo = () => { setDelCodigo(null); setSinSesion(null); if (codigo) { setCodigo(null); setVenceAt(null); } else void pedirCodigo(); };

  return (
    <div className="tci-tutorial" role="dialog" aria-label="Conectar mi computadora">
      <div className="tci-tutorial__cab">
        <span className="tci-paso">{paso < 5 ? `Paso ${paso} de 4` : '¡Listo!'}</span>
        <button type="button" className="tci-cerrar" aria-label="Cerrar" onClick={onCerrar}>×</button>
      </div>
      {paso === 1 && (
        <>
          <h3>¿Qué computadora usas?</h3>
          <p>Tu Ops Center va a contestar con tu Claude, en esa computadora. Tiene que quedar prendida.</p>
          <div className="tci-opciones">
            {(['windows', 'mac'] as const).map((s) => (
              <button key={s} type="button" className={`tci-opcion${sistema === s ? ' is-on' : ''}`} onClick={() => setSistema(s)}>{s === 'windows' ? 'Windows' : 'Mac'}</button>
            ))}
          </div>
        </>
      )}
      {paso === 2 && (
        <>
          <h3>Instala Claude Code</h3>
          <p>{DONDE_PEGAR[sistema]} Es Claude Code, no la app de escritorio de Claude. Si ya lo tienes, sigue al próximo paso.</p>
          <Copiar texto={COMANDO_CLAUDE[sistema]} />
        </>
      )}
      {paso === 3 && (
        <>
          <h3>Inicia sesión con tu Claude</h3>
          <p>En la misma ventana pega esto y aprieta Enter: se abre el navegador para que entres con tu cuenta de Claude.</p>
          <Copiar texto={LOGIN_CLAUDE[sistema]} />
          <p className="tci-nota">Es tu cuenta de siempre (Pro o Max). MaKo nunca ve tu contraseña ni tu sesión. Si te lo saltas, MaKo te lo vuelve a pedir al conectarse.</p>
        </>
      )}
      {paso === 4 && (
        <>
          <h3>Conecta MaKo</h3>
          {!acepto ? (
            <>
              <p className="tci-acepto">{TEXTO_CONSENTIMIENTO}</p>
              <button type="button" className="tci-boton" onClick={() => setAcepto(true)}>Acepto, conectar</button>
            </>
          ) : (
            <>
              <p>{DONDE_PEGAR[sistema]} MaKo te dice a qué negocio se conecta y te pregunta si es el tuyo. Después arranca cada vez que prendas la computadora.</p>
              {codigo && !vencido && delCodigo !== 'gastado' ? <Copiar texto={lineaDeInstalacion(window.location.origin, sistema, codigo)} /> : !codigo && <p className="tci-nota">{error ?? 'Preparando tu código…'}</p>}
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
              <p className="tci-nota">Tu computadora se conectó, pero no tiene Claude Code instalado.</p>
              <button type="button" className="tci-boton tci-boton--suave" onClick={() => setPaso(2)}>Instalar Claude Code (paso 2)</button>
            </>
          )}
          {sinSesion === 'sesion' && (
            <>
              <p className="tci-nota">Tu computadora se conectó, pero tu Claude no tiene la sesión iniciada.</p>
              <button type="button" className="tci-boton tci-boton--suave" onClick={() => setPaso(3)}>Iniciar sesión (paso 3)</button>
            </>
          )}
        </>
      )}
      {paso === 5 && (
        <>
          <h3>Tu computadora está en línea</h3>
          <p>Desde ahora tu Ops Center contesta con tu Claude. Si la apagas, el chat te avisa hasta que la prendas.</p>
        </>
      )}
      <div className="tci-tutorial__pie">
        {paso > 1 && paso < 5 && <button type="button" className="tci-boton tci-boton--suave" onClick={() => setPaso(paso - 1)}>Atrás</button>}
        {paso < 4 && <button type="button" className="tci-boton" onClick={() => setPaso(paso + 1)}>Siguiente</button>}
        {paso === 5 && <button type="button" className="tci-boton" onClick={onCerrar}>Listo</button>}
      </div>
    </div>
  );
}

/**
 * Las claves de API del negocio y si anduvieron o fallaron (IA3, 22/10/2026). Antes una clave sin crédito se veía igual que
 * «nunca se usó»: cada fallo ahora deja su fila (lib/su-clave.ts) y acá se lee la más reciente. «Probar mi clave» hace un
 * pedido que no cobra: dice si la clave es válida, no si tiene crédito (eso lo dice la próxima respuesta).
 */
function SusClaves({ claves, ahora, recargar }: { claves: SuClave[] | null; ahora: number; recargar: () => Promise<Estado | null> }) {
  const [probando, setProbando] = useState<ProvSuClave | null>(null);
  const [prueba, setPrueba] = useState<Partial<Record<ProvSuClave, { anda: boolean; texto: string }>>>({});
  const probar = async (p: ProvSuClave) => {
    setProbando(p);
    const r = await fetch('/api/ia-del-negocio/probar-clave', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ proveedor: p }),
    }).then((x) => x.json()).catch(() => null);
    setPrueba((s) => ({ ...s, [p]: r?.ok ? { anda: !!r.anda, texto: String(r.texto) } : { anda: false, texto: r?.error ?? 'No pude probarla. Intenta de nuevo.' } }));
    setProbando(null);
    void recargar();
  };
  const [modelos, setModelos] = useState<Partial<Record<ProvSuClave, string>>>({});
  const elegirModelo = async (modelo: string) => {
    setModelos((s) => ({ ...s, anthropic: modelo }));
    await fetch('/api/ia-del-negocio/modelo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ modelo }) }).catch(() => null);
    void recargar();
  };
  if (claves === null) return <p className="tci-nota">No pude ver tus claves de API. Intenta de nuevo en un rato.</p>;
  return (
    <div className="tci-claves">
      <BrandDefs />
      {claves.map((c) => {
        const linea = c.es === 'propia' || c.es === 'credito' ? textoDeSuClave(c, ahora, hace) : null;
        const hacer = linea?.tono === 'mal' && c.fallo ? queHacer(c.fallo.motivo) : null;
        const r = prueba[c.proveedor];
        return (
          <div key={c.proveedor} className="tci-clave">
            <div className="tci-fila">
              <span className="tci-quien"><SvcIcon k={c.proveedor} size={14} box={24} radius={6} />{`Tu clave de ${nombreDeSuClave(c.proveedor)}`}</span>
              {c.es === 'propia' && (
                <button type="button" className="tci-boton tci-boton--suave tci-boton--chico" disabled={probando != null} onClick={() => void probar(c.proveedor)}>
                  {probando === c.proveedor ? 'Probando…' : 'Probar mi clave'}
                </button>
              )}
            </div>
            {linea && <p className={`tci-nota tci-clave__estado tci-clave__estado--${linea.tono}`}>{linea.texto}</p>}
            {hacer && <p className="tci-nota">{hacer}</p>}
            {c.es === 'credito' && <p className="tci-nota">Usa el crédito de Claude que te dio MaKo.</p>}
            {c.es === 'copia' && <p className="tci-nota">Es la clave de MaKo, no la tuya. <BotonIntegracion servicio={c.proveedor} style={{ color: 'var(--primary)', fontWeight: 600 }}>Pegar la tuya</BotonIntegracion></p>}
            {c.es === 'ilegible' && <p className="tci-nota">No puedo leerla. <BotonIntegracion servicio={c.proveedor} style={{ color: 'var(--primary)', fontWeight: 600 }}>Pegarla de nuevo</BotonIntegracion></p>}
            {r && <p className={`tci-nota tci-clave__estado tci-clave__estado--${r.anda ? 'bien' : 'mal'}`} role="status">{r.texto}</p>}
            {/* IA5: el modelo de SU Claude, que paga su cuenta. El crédito de Max de MaKo puesto como clave va con Haiku. */}
            {c.proveedor === 'anthropic' && c.es === 'propia' && c.modelo && (
              <div className="tci-modelo">
                <div className="tci-opciones">
                  {MODELOS_SU_CLAUDE.map((m) => (
                    <button key={m.v} type="button" className={`tci-opcion${(modelos[c.proveedor] ?? c.modelo) === m.v ? ' is-on' : ''}`}
                      disabled={c.soloHaiku && m.v !== 'haiku'} onClick={() => void elegirModelo(m.v)}>{m.t}</button>
                  ))}
                </div>
                <p className="tci-nota">{c.soloHaiku ? 'Con esta clave, Haiku.' : 'Sonnet escribe mejor y gasta más de tu cuenta.'}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** El logo de cada IA, para los botones grandes del paso 1. */
const LogoIA = ({ ia }: { ia: IaDelCliente }) => (ia === 'claude' ? <LogoClaude size={28} /> : <SvcIcon k="openai" size={18} box={28} radius={7} />);

/**
 * «Conectar tu IA» (IA4, 22/10/2026), un paso por pantalla: ¿qué IA? (Claude o ChatGPT) → ¿cómo? (mi computadora, o una
 * clave de API que carga el admin; a los demás, «Pídele a <admin>»). Las opciones y sus textos: lib/conectar-ia-reglas.ts.
 * La computadora abre el tutorial de siempre; la clave, el modal de la integración (el mismo de /integraciones).
 */
function ConectarTuIA({ esAdmin, admin, listo: puedeComputadora, onComputadora, onCerrar, onConectada }: {
  esAdmin: boolean; admin?: string; listo: boolean;
  onComputadora: () => void; onCerrar: () => void; onConectada: () => void;
}) {
  const [ia, setIa] = useState<IaDelCliente | null>(null);
  const [conectada, setConectada] = useState(false);
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
                <button key={o.que} type="button" className="tci-grande" disabled={!anda} onClick={o.que === 'pc' ? onComputadora : undefined}>
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
        {ia && !conectada && <button type="button" className="tci-boton tci-boton--suave" onClick={() => setIa(null)}>Atrás</button>}
        {conectada && <button type="button" className="tci-boton" onClick={onCerrar}>Listo</button>}
      </div>
    </div>
  );
}

/**
 * `sinCabecera`: donde la página ya pone el título (/perfil/ia), sólo el botón; si no, el título salía dos veces.
 * `conectar`: abre directo «¿Qué IA usas?» (el modal del botón «Conectar tu IA» del Ops Center).
 */
export function TusCuentasIA({ sinCabecera = false, conectar = false }: { sinCabecera?: boolean; conectar?: boolean } = {}) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [eligiendo, setEligiendo] = useState(conectar);
  const [tutorial, setTutorial] = useState(false);
  const [confirmar, setConfirmar] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const antes = useRef<number[]>([]);
  const recargar = useCallback(async (): Promise<Estado | null> => {
    const e = await fetch('/api/ia-pc/estado', { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
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
    setConfirmar(null);
    void recargar();
  };
  const elegirModelo = async (modelo: string) => {
    setEstado((e) => (e ? { ...e, modelo } : e));
    await fetch('/api/ia-pc/modelo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ modelo }) }).catch(() => null);
  };
  const abrirTutorial = () => { antes.current = (estado?.pcs ?? []).map((p) => p.id); setEligiendo(false); setTutorial(true); };

  return (
    <section className="tci" aria-labelledby="tci-titulo">
      <div className="tci-cab">
        {sinCabecera ? <span id="tci-titulo" hidden>Tus cuentas de IA</span> : (
          <div>
            <h2 id="tci-titulo" className="tci-titulo">Tus cuentas de IA</h2>
            <p className="tci-bajada">Tu Ops Center contesta con tu Claude o tu GPT.</p>
          </div>
        )}
        {!eligiendo && !tutorial && <button type="button" className="tci-boton" onClick={() => setEligiendo(true)}>Conectar tu IA</button>}
      </div>

      {/* Hasta que llegue el estado no se sabe qué PC ya estaban: una en línea de antes contaba como la nueva y el
          tutorial decía «¡Listo!» sin que se conectara nada (segunda revisión, 21/10/2026). Por eso «Mi computadora»
          espera al estado (`listo`). */}
      {eligiendo && (
        <ConectarTuIA esAdmin={!!estado?.esAdmin} admin={estado?.admin} listo={!!estado}
          onComputadora={abrirTutorial} onCerrar={() => { setEligiendo(false); void recargar(); }} onConectada={() => void recargar()} />
      )}
      {tutorial && <Tutorial onCerrar={() => { setTutorial(false); void recargar(); }} pcsAntes={antes.current} recargar={recargar} />}

      {estado && !estado.pcs.length && !tutorial && !eligiendo && <p className="tci-vacio">Todavía no conectaste ninguna computadora.</p>}
      {estado?.pcs.map((pc) => (
        <div key={pc.id} className="tci-pc">
          <div className="tci-fila">
            <span className="tci-pc__nombre">{pc.nombre}{pc.de ? <span className="tci-nota"> · de {pc.de}</span> : null}</span>
            <span className="tci-estado">
              <span className={`tci-punto tci-punto--${pc.enLinea && pc.cuentas.length ? 'linea' : pc.enLinea ? 'esperando' : 'apagada'}`} aria-hidden />
              {estadoDeLaPc(pc, ahora, hace)}
            </span>
          </div>
          {/* Con varias, cuál es cuál: el sistema (desde la 0.4.0) y cuándo se conectó. Sin dato, nada. */}
          {detalleDeLaPc(pc, fechaCorta) && <p className="tci-nota">{detalleDeLaPc(pc, fechaCorta)}</p>}
          {pc.cuentas.map((c, i) => (
            <div key={`${pc.id}-${i}`} className="tci-cuenta">
              <div className="tci-quien">
                <LogoClaude />
                <span className="tci-nombres">
                  <span>{c.email ?? 'Tu cuenta de Claude'}{c.plan && <span className="tci-plan">{c.plan}</span>}</span>
                </span>
              </div>
              <Barra titulo="Sesión de 5 horas" pct={c.usado5h} repone={c.repone} ahora={ahora} />
              <Barra titulo="Semana" pct={c.usadoSemana} ahora={ahora} />
            </div>
          ))}
          <div className="tci-acciones">
            {confirmar === pc.id
              ? <>
                <span className="tci-nota">¿Desconectarla? Tu chat deja de usarla.</span>
                <button type="button" className="tci-boton tci-boton--peligro" onClick={() => void desconectar(pc.id)}>Desconectar</button>
                <button type="button" className="tci-boton tci-boton--suave" onClick={() => setConfirmar(null)}>Cancelar</button>
              </>
              : <button type="button" className="tci-boton tci-boton--suave" onClick={() => setConfirmar(pc.id)}>Desconectar</button>}
          </div>
        </div>
      ))}

      {/* Varias computadoras (22/10/2026): la de la casa y la de la oficina, cada una con su Claude. */}
      {!!estado?.pcs.length && !tutorial && !eligiendo && (
        <button type="button" className="tci-boton tci-boton--suave" onClick={abrirTutorial}>Conectar otra computadora</button>
      )}

      {estado?.esAdmin && !!estado.pcs.length && (
        <div className="tci-modelo">
          <span className="tci-nombre">Modelo</span>
          <div className="tci-opciones">
            {MODELOS.map((m) => (
              <button key={m.v} type="button" className={`tci-opcion${estado.modelo === m.v ? ' is-on' : ''}`} onClick={() => void elegirModelo(m.v)}>{m.t}</button>
            ))}
          </div>
          <p className="tci-nota">Opus piensa más y gasta tu cupo de 5 horas más rápido.</p>
        </div>
      )}

      {estado?.esAdmin && (estado.claves === null || !!estado.claves?.length) && (
        <SusClaves claves={estado.claves ?? null} ahora={ahora} recargar={recargar} />
      )}
    </section>
  );
}

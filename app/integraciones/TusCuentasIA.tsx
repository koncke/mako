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
import { hace } from '@/lib/progreso-reglas';
import { TEXTO_CONSENTIMIENTO, VERSION_CONSENTIMIENTO, estadoDeLaPc, lineaDeInstalacion, yaPaso, type CuentaPc, type SistemaPc } from '@/lib/ia-pc-reglas';
import './tus-cuentas-ia.css';

type Pc = { id: number; nombre: string; esMia: boolean; de?: string; enLinea: boolean; ultimoLatido: string | null; version: string | null; cuentas: CuentaPc[] };
type Estado = { ok: boolean; esAdmin: boolean; modelo: string; pcs: Pc[] };

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
  // Se conectó pero su Claude no tiene la sesión iniciada: no es «¡Listo!», es volver al paso 3.
  const [sinSesion, setSinSesion] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  // El código se pide recién cuando la persona acepta con un toque cómo funciona (TEXTO_CONSENTIMIENTO).
  const [acepto, setAcepto] = useState(false);
  const pedirCodigo = useCallback(async () => {
    setError(null);
    const r = await fetch('/api/ia-pc/codigo', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acepto: VERSION_CONSENTIMIENTO }),
    }).then((x) => x.json()).catch(() => null);
    if (r?.ok && r.codigo) { setCodigo(r.codigo); setVenceAt(Date.parse(r.venceAt) || Date.now() + 10 * 60_000); setAhora(Date.now()); }
    else setError(r?.error ?? 'No pude crear el código. Intenta de nuevo.');
  }, []);
  useEffect(() => { if (paso === 4 && acepto && !codigo) void pedirCodigo(); }, [paso, acepto, codigo, pedirCodigo]);
  const vencido = !!codigo && venceAt != null && ahora >= venceAt;
  // Espera a que aparezca una computadora nueva en línea, CON un Claude con sesión.
  useEffect(() => {
    if (paso !== 4 || !codigo || lista) return;
    const t = setInterval(async () => {
      setAhora(Date.now());
      const e = await recargar();
      const nueva = e?.pcs.find((p) => p.enLinea && p.esMia && !pcsAntes.includes(p.id));
      if (nueva && nueva.cuentas.length) { setLista(true); setSinSesion(false); setPaso(5); }
      else if (nueva) setSinSesion(true);
    }, 3000);
    return () => clearInterval(t);
  }, [paso, codigo, lista, pcsAntes, recargar]);
  // Otro código sin volver a aceptar: la persona ya aceptó en esta misma pantalla.
  // Con un código en pantalla, alcanza con soltarlo: el efecto de arriba pide el nuevo. Pedirlo acá TAMBIÉN creaba dos, y
  // el segundo anula al primero (lib/ia-pc.ts → crearCodigo), que podía quedar en pantalla.
  const otroCodigo = () => { if (codigo) { setCodigo(null); setVenceAt(null); } else void pedirCodigo(); };

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
          <h3>Instala Claude</h3>
          <p>{DONDE_PEGAR[sistema]} Si ya tienes Claude Code, sigue al próximo paso.</p>
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
              {codigo && !vencido ? <Copiar texto={lineaDeInstalacion(window.location.origin, sistema, codigo)} /> : !codigo && <p className="tci-nota">{error ?? 'Preparando tu código…'}</p>}
            </>
          )}
          {(error || vencido) && (
            <>
              {vencido && <p className="tci-nota">El código venció.</p>}
              <button type="button" className="tci-boton" onClick={otroCodigo}>Pedir otro código</button>
            </>
          )}
          {codigo && !vencido && !sinSesion && <p className="tci-espera"><span className="tci-punto tci-punto--esperando" aria-hidden /> Esperando a tu computadora… (el código dura 10 minutos)</p>}
          {sinSesion && (
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

export function TusCuentasIA() {
  const [estado, setEstado] = useState<Estado | null>(null);
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
  const abrirTutorial = () => { antes.current = (estado?.pcs ?? []).map((p) => p.id); setTutorial(true); };

  return (
    <section className="tci" aria-labelledby="tci-titulo">
      <div className="tci-cab">
        <div>
          <h2 id="tci-titulo" className="tci-titulo">Tus cuentas de IA</h2>
          <p className="tci-bajada">Tu Ops Center contesta con tu Claude, en tu computadora y con tu cuenta.</p>
        </div>
        <button type="button" className="tci-boton" onClick={abrirTutorial}>Conectar mi computadora</button>
      </div>

      {tutorial && <Tutorial onCerrar={() => { setTutorial(false); void recargar(); }} pcsAntes={antes.current} recargar={recargar} />}

      {estado && !estado.pcs.length && !tutorial && <p className="tci-vacio">Todavía no conectaste ninguna computadora.</p>}
      {estado?.pcs.map((pc) => (
        <div key={pc.id} className="tci-pc">
          <div className="tci-fila">
            <span className="tci-pc__nombre">{pc.nombre}{pc.de ? <span className="tci-nota"> · de {pc.de}</span> : null}</span>
            <span className="tci-estado">
              <span className={`tci-punto tci-punto--${pc.enLinea && pc.cuentas.length ? 'linea' : pc.enLinea ? 'esperando' : 'apagada'}`} aria-hidden />
              {estadoDeLaPc(pc, ahora, hace)}
            </span>
          </div>
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

      {/* La clave de API es del NEGOCIO (la guarda el admin): a un closer no se le ofrece. */}
      {estado?.esAdmin && (
        <p className="tci-nota tci-otra">
          ¿Prefieres tu clave de API de Claude? <BotonIntegracion servicio="anthropic" style={{ color: 'var(--primary)', fontWeight: 600 }}>Conectar con tu clave</BotonIntegracion>
        </p>
      )}
    </section>
  );
}

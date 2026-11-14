'use client';

// =============================================================================
// SegundoPaso — elegir el método, probarlo y entrar (o activar el primero)
// =============================================================================
// Todo pasa por /api/auth/2fa, que se autentica con el paso intermedio y nada más.
// Dos caminos:
//   · ENTRAR: el método más fuerte que la persona tenga sale primero (llave de acceso
//     > app > WhatsApp > correo) y los demás quedan a un clic.
//   · ACTIVAR EL PRIMERO: sólo si no tiene ninguno (el super admin la primera vez).
//     Al confirmarlo entra y se le muestran sus códigos de recuperación UNA vez.
//
// El código por WhatsApp o correo se manda con un botón y no al abrir: recargar la
// pantalla no puede mandar un mensaje.
//
// ⚠️ LA PRESENTACIÓN SALIÓ DE ACÁ (14/11/2026): este archivo tenía siete constantes
// de `CSSProperties` (btn, btnSec, link, campo, campoTexto, titulo, sub, errorBox)
// con los hexes de /login escritos otra vez a mano. Ahora son los primitives de
// app/_ui y las clases de app/login/_ui/login.css, los mismos que la tarjeta de
// /login: así las dos pantallas no se van corriendo cada vez que se toca una.
// La LÓGICA no se tocó — es la que sostienen tests/login-2fa-entrando.test.ts y
// tests/mfa.test.ts, y los literales que esos dos fijan siguen letra por letra.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { Button } from '@/app/_ui/Button';
import { Input } from '@/app/_ui/Field';
import { Checkbox } from '@/app/_ui/Toggle';
import { Alert } from '@/app/_ui/Estados';
import { Spinner } from '@/app/_ui/Feedback';
import { EncabezadoLogin } from '../_ui/TarjetaLogin';
import { descargarCodigos } from './descargar-codigos';
import { CampoCodigo } from './CampoCodigo';
import { textoDelFallo, type Respuesta } from './respuesta-2fa';

type Metodo = 'passkey' | 'totp' | 'whatsapp' | 'email' | 'recuperacion';
type Estado = {
  factores: { totp: boolean; passkey: boolean; whatsapp: string | null; email: string | null; recuperacion: boolean };
  hayQueEnrolar: boolean;
  passkeysDisponibles: boolean;
  /** ¿Es un teléfono? La huella se ofrece sólo ahí, y sólo después de entrar (14/10/2026). */
  esTelefono: boolean;
  /** Por dónde puede salir un código hoy (vacío en la tanda 1). */
  canales: ('whatsapp' | 'email')[];
  /** El factor ya pasó y falta crear la contraseña obligatoria (15/10/2026). */
  falta?: 'contrasena' | null;
};

const ORDEN: Metodo[] = ['passkey', 'totp', 'whatsapp', 'email'];
const TITULO: Record<Metodo, string> = {
  passkey: 'Llave de acceso',
  totp: 'App de autenticación',
  whatsapp: 'Código por WhatsApp',
  email: 'Código por correo',
  recuperacion: 'Código de recuperación',
};

async function pedir(body: Record<string, unknown>): Promise<Respuesta> {
  const r = await fetch('/api/auth/2fa', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  // El paso intermedio venció (o ya se cerró porque se entró): la pantalla se va al login y no pinta nada (respuesta-2fa.ts).
  if (r.status === 401) { window.location.href = '/login?error=mfa-vencido'; return { ok: false, vencido: true }; }
  return (await r.json().catch(() => ({ ok: false, error: 'No se pudo conectar.' }))) as Respuesta;
}

export function SegundoPaso({ cuenta }: { cuenta: string }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [metodo, setMetodo] = useState<Metodo | null>(null);
  const [enrolando, setEnrolando] = useState<Metodo | null>(null);
  const [codigo, setCodigo] = useState('');
  const [destino, setDestino] = useState('');
  const [enviadoA, setEnviadoA] = useState<string | null>(null);
  const [qr, setQr] = useState<{ qr: string; secreto: string; uri?: string } | null>(null);
  const [recordar, setRecordar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codigos, setCodigos] = useState<{ lista: string[]; next: string; luegoContrasena?: boolean } | null>(null);
  // La contraseña obligatoria (decisión de Martín, 15/10/2026): después del factor, una pantalla propia.
  const [pidiendoContrasena, setPidiendoContrasena] = useState(false);
  const [nueva, setNueva] = useState('');
  const [verNueva, setVerNueva] = useState(false);
  const [copiado, setCopiado] = useState(false);
  // Después de entrar, en el teléfono: «¿la próxima vez con la huella?». Guarda adónde ir después.
  const [ofertaHuella, setOfertaHuella] = useState<string | null>(null);
  // ENTRANDO (25/10/2026, Martín: «me dijo "No coincide"... y luego me dejo entrar igual»): con una respuesta buena la
  // pantalla queda trabada hasta irse. Antes `correr` volvía a habilitar «Entrar» y el Enter mientras la página cargaba, y un
  // segundo envío, ya sin el paso intermedio, pintaba «No coincide.». El ref corta un doble toque antes del próximo dibujo.
  const entrando = useRef(false);
  const [yendo, setYendo] = useState(false);
  const trabado = ocupado || yendo;
  const irA = (url: string) => { entrando.current = true; setYendo(true); window.location.href = url; };

  useEffect(() => {
    fetch('/api/auth/2fa').then(async (r) => {
      if (r.status === 401) { window.location.href = '/login?error=mfa-vencido'; return; }
      const j = (await r.json()) as Estado & { ok: boolean };
      if (!j.ok) return;
      setEstado(j);
      if (j.falta === 'contrasena') setPidiendoContrasena(true);
      const disponibles = ORDEN.filter((m) => (m === 'passkey' ? j.factores.passkey && j.passkeysDisponibles : !!j.factores[m]));
      setMetodo(disponibles[0] ?? (j.factores.recuperacion ? 'recuperacion' : null));
    }).catch(() => setError('No se pudo conectar.'));
  }, []);

  /**
   * Va a la app, salvo que haya que ofrecer la huella: decisión de Martín (14/10/2026), «es
   * justamente un método rápido de entrar con el celu». Sólo en el teléfono, sólo si todavía no
   * tiene una llave, y sólo DESPUÉS de haber entrado (la sesión ya está puesta: la llave se crea
   * por /api/perfil/seguridad). Si dijo «Ahora no» en este teléfono, no se insiste.
   */
  const terminar = (next: string) => {
    let yaDijoQueNo = false;
    try { yaDijoQueNo = localStorage.getItem('mako.huella.ahora-no') === '1'; } catch { /* sin storage: se ofrece */ }
    if (estado?.esTelefono && estado.passkeysDisponibles && !estado.factores.passkey && !yaDijoQueNo) {
      setOfertaHuella(next);
      return;
    }
    irA(next);
  };

  /** Termina: con códigos nuevos, primero se muestran; si no, entra. */
  const salir = (j: Respuesta) => {
    const next = j.next || '/inicio';
    // Si además falta crear la contraseña, los códigos van PRIMERO (son lo que no se vuelve a ver) y
    // después la pantalla de la contraseña. La sesión todavía no está puesta: la abre ese último paso.
    const faltaContrasena = j.falta === 'contrasena';
    if (j.codigos?.length) { setCodigos({ lista: j.codigos, next, luegoContrasena: faltaContrasena }); return; }
    if (faltaContrasena) { setPidiendoContrasena(true); return; }
    terminar(next);
  };

  const correr = async (fn: () => Promise<void>) => {
    if (entrando.current) return;
    setOcupado(true); setError(null);
    try { await fn(); } catch (e) {
      // Cancelar el diálogo del navegador no es un error que haya que contar.
      const nombre = e instanceof Error ? e.name : '';
      setError(nombre === 'NotAllowedError' ? 'Se canceló. Vuelve a probar.' : 'No se pudo. Vuelve a probar.');
    } finally { if (!entrando.current) setOcupado(false); }
  };

  const cambiar = (m: Metodo | null, enrolar = false) => {
    setError(null); setCodigo(''); setEnviadoA(null); setQr(null); setDestino('');
    if (enrolar) setEnrolando(m); else setMetodo(m);
  };

  // ── Entrar ─────────────────────────────────────────────────────────────────
  const enviar = (canal: 'whatsapp' | 'email') => correr(async () => {
    const j = await pedir({ accion: 'enviar', canal });
    if (!j.ok) { setError(textoDelFallo(j)); return; }
    setEnviadoA(String(j.destino ?? ''));
  });
  const verificar = (m: Metodo) => correr(async () => {
    const j = await pedir({ accion: 'verificar', metodo: m, codigo, recordar });
    if (!j.ok) { setError(textoDelFallo(j)); return; }
    salir(j);
  });
  const usarPasskey = () => correr(async () => {
    const o = await pedir({ accion: 'passkey-opciones' });
    if (!o.ok) { setError(textoDelFallo(o)); return; }
    const respuesta = await startAuthentication({ optionsJSON: o.opciones as Parameters<typeof startAuthentication>[0]['optionsJSON'] });
    const j = await pedir({ accion: 'passkey-verificar', respuesta, recordar });
    if (!j.ok) { setError(textoDelFallo(j)); return; }
    salir(j);
  });

  // ── Activar el primero ─────────────────────────────────────────────────────
  const iniciarTotp = () => correr(async () => {
    const j = await pedir({ accion: 'enrolar-totp-iniciar' });
    if (!j.ok) { setError(textoDelFallo(j)); return; }
    setQr({ qr: String(j.qr), secreto: String(j.secreto), uri: typeof j.uri === 'string' ? j.uri : undefined });
  });
  const confirmarTotp = () => correr(async () => {
    const j = await pedir({ accion: 'enrolar-totp-confirmar', codigo, recordar });
    if (!j.ok) { setError(textoDelFallo(j)); return; }
    salir(j);
  });
  /** La huella, ya adentro: la crea /api/perfil/seguridad con la sesión que se acaba de poner. */
  const activarHuella = (next: string) => correr(async () => {
    const seg = async (body: Record<string, unknown>) => {
      const r = await fetch('/api/perfil/seguridad', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      return (await r.json().catch(() => ({ ok: false, error: 'No se pudo conectar.' }))) as Respuesta;
    };
    const o = await seg({ accion: 'passkey-opciones' });
    if (!o.ok) { setError(textoDelFallo(o)); return; }
    const respuesta = await startRegistration({ optionsJSON: o.opciones as Parameters<typeof startRegistration>[0]['optionsJSON'] });
    const j = await seg({ accion: 'passkey-verificar', respuesta, nombre: 'Celular' });
    if (!j.ok) { setError(textoDelFallo(j)); return; }
    irA(next);
  });
  const enviarEnrolar = (canal: 'whatsapp' | 'email') => correr(async () => {
    const j = await pedir({ accion: 'enrolar-codigo-enviar', canal, destino });
    if (!j.ok) { setError(textoDelFallo(j)); return; }
    setEnviadoA(String(j.destino ?? ''));
  });
  const confirmarEnrolar = (canal: 'whatsapp' | 'email') => correr(async () => {
    const j = await pedir({ accion: 'enrolar-codigo-confirmar', canal, codigo, recordar });
    if (!j.ok) { setError(textoDelFallo(j)); return; }
    salir(j);
  });

  // ── Pantallas ──────────────────────────────────────────────────────────────
  if (codigos) {
    return (
      <>
        <EncabezadoLogin titulo="Guarda estos códigos" sub="Cada uno sirve una vez si pierdes tu método. No se vuelven a mostrar." />
        <div className="lg-cuerpo">
          <div className="lg-codigos">
            {codigos.lista.map((c) => <div key={c}>{c}</div>)}
          </div>
          <div className="lg-dos">
            <Button variant="secondary" onClick={() => descargarCodigos(codigos.lista, cuenta)}>Descargar</Button>
            <Button variant="secondary" onClick={() => { void navigator.clipboard?.writeText(codigos.lista.join('\n')); setCopiado(true); }}>
              {copiado ? 'Copiados' : 'Copiar'}
            </Button>
          </div>
          <Button variant="primary" size="lg" full onClick={() => {
            if (codigos.luegoContrasena) { setCodigos(null); setPidiendoContrasena(true); return; }
            terminar(codigos.next);
          }}>Ya los guardé</Button>
        </div>
      </>
    );
  }

  if (pidiendoContrasena) {
    const crear = (e: FormEvent) => {
      e.preventDefault();
      void correr(async () => {
        const j = await pedir({ accion: 'crear-contrasena', contrasena: nueva });
        if (!j.ok) { setError(textoDelFallo(j)); return; }
        salir(j);
      });
    };
    return (
      <>
        <EncabezadoLogin titulo="Crea tu contraseña" sub="Para entrar el día que Google no esté. 12 caracteres o más." />
        <form onSubmit={crear} className="lg-cuerpo">
          {error && <Alert tono="bad">{error}</Alert>}
          {/* El correo, oculto: el gestor de contraseñas la guarda con la cuenta correcta. */}
          <input type="email" autoComplete="username" value={cuenta} readOnly hidden />
          <Input type={verNueva ? 'text' : 'password'} autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoFocus aria-label="Contraseña nueva" />
          <button type="button" className="lg-link" onClick={() => setVerNueva((v) => !v)}>{verNueva ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}</button>
          <Button type="submit" variant="primary" size="lg" full disabled={trabado || !nueva}>Guardar y entrar</Button>
        </form>
      </>
    );
  }

  if (ofertaHuella) {
    const despues = ofertaHuella;
    return (
      <>
        <EncabezadoLogin titulo="Entra más rápido" sub="La próxima vez, con tu huella o Face ID." />
        <div className="lg-cuerpo">
          {error && <Alert tono="bad">{error}</Alert>}
          <Button variant="primary" size="lg" full disabled={trabado} onClick={() => activarHuella(despues)}>Activar</Button>
          <Button variant="secondary" size="lg" full disabled={trabado} onClick={() => {
            try { localStorage.setItem('mako.huella.ahora-no', '1'); } catch { /* sin storage: se vuelve a ofrecer */ }
            irA(despues);
          }}>Ahora no</Button>
        </div>
      </>
    );
  }

  if (!estado) return error ? <Alert tono="bad">{error}</Alert> : <div className="lg-espera" aria-busy="true"><Spinner size={20} /></div>;

  const recordarCasilla = (
    <Checkbox checked={recordar} onChange={setRecordar} label="Recordar este dispositivo 30 días" />
  );
  // El campo detecta el código copiado y, con 6 dígitos, avanza solo (CampoCodigo, pedido de Martín
  // del 14/10/2026). Los botones de abajo quedan igual, por si alguien prefiere apretar.
  const campoCodigo = (onEnter: () => void, largo: 6 | 11 = 6) => (
    <CampoCodigo
      valor={codigo} onCambio={setCodigo} onCompleto={onEnter} ocupado={trabado} error={error} largo={largo}
      clase={largo === 6 ? 'mk-input lg-codigo' : 'mk-input lg-codigo lg-codigo--largo'}
    />
  );

  // ── Activar el primero ─────────────────────────────────────────────────────
  if (estado.hayQueEnrolar) {
    // ⛔ La huella NO es un primer método (decisión de Martín, 14/10/2026): se ofrece en el
    // teléfono después de entrar. Con un solo método para elegir, no hay nada que elegir.
    const opciones: { m: Metodo; txt: string }[] = [
      { m: 'totp', txt: 'App de autenticación' },
      ...(estado.canales.includes('whatsapp') ? [{ m: 'whatsapp' as Metodo, txt: 'WhatsApp' }] : []),
      ...(estado.canales.includes('email') ? [{ m: 'email' as Metodo, txt: 'Otro correo' }] : []),
    ];
    const elegido = enrolando ?? (opciones.length === 1 ? opciones[0].m : null);
    if (!elegido) {
      return (
        <>
          <EncabezadoLogin titulo="Activa un segundo paso" sub="Tu cuenta lo pide para entrar." />
          <div className="lg-cuerpo">
            {error && <Alert tono="bad">{error}</Alert>}
            <div className="lg-pila">
              {opciones.map((o) => (
                <Button key={o.m} variant="secondary" size="lg" full onClick={() => cambiar(o.m, true)}>{o.txt}</Button>
              ))}
            </div>
          </div>
        </>
      );
    }
    const volver = opciones.length > 1
      ? <button type="button" className="lg-link" onClick={() => cambiar(null, true)}>Otro método</button>
      : null;
    if (elegido === 'totp') {
      return (
        <>
          <EncabezadoLogin titulo="App de autenticación"
            sub={qr ? 'Escanea el código y escribe el número que muestra.' : 'Google Authenticator, Authy o la que uses.'} />
          <div className="lg-cuerpo">
            {error && <Alert tono="bad">{error}</Alert>}
            {!qr ? (
              <Button variant="primary" size="lg" full disabled={trabado} onClick={iniciarTotp}>Mostrar el código QR</Button>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL generado en el server */}
                <img src={qr.qr} alt="Código QR" width={180} height={180} className="lg-qr" />
                <p className="lg-secreto">{qr.secreto}</p>
                {/* En el celular no hay QR que escanear: el link otpauth abre la app con la cuenta cargada. */}
                {estado.esTelefono && qr.uri && <a href={qr.uri} className="mk-btn mk-btn--secondary mk-btn--lg mk-btn--full">Abrir en la app</a>}
                {campoCodigo(confirmarTotp)}
                {recordarCasilla}
                <Button variant="primary" size="lg" full disabled={trabado || codigo.length !== 6} onClick={confirmarTotp}>Activar</Button>
              </>
            )}
            {volver}
          </div>
        </>
      );
    }
    const canal = elegido === 'whatsapp' ? 'whatsapp' : 'email';
    return (
      <>
        <EncabezadoLogin titulo={canal === 'whatsapp' ? 'WhatsApp' : 'Otro correo'}
          sub={enviadoA ? `Te mandamos un código a ${enviadoA}.` : canal === 'whatsapp' ? 'Tu número con código de país.' : 'Uno distinto del de Google.'} />
        <div className="lg-cuerpo">
          {error && <Alert tono="bad">{error}</Alert>}
          {!enviadoA ? (
            <>
              <Input
                value={destino} autoFocus onChange={(e) => setDestino(e.target.value)}
                inputMode={canal === 'whatsapp' ? 'tel' : 'email'} placeholder={canal === 'whatsapp' ? '+54 9 11 2345 6789' : 'nombre@correo.com'}
                onKeyDown={(e) => { if (e.key === 'Enter' && destino) enviarEnrolar(canal); }}
                aria-label={canal === 'whatsapp' ? 'Tu número de WhatsApp' : 'Tu otro correo'}
              />
              <Button variant="primary" size="lg" full disabled={trabado || !destino.trim()} onClick={() => enviarEnrolar(canal)}>Mandar código</Button>
            </>
          ) : (
            <>
              {campoCodigo(() => confirmarEnrolar(canal))}
              {recordarCasilla}
              <Button variant="primary" size="lg" full disabled={trabado || codigo.length !== 6} onClick={() => confirmarEnrolar(canal)}>Activar</Button>
            </>
          )}
          {volver}
        </div>
      </>
    );
  }

  // ── Entrar ─────────────────────────────────────────────────────────────────
  const otros: Metodo[] = [
    ...ORDEN.filter((m) => m !== metodo && (m === 'passkey' ? estado.factores.passkey && estado.passkeysDisponibles : !!estado.factores[m])),
    ...(metodo !== 'recuperacion' && estado.factores.recuperacion ? ['recuperacion' as Metodo] : []),
  ];

  if (!metodo) {
    return <Alert tono="bad">No hay un método que se pueda usar aquí. Entra desde hola-mako.com.</Alert>;
  }

  return (
    <>
      <EncabezadoLogin
        titulo={TITULO[metodo]}
        sub={metodo === 'passkey' ? 'Usa la huella, Face ID o el PIN de este dispositivo.'
          : metodo === 'totp' ? 'Escribe el número que muestra tu app.'
          : metodo === 'recuperacion' ? 'Uno de los que guardaste al activar.'
          : enviadoA ? `Te mandamos un código a ${enviadoA}.`
          : `Lo mandamos a ${metodo === 'whatsapp' ? estado.factores.whatsapp : estado.factores.email}.`}
      />
      <div className="lg-cuerpo">
        {error && <Alert tono="bad">{error}</Alert>}

        {metodo === 'passkey' ? (
          <>
            {recordarCasilla}
            <Button variant="primary" size="lg" full disabled={trabado} onClick={usarPasskey}>Usar llave de acceso</Button>
          </>
        ) : (metodo === 'whatsapp' || metodo === 'email') && !enviadoA ? (
          <Button variant="primary" size="lg" full disabled={trabado} onClick={() => enviar(metodo)}>Mandar código</Button>
        ) : (
          <>
            {campoCodigo(() => verificar(metodo), metodo === 'recuperacion' ? 11 : 6)}
            {recordarCasilla}
            <Button
              variant="primary" size="lg" full loading={yendo}
              disabled={trabado || (metodo === 'recuperacion' ? codigo.trim().length < 10 : codigo.length !== 6)}
              onClick={() => verificar(metodo)}
            >
              {yendo ? 'Entrando…' : 'Entrar'}
            </Button>
            {(metodo === 'whatsapp' || metodo === 'email') && (
              <button type="button" className="lg-link" disabled={trabado} onClick={() => enviar(metodo)}>Reenviar el código</button>
            )}
          </>
        )}

        {otros.length > 0 && (
          <div className="lg-otros">
            {otros.map((m) => <button key={m} type="button" className="lg-link" onClick={() => cambiar(m)}>{TITULO[m]}</button>)}
          </div>
        )}
      </div>
    </>
  );
}

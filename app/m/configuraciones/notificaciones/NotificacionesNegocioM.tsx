'use client';

// =============================================================================
// A quién le avisa MaKo lo del negocio, en el teléfono: WhatsApp y Email, con altas y bajas
// =============================================================================
// Lo de `DestinatariosCanal` (app/perfil/DestinatariosCanal.tsx), sin cambiar una regla: toda alta o baja guarda en el
// acto las DOS listas; lo que no se guardó vuelve atrás; y sumar al grupo de WhatsApp es OTRA cosa que puede fallar sola
// (`noAgregados`): si falla se dice, con el link del grupo para pasárselo a mano. Decir «listo» sobre algo que no pasó
// era el bug original de esa pantalla.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { haptico } from '@/lib/haptico';
import { PAISES, DIAL_DEFAULT, splitTelefono, unirTelefono } from '@/lib/paises';
import { emailValido, telefonoValido, type Destinatarios } from '@/lib/notif-catalogo';
import { paraLeer } from '@/app/perfil/DestinatariosLista';
import { ErrorM, FilaM, ListaM, PieM, PildoraM, SeccionM, SheetM, SkeletonFilas, useToastM } from '@/app/m/_ui';
import { copiarTexto } from '@/app/m/copywriting/api';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

type Canal = 'whatsapp' | 'email';
type Guardado = { ok: boolean; error?: string; destinatarios?: Destinatarios; noAgregados?: { telefono: string; motivo: string }[]; linkGrupo?: string | null };

export function NotificacionesNegocioM({ iniciales }: { iniciales: { destinatarios: Destinatarios; tieneGrupo: boolean; ws: number | null } | null }) {
  const toast = useToastM();
  const [dest, setDest] = useState<Destinatarios | null>(iniciales?.destinatarios ?? null);
  const [tieneGrupo, setTieneGrupo] = useState(iniciales?.tieneGrupo ?? false);
  const [wsLeido, setWsLeido] = useState<number | null>(iniciales?.ws ?? null);
  const [errCarga, setErrCarga] = useState<string | null>(null);
  const [agregar, setAgregar] = useState<Canal | null>(null);
  const [quitar, setQuitar] = useState<{ canal: Canal; valor: string } | null>(null);
  const [faltaGrupo, setFaltaGrupo] = useState<{ noAgregados: { telefono: string; motivo: string }[]; link: string | null } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    setErrCarga(null);
    try {
      const r = await fetch('/api/perfil/destinatarios', { signal: AbortSignal.timeout(30_000) });
      const j = (await r.json()) as { ok: boolean; error?: string; destinatarios?: Destinatarios; tieneGrupo?: boolean; ws?: number | null };
      if (!r.ok || !j.ok || !j.destinatarios) { setErrCarga(j.error ?? 'No se pudieron cargar los destinatarios.'); return; }
      setDest(j.destinatarios); setTieneGrupo(Boolean(j.tieneGrupo)); setWsLeido(j.ws ?? null);
    } catch {
      setErrCarga('No se pudieron cargar los destinatarios. Revisa tu conexión.');
    }
  }, []);
  // ⚠️ ABRE CON LO QUE LEYÓ EL SERVER (17/10/2026, «que el teléfono ande más rápido»): sin esto pintaba un esqueleto y
  // recién después pedía la lista (otra ida y vuelta). La página la monta con `key` nuevo en cada pasada del server
  // (tirar hacia abajo trae lo nuevo); si el server no pudo leer (`null`), se pide como en la computadora.
  useEffect(() => { if (iniciales == null) void cargar(); }, [cargar, iniciales]);

  /** Guarda las DOS listas. Devuelve si quedó guardado (lo que no, vuelve atrás). */
  const guardar = async (telefonos: string[], emails: string[]): Promise<boolean> => {
    if (!dest || ocupado) return false;
    const antes = dest;
    setOcupado(true); setFaltaGrupo(null);
    setDest({ telefonos, emails }); // optimista: la fila responde al toque
    try {
      const j = (await (await fetch('/api/perfil/destinatarios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefonos, emails, ...(wsLeido != null ? { ws: wsLeido } : {}) }), signal: AbortSignal.timeout(45_000),
      })).json()) as Guardado;
      if (!j.ok || !j.destinatarios) { setDest(antes); haptico('error'); toast(j.error ?? 'No se pudo guardar'); return false; }
      setDest(j.destinatarios);
      if (j.destinatarios.telefonos.length > 0) setTieneGrupo(true);
      if (j.noAgregados?.length) { setFaltaGrupo({ noAgregados: j.noAgregados, link: j.linkGrupo ?? null }); haptico('error'); return true; }
      haptico('success'); toast('Guardado');
      return true;
    } catch {
      setDest(antes); haptico('error'); toast('No se pudo guardar');
      return false;
    } finally { setOcupado(false); }
  };

  if (errCarga) return <ErrorM frase={errCarga} onReintentar={() => { void cargar(); }} />;
  if (!dest) return <SkeletonFilas />;

  const nadie = (canal: Canal) => (
    <FilaM titulo="Nadie todavía" segunda={canal === 'whatsapp' ? 'MaKo no puede avisar por WhatsApp' : 'Falta una dirección'}
      pill={<PildoraM tono="warn">Sin conectar</PildoraM>} />
  );

  return (
    <>
      {faltaGrupo && (
        <div className="m-configuraciones-falta">
          <p className="m-configuraciones-aviso" data-tono="warn" role="status">
            {`Quedó guardado, pero no pude sumar al grupo de MaKo a ${faltaGrupo.noAgregados.map((x) => `${paraLeer('tel', x.telefono)} (${x.motivo})`).join(', ')}.`}
            {faltaGrupo.link ? ' Pásale el link del grupo.' : ''}
          </p>
          {faltaGrupo.link && (
            <Button variant="secondary" size="md" onClick={async () => { const ok = await copiarTexto(faltaGrupo.link ?? ''); toast(ok ? 'Link copiado' : 'No se pudo copiar'); }}>
              Copiar el link del grupo
            </Button>
          )}
        </div>
      )}
      <SeccionM titulo="WhatsApp">
        <ListaM>
          {dest.telefonos.length === 0 ? nadie('whatsapp') : dest.telefonos.map((t) => (
            <FilaM key={t} icono="whatsapp" titulo={paraLeer('tel', t)} segunda={tieneGrupo ? 'Al grupo de MaKo' : undefined}
              onClick={() => setQuitar({ canal: 'whatsapp', valor: t })} />
          ))}
          <FilaM navegacion icono="plus" titulo="Agregar un número" chevron={false} onClick={() => setAgregar('whatsapp')} />
        </ListaM>
      </SeccionM>
      <SeccionM titulo="Email">
        <ListaM>
          {dest.emails.length === 0 ? nadie('email') : dest.emails.map((e) => (
            <FilaM key={e} icono="email" titulo={e} onClick={() => setQuitar({ canal: 'email', valor: e })} />
          ))}
          <FilaM navegacion icono="plus" titulo="Agregar un email" chevron={false} onClick={() => setAgregar('email')} />
        </ListaM>
      </SeccionM>
      <div className="m-configuraciones-suelta">
        <ListaM>
          <FilaM navegacion icono="bell" titulo="Tus avisos en la app" segunda="El pop-up y el sonido son tuyos" href="/m/cuenta" />
        </ListaM>
      </div>

      <HojaAgregar canal={agregar} ocupado={ocupado} ladaInicial={dest.telefonos[0] ? splitTelefono(dest.telefonos[0]).lada : DIAL_DEFAULT}
        onCerrar={() => setAgregar(null)}
        onAgregar={async (v) => {
          const ok = agregar === 'whatsapp'
            ? await guardar(dest.telefonos.includes(v) ? dest.telefonos : [...dest.telefonos, v], dest.emails)
            : await guardar(dest.telefonos, dest.emails.includes(v) ? dest.emails : [...dest.emails, v]);
          if (ok) setAgregar(null);
        }} />

      <SheetM id="quitar" abierto={quitar != null} onCerrar={() => setQuitar(null)} ocupado={ocupado}
        titulo={quitar ? (quitar.canal === 'whatsapp' ? paraLeer('tel', quitar.valor) : quitar.valor) : ''}
        pie={quitar ? (
          <PieM consecuencia={quitar.canal === 'whatsapp' ? 'Deja de recibir los avisos del negocio por WhatsApp.' : 'Deja de recibir los avisos del negocio por email.'}>
            <Button variant="danger" size="lg" full loading={ocupado} onClick={async () => {
              const q = quitar;
              const ok = q.canal === 'whatsapp'
                ? await guardar(dest.telefonos.filter((x) => x !== q.valor), dest.emails)
                : await guardar(dest.telefonos, dest.emails.filter((x) => x !== q.valor));
              if (ok) setQuitar(null);
            }}>Quitar</Button>
          </PieM>
        ) : undefined} />
    </>
  );
}

function HojaAgregar({ canal, ocupado, ladaInicial, onCerrar, onAgregar }: {
  canal: Canal | null; ocupado: boolean; ladaInicial: string; onCerrar: () => void; onAgregar: (v: string) => Promise<void>;
}) {
  const [lada, setLada] = useState(ladaInicial);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  // El sub-estado se resetea al ABRIR (LEEME de app/m/_ui), nunca al cerrar.
  useEffect(() => { if (canal) { setTexto(''); setError(null); setLada(ladaInicial); } }, [canal]); // eslint-disable-line react-hooks/exhaustive-deps
  const esWa = canal === 'whatsapp';
  const agregar = () => {
    // Como la computadora: el botón no se apaga, DICE por qué no puede.
    if (esWa) {
      // Pegado con su `+` («+54 9 11 2233-4455», copiado de WhatsApp): el código ya viene adentro, la lada no se suma.
      const v = texto.trim().startsWith('+') ? texto.replace(/\D/g, '') : unirTelefono(lada, texto);
      if (!telefonoValido(v) || texto.replace(/\D/g, '').length < 6) { setError('Ese número no parece completo'); return; }
      void onAgregar(v);
    } else {
      const v = texto.trim().toLowerCase();
      if (!emailValido(v)) { setError('Eso no parece un email'); return; }
      void onAgregar(v);
    }
  };
  return (
    <SheetM id="agregar" abierto={canal != null} onCerrar={onCerrar} ocupado={ocupado} titulo={esWa ? 'Agregar un número' : 'Agregar un email'}
      rotuloCerrar="Cerrar sin agregar"
      pie={(
        <PieM consecuencia={esWa ? 'MaKo lo suma al grupo de avisos del negocio.' : undefined}>
          <Button variant="primary" size="lg" full loading={ocupado} onClick={agregar}>Agregar</Button>
        </PieM>
      )}>
      {esWa ? (
        <div className="m-configuraciones-campo">
          <span>Número de WhatsApp</span>
          <div className="m-configuraciones-tel">
            <select className="m-configuraciones-entrada" aria-label="Código de país" value={lada} onChange={(e) => setLada(e.target.value)}>
              {PAISES.map((p) => <option key={p.iso2} value={p.dial}>{`${p.iso2} ${p.dial}`}</option>)}
            </select>
            <input className="m-configuraciones-entrada" type="tel" inputMode="tel" autoComplete="tel-national" value={texto}
              placeholder="223 355 0684" aria-label="Número" onChange={(e) => { setTexto(e.target.value); setError(null); }} />
          </div>
        </div>
      ) : (
        <label className="m-configuraciones-campo">
          <span>Email</span>
          <input className="m-configuraciones-entrada" type="email" inputMode="email" autoCapitalize="none" autoComplete="email" value={texto}
            placeholder="nombre@empresa.com" onChange={(e) => { setTexto(e.target.value); setError(null); }} />
        </label>
      )}
      {error && <p className="m-configuraciones-aviso" data-tono="bad" role="alert">{error}<ReportarASoporte /></p>}
    </SheetM>
  );
}

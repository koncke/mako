'use client';

// =============================================================================
// EditarBiblioteca — la plataforma edita la biblioteca de ejemplos, desde «Cuentas» del explorador (4/11/2026)
// =============================================================================
// Sólo la ve el admin del negocio de la plataforma (`puedeEditarBiblioteca`, lib/carruseles/biblioteca-servidor.ts), y las
// acciones lo vuelven a preguntar. Tres cosas:
//   · la LISTA de cuentas (se leen enteras con el script de la PC, con su outlier): sumar, sacar y volver a sumar;
//   · los TEMAS (hashtags de donde se toman los carruseles que mejor rinden): sumar, apagar y volver a prender;
//   · sacar a un CREADOR que lo pidió, haya llegado por la lista o por un tema: sus carruseles dejan de verse en todos los
//     negocios en el acto y no vuelve a entrar.
// Lo que se suma acá se lee la próxima vez que corre el script (scripts/carruseles-biblioteca.mts): la pantalla lo dice. Sacar pregunta con el `Confirm` de la casa, con el motivo en un campo.
// =============================================================================

import { useEffect, useState, useTransition, type FormEvent } from 'react';
import { Confirm } from '@/app/_ui/Confirm';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import type { BibliotecaParaEditar } from '@/lib/carruseles/biblioteca-servidor';
import type { CambioBiblioteca } from '@/lib/carruseles/biblioteca';
import { bibliotecaParaEditarAction, cambiarBibliotecaAction } from './actions';
import s from './explorar.module.css';

const leidaHace = (iso: string | null): string => {
  const t = Date.parse(iso ?? '');
  if (!Number.isFinite(t)) return 'sin leer todavía';
  const d = Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
  return d === 0 ? 'leída hoy' : d === 1 ? 'leída ayer' : `leída hace ${d} días`;
};

export function EditarBiblioteca() {
  const [b, setB] = useState<BibliotecaParaEditar | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, start] = useTransition();
  const [cuenta, setCuenta] = useState({ usuario: '', nombre: '' });
  const [tema, setTema] = useState({ hashtag: '', nombre: '' });
  const [fuera, setFuera] = useState('');
  // A quién se está por sacar, y por qué. Con la casa: un `Confirm`, nunca el prompt() del navegador.
  const [saliendo, setSaliendo] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('Lo pidió el creador');

  useEffect(() => {
    let vivo = true;
    void bibliotecaParaEditarAction().then((r) => {
      if (!vivo) return;
      if (r.ok) setB(r.biblioteca); else setError(r.error);
    });
    return () => { vivo = false; };
  }, []);

  const cambiar = (pedido: CambioBiblioteca, despues?: () => void) => {
    setError(null); setAviso(null);
    start(async () => {
      const r = await cambiarBibliotecaAction(pedido);
      if (!r.ok) { setError(r.error); return; }
      setB(r.biblioteca);
      if (r.ya) setAviso(r.ya);
      despues?.();
    });
  };
  const sacar = (usuario: string) => { setMotivo('Lo pidió el creador'); setSaliendo(usuario); };
  const confirmarSacar = () => {
    if (!saliendo || !motivo.trim()) return;
    const usuario = saliendo;
    // La pregunta se cierra antes: si algo falla, el aviso se lee en el panel, no detrás del cartel.
    setSaliendo(null);
    cambiar({ que: 'cuenta', accion: 'sacar', valor: usuario, motivo: motivo.trim() }, () => setFuera(''));
  };
  const alSumarCuenta = (e: FormEvent) => {
    e.preventDefault();
    cambiar({ que: 'cuenta', accion: 'sumar', valor: cuenta.usuario, nombre: cuenta.nombre || cuenta.usuario.replace(/^@/, '') }, () => setCuenta({ usuario: '', nombre: '' }));
  };
  const alSumarTema = (e: FormEvent) => {
    e.preventDefault();
    cambiar({ que: 'tema', accion: 'sumar', valor: tema.hashtag, nombre: tema.nombre || tema.hashtag.replace(/^#/, '') }, () => setTema({ hashtag: '', nombre: '' }));
  };
  const alSacarCreador = (e: FormEvent) => {
    e.preventDefault();
    if (fuera.trim()) sacar(fuera.trim().replace(/^@/, ''));
  };

  return (
    <section className={s.editar} aria-labelledby="editar-biblioteca" aria-busy={ocupado || b === undefined}>
      <h2 id="editar-biblioteca" className={s.subtitulo}>Editar la biblioteca de ejemplos</h2>
      <p className={s.nota}><span>La ven todos los negocios. Lo que sumes se lee la próxima vez que corre el script de la PC.</span></p>
      {error && <p role="alert" className={s.aviso}>{error}<ReportarASoporte /></p>}
      {aviso && <p className={s.nota}><span>{aviso}</span></p>}
      {b === undefined ? (
        <div className={s.esqueletoLista} aria-hidden>{[0, 1, 2].map((i) => <span key={i} />)}</div>
      ) : b === null ? (
        <p className={s.nota}><span>La biblioteca todavía no está creada: falta aplicar la migración 0392.</span></p>
      ) : (
        <>
          <h3 className={s.subtitulo2}>Cuentas de la lista</h3>
          {b.cuentas.length ? (
            <ul aria-label="Cuentas de la lista">
              {b.cuentas.map((c) => (
                <li key={c.id} className={s.cuentaFila} data-fuera={c.estado === 'excluida' ? 'si' : undefined}>
                  <span className={s.cuentaNombre}>
                    <strong>{c.nombre}</strong>
                    <span>
                      <a href={`https://www.instagram.com/${c.instagram}/`} target="_blank" rel="noopener noreferrer" className={s.enlace}>@{c.instagram}</a>
                      {' · '}{c.estado === 'excluida' ? `fuera: ${c.motivo ?? 'sin motivo'}` : `${c.piezas} ${c.piezas === 1 ? 'publicación' : 'publicaciones'} · ${leidaHace(c.leida_en)}`}
                      {/* Trajo casi nada al leerla: casi seguro no es la cuenta del creador (o es privada). Se dice; no se saca sola. */}
                      {c.dudosa ? <span className={s.dudosa} title="Al leerla trajo casi nada: abre el perfil y confirma que sea la cuenta del creador"> · ¿es su cuenta?</span> : null}
                    </span>
                  </span>
                  {c.estado === 'excluida'
                    ? <button type="button" className={s.texto} disabled={ocupado} onClick={() => cambiar({ que: 'cuenta', accion: 'volver', valor: c.instagram })}>Volver a sumar</button>
                    : <button type="button" className={s.textoPeligro} disabled={ocupado} onClick={() => sacar(c.instagram)}>Sacar</button>}
                </li>
              ))}
            </ul>
          ) : <p className={s.nota}><span>Todavía no hay cuentas en la lista.</span></p>}
          <form className={s.formulario} onSubmit={alSumarCuenta}>
            <input value={cuenta.usuario} onChange={(e) => setCuenta((x) => ({ ...x, usuario: e.target.value }))} placeholder="@usuario" aria-label="Usuario de Instagram" required />
            <input value={cuenta.nombre} onChange={(e) => setCuenta((x) => ({ ...x, nombre: e.target.value }))} placeholder="Nombre" aria-label="Nombre de la cuenta" />
            <button type="submit" className={s.boton} disabled={ocupado || !cuenta.usuario.trim()}>Sumar a la lista</button>
          </form>

          <h3 className={s.subtitulo2}>Temas</h3>
          {b.temas.length ? (
            <ul aria-label="Temas de la biblioteca">
              {b.temas.map((t) => (
                <li key={t.id} className={s.cuentaFila} data-fuera={t.activo ? undefined : 'si'}>
                  <span className={s.cuentaNombre}>
                    <strong>{t.nombre}</strong>
                    <span>#{t.hashtag} · {t.activo ? `${t.piezas} ${t.piezas === 1 ? 'carrusel' : 'carruseles'} · ${leidaHace(t.leido_en).replace('leída', 'leído')}` : 'apagado'}</span>
                  </span>
                  <button type="button" className={t.activo ? s.textoPeligro : s.texto} disabled={ocupado}
                    onClick={() => cambiar({ que: 'tema', accion: t.activo ? 'sacar' : 'volver', valor: t.hashtag })}>{t.activo ? 'Apagar' : 'Volver a sumar'}</button>
                </li>
              ))}
            </ul>
          ) : <p className={s.nota}><span>Sin temas todavía: el script siembra los de arranque la primera vez que corre.</span></p>}
          <form className={s.formulario} onSubmit={alSumarTema}>
            <input value={tema.hashtag} onChange={(e) => setTema((x) => ({ ...x, hashtag: e.target.value }))} placeholder="#hashtag" aria-label="Hashtag" required />
            <input value={tema.nombre} onChange={(e) => setTema((x) => ({ ...x, nombre: e.target.value }))} placeholder="Nombre del tema" aria-label="Nombre del tema" />
            <button type="submit" className={s.boton} disabled={ocupado || !tema.hashtag.trim()}>Sumar tema</button>
          </form>

          <h3 className={s.subtitulo2}>Sacar a un creador que lo pidió</h3>
          <p className={s.nota}><span>{b.porTema} creadores llegaron por los temas. Sacar a uno borra sus carruseles y no vuelve a entrar.</span></p>
          <form className={s.formulario} onSubmit={alSacarCreador}>
            <input value={fuera} onChange={(e) => setFuera(e.target.value)} placeholder="@usuario" aria-label="Usuario a sacar" required />
            <button type="submit" className={s.botonPeligro} disabled={ocupado || !fuera.trim()}>Sacar de la biblioteca</button>
          </form>
        </>
      )}
      {saliendo ? (
        <Confirm title={`¿Sacar a @${saliendo} de la biblioteca?`} confirmLabel="Sacar de la biblioteca" cancelLabel="No sacar"
          onCancel={() => setSaliendo(null)} onConfirm={confirmarSacar}
          message={(
            <span className={s.motivo}>
              <span>Sus carruseles dejan de verse en todos los negocios y no vuelve a entrar.</span>
              <label>
                Por qué sale
                <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} aria-label="Por qué sale" />
              </label>
              {!motivo.trim() ? <span className={s.falta} aria-live="polite">Escribe por qué sale.</span> : null}
            </span>
          )} />
      ) : null}
    </section>
  );
}

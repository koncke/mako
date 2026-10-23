'use client';

// =============================================================================
// «Tus cuentas de IA» en el teléfono — el estado de sus computadoras y «Desconectar» (21/10/2026)
// =============================================================================
// Es app/integraciones/TusCuentasIA.tsx (la de la computadora) destilada: cada computadora con su estado, sus cuentas con
// el correo, el plan y las dos barras («Sesión de 5 horas», «Semana»), y «Desconectar» con su confirmación. Las reglas de
// qué se dice y cuándo (ia-ui.ts) tienen test. Lo que el teléfono NO hace: conectar una computadora (se instala un
// programa y se pega un código, en la computadora: una fila que la abre allá) ni elegir el modelo.
//
// Los datos son los de GET /api/ia-pc/estado (la sesión de la persona; el admin ve las de todo el negocio). Se vuelve a
// leer cada 20 s como la computadora, y al volver a la app.
//
// ⚠️ TIRAR PARA REFRESCAR TIENE QUE TRAER LO NUEVO: PantallaM hace `router.refresh()`, que vuelve a correr el server
// component pero no toca lo que este componente leyó por su cuenta. La página le pasa `refresco` (un número nuevo en cada
// pasada del server) y, cuando cambia, se vuelve a pedir el estado. Sin eso el gesto animaría y no traería nada.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { ClaudeMark } from '@/app/_components/icons';
import { haptico } from '@/lib/haptico';
import { SECCIONES_CUENTA } from '@/lib/ajustes-secciones';
import { CabeceraM, ErrorM, FilaM, ListaM, PieM, SeccionM, SheetM, SkeletonFilas, VacioM, useToastM } from '@/app/m/_ui';
import { FilaEnComputadoraM } from '@/app/m/_ui/EnComputadoraM';
import { dondeEsta, type CuentaIA, type DispositivoIA } from '@/lib/ia-pc-reglas';
import {
  REFRESCO_MS, barraDeUso, estadoDePc, nombreDeCuenta, preguntaDesconectar, type BarraUso, type EstadoIA,
} from './ia-ui';

// El mismo rótulo que «Tu cuenta» en la computadora (lib/ajustes-secciones.ts).
const TITULO = SECCIONES_CUENTA.find((s) => s.key === 'ia')?.label ?? 'Tus cuentas de IA';

function Barra({ titulo, b }: { titulo: string; b: BarraUso }) {
  return (
    <div className="m-cuenta-ia-ventana">
      <div className="m-cuenta-ia-linea">
        <span>{titulo}</span>
        <span className={`m-cuenta-ia-pct${b.pct == null ? ' m-cuenta-ia-pct--sin' : ''}`}>{b.pct == null ? 'Sin medir' : `${b.pct}% usado`}</span>
      </div>
      <div className="m-cuenta-ia-barra" aria-hidden>
        <span className={`m-cuenta-ia-lleno m-cuenta-ia-lleno--${b.tono}`} style={{ width: `${b.pct ?? 0}%` }} />
      </div>
      {b.reinicio && <p className="m-cuenta-ia-nota">{b.reinicio}</p>}
    </div>
  );
}

/** Un dispositivo de la cuenta: su nombre, en línea o no y dónde está (como Google), y «Desconectar». */
function Dispositivo({ d, ahora, onDesconectar }: { d: DispositivoIA; ahora: number; onDesconectar: () => void }) {
  const estado = estadoDePc({ enLinea: d.enLinea, ultimoLatido: d.ultimoLatido, cuentas: d.conCuenta ? [{ proveedor: 'claude' }] : [], sinClaude: d.sinClaude }, ahora);
  return (
    <>
      <FilaM
        leading={<span className={`m-cuenta-ia-punto m-cuenta-ia-punto--${estado.tono}`} aria-hidden />}
        titulo={d.nombre}
        segunda={[estado.texto, dondeEsta(d), d.de ? `De ${d.de}` : null].filter(Boolean).join(' · ')}
      />
      <FilaM navegacion titulo="Desconectar" etiqueta={`Desconectar ${d.nombre}`} onClick={onDesconectar} />
    </>
  );
}

/**
 * Una cuenta (23/10/2026, Martín: cada cuenta conectada es UN bloque, «Cuenta 1», «Cuenta 2», con su email, su plan y su uso, y
 * adentro sus DISPOSITIVOS). Lo mismo que la computadora (app/integraciones/CuentasYDispositivos.tsx), con las piezas del teléfono.
 */
function Cuenta({ cuenta, ahora, onDesconectar }: { cuenta: CuentaIA; ahora: number; onDesconectar: (d: DispositivoIA) => void }) {
  return (
    <SeccionM titulo={`Cuenta ${cuenta.numero}`}>
      <ListaM>
        <div className="m-cuenta-ia-cuenta">
          <div className="m-cuenta-ia-quien">
            {cuenta.proveedor === 'claude' && <ClaudeMark size={20} />}
            <span className="m-cuenta-ia-email">{nombreDeCuenta(cuenta)}</span>
            {cuenta.plan && <span className="m-cuenta-ia-plan">{cuenta.plan}</span>}
          </div>
          <Barra titulo="Sesión de 5 horas" b={barraDeUso(cuenta.usado5h, cuenta.repone, ahora)} />
          <Barra titulo="Semana" b={barraDeUso(cuenta.usadoSemana, cuenta.reponeSemana, ahora)} />
        </div>
        {cuenta.dispositivos.map((d) => <Dispositivo key={d.id} d={d} ahora={ahora} onDesconectar={() => onDesconectar(d)} />)}
      </ListaM>
    </SeccionM>
  );
}

export function IaM({ refresco }: { refresco: number }) {
  const toast = useToastM();
  const [estado, setEstado] = useState<EstadoIA | null>(null);
  const [fallo, setFallo] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  // La hoja de «Desconectar»: la computadora que se eligió NO se suelta al cerrar (la hoja sigue en pantalla los 220 ms de
  // su salida y se vaciaría a media animación); se pisa al abrir la próxima.
  const [porDesconectar, setPorDesconectar] = useState<DispositivoIA | null>(null);
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const recargar = useCallback(async () => {
    const e: EstadoIA | null = await fetch('/api/ia-pc/estado', { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
    if (e?.ok) { setEstado(e); setFallo(false); setAhora(Date.now()); } else setFallo(true);
  }, []);

  useEffect(() => {
    void recargar();
    // Con la app en segundo plano no se gasta datos ni batería: al volver, se lee de nuevo.
    const t = setInterval(() => { if (document.visibilityState !== 'hidden') void recargar(); }, REFRESCO_MS);
    const alVolver = () => { if (document.visibilityState === 'visible') void recargar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver); };
  }, [recargar, refresco]);

  const desconectar = async () => {
    if (!porDesconectar || ocupado) return;
    const id = porDesconectar.id;
    setOcupado(true);
    try {
      const r: { ok?: boolean; error?: string } | null = await fetch('/api/ia-pc/desconectar', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }),
      }).then((x) => x.json()).catch(() => null);
      if (!r?.ok) { haptico('error'); toast(r?.error ?? 'No se pudo desconectar'); return; }
      haptico('success');
      toast('Desconectada');
      setHojaAbierta(false);
      void recargar();
    } finally { setOcupado(false); }
  };

  return (
    <>
      <CabeceraM titulo={TITULO} />
      {estado == null
        ? (fallo
          ? <ErrorM frase="No pudimos ver tus computadoras. No es nada tuyo." onReintentar={() => void recargar()} />
          : <SkeletonFilas filas={3} />)
        : !(estado.grupos?.cuentas.length || estado.grupos?.sinCuenta.length)
          ? <VacioM frase="Todavía no conectaste ninguna cuenta." />
          : (
            <>
              {estado.grupos?.cuentas.map((c) => (
                <Cuenta key={`${c.proveedor}-${c.numero}`} cuenta={c} ahora={ahora} onDesconectar={(d) => { setPorDesconectar(d); setHojaAbierta(true); }} />
              ))}
              {!!estado.grupos?.sinCuenta.length && (
                <SeccionM titulo="Sin cuenta todavía">
                  <ListaM>
                    {estado.grupos.sinCuenta.map((d) => <Dispositivo key={d.id} d={d} ahora={ahora} onDesconectar={() => { setPorDesconectar(d); setHojaAbierta(true); }} />)}
                  </ListaM>
                </SeccionM>
              )}
            </>
          )}

      {/* «Nueva cuenta» y «Nuevo dispositivo» (23/10/2026): se conectan desde la computadora (instalar MaKo y conectarlo). */}
      <div className="m-cuenta-ia-conectar">
        <ListaM>
          <FilaEnComputadoraM icono="plus" titulo="Nueva cuenta" href="/perfil/ia"
            motivo="Se conecta desde la computadora: eliges Claude o ChatGPT y la conectas." />
          <FilaEnComputadoraM icono="plus" titulo="Nuevo dispositivo" href="/perfil/ia"
            motivo="Se conecta desde la computadora: descargas MaKo, lo instalas y lo conectas." />
        </ListaM>
      </div>

      <SheetM id="desconectar" abierto={hojaAbierta} onCerrar={() => setHojaAbierta(false)}
        titulo={porDesconectar?.nombre ?? ''} ocupado={ocupado}
        pie={(
          <PieM>
            <Button variant="danger" size="lg" full loading={ocupado} onClick={() => { void desconectar(); }}>Desconectar</Button>
          </PieM>
        )}>
        {porDesconectar && <p className="m-cuenta-ia-pregunta">{preguntaDesconectar(porDesconectar)}</p>}
      </SheetM>
    </>
  );
}

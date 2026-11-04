'use client';

// =============================================================================
// «Tu plan» en el teléfono: el plan, su estado y «Darme de baja» con su confirmación (Ajustes › Suscripciones de iOS)
// =============================================================================
// Las palabras de la computadora (PlanPanel.tsx): «Activo», «Baja pedida», «De baja»; qué pasa con Stripe (sigues hasta el
// fin del mes pagado) y con Mercado Pago (deja de cobrarse desde ya). La baja corta plata: un toque abre la hoja y
// el segundo, que dice qué pasa, la pide. No se reintenta sola (AGENTS.md: en lo que gasta plata, el default es NO).
//
// ⚠️ EL TELÉFONO NO VENDE (T5, docs/tiendas-play-appstore.md, 3/11/2026): ni el precio ni «Empezar mi plan ya». Apple y Google
//    prohíben vender algo digital sin su cobro o mandar a pagar afuera. Dar de baja se queda: eso no es una compra.
//    tests/tiendas-telefono-no-vende.test.ts lo fija.
// =============================================================================

import { CAPACIDADES_PASARELA } from '@/lib/cobros-tipos';
import { useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { useRouter } from '@/app/_ui/Link';
import { haptico } from '@/lib/haptico';
import { darmeDeBajaAction } from '@/app/configuraciones/plan/actions';
import type { SuscripcionVisible } from '@/app/configuraciones/plan/PlanPanel';
import { FilaM, ListaM, PieM, PildoraM, SheetM, VacioM, type TonoPildora } from '@/app/m/_ui';

export function PlanM({ plan, suscripcion, emailMako, gratisHasta }: { plan: string; suscripcion: SuscripcionVisible; emailMako: string; gratisHasta?: string | null }) {
  const router = useRouter();
  const [preguntar, setPreguntar] = useState(false);
  const [corriendo, setCorriendo] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const enPrueba = !!suscripcion?.prueba;
  const estado: { texto: string; tono: TonoPildora } | null = !suscripcion ? null
    : suscripcion.cancelada ? { texto: 'De baja', tono: 'warn' } : suscripcion.baja ? { texto: 'Baja pedida', tono: 'warn' }
      : enPrueba ? { texto: 'En prueba', tono: 'good' } : { texto: 'Activo', tono: 'good' };

  const puedeDarseDeBaja = !!suscripcion && !suscripcion.cancelada && !suscripcion.baja && !aviso?.ok;
  const hastaElFinDelMes = !!suscripcion && CAPACIDADES_PASARELA[suscripcion.proveedor].bajaAlFinDelPeriodo;

  const darmeDeBaja = async () => {
    if (corriendo) return;
    setCorriendo(true); setAviso(null);
    const r = await darmeDeBajaAction().catch(() => ({ ok: false as const, resumen: 'No pudimos darte de baja.' }));
    setCorriendo(false); setPreguntar(false);
    if (r.ok) { haptico('success'); setAviso({ ok: true, texto: `Listo. Tu código de baja es ${r.codigo}: también te llega por email.` }); router.refresh(); }
    else { haptico('error'); setAviso({ ok: false, texto: r.resumen }); }
  };

  return (
    <>
      <ListaM>
        <FilaM icono="tag" titulo={plan}
          segunda={!suscripcion ? (gratisHasta ? `Gratis hasta el ${gratisHasta}` : 'Acordado con MaKo') : enPrueba ? `Prueba gratis hasta el ${suscripcion.prueba!.hasta}` : undefined}
          pill={estado ? <PildoraM tono={estado.tono}>{estado.texto}</PildoraM> : undefined} />
        {suscripcion?.baja && <FilaM icono="notepencil" titulo="Tu baja" segunda={suscripcion.baja} />}
      </ListaM>
      {!suscripcion && (
        <VacioM frase={`Tu plan se acordó con MaKo: para darte de baja, escríbenos a ${emailMako}.`}
          accion={{ rotulo: 'Escribirle a MaKo', href: `mailto:${emailMako}` }} />
      )}
      {aviso && <p className="m-configuraciones-aviso" data-tono={aviso.ok ? undefined : 'bad'} role="status">{aviso.texto}</p>}
      {puedeDarseDeBaja && (
        <ListaM>
          <FilaM titulo={<span className="m-configuraciones-rojo">Darme de baja</span>}
            segunda={enPrueba ? 'No se te cobra nada.' : hastaElFinDelMes ? 'Lo sigues usando hasta el fin del mes pagado.' : 'Mercado Pago deja de cobrarlo desde ya.'}
            onClick={() => setPreguntar(true)} />
        </ListaM>
      )}
      <SheetM id="baja" abierto={preguntar} onCerrar={() => setPreguntar(false)} ocupado={corriendo} titulo="¿Darte de baja?"
        rotuloCerrar="Seguir con mi plan"
        pie={(
          <PieM consecuencia={enPrueba
            ? `No se te cobra nada, y sigues usando MaKo hasta el ${suscripcion!.prueba!.hasta}. No se puede deshacer.`
            : hastaElFinDelMes
              ? 'No se te cobra el mes siguiente, y sigues usando MaKo hasta el fin del mes pagado.'
              : 'Mercado Pago deja de cobrarlo desde ya. No se puede deshacer.'}>
            <Button variant="danger" size="lg" full loading={corriendo} onClick={() => { void darmeDeBaja(); }}>Darme de baja</Button>
          </PieM>
        )} />
    </>
  );
}

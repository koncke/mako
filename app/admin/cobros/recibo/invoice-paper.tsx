// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/invoice/_components/invoice-paper.tsx.
// El papel de Studio con el recibo de MaKo: el emisor de los «Datos del recibo» (nunca se inventa un dato fiscal), a nombre de
// quién, los renglones, lo recibido y cada pago. El N.º lo pone el servidor al emitir; el PDF de verdad es lib/recibo-pdf.ts.
import { AppLogo } from "@/app/admin/_studio/shell/app-logo";
import type { Emisor } from "@/lib/recibos-reglas";
import { ROTULO_MEDIO } from "@/lib/recibos-reglas";
import { formatoMonto } from "@/lib/pasarela-moneda";

import { diferenciaDe, INVOICE_PAPER_HEIGHT, INVOICE_PAPER_WIDTH, type ReciboForm, recibido, totalDetalle } from "./data";

export function InvoicePaper({ recibo, emisor, cuenta, numero, hoy }: { recibo: ReciboForm; emisor: Emisor; cuenta: string; numero: number | null; hoy: string }) {
  const dif = diferenciaDe(recibo);
  const entro = recibido(recibo);

  return (
    <article
      style={{ width: INVOICE_PAPER_WIDTH, height: INVOICE_PAPER_HEIGHT }}
      data-print-paper
      className="relative flex flex-col gap-24 bg-neutral-50 px-12.25 py-11 font-mono text-neutral-950"
    >
      <header className="flex flex-col gap-10">
        <div className="grid grid-cols-2 items-start gap-14">
          <AppLogo className="size-12" />
          <h2 className="text-4xl tracking-widest uppercase">Recibo</h2>
        </div>

        <section className="grid grid-cols-2 gap-14 text-sm leading-relaxed">
          <div>
            <p>N.º: {numero != null ? String(numero).padStart(4, "0") : "se asigna al emitir"}</p>
            <p>Emitido: {hoy}</p>
            {recibo.pagos[0]?.fecha && <p>Pagado: {recibo.pagos[0].fecha}</p>}
          </div>
          <div>
            <p>Recibido</p>
            <p>{entro.length ? entro.map((t) => formatoMonto(t.monto, t.moneda)).join(" + ") : "—"}</p>
            {dif != null && dif !== 0 && <p>{dif > 0 ? "De más" : "De menos"}: {formatoMonto(Math.abs(dif), recibo.moneda)}</p>}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-14 text-sm leading-relaxed">
          <div>
            <p className="mb-4 font-semibold uppercase">De</p>
            <p>{emisor.nombre || "—"}</p>
            {emisor.direccion && <p>{emisor.direccion}</p>}
            {emisor.documento && <p>Documento: {emisor.documento}</p>}
          </div>
          <div>
            <p className="mb-4 font-semibold uppercase">A nombre de</p>
            <p>{recibo.aNombre.trim() || "—"}</p>
            {cuenta && <p>Cuenta: {cuenta}</p>}
          </div>
        </section>
      </header>

      <div className="flex flex-col gap-5">
        <section className="text-sm">
          <div className="grid grid-cols-[1fr_116px_140px] bg-stone-200 px-3 py-3 font-semibold uppercase">
            <span>Concepto</span>
            <span className="text-right">Mes</span>
            <span className="text-right">Importe</span>
          </div>
          {recibo.lineas.map((l) => (
            <div key={l.id} className="grid grid-cols-[1fr_116px_140px] border-b border-[oklch(0.86_0_0)] px-3 py-4">
              <span>{l.concepto}</span>
              <span className="text-right">{l.mes}</span>
              <span className="text-right">{formatoMonto(Number.isFinite(l.monto) ? l.monto : 0, recibo.moneda)}</span>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-2 gap-14 text-sm leading-relaxed">
          <section className="space-y-1">
            {recibo.pagos.map((p) => (
              <p key={p.id}>
                {ROTULO_MEDIO[p.medio]} {p.referencia ? `· ${p.referencia}` : ""} · {formatoMonto(Number.isFinite(p.monto) ? p.monto : 0, p.moneda)}
              </p>
            ))}
            {recibo.notaPdf.trim() && <p className="pt-2 text-neutral-600">{recibo.notaPdf.trim()}</p>}
          </section>
          <section className="col-start-2 space-y-2">
            <div className="border-y-2 border-current py-3">
              <div className="flex justify-between gap-8">
                <span className="font-semibold uppercase">Total</span>
                <span className="font-semibold">{formatoMonto(totalDetalle(recibo), recibo.moneda)}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <footer className="absolute right-12.25 bottom-11 left-12.25 grid grid-cols-2 gap-14 text-sm leading-relaxed text-neutral-500">
        <div>{emisor.correo && <p>{emisor.correo}</p>}</div>
        <div>
          <p>Emitido por {emisor.nombre || "MaKo"}</p>
        </div>
      </footer>
    </article>
  );
}

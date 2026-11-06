// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/invoice/_components/invoice-preview.tsx
// y print-invoice.tsx. «Print» imprime el papel (los estilos de impresión, en app/admin/_studio/studio-theme.css); «Download PDF»
// baja el PDF de verdad del recibo (lib/recibo-pdf.ts), que existe recién al emitirlo: antes, el botón se apaga y lo dice.
"use client";

import * as React from "react";

import { createPortal } from "react-dom";

import { Download, Printer } from "lucide-react";

import { Button } from "@/app/admin/_studio/components/ui/button";
import { ButtonGroup } from "@/app/admin/_studio/components/ui/button-group";
import type { Emisor } from "@/lib/recibos-reglas";

import { INVOICE_PAPER_HEIGHT, INVOICE_PAPER_SCALE, INVOICE_PAPER_WIDTH, type ReciboForm } from "./data";
import { InvoicePaper } from "./invoice-paper";
import { useVisibleCenterPosition } from "./use-visible-center-position";

function handlePrint() {
  window.print();
}

type Papel = { recibo: ReciboForm; emisor: Emisor; cuenta: string; numero: number | null; hoy: string };

function PrintInvoice(p: Papel) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div data-print-root>
      <InvoicePaper {...p} />
    </div>,
    document.body,
  );
}

export function InvoicePreview({ emitido, ...p }: Papel & { emitido: { id: number } | null }) {
  const previewBodyRef = React.useRef<HTMLDivElement>(null);
  const paperLayout = useVisibleCenterPosition(previewBodyRef, {
    height: INVOICE_PAPER_HEIGHT,
    maxScale: INVOICE_PAPER_SCALE,
    width: INVOICE_PAPER_WIDTH,
  });

  return (
    <>
      <PrintInvoice {...p} />
      <div className="bg-card flex flex-col rounded-xl border">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-4">
          <h2 className="text-lg font-medium">Vista previa</h2>
          <ButtonGroup>
            <Button type="button" variant="outline" onClick={handlePrint}>
              <Printer data-icon="inline-start" />
              Imprimir
            </Button>
            {emitido ? (
              <Button type="button" variant="outline" asChild>
                <a href={`/api/admin/recibos/${emitido.id}/pdf`}>
                  <Download data-icon="inline-start" />
                  Bajar el PDF
                </a>
              </Button>
            ) : (
              <Button type="button" variant="outline" disabled title="Se baja al emitirlo">
                <Download data-icon="inline-start" />
                Bajar el PDF
              </Button>
            )}
          </ButtonGroup>
        </div>

        <div
          ref={previewBodyRef}
          className="@container/preview relative min-h-[calc(100svh-15rem)] flex-1 rounded-b-xl bg-stone-200 p-4 dark:bg-stone-800"
        >
          {paperLayout === null ? (
            <div className="text-muted-foreground absolute inset-0 grid place-items-center text-sm">Cargando la vista previa</div>
          ) : null}
          <div
            style={{
              height: paperLayout ? INVOICE_PAPER_HEIGHT * paperLayout.scale : INVOICE_PAPER_HEIGHT * INVOICE_PAPER_SCALE,
              top: paperLayout?.top ?? "50%",
              transform: paperLayout === null ? "translate(-50%, -50%)" : "translateX(-50%)",
              width: paperLayout ? INVOICE_PAPER_WIDTH * paperLayout.scale : INVOICE_PAPER_WIDTH * INVOICE_PAPER_SCALE,
            }}
            className="absolute left-1/2 opacity-0 data-[ready=true]:opacity-100"
            data-ready={paperLayout !== null}
          >
            <div style={{ transform: `scale(${paperLayout?.scale ?? INVOICE_PAPER_SCALE})` }} className="origin-top-left">
              <InvoicePaper {...p} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

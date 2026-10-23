"use client";

import { Toaster as Sonner, toast } from "sonner";
import { reportarASoporte } from "@/app/_ui/ReportarASoporte";
import { ROTULO_MANDADO, ROTULO_REPORTAR } from "@/lib/soporte-reporte";

// «Reportar a Soporte» en TODO error del editor (23/10/2026, tests/reportar-a-soporte.test.ts). Los ~45 archivos del editor
// llaman `toast.error` de sonner, que dibuja el toast con su propia librería (no es un `role="alert"` de la app): acá, UNA
// vez y antes de que se monte el editor, `toast.error` sale con la acción de reportar —salvo que quien llama ya traiga una—
// y se queda 8 s para dar tiempo a tocarla. Al tocarla se manda lo que dice el toast, no la pantalla.
const errorDeSonner = toast.error;
if (!(errorDeSonner as unknown as { conSoporte?: true }).conSoporte) {
	const conSoporte: typeof toast.error = (mensaje, datos) =>
		errorDeSonner(mensaje, {
			duration: 8000,
			...datos,
			action: datos?.action ?? {
				label: ROTULO_REPORTAR,
				onClick: () => {
					const texto = [typeof mensaje === "string" ? mensaje : "", typeof datos?.description === "string" ? datos.description : ""]
						.filter(Boolean).join(". ");
					void reportarASoporte({ error: texto || "Un error del editor de video" }).then((r) =>
						r.ok ? toast.success(`${ROTULO_MANDADO} · ticket #${r.id}`) : errorDeSonner(r.error),
					);
				},
			},
		});
	toast.error = Object.assign(conSoporte, { conSoporte: true as const });
}

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
	return (
		<Sonner
			theme="dark"
			className="toaster group"
			position="bottom-right"
			offset={20}
			toastOptions={{
				classNames: {
					toast:
						"group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
					description: "group-[.toast]:text-muted-foreground",
					actionButton:
						"group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
					cancelButton:
						"group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
				},
			}}
			expand={false}
			richColors
			{...props}
		/>
	);
};

export { Toaster };

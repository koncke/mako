'use client';

// La portada de outliers sin el chat de MaKo (12/11/2026): lo que la portada le puede pedir a la pantalla de Create
// (./PantallaCrear.tsx, que lo provee). «Mis guiones», «Mis diseños», «Mis landings» abren la lista de proyectos de la tab a la
// izquierda. Fuera de una portada (el teléfono, los tests), null: la portada usa su ruta.
// En un módulo APARTE y sin dependencias: las portadas (Image, Copywriting, Web Generator) lo importan, y traer PantallaCrear
// arrastraba el chat entero (y sus módulos de servidor) a cada una (tests/carruseles-pantalla.test.ts lo vio).

import { createContext, useContext } from 'react';

export const PortadaCrearCtx = createContext<{ verProyectos: () => void } | null>(null);
export const usePortadaCrear = () => useContext(PortadaCrearCtx);

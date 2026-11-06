'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/packages/ui/src/components/atoms/Accordion.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import * as React from 'react'

import {
  Accordion as ShadAccordion,
  AccordionContent as ShadAccordionContent,
  AccordionItem as ShadAccordionItem,
  AccordionTrigger as ShadAccordionTrigger,
} from '@/app/admin/_polar/ui/accordion'
import { cn } from '@/app/admin/_polar/lib/utils'

const Accordion = ShadAccordion

const AccordionItem = ({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof ShadAccordionItem>) => (
  <ShadAccordionItem
    ref={ref}
    className={cn('rounded-2xl! px-3', className)}
    {...props}
  />
)
AccordionItem.displayName = 'AccordionItem'

const AccordionTrigger = ({
  ref,
  className,
  children,
  ...props
}: React.ComponentProps<typeof ShadAccordionTrigger>) => (
  <ShadAccordionTrigger
    ref={ref}
    className={cn('text-sm', className)}
    {...props}
  >
    {children}
  </ShadAccordionTrigger>
)
AccordionTrigger.displayName = ShadAccordionTrigger.displayName

const AccordionContent = ({
  ref,
  children,
  ...props
}: React.ComponentProps<typeof ShadAccordionContent>) => (
  <ShadAccordionContent ref={ref} {...props}>
    {children}
  </ShadAccordionContent>
)

AccordionContent.displayName = ShadAccordionContent.displayName

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger }

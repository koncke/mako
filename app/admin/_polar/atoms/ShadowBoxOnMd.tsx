// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/packages/ui/src/components/atoms/ShadowBoxOnMd.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import { DetailedHTMLProps } from 'react'
import { twMerge } from 'tailwind-merge'

const ShadowBoxOnMd = ({
  className,
  children,
  ...props
}: DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>) => (
  <div
    className={twMerge(
      'md:dark:bg-polar-900 dark:border-polar-700 w-full md:rounded-xl md:border md:border-transparent md:bg-gray-50 md:p-8 lg:rounded-4xl',
      className,
    )}
    {...props}
  >
    {children}
  </div>
)

export default ShadowBoxOnMd

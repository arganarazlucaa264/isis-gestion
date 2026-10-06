import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cx } from '@/lib/cx'

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cx('w-full min-w-max border-collapse text-left text-sm', className)}>
        {children}
      </table>
    </div>
  )
}

export function Thead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-sand-100 text-xs tracking-wide text-bronze-600 uppercase">
      {children}
    </thead>
  )
}

export function Th({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cx('px-3 py-2 font-semibold whitespace-nowrap', className)} {...rest} />
}

export function Tr({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cx('border-t border-sand-200 hover:bg-sand-100/60', className)} {...rest} />
}

export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx('px-3 py-2 align-middle', className)} {...rest} />
}

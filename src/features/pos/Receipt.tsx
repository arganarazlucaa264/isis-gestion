import { Button } from '@/components/ui/Button'
import { useSettings } from '@/features/settings/useSettings'
import type { SaleDetail } from '@/features/pos/api'
import { docNumber, formatDateTime } from '@/lib/format'
import { formatMoney } from '@/lib/money'

/** Comprobante interno de venta (no es una factura). Se imprime con window.print(). */
export function Receipt({ sale }: { sale: SaleDetail }) {
  const { settings } = useSettings()
  const returned = sale.sale_returns.reduce((s, r) => s + r.refund_amount, 0)
  return (
    <div>
      <div
        id="print-area"
        className="mx-auto w-full max-w-xs bg-white p-4 font-mono text-xs text-black shadow-sm print:shadow-none"
      >
        <div className="text-center">
          <p className="text-base font-bold">{settings.store_name}</p>
          <p>COMPROBANTE INTERNO</p>
          <p>No válido como factura</p>
        </div>
        <hr className="my-2 border-dashed border-black" />
        <p>Venta {docNumber('V', sale.number)}</p>
        <p>{formatDateTime(sale.created_at)}</p>
        {sale.seller_name && <p>Vendedor: {sale.seller_name}</p>}
        {sale.customers && <p>Cliente: {sale.customers.name}</p>}
        {sale.status === 'voided' && (
          <p className="mt-1 text-center text-sm font-bold">*** ANULADA ***</p>
        )}
        <hr className="my-2 border-dashed border-black" />
        {sale.sale_items.map((i) => (
          <div key={i.id} className="mb-1">
            <p>
              {i.quantity} x {i.product_name}
            </p>
            <p className="flex justify-between pl-3">
              <span>
                {i.color_name} · {i.size_name} · {formatMoney(i.unit_price)}
              </span>
              <span>{formatMoney(i.unit_price * i.quantity)}</span>
            </p>
            {i.discount_amount > 0 && (
              <p className="flex justify-between pl-3">
                <span>Descuento</span>
                <span>-{formatMoney(i.discount_amount)}</span>
              </p>
            )}
          </div>
        ))}
        <hr className="my-2 border-dashed border-black" />
        <p className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatMoney(sale.subtotal)}</span>
        </p>
        {sale.discount_amount > 0 && (
          <p className="flex justify-between">
            <span>Descuentos</span>
            <span>-{formatMoney(sale.discount_amount)}</span>
          </p>
        )}
        <p className="flex justify-between text-sm font-bold">
          <span>TOTAL</span>
          <span>{formatMoney(sale.total)}</span>
        </p>
        <hr className="my-2 border-dashed border-black" />
        {sale.sale_payments.map((p) => (
          <div key={p.id}>
            <p className="flex justify-between">
              <span>
                {p.method_name}
                {p.installments ? ` (${p.installments} cuotas)` : ''}
              </span>
              <span>{formatMoney(p.amount)}</span>
            </p>
            {p.is_cash && p.change_given > 0 && (
              <p className="flex justify-between pl-3">
                <span>Recibido {formatMoney(p.amount_tendered ?? p.amount)}</span>
                <span>Vuelto {formatMoney(p.change_given)}</span>
              </p>
            )}
          </div>
        ))}
        {returned > 0 && (
          <p className="mt-1 flex justify-between">
            <span>Devoluciones</span>
            <span>-{formatMoney(returned)}</span>
          </p>
        )}
        <hr className="my-2 border-dashed border-black" />
        <p className="text-center">¡Gracias por su compra!</p>
      </div>
      <div className="mt-3 text-center print:hidden">
        <Button
          icon="printer"
          variant="outline"
          onClick={() => {
            window.print()
          }}
        >
          Imprimir comprobante
        </Button>
      </div>
    </div>
  )
}

# 0002 · Ledgers inmutables

**Estado:** aceptada

## Contexto

Se exige trazabilidad total de stock, caja y deuda con proveedores.

## Decisión

`stock_movements`, `cash_movements` y `supplier_ledger` son append-only: triggers bloquean
UPDATE y DELETE. Los saldos (`stock_levels`, efectivo esperado, saldo de proveedor) se derivan de
los movimientos y se auditan contra ellos. Los errores se corrigen con movimientos inversos.

## Consecuencias

- Historia completa y auditable; cualquier diferencia se puede explicar.
- Corregir requiere un movimiento nuevo con motivo, no editar el anterior.

# 0005 · Alcance inicial

**Estado:** aceptada

## Decisión (propuestas por defecto del plan, aprobadas)

1. Un solo local; sumar sucursales implicaría agregar `location_id` en stock, cajas y ventas.
2. El modelo soporta varias cajas; se arranca con una.
3. Sin facturación fiscal (ARCA/AFIP): solo comprobante interno.
4. `customers` mínimo y opcional, sin cuenta corriente de clientes.
5. Se guarda `installments` en pagos con crédito; sin cálculo automático de recargo.
6. Stock negativo no permitido (configurable en `app_settings`).
7. Cinco roles: dueño, encargado, vendedor/cajero, depósito, solo lectura.
8. Moneda única: ARS. Zona horaria del negocio: America/Argentina/Buenos_Aires.

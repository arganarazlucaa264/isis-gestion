# 0008 · Códigos de barras (EAN) y escáner

**Estado:** aceptada

## Decisión

- `product_variants.ean` es texto, único ignorando ceros a la izquierda, validado como EAN-8, UPC-A,
  EAN-13 o EAN-14 con dígito verificador (`is_valid_gtin`).
- Una única búsqueda por código (`find_variant_by_code`: EAN, luego SKU) la usan el POS, el
  inventario, las compras y el Excel.
- Un único componente de entrada (`CodeInput`): un lector USB/Bluetooth escribe el código y envía
  Enter (comportamiento de teclado); la cámara del celular usa `BarcodeDetector` cuando existe.

## Consecuencias

- Conectar un lector físico no requiere cambios de modelo, RPC ni Excel.
- Futuro: generación de EAN internos, etiquetas y varios códigos por variante.

// ── Modos de venta ──
// En la BD no hay columna "modo": se deduce de permite_pujas +
// precio_compra_inmediata (igual que NuevaSubasta.java en el backend).
// Vive aquí para que el catálogo, Vender y cualquier otra pantalla lo
// nombren igual.

export type Modo = 'subasta' | 'precio_fijo' | 'mixto';

export const ETIQUETA_MODO: Record<Modo, string> = {
  subasta: 'Subasta',
  precio_fijo: 'Precio fijo',
  mixto: 'Subasta + precio fijo',
};

export function modoDe(permitePujas?: boolean | null, precioCompraInmediata?: number | null): Modo {
  if (permitePujas === false) return 'precio_fijo';
  if (precioCompraInmediata != null) return 'mixto';
  // null en permite_pujas = publicación de antes de los modos: todas eran subastas.
  return 'subasta';
}

export type ContratoEntrega = {
  id: string;
  estado: string;
  rol: 'comprador' | 'vendedor';
};

const ESTADOS_CON_ENTREGA = new Set(['pendiente', 'en_custodia', 'enviado']);

export function puedeCoordinarEntrega(contrato?: ContratoEntrega | null): contrato is ContratoEntrega {
  return contrato?.rol === 'comprador' && ESTADOS_CON_ENTREGA.has(contrato.estado);
}

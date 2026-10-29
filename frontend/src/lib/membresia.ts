export type PlanMembresia = {
  plan: string;
  periodicidad: 'mensual' | 'anual';
  precioUsd: number;
  moneda: 'USD';
  unidad: 'mes' | 'año';
  renovacion: string;
};

export type EstadoMembresia = {
  activa: boolean;
  plan: 'gratuito' | 'bidluxury_member';
  periodicidad?: 'mensual' | 'anual' | null;
  estado: 'gratuito' | 'pendiente' | 'activa' | 'vencida' | 'cancelada';
  fechaInicio?: string | null;
  fechaFin?: string | null;
  renovacionCancelada?: boolean;
};

// Las tasas las cobra la BD (comision_plataforma() en fase2_cierre.sql y
// fase8_comision_member.sql); aquí solo se muestran. Si cambian allá, cámbialas aquí.
export const COMISION_GRATIS = 0.01;
export const COMISION_MEMBER = 0.005;

export const porcentaje = (tasa: number) => `${tasa * 100}%`;

export const BENEFICIOS_MEMBER = [
  `Comisión por venta del ${porcentaje(COMISION_MEMBER)} (en vez del ${porcentaje(COMISION_GRATIS)})`,
  'Subastas exclusivas premium',
  'Posibilidad de pujar en activos premium',
  'Acceso anticipado a determinadas subastas',
  'Distintivo de miembro BidLuxury',
  'Experiencia personalizada según tus preferencias',
];

export const PRECIO_MEMBER_FALLBACK: Record<'mensual' | 'anual', number> = {
  mensual: 19.99,
  anual: 199.99,
};

export const dineroMembresia = (valor: number) => `$${valor.toFixed(2)} USD`;

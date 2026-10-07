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

export const BENEFICIOS_MEMBER = [
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

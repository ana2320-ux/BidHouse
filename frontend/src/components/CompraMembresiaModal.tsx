import { useState } from 'react';
import { dineroMembresia, type PlanMembresia } from '../lib/membresia';
import { usd } from '../api';
import './CompraMembresiaModal.css';

interface CompraMembresiaModalProps {
  abierto: boolean;
  plan: PlanMembresia;
  saldoDisponible: number | null;
  cargandoSaldo: boolean;
  procesando: boolean;
  error: string;
  alCerrar: () => void;
  alElegirSaldo: () => void;
  alConfirmar: () => void;
  alPagarMercadoPago: () => void;
  alRecargar: () => void;
}

export default function CompraMembresiaModal({
  abierto,
  plan,
  saldoDisponible,
  cargandoSaldo,
  procesando,
  error,
  alCerrar,
  alElegirSaldo,
  alConfirmar,
  alPagarMercadoPago,
  alRecargar,
}: CompraMembresiaModalProps) {
  const [metodo, setMetodo] = useState<'mercadopago' | 'saldo' | null>(null);

  if (!abierto) return null;

  const alcanza = saldoDisponible != null && saldoDisponible >= plan.precioUsd;
  const falta = saldoDisponible == null ? 0 : Math.max(0, plan.precioUsd - saldoDisponible);

  return (
    <div className="compra-membresia-modal" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) alCerrar();
    }}>
      <section className="compra-membresia-modal__caja" role="dialog" aria-modal="true" aria-labelledby="compra-membresia-titulo">
        <button type="button" className="compra-membresia-modal__cerrar" onClick={alCerrar} aria-label="Cerrar ventana">×</button>
        <p className="membresia-plan__eyebrow">COMPRA DE MEMBRESÍA</p>
        <h2 id="compra-membresia-titulo">BidLuxury Member</h2>
        <p className="compra-membresia-modal__plan">Plan {plan.periodicidad} · {dineroMembresia(plan.precioUsd)}</p>

        <dl className="compra-membresia-modal__resumen">
          <div>
            <dt>Precio de la membresía</dt>
            <dd>{dineroMembresia(plan.precioUsd)}</dd>
          </div>
          {metodo === 'saldo' && (
            <div>
              <dt>Saldo disponible</dt>
              <dd>{cargandoSaldo || saldoDisponible == null ? 'Consultando…' : usd(saldoDisponible)}</dd>
            </div>
          )}
        </dl>

        {error && <p className="compra-membresia-modal__error" role="alert">{error}</p>}

        {metodo === 'saldo' && !cargandoSaldo && saldoDisponible != null && !alcanza && (
          <div className="compra-membresia-modal__insuficiente">
            <strong>Necesitas recargar saldo</strong>
            <span>Te faltan {usd(falta)} para comprar este plan.</span>
            <button type="button" className="btn btn--outline" onClick={alRecargar}>Recargar saldo</button>
          </div>
        )}

        <div className="compra-membresia-modal__metodos" role="group" aria-label="Método de pago">
          <p>Elige cómo pagar</p>
          <button
            type="button"
            className={`compra-membresia-modal__metodo compra-membresia-modal__metodo--mercado ${metodo === 'mercadopago' ? 'compra-membresia-modal__metodo--seleccionado' : ''}`}
            onClick={() => setMetodo('mercadopago')}
            disabled={procesando || (metodo !== null && metodo !== 'mercadopago')}
            aria-pressed={metodo === 'mercadopago'}
          >
            <strong>{procesando && metodo === 'mercadopago' ? 'Preparando pago…' : 'Mercado Pago'}</strong>
            <span>Pago único y activación después de la aprobación.</span>
          </button>
          <button
            type="button"
            className={`compra-membresia-modal__metodo ${metodo === 'saldo' ? 'compra-membresia-modal__metodo--seleccionado' : ''}`}
            onClick={() => { setMetodo('saldo'); alElegirSaldo(); }}
            disabled={procesando || (metodo !== null && metodo !== 'saldo')}
            aria-pressed={metodo === 'saldo'}
          >
            <strong>Saldo de billetera</strong>
            <span>{metodo === 'saldo' && alcanza ? 'Se descuenta del saldo disponible.' : 'Usa el saldo disponible de tu cuenta.'}</span>
          </button>
        </div>

        {metodo !== null && (
          <button type="button" className="compra-membresia-modal__cambiar" onClick={() => setMetodo(null)} disabled={procesando}>
            ← Elegir otro método
          </button>
        )}

        <div className="compra-membresia-modal__acciones">
          <button type="button" className="btn btn--outline" onClick={alCerrar}>Cancelar</button>
          {metodo === 'mercadopago' && (
            <button type="button" className="btn btn--primary" onClick={alPagarMercadoPago} disabled={procesando}>
              {procesando ? 'Preparando pago…' : 'Pagar con Mercado Pago'}
            </button>
          )}
          {metodo === 'saldo' && (
            <button type="button" className="btn btn--primary" onClick={alConfirmar} disabled={cargandoSaldo || !alcanza || procesando}>
              {procesando ? 'Comprando…' : 'Pagar con saldo'}
            </button>
          )}
        </div>
        <p className="compra-membresia-modal__nota">
          {metodo === 'saldo'
            ? 'El descuento y la activación se realizan juntos en BidLuxury. No se usa el saldo por liberar ni se crea un cobro automático.'
            : metodo === 'mercadopago'
              ? 'Serás dirigido a Mercado Pago. La membresía solo se activa después de confirmar el pago.'
              : 'Selecciona un método para continuar. La membresía solo se activa después de confirmar el pago.'}
        </p>
      </section>
    </div>
  );
}

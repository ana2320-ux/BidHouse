import { useEffect, useRef } from 'react';
import { puedeCoordinarEntrega, type ContratoEntrega } from '../lib/logistica';
import './OpcionesEntrega.css';

type OpcionesEntregaProps = {
  contrato: ContratoEntrega;
  onIrChat: () => void;
  etiquetaChat?: string;
  enModal?: boolean;
};

export function OpcionesEntrega({ contrato, onIrChat, etiquetaChat = 'Ir al chat', enModal = false }: OpcionesEntregaProps) {
  if (!puedeCoordinarEntrega(contrato)) return null;

  return (
    <div className={`logistica-opciones ${enModal ? 'logistica-opciones--modal' : ''}`}>
      <div className="logistica-opciones__cabecera">
        <span className="logistica-opciones__icono" aria-hidden="true">🚚</span>
        <h2 id={enModal ? 'logistica-modal-titulo' : undefined}>Entrega y logística</h2>
      </div>
      <p className="logistica-opciones__intro">
        Coordina la entrega de tu activo con un operador logístico externo o directamente con el vendedor.
      </p>

      <div className="logistica-opciones__lista">
        <article className="logistica-opcion">
          <div>
            <strong>FedEx</strong>
            <span>Envíos nacionales e internacionales.</span>
          </div>
          <a href="https://www.fedex.com/es-co/home.html" target="_blank" rel="noopener noreferrer">
            Ir a FedEx ↗
          </a>
        </article>

        <article className="logistica-opcion">
          <div>
            <strong>DHL</strong>
            <span>Envíos internacionales y soluciones logísticas.</span>
          </div>
          <a href="https://www.dhl.com/co-es/home.html" target="_blank" rel="noopener noreferrer">
            Ir a DHL ↗
          </a>
        </article>

        <article className="logistica-opcion">
          <div>
            <strong>Coordinar con el vendedor</strong>
            <span>Acuerda directamente los detalles de entrega utilizando el chat de BidLuxury.</span>
          </div>
          <button type="button" onClick={onIrChat}>{etiquetaChat}</button>
        </article>
      </div>

      <p className="logistica-opciones__nota">
        Para vehículos, maquinaria u otros activos de gran tamaño, puede ser necesario contratar un servicio de transporte especializado.
      </p>
      <p className="logistica-opciones__disclaimer">
        BidLuxury facilita el acceso a opciones externas de logística, pero la contratación y condiciones del servicio se gestionan directamente con el proveedor seleccionado.
      </p>
    </div>
  );
}

type ModalLogisticaProps = {
  abierto: boolean;
  contrato: ContratoEntrega | null;
  alCerrar: () => void;
  onIrChat: () => void;
};

export function ModalLogistica({ abierto, contrato, alCerrar, onIrChat }: ModalLogisticaProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const anterior = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') alCerrar();
    };
    document.addEventListener('keydown', cerrarConEscape);
    return () => {
      document.removeEventListener('keydown', cerrarConEscape);
      anterior?.focus();
    };
  }, [abierto, alCerrar]);

  if (!abierto || !contrato || !puedeCoordinarEntrega(contrato)) return null;

  return (
    <div
      className="logistica-modal__overlay"
      role="presentation"
      onMouseDown={(evento) => evento.target === evento.currentTarget && alCerrar()}
    >
      <div
        ref={dialogRef}
        className="logistica-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logistica-modal-titulo"
        tabIndex={-1}
      >
        <button type="button" className="logistica-modal__cerrar" aria-label="Cerrar" onClick={alCerrar}>×</button>
        <OpcionesEntrega contrato={contrato} onIrChat={onIrChat} etiquetaChat="Ir al chat" enModal />
      </div>
    </div>
  );
}

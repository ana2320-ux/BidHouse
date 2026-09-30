import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, usd } from '../api';
import './PagoContrato.css';

// El contrato de garantía de quien mira la subasta (ServicioSubasta.contratoDe()).
export interface MiContrato {
  id: string;
  estado: string;
  monto: number;
  comision_plataforma: number | null;
  fecha_limite_pago: string | null;
  rol: 'comprador' | 'vendedor';
}

const fechaCorta = (valor: string | null) =>
  valor ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(valor)) : '';

// Qué ve comprador o vendedor según la etapa del contrato. Pagar solo aparece
// para el comprador mientras está "pendiente".
export function PagoContrato({ contrato, alPagar }: { contrato: MiContrato; alPagar: () => void }) {
  if (contrato.rol === 'comprador' && contrato.estado === 'pendiente') {
    return <PagarContrato contrato={contrato} alPagar={alPagar} />;
  }

  const neto = contrato.monto - (contrato.comision_plataforma ?? 0);
  let texto: string;
  if (contrato.rol === 'comprador') {
    texto = contrato.estado === 'en_custodia'
      ? '✓ Pagaste. Tu dinero está en custodia en BidHouse hasta que confirmes que recibiste el activo.'
      : `Estado del contrato: ${contrato.estado}.`;
  } else {
    texto = contrato.estado === 'pendiente'
      ? `Esperando que el comprador pague (plazo: ${fechaCorta(contrato.fecha_limite_pago)}).`
      : contrato.estado === 'en_custodia'
        ? `✓ El comprador pagó y el dinero está en custodia. Envía el activo: recibirás ${usd(neto)} en tu saldo cuando confirme la entrega.`
        : `Estado del contrato: ${contrato.estado}.`;
  }
  return <p className="pago-contrato__estado">{texto}</p>;
}

// ── El comprador elige cómo pagar ──
function PagarContrato({ contrato, alPagar }: { contrato: MiContrato; alPagar: () => void }) {
  const [saldo, setSaldo] = useState<number | null>(null);
  const [confirmandoSaldo, setConfirmandoSaldo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  // Arranca en true: al abrir el panel ya se está buscando el pago.
  const [verificando, setVerificando] = useState(true);

  // Por si ya pagó en Mercado Pago y no volvió con "Volver al sitio" (en
  // localhost no hay regreso automático): se busca el pago y, si aparece, se
  // recarga el detalle, que ya mostrará el contrato "en custodia".
  // Los cambios de estado van después del await (ver SaldoCuenta).
  const verificarMercadoPago = async () => {
    try {
      const { nuevos } = await api<{ nuevos: number }>('/api/pagos/sincronizar', { method: 'POST' });
      if (nuevos > 0) alPagar();
    } catch {
      // Si Mercado Pago no responde, se deja pagar normalmente.
    } finally {
      setVerificando(false);
    }
  };

  useEffect(() => {
    verificarMercadoPago();
    api<{ disponible: number }>('/api/pagos/saldo')
      .then((s) => setSaldo(s.disponible))
      .catch(() => setSaldo(0));
    // Solo al abrir el panel: verificarMercadoPago y alPagar no cambian el resultado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alcanza = saldo != null && saldo >= contrato.monto;

  const pagarConSaldo = async () => {
    setEnviando(true);
    setError('');
    try {
      await api(`/api/pagos/contratos/${contrato.id}/saldo`, { method: 'POST' });
      alPagar(); // recarga el detalle: el contrato pasa a "en custodia"
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo pagar con tu saldo.');
    } finally {
      setEnviando(false);
      setConfirmandoSaldo(false);
    }
  };

  // Mercado Pago: el backend crea el pago y devuelve la URL de su página. Se
  // sale del sitio; al terminar, "Volver al sitio" trae a /pagos/retorno.
  const pagarConMercadoPago = async () => {
    setEnviando(true);
    setError('');
    try {
      const { url } = await api<{ url: string }>(`/api/pagos/contratos/${contrato.id}/mercadopago`, { method: 'POST' });
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar el pago con Mercado Pago.');
      setEnviando(false);
    }
  };

  return (
    <div className="pago-contrato">
      <div className="pago-contrato__cabecera">
        <strong>Paga {usd(contrato.monto)}</strong>
        <span>antes de {fechaCorta(contrato.fecha_limite_pago)}</span>
      </div>
      <p className="pago-contrato__nota">
        Tu dinero queda en custodia en BidHouse: el vendedor lo recibe solo cuando confirmes que te llegó el activo.
      </p>

      {error && <p className="pago-contrato__error">{error}</p>}

      {confirmandoSaldo ? (
        <div className="pago-contrato__confirmar">
          <p>Se descontarán <strong>{usd(contrato.monto)}</strong> de tu saldo.</p>
          <div className="pago-contrato__acciones">
            <button type="button" className="detail-button detail-button--secondary" onClick={() => setConfirmandoSaldo(false)} disabled={enviando}>
              Cancelar
            </button>
            <button type="button" className="detail-button detail-button--primary" onClick={pagarConSaldo} disabled={enviando}>
              {enviando ? 'Pagando…' : 'Confirmar pago'}
            </button>
          </div>
        </div>
      ) : (
        <div className="pago-contrato__opciones">
          <button
            type="button"
            className="pago-contrato__opcion"
            onClick={() => setConfirmandoSaldo(true)}
            disabled={!alcanza || enviando}
          >
            <strong>Pagar con mi saldo</strong>
            <span>
              {saldo == null ? 'Consultando saldo…' : `Disponible: ${usd(saldo)}`}
              {saldo != null && !alcanza && ' · no alcanza'}
            </span>
          </button>
          <button type="button" className="pago-contrato__opcion" onClick={pagarConMercadoPago} disabled={enviando}>
            <strong>Pagar con Mercado Pago</strong>
            <span>Tarjeta o dinero de tu cuenta de Mercado Pago</span>
          </button>
        </div>
      )}
      <button
        type="button"
        className="pago-contrato__verificar"
        onClick={() => { setVerificando(true); verificarMercadoPago(); }}
        disabled={verificando}
      >
        {verificando ? 'Buscando tu pago…' : '¿Ya pagaste en Mercado Pago? Verificar'}
      </button>
      {saldo != null && !alcanza && (
        <p className="pago-contrato__nota">
          ¿Prefieres usar saldo? <Link to="/perfil">Recárgalo desde tu perfil</Link>.
        </p>
      )}
    </div>
  );
}

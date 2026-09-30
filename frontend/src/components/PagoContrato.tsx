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
  fecha_limite_envio?: string | null;
  guia_envio?: string | null;
  enviado_en?: string | null;
  fecha_limite_confirmacion?: string | null;
  liberado_en?: string | null;
  notas?: string | null;           // motivo de la disputa o de la cancelación
  rol: 'comprador' | 'vendedor';
}

const fechaCorta = (valor?: string | null) =>
  valor ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(valor)) : '';

// Qué ve comprador o vendedor en cada etapa del contrato
// (backend/sql/fase4_pagos.sql y fase4b_entrega.sql):
//   pendiente → en_custodia → enviado → completada   (o cancelada / en_disputa)
// Las acciones: el comprador paga, el vendedor marca el envío, el comprador
// confirma que le llegó (eso libera el pago) o reporta un problema.
export function PagoContrato({ contrato, alPagar }: { contrato: MiContrato; alPagar: () => void }) {
  const { rol, estado } = contrato;
  const neto = contrato.monto - (contrato.comision_plataforma ?? 0);

  if (rol === 'comprador') {
    switch (estado) {
      case 'pendiente':
        return <PagarContrato contrato={contrato} alPagar={alPagar} />;
      case 'en_custodia':
        return (
          <div className="pago-contrato">
            <p className="pago-contrato__texto">
              ✓ Pagaste. Tu dinero está en custodia. El vendedor tiene hasta el <strong>{fechaCorta(contrato.fecha_limite_envio)}</strong> para
              enviarlo; si no lo hace, te lo devolvemos a tu saldo.
            </p>
            <RecibirActivo contrato={contrato} alCambiar={alPagar} />
          </div>
        );
      case 'enviado':
        return (
          <div className="pago-contrato">
            <p className="pago-contrato__texto">
              📦 El vendedor lo envió el {fechaCorta(contrato.enviado_en)}: <strong>{contrato.guia_envio}</strong>.
              ¿Te llegó bien? Si no respondes antes del {fechaCorta(contrato.fecha_limite_confirmacion)}, se dará por recibido.
            </p>
            <RecibirActivo contrato={contrato} alCambiar={alPagar} />
          </div>
        );
      case 'completada':
        return <p className="pago-contrato__estado pago-contrato__estado--ok">✓ Compra completada. El pago se liberó al vendedor el {fechaCorta(contrato.liberado_en)}.</p>;
      case 'en_disputa':
        return <p className="pago-contrato__estado pago-contrato__estado--alerta">Reportaste un problema: “{contrato.notas}”. El dinero sigue retenido en custodia mientras BidHouse lo revisa.</p>;
      case 'cancelada':
        return <p className="pago-contrato__estado">Contrato cancelado. {contrato.notas}</p>;
    }
  } else {
    switch (estado) {
      case 'pendiente':
        return <p className="pago-contrato__estado">Esperando que el comprador pague (plazo: {fechaCorta(contrato.fecha_limite_pago)}).</p>;
      case 'en_custodia':
        return <MarcarEnviado contrato={contrato} neto={neto} alCambiar={alPagar} />;
      case 'enviado':
        return (
          <p className="pago-contrato__estado">
            📦 Enviado ({contrato.guia_envio}). Esperando que el comprador confirme que le llegó. Si no responde antes
            del {fechaCorta(contrato.fecha_limite_confirmacion)}, recibirás {usd(neto)} automáticamente.
          </p>
        );
      case 'completada':
        return <p className="pago-contrato__estado pago-contrato__estado--ok">✓ Pago liberado: se sumaron {usd(neto)} a tu saldo ({usd(contrato.comision_plataforma ?? 0)} de comisión).</p>;
      case 'en_disputa':
        return <p className="pago-contrato__estado pago-contrato__estado--alerta">El comprador reportó un problema: “{contrato.notas}”. El pago queda retenido mientras BidHouse lo revisa.</p>;
      case 'cancelada':
        return <p className="pago-contrato__estado">Contrato cancelado. {contrato.notas}</p>;
    }
  }
  return <p className="pago-contrato__estado">Estado del contrato: {estado}.</p>;
}

// ── Vendedor: marcar el envío ──
function MarcarEnviado({ contrato, neto, alCambiar }: { contrato: MiContrato; neto: number; alCambiar: () => void }) {
  const [guia, setGuia] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const marcar = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await api(`/api/contratos/${contrato.id}/envio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guia }),
      });
      alCambiar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo marcar el envío.');
      setEnviando(false);
    }
  };

  return (
    <form className="pago-contrato" onSubmit={marcar} noValidate>
      <p className="pago-contrato__texto">
        ✓ El comprador pagó y el dinero está en custodia. <strong>Envía el activo antes del {fechaCorta(contrato.fecha_limite_envio)}</strong>:
        cuando el comprador confirme que le llegó, recibirás {usd(neto)} en tu saldo.
      </p>
      <label className="pago-contrato__label" htmlFor="guia">Transportadora y número de guía (o cómo lo entregaste)</label>
      <input
        id="guia"
        className="pago-contrato__input"
        placeholder="Ej: Servientrega 2045 3321 0098"
        maxLength={200}
        value={guia}
        onChange={(e) => setGuia(e.target.value)}
      />
      {error && <p className="pago-contrato__error">{error}</p>}
      <button type="submit" className="detail-button detail-button--primary" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Marcar como enviado'}
      </button>
    </form>
  );
}

// ── Comprador: confirmar que llegó, o reportar un problema ──
// Confirmar libera el pago al vendedor y no se puede deshacer: va con doble clic.
function RecibirActivo({ contrato, alCambiar }: { contrato: MiContrato; alCambiar: () => void }) {
  const [modo, setModo] = useState<'botones' | 'confirmar' | 'problema'>('botones');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const enviar = async (ruta: string, cuerpo?: object) => {
    setEnviando(true);
    setError('');
    try {
      await api(`/api/contratos/${contrato.id}/${ruta}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
      alCambiar();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la acción.');
      setEnviando(false);
    }
  };

  if (modo === 'confirmar') {
    return (
      <div className="pago-contrato__confirmar">
        <p>Al confirmar, el pago se libera al vendedor. <strong>No se puede deshacer.</strong> ¿El activo llegó en buen estado?</p>
        {error && <p className="pago-contrato__error">{error}</p>}
        <div className="pago-contrato__acciones">
          <button type="button" className="detail-button detail-button--secondary" onClick={() => setModo('botones')} disabled={enviando}>Cancelar</button>
          <button type="button" className="detail-button detail-button--primary" onClick={() => enviar('recepcion')} disabled={enviando}>
            {enviando ? 'Confirmando…' : 'Sí, lo recibí'}
          </button>
        </div>
      </div>
    );
  }

  if (modo === 'problema') {
    return (
      <div className="pago-contrato__confirmar">
        <label className="pago-contrato__label" htmlFor="motivo">¿Qué pasó?</label>
        <textarea
          id="motivo"
          className="pago-contrato__input"
          rows={3}
          maxLength={500}
          placeholder="Ej: El reloj llegó con el cristal rayado y sin la caja original."
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        <p className="pago-contrato__nota">El pago queda retenido y no se libera al vendedor mientras se revisa.</p>
        {error && <p className="pago-contrato__error">{error}</p>}
        <div className="pago-contrato__acciones">
          <button type="button" className="detail-button detail-button--secondary" onClick={() => setModo('botones')} disabled={enviando}>Cancelar</button>
          <button type="button" className="detail-button detail-button--primary" onClick={() => enviar('problema', { motivo })} disabled={enviando}>
            {enviando ? 'Enviando…' : 'Reportar problema'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pago-contrato__opciones">
      <button type="button" className="pago-contrato__opcion" onClick={() => setModo('confirmar')}>
        <strong>Lo recibí bien</strong>
        <span>Libera el pago al vendedor</span>
      </button>
      <button type="button" className="pago-contrato__opcion" onClick={() => setModo('problema')}>
        <strong>Tengo un problema</strong>
        <span>El pago queda retenido</span>
      </button>
    </div>
  );
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

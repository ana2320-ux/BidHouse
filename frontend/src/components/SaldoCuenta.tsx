import { useEffect, useState } from 'react';
import { api, ApiError, usd } from '../api';
import './SaldoCuenta.css';

// GET /api/pagos/saldo (ServicioPagos.saldo()).
interface Saldo {
  disponible: number;
  porLiberar: number;
  movimientos: { id: string; tipo: string; monto: number; descripcion: string; creado_en: string }[];
}

const MINIMO = 1000; // igual que ServicioPagos.RECARGA_MINIMA

// Saldo de BidHouse en el perfil: cuánto hay, cuánto está por llegar de
// ventas en custodia, recargar con Mercado Pago y el extracto.
export function SaldoCuenta() {
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [error, setError] = useState('');
  const [recargando, setRecargando] = useState(false);
  const [monto, setMonto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  // Arranca en true: al abrir el perfil ya se está verificando. (Si se
  // pusiera en true dentro del efecto, React redibujaría una vez de más.)
  const [verificando, setVerificando] = useState(true);

  // Primero se buscan en Mercado Pago recargas pagadas que aún no se
  // registraron (Mercado Pago no devuelve a localhost después de pagar), y
  // después se lee el saldo, que ya las incluye. Va como cadena de promesas:
  // así todo cambio de estado ocurre dentro de un callback, nunca de forma
  // síncrona dentro del efecto.
  const cargar = () =>
    api<{ nuevos: number }>('/api/pagos/sincronizar', { method: 'POST' })
      .then(({ nuevos }) => {
        if (nuevos > 0) {
          setAviso(`Encontramos ${nuevos} pago${nuevos === 1 ? '' : 's'} nuevo${nuevos === 1 ? '' : 's'} en Mercado Pago y ya se reflejó en tu saldo.`);
        }
      })
      .catch(() => {
        // Si Mercado Pago no responde, igual se muestra el saldo que hay.
      })
      .then(() => api<Saldo>('/api/pagos/saldo'))
      .then(setSaldo)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar tu saldo.'))
      .finally(() => setVerificando(false));

  useEffect(() => {
    cargar();
  }, []);

  const verificarOtraVez = () => {
    setVerificando(true);
    setAviso('');
    cargar();
  };

  // Crea el pago en Mercado Pago y se va a su página. Al volver,
  // /pagos/retorno verifica el pago y suma el saldo.
  const recargar = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const valor = Number(monto);
    if (!Number.isFinite(valor) || valor < MINIMO) {
      setError(`La recarga mínima es ${usd(MINIMO)}.`);
      return;
    }
    setEnviando(true);
    setError('');
    try {
      const { url } = await api<{ url: string }>('/api/pagos/recargas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto: valor }),
      });
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar la recarga.');
      setEnviando(false);
    }
  };

  return (
    <section className="saldo">
      <div className="saldo__cifras">
        <div>
          <span className="stat-label">SALDO DISPONIBLE</span>
          <h3 className="stat-value">{saldo ? usd(saldo.disponible) : '…'}</h3>
          <p className="stat-desc">Úsalo para pagar tus compras al instante</p>
        </div>
        <div>
          <span className="stat-label">POR LIBERAR</span>
          <h3 className="stat-value saldo__por-liberar">{saldo ? usd(saldo.porLiberar) : '…'}</h3>
          <p className="stat-desc">Ventas pagadas que siguen en custodia</p>
        </div>
        <div className="saldo__accion">
          {recargando ? (
            <form className="saldo__form" onSubmit={recargar} noValidate>
              <label htmlFor="monto-recarga">Monto a recargar (USD)</label>
              <input
                id="monto-recarga"
                type="number"
                min={MINIMO}
                step="any"
                placeholder={String(MINIMO)}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                autoFocus
              />
              <div className="saldo__botones">
                <button type="button" className="saldo__cancelar" onClick={() => setRecargando(false)} disabled={enviando}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn--primary saldo__recargar" disabled={enviando}>
                  {enviando ? 'Abriendo Mercado Pago…' : 'Ir a pagar'}
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className="btn btn--primary saldo__recargar" onClick={() => { setError(''); setRecargando(true); }}>
              + Recargar saldo
            </button>
          )}
          <p className="saldo__ayuda">Con tarjeta o dinero de tu cuenta de Mercado Pago.</p>
          <button type="button" className="saldo__verificar" onClick={verificarOtraVez} disabled={verificando}>
            {verificando ? 'Verificando pagos…' : '¿Ya pagaste? Verificar pagos'}
          </button>
        </div>
      </div>

      {aviso && <p className="saldo__aviso">{aviso}</p>}
      {error && <p className="saldo__error">{error}</p>}

      {saldo && saldo.movimientos.length > 0 && (
        <ul className="saldo__movimientos">
          {saldo.movimientos.slice(0, 5).map((m) => (
            <li key={m.id}>
              <span>
                {m.descripcion}
                <small>{new Date(m.creado_en).toLocaleString('es-CO')}</small>
              </span>
              <strong className={m.monto >= 0 ? 'saldo__entra' : 'saldo__sale'}>
                {m.monto >= 0 ? '+' : '−'}{usd(Math.abs(m.monto))}
              </strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

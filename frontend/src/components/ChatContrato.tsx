import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import './ChatContrato.css';

interface Mensaje {
  id: string;
  texto: string;
  creado_en: string;
  esMio: boolean;
}

const hora = (valor: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor));

// Chat entre comprador y vendedor de un contrato (backend/sql/fase7_chat.sql).
// Sirve para acordar entrega, dirección o dudas del pago. El backend revisa que
// quien pide sea parte del contrato; aquí solo se pinta.
// ponytail: polling cada 10 s, como el detalle; pasar a Supabase Realtime si hace falta inmediatez.
export function ChatContrato({ contratoId, rol }: { contratoId: string; rol: 'comprador' | 'vendedor' }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const lista = useRef<HTMLDivElement>(null);
  const otro = rol === 'comprador' ? 'vendedor' : 'comprador';

  useEffect(() => {
    let vivo = true;
    const cargar = () =>
      api<Mensaje[]>(`/api/contratos/${contratoId}/mensajes`)
        .then((m) => vivo && setMensajes(m))
        .catch((e) => vivo && setError(e instanceof ApiError ? e.message : 'No se pudo cargar el chat.'));
    cargar();
    const t = window.setInterval(cargar, 10_000);
    return () => {
      vivo = false;
      window.clearInterval(t);
    };
  }, [contratoId]);

  // Bajar al último mensaje cuando llega uno nuevo.
  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight });
  }, [mensajes.length]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    setError('');
    try {
      const nuevo = await api<Mensaje>(`/api/contratos/${contratoId}/mensajes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: limpio }),
      });
      setMensajes((m) => [...m, nuevo]);
      setTexto('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo enviar el mensaje.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="chat-contrato" aria-label={`Chat con el ${otro}`}>
      <header className="chat-contrato__cabecera">
        <strong>💬 Chat con el {otro}</strong>
        <span>Acuerden aquí la entrega. Por seguridad, nunca pagues por fuera de BidLuxury.</span>
      </header>

      <div className="chat-contrato__lista" ref={lista} aria-live="polite">
        {mensajes.length === 0 ? (
          <p className="chat-contrato__vacio">Todavía no hay mensajes. Escríbele al {otro} para coordinar.</p>
        ) : (
          mensajes.map((m) => (
            <div key={m.id} className={`chat-contrato__burbuja ${m.esMio ? 'chat-contrato__burbuja--mia' : ''}`}>
              <p>{m.texto}</p>
              <time dateTime={m.creado_en}>{m.esMio ? 'Tú' : otro[0].toUpperCase() + otro.slice(1)} · {hora(m.creado_en)}</time>
            </div>
          ))
        )}
      </div>

      {error && <p className="chat-contrato__error" role="alert">{error}</p>}

      <form className="chat-contrato__form" onSubmit={enviar}>
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={1000}
          placeholder={`Escribe al ${otro}…`}
          aria-label="Mensaje"
        />
        <button type="submit" disabled={enviando || !texto.trim()}>
          {enviando ? '…' : 'Enviar'}
        </button>
      </form>
    </section>
  );
}

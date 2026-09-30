// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Registro público de los contratos de garantía de BidHouse (red de pruebas Sepolia).
///
/// Qué hace y qué NO hace:
///  - NO guarda dinero: el dinero está en Mercado Pago / en los saldos de BidHouse.
///  - Guarda cada acuerdo y sus hitos (pagado, enviado, liberado, cancelado,
///    disputa) de forma pública e inalterable, y define la regla de cuándo se
///    puede liberar el pago. Cualquiera puede verificarlo en Etherscan.
///  - NO guarda datos personales (la cadena es pública y permanente): solo el
///    id del acuerdo y una "huella" (hash) de sus datos.
///
/// Solo el operador (la billetera del backend de BidHouse) puede escribir.
contract RegistroBidHouse {
    enum Estado { NoExiste, EnCustodia, Enviado, Liberado, Cancelado, EnDisputa }

    struct Acuerdo {
        bytes32 huella;             // keccak256 de los datos del contrato de garantía
        uint256 montoCentavos;      // monto en centavos de USD (la cadena no maneja decimales)
        uint64 limiteEnvio;         // hasta cuándo el vendedor puede enviar (unix)
        uint64 limiteConfirmacion;  // desde cuándo se libera solo si el comprador no responde
        Estado estado;
    }

    /// Días que tiene el comprador para confirmar antes de que se libere solo.
    uint64 public constant PLAZO_CONFIRMACION = 7 days;

    address public immutable operador;
    mapping(bytes32 => Acuerdo) public acuerdos;

    /// Un evento por hito: es lo que se ve en Etherscan como historial del acuerdo.
    event Hito(bytes32 indexed acuerdo, Estado estado, uint64 fecha);

    error SoloOperador();
    error YaRegistrado();
    error EstadoInvalido(Estado actual);
    error PlazoNoCumplido(uint64 liberableDesde);

    constructor() {
        operador = msg.sender;
    }

    modifier soloOperador() {
        if (msg.sender != operador) revert SoloOperador();
        _;
    }

    /// El comprador pagó y el dinero quedó en custodia.
    function registrarPago(bytes32 id, bytes32 huella, uint256 montoCentavos, uint64 limiteEnvio) external soloOperador {
        if (acuerdos[id].estado != Estado.NoExiste) revert YaRegistrado();
        acuerdos[id] = Acuerdo(huella, montoCentavos, limiteEnvio, 0, Estado.EnCustodia);
        emit Hito(id, Estado.EnCustodia, uint64(block.timestamp));
    }

    /// El vendedor envió el activo. Desde aquí corre el plazo de confirmación.
    function registrarEnvio(bytes32 id) external soloOperador {
        Acuerdo storage a = acuerdos[id];
        if (a.estado != Estado.EnCustodia) revert EstadoInvalido(a.estado);
        a.estado = Estado.Enviado;
        a.limiteConfirmacion = uint64(block.timestamp) + PLAZO_CONFIRMACION;
        emit Hito(id, Estado.Enviado, uint64(block.timestamp));
    }

    /// La regla de liberación vive aquí, a la vista de todos: el pago solo se
    /// libera si el comprador confirmó que recibió el activo, o si ya se envió
    /// y pasó el plazo de confirmación sin que respondiera.
    function liberar(bytes32 id, bool compradorConfirmo) external soloOperador {
        Acuerdo storage a = acuerdos[id];
        if (a.estado != Estado.EnCustodia && a.estado != Estado.Enviado) revert EstadoInvalido(a.estado);
        if (!compradorConfirmo) {
            if (a.estado != Estado.Enviado) revert EstadoInvalido(a.estado);
            if (block.timestamp < a.limiteConfirmacion) revert PlazoNoCumplido(a.limiteConfirmacion);
        }
        a.estado = Estado.Liberado;
        emit Hito(id, Estado.Liberado, uint64(block.timestamp));
    }

    /// El vendedor no envió a tiempo: se cancela y se reembolsa al comprador.
    function cancelar(bytes32 id) external soloOperador {
        Acuerdo storage a = acuerdos[id];
        if (a.estado != Estado.EnCustodia) revert EstadoInvalido(a.estado);
        a.estado = Estado.Cancelado;
        emit Hito(id, Estado.Cancelado, uint64(block.timestamp));
    }

    /// El comprador reportó un problema: el pago queda congelado.
    function abrirDisputa(bytes32 id) external soloOperador {
        Acuerdo storage a = acuerdos[id];
        if (a.estado != Estado.EnCustodia && a.estado != Estado.Enviado) revert EstadoInvalido(a.estado);
        a.estado = Estado.EnDisputa;
        emit Hito(id, Estado.EnDisputa, uint64(block.timestamp));
    }

    /// Para verificar desde afuera: ¿este acuerdo ya cumple la regla de liberación
    /// por tiempo (enviado y vencido el plazo de confirmación)?
    function liberablePorTiempo(bytes32 id) external view returns (bool) {
        Acuerdo storage a = acuerdos[id];
        return a.estado == Estado.Enviado && block.timestamp >= a.limiteConfirmacion;
    }
}

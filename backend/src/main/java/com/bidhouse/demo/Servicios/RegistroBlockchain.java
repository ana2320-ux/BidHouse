package com.bidhouse.demo.Servicios;

import java.io.IOException;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.datatypes.Bool;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.generated.Bytes32;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.abi.datatypes.generated.Uint64;
import org.web3j.crypto.Credentials;
import org.web3j.crypto.Hash;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.response.EthSendTransaction;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.protocol.http.HttpService;
import org.web3j.tx.RawTransactionManager;
import org.web3j.tx.response.PollingTransactionReceiptProcessor;

// Escribe en el contrato RegistroBidHouse de Sepolia
// (blockchain/contratos/RegistroBidHouse.sol) firmando con la billetera del
// backend. Cada método es una función del contrato; cada llamada es una
// transacción que tarda unos 12 s en quedar en un bloque.
//
// Configuración en backend/.env (la crean los scripts de blockchain/):
//   BLOCKCHAIN_PRIVATE_KEY, BLOCKCHAIN_RPC_URL, BLOCKCHAIN_CONTRACT_ADDRESS.
// Si falta alguna, activo() es false y el backend simplemente no registra.
@Component
public class RegistroBlockchain {

    static final long SEPOLIA = 11155111L;
    // Suficiente para cualquier función del contrato (usan ~50-100 mil).
    private static final BigInteger GAS_MAXIMO = BigInteger.valueOf(300_000);

    private final Web3j red;
    private final RawTransactionManager firmante;
    private final String contrato;
    private final boolean activo;

    public RegistroBlockchain(@Value("${blockchain.private-key}") String llave,
                              @Value("${blockchain.rpc-url}") String rpc,
                              @Value("${blockchain.contract-address}") String contrato) {
        this.activo = !llave.isBlank() && !rpc.isBlank() && !contrato.isBlank();
        this.contrato = contrato;
        if (activo) {
            Web3j nodo = Web3j.build(new HttpService(rpc));
            this.red = nodo;
            // chainId en la firma: una transacción firmada para Sepolia no sirve en otra red.
            this.firmante = new RawTransactionManager(nodo, Credentials.create(llave), SEPOLIA) {
                // Cada transacción lleva un número de orden (nonce) y la red las
                // procesa en ese orden. web3j usa el de las "pendientes"; aquí se
                // usa el de las CONFIRMADAS: si una anterior quedó atascada, la
                // siguiente toma su lugar con mejor precio y la reemplaza, en vez
                // de quedarse en fila detrás de ella. Es seguro porque solo un
                // backend firma y las transacciones van de a una.
                @Override
                protected BigInteger getNonce() throws IOException {
                    return nodo.ethGetTransactionCount(getFromAddress(), DefaultBlockParameterName.LATEST)
                            .send().getTransactionCount();
                }
            };
        } else {
            this.red = null;
            this.firmante = null;
        }
    }

    public boolean activo() {
        return activo;
    }

    public String direccionContrato() {
        return contrato;
    }

    // El id del acuerdo en la cadena: hash del id del contrato de garantía.
    // Así no se publica el uuid tal cual, y el mismo contrato siempre da el mismo id.
    static byte[] idAcuerdo(String idTransaccion) {
        return Hash.sha3(("bidhouse:transaccion:" + idTransaccion).getBytes(StandardCharsets.UTF_8));
    }

    // "Huella" de los datos del acuerdo: permite verificar después que no
    // cambiaron, sin publicar datos personales (solo ids, monto y fecha).
    static byte[] huella(String idTransaccion, String idSubasta, BigInteger montoCentavos, String pagadoEn) {
        String datos = String.join("|", "bidhouse", idTransaccion, idSubasta, montoCentavos.toString(), pagadoEn);
        return Hash.sha3(datos.getBytes(StandardCharsets.UTF_8));
    }

    public String registrarPago(String idTransaccion, byte[] huella, BigInteger montoCentavos, long limiteEnvio) {
        return enviar(new Function("registrarPago", List.<Type>of(
                new Bytes32(idAcuerdo(idTransaccion)), new Bytes32(huella),
                new Uint256(montoCentavos), new Uint64(limiteEnvio)), List.of()));
    }

    public String registrarEnvio(String idTransaccion) {
        return enviar(new Function("registrarEnvio", List.<Type>of(new Bytes32(idAcuerdo(idTransaccion))), List.of()));
    }

    public String liberar(String idTransaccion, boolean compradorConfirmo) {
        return enviar(new Function("liberar", List.<Type>of(
                new Bytes32(idAcuerdo(idTransaccion)), new Bool(compradorConfirmo)), List.of()));
    }

    public String cancelar(String idTransaccion) {
        return enviar(new Function("cancelar", List.<Type>of(new Bytes32(idAcuerdo(idTransaccion))), List.of()));
    }

    public String abrirDisputa(String idTransaccion) {
        return enviar(new Function("abrirDisputa", List.<Type>of(new Bytes32(idAcuerdo(idTransaccion))), List.of()));
    }

    // Firma y envía la transacción, y espera a que entre en un bloque. Devuelve
    // su hash. Si el contrato la rechaza (una regla no se cumple), lanza error.
    private String enviar(Function funcion) {
        if (!activo) throw new IllegalStateException("Blockchain no configurada");
        try {
            // Precio del gas: el doble de lo que pide la red. Si se ofrece justo lo
            // que dice eth_gasPrice y la tarifa base sube un poco antes del siguiente
            // bloque, la transacción queda atascada (pasó en la primera prueba). En
            // Sepolia el ETH es de prueba: pagar de más no cuesta nada real.
            BigInteger sugerido = red.ethGasPrice().send().getGasPrice();
            BigInteger tarifaBase = red.ethGetBlockByNumber(DefaultBlockParameterName.LATEST, false)
                    .send().getBlock().getBaseFeePerGas();
            BigInteger precioGas = sugerido.max(tarifaBase == null ? BigInteger.ZERO : tarifaBase)
                    .multiply(BigInteger.TWO);
            EthSendTransaction envio = firmante.sendTransaction(
                    precioGas, GAS_MAXIMO, contrato, FunctionEncoder.encode(funcion), BigInteger.ZERO);
            if (envio.hasError()) {
                throw new IllegalStateException("La red rechazó la transacción: " + envio.getError().getMessage());
            }
            // Revisa cada 3 s, hasta 2 minutos.
            TransactionReceipt recibo = new PollingTransactionReceiptProcessor(red, 3000, 40)
                    .waitForTransactionReceipt(envio.getTransactionHash());
            if (!recibo.isStatusOK()) {
                throw new IllegalStateException("El contrato rechazó " + funcion.getName()
                        + " (tx " + recibo.getTransactionHash() + ")");
            }
            return recibo.getTransactionHash();
        } catch (IOException | org.web3j.protocol.exceptions.TransactionException e) {
            throw new IllegalStateException("No se pudo hablar con la red Sepolia: " + e.getMessage(), e);
        }
    }

    // Saldo de la billetera (en wei), para avisar si se queda sin ETH de prueba.
    public Optional<BigInteger> saldoOperador() {
        if (!activo) return Optional.empty();
        try {
            return Optional.of(red.ethGetBalance(firmante.getFromAddress(), DefaultBlockParameterName.LATEST)
                    .send().getBalance());
        } catch (IOException e) {
            return Optional.empty();
        }
    }
}

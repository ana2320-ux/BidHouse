// Lee directamente de la red Sepolia lo que el contrato guardó sobre uno o
// varios contratos de garantía. Sirve para demostrar que el registro es
// público: no pasa por el backend ni por la base de datos.
//   bun run verificar <id-de-la-transaccion> [otro-id ...]
import { Contract, JsonRpcProvider, keccak256, toUtf8Bytes, formatEther } from 'ethers';
import { readFileSync } from 'node:fs';
import { leerEnv } from './entorno.ts';

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error('Uso: bun run verificar <id-de-la-transaccion> [otro-id ...]');
  process.exit(1);
}

const env = leerEnv();
const red = new JsonRpcProvider(env.BLOCKCHAIN_RPC_URL);
const { abi } = JSON.parse(readFileSync(new URL('../../backend/src/main/resources/blockchain/RegistroBidHouse.json', import.meta.url), 'utf8'));
const contrato = new Contract(env.BLOCKCHAIN_CONTRACT_ADDRESS, abi, red);
const ESTADOS = ['NoExiste', 'EnCustodia', 'Enviado', 'Liberado', 'Cancelado', 'EnDisputa'];

console.log('Contrato:', env.BLOCKCHAIN_CONTRACT_ADDRESS, '| operador:', await contrato.operador());
for (const id of ids) {
  // Mismo id que usa el backend (RegistroBlockchain.idAcuerdo()).
  const a = await contrato.acuerdos(keccak256(toUtf8Bytes('bidhouse:transaccion:' + id)));
  const limite = Number(a.limiteConfirmacion);
  console.log(`${id} → ${ESTADOS[Number(a.estado)]} | ${Number(a.montoCentavos) / 100} USD`
    + (limite ? ` | se libera solo desde ${new Date(limite * 1000).toLocaleString('es-CO')}` : ''));
}

const operador = await contrato.operador();
const confirmado = await red.getTransactionCount(operador, 'latest');
const pendiente = await red.getTransactionCount(operador, 'pending');
console.log(`Billetera: ${formatEther(await red.getBalance(operador))} ETH de prueba`
  + (pendiente > confirmado ? ` | ⚠️ ${pendiente - confirmado} transacción(es) sin confirmar` : ' | nada atascado'));

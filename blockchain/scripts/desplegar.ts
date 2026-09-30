// Despliega RegistroBidHouse en Sepolia con la billetera de backend/.env y
// guarda la dirección del contrato en backend/.env (BLOCKCHAIN_CONTRACT_ADDRESS).
// Se hace UNA sola vez: el mismo contrato registra todos los acuerdos.
//   bun run compilar && bun run desplegar
import { ContractFactory, JsonRpcProvider, Wallet, formatEther } from 'ethers';
import { readFileSync } from 'node:fs';
import { escribirEnv, leerEnv } from './entorno.ts';

const env = leerEnv();
if (!env.BLOCKCHAIN_PRIVATE_KEY || !env.BLOCKCHAIN_RPC_URL) {
  console.error('Falta la billetera: corre primero "bun run billetera".');
  process.exit(1);
}
if (env.BLOCKCHAIN_CONTRACT_ADDRESS) {
  console.log('Ya hay un contrato desplegado:', env.BLOCKCHAIN_CONTRACT_ADDRESS);
  console.log('Si de verdad quieres otro, borra BLOCKCHAIN_CONTRACT_ADDRESS de backend/.env.');
  process.exit(0);
}

const red = new JsonRpcProvider(env.BLOCKCHAIN_RPC_URL);
const billetera = new Wallet(env.BLOCKCHAIN_PRIVATE_KEY, red);
const saldo = await red.getBalance(billetera.address);
console.log('Operador:', billetera.address, '| saldo:', formatEther(saldo), 'ETH de prueba');
if (saldo === 0n) {
  console.error('La billetera no tiene ETH de prueba: pásala por un faucet de Sepolia.');
  process.exit(1);
}

const compilado = JSON.parse(readFileSync(new URL('../../backend/src/main/resources/blockchain/RegistroBidHouse.json', import.meta.url), 'utf8'));
const fabrica = new ContractFactory(compilado.abi, compilado.bytecode, billetera);
const contrato = await fabrica.deploy();
console.log('Desplegando… transacción', contrato.deploymentTransaction()?.hash);
await contrato.waitForDeployment();
const direccion = await contrato.getAddress();

escribirEnv('BLOCKCHAIN_CONTRACT_ADDRESS', direccion, 'Contrato RegistroBidHouse en Sepolia (se despliega una vez).');
const recibo = await contrato.deploymentTransaction()?.wait();
if (recibo) {
  escribirEnv('BLOCKCHAIN_CONTRACT_BLOCK', String(recibo.blockNumber),
    'Bloque donde se desplegó el contrato (desde ahí se buscan sus eventos).');
}
console.log('Contrato desplegado:', direccion);
console.log('Verlo en Etherscan: https://sepolia.etherscan.io/address/' + direccion);

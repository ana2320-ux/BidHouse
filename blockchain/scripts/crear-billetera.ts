// Crea la billetera del operador (el backend) y guarda su llave privada en
// backend/.env. Nunca la imprime: solo muestra la dirección PÚBLICA, que es
// la que se pega en el faucet para recibir ETH de prueba.
//   bun run billetera
import { Wallet } from 'ethers';
import { escribirEnv, leerEnv } from './entorno.ts';

const env = leerEnv();
if (env.BLOCKCHAIN_PRIVATE_KEY) {
  const existente = new Wallet(env.BLOCKCHAIN_PRIVATE_KEY);
  console.log('Ya hay una billetera en backend/.env. Dirección pública:', existente.address);
  process.exit(0);
}

const billetera = Wallet.createRandom();
escribirEnv('BLOCKCHAIN_PRIVATE_KEY', billetera.privateKey,
  'Billetera del backend en Sepolia (SOLO red de pruebas; nunca poner dinero real). Secreta.');
if (!env.BLOCKCHAIN_RPC_URL) {
  escribirEnv('BLOCKCHAIN_RPC_URL', 'https://ethereum-sepolia-rpc.publicnode.com',
    'Nodo de la red Sepolia (público, sin llave).');
}
console.log('Billetera creada y guardada en backend/.env.');
console.log('Dirección pública (pégala en el faucet):', billetera.address);

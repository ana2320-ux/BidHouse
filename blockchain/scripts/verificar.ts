// Lee directamente de la red Sepolia (sin pasar por el backend ni por la base
// de datos) la billetera del operador y lo que el contrato tiene registrado.
// Sirve para demostrar que el registro es público.
//   bun run verificar                 → billetera + todos los acuerdos registrados
//   bun run verificar <id> [<id>...]  → estado de contratos de garantía puntuales
import { Contract, JsonRpcProvider, keccak256, toUtf8Bytes, formatEther } from 'ethers';
import { readFileSync } from 'node:fs';
import { leerEnv } from './entorno.ts';

const env = leerEnv();
const red = new JsonRpcProvider(env.BLOCKCHAIN_RPC_URL);
const { abi } = JSON.parse(readFileSync(new URL('../../backend/src/main/resources/blockchain/RegistroBidHouse.json', import.meta.url), 'utf8'));
const contrato = new Contract(env.BLOCKCHAIN_CONTRACT_ADDRESS, abi, red);
const ESTADOS = ['NoExiste', 'EnCustodia', 'Enviado', 'Liberado', 'Cancelado', 'EnDisputa'];
const fecha = (s: number) => new Date(s * 1000).toLocaleString('es-CO');

// ── Billetera ──
const operador: string = await contrato.operador();
const confirmado = await red.getTransactionCount(operador, 'latest');
const pendiente = await red.getTransactionCount(operador, 'pending');
console.log('BILLETERA DEL OPERADOR');
console.log(`  ${operador}`);
console.log(`  Saldo: ${formatEther(await red.getBalance(operador))} ETH de prueba · ${confirmado} transacciones enviadas`
  + (pendiente > confirmado ? ` · ⚠️ ${pendiente - confirmado} sin confirmar` : ''));
console.log(`  https://sepolia.etherscan.io/address/${operador}`);
console.log('\nCONTRATO RegistroBidHouse');
console.log(`  ${env.BLOCKCHAIN_CONTRACT_ADDRESS}`);
console.log(`  https://sepolia.etherscan.io/address/${env.BLOCKCHAIN_CONTRACT_ADDRESS}`);

const ids = process.argv.slice(2);
if (ids.length > 0) {
  console.log('\nACUERDOS CONSULTADOS');
  for (const id of ids) {
    // Mismo id que usa el backend (RegistroBlockchain.idAcuerdo()).
    const a = await contrato.acuerdos(keccak256(toUtf8Bytes('bidhouse:transaccion:' + id)));
    console.log(`  ${id} → ${ESTADOS[Number(a.estado)]} · ${Number(a.montoCentavos) / 100} USD`);
  }
  process.exit(0);
}

// ── Todos los acuerdos, a partir de los eventos "Hito" del contrato ──
// En la cadena el id es un hash: a propósito no dice qué se vendió ni a quién.
const desde = Number(env.BLOCKCHAIN_CONTRACT_BLOCK || 0);
const eventos = [];
const actual = await red.getBlockNumber();
for (let inicio = desde; inicio <= actual; inicio += 50_000) {   // los nodos públicos limitan el rango por consulta
  eventos.push(...await contrato.queryFilter(contrato.filters.Hito(), inicio, Math.min(inicio + 49_999, actual)));
}
const porAcuerdo = new Map<string, { estado: number; fecha: number }[]>();
for (const e of eventos) {
  const [id, estado, cuando] = (e as { args: [string, bigint, bigint] }).args;
  const lista = porAcuerdo.get(id) ?? [];
  lista.push({ estado: Number(estado), fecha: Number(cuando) });
  porAcuerdo.set(id, lista);
}
console.log(`\nACUERDOS REGISTRADOS: ${porAcuerdo.size} (${eventos.length} hitos)`);
for (const [id, hitos] of porAcuerdo) {
  const a = await contrato.acuerdos(id);
  console.log(`  ${id.slice(0, 10)}…${id.slice(-6)} · ${Number(a.montoCentavos) / 100} USD · ahora: ${ESTADOS[Number(a.estado)]}`);
  for (const h of hitos) console.log(`      ${fecha(h.fecha)}  ${ESTADOS[h.estado]}`);
}

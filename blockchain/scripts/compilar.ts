// Compila contratos/RegistroBidHouse.sol y deja el ABI y el bytecode donde
// los leen el backend (para llamar al contrato) y desplegar.ts.
//   bun run compilar
import solc from 'solc';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const fuente = readFileSync(new URL('../contratos/RegistroBidHouse.sol', import.meta.url), 'utf8');
const entrada = {
  language: 'Solidity',
  sources: { 'RegistroBidHouse.sol': { content: fuente } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    // "paris": evita opcodes nuevos que algunas redes/herramientas aún no soportan.
    evmVersion: 'paris',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};

const salida = JSON.parse(solc.compile(JSON.stringify(entrada)));
const errores = (salida.errors ?? []).filter((e: { severity: string }) => e.severity === 'error');
if (errores.length) {
  for (const e of errores) console.error(e.formattedMessage);
  process.exit(1);
}

const contrato = salida.contracts['RegistroBidHouse.sol'].RegistroBidHouse;
const destino = new URL('../../backend/src/main/resources/blockchain/', import.meta.url);
mkdirSync(destino, { recursive: true });
writeFileSync(new URL('RegistroBidHouse.json', destino), JSON.stringify({
  compilador: solc.version(),
  abi: contrato.abi,
  bytecode: '0x' + contrato.evm.bytecode.object,
}, null, 2));
console.log(`Compilado con solc ${solc.version()} → backend/src/main/resources/blockchain/RegistroBidHouse.json`);

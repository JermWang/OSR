// Compiles the OSR contracts with solc and writes ABIs + bytecode to
// contracts/out/. Run: node contracts/compile.mjs
import solc from 'solc';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(here, 'src');
const outDir = path.join(here, 'out');

const sources = {};
for (const file of fs.readdirSync(srcDir).filter((f) => f.endsWith('.sol'))) {
  sources[file] = { content: fs.readFileSync(path.join(srcDir, file), 'utf8') };
}

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'paris',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};

// Imports are same-directory, so resolve straight out of src/.
const findImport = (importPath) => {
  const p = path.join(srcDir, path.basename(importPath));
  return fs.existsSync(p)
    ? { contents: fs.readFileSync(p, 'utf8') }
    : { error: `not found: ${importPath}` };
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));

const errors = (output.errors ?? []).filter((e) => e.severity === 'error');
const warnings = (output.errors ?? []).filter((e) => e.severity === 'warning');

for (const w of warnings) console.log(`WARN  ${w.formattedMessage.trim()}`);
for (const e of errors) console.error(`ERROR ${e.formattedMessage.trim()}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s) — compilation failed.`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
let count = 0;
for (const [file, contracts] of Object.entries(output.contracts ?? {})) {
  for (const [name, c] of Object.entries(contracts)) {
    const size = (c.evm?.bytecode?.object?.length ?? 0) / 2;
    if (size === 0) continue; // interfaces / abstract bases
    fs.writeFileSync(
      path.join(outDir, `${name}.json`),
      JSON.stringify({ abi: c.abi, bytecode: `0x${c.evm.bytecode.object}` }, null, 2)
    );
    console.log(`OK    ${name.padEnd(14)} ${String(size).padStart(6)} bytes  (${file})`);
    count += 1;
  }
}
console.log(`\nCompiled ${count} contract(s) with ${warnings.length} warning(s).`);

// Refresh the data files the board generators read, from a built index.html.
// Usage (from the repo root):
//   git show origin/main:index.html > /tmp/index_main.html
//   node design/redesign-2026-09/gen/extract_site_data.mjs /tmp/index_main.html
// Writes into design/redesign-2026-09/data/.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const src = fs.readFileSync(process.argv[2] || 'index.html', 'utf8').split('\n');
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');

// Finds `const NAME = [` or `const NAME = {` at the start of a line and returns the literal.
function grab(name) {
  const at = src.findIndex(l => new RegExp(`^\\s*const ${name} = [\\[{]`).test(l));
  if (at < 0) throw new Error(`const ${name} not found`);
  let s = '', depth = 0, started = false;
  for (let i = at; i < src.length; i++) {
    s += src[i] + '\n';
    for (const ch of src[i]) {
      if (ch === '[' || ch === '{') { depth++; started = true; }
      else if (ch === ']' || ch === '}') depth--;
    }
    if (started && depth === 0) break;
  }
  return eval('(' + s.replace(/^\s*const \w+ = /, '').replace(/;\s*$/, '') + ')');
}

const write = (file, obj) => fs.writeFileSync(path.join(out, file), JSON.stringify(obj));
write('tpp_series.json', { agg2pp: grab('agg2pp'), synth2pp: grab('synth2pp'), synthOn: grab('synthOn'), flowSens: grab('flowSens'), alt2pp: grab('alt2pp') });
write('individualPolls.json', grab('individualPolls'));
write('issues_main.json', grab('issues'));
write('direction.json', { dir: grab('direction'), polls: grab('directionPolls'), now: grab('directionNow') });
console.log('wrote', out);

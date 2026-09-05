# Vendored libraries

No bundler, no npm for these — they're copied in by hand so the build is
`node build.mjs` and nothing more. Record versions here when one is swapped;
verify with the probe lines below.

| File | Package | Version | Probe |
| --- | --- | --- | --- |
| react.production.min.js | react | 18.3.1 | `grep -o 'version="[^"]*"'` |
| react-dom.production.min.js | react-dom | 18.3.1 | same |
| babel-standalone.js | @babel/standalone | 7.29.0 | `node -e "console.log(require('./.build/newtracker/vendor/babel-standalone.js').version)"` |

Deliberately NOT vendored: puppeteer-core (share-card redraw only, a few runs
a month) — pinned in the root package.json instead, resolved by render-card.mjs
from repo node_modules (`npm ci`) or ~/node_modules.

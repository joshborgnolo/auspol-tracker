// Regularised incomplete beta and its inverse, used for equal-tailed intervals.
const gammaCoefficients = [76.18009172947146, -86.50532032941677, 24.01409824083091,
  -1.231739572450155, .001208650973866179, -.000005395239384953];

function logGamma(x) {
  let series = 1.000000000190015;
  for (let i = 0; i < gammaCoefficients.length; i++) series += gammaCoefficients[i] / (x + i + 1);
  return (x + .5) * Math.log(x + 5.5) - (x + 5.5) + Math.log(2.5066282746310005 * series / x);
}

function betaFraction(a, b, x) {
  const bounded = v => Math.abs(v) < 1e-30 ? 1e-30 : v;
  let c = 1, d = 1 / bounded(1 - (a + b) * x / (a + 1)), value = d;
  for (let m = 1; m <= 200; m++) {
    const k = 2 * m;
    const even = m * (b - m) * x / ((a - 1 + k) * (a + k));
    d = 1 / bounded(1 + even * d);
    c = bounded(1 + even / c);
    value *= d * c;
    const odd = -(a + m) * (a + b + m) * x / ((a + k) * (a + 1 + k));
    d = 1 / bounded(1 + odd * d);
    c = bounded(1 + odd / c);
    const ratio = d * c;
    value *= ratio;
    if (Math.abs(ratio - 1) < 3e-12) break;
  }
  return value;
}

function betaCdf(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const scale = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x));
  return x < (a + 1) / (a + b + 2)
    ? scale * betaFraction(a, b, x) / a
    : 1 - scale * betaFraction(b, a, 1 - x) / b;
}

function betaQuantile(a, b, probability) {
  let low = 0, high = 1;
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    if (betaCdf(a, b, mid) < probability) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

// Match the poll model's effective variance, then apply its Jeffreys prior.
export function sharePosterior(share, sample, noise, step) {
  if (share == null || sample <= 0) return null;
  const s = share / 100, variance = s * (1 - s), rounding = (step / 100) ** 2 / 12;
  const size = variance > 0 ? Math.max(1, variance / (noise * variance / sample + rounding)) : sample / noise;
  return [s * size + .5, (1 - s) * size + .5];
}

export function credibleBounds(shape) {
  return [.025, .975].map(q => 100 * betaQuantile(...shape, q));
}

// Integrate Pr(previous < current) over the current posterior's quantiles.
// Monotonicity bounds the integral between the left and right Riemann sums.
export function significantChange(current, previous) {
  if (!current || !previous) return null;
  let sum = 0;
  for (let bins = 2; bins <= 4096; bins *= 2) {
    for (let i = 1; i < bins; i += 2) {
      const value = betaQuantile(...current, i / bins);
      sum += betaCdf(...previous, value);
    }
    const lower = sum / bins, upper = (sum + 1) / bins;
    if (lower > .975 || upper < .025) return true;
    if (lower >= .025 && upper <= .975) return false;
  }
  return null;
}

/**
 * Small, dependency-free statistics toolkit. Every formula here mirrors one shown on the
 * pages (population versions, i.e. dividing by n, as in the course).
 */

export function sum(xs) {
  var s = 0;
  for (var i = 0; i < xs.length; i++) s += xs[i];
  return s;
}

export function mean(xs) {
  return xs.length ? sum(xs) / xs.length : NaN;
}

export function sorted(xs) {
  return Float64Array.from(xs).sort();
}

/** median: x_{m+1} if n = 2m+1, (x_m + x_{m+1}) / 2 if n = 2m */
export function median(xs) {
  var s = sorted(xs);
  var n = s.length;
  if (!n) return NaN;
  var m = Math.floor(n / 2);
  return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Linear-interpolated quantile, p in [0, 1] (same rule as numpy / pandas default). */
export function quantile(xs, p, isSorted) {
  var s = isSorted ? xs : sorted(xs);
  var n = s.length;
  if (!n) return NaN;
  var h = (n - 1) * p;
  var lo = Math.floor(h);
  var hi = Math.ceil(h);
  return s[lo] + (h - lo) * (s[hi] - s[lo]);
}

export function mode(xs) {
  var counts = new Map();
  var best = null;
  var bestC = 0;
  xs.forEach(function (x) {
    var c = (counts.get(x) || 0) + 1;
    counts.set(x, c);
    if (c > bestC) {
      bestC = c;
      best = x;
    }
  });
  return { value: best, count: bestC };
}

export function variance(xs) {
  var m = mean(xs);
  var s = 0;
  for (var i = 0; i < xs.length; i++) s += (xs[i] - m) * (xs[i] - m);
  return s / xs.length;
}

export function std(xs) {
  return Math.sqrt(variance(xs));
}

/** MAD(x) = median(|x_1 - x̄|, …, |x_n - x̄|), as defined in the course */
export function mad(xs) {
  var m = mean(xs);
  return median(
    xs.map(function (x) {
      return Math.abs(x - m);
    }),
  );
}

/** AAD(x) = 1/n Σ |x_i - x̄| */
export function aad(xs) {
  var m = mean(xs);
  return (
    sum(
      xs.map(function (x) {
        return Math.abs(x - m);
      }),
    ) / xs.length
  );
}

export function iqr(xs) {
  var s = sorted(xs);
  return quantile(s, 0.75, true) - quantile(s, 0.25, true);
}

function centralMoment(xs, k) {
  var m = mean(xs);
  var s = 0;
  for (var i = 0; i < xs.length; i++) s += Math.pow(xs[i] - m, k);
  return s / xs.length;
}

/** γ = m3 / σ³ */
export function skewness(xs) {
  return centralMoment(xs, 3) / Math.pow(centralMoment(xs, 2), 1.5);
}

/** κ = m4 / σ⁴ (not excess: 3 for a normal distribution) */
export function kurtosis(xs) {
  var v = centralMoment(xs, 2);
  return centralMoment(xs, 4) / (v * v);
}

export function summary(xs) {
  var s = sorted(xs);
  return {
    n: xs.length,
    mean: mean(xs),
    median: quantile(s, 0.5, true),
    mode: mode(xs).value,
    min: s[0],
    max: s[s.length - 1],
    q1: quantile(s, 0.25, true),
    q3: quantile(s, 0.75, true),
    p5: quantile(s, 0.05, true),
    p95: quantile(s, 0.95, true),
    range: s[s.length - 1] - s[0],
    variance: variance(xs),
    std: std(xs),
    iqr: quantile(s, 0.75, true) - quantile(s, 0.25, true),
    mad: mad(xs),
    aad: aad(xs),
    skew: skewness(xs),
    kurt: kurtosis(xs),
  };
}

/* ---- bivariate --------------------------------------------------------- */

export function covariance(xs, ys) {
  var mx = mean(xs);
  var my = mean(ys);
  var s = 0;
  for (var i = 0; i < xs.length; i++) s += (xs[i] - mx) * (ys[i] - my);
  return s / xs.length;
}

export function pearson(xs, ys) {
  var c = covariance(xs, ys) / (std(xs) * std(ys));
  return Number.isFinite(c) ? c : 0;
}

/** Ranks starting at 1, ties get the average of the positions they occupy. */
export function ranks(xs) {
  var idx = xs.map(function (_, i) {
    return i;
  });
  idx.sort(function (a, b) {
    return xs[a] - xs[b];
  });
  var r = new Array(xs.length);
  var i = 0;
  while (i < idx.length) {
    var j = i;
    while (j + 1 < idx.length && xs[idx[j + 1]] === xs[idx[i]]) j++;
    var avg = (i + j) / 2 + 1;
    for (var k = i; k <= j; k++) r[idx[k]] = avg;
    i = j + 1;
  }
  return r;
}

export function spearman(xs, ys) {
  return pearson(ranks(xs), ranks(ys));
}

/** ρ(x, y | z) from the three pairwise correlations */
export function partialCorrelation(rxy, rxz, ryz) {
  return (rxy - rxz * ryz) / Math.sqrt((1 - rxz * rxz) * (1 - ryz * ryz));
}

/** Least squares residuals of y regressed on x */
export function residuals(ys, xs) {
  var b = covariance(xs, ys) / variance(xs);
  var a = mean(ys) - b * mean(xs);
  return ys.map(function (y, i) {
    return y - (a + b * xs[i]);
  });
}

/** Mutual information (base 2) between two discrete arrays. */
export function mutualInformation(xs, ys) {
  var n = xs.length;
  var px = new Map();
  var py = new Map();
  var pxy = new Map();
  for (var i = 0; i < n; i++) {
    var kx = String(xs[i]);
    var ky = String(ys[i]);
    px.set(kx, (px.get(kx) || 0) + 1);
    py.set(ky, (py.get(ky) || 0) + 1);
    var k = kx + '\u0000' + ky;
    pxy.set(k, (pxy.get(k) || 0) + 1);
  }
  var mi = 0;
  pxy.forEach(function (c, k) {
    var parts = k.split('\u0000');
    var p = c / n;
    mi += p * Math.log2(p / ((px.get(parts[0]) / n) * (py.get(parts[1]) / n)));
  });
  return mi;
}

/** Equal-width binning into k bins, returns bin index per value */
export function binIndex(xs, k) {
  var lo = Math.min.apply(null, xs);
  var hi = Math.max.apply(null, xs);
  var w = (hi - lo) / k || 1;
  return xs.map(function (x) {
    return Math.min(k - 1, Math.floor((x - lo) / w));
  });
}

/* ---- density ----------------------------------------------------------- */

export function gaussianKde(xs, bandwidth, grid) {
  var n = xs.length;
  var c = 1 / (n * bandwidth * Math.sqrt(2 * Math.PI));
  return grid.map(function (g) {
    var s = 0;
    for (var i = 0; i < n; i++) {
      var u = (g - xs[i]) / bandwidth;
      s += Math.exp(-0.5 * u * u);
    }
    return [g, s * c];
  });
}

/** Silverman's rule of thumb */
export function silverman(xs) {
  var s = std(xs);
  var r = iqr(xs) / 1.34;
  return 0.9 * Math.min(s, r || s) * Math.pow(xs.length, -0.2);
}

/* ---- randomness -------------------------------------------------------- */

export function rng(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalSampler(rand) {
  var spare = null;
  return function () {
    if (spare !== null) {
      var s = spare;
      spare = null;
      return s;
    }
    var u = 0;
    var v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    var r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}

/** Rescale a sample to an exact mean and (population) standard deviation. */
export function rescale(xs, m, s) {
  var mu = mean(xs);
  var sd = std(xs);
  return xs.map(function (x) {
    return m + ((x - mu) / sd) * s;
  });
}

/* ---- linear algebra ---------------------------------------------------- */

export function columns(rows) {
  return rows[0].map(function (_, j) {
    return rows.map(function (r) {
      return r[j];
    });
  });
}

export function standardize(rows) {
  var cols = columns(rows);
  var mus = cols.map(mean);
  var sds = cols.map(function (c) {
    return std(c) || 1;
  });
  return rows.map(function (r) {
    return r.map(function (v, j) {
      return (v - mus[j]) / sds[j];
    });
  });
}

export function center(rows) {
  var mus = columns(rows).map(mean);
  return rows.map(function (r) {
    return r.map(function (v, j) {
      return v - mus[j];
    });
  });
}

/** Σ = 1/n Σ (x−μ)(x−μ)ᵀ */
export function covarianceMatrix(rows) {
  var c = center(rows);
  var d = rows[0].length;
  var n = rows.length;
  var m = [];
  for (var i = 0; i < d; i++) {
    m.push(new Array(d).fill(0));
  }
  for (var k = 0; k < n; k++) {
    var r = c[k];
    for (var a = 0; a < d; a++) {
      for (var b = a; b < d; b++) m[a][b] += r[a] * r[b];
    }
  }
  for (var a2 = 0; a2 < d; a2++) {
    for (var b2 = a2; b2 < d; b2++) {
      m[a2][b2] /= n;
      m[b2][a2] = m[a2][b2];
    }
  }
  return m;
}

/** Jacobi eigenvalue algorithm for symmetric matrices. Returns sorted eigenpairs. */
export function eigenSymmetric(matrix) {
  var n = matrix.length;
  var a = matrix.map(function (r) {
    return r.slice();
  });
  var v = [];
  for (var i = 0; i < n; i++) {
    v.push(new Array(n).fill(0));
    v[i][i] = 1;
  }
  for (var sweep = 0; sweep < 100; sweep++) {
    var off = 0;
    for (var p = 0; p < n; p++) for (var q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
    if (off < 1e-20) break;
    for (var p2 = 0; p2 < n; p2++) {
      for (var q2 = p2 + 1; q2 < n; q2++) {
        if (Math.abs(a[p2][q2]) < 1e-15) continue;
        var theta = (a[q2][q2] - a[p2][p2]) / (2 * a[p2][q2]);
        var t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        var c = 1 / Math.sqrt(t * t + 1);
        var s = t * c;
        for (var k = 0; k < n; k++) {
          var akp = a[k][p2];
          var akq = a[k][q2];
          a[k][p2] = c * akp - s * akq;
          a[k][q2] = s * akp + c * akq;
        }
        for (var k2 = 0; k2 < n; k2++) {
          var apk = a[p2][k2];
          var aqk = a[q2][k2];
          a[p2][k2] = c * apk - s * aqk;
          a[q2][k2] = s * apk + c * aqk;
        }
        for (var k3 = 0; k3 < n; k3++) {
          var vkp = v[k3][p2];
          var vkq = v[k3][q2];
          v[k3][p2] = c * vkp - s * vkq;
          v[k3][q2] = s * vkp + c * vkq;
        }
      }
    }
  }
  var pairs = [];
  for (var j = 0; j < n; j++) {
    var vec = v.map(function (row) {
      return row[j];
    });
    // deterministic sign: largest component positive
    var big = 0;
    for (var m = 1; m < n; m++) if (Math.abs(vec[m]) > Math.abs(vec[big])) big = m;
    if (vec[big] < 0) vec = vec.map((x) => -x);
    pairs.push({ value: Math.max(0, a[j][j]), vector: vec });
  }
  pairs.sort(function (x, y) {
    return y.value - x.value;
  });
  return pairs;
}

/**
 * PCA on rows. Returns eigenpairs, explained ratios, projected scores (z = Vₖᵀx on centered
 * data) and the means/sds used.
 */
export function pca(rows, opts) {
  opts = opts || {};
  var data = opts.standardize ? standardize(rows) : center(rows);
  var cov = covarianceMatrix(data);
  var eig = eigenSymmetric(cov);
  var total = sum(
    eig.map(function (e) {
      return e.value;
    }),
  );
  var k = opts.k || 2;
  var scores = data.map(function (r) {
    var z = [];
    for (var j = 0; j < k; j++) {
      var s = 0;
      for (var i = 0; i < r.length; i++) s += eig[j].vector[i] * r[i];
      z.push(s);
    }
    return z;
  });
  return {
    eig: eig,
    explained: eig.map(function (e) {
      return e.value / total;
    }),
    scores: scores,
    data: data,
    cov: cov,
  };
}

export function dist(a, b) {
  var s = 0;
  for (var i = 0; i < a.length; i++) s += (a[i] - b[i]) * (a[i] - b[i]);
  return Math.sqrt(s);
}

/* ---- formatting -------------------------------------------------------- */

export function fmt(x, digits) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  if (typeof x !== 'number') return String(x);
  var d = digits === undefined ? 2 : digits;
  var ax = Math.abs(x);
  if (ax >= 10000) return Math.round(x).toLocaleString('en-US');
  if (ax >= 1000) return x.toLocaleString('en-US', { maximumFractionDigits: Math.min(d, 1) });
  var s = String(Number(x.toFixed(d)));
  return s === '-0' ? '0' : s.replace('-', '−');
}

/** Inverse of the standard normal CDF (Acklam's rational approximation). */
export function normalQuantile(p) {
  var a = [
    -39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716,
    2.506628277459239,
  ];
  var b = [
    -54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972,
    -13.28068155211639,
  ];
  var c = [
    -0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  var d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  var q;
  var r;
  if (p < 0.02425) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p > 1 - 0.02425) return -normalQuantile(1 - p);
  q = p - 0.5;
  r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

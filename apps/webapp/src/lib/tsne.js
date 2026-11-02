/**
 * Exact t-SNE (van der Maaten & Hinton, 2008), small enough to read and to run live in the
 * browser for a few hundred points. step() advances one gradient-descent iteration so a page
 * can animate the embedding as Q learns P.
 */
import { rng, normalSampler } from './stats.js';

function sqDistances(X) {
  var n = X.length;
  var D = new Float64Array(n * n);
  for (var i = 0; i < n; i++) {
    for (var j = i + 1; j < n; j++) {
      var s = 0;
      for (var k = 0; k < X[i].length; k++) {
        var d = X[i][k] - X[j][k];
        s += d * d;
      }
      D[i * n + j] = s;
      D[j * n + i] = s;
    }
  }
  return D;
}

/**
 * p_{j|i} with a Gaussian kernel; σ_i found by binary search so that the
 * perplexity 2^{H(P_i)} matches the target.
 */
function conditionalP(D, n, perplexity) {
  var P = new Float64Array(n * n);
  var target = Math.log(perplexity);
  var sigmas = new Float64Array(n);
  for (var i = 0; i < n; i++) {
    var beta = 1;
    var lo = -Infinity;
    var hi = Infinity;
    for (var iter = 0; iter < 60; iter++) {
      var sumP = 0;
      var sumDP = 0;
      for (var j = 0; j < n; j++) {
        if (j === i) continue;
        var p = Math.exp(-D[i * n + j] * beta);
        P[i * n + j] = p;
        sumP += p;
        sumDP += D[i * n + j] * p;
      }
      sumP = sumP || 1e-12;
      var H = Math.log(sumP) + (beta * sumDP) / sumP;
      if (Math.abs(H - target) < 1e-5) break;
      if (H > target) {
        lo = beta;
        beta = hi === Infinity ? beta * 2 : (beta + hi) / 2;
      } else {
        hi = beta;
        beta = lo === -Infinity ? beta / 2 : (beta + lo) / 2;
      }
    }
    for (var j2 = 0; j2 < n; j2++) P[i * n + j2] /= sumP;
    sigmas[i] = Math.sqrt(1 / (2 * beta));
  }
  return { P: P, sigmas: sigmas };
}

export function createTsne(X, opts) {
  opts = opts || {};
  var n = X.length;
  var dim = opts.dim || 2;
  var perplexity = Math.min(opts.perplexity || 30, (n - 1) / 3);
  var rand = rng(opts.seed || 7);
  var gauss = normalSampler(rand);
  var D = sqDistances(X);
  var cond = conditionalP(D, n, perplexity);
  // symmetrize: p_ij = (p_{j|i} + p_{i|j}) / 2N
  var P = new Float64Array(n * n);
  for (var i = 0; i < n; i++) {
    for (var j = 0; j < n; j++) {
      P[i * n + j] = Math.max((cond.P[i * n + j] + cond.P[j * n + i]) / (2 * n), 1e-12);
    }
  }
  var Y = [];
  var vel = [];
  var gains = [];
  for (var a = 0; a < n; a++) {
    var y = [];
    for (var d = 0; d < dim; d++) y.push(gauss() * 1e-4);
    Y.push(y);
    vel.push(new Array(dim).fill(0));
    gains.push(new Array(dim).fill(1));
  }
  var Q = new Float64Array(n * n);
  var iter = 0;
  var lr = opts.learningRate || Math.max(n / 12, 50);
  var kl = NaN;

  function step() {
    var exag = iter < 100 ? 12 : 1;
    var mom = iter < 250 ? 0.5 : 0.8;
    // q_ij ∝ (1 + ||y_i − y_j||²)^{-1}
    var sumQ = 0;
    for (var i = 0; i < n; i++) {
      for (var j = i + 1; j < n; j++) {
        var s = 0;
        for (var d = 0; d < dim; d++) {
          var diff = Y[i][d] - Y[j][d];
          s += diff * diff;
        }
        var q = 1 / (1 + s);
        Q[i * n + j] = q;
        Q[j * n + i] = q;
        sumQ += 2 * q;
      }
    }
    var cost = 0;
    var grad = [];
    for (var i2 = 0; i2 < n; i2++) {
      var g = new Array(dim).fill(0);
      for (var j2 = 0; j2 < n; j2++) {
        if (i2 === j2) continue;
        var num = Q[i2 * n + j2];
        var qn = Math.max(num / sumQ, 1e-12);
        var pij = P[i2 * n + j2];
        cost += pij * Math.log(pij / qn);
        var mult = 4 * (exag * pij - qn) * num;
        for (var d2 = 0; d2 < dim; d2++) g[d2] += mult * (Y[i2][d2] - Y[j2][d2]);
      }
      grad.push(g);
    }
    var means = new Array(dim).fill(0);
    for (var i3 = 0; i3 < n; i3++) {
      for (var d3 = 0; d3 < dim; d3++) {
        var gd = grad[i3][d3];
        var same = Math.sign(gd) === Math.sign(vel[i3][d3]);
        gains[i3][d3] = Math.max(same ? gains[i3][d3] * 0.8 : gains[i3][d3] + 0.2, 0.01);
        vel[i3][d3] = mom * vel[i3][d3] - lr * gains[i3][d3] * gd;
        Y[i3][d3] += vel[i3][d3];
        means[d3] += Y[i3][d3];
      }
    }
    for (var i4 = 0; i4 < n; i4++) {
      for (var d4 = 0; d4 < dim; d4++) Y[i4][d4] -= means[d4] / n;
    }
    iter++;
    kl = cost;
    return Y;
  }

  return {
    step: step,
    get Y() {
      return Y;
    },
    get iteration() {
      return iter;
    },
    get kl() {
      return kl;
    },
    sigmas: cond.sigmas,
  };
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

export function ols(points) {
  const n = points.length;
  if (n < 3) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  const intercept = my - slope * mx;
  const r = pearson(xs, ys);
  const ssTot = ys.reduce((sum, y) => sum + (y - my) ** 2, 0);
  const ssRes = points.reduce((sum, p) => sum + (p.y - (intercept + slope * p.x)) ** 2, 0);
  const r2 = ssTot === 0 ? null : 1 - ssRes / ssTot;
  return { slope, intercept, r, r2, n };
}

function zscore(matrix) {
  const cols = matrix[0].length;
  const means = Array.from({ length: cols }, (_, j) => mean(matrix.map((row) => row[j])));
  const stds = means.map((m, j) => {
    const v = mean(matrix.map((row) => (row[j] - m) ** 2));
    return Math.sqrt(v) || 1;
  });
  return {
    scaled: matrix.map((row) => row.map((value, j) => (value - means[j]) / stds[j])),
    means,
    stds,
  };
}

function dist2(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += (a[i] - b[i]) ** 2;
  return sum;
}

export function kmeans(matrix, k, maxIter = 40) {
  const n = matrix.length;
  if (n < k) return null;
  const { scaled, means, stds } = zscore(matrix);
  const centroids = [];
  const used = new Set();
  while (centroids.length < k) {
    const idx = Math.floor(Math.random() * n);
    if (used.has(idx)) continue;
    used.add(idx);
    centroids.push(scaled[idx].slice());
  }
  const labels = Array(n).fill(0);
  for (let iter = 0; iter < maxIter; iter += 1) {
    let changed = false;
    for (let i = 0; i < n; i += 1) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c += 1) {
        const d = dist2(scaled[i], centroids[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (labels[i] !== best) {
        labels[i] = best;
        changed = true;
      }
    }
    const sums = Array.from({ length: k }, () => Array(scaled[0].length).fill(0));
    const counts = Array(k).fill(0);
    for (let i = 0; i < n; i += 1) {
      counts[labels[i]] += 1;
      for (let j = 0; j < scaled[0].length; j += 1) sums[labels[i]][j] += scaled[i][j];
    }
    for (let c = 0; c < k; c += 1) {
      if (!counts[c]) continue;
      centroids[c] = sums[c].map((value) => value / counts[c]);
    }
    if (!changed) break;
  }
  const centroidsOriginal = centroids.map((centroid) =>
    centroid.map((value, j) => value * stds[j] + means[j]),
  );
  return {
    labels,
    centroids: centroidsOriginal,
    counts: Array.from({ length: k }, (_, c) => labels.filter((l) => l === c).length),
  };
}

export function bestKmeans(matrix, k, trials = 8) {
  let best = null;
  let bestInertia = Infinity;
  for (let trial = 0; trial < trials; trial += 1) {
    const attempt = kmeans(matrix, k);
    if (!attempt) continue;
    let inertia = 0;
    for (let i = 0; i < matrix.length; i += 1) {
      inertia += dist2(matrix[i], attempt.centroids[attempt.labels[i]]);
    }
    if (inertia < bestInertia) {
      bestInertia = inertia;
      best = attempt;
    }
  }
  return best;
}

export function heatColor(r) {
  if (r == null) return 'transparent';
  const t = Math.max(-1, Math.min(1, r));
  if (t >= 0) {
    const a = 0.12 + 0.55 * t;
    return `rgba(116, 230, 203, ${a})`;
  }
  const a = 0.12 + 0.55 * -t;
  return `rgba(255, 180, 170, ${a})`;
}

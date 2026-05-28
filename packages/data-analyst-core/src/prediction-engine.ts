// ─── Prediction Engine ───────────────────────────────────────────────────────
// Pure JS statistical prediction, regression, time-series forecasting,
// and interpolation library. No external dependencies.

export type DataPoint = { x: number; y: number };

export type PredictionResult = {
  fitted: DataPoint[];
  forecast: DataPoint[];
  coefficients: Record<string, number>;
  metrics: ModelMetrics;
  equation: string;
  confidenceBands?: { upper: DataPoint[]; lower: DataPoint[] };
};

export type ModelMetrics = {
  r2: number;
  adjustedR2: number;
  rmse: number;
  mae: number;
  mape: number;
  aic: number;
  bic: number;
  n: number;
  p: number; // number of parameters
};

export type ModelType =
  | "linear"
  | "polynomial"
  | "exponential"
  | "logarithmic"
  | "power"
  | "logistic"
  | "moving-average"
  | "exponential-smoothing"
  | "holt"
  | "holt-winters";

export type InterpolationMethod =
  | "linear"
  | "polynomial"
  | "cubic-spline"
  | "nearest";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sum(arr: number[]): number {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s;
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : sum(arr) / arr.length;
}

function computeMetrics(
  actual: number[],
  predicted: number[],
  numParams: number,
): ModelMetrics {
  const n = actual.length;
  const p = numParams;
  const yMean = mean(actual);
  let ssTot = 0,
    ssRes = 0,
    absErr = 0,
    pctErr = 0;
  for (let i = 0; i < n; i++) {
    const diff = actual[i] - predicted[i];
    ssTot += (actual[i] - yMean) ** 2;
    ssRes += diff ** 2;
    absErr += Math.abs(diff);
    if (actual[i] !== 0) pctErr += Math.abs(diff / actual[i]);
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  const adjustedR2 = n - p - 1 > 0 ? 1 - ((1 - r2) * (n - 1)) / (n - p - 1) : r2;
  const rmse = Math.sqrt(ssRes / n);
  const mae = absErr / n;
  const mape = (pctErr / n) * 100;
  const logLik = -n / 2 * (Math.log(2 * Math.PI * (ssRes / n)) + 1);
  const aic = 2 * p - 2 * logLik;
  const bic = Math.log(n) * p - 2 * logLik;
  return { r2, adjustedR2, rmse, mae, mape, aic, bic, n, p };
}

function confidenceInterval(
  data: DataPoint[],
  predicted: number[],
  forecastX: number[],
  forecastY: number[],
  level: number = 0.95,
): { upper: DataPoint[]; lower: DataPoint[] } {
  const n = data.length;
  const residuals = data.map((d, i) => d.y - predicted[i]);
  const se = Math.sqrt(sum(residuals.map((r) => r * r)) / Math.max(n - 2, 1));
  // Approximate t-value for 95% confidence
  const tValues: Record<number, number> = { 0.9: 1.645, 0.95: 1.96, 0.99: 2.576 };
  const t = tValues[level] || 1.96;
  const xMean = mean(data.map((d) => d.x));
  const sxx = sum(data.map((d) => (d.x - xMean) ** 2));

  const allX = [...data.map((d) => d.x), ...forecastX];
  const allY = [...predicted, ...forecastY];

  const upper: DataPoint[] = [];
  const lower: DataPoint[] = [];
  for (let i = 0; i < allX.length; i++) {
    const hi = sxx > 0 ? 1 / n + (allX[i] - xMean) ** 2 / sxx : 1 / n;
    const margin = t * se * Math.sqrt(1 + hi);
    upper.push({ x: allX[i], y: allY[i] + margin });
    lower.push({ x: allX[i], y: allY[i] - margin });
  }
  return { upper, lower };
}

// ─── Matrix Operations (for polynomial/multiple regression) ──────────────────

function matMul(A: number[][], B: number[][]): number[][] {
  const rows = A.length;
  const cols = B[0].length;
  const n = B.length;
  const C: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < n; k++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return C;
}

function matTranspose(A: number[][]): number[][] {
  const rows = A.length;
  const cols = A[0].length;
  const T: number[][] = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      T[j][i] = A[i][j];
    }
  }
  return T;
}

function matInverse(matrix: number[][]): number[][] {
  const n = matrix.length;
  const aug: number[][] = matrix.map((row, i) => {
    const ext = new Array(2 * n).fill(0);
    for (let j = 0; j < n; j++) ext[j] = row[j];
    ext[n + i] = 1;
    return ext;
  });

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) throw new Error("Matrix is singular");
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  return aug.map((row) => row.slice(n));
}

function leastSquares(X: number[][], y: number[]): number[] {
  const Xt = matTranspose(X);
  const XtX = matMul(Xt, X);
  const XtXinv = matInverse(XtX);
  const Xty = matMul(Xt, y.map((v) => [v]));
  const coeffs = matMul(XtXinv, Xty);
  return coeffs.map((row) => row[0]);
}

// ─── Regression Models ───────────────────────────────────────────────────────

export function linearRegression(
  data: DataPoint[],
  forecastSteps: number = 0,
  confidenceLevel: number = 0.95,
): PredictionResult {
  const n = data.length;
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const X = xs.map((x) => [1, x]);
  const [b0, b1] = leastSquares(X, ys);

  const predicted = xs.map((x) => b0 + b1 * x);
  const fitted = data.map((d, i) => ({ x: d.x, y: predicted[i] }));

  const step = n > 1 ? (xs[n - 1] - xs[0]) / (n - 1) : 1;
  const forecast: DataPoint[] = [];
  const forecastYs: number[] = [];
  for (let i = 1; i <= forecastSteps; i++) {
    const fx = xs[n - 1] + step * i;
    const fy = b0 + b1 * fx;
    forecast.push({ x: fx, y: fy });
    forecastYs.push(fy);
  }

  const metrics = computeMetrics(ys, predicted, 2);
  const bands = confidenceInterval(data, predicted, forecast.map((f) => f.x), forecastYs, confidenceLevel);

  return {
    fitted,
    forecast,
    coefficients: { intercept: b0, slope: b1 },
    metrics,
    equation: `y = ${b0.toFixed(4)} + ${b1.toFixed(4)}x`,
    confidenceBands: bands,
  };
}

export function polynomialRegression(
  data: DataPoint[],
  degree: number = 2,
  forecastSteps: number = 0,
  confidenceLevel: number = 0.95,
): PredictionResult {
  const n = data.length;
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const X = xs.map((x) => {
    const row: number[] = [];
    for (let d = 0; d <= degree; d++) row.push(x ** d);
    return row;
  });
  const coeffs = leastSquares(X, ys);

  const evalPoly = (x: number) => {
    let y = 0;
    for (let d = 0; d <= degree; d++) y += coeffs[d] * x ** d;
    return y;
  };

  const predicted = xs.map(evalPoly);
  const fitted = data.map((d, i) => ({ x: d.x, y: predicted[i] }));

  const step = n > 1 ? (xs[n - 1] - xs[0]) / (n - 1) : 1;
  const forecast: DataPoint[] = [];
  const forecastYs: number[] = [];
  for (let i = 1; i <= forecastSteps; i++) {
    const fx = xs[n - 1] + step * i;
    const fy = evalPoly(fx);
    forecast.push({ x: fx, y: fy });
    forecastYs.push(fy);
  }

  const metrics = computeMetrics(ys, predicted, degree + 1);
  const bands = confidenceInterval(data, predicted, forecast.map((f) => f.x), forecastYs, confidenceLevel);

  const coeffObj: Record<string, number> = {};
  coeffs.forEach((c, i) => (coeffObj[`a${i}`] = c));

  const eqParts = coeffs.map((c, i) =>
    i === 0 ? c.toFixed(4) : `${c >= 0 ? "+" : ""}${c.toFixed(4)}x${i > 1 ? `^${i}` : ""}`,
  );

  return {
    fitted,
    forecast,
    coefficients: coeffObj,
    metrics,
    equation: `y = ${eqParts.join(" ")}`,
    confidenceBands: bands,
  };
}

export function exponentialRegression(
  data: DataPoint[],
  forecastSteps: number = 0,
  confidenceLevel: number = 0.95,
): PredictionResult {
  // y = a * e^(bx) → ln(y) = ln(a) + bx
  const filtered = data.filter((d) => d.y > 0);
  if (filtered.length < 2) {
    return linearRegression(data, forecastSteps, confidenceLevel);
  }
  const xs = filtered.map((d) => d.x);
  const logYs = filtered.map((d) => Math.log(d.y));
  const X = xs.map((x) => [1, x]);
  const [lnA, b] = leastSquares(X, logYs);
  const a = Math.exp(lnA);

  const evalExp = (x: number) => a * Math.exp(b * x);

  const predicted = data.map((d) => evalExp(d.x));
  const fitted = data.map((d, i) => ({ x: d.x, y: predicted[i] }));

  const n = data.length;
  const step = n > 1 ? (xs[n - 1] - xs[0]) / (n - 1) : 1;
  const forecast: DataPoint[] = [];
  const forecastYs: number[] = [];
  for (let i = 1; i <= forecastSteps; i++) {
    const fx = data[n - 1].x + step * i;
    const fy = evalExp(fx);
    forecast.push({ x: fx, y: fy });
    forecastYs.push(fy);
  }

  const ys = data.map((d) => d.y);
  const metrics = computeMetrics(ys, predicted, 2);
  const bands = confidenceInterval(data, predicted, forecast.map((f) => f.x), forecastYs, confidenceLevel);

  return {
    fitted,
    forecast,
    coefficients: { a, b },
    metrics,
    equation: `y = ${a.toFixed(4)} * e^(${b.toFixed(4)}x)`,
    confidenceBands: bands,
  };
}

export function logarithmicRegression(
  data: DataPoint[],
  forecastSteps: number = 0,
  confidenceLevel: number = 0.95,
): PredictionResult {
  // y = a + b * ln(x)
  const filtered = data.filter((d) => d.x > 0);
  if (filtered.length < 2) {
    return linearRegression(data, forecastSteps, confidenceLevel);
  }
  const xs = filtered.map((d) => d.x);
  const ys = filtered.map((d) => d.y);
  const lnXs = xs.map(Math.log);
  const X = lnXs.map((lnx) => [1, lnx]);
  const [a, b] = leastSquares(X, ys);

  const evalLog = (x: number) => a + b * Math.log(Math.max(x, 1e-10));

  const predicted = data.map((d) => evalLog(d.x));
  const fitted = data.map((d, i) => ({ x: d.x, y: predicted[i] }));

  const n = data.length;
  const step = n > 1 ? (xs[n - 1] - xs[0]) / (n - 1) : 1;
  const forecast: DataPoint[] = [];
  const forecastYs: number[] = [];
  for (let i = 1; i <= forecastSteps; i++) {
    const fx = data[n - 1].x + step * i;
    const fy = evalLog(fx);
    forecast.push({ x: fx, y: fy });
    forecastYs.push(fy);
  }

  const allYs = data.map((d) => d.y);
  const metrics = computeMetrics(allYs, predicted, 2);
  const bands = confidenceInterval(data, predicted, forecast.map((f) => f.x), forecastYs, confidenceLevel);

  return {
    fitted,
    forecast,
    coefficients: { a, b },
    metrics,
    equation: `y = ${a.toFixed(4)} + ${b.toFixed(4)} * ln(x)`,
    confidenceBands: bands,
  };
}

export function powerRegression(
  data: DataPoint[],
  forecastSteps: number = 0,
  confidenceLevel: number = 0.95,
): PredictionResult {
  // y = a * x^b → ln(y) = ln(a) + b*ln(x)
  const filtered = data.filter((d) => d.x > 0 && d.y > 0);
  if (filtered.length < 2) {
    return linearRegression(data, forecastSteps, confidenceLevel);
  }
  const lnXs = filtered.map((d) => Math.log(d.x));
  const lnYs = filtered.map((d) => Math.log(d.y));
  const X = lnXs.map((lnx) => [1, lnx]);
  const [lnA, b] = leastSquares(X, lnYs);
  const a = Math.exp(lnA);

  const evalPow = (x: number) => a * Math.pow(Math.max(x, 1e-10), b);

  const predicted = data.map((d) => evalPow(d.x));
  const fitted = data.map((d, i) => ({ x: d.x, y: predicted[i] }));

  const n = data.length;
  const xs = data.map((d) => d.x);
  const step = n > 1 ? (xs[n - 1] - xs[0]) / (n - 1) : 1;
  const forecast: DataPoint[] = [];
  const forecastYs: number[] = [];
  for (let i = 1; i <= forecastSteps; i++) {
    const fx = data[n - 1].x + step * i;
    const fy = evalPow(fx);
    forecast.push({ x: fx, y: fy });
    forecastYs.push(fy);
  }

  const ys = data.map((d) => d.y);
  const metrics = computeMetrics(ys, predicted, 2);
  const bands = confidenceInterval(data, predicted, forecast.map((f) => f.x), forecastYs, confidenceLevel);

  return {
    fitted,
    forecast,
    coefficients: { a, b },
    metrics,
    equation: `y = ${a.toFixed(4)} * x^${b.toFixed(4)}`,
    confidenceBands: bands,
  };
}

export function logisticRegression(
  data: DataPoint[],
  forecastSteps: number = 0,
  confidenceLevel: number = 0.95,
): PredictionResult {
  // y = L / (1 + e^(-k*(x - x0)))
  // Estimate L as max(y)*1.1, then linearize
  const ys = data.map((d) => d.y);
  const L = Math.max(...ys) * 1.2;
  const filtered = data.filter((d) => d.y > 0 && d.y < L);
  if (filtered.length < 3) {
    return linearRegression(data, forecastSteps, confidenceLevel);
  }

  // Transform: ln(L/y - 1) = -k*x + k*x0 = a + b*x
  const transformed = filtered.map((d) => ({
    x: d.x,
    y: Math.log(L / d.y - 1),
  }));
  const txs = transformed.map((d) => d.x);
  const tys = transformed.map((d) => d.y);
  const X = txs.map((x) => [1, x]);
  const [a, b] = leastSquares(X, tys);
  const k = -b;
  const x0 = a / k;

  const evalLogistic = (x: number) => L / (1 + Math.exp(-k * (x - x0)));

  const predicted = data.map((d) => evalLogistic(d.x));
  const fitted = data.map((d, i) => ({ x: d.x, y: predicted[i] }));

  const n = data.length;
  const xs = data.map((d) => d.x);
  const step = n > 1 ? (xs[n - 1] - xs[0]) / (n - 1) : 1;
  const forecast: DataPoint[] = [];
  const forecastYs: number[] = [];
  for (let i = 1; i <= forecastSteps; i++) {
    const fx = xs[n - 1] + step * i;
    const fy = evalLogistic(fx);
    forecast.push({ x: fx, y: fy });
    forecastYs.push(fy);
  }

  const metrics = computeMetrics(ys, predicted, 3);
  const bands = confidenceInterval(data, predicted, forecast.map((f) => f.x), forecastYs, confidenceLevel);

  return {
    fitted,
    forecast,
    coefficients: { L, k, x0 },
    metrics,
    equation: `y = ${L.toFixed(2)} / (1 + e^(-${k.toFixed(4)}(x - ${x0.toFixed(4)})))`,
    confidenceBands: bands,
  };
}

// ─── Time Series Models ──────────────────────────────────────────────────────

export function movingAverage(
  data: DataPoint[],
  window: number = 3,
  forecastSteps: number = 0,
): PredictionResult {
  const n = data.length;
  const ys = data.map((d) => d.y);
  const fitted: DataPoint[] = [];
  const fittedYs: number[] = [];

  for (let i = 0; i < n; i++) {
    if (i < window - 1) {
      fitted.push({ x: data[i].x, y: ys[i] });
      fittedYs.push(ys[i]);
    } else {
      let avg = 0;
      for (let j = 0; j < window; j++) avg += ys[i - j];
      avg /= window;
      fitted.push({ x: data[i].x, y: avg });
      fittedYs.push(avg);
    }
  }

  // Forecast: repeat last window average
  const step = n > 1 ? (data[n - 1].x - data[0].x) / (n - 1) : 1;
  const lastAvg = fittedYs[fittedYs.length - 1];
  const forecast: DataPoint[] = [];
  for (let i = 1; i <= forecastSteps; i++) {
    forecast.push({ x: data[n - 1].x + step * i, y: lastAvg });
  }

  const metrics = computeMetrics(ys, fittedYs, 1);

  return {
    fitted,
    forecast,
    coefficients: { window },
    metrics,
    equation: `SMA(${window})`,
  };
}

export function exponentialSmoothing(
  data: DataPoint[],
  alpha: number = 0.3,
  forecastSteps: number = 0,
): PredictionResult {
  const n = data.length;
  const ys = data.map((d) => d.y);
  const smoothed: number[] = [ys[0]];

  for (let i = 1; i < n; i++) {
    smoothed.push(alpha * ys[i] + (1 - alpha) * smoothed[i - 1]);
  }

  const fitted = data.map((d, i) => ({ x: d.x, y: smoothed[i] }));
  const step = n > 1 ? (data[n - 1].x - data[0].x) / (n - 1) : 1;
  const lastSmooth = smoothed[n - 1];
  const forecast: DataPoint[] = [];
  for (let i = 1; i <= forecastSteps; i++) {
    forecast.push({ x: data[n - 1].x + step * i, y: lastSmooth });
  }

  const metrics = computeMetrics(ys, smoothed, 1);

  return {
    fitted,
    forecast,
    coefficients: { alpha },
    metrics,
    equation: `SES(α=${alpha})`,
  };
}

export function holtLinear(
  data: DataPoint[],
  alpha: number = 0.3,
  beta: number = 0.1,
  forecastSteps: number = 0,
): PredictionResult {
  const n = data.length;
  const ys = data.map((d) => d.y);

  let level = ys[0];
  let trend = n > 1 ? ys[1] - ys[0] : 0;
  const smoothed: number[] = [level];

  for (let i = 1; i < n; i++) {
    const prevLevel = level;
    level = alpha * ys[i] + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    smoothed.push(level + trend);
  }

  const fitted = data.map((d, i) => ({ x: d.x, y: smoothed[i] }));
  const step = n > 1 ? (data[n - 1].x - data[0].x) / (n - 1) : 1;
  const forecast: DataPoint[] = [];
  for (let i = 1; i <= forecastSteps; i++) {
    forecast.push({ x: data[n - 1].x + step * i, y: level + trend * i });
  }

  const metrics = computeMetrics(ys, smoothed, 2);

  return {
    fitted,
    forecast,
    coefficients: { alpha, beta, level, trend },
    metrics,
    equation: `Holt(α=${alpha}, β=${beta})`,
  };
}

export function holtWinters(
  data: DataPoint[],
  seasonLength: number = 12,
  alpha: number = 0.3,
  beta: number = 0.1,
  gamma: number = 0.3,
  forecastSteps: number = 0,
): PredictionResult {
  const n = data.length;
  const ys = data.map((d) => d.y);

  if (n < seasonLength * 2) {
    // Not enough data for seasonal decomposition, fall back to Holt
    return holtLinear(data, alpha, beta, forecastSteps);
  }

  // Initialize level and trend from first season
  let level = mean(ys.slice(0, seasonLength));
  let trend = 0;
  for (let i = 0; i < seasonLength; i++) {
    trend += (ys[seasonLength + i] - ys[i]) / seasonLength;
  }
  trend /= seasonLength;

  // Initialize seasonal indices
  const seasonal: number[] = [];
  for (let i = 0; i < seasonLength; i++) {
    seasonal.push(ys[i] / (level || 1));
  }

  const smoothed: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i < seasonLength) {
      smoothed.push(ys[i]);
      continue;
    }
    const prevLevel = level;
    const seasonIdx = i % seasonLength;
    level = alpha * (ys[i] / (seasonal[seasonIdx] || 1)) + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonal[seasonIdx] = gamma * (ys[i] / (level || 1)) + (1 - gamma) * seasonal[seasonIdx];
    smoothed.push((level + trend) * seasonal[seasonIdx]);
  }

  const fitted = data.map((d, i) => ({ x: d.x, y: smoothed[i] }));
  const step = n > 1 ? (data[n - 1].x - data[0].x) / (n - 1) : 1;
  const forecast: DataPoint[] = [];
  for (let i = 1; i <= forecastSteps; i++) {
    const seasonIdx = (n + i - 1) % seasonLength;
    const fy = (level + trend * i) * seasonal[seasonIdx];
    forecast.push({ x: data[n - 1].x + step * i, y: fy });
  }

  const metrics = computeMetrics(ys, smoothed, 3);

  return {
    fitted,
    forecast,
    coefficients: { alpha, beta, gamma, seasonLength, level, trend },
    metrics,
    equation: `Holt-Winters(α=${alpha}, β=${beta}, γ=${gamma}, s=${seasonLength})`,
  };
}

// ─── Interpolation ───────────────────────────────────────────────────────────

export function linearInterpolation(data: DataPoint[], targets: number[]): DataPoint[] {
  const sorted = [...data].sort((a, b) => a.x - b.x);
  return targets.map((tx) => {
    if (tx <= sorted[0].x) return { x: tx, y: sorted[0].y };
    if (tx >= sorted[sorted.length - 1].x) return { x: tx, y: sorted[sorted.length - 1].y };
    let i = 0;
    while (i < sorted.length - 1 && sorted[i + 1].x < tx) i++;
    const x0 = sorted[i].x, y0 = sorted[i].y;
    const x1 = sorted[i + 1].x, y1 = sorted[i + 1].y;
    const t = x1 !== x0 ? (tx - x0) / (x1 - x0) : 0;
    return { x: tx, y: y0 + t * (y1 - y0) };
  });
}

export function polynomialInterpolation(data: DataPoint[], targets: number[]): DataPoint[] {
  // Lagrange interpolation
  const sorted = [...data].sort((a, b) => a.x - b.x);
  // Limit to avoid numerical instability
  const pts = sorted.length > 20 ? sorted.slice(0, 20) : sorted;
  const n = pts.length;

  return targets.map((tx) => {
    let y = 0;
    for (let i = 0; i < n; i++) {
      let basis = pts[i].y;
      for (let j = 0; j < n; j++) {
        if (j !== i) {
          const denom = pts[i].x - pts[j].x;
          basis *= denom !== 0 ? (tx - pts[j].x) / denom : 1;
        }
      }
      y += basis;
    }
    return { x: tx, y };
  });
}

export function cubicSplineInterpolation(data: DataPoint[], targets: number[]): DataPoint[] {
  const sorted = [...data].sort((a, b) => a.x - b.x);
  const n = sorted.length;
  if (n < 2) return targets.map((tx) => ({ x: tx, y: sorted[0]?.y ?? 0 }));

  const xs = sorted.map((d) => d.x);
  const ys = sorted.map((d) => d.y);

  // Compute h intervals
  const h: number[] = [];
  for (let i = 0; i < n - 1; i++) h.push(xs[i + 1] - xs[i]);

  // Solve tridiagonal system for second derivatives
  const alpha: number[] = [0];
  for (let i = 1; i < n - 1; i++) {
    alpha.push(
      (3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1]),
    );
  }

  const l: number[] = [1];
  const mu: number[] = [0];
  const z: number[] = [0];

  for (let i = 1; i < n - 1; i++) {
    l.push(2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1]);
    mu.push(h[i] / l[i]);
    z.push((alpha[i] - h[i - 1] * z[i - 1]) / l[i]);
  }

  const c: number[] = new Array(n).fill(0);
  const b: number[] = new Array(n - 1).fill(0);
  const d: number[] = new Array(n - 1).fill(0);

  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (ys[j + 1] - ys[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }

  return targets.map((tx) => {
    let i = 0;
    if (tx <= xs[0]) i = 0;
    else if (tx >= xs[n - 1]) i = n - 2;
    else {
      while (i < n - 2 && xs[i + 1] < tx) i++;
    }
    const dx = tx - xs[i];
    const y = ys[i] + b[i] * dx + c[i] * dx ** 2 + d[i] * dx ** 3;
    return { x: tx, y };
  });
}

export function nearestNeighborInterpolation(data: DataPoint[], targets: number[]): DataPoint[] {
  const sorted = [...data].sort((a, b) => a.x - b.x);
  return targets.map((tx) => {
    let minDist = Infinity;
    let nearest = sorted[0];
    for (const d of sorted) {
      const dist = Math.abs(d.x - tx);
      if (dist < minDist) {
        minDist = dist;
        nearest = d;
      }
    }
    return { x: tx, y: nearest.y };
  });
}

export function interpolate(
  data: DataPoint[],
  targets: number[],
  method: InterpolationMethod = "cubic-spline",
): DataPoint[] {
  switch (method) {
    case "linear":
      return linearInterpolation(data, targets);
    case "polynomial":
      return polynomialInterpolation(data, targets);
    case "cubic-spline":
      return cubicSplineInterpolation(data, targets);
    case "nearest":
      return nearestNeighborInterpolation(data, targets);
    default:
      return linearInterpolation(data, targets);
  }
}

// ─── Unified Runner ──────────────────────────────────────────────────────────

export function runPrediction(
  data: DataPoint[],
  model: ModelType,
  options: {
    forecastSteps?: number;
    degree?: number;
    window?: number;
    alpha?: number;
    beta?: number;
    gamma?: number;
    seasonLength?: number;
    confidenceLevel?: number;
  } = {},
): PredictionResult {
  const {
    forecastSteps = 0,
    degree = 2,
    window = 3,
    alpha = 0.3,
    beta = 0.1,
    gamma = 0.3,
    seasonLength = 12,
    confidenceLevel = 0.95,
  } = options;

  switch (model) {
    case "linear":
      return linearRegression(data, forecastSteps, confidenceLevel);
    case "polynomial":
      return polynomialRegression(data, degree, forecastSteps, confidenceLevel);
    case "exponential":
      return exponentialRegression(data, forecastSteps, confidenceLevel);
    case "logarithmic":
      return logarithmicRegression(data, forecastSteps, confidenceLevel);
    case "power":
      return powerRegression(data, forecastSteps, confidenceLevel);
    case "logistic":
      return logisticRegression(data, forecastSteps, confidenceLevel);
    case "moving-average":
      return movingAverage(data, window, forecastSteps);
    case "exponential-smoothing":
      return exponentialSmoothing(data, alpha, forecastSteps);
    case "holt":
      return holtLinear(data, alpha, beta, forecastSteps);
    case "holt-winters":
      return holtWinters(data, seasonLength, alpha, beta, gamma, forecastSteps);
    default:
      return linearRegression(data, forecastSteps, confidenceLevel);
  }
}

// ─── Auto-select best model ─────────────────────────────────────────────────

export function autoSelectModel(
  data: DataPoint[],
  forecastSteps: number = 0,
): { model: ModelType; result: PredictionResult } {
  const candidates: ModelType[] = [
    "linear",
    "polynomial",
    "exponential",
    "logarithmic",
    "power",
    "logistic",
  ];

  let best: { model: ModelType; result: PredictionResult } | null = null;

  for (const model of candidates) {
    try {
      const result = runPrediction(data, model, {
        forecastSteps,
        degree: 2,
      });
      if (
        !best ||
        (result.metrics.r2 > best.result.metrics.r2 &&
          isFinite(result.metrics.r2))
      ) {
        best = { model, result };
      }
    } catch {
      // Skip models that fail
    }
  }

  return best || { model: "linear", result: runPrediction(data, "linear", { forecastSteps }) };
}

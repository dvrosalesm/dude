"""
ZeroClaw Data Analyst — Python Prediction Engine

Bundled into each ZeroClaw instance's working directory alongside the
SQLite database. Provides the full data science stack for the python tool.

Usage from ZeroClaw agent:
    python tool runs code with this module pre-imported as `engine`,
    plus pandas, numpy, scipy, sklearn, statsmodels available globally.

    Example agent code:
        df = sql("SELECT date, revenue FROM sales ORDER BY date")
        result = engine.auto_forecast(df["revenue"].values, forecast_steps=6)
"""

import json
import sqlite3
import warnings
from typing import Any

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# ---------------------------------------------------------------------------
# Database access
# ---------------------------------------------------------------------------

_db_path: str | None = None


def set_db_path(path: str) -> None:
    global _db_path
    _db_path = path


def sql(query: str) -> pd.DataFrame:
    """Execute a SQL query against the workspace SQLite database."""
    if not _db_path:
        raise RuntimeError("Database not provisioned")
    conn = sqlite3.connect(_db_path)
    try:
        df = pd.read_sql_query(query, conn)
        return df
    finally:
        conn.close()


def sql_execute(query: str) -> int:
    """Execute a write query (INSERT/UPDATE/DELETE) and return rows affected."""
    if not _db_path:
        raise RuntimeError("Database not provisioned")
    conn = sqlite3.connect(_db_path)
    try:
        cursor = conn.execute(query)
        conn.commit()
        return cursor.rowcount
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Regression models
# ---------------------------------------------------------------------------


def linear_regression(
    x: np.ndarray,
    y: np.ndarray,
    forecast_steps: int = 0,
) -> dict[str, Any]:
    """Simple linear regression: y = a + bx"""
    from sklearn.linear_model import LinearRegression

    X = x.reshape(-1, 1)
    model = LinearRegression().fit(X, y)
    fitted = model.predict(X)

    result = _build_result(x, y, fitted, model.coef_[0], forecast_steps, n_params=2)
    result["coefficients"] = {"intercept": float(model.intercept_), "slope": float(model.coef_[0])}
    result["equation"] = f"y = {model.intercept_:.4f} + {model.coef_[0]:.4f}x"
    return result


def polynomial_regression(
    x: np.ndarray,
    y: np.ndarray,
    degree: int = 2,
    forecast_steps: int = 0,
) -> dict[str, Any]:
    """Polynomial regression of given degree."""
    coeffs = np.polyfit(x, y, degree)
    poly = np.poly1d(coeffs)
    fitted = poly(x)

    result = _build_result(x, y, fitted, coeffs[-2] if len(coeffs) > 1 else 0, forecast_steps, n_params=degree + 1)
    result["coefficients"] = {f"a{i}": float(c) for i, c in enumerate(reversed(coeffs))}
    terms = [f"{c:.4f}x^{degree - i}" if degree - i > 0 else f"{c:.4f}" for i, c in enumerate(coeffs)]
    result["equation"] = f"y = {' + '.join(terms)}"
    result["_poly"] = poly  # for forecast
    return result


def exponential_regression(
    x: np.ndarray,
    y: np.ndarray,
    forecast_steps: int = 0,
) -> dict[str, Any]:
    """Exponential regression: y = a * e^(bx)"""
    mask = y > 0
    if mask.sum() < 2:
        return linear_regression(x, y, forecast_steps)

    log_y = np.log(y[mask])
    coeffs = np.polyfit(x[mask], log_y, 1)
    b, ln_a = coeffs
    a = np.exp(ln_a)
    fitted = a * np.exp(b * x)

    result = _build_result(x, y, fitted, b, forecast_steps, n_params=2)
    result["coefficients"] = {"a": float(a), "b": float(b)}
    result["equation"] = f"y = {a:.4f} * e^({b:.4f}x)"
    return result


def logarithmic_regression(
    x: np.ndarray,
    y: np.ndarray,
    forecast_steps: int = 0,
) -> dict[str, Any]:
    """Logarithmic regression: y = a + b * ln(x)"""
    mask = x > 0
    if mask.sum() < 2:
        return linear_regression(x, y, forecast_steps)

    log_x = np.log(x[mask])
    coeffs = np.polyfit(log_x, y[mask], 1)
    b, a = coeffs
    fitted = a + b * np.log(np.maximum(x, 1e-10))

    result = _build_result(x, y, fitted, b, forecast_steps, n_params=2)
    result["coefficients"] = {"a": float(a), "b": float(b)}
    result["equation"] = f"y = {a:.4f} + {b:.4f} * ln(x)"
    return result


def power_regression(
    x: np.ndarray,
    y: np.ndarray,
    forecast_steps: int = 0,
) -> dict[str, Any]:
    """Power regression: y = a * x^b"""
    mask = (x > 0) & (y > 0)
    if mask.sum() < 2:
        return linear_regression(x, y, forecast_steps)

    coeffs = np.polyfit(np.log(x[mask]), np.log(y[mask]), 1)
    b, ln_a = coeffs
    a = np.exp(ln_a)
    fitted = a * np.power(np.maximum(x, 1e-10), b)

    result = _build_result(x, y, fitted, b, forecast_steps, n_params=2)
    result["coefficients"] = {"a": float(a), "b": float(b)}
    result["equation"] = f"y = {a:.4f} * x^{b:.4f}"
    return result


def logistic_regression_fit(
    x: np.ndarray,
    y: np.ndarray,
    forecast_steps: int = 0,
) -> dict[str, Any]:
    """Logistic growth: y = L / (1 + e^(-k*(x - x0)))"""
    from scipy.optimize import curve_fit

    L_init = float(np.max(y) * 1.2)

    def logistic(x, L, k, x0):
        return L / (1 + np.exp(-k * (x - x0)))

    try:
        popt, _ = curve_fit(
            logistic, x, y,
            p0=[L_init, 0.1, float(np.median(x))],
            maxfev=10000,
        )
        L, k, x0 = popt
        fitted = logistic(x, L, k, x0)
    except Exception:
        return linear_regression(x, y, forecast_steps)

    result = _build_result(x, y, fitted, k, forecast_steps, n_params=3)
    result["coefficients"] = {"L": float(L), "k": float(k), "x0": float(x0)}
    result["equation"] = f"y = {L:.2f} / (1 + e^(-{k:.4f}(x - {x0:.4f})))"
    return result


# ---------------------------------------------------------------------------
# Time series models
# ---------------------------------------------------------------------------


def moving_average(
    y: np.ndarray,
    window: int = 3,
    forecast_steps: int = 0,
) -> dict[str, Any]:
    """Simple moving average."""
    series = pd.Series(y)
    smoothed = series.rolling(window=window, min_periods=1).mean().values
    last_val = float(smoothed[-1])

    return {
        "fitted": [{"x": i, "y": float(v)} for i, v in enumerate(smoothed)],
        "forecast": [{"x": len(y) + i, "y": last_val} for i in range(forecast_steps)],
        "coefficients": {"window": window},
        "metrics": _compute_metrics(y, smoothed, 1),
        "equation": f"SMA({window})",
    }


def exponential_smoothing_fit(
    y: np.ndarray,
    forecast_steps: int = 0,
    seasonal_periods: int | None = None,
    trend: str | None = "add",
    seasonal: str | None = None,
) -> dict[str, Any]:
    """Exponential smoothing via statsmodels (SES, Holt, Holt-Winters)."""
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    if seasonal_periods and len(y) >= seasonal_periods * 2:
        seasonal = seasonal or "add"
    else:
        seasonal = None
        seasonal_periods = None

    model = ExponentialSmoothing(
        y,
        trend=trend,
        seasonal=seasonal,
        seasonal_periods=seasonal_periods,
    ).fit(optimized=True)

    fitted = model.fittedvalues

    forecast_vals = model.forecast(forecast_steps) if forecast_steps > 0 else np.array([])

    params = {k: float(v) for k, v in model.params.items() if isinstance(v, (int, float, np.floating))}

    label = "Holt-Winters" if seasonal else ("Holt" if trend else "SES")

    return {
        "fitted": [{"x": i, "y": float(v)} for i, v in enumerate(fitted)],
        "forecast": [{"x": len(y) + i, "y": float(v)} for i, v in enumerate(forecast_vals)],
        "coefficients": params,
        "metrics": _compute_metrics(y, fitted, len(params)),
        "equation": label,
    }


def arima_forecast(
    y: np.ndarray,
    order: tuple[int, int, int] = (1, 1, 1),
    forecast_steps: int = 0,
) -> dict[str, Any]:
    """ARIMA model via statsmodels."""
    from statsmodels.tsa.arima.model import ARIMA

    model = ARIMA(y, order=order).fit()
    fitted = model.fittedvalues

    forecast_vals = model.forecast(forecast_steps) if forecast_steps > 0 else np.array([])

    return {
        "fitted": [{"x": i, "y": float(v)} for i, v in enumerate(fitted)],
        "forecast": [{"x": len(y) + i, "y": float(v)} for i, v in enumerate(forecast_vals)],
        "coefficients": {"aic": float(model.aic), "bic": float(model.bic)},
        "metrics": _compute_metrics(y[len(y) - len(fitted):], fitted, sum(order)),
        "equation": f"ARIMA{order}",
    }


def auto_arima_forecast(
    y: np.ndarray,
    forecast_steps: int = 0,
    seasonal: bool = False,
    m: int = 1,
) -> dict[str, Any]:
    """Auto ARIMA — tries multiple orders and picks the best by AIC."""
    from statsmodels.tsa.arima.model import ARIMA

    best_aic = np.inf
    best_result = None
    best_order = (0, 0, 0)

    for p in range(4):
        for d in range(3):
            for q in range(4):
                try:
                    model = ARIMA(y, order=(p, d, q)).fit()
                    if model.aic < best_aic:
                        best_aic = model.aic
                        best_result = model
                        best_order = (p, d, q)
                except Exception:
                    continue

    if best_result is None:
        return arima_forecast(y, (1, 1, 1), forecast_steps)

    fitted = best_result.fittedvalues
    forecast_vals = best_result.forecast(forecast_steps) if forecast_steps > 0 else np.array([])

    return {
        "fitted": [{"x": i, "y": float(v)} for i, v in enumerate(fitted)],
        "forecast": [{"x": len(y) + i, "y": float(v)} for i, v in enumerate(forecast_vals)],
        "coefficients": {"order": list(best_order), "aic": float(best_aic)},
        "metrics": _compute_metrics(y[len(y) - len(fitted):], fitted, sum(best_order)),
        "equation": f"Auto-ARIMA{best_order}",
    }


# ---------------------------------------------------------------------------
# Interpolation
# ---------------------------------------------------------------------------


def interpolate(
    x: np.ndarray,
    y: np.ndarray,
    target_x: np.ndarray,
    method: str = "cubic",
) -> np.ndarray:
    """Interpolate data points. Methods: linear, cubic, nearest, quadratic."""
    from scipy.interpolate import interp1d

    kind = method if method in ("linear", "nearest", "quadratic", "cubic") else "cubic"
    f = interp1d(x, y, kind=kind, fill_value="extrapolate")
    return f(target_x)


# ---------------------------------------------------------------------------
# Clustering
# ---------------------------------------------------------------------------


def cluster(
    df: pd.DataFrame,
    n_clusters: int = 3,
    columns: list[str] | None = None,
) -> pd.DataFrame:
    """K-Means clustering on numeric columns. Adds a 'cluster' column."""
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler

    cols = columns or df.select_dtypes(include=[np.number]).columns.tolist()
    X = df[cols].dropna()
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    km = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
    labels = km.fit_predict(X_scaled)

    result = df.loc[X.index].copy()
    result["cluster"] = labels
    return result


# ---------------------------------------------------------------------------
# Anomaly detection
# ---------------------------------------------------------------------------


def detect_anomalies(
    df: pd.DataFrame,
    columns: list[str] | None = None,
    contamination: float = 0.05,
) -> pd.DataFrame:
    """Isolation Forest anomaly detection. Adds an 'anomaly' column (-1 = anomaly)."""
    from sklearn.ensemble import IsolationForest

    cols = columns or df.select_dtypes(include=[np.number]).columns.tolist()
    X = df[cols].dropna()

    iso = IsolationForest(contamination=contamination, random_state=42)
    labels = iso.fit_predict(X)

    result = df.loc[X.index].copy()
    result["anomaly"] = labels
    return result


# ---------------------------------------------------------------------------
# Correlation analysis
# ---------------------------------------------------------------------------


def correlation_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """Compute correlation matrix for all numeric columns."""
    return df.select_dtypes(include=[np.number]).corr()


# ---------------------------------------------------------------------------
# Unified runner
# ---------------------------------------------------------------------------

_MODEL_MAP = {
    "linear": lambda x, y, opts: linear_regression(x, y, opts.get("forecast_steps", 0)),
    "polynomial": lambda x, y, opts: polynomial_regression(x, y, opts.get("degree", 2), opts.get("forecast_steps", 0)),
    "exponential": lambda x, y, opts: exponential_regression(x, y, opts.get("forecast_steps", 0)),
    "logarithmic": lambda x, y, opts: logarithmic_regression(x, y, opts.get("forecast_steps", 0)),
    "power": lambda x, y, opts: power_regression(x, y, opts.get("forecast_steps", 0)),
    "logistic": lambda x, y, opts: logistic_regression_fit(x, y, opts.get("forecast_steps", 0)),
}


def run_prediction(
    data: list[dict],
    model: str = "linear",
    **options,
) -> dict[str, Any]:
    """
    Unified prediction runner. Accepts [{x, y}] data.

    Models: linear, polynomial, exponential, logarithmic, power, logistic,
            moving-average, exponential-smoothing, holt, holt-winters, arima, auto-arima
    """
    arr = np.array([(d["x"], d["y"]) for d in data])
    x, y = arr[:, 0], arr[:, 1]

    if model in _MODEL_MAP:
        return _MODEL_MAP[model](x, y, options)

    if model == "moving-average":
        return moving_average(y, options.get("window", 3), options.get("forecast_steps", 0))

    if model in ("exponential-smoothing", "holt", "holt-winters"):
        trend = "add" if model in ("holt", "holt-winters") else None
        seasonal = "add" if model == "holt-winters" else None
        return exponential_smoothing_fit(
            y,
            forecast_steps=options.get("forecast_steps", 0),
            seasonal_periods=options.get("season_length", 12) if seasonal else None,
            trend=trend,
            seasonal=seasonal,
        )

    if model == "arima":
        order = tuple(options.get("order", [1, 1, 1]))
        return arima_forecast(y, order, options.get("forecast_steps", 0))

    if model == "auto-arima":
        return auto_arima_forecast(y, options.get("forecast_steps", 0))

    return linear_regression(x, y, options.get("forecast_steps", 0))


def auto_select_model(
    data: list[dict],
    forecast_steps: int = 0,
) -> dict[str, Any]:
    """Try all regression models and pick the best by R²."""
    arr = np.array([(d["x"], d["y"]) for d in data])
    x, y = arr[:, 0], arr[:, 1]

    best = None
    for name, fn in _MODEL_MAP.items():
        try:
            result = fn(x, y, {"forecast_steps": forecast_steps, "degree": 2})
            r2 = result["metrics"]["r2"]
            if best is None or (np.isfinite(r2) and r2 > best["metrics"]["r2"]):
                best = result
                best["model"] = name
        except Exception:
            continue

    if best is None:
        best = linear_regression(x, y, forecast_steps)
        best["model"] = "linear"

    return best


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _compute_metrics(actual: np.ndarray, predicted: np.ndarray, n_params: int) -> dict:
    n = len(actual)
    y_mean = np.mean(actual)
    ss_tot = np.sum((actual - y_mean) ** 2)
    ss_res = np.sum((actual - predicted) ** 2)

    r2 = 1 - ss_res / ss_tot if ss_tot != 0 else 1.0
    adj_r2 = 1 - ((1 - r2) * (n - 1)) / (n - n_params - 1) if n - n_params - 1 > 0 else r2
    rmse = float(np.sqrt(ss_res / n))
    mae = float(np.mean(np.abs(actual - predicted)))

    nonzero = actual != 0
    mape = float(np.mean(np.abs((actual[nonzero] - predicted[nonzero]) / actual[nonzero])) * 100) if nonzero.any() else 0

    return {"r2": float(r2), "adjusted_r2": float(adj_r2), "rmse": rmse, "mae": mae, "mape": mape}


def _build_result(x, y, fitted, slope, forecast_steps, n_params):
    n = len(x)
    step = (x[-1] - x[0]) / (n - 1) if n > 1 else 1

    forecast = []
    for i in range(1, forecast_steps + 1):
        fx = x[-1] + step * i
        fy = fitted[-1] + slope * step * i  # naive linear extension for forecast
        forecast.append({"x": float(fx), "y": float(fy)})

    return {
        "fitted": [{"x": float(x[i]), "y": float(fitted[i])} for i in range(n)],
        "forecast": forecast,
        "metrics": _compute_metrics(y, fitted, n_params),
    }

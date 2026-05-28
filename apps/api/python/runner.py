#!/usr/bin/env python3
"""
AgentsGT Python Tool Runner — Sandboxed Execution

Executes agent-generated Python code in a restricted environment:
- pandas, numpy, scipy, sklearn, statsmodels pre-imported
- prediction_engine available as `engine`
- sql() and sql_execute() for database access
- NO filesystem access (open, os, pathlib blocked)
- NO arbitrary imports (whitelist only)
- Execution timeout enforced via SIGALRM

Usage:
    echo '{"code": "...", "db_path": "...", "input": {...}}' | python runner.py

Input JSON:
    code:    Python code to execute (last expression is the result)
    db_path: Path to the workspace SQLite database
    input:   Optional dict available as `input` variable

Output JSON:
    {"result": <serialized result>}
    or
    {"error": "<error message>"}
"""

import json
import signal
import sys
import traceback

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Execution timeout (Unix only — uses SIGALRM)
# ---------------------------------------------------------------------------

EXECUTION_TIMEOUT_SECONDS = 60


class ExecutionTimeoutError(Exception):
    pass


def _timeout_handler(signum, frame):
    raise ExecutionTimeoutError(
        f"Code execution exceeded {EXECUTION_TIMEOUT_SECONDS}s timeout"
    )


if hasattr(signal, "SIGALRM"):
    signal.signal(signal.SIGALRM, _timeout_handler)

# ---------------------------------------------------------------------------
# Import whitelist — only these modules can be imported by agent code
# ---------------------------------------------------------------------------

_real_import = __builtins__.__import__

ALLOWED_MODULES = frozenset({
    # Math & data
    "math", "decimal", "fractions", "statistics", "random",
    # Collections & iteration
    "collections", "itertools", "functools", "operator",
    # String & regex
    "re", "string", "textwrap",
    # Date & time
    "datetime", "calendar", "time",
    # Data formats
    "json", "csv", "io",
    # Typing (some agent code uses type hints)
    "typing",
    # Already pre-imported but allow explicit import too
    "numpy", "pandas", "scipy", "sklearn", "statsmodels",
})


def _safe_import(name, globals=None, locals=None, fromlist=(), level=0):
    """Import guard — only allows whitelisted modules."""
    root = name.split(".")[0]
    if root not in ALLOWED_MODULES:
        raise ImportError(
            f"Import of '{name}' is not allowed. "
            f"Available: pandas, numpy, scipy, sklearn, statsmodels, "
            f"datetime, math, json, re, collections, itertools, etc."
        )
    return _real_import(name, globals, locals, fromlist, level)


# ---------------------------------------------------------------------------
# Restricted builtins — no file access, no code generation, no introspection
# ---------------------------------------------------------------------------

SAFE_BUILTINS = {
    # Import (guarded)
    "__import__": _safe_import,

    # Constants
    "True": True,
    "False": False,
    "None": None,

    # Types & constructors
    "bool": bool,
    "int": int,
    "float": float,
    "str": str,
    "bytes": bytes,
    "bytearray": bytearray,
    "list": list,
    "tuple": tuple,
    "dict": dict,
    "set": set,
    "frozenset": frozenset,
    "complex": complex,

    # Numeric
    "abs": abs,
    "round": round,
    "min": min,
    "max": max,
    "sum": sum,
    "pow": pow,
    "divmod": divmod,

    # Iteration
    "range": range,
    "enumerate": enumerate,
    "zip": zip,
    "map": map,
    "filter": filter,
    "sorted": sorted,
    "reversed": reversed,
    "iter": iter,
    "next": next,
    "all": all,
    "any": any,

    # String & repr
    "repr": repr,
    "format": format,
    "chr": chr,
    "ord": ord,
    "hex": hex,
    "oct": oct,
    "bin": bin,

    # Type checks
    "isinstance": isinstance,
    "issubclass": issubclass,
    "type": type,
    "len": len,
    "id": id,
    "hash": hash,
    "callable": callable,
    "hasattr": hasattr,
    "getattr": getattr,
    "setattr": setattr,

    # Exceptions (needed for try/except in agent code)
    "Exception": Exception,
    "ValueError": ValueError,
    "TypeError": TypeError,
    "KeyError": KeyError,
    "IndexError": IndexError,
    "AttributeError": AttributeError,
    "ZeroDivisionError": ZeroDivisionError,
    "StopIteration": StopIteration,
    "RuntimeError": RuntimeError,

    # Suppressed
    "print": lambda *a, **kw: None,

    # BLOCKED (not included):
    # open, exec, eval, compile, __import__ (raw), globals, locals,
    # dir, vars, delattr, input, breakpoint, exit, quit,
    # memoryview, property, staticmethod, classmethod, super
}


def serialize(obj):
    """Make any result JSON-serializable."""
    if obj is None:
        return None
    if isinstance(obj, (bool, int, float, str)):
        return obj
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, pd.DataFrame):
        return {"columns": obj.columns.tolist(), "rows": obj.to_dict("records")}
    if isinstance(obj, pd.Series):
        return obj.tolist()
    if isinstance(obj, dict):
        return {str(k): serialize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [serialize(v) for v in obj]
    return str(obj)


def main():
    try:
        payload = json.loads(sys.stdin.read())
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON input: {e}"}))
        sys.exit(1)

    code = payload.get("code", "")
    db_path = payload.get("db_path", "")
    user_input = payload.get("input", {})

    if not code:
        print(json.dumps({"error": "No code provided"}))
        sys.exit(1)

    # Set up the prediction engine with the DB path
    import prediction_engine as engine
    if db_path:
        engine.set_db_path(db_path)

    # Pre-import optional modules before locking down
    scipy_mod = None
    sklearn_mod = None
    statsmodels_mod = None

    try:
        import scipy
        scipy_mod = scipy
    except ImportError:
        pass

    try:
        import sklearn
        sklearn_mod = sklearn
    except ImportError:
        pass

    try:
        import statsmodels
        statsmodels_mod = statsmodels
    except ImportError:
        pass

    # Build the execution namespace with RESTRICTED builtins
    namespace = {
        # Locked-down builtins — no open(), no raw __import__(), no exec/eval
        "__builtins__": SAFE_BUILTINS,

        # Data science stack
        "np": np,
        "numpy": np,
        "pd": pd,
        "pandas": pd,
        "engine": engine,

        # Direct access to key functions
        "sql": engine.sql,
        "sql_execute": engine.sql_execute,
        "run_prediction": engine.run_prediction,
        "auto_select_model": engine.auto_select_model,
        "interpolate": engine.interpolate,
        "cluster": engine.cluster,
        "detect_anomalies": engine.detect_anomalies,
        "correlation_matrix": engine.correlation_matrix,
        "moving_average": engine.moving_average,
        "arima_forecast": engine.arima_forecast,
        "auto_arima_forecast": engine.auto_arima_forecast,

        # User input
        "input": user_input,

        # JSON
        "json": json,
    }

    # Add optional modules if available
    if scipy_mod:
        namespace["scipy"] = scipy_mod
    if sklearn_mod:
        namespace["sklearn"] = sklearn_mod
    if statsmodels_mod:
        namespace["statsmodels"] = statsmodels_mod

    try:
        result = None

        # Arm the timeout (Unix only)
        if hasattr(signal, "SIGALRM"):
            signal.alarm(EXECUTION_TIMEOUT_SECONDS)

        try:
            if "\nreturn " in code or code.strip().startswith("return "):
                # Wrap in function
                indented = "\n".join("    " + line for line in code.splitlines())
                wrapped = f"def __run__():\n{indented}\n__result__ = __run__()"
                exec(wrapped, namespace)
                result = namespace.get("__result__")
            else:
                exec(code, namespace)
                # Check if the code assigned to `result`
                result = namespace.get("result", namespace.get("__result__"))
        finally:
            # Disarm the timeout
            if hasattr(signal, "SIGALRM"):
                signal.alarm(0)

        print(json.dumps({"result": serialize(result)}))

    except Exception as e:
        tb = traceback.format_exc()
        print(json.dumps({"error": f"{type(e).__name__}: {e}", "traceback": tb}))
        sys.exit(1)


if __name__ == "__main__":
    main()

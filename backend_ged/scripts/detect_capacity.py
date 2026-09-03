"""Calcule workers Gunicorn et OCR selon le CPU / la RAM visibles dans Docker."""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _read_int_file(path: Path) -> int | None:
    try:
        raw = path.read_text(encoding="utf-8").strip()
    except OSError:
        return None
    if not raw or raw == "max":
        return None
    try:
        value = int(raw.split()[0])
    except ValueError:
        return None
    if value <= 0 or value >= (1 << 62):
        return None
    return value


def cpu_count() -> int:
    cpu_max = Path("/sys/fs/cgroup/cpu.max")
    if cpu_max.exists():
        try:
            quota, period = cpu_max.read_text(encoding="utf-8").split()[:2]
            if quota != "max" and int(period) > 0:
                return max(1, round(int(quota) / int(period)))
        except (OSError, ValueError):
            pass
    try:
        return max(1, len(os.sched_getaffinity(0)))
    except (AttributeError, OSError):
        pass
    return max(1, os.cpu_count() or 2)


def memory_gb() -> float:
    for path in (
        Path("/sys/fs/cgroup/memory.max"),
        Path("/sys/fs/cgroup/memory/memory.limit_in_bytes"),
    ):
        value = _read_int_file(path)
        if value:
            return value / (1024 ** 3)
    try:
        for line in Path("/proc/meminfo").read_text(encoding="utf-8").splitlines():
            if line.startswith("MemTotal:"):
                kb = int(line.split()[1])
                return kb / (1024 ** 2)
    except (OSError, ValueError):
        pass
    return 8.0


def _is_auto(name: str) -> bool:
    value = (os.environ.get(name) or "").strip().lower()
    return value in ("", "auto")


def plan(cpus: int, mem_gb: float) -> dict[str, int]:
    """Barème conservateur : laisse de la marge à SQL Server (hôte) et au frontend."""
    cpus = max(1, int(cpus))
    mem_gb = max(1.0, float(mem_gb))

    if mem_gb < 6:
        ocr = 1
    elif mem_gb < 10:
        ocr = 2
    elif mem_gb < 18:
        ocr = 3
    elif mem_gb < 32:
        ocr = 4
    elif mem_gb < 48:
        ocr = 6
    elif mem_gb < 80:
        ocr = 8
    else:
        ocr = 10

    ocr = min(ocr, max(1, cpus // 2), 10)
    workers = min(8, max(2, cpus // 2))
    threads = 2 if mem_gb < 8 else 4
    ocr_threads = 1 if ocr >= 4 else 2
    return {
        "GUNICORN_WORKERS": workers,
        "GUNICORN_THREADS": threads,
        "OCR_MAX_PARALLEL": ocr,
        "OCR_WORKER_THREADS": ocr_threads,
    }


def main() -> None:
    cpus = cpu_count()
    mem_gb = memory_gb()
    computed = plan(cpus, mem_gb)
    chosen = {}
    for key, value in computed.items():
        if _is_auto(key):
            chosen[key] = value
        else:
            chosen[key] = int(os.environ[key])

    print(
        f"GED capacité détectée : {cpus} CPU, {mem_gb:.1f} Go RAM "
        f"→ {chosen['GUNICORN_WORKERS']} workers × {chosen['GUNICORN_THREADS']} threads, "
        f"{chosen['OCR_MAX_PARALLEL']} OCR",
        file=sys.stderr,
    )
    for key, value in chosen.items():
        print(f"export {key}={value}")


if __name__ == "__main__":
    main()

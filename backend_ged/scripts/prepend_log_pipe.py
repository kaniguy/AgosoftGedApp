"""Relaie stdin vers stdout et écrit chaque ligne en tête du fichier de log."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from config.prepend_log import prepend_to_file  # noqa: E402


def main() -> None:
    log_path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "logs" / "logs_backend"
    for line in sys.stdin:
        sys.stdout.write(line)
        sys.stdout.flush()
        prepend_to_file(log_path, line.rstrip("\r\n"))


if __name__ == "__main__":
    main()

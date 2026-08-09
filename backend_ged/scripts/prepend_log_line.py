"""Ajoute une ligne en tête du fichier de log."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from config.prepend_log import prepend_to_file  # noqa: E402


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit("Usage: prepend_log_line.py <fichier> <message>")
    prepend_to_file(sys.argv[1], sys.argv[2])


if __name__ == "__main__":
    main()

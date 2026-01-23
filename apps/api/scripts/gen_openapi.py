"""Generate OpenAPI schema from FastAPI app.

Run with: uv run poe gen:openapi
"""

import json
from pathlib import Path

from src.main import app

OUTPUT_PATH = Path(__file__).parent.parent / "openapi.json"


def main() -> None:
    """Generate OpenAPI schema."""
    schema = app.openapi()

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)

    print(f"OpenAPI schema generated: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

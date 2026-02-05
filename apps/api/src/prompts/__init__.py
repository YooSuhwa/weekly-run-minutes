"""Prompt management for AI services."""

from pathlib import Path

# Prompts directory
PROMPTS_DIR = Path(__file__).parent

# Cache for loaded prompts
_prompt_cache: dict[str, str] = {}


def load_prompt(name: str) -> str:
    """Load a prompt from the prompts directory.

    Args:
        name: Prompt file name without extension (e.g., "minutes_system")

    Returns:
        Prompt content as string

    Raises:
        FileNotFoundError: If prompt file doesn't exist
    """
    if name in _prompt_cache:
        return _prompt_cache[name]

    prompt_path = PROMPTS_DIR / f"{name}.md"
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")

    content = prompt_path.read_text(encoding="utf-8")
    _prompt_cache[name] = content
    return content


def clear_prompt_cache() -> None:
    """Clear the prompt cache. Useful for development/testing."""
    _prompt_cache.clear()

"""Transcript text file parser service.

Parses plain text transcript files (.txt) into structured segments,
supporting optional speaker labels in various formats.
"""

import re
from dataclasses import dataclass

from src.lib.logging import get_logger

logger = get_logger(__name__)

# Speaker label patterns (order matters - more specific first)
# [발화자 1] text... / [speaker 1] text... / [Speaker 1] text...
_BRACKET_PATTERN = re.compile(r"^\[([^\]]+)\]\s*(.+)", re.DOTALL)
# 발화자 1: text... (colon separator, label must be < 30 chars)
_COLON_PATTERN = re.compile(r"^([^:\n]{1,29}):\s+(.+)", re.DOTALL)


@dataclass
class ParsedSegment:
    """A parsed transcript segment."""

    text: str
    speaker_label: str | None = None
    start_time: float = 0.0
    end_time: float = 0.0


def parse_transcript_text(text: str) -> list[ParsedSegment]:
    """Parse transcript text into structured segments.

    Splits text by blank lines (\\n\\n) into blocks, then attempts to
    extract speaker labels from each block.

    Args:
        text: Raw transcript text content

    Returns:
        List of ParsedSegment with sequential synthetic timestamps
    """
    if not text or not text.strip():
        return []

    # Split by blank lines
    blocks = re.split(r"\n\s*\n", text.strip())
    segments: list[ParsedSegment] = []

    for i, block in enumerate(blocks):
        block = block.strip()
        if not block:
            continue

        speaker_label, content = _extract_speaker_label(block)

        if not content.strip():
            continue

        segments.append(
            ParsedSegment(
                text=content.strip(),
                speaker_label=speaker_label,
                start_time=float(i),
                end_time=float(i + 1),
            )
        )

    return segments


def _extract_speaker_label(block: str) -> tuple[str | None, str]:
    """Extract speaker label from a text block.

    Tries bracket format first, then colon format.

    Args:
        block: A single text block

    Returns:
        Tuple of (speaker_label, remaining_text)
    """
    # Try bracket format: [Speaker Name] text...
    match = _BRACKET_PATTERN.match(block)
    if match:
        return match.group(1).strip(), match.group(2)

    # Try colon format: Speaker Name: text... (label < 30 chars)
    match = _COLON_PATTERN.match(block)
    if match:
        label_candidate = match.group(1).strip()
        # Avoid matching URLs, timestamps, or other colon-containing patterns
        if not re.search(r"https?://|^\d{1,2}:\d{2}", label_candidate):
            return label_candidate, match.group(2)

    # No speaker label found
    return None, block


def decode_transcript_file(content: bytes) -> str:
    """Decode transcript file content with encoding fallback.

    Tries UTF-8 first, then falls back to euc-kr.

    Args:
        content: Raw file bytes

    Returns:
        Decoded text string

    Raises:
        ValueError: If content cannot be decoded with any supported encoding
    """
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        pass

    try:
        return content.decode("euc-kr")
    except UnicodeDecodeError:
        raise ValueError("파일 인코딩을 인식할 수 없습니다 (UTF-8, EUC-KR 지원)")

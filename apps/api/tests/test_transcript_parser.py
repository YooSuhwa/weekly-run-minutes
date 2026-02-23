"""Tests for transcript text file parser service."""

import pytest

from src.services.transcript_parser import (
    ParsedSegment,
    decode_transcript_file,
    parse_transcript_text,
)


class TestParseTranscriptText:
    """Tests for parse_transcript_text function."""

    def test_empty_text(self):
        assert parse_transcript_text("") == []

    def test_whitespace_only(self):
        assert parse_transcript_text("   \n\n  ") == []

    def test_single_block_no_speaker(self):
        text = "안녕하세요, 주간회의 시작하겠습니다."
        result = parse_transcript_text(text)
        assert len(result) == 1
        assert result[0].text == "안녕하세요, 주간회의 시작하겠습니다."
        assert result[0].speaker_label is None
        assert result[0].start_time == 0.0
        assert result[0].end_time == 1.0

    def test_multiple_blocks_no_speaker(self):
        text = "첫 번째 발화입니다.\n\n두 번째 발화입니다.\n\n세 번째 발화입니다."
        result = parse_transcript_text(text)
        assert len(result) == 3
        assert result[0].text == "첫 번째 발화입니다."
        assert result[1].text == "두 번째 발화입니다."
        assert result[2].text == "세 번째 발화입니다."

    def test_sequential_timestamps(self):
        text = "블록1\n\n블록2\n\n블록3"
        result = parse_transcript_text(text)
        assert result[0].start_time == 0.0
        assert result[0].end_time == 1.0
        assert result[1].start_time == 1.0
        assert result[1].end_time == 2.0
        assert result[2].start_time == 2.0
        assert result[2].end_time == 3.0

    def test_bracket_speaker_label(self):
        text = "[이상윤] 이번 주 업무 보고 드리겠습니다."
        result = parse_transcript_text(text)
        assert len(result) == 1
        assert result[0].speaker_label == "이상윤"
        assert result[0].text == "이번 주 업무 보고 드리겠습니다."

    def test_bracket_speaker_label_english(self):
        text = "[Speaker 1] This is a test."
        result = parse_transcript_text(text)
        assert result[0].speaker_label == "Speaker 1"
        assert result[0].text == "This is a test."

    def test_bracket_speaker_lowercase(self):
        text = "[speaker 1] 테스트 발화입니다."
        result = parse_transcript_text(text)
        assert result[0].speaker_label == "speaker 1"

    def test_colon_speaker_label(self):
        text = "이상윤: 이번 주 업무 보고 드리겠습니다."
        result = parse_transcript_text(text)
        assert len(result) == 1
        assert result[0].speaker_label == "이상윤"
        assert result[0].text == "이번 주 업무 보고 드리겠습니다."

    def test_colon_speaker_label_long_name_ignored(self):
        """Labels longer than 29 chars should not be treated as speaker labels."""
        text = "이것은 매우 긴 텍스트로 화자 레이블이 아닙니다 이런 경우: 텍스트 전체가 내용입니다."
        result = parse_transcript_text(text)
        assert result[0].speaker_label is None

    def test_url_not_treated_as_speaker(self):
        """URLs with colons should not be parsed as speaker labels."""
        text = "https://example.com: 이것은 URL입니다."
        result = parse_transcript_text(text)
        assert result[0].speaker_label is None

    def test_multiple_blocks_with_speakers(self):
        text = "[이상윤] 안녕하세요.\n\n[선설희] 네, 안녕하세요.\n\n[최보연] 발표 시작하겠습니다."
        result = parse_transcript_text(text)
        assert len(result) == 3
        assert result[0].speaker_label == "이상윤"
        assert result[1].speaker_label == "선설희"
        assert result[2].speaker_label == "최보연"

    def test_mixed_format_some_with_labels(self):
        """Some blocks have labels, some don't."""
        text = "[이상윤] 안녕하세요.\n\n잡담 내용입니다.\n\n[선설희] 업무 보고합니다."
        result = parse_transcript_text(text)
        assert len(result) == 3
        assert result[0].speaker_label == "이상윤"
        assert result[1].speaker_label is None
        assert result[2].speaker_label == "선설희"

    def test_mixed_bracket_and_colon_formats(self):
        text = "[이상윤] 안녕하세요.\n\n선설희: 네, 안녕하세요."
        result = parse_transcript_text(text)
        assert len(result) == 2
        assert result[0].speaker_label == "이상윤"
        assert result[1].speaker_label == "선설희"

    def test_multiline_block(self):
        text = "[이상윤] 이번 주에는\nSDK 연동 작업을 했습니다.\n테스트도 완료했습니다."
        result = parse_transcript_text(text)
        assert len(result) == 1
        assert result[0].speaker_label == "이상윤"
        assert "SDK 연동" in result[0].text
        assert "테스트도 완료" in result[0].text

    def test_special_characters(self):
        text = "[화자1] C++ 개발, Java/Kotlin 연동 (50% 진행)"
        result = parse_transcript_text(text)
        assert result[0].text == "C++ 개발, Java/Kotlin 연동 (50% 진행)"

    def test_extra_blank_lines_between_blocks(self):
        text = "첫 번째\n\n\n\n두 번째"
        result = parse_transcript_text(text)
        assert len(result) == 2

    def test_trailing_leading_whitespace(self):
        text = "  \n\n  첫 번째 발화  \n\n  두 번째 발화  \n\n  "
        result = parse_transcript_text(text)
        assert len(result) == 2
        assert result[0].text == "첫 번째 발화"
        assert result[1].text == "두 번째 발화"

    def test_발화자_pattern(self):
        """Korean '발화자' pattern in brackets."""
        text = "[발화자 1] 테스트입니다."
        result = parse_transcript_text(text)
        assert result[0].speaker_label == "발화자 1"


class TestDecodeTranscriptFile:
    """Tests for decode_transcript_file function."""

    def test_utf8_encoding(self):
        text = "안녕하세요, 테스트입니다."
        result = decode_transcript_file(text.encode("utf-8"))
        assert result == text

    def test_euc_kr_encoding(self):
        text = "안녕하세요, 테스트입니다."
        result = decode_transcript_file(text.encode("euc-kr"))
        assert result == text

    def test_ascii_text(self):
        text = "Hello, this is a test."
        result = decode_transcript_file(text.encode("ascii"))
        assert result == text

    def test_unsupported_encoding(self):
        # Create bytes that are invalid in both UTF-8 and EUC-KR
        invalid_bytes = bytes([0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87])
        with pytest.raises(ValueError, match="인코딩을 인식할 수 없습니다"):
            decode_transcript_file(invalid_bytes)

    def test_empty_content(self):
        result = decode_transcript_file(b"")
        assert result == ""

    def test_utf8_bom(self):
        """UTF-8 with BOM should be decoded correctly."""
        text = "테스트"
        bom_content = b"\xef\xbb\xbf" + text.encode("utf-8")
        result = decode_transcript_file(bom_content)
        assert "테스트" in result

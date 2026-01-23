"""Tests for question tree generation service."""

import pytest

from src.services.question_tree import (
    QuestionTree,
    QuestionTreeService,
)
from src.services.weekly_report_parser import (
    MemberTasks,
    ParsedWeeklyReport,
    TaskCategory,
    TaskItem,
)


@pytest.fixture
def service():
    return QuestionTreeService()


@pytest.fixture
def sample_report():
    """Sample parsed weekly report."""
    return ParsedWeeklyReport(
        team_members=[
            MemberTasks(
                name="이상윤",
                categories=[
                    TaskCategory(
                        name="AI",
                        tasks=[
                            TaskItem(
                                status="진행",
                                title="GPT 프롬프트 최적화",
                                details=["v2 작성 완료", "정확도 15% 향상"],
                            ),
                            TaskItem(
                                status="완료",
                                title="SDK v2.1 릴리즈",
                                details=["1/21 릴리즈"],
                            ),
                        ],
                    ),
                    TaskCategory(
                        name="기타",
                        tasks=[
                            TaskItem(status="예정", title="코드 리뷰", details=[]),
                        ],
                    ),
                ],
            ),
            MemberTasks(
                name="선설희",
                categories=[
                    TaskCategory(
                        name="HWP",
                        tasks=[
                            TaskItem(
                                status="진행",
                                title="HWP 파서 성능 개선",
                                details=["대용량 파일 50% 단축 목표"],
                            ),
                        ],
                    ),
                ],
            ),
            MemberTasks(
                name="최보연",
                categories=[
                    TaskCategory(
                        name="SDK",
                        tasks=[
                            TaskItem(status="진행", title="SDK 문서 작성", details=[]),
                        ],
                    ),
                ],
            ),
        ]
    )


class TestQuestionTreeGeneration:
    def test_basic_tree_generation(self, service, sample_report):
        """Test tree generation with all attendees."""
        attendees = ["이상윤", "선설희", "최보연"]
        tree = service.generate_tree(sample_report, attendees)

        assert len(tree.speakers) == 3
        assert tree.speakers[0].speaker_name == "이상윤"
        assert tree.speakers[1].speaker_name == "선설희"

    def test_skip_absent_members(self, service, sample_report):
        """Test that absent members are skipped."""
        attendees = ["이상윤", "선설희"]  # 최보연 absent
        tree = service.generate_tree(sample_report, attendees)

        assert len(tree.speakers) == 2
        names = [s.speaker_name for s in tree.speakers]
        assert "최보연" not in names

    def test_categories_preserved(self, service, sample_report):
        """Test that categories are preserved."""
        attendees = ["이상윤"]
        tree = service.generate_tree(sample_report, attendees)

        speaker = tree.speakers[0]
        assert len(speaker.categories) == 2
        assert speaker.categories[0].name == "AI"
        assert speaker.categories[1].name == "기타"

    def test_items_per_category(self, service, sample_report):
        """Test items within categories."""
        attendees = ["이상윤"]
        tree = service.generate_tree(sample_report, attendees)

        ai_cat = tree.speakers[0].categories[0]
        assert len(ai_cat.items) == 2
        assert ai_cat.items[0].title == "GPT 프롬프트 최적화"
        assert ai_cat.items[1].title == "SDK v2.1 릴리즈"

    def test_status_based_questions(self, service, sample_report):
        """Test that questions are generated based on status."""
        attendees = ["이상윤"]
        tree = service.generate_tree(sample_report, attendees)

        ai_items = tree.speakers[0].categories[0].items
        # 진행 status
        assert "진행 상황" in ai_items[0].question
        # 완료 status
        assert "완료 내용" in ai_items[1].question

        etc_items = tree.speakers[0].categories[1].items
        # 예정 status
        assert "예정된 계획" in etc_items[0].question

    def test_hints_from_details(self, service, sample_report):
        """Test that hints are populated from task details."""
        attendees = ["이상윤"]
        tree = service.generate_tree(sample_report, attendees)

        first_item = tree.speakers[0].categories[0].items[0]
        assert len(first_item.hints) == 2
        assert "v2 작성 완료" in first_item.hints

    def test_no_hints_when_no_details(self, service, sample_report):
        """Test empty hints when no details."""
        attendees = ["이상윤"]
        tree = service.generate_tree(sample_report, attendees)

        last_item = tree.speakers[0].categories[1].items[0]
        assert len(last_item.hints) == 0

    def test_empty_report(self, service):
        """Test with empty report."""
        report = ParsedWeeklyReport(team_members=[])
        tree = service.generate_tree(report, ["이상윤"])

        assert len(tree.speakers) == 0

    def test_member_with_no_categories(self, service):
        """Test member with no categories."""
        report = ParsedWeeklyReport(
            team_members=[MemberTasks(name="이상윤", categories=[])]
        )
        tree = service.generate_tree(report, ["이상윤"])

        assert len(tree.speakers) == 0  # No categories = no questions

    def test_empty_attendees(self, service, sample_report):
        """Test with no attendees."""
        tree = service.generate_tree(sample_report, [])
        assert len(tree.speakers) == 0

    def test_is_completed_default_false(self, service, sample_report):
        """Test that items start as not completed."""
        attendees = ["이상윤"]
        tree = service.generate_tree(sample_report, attendees)

        for speaker in tree.speakers:
            for cat in speaker.categories:
                for item in cat.items:
                    assert item.is_completed is False


class TestQuestionTreeSerialization:
    def test_to_dict(self, service, sample_report):
        """Test serialization to dict."""
        tree = service.generate_tree(sample_report, ["이상윤"])
        data = tree.to_dict()

        assert "speakers" in data
        assert len(data["speakers"]) == 1
        assert data["speakers"][0]["speaker_name"] == "이상윤"
        assert len(data["speakers"][0]["categories"]) == 2

    def test_from_dict(self, service, sample_report):
        """Test deserialization from dict."""
        tree = service.generate_tree(sample_report, ["이상윤"])
        data = tree.to_dict()
        restored = QuestionTree.from_dict(data)

        assert len(restored.speakers) == 1
        assert restored.speakers[0].speaker_name == "이상윤"
        assert len(restored.speakers[0].categories) == 2
        assert restored.speakers[0].categories[0].items[0].question == tree.speakers[0].categories[0].items[0].question

    def test_roundtrip(self, service, sample_report):
        """Test dict roundtrip preserves all data."""
        tree = service.generate_tree(sample_report, ["이상윤", "선설희"])
        data = tree.to_dict()
        restored = QuestionTree.from_dict(data)

        assert restored.to_dict() == data

    def test_from_empty_dict(self):
        """Test deserialization from empty dict."""
        tree = QuestionTree.from_dict({})
        assert len(tree.speakers) == 0

    def test_from_dict_with_missing_fields(self):
        """Test deserialization handles missing optional fields."""
        data = {
            "speakers": [
                {
                    "speaker_name": "Test",
                    "categories": [
                        {
                            "name": "Cat",
                            "items": [
                                {
                                    "status": "진행",
                                    "title": "Task",
                                    "question": "Q?",
                                }
                            ],
                        }
                    ],
                }
            ]
        }
        tree = QuestionTree.from_dict(data)
        assert tree.speakers[0].categories[0].items[0].hints == []
        assert tree.speakers[0].categories[0].items[0].is_completed is False

"""Question tree generation service for realtime meeting orchestration."""

from dataclasses import dataclass, field

from src.lib.logging import get_logger
from src.services.weekly_report_parser import MemberTasks, ParsedWeeklyReport

logger = get_logger(__name__)


@dataclass
class QuestionItem:
    """Individual question for a task item."""

    status: str  # "완료" | "진행" | "예정"
    title: str
    question: str
    hints: list[str] = field(default_factory=list)
    is_completed: bool = False


@dataclass
class QuestionCategory:
    """Category grouping of questions (대분류)."""

    name: str
    items: list[QuestionItem] = field(default_factory=list)


@dataclass
class SpeakerQuestions:
    """Questions for a single speaker."""

    speaker_name: str
    categories: list[QuestionCategory] = field(default_factory=list)


@dataclass
class QuestionTree:
    """Complete question tree for a meeting."""

    speakers: list[SpeakerQuestions] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Serialize to dict for JSON storage."""
        return {
            "speakers": [
                {
                    "speaker_name": s.speaker_name,
                    "categories": [
                        {
                            "name": c.name,
                            "items": [
                                {
                                    "status": i.status,
                                    "title": i.title,
                                    "question": i.question,
                                    "hints": i.hints,
                                    "is_completed": i.is_completed,
                                }
                                for i in c.items
                            ],
                        }
                        for c in s.categories
                    ],
                }
                for s in self.speakers
            ]
        }

    @classmethod
    def from_dict(cls, data: dict) -> "QuestionTree":
        """Deserialize from dict."""
        speakers = []
        for s in data.get("speakers", []):
            categories = []
            for c in s.get("categories", []):
                items = [
                    QuestionItem(
                        status=i["status"],
                        title=i["title"],
                        question=i["question"],
                        hints=i.get("hints", []),
                        is_completed=i.get("is_completed", False),
                    )
                    for i in c.get("items", [])
                ]
                categories.append(QuestionCategory(name=c["name"], items=items))
            speakers.append(SpeakerQuestions(speaker_name=s["speaker_name"], categories=categories))
        return cls(speakers=speakers)


# Question templates by status
STATUS_QUESTIONS = {
    "완료": "{title} 완료 내용을 말씀해주세요.",
    "진행": "{title} 진행 상황을 말씀해주세요.",
    "예정": "{title} 예정된 계획을 말씀해주세요.",
}


class QuestionTreeService:
    """Generate structured question tree from parsed weekly report."""

    def generate_tree(
        self,
        parsed_report: ParsedWeeklyReport,
        attendees: list[str],
    ) -> QuestionTree:
        """Generate question tree from weekly report.

        Args:
            parsed_report: Parsed weekly report with member tasks
            attendees: List of attendee names (only generate for these)

        Returns:
            QuestionTree with structured questions per speaker
        """
        speakers = []

        for member in parsed_report.team_members:
            # Skip members not in attendees
            if member.name not in attendees:
                logger.debug("Skipping absent member", member=member.name)
                continue

            speaker_questions = self._generate_speaker_questions(member)
            if speaker_questions.categories:
                speakers.append(speaker_questions)

        tree = QuestionTree(speakers=speakers)
        logger.info(
            "Question tree generated",
            speakers=len(tree.speakers),
            total_items=sum(
                len(item) for s in tree.speakers for c in s.categories for item in [c.items]
            ),
        )
        return tree

    def _generate_speaker_questions(self, member: MemberTasks) -> SpeakerQuestions:
        """Generate questions for a single speaker."""
        categories = []

        for category in member.categories:
            items = []
            for task in category.tasks:
                question = STATUS_QUESTIONS.get(task.status, "{title}에 대해 말씀해주세요.").format(
                    title=task.title
                )

                hints = task.details[:3] if task.details else []

                items.append(
                    QuestionItem(
                        status=task.status,
                        title=task.title,
                        question=question,
                        hints=hints,
                    )
                )

            if items:
                categories.append(QuestionCategory(name=category.name, items=items))

        return SpeakerQuestions(speaker_name=member.name, categories=categories)

"""Tests for weekly report HTML parser."""


from src.services.weekly_report_parser import (
    WeeklyReportHTMLParser,
    WeeklyReportParser,
)


class TestWeeklyReportHTMLParser:
    """Tests for the HTML table parser."""

    def test_empty_html(self):
        parser = WeeklyReportHTMLParser()
        parser.feed("")
        assert parser.get_rows() == []

    def test_no_table(self):
        parser = WeeklyReportHTMLParser()
        parser.feed("<div><p>Hello</p></div>")
        assert parser.get_rows() == []

    def test_simple_table(self):
        html = """
        <table>
            <tr><th>이름</th><th>대분류</th><th>업무</th><th>상세</th></tr>
            <tr><td>이상윤</td><td>AI</td><td>[진행] 모델 학습</td><td>데이터 수집 중</td></tr>
        </table>
        """
        parser = WeeklyReportHTMLParser()
        parser.feed(html)
        rows = parser.get_rows()
        assert len(rows) == 2
        assert rows[0] == ["이름", "대분류", "업무", "상세"]
        assert rows[1] == ["이상윤", "AI", "[진행] 모델 학습", "데이터 수집 중"]

    def test_merged_cells(self):
        """Test table with merged cells (empty cells for same member)."""
        html = """
        <table>
            <tr><th>이름</th><th>대분류</th><th>업무</th><th>상세</th></tr>
            <tr><td>이상윤</td><td>AI</td><td>[진행] 모델 학습</td><td>데이터 수집</td></tr>
            <tr><td></td><td></td><td>[완료] API 연동</td><td>테스트 완료</td></tr>
        </table>
        """
        parser = WeeklyReportHTMLParser()
        parser.feed(html)
        rows = parser.get_rows()
        assert len(rows) == 3
        assert rows[2] == ["", "", "[완료] API 연동", "테스트 완료"]

    def test_br_in_cell(self):
        """Test <br> tags within cells are converted to newlines."""
        html = """
        <table>
            <tr><td>항목1<br>항목2<br>항목3</td></tr>
        </table>
        """
        parser = WeeklyReportHTMLParser()
        parser.feed(html)
        rows = parser.get_rows()
        assert len(rows) == 1
        assert "\n" in rows[0][0]

    def test_nested_tags_in_cells(self):
        """Test that nested HTML tags don't break parsing."""
        html = """
        <table>
            <tr><td><strong>이상윤</strong></td><td>AI</td></tr>
        </table>
        """
        parser = WeeklyReportHTMLParser()
        parser.feed(html)
        rows = parser.get_rows()
        assert rows[0][0] == "이상윤"


class TestWeeklyReportParser:
    """Tests for the main parser class."""

    def setup_method(self):
        self.parser = WeeklyReportParser()

    def test_parse_empty_html(self):
        result = self.parser.parse("")
        assert result == {"team_members": []}

    def test_parse_no_data_rows(self):
        html = """
        <table>
            <tr><th>이름</th><th>대분류</th><th>업무</th><th>상세</th></tr>
        </table>
        """
        result = self.parser.parse(html)
        assert result == {"team_members": []}

    def test_parse_single_member_single_task(self):
        html = """
        <table>
            <tr><th>이름</th><th>대분류</th><th>업무</th><th>상세</th></tr>
            <tr><td>이상윤</td><td>AI</td><td>[완료] 모델 배포</td><td>v2.0 릴리즈</td></tr>
        </table>
        """
        result = self.parser.parse(html)
        assert len(result["team_members"]) == 1
        member = result["team_members"][0]
        assert member["name"] == "이상윤"
        assert len(member["categories"]) == 1
        assert member["categories"][0]["name"] == "AI"
        assert len(member["categories"][0]["tasks"]) == 1
        task = member["categories"][0]["tasks"][0]
        assert task["status"] == "완료"
        assert task["title"] == "모델 배포"
        assert task["details"] == ["v2.0 릴리즈"]

    def test_parse_multiple_members(self):
        html = """
        <table>
            <tr><th>이름</th><th>대분류</th><th>업무</th><th>상세</th></tr>
            <tr><td>이상윤</td><td>AI</td><td>[진행] 작업1</td><td></td></tr>
            <tr><td>선설희</td><td>SDK</td><td>[완료] 작업2</td><td></td></tr>
        </table>
        """
        result = self.parser.parse(html)
        assert len(result["team_members"]) == 2
        assert result["team_members"][0]["name"] == "이상윤"
        assert result["team_members"][1]["name"] == "선설희"

    def test_parse_multiple_categories(self):
        html = """
        <table>
            <tr><th>이름</th><th>대분류</th><th>업무</th><th>상세</th></tr>
            <tr><td>이상윤</td><td>AI</td><td>[진행] 작업1</td><td></td></tr>
            <tr><td></td><td>SDK</td><td>[완료] 작업2</td><td></td></tr>
        </table>
        """
        result = self.parser.parse(html)
        assert len(result["team_members"]) == 1
        member = result["team_members"][0]
        assert len(member["categories"]) == 2
        assert member["categories"][0]["name"] == "AI"
        assert member["categories"][1]["name"] == "SDK"

    def test_parse_multiple_tasks_in_category(self):
        html = """
        <table>
            <tr><th>이름</th><th>대분류</th><th>업무</th><th>상세</th></tr>
            <tr><td>이상윤</td><td>AI</td><td>[진행] 작업1</td><td></td></tr>
            <tr><td></td><td></td><td>[완료] 작업2</td><td></td></tr>
            <tr><td></td><td></td><td>[예정] 작업3</td><td></td></tr>
        </table>
        """
        result = self.parser.parse(html)
        member = result["team_members"][0]
        assert len(member["categories"][0]["tasks"]) == 3
        assert member["categories"][0]["tasks"][0]["status"] == "진행"
        assert member["categories"][0]["tasks"][1]["status"] == "완료"
        assert member["categories"][0]["tasks"][2]["status"] == "예정"

    def test_parse_status_tags(self):
        """Test various status tag formats."""
        html = """
        <table>
            <tr><th>이름</th><th>대분류</th><th>업무</th><th>상세</th></tr>
            <tr><td>이상윤</td><td>AI</td><td>[done] Task A</td><td></td></tr>
            <tr><td></td><td></td><td>[ing] Task B</td><td></td></tr>
            <tr><td></td><td></td><td>[wip] Task C</td><td></td></tr>
            <tr><td></td><td></td><td>[todo] Task D</td><td></td></tr>
            <tr><td></td><td></td><td>[plan] Task E</td><td></td></tr>
        </table>
        """
        result = self.parser.parse(html)
        tasks = result["team_members"][0]["categories"][0]["tasks"]
        assert tasks[0]["status"] == "완료"
        assert tasks[1]["status"] == "진행"
        assert tasks[2]["status"] == "진행"
        assert tasks[3]["status"] == "예정"
        assert tasks[4]["status"] == "예정"

    def test_parse_default_status(self):
        """Tasks without status tag default to '진행'."""
        html = """
        <table>
            <tr><th>이름</th><th>대분류</th><th>업무</th><th>상세</th></tr>
            <tr><td>이상윤</td><td>AI</td><td>상태 없는 업무</td><td></td></tr>
        </table>
        """
        result = self.parser.parse(html)
        task = result["team_members"][0]["categories"][0]["tasks"][0]
        assert task["status"] == "진행"
        assert task["title"] == "상태 없는 업무"

    def test_parse_details_with_bullets(self):
        """Test parsing details with bullet points."""
        html = """
        <table>
            <tr><th>이름</th><th>대분류</th><th>업무</th><th>상세</th></tr>
            <tr><td>이상윤</td><td>AI</td><td>[진행] 작업</td><td>항목1• 항목2• 항목3</td></tr>
        </table>
        """
        result = self.parser.parse(html)
        task = result["team_members"][0]["categories"][0]["tasks"][0]
        assert len(task["details"]) == 3

    def test_parse_short_rows(self):
        """Test handling of rows with fewer than 4 columns."""
        html = """
        <table>
            <tr><th>이름</th><th>업무</th></tr>
            <tr><td>이상윤</td><td>[진행] 작업</td></tr>
        </table>
        """
        result = self.parser.parse(html)
        # Should handle gracefully with padding
        assert isinstance(result["team_members"], list)

    def test_get_member_summary(self):
        parsed_data = {
            "team_members": [
                {
                    "name": "이상윤",
                    "categories": [
                        {
                            "name": "AI",
                            "tasks": [
                                {"status": "완료", "title": "모델 배포", "details": ["v2.0"]},
                                {"status": "진행", "title": "데이터 수집", "details": []},
                            ],
                        }
                    ],
                }
            ]
        }
        summary = self.parser.get_member_summary(parsed_data, "이상윤")
        assert "이상윤" in summary
        assert "AI" in summary
        assert "모델 배포" in summary
        assert "데이터 수집" in summary
        assert "✅" in summary
        assert "🔄" in summary

    def test_get_member_summary_not_found(self):
        parsed_data = {"team_members": [{"name": "이상윤", "categories": []}]}
        summary = self.parser.get_member_summary(parsed_data, "없는사람")
        assert "찾을 수 없습니다" in summary

    def test_get_all_members_summary(self):
        parsed_data = {
            "team_members": [
                {"name": "이상윤", "categories": []},
                {"name": "선설희", "categories": []},
            ]
        }
        summary = self.parser.get_all_members_summary(parsed_data)
        assert "이상윤" in summary
        assert "선설희" in summary

    def test_full_team_report(self):
        """Integration test with realistic data."""
        html = """
        <table>
            <tr><th>이름</th><th>대분류</th><th>업무</th><th>상세</th></tr>
            <tr><td>이상윤</td><td>AI</td><td>[완료] LLM 파인튜닝</td><td>1/13 배포 완료</td></tr>
            <tr><td></td><td></td><td>[진행] 데이터셋 구축</td><td>500건 수집</td></tr>
            <tr><td></td><td>SDK</td><td>[예정] SDK v3 설계</td><td></td></tr>
            <tr><td>선설희</td><td>HWP</td><td>[진행] 렌더링 엔진</td><td>성능 최적화 중</td></tr>
            <tr><td></td><td>기타</td><td>[완료] 코드리뷰</td><td>PR #42 리뷰</td></tr>
        </table>
        """
        result = self.parser.parse(html)
        assert len(result["team_members"]) == 2

        # 이상윤: 2 categories, 3 tasks total
        member1 = result["team_members"][0]
        assert member1["name"] == "이상윤"
        assert len(member1["categories"]) == 2
        assert member1["categories"][0]["name"] == "AI"
        assert len(member1["categories"][0]["tasks"]) == 2
        assert member1["categories"][1]["name"] == "SDK"
        assert len(member1["categories"][1]["tasks"]) == 1

        # 선설희: 2 categories, 2 tasks total
        member2 = result["team_members"][1]
        assert member2["name"] == "선설희"
        assert len(member2["categories"]) == 2

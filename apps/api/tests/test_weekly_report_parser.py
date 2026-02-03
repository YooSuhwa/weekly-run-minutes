"""Tests for weekly report HTML parser.

This parser supports Confluence storage format with expand macros.
Two formats are supported:
1. Legacy format: member name in expand title
2. New format: member name in task-list, expand title is "자세히 보기"
"""


from src.services.weekly_report_parser import WeeklyReportParser


class TestWeeklyReportParser:
    """Basic parser tests."""

    def setup_method(self):
        self.parser = WeeklyReportParser()

    def test_parse_empty_html(self):
        result = self.parser.parse("")
        assert result == {"team_members": []}

    def test_parse_no_expand_macros(self):
        html = "<div><p>Hello</p></div>"
        result = self.parser.parse(html)
        assert result == {"team_members": []}

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


class TestLegacyExpandFormat:
    """Tests for legacy format with member name in expand title."""

    def setup_method(self):
        self.parser = WeeklyReportParser()

    def test_single_member(self):
        """Test legacy format with member name in expand title."""
        html = '''
        <ac:structured-macro ac:name="expand" ac:schema-version="1">
            <ac:parameter ac:name="title">이상윤</ac:parameter>
            <ac:rich-text-body>
                <ul>
                    <li><p><strong>AI</strong></p>
                        <ul>
                            <li><p>[완료] 모델 배포 (1/27, 완료)</p></li>
                            <li><p>[진행] 데이터 수집 (2/3, 진행)</p></li>
                        </ul>
                    </li>
                </ul>
            </ac:rich-text-body>
        </ac:structured-macro>
        '''
        result = self.parser.parse(html)
        assert len(result["team_members"]) == 1
        member = result["team_members"][0]
        assert member["name"] == "이상윤"
        assert len(member["categories"]) == 1
        assert member["categories"][0]["name"] == "AI"
        assert len(member["categories"][0]["tasks"]) == 2

    def test_multiple_members(self):
        """Test legacy format with multiple members."""
        html = '''
        <ac:structured-macro ac:name="expand">
            <ac:parameter ac:name="title">이상윤</ac:parameter>
            <ac:rich-text-body>
                <ul><li><p><strong>AI</strong></p>
                    <ul><li><p>[완료] 작업1</p></li></ul>
                </li></ul>
            </ac:rich-text-body>
        </ac:structured-macro>
        <ac:structured-macro ac:name="expand">
            <ac:parameter ac:name="title">선설희</ac:parameter>
            <ac:rich-text-body>
                <ul><li><p><strong>SDK</strong></p>
                    <ul><li><p>[진행] 작업2</p></li></ul>
                </li></ul>
            </ac:rich-text-body>
        </ac:structured-macro>
        '''
        result = self.parser.parse(html)
        assert len(result["team_members"]) == 2
        assert result["team_members"][0]["name"] == "이상윤"
        assert result["team_members"][1]["name"] == "선설희"

    def test_skip_long_title(self):
        """Test that expand macros with long titles are skipped."""
        html = '''
        <ac:structured-macro ac:name="expand">
            <ac:parameter ac:name="title">주간 보고 작성 가이드</ac:parameter>
            <ac:rich-text-body>
                <p>가이드 내용입니다.</p>
            </ac:rich-text-body>
        </ac:structured-macro>
        <ac:structured-macro ac:name="expand">
            <ac:parameter ac:name="title">이상윤</ac:parameter>
            <ac:rich-text-body>
                <ul><li><p><strong>기타</strong></p>
                    <ul><li><p>[완료] 실제 업무</p></li></ul>
                </li></ul>
            </ac:rich-text-body>
        </ac:structured-macro>
        '''
        result = self.parser.parse(html)
        assert len(result["team_members"]) == 1
        assert result["team_members"][0]["name"] == "이상윤"


class TestNewTaskListExpandFormat:
    """Tests for new format with task-list for member name and '자세히 보기' expand."""

    def setup_method(self):
        self.parser = WeeklyReportParser()

    def test_single_member(self):
        """Test new format with task-list for member name and '자세히 보기' expand."""
        html = '''
        <ac:task-list ac:task-list-id="test-id">
            <ac:task>
                <ac:task-id>1</ac:task-id>
                <ac:task-status>incomplete</ac:task-status>
                <ac:task-body><span><strong>이상윤</strong></span></ac:task-body>
            </ac:task>
        </ac:task-list>
        <ac:structured-macro ac:name="expand" ac:schema-version="1">
            <ac:parameter ac:name="title">자세히 보기</ac:parameter>
            <ac:rich-text-body>
                <ul>
                    <li><p><strong>기타</strong></p>
                        <ul>
                            <li><p>[완료] SDK 사이트 개발 회의 (1/27, 완료)</p></li>
                            <li><p>[완료] 팀 주간 회의 (1/27, 완료)</p></li>
                        </ul>
                    </li>
                </ul>
            </ac:rich-text-body>
        </ac:structured-macro>
        '''
        result = self.parser.parse(html)
        assert len(result["team_members"]) == 1
        member = result["team_members"][0]
        assert member["name"] == "이상윤"
        assert len(member["categories"]) == 1
        assert member["categories"][0]["name"] == "기타"
        assert len(member["categories"][0]["tasks"]) == 2
        assert member["categories"][0]["tasks"][0]["status"] == "완료"
        assert member["categories"][0]["tasks"][0]["title"] == "SDK 사이트 개발 회의"

    def test_multiple_members(self):
        """Test new format with multiple members."""
        html = '''
        <ac:task-list ac:task-list-id="id1">
            <ac:task>
                <ac:task-body><strong>이상윤</strong></ac:task-body>
            </ac:task>
        </ac:task-list>
        <ac:structured-macro ac:name="expand">
            <ac:parameter ac:name="title">자세히 보기</ac:parameter>
            <ac:rich-text-body>
                <ul><li><p><strong>AI</strong></p>
                    <ul><li><p>[완료] 작업1</p></li></ul>
                </li></ul>
            </ac:rich-text-body>
        </ac:structured-macro>
        <ac:task-list ac:task-list-id="id2">
            <ac:task>
                <ac:task-body><strong>선설희</strong></ac:task-body>
            </ac:task>
        </ac:task-list>
        <ac:structured-macro ac:name="expand">
            <ac:parameter ac:name="title">자세히 보기</ac:parameter>
            <ac:rich-text-body>
                <ul><li><p><strong>SDK</strong></p>
                    <ul><li><p>[진행] 작업2</p></li></ul>
                </li></ul>
            </ac:rich-text-body>
        </ac:structured-macro>
        '''
        result = self.parser.parse(html)
        assert len(result["team_members"]) == 2
        assert result["team_members"][0]["name"] == "이상윤"
        assert result["team_members"][1]["name"] == "선설희"

    def test_skip_guide_expand(self):
        """Test that guide expands (without '자세히 보기') are skipped."""
        html = '''
        <ac:structured-macro ac:name="expand">
            <ac:parameter ac:name="title">주간 보고 작성 가이드</ac:parameter>
            <ac:rich-text-body>
                <p>이것은 가이드입니다.</p>
            </ac:rich-text-body>
        </ac:structured-macro>
        <ac:task-list>
            <ac:task>
                <ac:task-body><strong>이상윤</strong></ac:task-body>
            </ac:task>
        </ac:task-list>
        <ac:structured-macro ac:name="expand">
            <ac:parameter ac:name="title">자세히 보기</ac:parameter>
            <ac:rich-text-body>
                <ul><li><p><strong>기타</strong></p>
                    <ul><li><p>[완료] 실제 업무</p></li></ul>
                </li></ul>
            </ac:rich-text-body>
        </ac:structured-macro>
        '''
        result = self.parser.parse(html)
        assert len(result["team_members"]) == 1
        assert result["team_members"][0]["name"] == "이상윤"

    def test_multiple_categories(self):
        """Test parsing multiple categories in new format."""
        html = '''
        <ac:task-list>
            <ac:task>
                <ac:task-body><strong>선설희</strong></ac:task-body>
            </ac:task>
        </ac:task-list>
        <ac:structured-macro ac:name="expand">
            <ac:parameter ac:name="title">자세히 보기</ac:parameter>
            <ac:rich-text-body>
                <ul>
                    <li><p><strong>AI</strong></p>
                        <ul>
                            <li><p>[완료] AI 맞춤법 검사 요금 분석 (1/28, 완료)</p></li>
                        </ul>
                    </li>
                    <li><p><strong>한컴피디아</strong></p>
                        <ul>
                            <li><p>[완료] MCP 서버 구축 가이드 (2/2, 완료)</p></li>
                        </ul>
                    </li>
                    <li><p><strong>SDK</strong></p>
                        <ul>
                            <li><p>[진행] Documents 사이트 로케일 설정 (2/3, 진행)</p></li>
                        </ul>
                    </li>
                </ul>
            </ac:rich-text-body>
        </ac:structured-macro>
        '''
        result = self.parser.parse(html)
        assert len(result["team_members"]) == 1
        member = result["team_members"][0]
        assert member["name"] == "선설희"
        assert len(member["categories"]) == 3
        assert member["categories"][0]["name"] == "AI"
        assert member["categories"][1]["name"] == "한컴피디아"
        assert member["categories"][2]["name"] == "SDK"

    def test_status_parsing(self):
        """Test various status tag formats."""
        html = '''
        <ac:task-list>
            <ac:task>
                <ac:task-body><strong>이상윤</strong></ac:task-body>
            </ac:task>
        </ac:task-list>
        <ac:structured-macro ac:name="expand">
            <ac:parameter ac:name="title">자세히 보기</ac:parameter>
            <ac:rich-text-body>
                <ul>
                    <li><p><strong>테스트</strong></p>
                        <ul>
                            <li><p>[완료] 완료된 작업</p></li>
                            <li><p>[진행] 진행 중인 작업</p></li>
                            <li><p>[예정] 예정된 작업</p></li>
                            <li><p>[done] English done</p></li>
                            <li><p>[ing] English in progress</p></li>
                            <li><p>[wip] Work in progress</p></li>
                            <li><p>[todo] To do</p></li>
                            <li><p>[plan] Planned</p></li>
                        </ul>
                    </li>
                </ul>
            </ac:rich-text-body>
        </ac:structured-macro>
        '''
        result = self.parser.parse(html)
        tasks = result["team_members"][0]["categories"][0]["tasks"]
        assert tasks[0]["status"] == "완료"
        assert tasks[1]["status"] == "진행"
        assert tasks[2]["status"] == "예정"
        assert tasks[3]["status"] == "완료"  # [done]
        assert tasks[4]["status"] == "진행"  # [ing]
        assert tasks[5]["status"] == "진행"  # [wip]
        assert tasks[6]["status"] == "예정"  # [todo]
        assert tasks[7]["status"] == "예정"  # [plan]

    def test_task_with_details(self):
        """Test parsing tasks with nested details."""
        html = '''
        <ac:task-list>
            <ac:task>
                <ac:task-body><strong>이상윤</strong></ac:task-body>
            </ac:task>
        </ac:task-list>
        <ac:structured-macro ac:name="expand">
            <ac:parameter ac:name="title">자세히 보기</ac:parameter>
            <ac:rich-text-body>
                <ul>
                    <li><p><strong>SDK</strong></p>
                        <ul>
                            <li><p>[진행] SDK Live Demo 개발</p>
                                <ul>
                                    <li><p>React 버전 업그레이드 STG 반영 (완료)</p></li>
                                    <li><p>해외향 사이트 리소스 전달 (~2/5, 예정)</p></li>
                                </ul>
                            </li>
                        </ul>
                    </li>
                </ul>
            </ac:rich-text-body>
        </ac:structured-macro>
        '''
        result = self.parser.parse(html)
        task = result["team_members"][0]["categories"][0]["tasks"][0]
        assert task["title"] == "SDK Live Demo 개발"
        assert task["status"] == "진행"
        assert len(task["details"]) == 2
        assert "React 버전 업그레이드" in task["details"][0]
        assert "해외향 사이트 리소스" in task["details"][1]


class TestRealWorldData:
    """Test with real-world Confluence data structure."""

    def setup_method(self):
        self.parser = WeeklyReportParser()

    def test_full_team_report_new_format(self):
        """Integration test with realistic new format data (5 team members)."""
        html = '''
        <ac:task-list><ac:task>
            <ac:task-body><strong>이상윤</strong></ac:task-body>
        </ac:task></ac:task-list>
        <ac:structured-macro ac:name="expand">
            <ac:parameter ac:name="title">자세히 보기</ac:parameter>
            <ac:rich-text-body>
                <ul><li><p><strong>기타</strong></p>
                    <ul>
                        <li><p>[완료] SDK 사이트 개발 회의 (1/27, 완료)</p></li>
                        <li><p>[완료] 팀 주간 회의 (1/27, 완료)</p></li>
                    </ul>
                </li></ul>
            </ac:rich-text-body>
        </ac:structured-macro>
        <ac:task-list><ac:task>
            <ac:task-body><strong>선설희</strong></ac:task-body>
        </ac:task></ac:task-list>
        <ac:structured-macro ac:name="expand">
            <ac:parameter ac:name="title">자세히 보기</ac:parameter>
            <ac:rich-text-body>
                <ul>
                    <li><p><strong>AI</strong></p>
                        <ul><li><p>[완료] AI 맞춤법 검사 요금 (1/28, 완료)</p></li></ul>
                    </li>
                    <li><p><strong>SDK</strong></p>
                        <ul><li><p>[진행] Documents 사이트 로케일 설정 (2/3, 진행)</p></li></ul>
                    </li>
                </ul>
            </ac:rich-text-body>
        </ac:structured-macro>
        <ac:task-list><ac:task>
            <ac:task-body><strong>최보연</strong></ac:task-body>
        </ac:task></ac:task-list>
        <ac:structured-macro ac:name="expand">
            <ac:parameter ac:name="title">자세히 보기</ac:parameter>
            <ac:rich-text-body>
                <ul><li><p><strong>한컴피디아</strong></p>
                    <ul><li><p>[진행] BGF 사이트 대응 (1/27, 진행)</p></li></ul>
                </li></ul>
            </ac:rich-text-body>
        </ac:structured-macro>
        <ac:task-list><ac:task>
            <ac:task-body><strong>유수화</strong></ac:task-body>
        </ac:task></ac:task-list>
        <ac:structured-macro ac:name="expand">
            <ac:parameter ac:name="title">자세히 보기</ac:parameter>
            <ac:rich-text-body>
                <ul>
                    <li><p><strong>AI</strong></p>
                        <ul><li><p>[진행] 주간 업무 회의 진행자 (2/2, 진행)</p></li></ul>
                    </li>
                    <li><p><strong>한컴피디아</strong></p>
                        <ul><li><p>[완료] BGF MVP 관련 미팅 (1/27, 완료)</p></li></ul>
                    </li>
                </ul>
            </ac:rich-text-body>
        </ac:structured-macro>
        <ac:task-list><ac:task>
            <ac:task-body><strong>김정연</strong></ac:task-body>
        </ac:task></ac:task-list>
        <ac:structured-macro ac:name="expand">
            <ac:parameter ac:name="title">자세히 보기</ac:parameter>
            <ac:rich-text-body>
                <ul>
                    <li><p><strong>AI</strong></p>
                        <ul><li><p>[예정] LLM Review Video 기획안 고도화</p></li></ul>
                    </li>
                    <li><p><strong>SDK</strong></p>
                        <ul><li><p>[진행] SDK Live Demo 개발 (진행)</p></li></ul>
                    </li>
                </ul>
            </ac:rich-text-body>
        </ac:structured-macro>
        '''
        result = self.parser.parse(html)

        # Check all 5 team members are parsed
        assert len(result["team_members"]) == 5
        names = [m["name"] for m in result["team_members"]]
        assert names == ["이상윤", "선설희", "최보연", "유수화", "김정연"]

        # Check 이상윤's data
        member1 = result["team_members"][0]
        assert len(member1["categories"]) == 1
        assert member1["categories"][0]["name"] == "기타"
        assert len(member1["categories"][0]["tasks"]) == 2

        # Check 선설희's data
        member2 = result["team_members"][1]
        assert len(member2["categories"]) == 2
        assert member2["categories"][0]["name"] == "AI"
        assert member2["categories"][1]["name"] == "SDK"

        # Check 유수화's data
        member4 = result["team_members"][3]
        assert len(member4["categories"]) == 2
        assert member4["categories"][0]["name"] == "AI"
        assert member4["categories"][1]["name"] == "한컴피디아"

        # Check 김정연's data
        member5 = result["team_members"][4]
        assert len(member5["categories"]) == 2
        assert member5["categories"][0]["tasks"][0]["status"] == "예정"
        assert member5["categories"][1]["tasks"][0]["status"] == "진행"

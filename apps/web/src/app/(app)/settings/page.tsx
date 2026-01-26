"use client";

import { useAtomValue } from "jotai";
import { BookText, Download, Filter, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { currentTeamAtom } from "@/atoms/team";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import type {
  VocabularyBulkImportItem,
  VocabularyCategory,
  VocabularyResponse,
} from "@/lib/api/__generated__/schemas";
import { useListTeamsApiV1TeamsGet } from "@/lib/api/__generated__/teams/teams";
import {
  useBulkImportVocabularyApiV1TeamsTeamIdVocabularyImportPost,
  useCreateVocabularyApiV1TeamsTeamIdVocabularyPost,
  useDeleteVocabularyApiV1TeamsTeamIdVocabularyVocabularyIdDelete,
  useListVocabularyApiV1TeamsTeamIdVocabularyGet,
  useUpdateVocabularyApiV1TeamsTeamIdVocabularyVocabularyIdPut,
} from "@/lib/api/__generated__/vocabulary/vocabulary";

const CATEGORY_LABELS: Record<VocabularyCategory, string> = {
  terminology: "전문 용어",
  abbreviation: "약어",
  name: "인명/사명",
  other: "기타",
};

const CATEGORY_OPTIONS: VocabularyCategory[] = ["terminology", "abbreviation", "name", "other"];

type TabType = "vocabulary" | "filtering";

interface VocabularyFormData {
  term: string;
  correction: string;
  category: VocabularyCategory;
}

const defaultFormData: VocabularyFormData = {
  term: "",
  correction: "",
  category: "terminology",
};

export default function SettingsPage() {
  const toast = useToast();
  const currentTeam = useAtomValue(currentTeamAtom);
  const [activeTab, setActiveTab] = useState<TabType>("vocabulary");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<VocabularyCategory | "all">("all");

  // Form states
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<VocabularyFormData>(defaultFormData);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");

  // Chat filtering settings
  const [filteringEnabled, setFilteringEnabled] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(70);

  // Get team ID from atom or fallback to first team
  const { data: teams } = useListTeamsApiV1TeamsGet();
  const teamId = currentTeam?.id ?? teams?.[0]?.id ?? "";

  // Fetch vocabulary
  const { data: vocabularyList, refetch: refetchVocabulary } =
    useListVocabularyApiV1TeamsTeamIdVocabularyGet(
      teamId,
      { category: categoryFilter === "all" ? undefined : categoryFilter },
      { query: { enabled: !!teamId } },
    );

  // Mutations
  const createVocabulary = useCreateVocabularyApiV1TeamsTeamIdVocabularyPost({
    mutation: {
      onSuccess: () => {
        refetchVocabulary();
        setFormData(defaultFormData);
        setIsAdding(false);
        toast.success("용어가 추가되었습니다");
      },
      onError: () => {
        toast.error("용어 추가에 실패했습니다");
      },
    },
  });

  const updateVocabulary = useUpdateVocabularyApiV1TeamsTeamIdVocabularyVocabularyIdPut({
    mutation: {
      onSuccess: () => {
        refetchVocabulary();
        setEditingId(null);
        setFormData(defaultFormData);
        toast.success("용어가 수정되었습니다");
      },
      onError: () => {
        toast.error("용어 수정에 실패했습니다");
      },
    },
  });

  const deleteVocabulary = useDeleteVocabularyApiV1TeamsTeamIdVocabularyVocabularyIdDelete({
    mutation: {
      onSuccess: () => {
        refetchVocabulary();
        toast.success("용어가 삭제되었습니다");
      },
      onError: () => {
        toast.error("용어 삭제에 실패했습니다");
      },
    },
  });

  const bulkImportVocabulary = useBulkImportVocabularyApiV1TeamsTeamIdVocabularyImportPost({
    mutation: {
      onSuccess: (data) => {
        refetchVocabulary();
        setShowBulkImport(false);
        setBulkImportText("");
        toast.success(`${data.imported}개 용어가 추가되었습니다 (${data.skipped}개 중복 건너뜀)`);
      },
      onError: () => {
        toast.error("일괄 가져오기에 실패했습니다");
      },
    },
  });

  // Filter vocabulary by search query
  const filteredVocabulary = useMemo(() => {
    if (!vocabularyList) return [];
    if (!searchQuery) return vocabularyList;
    const query = searchQuery.toLowerCase();
    return vocabularyList.filter(
      (v) => v.term.toLowerCase().includes(query) || v.correction.toLowerCase().includes(query),
    );
  }, [vocabularyList, searchQuery]);

  // Handlers
  const handleAdd = useCallback(() => {
    if (!teamId || !formData.term.trim() || !formData.correction.trim()) return;
    createVocabulary.mutate({
      teamId,
      data: {
        term: formData.term.trim(),
        correction: formData.correction.trim(),
        category: formData.category,
      },
    });
  }, [teamId, formData, createVocabulary]);

  const handleEdit = useCallback((vocab: VocabularyResponse) => {
    setEditingId(vocab.id);
    setFormData({
      term: vocab.term,
      correction: vocab.correction,
      category: vocab.category,
    });
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!teamId || !editingId || !formData.term.trim() || !formData.correction.trim()) return;
    updateVocabulary.mutate({
      teamId,
      vocabularyId: editingId,
      data: {
        term: formData.term.trim(),
        correction: formData.correction.trim(),
        category: formData.category,
      },
    });
  }, [teamId, editingId, formData, updateVocabulary]);

  const handleDelete = useCallback(
    (vocabularyId: string) => {
      if (!teamId) return;
      deleteVocabulary.mutate({ teamId, vocabularyId });
    },
    [teamId, deleteVocabulary],
  );

  const handleBulkImport = useCallback(() => {
    if (!teamId || !bulkImportText.trim()) return;

    // Parse bulk import text (format: term,correction,category per line)
    const lines = bulkImportText.trim().split("\n");
    const items: VocabularyBulkImportItem[] = [];

    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length >= 2) {
        const [term, correction, categoryStr] = parts;
        const category = CATEGORY_OPTIONS.includes(categoryStr as VocabularyCategory)
          ? (categoryStr as VocabularyCategory)
          : "other";
        items.push({ term, correction, category });
      }
    }

    if (items.length === 0) {
      toast.error("유효한 데이터가 없습니다. 형식: 용어,교정어,카테고리");
      return;
    }

    bulkImportVocabulary.mutate({
      teamId,
      data: { items, skip_duplicates: true },
    });
  }, [teamId, bulkImportText, bulkImportVocabulary, toast]);

  const handleExport = useCallback(() => {
    if (!vocabularyList || vocabularyList.length === 0) {
      toast.error("내보낼 용어가 없습니다");
      return;
    }

    const csv = vocabularyList.map((v) => `${v.term},${v.correction},${v.category}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vocabulary.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("용어집을 내보냈습니다");
  }, [vocabularyList, toast]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setFormData(defaultFormData);
  }, []);

  const cancelAdd = useCallback(() => {
    setIsAdding(false);
    setFormData(defaultFormData);
  }, []);

  // Reset form when switching modes
  useEffect(() => {
    if (isAdding) {
      setEditingId(null);
    }
  }, [isAdding]);

  useEffect(() => {
    if (editingId) {
      setIsAdding(false);
    }
  }, [editingId]);

  if (!teamId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="text-center text-muted-foreground">팀을 선택해주세요.</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">설정</h1>
        <p className="text-sm text-muted-foreground">{currentTeam?.name ?? "팀"} 설정 관리</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("vocabulary")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "vocabulary"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookText className="h-4 w-4" />
          용어집
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("filtering")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "filtering"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Filter className="h-4 w-4" />
          잡담 필터링
        </button>
      </div>

      {/* Vocabulary Tab */}
      {activeTab === "vocabulary" && (
        <div className="space-y-6">
          {/* Actions Bar */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="용어 검색..."
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as VocabularyCategory | "all")}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">전체 카테고리</option>
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkImport(true)}
                disabled={showBulkImport}
              >
                <Upload className="h-4 w-4" />
                가져오기
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4" />
                내보내기
              </Button>
              <Button size="sm" onClick={() => setIsAdding(true)} disabled={isAdding}>
                <Plus className="h-4 w-4" />
                용어 추가
              </Button>
            </div>
          </div>

          {/* Bulk Import Modal */}
          {showBulkImport && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">일괄 가져오기</CardTitle>
                <CardDescription>
                  CSV 형식으로 용어를 입력하세요. 각 줄: 용어,교정어,카테고리
                </CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  value={bulkImportText}
                  onChange={(e) => setBulkImportText(e.target.value)}
                  placeholder="예시:
AI,에이아이,abbreviation
SDK,에스디케이,abbreviation
이상윤,이상윤,name"
                  className="h-32 w-full rounded-lg border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowBulkImport(false)}>
                    취소
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleBulkImport}
                    disabled={!bulkImportText.trim() || bulkImportVocabulary.isPending}
                  >
                    가져오기
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add Form */}
          {isAdding && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">새 용어 추가</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="add-term" className="mb-1 block text-xs font-medium">
                      용어
                    </label>
                    <input
                      id="add-term"
                      type="text"
                      value={formData.term}
                      onChange={(e) => setFormData((prev) => ({ ...prev, term: e.target.value }))}
                      placeholder="예: SDK"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label htmlFor="add-correction" className="mb-1 block text-xs font-medium">
                      교정어
                    </label>
                    <input
                      id="add-correction"
                      type="text"
                      value={formData.correction}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, correction: e.target.value }))
                      }
                      placeholder="예: 에스디케이"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label htmlFor="add-category" className="mb-1 block text-xs font-medium">
                      카테고리
                    </label>
                    <select
                      id="add-category"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          category: e.target.value as VocabularyCategory,
                        }))
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {CATEGORY_OPTIONS.map((cat) => (
                        <option key={cat} value={cat}>
                          {CATEGORY_LABELS[cat]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={cancelAdd}>
                    취소
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAdd}
                    disabled={
                      !formData.term.trim() ||
                      !formData.correction.trim() ||
                      createVocabulary.isPending
                    }
                  >
                    추가
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Vocabulary Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">용어 목록</CardTitle>
              <CardDescription>총 {filteredVocabulary.length}개 용어</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredVocabulary.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {searchQuery ? "검색 결과가 없습니다" : "등록된 용어가 없습니다"}
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">용어</th>
                        <th className="px-4 py-3 text-left font-medium">교정어</th>
                        <th className="px-4 py-3 text-left font-medium">카테고리</th>
                        <th className="px-4 py-3 text-right font-medium">작업</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredVocabulary.map((vocab) => (
                        <tr key={vocab.id} className="hover:bg-muted/30">
                          {editingId === vocab.id ? (
                            <>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={formData.term}
                                  onChange={(e) =>
                                    setFormData((prev) => ({ ...prev, term: e.target.value }))
                                  }
                                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={formData.correction}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      correction: e.target.value,
                                    }))
                                  }
                                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <select
                                  value={formData.category}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      category: e.target.value as VocabularyCategory,
                                    }))
                                  }
                                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                >
                                  {CATEGORY_OPTIONS.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {CATEGORY_LABELS[cat]}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleSaveEdit}
                                    disabled={
                                      !formData.term.trim() ||
                                      !formData.correction.trim() ||
                                      updateVocabulary.isPending
                                    }
                                  >
                                    저장
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 font-medium">{vocab.term}</td>
                              <td className="px-4 py-3">{vocab.correction}</td>
                              <td className="px-4 py-3">
                                <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">
                                  {CATEGORY_LABELS[vocab.category]}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleEdit(vocab)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleDelete(vocab.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chat Filtering Tab */}
      {activeTab === "filtering" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">잡담 필터링 설정</CardTitle>
              <CardDescription>회의 녹음에서 잡담을 자동으로 감지하고 필터링합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">잡담 필터링 활성화</p>
                  <p className="text-sm text-muted-foreground">
                    비활성화하면 모든 대화 내용이 회의록에 포함됩니다
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={filteringEnabled}
                  onClick={() => setFilteringEnabled(!filteringEnabled)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    filteringEnabled ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      filteringEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {filteringEnabled && (
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">신뢰도 임계값</p>
                      <p className="text-sm text-muted-foreground">
                        이 값보다 높은 신뢰도로 감지된 잡담만 필터링됩니다
                      </p>
                    </div>
                    <span className="text-lg font-semibold">{confidenceThreshold}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                    className="mt-3 w-full"
                  />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>느슨함 (0%)</span>
                    <span>엄격함 (100%)</span>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h4 className="mb-2 font-medium">필터링 기준</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>- 회의 주제와 관련 없는 대화</li>
                  <li>- 인사말 및 안부 인사</li>
                  <li>- 휴식 관련 대화 (점심, 커피 등)</li>
                  <li>- 개인적인 잡담</li>
                </ul>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => toast.success("설정이 저장되었습니다")}>설정 저장</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

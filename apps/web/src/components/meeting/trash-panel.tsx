"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, MessageSquareOff, RotateCcw, Trash2 } from "lucide-react";
import { memo, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGetQueryKey,
  getGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGetQueryKey,
  useConfirmAllFilteredContentApiV1FiltersMeetingsMeetingIdFilteredConfirmAllPost,
  useConfirmFilteredContentApiV1FiltersMeetingsMeetingIdFilteredContentIdConfirmPost,
  useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet,
  useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet,
  useRestoreAllFilteredContentApiV1FiltersMeetingsMeetingIdFilteredRestoreAllPost,
  useRestoreFilteredContentApiV1FiltersMeetingsMeetingIdFilteredContentIdRestorePost,
} from "@/lib/api/__generated__/filters/filters";
import type { FilteredContentResponse } from "@/lib/api/__generated__/schemas";
import { cn } from "@/lib/utils";

export interface TrashPanelProps {
  meetingId: string;
  className?: string;
}

const reasonLabels: Record<string, string> = {
  casual_talk: "잡담",
  off_topic: "주제 이탈",
  filler: "필러 단어",
  duplicate: "중복",
  noise: "잡음",
  unknown: "기타",
};

const reasonColors: Record<string, "warning" | "info" | "secondary" | "outline"> = {
  casual_talk: "warning",
  off_topic: "info",
  filler: "secondary",
  duplicate: "secondary",
  noise: "outline",
  unknown: "outline",
};

function formatConfidence(confidence: number | null): string {
  if (confidence === null) return "-";
  return `${Math.round(confidence * 100)}%`;
}

interface FilteredItemProps {
  item: FilteredContentResponse;
  onRestore: (id: string) => void;
  onConfirm: (id: string) => void;
  isRestoring: boolean;
  isConfirming: boolean;
}

const FilteredItem = memo(function FilteredItem({
  item,
  onRestore,
  onConfirm,
  isRestoring,
  isConfirming,
}: FilteredItemProps) {
  const reasonLabel = reasonLabels[item.filter_reason] || item.filter_reason;
  const badgeVariant = reasonColors[item.filter_reason] || "outline";

  return (
    <div
      className={cn(
        "rounded-lg border border-border p-3 transition-colors",
        item.is_restored && "border-green-200 bg-green-50/50",
        item.is_confirmed && "border-muted bg-muted/30 opacity-60",
      )}
      data-testid={`filtered-item-${item.id}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant={badgeVariant}>{reasonLabel}</Badge>
        {item.confidence !== null && (
          <span className="text-xs text-muted-foreground">
            신뢰도: {formatConfidence(item.confidence)}
          </span>
        )}
        {item.speaker_name && (
          <span className="text-xs font-medium text-foreground">{item.speaker_name}</span>
        )}
        {item.is_restored && (
          <Badge variant="success" className="ml-auto">
            복원됨
          </Badge>
        )}
        {item.is_confirmed && (
          <Badge variant="secondary" className="ml-auto">
            확인됨
          </Badge>
        )}
      </div>
      <p className="mb-3 text-sm text-foreground">{item.content}</p>
      {!item.is_confirmed && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRestore(item.id)}
            disabled={isRestoring || item.is_restored}
            aria-label="복원"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            {item.is_restored ? "복원됨" : "복원"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onConfirm(item.id)}
            disabled={isConfirming}
            aria-label="잡담 확인"
          >
            <Check className="mr-1 h-3 w-3" />
            잡담 확인
          </Button>
        </div>
      )}
    </div>
  );
});

interface StatsDisplayProps {
  totalFiltered: number;
  restoredCount: number;
  confirmedCount: number;
}

const StatsDisplay = memo(function StatsDisplay({
  totalFiltered,
  restoredCount,
  confirmedCount,
}: StatsDisplayProps) {
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      <div className="flex items-center gap-1">
        <Trash2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">필터링:</span>
        <span className="font-medium">{totalFiltered}건</span>
      </div>
      <div className="flex items-center gap-1">
        <RotateCcw className="h-4 w-4 text-green-600" />
        <span className="text-muted-foreground">복원:</span>
        <span className="font-medium text-green-600">{restoredCount}건</span>
      </div>
      <div className="flex items-center gap-1">
        <Check className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">확인:</span>
        <span className="font-medium">{confirmedCount}건</span>
      </div>
    </div>
  );
});

export const TrashPanel = memo(function TrashPanel({ meetingId, className }: TrashPanelProps) {
  const queryClient = useQueryClient();

  // Fetch filtered content
  const {
    data: filteredContent,
    isLoading: isLoadingContent,
    error: contentError,
  } = useGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGet(meetingId, {
    include_restored: true,
  });

  // Fetch stats
  const { data: stats, isLoading: isLoadingStats } =
    useGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGet(meetingId);

  // Mutations
  const restoreMutation =
    useRestoreFilteredContentApiV1FiltersMeetingsMeetingIdFilteredContentIdRestorePost({
      mutation: {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGetQueryKey(
              meetingId,
              { include_restored: true },
            ),
          });
          queryClient.invalidateQueries({
            queryKey:
              getGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGetQueryKey(meetingId),
          });
        },
      },
    });

  const confirmMutation =
    useConfirmFilteredContentApiV1FiltersMeetingsMeetingIdFilteredContentIdConfirmPost({
      mutation: {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGetQueryKey(
              meetingId,
              { include_restored: true },
            ),
          });
          queryClient.invalidateQueries({
            queryKey:
              getGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGetQueryKey(meetingId),
          });
        },
      },
    });

  const restoreAllMutation =
    useRestoreAllFilteredContentApiV1FiltersMeetingsMeetingIdFilteredRestoreAllPost({
      mutation: {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGetQueryKey(
              meetingId,
              { include_restored: true },
            ),
          });
          queryClient.invalidateQueries({
            queryKey:
              getGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGetQueryKey(meetingId),
          });
        },
      },
    });

  const confirmAllMutation =
    useConfirmAllFilteredContentApiV1FiltersMeetingsMeetingIdFilteredConfirmAllPost({
      mutation: {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetFilteredContentApiV1FiltersMeetingsMeetingIdFilteredGetQueryKey(
              meetingId,
              { include_restored: true },
            ),
          });
          queryClient.invalidateQueries({
            queryKey:
              getGetFilterStatsApiV1FiltersMeetingsMeetingIdFilteredStatsGetQueryKey(meetingId),
          });
        },
      },
    });

  // Handlers
  const handleRestore = useCallback(
    (contentId: string) => {
      restoreMutation.mutate({ meetingId, contentId });
    },
    [meetingId, restoreMutation],
  );

  const handleConfirm = useCallback(
    (contentId: string) => {
      confirmMutation.mutate({ meetingId, contentId });
    },
    [meetingId, confirmMutation],
  );

  const handleRestoreAll = useCallback(() => {
    restoreAllMutation.mutate({ meetingId });
  }, [meetingId, restoreAllMutation]);

  const handleConfirmAll = useCallback(() => {
    confirmAllMutation.mutate({ meetingId });
  }, [meetingId, confirmAllMutation]);

  // Computed values
  const items = filteredContent?.items ?? [];
  const pendingItems = useMemo(() => items.filter((item) => !item.is_confirmed), [items]);
  const hasPendingItems = pendingItems.length > 0;

  // Loading state
  if (isLoadingContent || isLoadingStats) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareOff className="h-4 w-4" />
            잡담 필터링
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (contentError) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareOff className="h-4 w-4" />
            잡담 필터링
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">필터링 데이터를 불러오는데 실패했습니다</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareOff className="h-4 w-4" />
            잡담 필터링
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">필터링된 내용이 없습니다</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareOff className="h-4 w-4" />
          잡담 필터링
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">
            {items.length}건
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        {stats && (
          <StatsDisplay
            totalFiltered={stats.total_filtered}
            restoredCount={stats.restored_count}
            confirmedCount={stats.confirmed_count}
          />
        )}

        {/* Bulk Actions */}
        {hasPendingItems && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRestoreAll}
              disabled={restoreAllMutation.isPending}
              aria-label="전체 복원"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              전체 복원
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleConfirmAll}
              disabled={confirmAllMutation.isPending}
              aria-label="전체 잡담 확인"
            >
              <Check className="mr-1 h-3 w-3" />
              전체 확인
            </Button>
          </div>
        )}

        {/* Filtered Items */}
        <ScrollArea maxHeight={400} className="pr-2">
          <div className="space-y-3">
            {items.map((item) => (
              <FilteredItem
                key={item.id}
                item={item}
                onRestore={handleRestore}
                onConfirm={handleConfirm}
                isRestoring={
                  restoreMutation.isPending && restoreMutation.variables?.contentId === item.id
                }
                isConfirming={
                  confirmMutation.isPending && confirmMutation.variables?.contentId === item.id
                }
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
});

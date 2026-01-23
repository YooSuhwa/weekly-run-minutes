"use client";

import { Sparkles } from "lucide-react";
import { memo } from "react";
import type { CorrectionItem } from "@/atoms/minutes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CorrectionPanelProps {
  corrections: CorrectionItem[];
  onCorrectionClick?: (correction: CorrectionItem) => void;
}

const categoryLabels: Record<CorrectionItem["category"], string> = {
  terminology: "용어 교정",
  formatting: "포맷팅",
  grammar: "문법",
};

const categoryColors: Record<CorrectionItem["category"], string> = {
  terminology: "bg-blue-50 text-blue-700 border-blue-200",
  formatting: "bg-purple-50 text-purple-700 border-purple-200",
  grammar: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

export const CorrectionPanel = memo(function CorrectionPanel({
  corrections,
  onCorrectionClick,
}: CorrectionPanelProps) {
  if (corrections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            AI 교정 목록
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">교정 사항이 없습니다</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" />
          AI 교정 목록
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">
            {corrections.length}건
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {corrections.map((item) => (
            <button
              type="button"
              key={`${item.category}-${item.original}`}
              className={cn(
                "w-full text-left rounded-lg border border-border p-3 transition-colors",
                item.paragraphIndex !== null && "hover:border-primary/50 cursor-pointer",
              )}
              onClick={() => item.paragraphIndex !== null && onCorrectionClick?.(item)}
              disabled={item.paragraphIndex === null}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs",
                    categoryColors[item.category],
                  )}
                >
                  {categoryLabels[item.category]}
                </span>
                {item.paragraphIndex !== null && (
                  <span className="text-xs text-muted-foreground">L{item.paragraphIndex + 1}</span>
                )}
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground line-through">{item.original}</p>
                <p className="font-medium">{item.corrected}</p>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

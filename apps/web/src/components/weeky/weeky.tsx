"use client";

import { cn } from "@/lib/utils";

export type WeekyExpression = "thinking" | "done" | "sorry";

interface WeekyProps {
  expression: WeekyExpression;
  size?: "sm" | "md" | "lg";
  className?: string;
  message?: string;
}

const expressionEmoji: Record<WeekyExpression, string> = {
  thinking: "\u{1F914}",
  done: "\u{1F389}",
  sorry: "\u{1F625}",
};

const expressionLabel: Record<WeekyExpression, string> = {
  thinking: "처리 중이에요...",
  done: "완료했어요!",
  sorry: "문제가 생겼어요...",
};

const sizeClasses: Record<string, string> = {
  sm: "text-3xl",
  md: "text-5xl",
  lg: "text-7xl",
};

export function Weeky({ expression, size = "md", className, message }: WeekyProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn(sizeClasses[size], expression === "thinking" && "animate-pulse")}
        role="img"
        aria-label={`Weeky ${expression}`}
      >
        {expressionEmoji[expression]}
      </div>
      <p className="text-sm text-muted-foreground">{message ?? expressionLabel[expression]}</p>
    </div>
  );
}

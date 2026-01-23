"use client";

import { cn } from "@/lib/utils";

export type WeekyExpression =
  | "thinking"
  | "done"
  | "sorry"
  | "greeting"
  | "listening"
  | "questioning"
  | "celebrating"
  | "waiting"
  | "noting"
  | "next"
  | "encouragement"
  | "goodbye";

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
  greeting: "\u{1F44B}",
  listening: "\u{1F442}",
  questioning: "\u{2753}",
  celebrating: "\u{1F973}",
  waiting: "\u{23F3}",
  noting: "\u{1F4DD}",
  next: "\u{27A1}\u{FE0F}",
  encouragement: "\u{1F4AA}",
  goodbye: "\u{1F44B}",
};

const expressionLabel: Record<WeekyExpression, string> = {
  thinking: "처리 중이에요...",
  done: "완료했어요!",
  sorry: "문제가 생겼어요...",
  greeting: "안녕하세요!",
  listening: "듣고 있어요~",
  questioning: "질문할게요!",
  celebrating: "잘했어요!",
  waiting: "기다리는 중...",
  noting: "메모하고 있어요",
  next: "다음으로 넘어갈게요",
  encouragement: "화이팅!",
  goodbye: "수고하셨어요!",
};

const animatedExpressions = new Set<WeekyExpression>(["thinking", "waiting", "listening"]);

const sizeClasses: Record<string, string> = {
  sm: "text-3xl",
  md: "text-5xl",
  lg: "text-7xl",
};

export function Weeky({ expression, size = "md", className, message }: WeekyProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn(sizeClasses[size], animatedExpressions.has(expression) && "animate-pulse")}
        role="img"
        aria-label={`Weeky ${expression}`}
      >
        {expressionEmoji[expression]}
      </div>
      <p className="text-sm text-muted-foreground">{message ?? expressionLabel[expression]}</p>
    </div>
  );
}

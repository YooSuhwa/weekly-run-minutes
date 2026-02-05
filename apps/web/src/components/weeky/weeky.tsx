"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import weekyThinking from "./Weeky-thinking.png";
import weekyDone from "./Weeky-done.png";
import weekySorry from "./Weeky-sorry.png";
import weekyWave from "./Weeky-wave.png";
import weekyListening from "./Weeky-listening.png";
import weekyPointing from "./Weeky-pointing.png";
import weekyTrophy from "./Weeky-trophy.png";
import weekyTip from "./Weeky-tip.png";
import weekyHappy from "./Weeky-happy.png";
import weekyBye from "./Weeky-bye.png";

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

export type WeekyVariant = "default" | "bubble" | "card";

interface WeekyProps {
  expression: WeekyExpression;
  size?: "sm" | "md" | "lg";
  className?: string;
  message?: string;
  /** Display variant: default (vertical), bubble (with speech bubble), card (gradient card) */
  variant?: WeekyVariant;
  /** Position of the speech bubble (only for bubble variant) */
  bubblePosition?: "left" | "right";
}

const expressionImage: Record<WeekyExpression, typeof weekyThinking> = {
  thinking: weekyThinking,
  done: weekyDone,
  sorry: weekySorry,
  greeting: weekyWave,
  listening: weekyListening,
  questioning: weekyPointing,
  celebrating: weekyTrophy,
  waiting: weekyThinking,
  noting: weekyTip,
  next: weekyPointing,
  encouragement: weekyHappy,
  goodbye: weekyBye,
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

const sizeMap: Record<string, number> = {
  sm: 48,
  md: 80,
  lg: 120,
};

function WeekyImage({
  expression,
  size,
}: {
  expression: WeekyExpression;
  size: "sm" | "md" | "lg";
}) {
  const px = sizeMap[size];
  return (
    <div className={cn(animatedExpressions.has(expression) && "animate-pulse")}>
      <Image
        src={expressionImage[expression]}
        alt={`Weeky ${expression}`}
        width={px}
        height={px}
        placeholder="blur"
      />
    </div>
  );
}

function SpeechBubble({
  message,
  position,
}: {
  message: string;
  position: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 px-4 py-3",
        "border border-primary/20 shadow-sm",
        "max-w-xs"
      )}
    >
      <p className="text-sm text-foreground">{message}</p>
      {/* Speech bubble tail */}
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 w-0 h-0",
          "border-t-[8px] border-t-transparent",
          "border-b-[8px] border-b-transparent",
          position === "left"
            ? "right-full border-r-[10px] border-r-primary/10"
            : "left-full border-l-[10px] border-l-primary/10"
        )}
      />
    </div>
  );
}

export function Weeky({
  expression,
  size = "md",
  className,
  message,
  variant = "default",
  bubblePosition = "right",
}: WeekyProps) {
  const displayMessage = message ?? expressionLabel[expression];

  // Default variant: vertical layout with text below
  if (variant === "default") {
    return (
      <div className={cn("flex flex-col items-center gap-2", className)}>
        <WeekyImage expression={expression} size={size} />
        <p className="text-sm text-muted-foreground">{displayMessage}</p>
      </div>
    );
  }

  // Bubble variant: horizontal layout with speech bubble
  if (variant === "bubble") {
    return (
      <div
        className={cn(
          "flex items-center gap-3",
          bubblePosition === "left" && "flex-row-reverse",
          className
        )}
      >
        <WeekyImage expression={expression} size={size} />
        <SpeechBubble message={displayMessage} position={bubblePosition} />
      </div>
    );
  }

  // Card variant: gradient card with Weeky and message
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl p-4",
        "bg-gradient-to-br from-[oklch(0.95_0.05_175)] to-[oklch(0.92_0.08_220)]",
        "border border-primary/20 shadow-sm",
        className
      )}
    >
      <WeekyImage expression={expression} size={size} />
      <p className="text-sm font-medium text-foreground">{displayMessage}</p>
    </div>
  );
}

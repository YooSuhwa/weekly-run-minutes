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

interface WeekyProps {
  expression: WeekyExpression;
  size?: "sm" | "md" | "lg";
  className?: string;
  message?: string;
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

export function Weeky({ expression, size = "md", className, message }: WeekyProps) {
  const px = sizeMap[size];

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className={cn(animatedExpressions.has(expression) && "animate-pulse")}>
        <Image
          src={expressionImage[expression]}
          alt={`Weeky ${expression}`}
          width={px}
          height={px}
          placeholder="blur"
        />
      </div>
      <p className="text-sm text-muted-foreground">{message ?? expressionLabel[expression]}</p>
    </div>
  );
}

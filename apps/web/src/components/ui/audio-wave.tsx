"use client";

import { cn } from "@/lib/utils";

interface AudioWaveProps {
  /** Whether the animation is active */
  isActive?: boolean;
  /** Number of bars to display */
  bars?: number;
  /** Color variant */
  variant?: "primary" | "muted" | "recording";
  /** Size of the wave */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeConfig = {
  sm: { height: 16, barWidth: 2, gap: 2 },
  md: { height: 24, barWidth: 3, gap: 3 },
  lg: { height: 32, barWidth: 4, gap: 4 },
};

const variantColors = {
  primary: "bg-primary",
  muted: "bg-muted-foreground",
  recording: "bg-red-500",
};

export function AudioWave({
  isActive = true,
  bars = 5,
  variant = "primary",
  size = "md",
  className,
}: AudioWaveProps) {
  const { height, barWidth, gap } = sizeConfig[size];
  const totalWidth = bars * barWidth + (bars - 1) * gap;

  return (
    <div
      className={cn("flex items-center justify-center", className)}
      style={{ width: totalWidth, height }}
      role="img"
      aria-label={isActive ? "오디오 재생 중" : "오디오 중지됨"}
    >
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-full transition-all",
            variantColors[variant],
            isActive ? "animate-audio-wave" : "opacity-30"
          )}
          style={{
            width: barWidth,
            height: isActive ? undefined : height * 0.3,
            marginLeft: i > 0 ? gap : 0,
            animationDelay: isActive ? `${i * 0.1}s` : undefined,
          }}
        />
      ))}
    </div>
  );
}

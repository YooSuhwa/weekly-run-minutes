"use client";

import confetti from "canvas-confetti";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Weeky } from "@/components/weeky/weeky";

interface CelebrationModalProps {
  isOpen: boolean;
  confluenceUrl?: string;
  onClose: () => void;
}

export function CelebrationModal({ isOpen, confluenceUrl, onClose }: CelebrationModalProps) {
  useEffect(() => {
    if (isOpen) {
      // Fire confetti
      const duration = 2000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ["#a8e6cf", "#88d8b0", "#56c596", "#2ecc71", "#27ae60"],
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ["#a8e6cf", "#88d8b0", "#56c596", "#2ecc71", "#27ae60"],
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md animate-in fade-in zoom-in-95 rounded-2xl bg-card p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <Weeky expression="goodbye" size="lg" />

          <h2 className="mt-6 text-2xl font-bold">회의록 업로드 완료!</h2>
          <p className="mt-2 text-lg text-muted-foreground">수고하셨어요!</p>

          <div className="mt-8 flex w-full flex-col gap-3">
            {confluenceUrl && (
              <Link href={confluenceUrl} target="_blank" rel="noopener noreferrer">
                <Button className="w-full" variant="outline">
                  <ExternalLink className="h-4 w-4" />
                  Confluence에서 보기
                </Button>
              </Link>
            )}
            <Link href="/dashboard">
              <Button className="w-full">대시보드로 돌아가기</Button>
            </Link>
            <Button variant="ghost" onClick={onClose}>
              계속 편집하기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

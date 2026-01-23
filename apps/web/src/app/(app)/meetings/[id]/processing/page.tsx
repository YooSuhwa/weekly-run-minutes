"use client";

import { useAtom } from "jotai";
import { CheckCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { type SttStep, sttAtom } from "@/atoms/stt";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useToast } from "@/components/ui/toast";
import { Weeky } from "@/components/weeky/weeky";
import { cn } from "@/lib/utils";

const steps: { key: SttStep; label: string; description: string }[] = [
  { key: "voice", label: "음성 인식", description: "녹음 파일에서 음성을 텍스트로 변환 중" },
  {
    key: "terminology",
    label: "용어 교정",
    description: "주간업무록을 참조하여 전문 용어 교정 중",
  },
  { key: "formatting", label: "문서 정리", description: "회의록 형식으로 구조화 중" },
];

export default function ProcessingPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const meetingId = params.id as string;
  const [stt, setStt] = useAtom(sttAtom);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollProgress = useCallback(async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/meetings/${meetingId}/progress`,
      );

      if (!res.ok) return;

      const data = await res.json();

      if (data.status === "transcribing") {
        setStt((prev) => ({ ...prev, status: "processing", currentStep: "voice", progress: 33 }));
      } else if (data.status === "transcribed") {
        setStt((prev) => ({
          ...prev,
          status: "processing",
          currentStep: "terminology",
          progress: 66,
          segmentsCount: data.segments_count || 0,
        }));
      } else if (data.status === "generating_minutes") {
        setStt((prev) => ({ ...prev, currentStep: "formatting", progress: 80 }));
      } else if (data.status === "draft_ready") {
        setStt((prev) => ({ ...prev, status: "completed", progress: 100 }));
        if (pollingRef.current) clearInterval(pollingRef.current);
        toast.success("회의록 생성이 완료되었습니다!");
        setTimeout(() => router.push(`/meetings/${meetingId}/minutes`), 1500);
      } else if (data.status === "failed") {
        setStt((prev) => ({
          ...prev,
          status: "error",
          errorMessage: data.error_message || "처리 중 오류가 발생했습니다",
        }));
        if (pollingRef.current) clearInterval(pollingRef.current);
        toast.error(data.error_message || "처리 실패");
      }
    } catch {
      // Demo mode: simulate progress
      setStt((prev) => {
        if (prev.progress >= 100) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setTimeout(() => router.push(`/meetings/${meetingId}/minutes`), 1000);
          return { ...prev, status: "completed", progress: 100 };
        }
        const newProgress = Math.min(prev.progress + 10, 100);
        let step: SttStep = "voice";
        if (newProgress > 33) step = "terminology";
        if (newProgress > 66) step = "formatting";
        return { ...prev, status: "processing", currentStep: step, progress: newProgress };
      });
    }
  }, [meetingId, router, setStt, toast]);

  useEffect(() => {
    setStt({
      status: "processing",
      currentStep: "voice",
      progress: 10,
      segmentsCount: 0,
      durationSeconds: null,
      errorMessage: null,
    });

    pollingRef.current = setInterval(pollProgress, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pollProgress, setStt]);

  const currentStepIndex = steps.findIndex((s) => s.key === stt.currentStep);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="flex flex-col items-center">
        <Weeky
          expression={
            stt.status === "error" ? "sorry" : stt.status === "completed" ? "done" : "thinking"
          }
          size="lg"
          message={
            stt.status === "error"
              ? (stt.errorMessage ?? "오류가 발생했어요")
              : stt.status === "completed"
                ? "회의록이 준비되었어요!"
                : undefined
          }
        />

        <div className="mt-10 w-full max-w-md">
          <ProgressBar value={stt.progress} className="mb-8" />

          <div className="space-y-4">
            {steps.map((step, idx) => {
              const isActive = idx === currentStepIndex && stt.status === "processing";
              const isDone = idx < currentStepIndex || stt.status === "completed";

              return (
                <div
                  key={step.key}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 transition-all",
                    isActive && "border-primary bg-primary/5",
                    isDone && "border-green-200 bg-green-50",
                    !isActive && !isDone && "border-border opacity-50",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                      isDone && "bg-green-100 text-green-700",
                      isActive && "bg-primary/20 text-primary",
                      !isActive && !isDone && "bg-secondary text-muted-foreground",
                    )}
                  >
                    {isDone ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{step.label}</p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useAtomValue } from "jotai";
import type { QuestionTree, SpeakerQuestions } from "@/atoms/orchestration";
import {
  currentSpeakerAtom,
  orchestrationAtom,
  totalItemsForSpeakerAtom,
} from "@/atoms/orchestration";
import { cn } from "@/lib/utils";

interface QuestionTreePanelProps {
  className?: string;
}

function SpeakerSection({
  speaker,
  isActive,
  isCompleted,
  currentItemIndex,
}: {
  speaker: SpeakerQuestions;
  isActive: boolean;
  isCompleted: boolean;
  currentItemIndex: number;
}) {
  let globalItemIndex = 0;

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        isActive && "border-primary bg-primary/5",
        isCompleted && "opacity-60",
      )}
    >
      <h3
        className={cn(
          "font-medium text-sm mb-2",
          isActive && "text-primary",
          isCompleted && "line-through",
        )}
      >
        {speaker.speakerName}
        {isCompleted && " \u2713"}
      </h3>
      {isActive && (
        <div className="space-y-1">
          {speaker.categories.map((category) => (
            <div key={category.name} className="ml-2">
              <p className="text-xs text-muted-foreground font-medium">{category.name}</p>
              <ul className="space-y-0.5 ml-2">
                {category.items.map((item) => {
                  const itemIdx = globalItemIndex++;
                  const isCurrent = itemIdx === currentItemIndex;
                  const isDone = itemIdx < currentItemIndex;
                  return (
                    <li
                      key={`${category.name}-${itemIdx}`}
                      className={cn(
                        "text-xs py-0.5 flex items-start gap-1",
                        isCurrent && "font-semibold text-primary",
                        isDone && "text-muted-foreground line-through",
                      )}
                    >
                      <span className="shrink-0">
                        {isDone ? "\u2713" : isCurrent ? "\u25B6" : "\u2022"}
                      </span>
                      <span>{item.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function QuestionTreePanel({ className }: QuestionTreePanelProps) {
  const orchestration = useAtomValue(orchestrationAtom);
  const currentSpeaker = useAtomValue(currentSpeakerAtom);
  const totalItems = useAtomValue(totalItemsForSpeakerAtom);

  const tree: QuestionTree | null = orchestration.questionTree;

  if (!tree || tree.speakers.length === 0) {
    return (
      <div className={cn("p-4 text-center text-muted-foreground", className)}>
        <p className="text-sm">질문 트리가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2 p-3", className)}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">진행 현황</h2>
        {currentSpeaker && (
          <span className="text-xs text-muted-foreground">
            {orchestration.currentItemIndex + 1}/{totalItems}
          </span>
        )}
      </div>
      <div className="space-y-2 overflow-y-auto">
        {tree.speakers.map((speaker, idx) => (
          <SpeakerSection
            key={speaker.speakerName}
            speaker={speaker}
            isActive={idx === orchestration.currentSpeakerIndex}
            isCompleted={idx < orchestration.currentSpeakerIndex}
            currentItemIndex={
              idx === orchestration.currentSpeakerIndex ? orchestration.currentItemIndex : 0
            }
          />
        ))}
      </div>
    </div>
  );
}

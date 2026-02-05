"use client";

import { MessageSquare, Plus, Tag, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
}

interface RegenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (settings: RegenerateSettings) => void;
  isLoading: boolean;
  // Initial values from current meeting
  initialAttendees: string[];
  initialContextTerms: string[];
  initialContextInstructions: string;
  // Team members for selection
  teamMembers: TeamMember[];
}

export interface RegenerateSettings {
  attendees: string[];
  contextTerms: string[];
  contextInstructions: string;
}

export function RegenerateModal({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  initialAttendees,
  initialContextTerms,
  initialContextInstructions,
  teamMembers,
}: RegenerateModalProps) {
  // Local state for editing
  const [attendees, setAttendees] = useState<string[]>([]);
  const [contextTerms, setContextTerms] = useState<string[]>([]);
  const [contextInstructions, setContextInstructions] = useState("");
  const [termInput, setTermInput] = useState("");
  const [guestName, setGuestName] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setAttendees(initialAttendees);
      setContextTerms(initialContextTerms);
      setContextInstructions(initialContextInstructions);
      setTermInput("");
      setGuestName("");
    }
  }, [open, initialAttendees, initialContextTerms, initialContextInstructions]);

  // Attendee handlers
  const handleToggleAttendee = useCallback((name: string) => {
    setAttendees((prev) => {
      if (prev.includes(name)) {
        return prev.filter((a) => a !== name);
      }
      return [...prev, name];
    });
  }, []);

  const handleAddGuest = useCallback(() => {
    const name = guestName.trim();
    if (!name || attendees.includes(name)) return;
    setAttendees((prev) => [...prev, name]);
    setGuestName("");
  }, [guestName, attendees]);

  const handleRemoveAttendee = useCallback((name: string) => {
    setAttendees((prev) => prev.filter((a) => a !== name));
  }, []);

  // Context terms handlers
  const handleAddTerm = useCallback(() => {
    const term = termInput.trim();
    if (!term || contextTerms.includes(term)) return;
    if (contextTerms.length >= 50) return;
    setContextTerms((prev) => [...prev, term]);
    setTermInput("");
  }, [termInput, contextTerms]);

  const handleRemoveTerm = useCallback((term: string) => {
    setContextTerms((prev) => prev.filter((t) => t !== term));
  }, []);

  const handleConfirm = () => {
    onConfirm({
      attendees,
      contextTerms,
      contextInstructions: contextInstructions.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>회의록 재생성 설정</DialogTitle>
          <DialogDescription>
            설정을 변경하고 회의록을 다시 생성합니다. 기존 회의록은 삭제됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Attendees Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              참석자
            </div>

            {/* Current attendees */}
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attendees.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttendee(name)}
                      className="ml-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Team members toggle */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">팀원 추가/제거</p>
              <div className="flex flex-wrap gap-2">
                {teamMembers.map((member) => {
                  const isAttending = attendees.includes(member.name);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleToggleAttendee(member.name)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition-colors",
                        isAttending
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/50",
                      )}
                    >
                      {member.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Add guest */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">게스트 추가</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="게스트 이름"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddGuest()}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddGuest}
                  disabled={!guestName.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Context Terms Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Tag className="h-4 w-4" />
              세션 용어
            </div>
            <p className="text-xs text-muted-foreground">
              회의에서 자주 사용되는 용어를 추가하면 정확도가 향상됩니다.
            </p>

            {/* Current terms */}
            {contextTerms.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {contextTerms.map((term) => (
                  <span
                    key={term}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm"
                  >
                    {term}
                    <button
                      type="button"
                      onClick={() => handleRemoveTerm(term)}
                      className="ml-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add term input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="용어 입력 (예: Phoenix, Sprint 15)"
                value={termInput}
                onChange={(e) => setTermInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTerm()}
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddTerm}
                disabled={!termInput.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Context Instructions Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4" />
              특별 지시사항
            </div>
            <p className="text-xs text-muted-foreground">
              회의록 생성에 특별히 적용할 지시사항을 자연어로 입력하세요.
            </p>
            <textarea
              placeholder="예: 'OOO 이름이 나오는 얘기는 다 빼줘', '기술 용어는 영문으로 표기해줘', '이모지를 추가해줘'"
              value={contextInstructions}
              onChange={(e) => setContextInstructions(e.target.value)}
              rows={3}
              maxLength={1000}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground text-right">
              {contextInstructions.length}/1000
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading || attendees.length === 0}
          >
            {isLoading ? "재생성 중..." : "재생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

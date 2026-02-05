"use client";

import { useAtomValue } from "jotai";
import { ChevronDown, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { selectedTeamIdAtom } from "@/atoms/team";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useListTeamsApiV1TeamsGet } from "@/lib/api/__generated__/teams/teams";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/team", label: "팀원 관리" },
  { href: "/settings", label: "설정" },
];

export function AppHeader() {
  const pathname = usePathname();
  const selectedTeamId = useAtomValue(selectedTeamIdAtom);
  const { data: teams = [] } = useListTeamsApiV1TeamsGet();

  const currentTeam = teams.find((t) => t.id === selectedTeamId);

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-lg font-bold text-primary">WeeklyRun</span>
            <span className="text-xs text-muted-foreground">by Weeky</span>
          </Link>

          {/* Team Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Users className="h-4 w-4" />
                <span className="max-w-[120px] truncate">
                  {currentTeam?.name ?? "팀 선택"}
                </span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {teams.map((team) => (
                <DropdownMenuItem key={team.id} asChild>
                  <Link
                    href="/teams"
                    className={cn(
                      "cursor-pointer",
                      team.id === selectedTeamId && "font-medium",
                    )}
                  >
                    {team.name}
                    {team.id === selectedTeamId && (
                      <span className="ml-auto text-xs text-primary">현재</span>
                    )}
                  </Link>
                </DropdownMenuItem>
              ))}
              {teams.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem asChild>
                <Link href="/teams" className="cursor-pointer text-primary">
                  팀 변경하기
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                pathname.startsWith(item.href)
                  ? "bg-primary/10 font-medium text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

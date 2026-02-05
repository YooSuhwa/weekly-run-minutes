import { cleanup, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectedTeamIdAtom } from "@/atoms/team";

// Hoisted mock references for stable mock identity
const mockUsePathname = vi.hoisted(() => vi.fn());

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className} data-testid={`nav-link-${href}`}>
      {children}
    </a>
  ),
}));

// Mock teams API
const mockTeams = [
  { id: "team-1", name: "제품기술팀" },
  { id: "team-2", name: "디자인팀" },
];
vi.mock("@/lib/api/__generated__/teams/teams", () => ({
  useListTeamsApiV1TeamsGet: () => ({ data: mockTeams }),
}));

import { AppHeader } from "../app-header";

function renderWithProviders(ui: ReactNode, teamId?: string | null) {
  const store = createStore();
  // Always set the atom - either to teamId or null for no-team scenarios
  store.set(selectedTeamIdAtom, teamId ?? null);
  return render(<Provider store={store}>{ui}</Provider>);
}

describe("AppHeader", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/dashboard");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Logo and Branding", () => {
    it("renders WeeklyRun logo", () => {
      renderWithProviders(<AppHeader />, "team-1");
      expect(screen.getByText("WeeklyRun")).toBeInTheDocument();
    });

    it("renders Weeky branding", () => {
      renderWithProviders(<AppHeader />, "team-1");
      expect(screen.getByText("by Weeky")).toBeInTheDocument();
    });

    it("logo links to dashboard", () => {
      renderWithProviders(<AppHeader />, "team-1");
      const dashboardLinks = screen.getAllByTestId("nav-link-/dashboard");
      expect(dashboardLinks[0]).toHaveAttribute("href", "/dashboard");
      expect(dashboardLinks[0]).toHaveTextContent("WeeklyRun");
    });
  });

  describe("Team Selector", () => {
    it("shows team selector button", () => {
      renderWithProviders(<AppHeader />, "team-1");
      expect(screen.getByText("제품기술팀")).toBeInTheDocument();
    });

    it("shows placeholder when no team selected", () => {
      renderWithProviders(<AppHeader />);
      expect(screen.getByText("팀 선택")).toBeInTheDocument();
    });
  });

  describe("Navigation Items", () => {
    it("renders navigation items when team is selected", () => {
      renderWithProviders(<AppHeader />, "team-1");
      expect(screen.getByText("대시보드")).toBeInTheDocument();
      expect(screen.getByText("팀원 관리")).toBeInTheDocument();
      expect(screen.getByText("설정")).toBeInTheDocument();
    });

    it("hides navigation items when no team selected", () => {
      renderWithProviders(<AppHeader />);
      expect(screen.queryByText("대시보드")).not.toBeInTheDocument();
      expect(screen.queryByText("팀원 관리")).not.toBeInTheDocument();
    });

    it("dashboard link has correct href", () => {
      renderWithProviders(<AppHeader />, "team-1");
      const dashboardLinks = screen.getAllByTestId("nav-link-/dashboard");
      expect(dashboardLinks.length).toBeGreaterThan(0);
      expect(dashboardLinks[0]).toHaveAttribute("href", "/dashboard");
    });

    it("team link has correct href", () => {
      renderWithProviders(<AppHeader />, "team-1");
      const teamLink = screen.getByTestId("nav-link-/team");
      expect(teamLink).toHaveAttribute("href", "/team");
    });

    it("settings link has correct href", () => {
      renderWithProviders(<AppHeader />, "team-1");
      const settingsLink = screen.getByTestId("nav-link-/settings");
      expect(settingsLink).toHaveAttribute("href", "/settings");
    });
  });

  describe("Active State Styling", () => {
    it("highlights dashboard link when on dashboard page", () => {
      mockUsePathname.mockReturnValue("/dashboard");
      renderWithProviders(<AppHeader />, "team-1");
      const navLinks = screen.getAllByTestId("nav-link-/dashboard");
      // The nav link is the one in the nav element
      const dashboardNavLink = navLinks.find((link) =>
        link.textContent === "대시보드"
      );
      expect(dashboardNavLink?.className).toContain("bg-primary/10");
      expect(dashboardNavLink?.className).toContain("font-medium");
    });

    it("highlights team link when on team page", () => {
      mockUsePathname.mockReturnValue("/team");
      renderWithProviders(<AppHeader />, "team-1");
      const teamLink = screen.getByTestId("nav-link-/team");
      expect(teamLink.className).toContain("bg-primary/10");
      expect(teamLink.className).toContain("font-medium");
    });

    it("highlights settings link when on settings page", () => {
      mockUsePathname.mockReturnValue("/settings");
      renderWithProviders(<AppHeader />, "team-1");
      const settingsLink = screen.getByTestId("nav-link-/settings");
      expect(settingsLink.className).toContain("bg-primary/10");
      expect(settingsLink.className).toContain("font-medium");
    });

    it("does not highlight dashboard link when on team page", () => {
      mockUsePathname.mockReturnValue("/team");
      renderWithProviders(<AppHeader />, "team-1");
      const navLinks = screen.getAllByTestId("nav-link-/dashboard");
      const dashboardNavLink = navLinks.find((link) =>
        link.textContent === "대시보드"
      );
      expect(dashboardNavLink?.className).not.toContain("bg-primary/10");
      expect(dashboardNavLink?.className).toContain("text-muted-foreground");
    });
  });

  describe("Component Structure", () => {
    it("renders header element", () => {
      const { container } = renderWithProviders(<AppHeader />, "team-1");
      const header = container.querySelector("header");
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass("border-b");
      expect(header).toHaveClass("border-border");
      expect(header).toHaveClass("bg-card");
    });

    it("renders navigation element", () => {
      const { container } = renderWithProviders(<AppHeader />, "team-1");
      const nav = container.querySelector("nav");
      expect(nav).toBeInTheDocument();
    });

    it("has correct container structure", () => {
      const { container } = renderWithProviders(<AppHeader />, "team-1");
      const innerContainer = container.querySelector("header > div");
      expect(innerContainer).toHaveClass("mx-auto");
      expect(innerContainer).toHaveClass("flex");
      expect(innerContainer).toHaveClass("h-14");
      expect(innerContainer).toHaveClass("max-w-5xl");
    });
  });

  describe("Accessibility", () => {
    it("logo has proper link semantics", () => {
      renderWithProviders(<AppHeader />, "team-1");
      const dashboardLinks = screen.getAllByTestId("nav-link-/dashboard");
      expect(dashboardLinks[0].tagName).toBe("A");
      expect(dashboardLinks[0]).toHaveAttribute("href", "/dashboard");
    });

    it("all navigation items are links when team selected", () => {
      const { container } = renderWithProviders(<AppHeader />, "team-1");
      const nav = container.querySelector("nav");
      const links = nav?.querySelectorAll("a");
      expect(links?.length).toBe(3); // 대시보드, 팀원 관리, 설정
    });

    it("navigation links have text content", () => {
      renderWithProviders(<AppHeader />, "team-1");
      const navLinks = screen.getAllByTestId("nav-link-/dashboard");
      const dashboardNavLink = navLinks.find((link) =>
        link.textContent === "대시보드"
      );
      expect(dashboardNavLink?.textContent).toBeTruthy();
    });
  });

  describe("Styling and Layout", () => {
    it("applies transition classes to navigation links", () => {
      renderWithProviders(<AppHeader />, "team-1");
      const navLinks = screen.getAllByTestId("nav-link-/dashboard");
      const dashboardNavLink = navLinks.find((link) =>
        link.textContent === "대시보드"
      );
      expect(dashboardNavLink?.className).toContain("transition-colors");
    });

    it("applies correct size classes to navigation links", () => {
      renderWithProviders(<AppHeader />, "team-1");
      const navLinks = screen.getAllByTestId("nav-link-/dashboard");
      const dashboardNavLink = navLinks.find((link) =>
        link.textContent === "대시보드"
      );
      expect(dashboardNavLink?.className).toContain("rounded-md");
      expect(dashboardNavLink?.className).toContain("px-3");
      expect(dashboardNavLink?.className).toContain("py-1.5");
      expect(dashboardNavLink?.className).toContain("text-sm");
    });

    it("applies correct logo styling", () => {
      renderWithProviders(<AppHeader />, "team-1");
      const logo = screen.getByText("WeeklyRun");
      expect(logo.className).toContain("text-lg");
      expect(logo.className).toContain("font-bold");
      expect(logo.className).toContain("text-primary");
    });

    it("applies correct Weeky branding styling", () => {
      renderWithProviders(<AppHeader />, "team-1");
      const branding = screen.getByText("by Weeky");
      expect(branding.className).toContain("text-xs");
      expect(branding.className).toContain("text-muted-foreground");
    });
  });

  describe("Re-rendering Behavior", () => {
    it("updates active state when pathname changes", () => {
      mockUsePathname.mockReturnValue("/dashboard");
      const store = createStore();
      store.set(selectedTeamIdAtom, "team-1");

      const { rerender } = render(
        <Provider store={store}>
          <AppHeader />
        </Provider>
      );

      // Initially on dashboard
      let navLinks = screen.getAllByTestId("nav-link-/dashboard");
      let dashboardNavLink = navLinks.find((link) => link.textContent === "대시보드");
      expect(dashboardNavLink?.className).toContain("bg-primary/10");

      // Navigate to team
      mockUsePathname.mockReturnValue("/team");
      rerender(
        <Provider store={store}>
          <AppHeader />
        </Provider>
      );

      navLinks = screen.getAllByTestId("nav-link-/dashboard");
      dashboardNavLink = navLinks.find((link) => link.textContent === "대시보드");
      const teamLink = screen.getByTestId("nav-link-/team");
      expect(dashboardNavLink?.className).not.toContain("bg-primary/10");
      expect(teamLink.className).toContain("bg-primary/10");
    });
  });
});

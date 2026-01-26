import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { AppHeader } from "../app-header";

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
      render(<AppHeader />);
      expect(screen.getByText("WeeklyRun")).toBeInTheDocument();
    });

    it("renders Weeky branding", () => {
      render(<AppHeader />);
      expect(screen.getByText("by Weeky")).toBeInTheDocument();
    });

    it("logo links to dashboard", () => {
      render(<AppHeader />);
      const dashboardLinks = screen.getAllByTestId("nav-link-/dashboard");
      // First link is the logo
      expect(dashboardLinks[0]).toHaveAttribute("href", "/dashboard");
      expect(dashboardLinks[0]).toHaveTextContent("WeeklyRun");
    });
  });

  describe("Navigation Items", () => {
    it("renders all navigation items", () => {
      render(<AppHeader />);
      expect(screen.getByText("대시보드")).toBeInTheDocument();
      expect(screen.getByText("팀원 관리")).toBeInTheDocument();
    });

    it("dashboard link has correct href", () => {
      render(<AppHeader />);
      const dashboardLinks = screen.getAllByTestId("nav-link-/dashboard");
      // First link is the logo, second is the nav item
      expect(dashboardLinks.length).toBeGreaterThan(0);
      expect(dashboardLinks[0]).toHaveAttribute("href", "/dashboard");
    });

    it("team link has correct href", () => {
      render(<AppHeader />);
      const teamLink = screen.getByTestId("nav-link-/team");
      expect(teamLink).toHaveAttribute("href", "/team");
    });
  });

  describe("Active State Styling", () => {
    it("highlights dashboard link when on dashboard page", () => {
      mockUsePathname.mockReturnValue("/dashboard");
      render(<AppHeader />);
      const dashboardLink = screen.getAllByText("대시보드")[0];
      expect(dashboardLink.className).toContain("bg-primary/10");
      expect(dashboardLink.className).toContain("font-medium");
      expect(dashboardLink.className).toContain("text-primary-foreground");
    });

    it("highlights team link when on team page", () => {
      mockUsePathname.mockReturnValue("/team");
      render(<AppHeader />);
      const teamLink = screen.getByText("팀원 관리");
      expect(teamLink.className).toContain("bg-primary/10");
      expect(teamLink.className).toContain("font-medium");
      expect(teamLink.className).toContain("text-primary-foreground");
    });

    it("highlights dashboard link when on dashboard subpage", () => {
      mockUsePathname.mockReturnValue("/dashboard/settings");
      render(<AppHeader />);
      const dashboardLink = screen.getAllByText("대시보드")[0];
      expect(dashboardLink.className).toContain("bg-primary/10");
    });

    it("highlights team link when on team subpage", () => {
      mockUsePathname.mockReturnValue("/team/members");
      render(<AppHeader />);
      const teamLink = screen.getByText("팀원 관리");
      expect(teamLink.className).toContain("bg-primary/10");
    });

    it("does not highlight dashboard link when on team page", () => {
      mockUsePathname.mockReturnValue("/team");
      render(<AppHeader />);
      const dashboardLink = screen.getAllByText("대시보드")[0];
      expect(dashboardLink.className).not.toContain("bg-primary/10");
      expect(dashboardLink.className).toContain("text-muted-foreground");
      expect(dashboardLink.className).toContain("hover:bg-accent");
    });

    it("does not highlight team link when on dashboard page", () => {
      mockUsePathname.mockReturnValue("/dashboard");
      render(<AppHeader />);
      const teamLink = screen.getByText("팀원 관리");
      expect(teamLink.className).not.toContain("bg-primary/10");
      expect(teamLink.className).toContain("text-muted-foreground");
      expect(teamLink.className).toContain("hover:bg-accent");
    });
  });

  describe("Edge Cases", () => {
    it("handles root path correctly", () => {
      mockUsePathname.mockReturnValue("/");
      render(<AppHeader />);
      // Neither should be highlighted for root path
      const dashboardLink = screen.getAllByText("대시보드")[0];
      const teamLink = screen.getByText("팀원 관리");
      expect(dashboardLink.className).not.toContain("bg-primary/10");
      expect(teamLink.className).not.toContain("bg-primary/10");
    });

    it("handles unknown path correctly", () => {
      mockUsePathname.mockReturnValue("/unknown");
      render(<AppHeader />);
      const dashboardLink = screen.getAllByText("대시보드")[0];
      const teamLink = screen.getByText("팀원 관리");
      expect(dashboardLink.className).not.toContain("bg-primary/10");
      expect(teamLink.className).not.toContain("bg-primary/10");
    });

    it("handles meetings path correctly (no highlight)", () => {
      mockUsePathname.mockReturnValue("/meetings/abc123/setup");
      render(<AppHeader />);
      const dashboardLink = screen.getAllByText("대시보드")[0];
      const teamLink = screen.getByText("팀원 관리");
      expect(dashboardLink.className).not.toContain("bg-primary/10");
      expect(teamLink.className).not.toContain("bg-primary/10");
    });
  });

  describe("Component Structure", () => {
    it("renders header element", () => {
      const { container } = render(<AppHeader />);
      const header = container.querySelector("header");
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass("border-b");
      expect(header).toHaveClass("border-border");
      expect(header).toHaveClass("bg-card");
    });

    it("renders navigation element", () => {
      const { container } = render(<AppHeader />);
      const nav = container.querySelector("nav");
      expect(nav).toBeInTheDocument();
    });

    it("has correct container structure", () => {
      const { container } = render(<AppHeader />);
      const innerContainer = container.querySelector("header > div");
      expect(innerContainer).toHaveClass("mx-auto");
      expect(innerContainer).toHaveClass("flex");
      expect(innerContainer).toHaveClass("h-14");
      expect(innerContainer).toHaveClass("max-w-5xl");
    });
  });

  describe("Accessibility", () => {
    it("logo has proper link semantics", () => {
      render(<AppHeader />);
      const dashboardLinks = screen.getAllByTestId("nav-link-/dashboard");
      // First link is the logo
      expect(dashboardLinks[0].tagName).toBe("A");
      expect(dashboardLinks[0]).toHaveAttribute("href", "/dashboard");
    });

    it("all navigation items are links", () => {
      const { container } = render(<AppHeader />);
      const nav = container.querySelector("nav");
      const links = nav?.querySelectorAll("a");
      expect(links?.length).toBe(2); // 대시보드, 팀원 관리
    });

    it("navigation links have text content", () => {
      render(<AppHeader />);
      const dashboardLink = screen.getAllByText("대시보드")[0];
      const teamLink = screen.getByText("팀원 관리");
      expect(dashboardLink.textContent).toBeTruthy();
      expect(teamLink.textContent).toBeTruthy();
    });
  });

  describe("Styling and Layout", () => {
    it("applies transition classes to navigation links", () => {
      render(<AppHeader />);
      const dashboardLink = screen.getAllByText("대시보드")[0];
      expect(dashboardLink.className).toContain("transition-colors");
    });

    it("applies correct size classes to navigation links", () => {
      render(<AppHeader />);
      const dashboardLink = screen.getAllByText("대시보드")[0];
      expect(dashboardLink.className).toContain("rounded-md");
      expect(dashboardLink.className).toContain("px-3");
      expect(dashboardLink.className).toContain("py-1.5");
      expect(dashboardLink.className).toContain("text-sm");
    });

    it("applies correct logo styling", () => {
      render(<AppHeader />);
      const logo = screen.getByText("WeeklyRun");
      expect(logo.className).toContain("text-lg");
      expect(logo.className).toContain("font-bold");
      expect(logo.className).toContain("text-primary");
    });

    it("applies correct Weeky branding styling", () => {
      render(<AppHeader />);
      const branding = screen.getByText("by Weeky");
      expect(branding.className).toContain("text-xs");
      expect(branding.className).toContain("text-muted-foreground");
    });
  });

  describe("Re-rendering Behavior", () => {
    it("updates active state when pathname changes", () => {
      const { rerender } = render(<AppHeader />);

      // Initially on dashboard
      mockUsePathname.mockReturnValue("/dashboard");
      rerender(<AppHeader />);
      let dashboardLink = screen.getAllByText("대시보드")[0];
      expect(dashboardLink.className).toContain("bg-primary/10");

      // Navigate to team
      mockUsePathname.mockReturnValue("/team");
      rerender(<AppHeader />);
      dashboardLink = screen.getAllByText("대시보드")[0];
      const teamLink = screen.getByText("팀원 관리");
      expect(dashboardLink.className).not.toContain("bg-primary/10");
      expect(teamLink.className).toContain("bg-primary/10");
    });

    it("maintains link functionality across re-renders", () => {
      const { rerender } = render(<AppHeader />);

      const dashboardLinks = screen.getAllByTestId("nav-link-/dashboard");
      expect(dashboardLinks[0]).toHaveAttribute("href", "/dashboard");

      mockUsePathname.mockReturnValue("/team");
      rerender(<AppHeader />);

      const dashboardLinksAfter = screen.getAllByTestId("nav-link-/dashboard");
      expect(dashboardLinksAfter[0]).toHaveAttribute("href", "/dashboard");
    });
  });
});

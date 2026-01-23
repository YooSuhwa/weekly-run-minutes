import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";

describe("Card", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders Card with children", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeDefined();
  });

  it("applies card styling classes", () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId("card");
    const cls = card.getAttribute("class") ?? "";
    expect(cls).toContain("rounded-xl");
    expect(cls).toContain("border");
    expect(cls).toContain("shadow-sm");
  });

  it("applies custom className to Card", () => {
    render(
      <Card className="custom-card" data-testid="card">
        Content
      </Card>,
    );
    expect(screen.getByTestId("card").getAttribute("class")).toContain("custom-card");
  });
});

describe("CardHeader", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders CardHeader with children", () => {
    render(<CardHeader>Header text</CardHeader>);
    expect(screen.getByText("Header text")).toBeDefined();
  });

  it("applies header styling classes", () => {
    render(<CardHeader data-testid="header">Header</CardHeader>);
    const header = screen.getByTestId("header");
    const cls = header.getAttribute("class") ?? "";
    expect(cls).toContain("flex");
    expect(cls).toContain("flex-col");
    expect(cls).toContain("p-6");
  });
});

describe("CardTitle", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders CardTitle as h3", () => {
    render(<CardTitle>Title</CardTitle>);
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveTextContent("Title");
  });

  it("applies title styling classes", () => {
    render(<CardTitle>Title</CardTitle>);
    const heading = screen.getByRole("heading");
    expect(heading.getAttribute("class")).toContain("font-semibold");
  });
});

describe("CardDescription", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders CardDescription", () => {
    render(<CardDescription>Description text</CardDescription>);
    expect(screen.getByText("Description text")).toBeDefined();
  });

  it("applies description styling classes", () => {
    render(<CardDescription data-testid="desc">Desc</CardDescription>);
    const desc = screen.getByTestId("desc");
    const cls = desc.getAttribute("class") ?? "";
    expect(cls).toContain("text-sm");
    expect(cls).toContain("text-muted-foreground");
  });
});

describe("CardContent", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders CardContent with children", () => {
    render(<CardContent>Body content</CardContent>);
    expect(screen.getByText("Body content")).toBeDefined();
  });

  it("applies content styling classes", () => {
    render(<CardContent data-testid="content">Body</CardContent>);
    const content = screen.getByTestId("content");
    const cls = content.getAttribute("class") ?? "";
    expect(cls).toContain("p-6");
    expect(cls).toContain("pt-0");
  });
});

describe("CardFooter", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders CardFooter with children", () => {
    render(<CardFooter>Footer content</CardFooter>);
    expect(screen.getByText("Footer content")).toBeDefined();
  });

  it("applies footer styling classes", () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>);
    const footer = screen.getByTestId("footer");
    const cls = footer.getAttribute("class") ?? "";
    expect(cls).toContain("flex");
    expect(cls).toContain("items-center");
    expect(cls).toContain("p-6");
    expect(cls).toContain("pt-0");
  });
});

describe("Card composition", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders complete Card with all subcomponents", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Meeting Minutes</CardTitle>
          <CardDescription>Weekly team meeting</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Meeting content here</p>
        </CardContent>
        <CardFooter>
          <button type="button">Save</button>
        </CardFooter>
      </Card>,
    );

    expect(screen.getByRole("heading")).toHaveTextContent("Meeting Minutes");
    expect(screen.getByText("Weekly team meeting")).toBeDefined();
    expect(screen.getByText("Meeting content here")).toBeDefined();
    expect(screen.getByRole("button")).toHaveTextContent("Save");
  });
});

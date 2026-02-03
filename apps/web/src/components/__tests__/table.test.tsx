import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

describe("Table Components", () => {
  afterEach(() => {
    cleanup();
  });

  describe("Table", () => {
    it("renders a table element", () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    it("wraps table in overflow container", () => {
      render(
        <Table data-testid="table">
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      const table = screen.getByTestId("table");
      expect(table.parentElement).toHaveClass("relative", "w-full", "overflow-auto");
    });

    it("applies custom className", () => {
      render(
        <Table className="custom-class" data-testid="table">
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(screen.getByTestId("table")).toHaveClass("custom-class");
    });

    it("forwards ref to table element", () => {
      const ref = createRef<HTMLTableElement>();
      render(
        <Table ref={ref}>
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(ref.current).toBeInstanceOf(HTMLTableElement);
    });
  });

  describe("TableHeader", () => {
    it("renders a thead element", () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );
      expect(screen.getByRole("rowgroup")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(
        <Table>
          <TableHeader className="custom-header" data-testid="header">
            <TableRow>
              <TableHead>Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );
      expect(screen.getByTestId("header")).toHaveClass("custom-header");
    });

    it("forwards ref to thead element", () => {
      const ref = createRef<HTMLTableSectionElement>();
      render(
        <Table>
          <TableHeader ref={ref}>
            <TableRow>
              <TableHead>Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );
      expect(ref.current?.tagName).toBe("THEAD");
    });
  });

  describe("TableBody", () => {
    it("renders a tbody element", () => {
      render(
        <Table>
          <TableBody data-testid="body">
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(screen.getByTestId("body").tagName).toBe("TBODY");
    });

    it("applies custom className", () => {
      render(
        <Table>
          <TableBody className="custom-body" data-testid="body">
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(screen.getByTestId("body")).toHaveClass("custom-body");
    });

    it("forwards ref to tbody element", () => {
      const ref = createRef<HTMLTableSectionElement>();
      render(
        <Table>
          <TableBody ref={ref}>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(ref.current?.tagName).toBe("TBODY");
    });
  });

  describe("TableFooter", () => {
    it("renders a tfoot element", () => {
      render(
        <Table>
          <TableFooter data-testid="footer">
            <TableRow>
              <TableCell>Footer</TableCell>
            </TableRow>
          </TableFooter>
        </Table>,
      );
      expect(screen.getByTestId("footer").tagName).toBe("TFOOT");
    });

    it("applies default styling", () => {
      render(
        <Table>
          <TableFooter data-testid="footer">
            <TableRow>
              <TableCell>Footer</TableCell>
            </TableRow>
          </TableFooter>
        </Table>,
      );
      expect(screen.getByTestId("footer")).toHaveClass("border-t", "bg-muted/50");
    });

    it("forwards ref to tfoot element", () => {
      const ref = createRef<HTMLTableSectionElement>();
      render(
        <Table>
          <TableFooter ref={ref}>
            <TableRow>
              <TableCell>Footer</TableCell>
            </TableRow>
          </TableFooter>
        </Table>,
      );
      expect(ref.current?.tagName).toBe("TFOOT");
    });
  });

  describe("TableRow", () => {
    it("renders a tr element", () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(screen.getByRole("row")).toBeInTheDocument();
    });

    it("applies hover styling", () => {
      render(
        <Table>
          <TableBody>
            <TableRow data-testid="row">
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(screen.getByTestId("row")).toHaveClass("hover:bg-muted/50");
    });

    it("forwards ref to tr element", () => {
      const ref = createRef<HTMLTableRowElement>();
      render(
        <Table>
          <TableBody>
            <TableRow ref={ref}>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(ref.current?.tagName).toBe("TR");
    });
  });

  describe("TableHead", () => {
    it("renders a th element", () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );
      expect(screen.getByRole("columnheader")).toBeInTheDocument();
    });

    it("applies default styling", () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead data-testid="head">Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );
      expect(screen.getByTestId("head")).toHaveClass(
        "h-12",
        "px-4",
        "text-left",
        "font-medium",
        "text-muted-foreground",
      );
    });

    it("forwards ref to th element", () => {
      const ref = createRef<HTMLTableCellElement>();
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead ref={ref}>Header</TableHead>
            </TableRow>
          </TableHeader>
        </Table>,
      );
      expect(ref.current?.tagName).toBe("TH");
    });
  });

  describe("TableCell", () => {
    it("renders a td element", () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell>Cell Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(screen.getByRole("cell")).toBeInTheDocument();
      expect(screen.getByText("Cell Content")).toBeInTheDocument();
    });

    it("applies default styling", () => {
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell data-testid="cell">Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(screen.getByTestId("cell")).toHaveClass("p-4", "align-middle");
    });

    it("forwards ref to td element", () => {
      const ref = createRef<HTMLTableCellElement>();
      render(
        <Table>
          <TableBody>
            <TableRow>
              <TableCell ref={ref}>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(ref.current?.tagName).toBe("TD");
    });
  });

  describe("TableCaption", () => {
    it("renders a caption element", () => {
      render(
        <Table>
          <TableCaption>Table Caption</TableCaption>
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(screen.getByText("Table Caption")).toBeInTheDocument();
    });

    it("applies default styling", () => {
      render(
        <Table>
          <TableCaption data-testid="caption">Caption</TableCaption>
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(screen.getByTestId("caption")).toHaveClass("mt-4", "text-sm", "text-muted-foreground");
    });

    it("forwards ref to caption element", () => {
      const ref = createRef<HTMLTableCaptionElement>();
      render(
        <Table>
          <TableCaption ref={ref}>Caption</TableCaption>
          <TableBody>
            <TableRow>
              <TableCell>Cell</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(ref.current?.tagName).toBe("CAPTION");
    });
  });

  describe("Full Table Example", () => {
    it("renders complete table structure", () => {
      render(
        <Table>
          <TableCaption>Team Members</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Alice</TableCell>
              <TableCell>Developer</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Bob</TableCell>
              <TableCell>Designer</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>Total: 2 members</TableCell>
            </TableRow>
          </TableFooter>
        </Table>,
      );

      expect(screen.getByText("Team Members")).toBeInTheDocument();
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Role")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Developer")).toBeInTheDocument();
      expect(screen.getByText("Designer")).toBeInTheDocument();
      expect(screen.getByText("Total: 2 members")).toBeInTheDocument();
    });
  });
});

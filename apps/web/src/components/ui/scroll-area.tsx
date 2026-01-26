import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Maximum height of the scroll area
   */
  maxHeight?: string | number;
}

const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, maxHeight, style, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("overflow-y-auto scrollbar-thin scrollbar-track-transparent", className)}
        style={{
          ...style,
          maxHeight:
            maxHeight !== undefined
              ? typeof maxHeight === "number"
                ? `${maxHeight}px`
                : maxHeight
              : undefined,
        }}
        {...props}
      >
        {children}
      </div>
    );
  },
);
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };

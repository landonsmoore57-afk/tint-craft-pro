import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface BottomActionBarProps {
  primary?: ReactNode;
  secondary?: ReactNode[];
  className?: string;
}

export function BottomActionBar({ primary, secondary, className }: BottomActionBarProps) {
  return (
    <div 
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-background border-t z-50",
        "p-4 pb-safe touch-manipulation",
        "md:hidden", // Only show on mobile
        className
      )}
      style={{
        paddingBottom: "calc(1rem + env(safe-area-inset-bottom))"
      }}
    >
      <div className="flex items-center gap-2">
        {primary && (
          <div className="flex-1">
            {primary}
          </div>
        )}
        {secondary && secondary.length > 0 && (
          <div className="flex gap-2">
            {secondary.map((item, idx) => (
              <div key={idx}>{item}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

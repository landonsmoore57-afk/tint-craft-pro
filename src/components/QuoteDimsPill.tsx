import { Ruler } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function QuoteDimsPill({ className = "" }: { className?: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`inline-flex items-center justify-center rounded-full h-5 w-5 bg-muted text-muted-foreground border border-border ${className}`}
            aria-label="Quote dimensions used for pricing"
          >
            <Ruler className="h-3 w-3" aria-hidden />
          </div>
        </TooltipTrigger>
        <TooltipContent>Quote dimensions</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

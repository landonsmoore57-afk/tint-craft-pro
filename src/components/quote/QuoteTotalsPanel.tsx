import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QuoteTotals, formatCurrency } from "@/lib/quoteCalculations";
import { AlertCircle } from "lucide-react";

interface QuoteTotalsPanelProps {
  totals: QuoteTotals;
  validationErrors: string[];
}

export function QuoteTotalsPanel({ totals, validationErrors }: QuoteTotalsPanelProps) {
  return (
    <div className="sticky top-6 space-y-4">
      {validationErrors.length > 0 && (
        <Alert variant="destructive" className="border-destructive/20 bg-destructive/5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <div className="font-medium mb-2">Validation Issues:</div>
            <ul className="space-y-1">
              {validationErrors.map((error, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-destructive mt-2 flex-shrink-0"></span>
                  <span>{error}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card className="shadow-lg border-primary/10">
        <CardHeader className="bg-gradient-to-r from-quote-totals/10 to-accent/5 border-b">
          <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-quote-totals"></div>
            Quote Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold font-mono">{formatCurrency(totals.subtotal)}</span>
            </div>
            
            {totals.discount_flat_amount > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Discount (Flat)</span>
                <span className="font-semibold font-mono text-accent">-{formatCurrency(totals.discount_flat_amount)}</span>
              </div>
            )}
            
            {totals.discount_percent_amount > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Discount (%)</span>
                <span className="font-semibold font-mono text-accent">-{formatCurrency(totals.discount_percent_amount)}</span>
              </div>
            )}
            
            {totals.travel_fee > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Travel Fee</span>
                <span className="font-semibold font-mono">{formatCurrency(totals.travel_fee)}</span>
              </div>
            )}
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-semibold font-mono">{formatCurrency(totals.tax_amount)}</span>
            </div>
          </div>
          
          <div className="border-t border-border pt-4">
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg">Grand Total</span>
              <span className="font-bold text-xl text-quote-totals font-mono">
                {formatCurrency(totals.grand_total)}
              </span>
            </div>
          </div>
          
          {totals.deposit_due > 0 && (
            <div className="bg-quote-calculation rounded-lg p-4 border border-quote-calculation-foreground/20">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold text-quote-calculation-foreground">Deposit Due</div>
                  <div className="text-xs text-quote-calculation-foreground/70 uppercase tracking-wide">
                    Due upon signing
                  </div>
                </div>
                <span className="font-bold text-lg text-quote-calculation-foreground font-mono">
                  {formatCurrency(totals.deposit_due)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

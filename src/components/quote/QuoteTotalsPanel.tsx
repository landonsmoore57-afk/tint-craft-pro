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
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1">
              {validationErrors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Quote Totals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
          </div>
          {totals.discount_flat_amount > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Discount (flat)</span>
              <span>-{formatCurrency(totals.discount_flat_amount)}</span>
            </div>
          )}
          {totals.discount_percent_amount > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Discount (%)</span>
              <span>-{formatCurrency(totals.discount_percent_amount)}</span>
            </div>
          )}
          {totals.travel_fee > 0 && (
            <div className="flex justify-between text-sm">
              <span>Travel Fee</span>
              <span>{formatCurrency(totals.travel_fee)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span>Tax</span>
            <span>{formatCurrency(totals.tax_amount)}</span>
          </div>
          <div className="border-t pt-3 flex justify-between font-bold text-lg">
            <span>Grand Total</span>
            <span className="text-primary">{formatCurrency(totals.grand_total)}</span>
          </div>
          {totals.deposit_due > 0 && (
            <div className="flex justify-between text-sm bg-muted p-2 rounded">
              <span>Deposit Due</span>
              <span className="font-semibold">{formatCurrency(totals.deposit_due)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { SectionData, SectionCalculation, FilmData, WindowData } from "@/lib/quoteCalculations";
import { formatCurrency, formatSqft } from "@/lib/quoteCalculations";

interface QuoteSectionProps {
  section: SectionData;
  sectionIndex: number;
  films: FilmData[];
  calculation?: SectionCalculation;
  onUpdateSection: (sectionId: string, updates: Partial<SectionData>) => void;
  onDeleteSection: (sectionId: string) => void;
  onAddWindow: (sectionId: string) => void;
  onUpdateWindow: (sectionId: string, windowId: string, updates: Partial<WindowData>) => void;
  onDeleteWindow: (sectionId: string, windowId: string) => void;
}

export function QuoteSection({
  section,
  sectionIndex,
  films,
  calculation,
  onUpdateSection,
  onDeleteSection,
  onAddWindow,
  onUpdateWindow,
  onDeleteWindow,
}: QuoteSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <Input
              value={section.name}
              onChange={(e) => onUpdateSection(section.id, { name: e.target.value })}
              className="text-lg font-semibold"
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => onDeleteSection(section.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2">
          <Label>Section Film Override</Label>
          <Select
            value={section.section_film_id || ""}
            onValueChange={(v) => onUpdateSection(section.id, { section_film_id: v || null })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Use quote default..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Use quote default</SelectItem>
              {films.map((film) => (
                <SelectItem key={film.id} value={film.id}>
                  {film.brand} {film.series} - {film.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {section.windows.map((window, wIndex) => {
          const calc = calculation?.windows.find(w => w.id === window.id);
          return (
            <div key={window.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Input
                  value={window.label}
                  onChange={(e) => onUpdateWindow(section.id, window.id, { label: e.target.value })}
                  className="font-medium"
                />
                <Button variant="ghost" size="icon" onClick={() => onDeleteWindow(section.id, window.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <Label>Width (in)</Label>
                  <Input
                    type="number"
                    value={window.width_in}
                    onChange={(e) => onUpdateWindow(section.id, window.id, { width_in: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Height (in)</Label>
                  <Input
                    type="number"
                    value={window.height_in}
                    onChange={(e) => onUpdateWindow(section.id, window.id, { height_in: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Qty</Label>
                  <Input
                    type="number"
                    value={window.quantity}
                    onChange={(e) => onUpdateWindow(section.id, window.id, { quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label>Waste %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={window.waste_factor_percent}
                    onChange={(e) => onUpdateWindow(section.id, window.id, { waste_factor_percent: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <Label>Window Film Override</Label>
                <Select
                  value={window.window_film_id || ""}
                  onValueChange={(v) => onUpdateWindow(section.id, window.id, { window_film_id: v || null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Use section/quote default..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Use default</SelectItem>
                    {films.map((film) => (
                      <SelectItem key={film.id} value={film.id}>
                        {film.brand} {film.series} - {film.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {calc && (
                <div className="text-sm bg-muted p-2 rounded">
                  <div className="grid grid-cols-3 gap-2">
                    <div>Area: {formatSqft(calc.effective_area_sqft)} sqft</div>
                    <div>Rate: {formatCurrency(calc.sell_per_sqft)}/sqft</div>
                    <div className="font-semibold">Total: {formatCurrency(calc.line_total)}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <Button onClick={() => onAddWindow(section.id)} variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Window
        </Button>
      </CardContent>
    </Card>
  );
}

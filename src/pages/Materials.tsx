import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

interface Material {
  id: string;
  key: string;
  name: string;
  unit: string;
  cost_per_linear_ft: number;
  sell_per_linear_ft: number;
  active: boolean;
}

export default function Materials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState<Record<string, { cost: string; sell: string; active: boolean }>>({});

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .order("key");

      if (error) throw error;
      
      setMaterials(data || []);
      
      // Initialize form data
      const initialFormData: Record<string, { cost: string; sell: string; active: boolean }> = {};
      (data || []).forEach((material) => {
        initialFormData[material.id] = {
          cost: material.cost_per_linear_ft.toString(),
          sell: material.sell_per_linear_ft.toString(),
          active: material.active,
        };
      });
      setFormData(initialFormData);
    } catch (error: any) {
      toast({
        title: "Error fetching materials",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      for (const material of materials) {
        const form = formData[material.id];
        if (!form) continue;

        const cost = parseFloat(form.cost);
        const sell = parseFloat(form.sell);

        // Validation
        if (isNaN(cost) || cost < 0) {
          throw new Error(`${material.name}: Cost must be a non-negative number`);
        }
        if (isNaN(sell) || sell < 0) {
          throw new Error(`${material.name}: Sell price must be a non-negative number`);
        }
        if (sell < cost) {
          throw new Error(`${material.name}: Sell price must be greater than or equal to cost`);
        }

        const { error } = await supabase
          .from("materials")
          .update({
            cost_per_linear_ft: cost,
            sell_per_linear_ft: sell,
            active: form.active,
          })
          .eq("id", material.id);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Materials pricing updated successfully",
      });

      fetchMaterials();
    } catch (error: any) {
      toast({
        title: "Error saving materials",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateFormData = (id: string, field: 'cost' | 'sell' | 'active', value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const calculateMargin = (cost: string, sell: string) => {
    const costNum = parseFloat(cost);
    const sellNum = parseFloat(sell);
    if (isNaN(costNum) || isNaN(sellNum) || sellNum === 0) return "0.0";
    const margin = ((sellNum - costNum) / sellNum) * 100;
    return margin.toFixed(1);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Materials Pricing</h1>
          <p className="text-muted-foreground">
            Configure pricing for gasket and caulk materials used with security film
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Linear Foot Pricing</CardTitle>
          <CardDescription>
            Materials are charged by linear foot for windows using security film
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Cost / Linear Ft</TableHead>
                  <TableHead>Sell / Linear Ft</TableHead>
                  <TableHead>Margin %</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((material) => {
                  const form = formData[material.id] || { cost: "0", sell: "0", active: true };
                  return (
                    <TableRow key={material.id}>
                      <TableCell className="font-medium">{material.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.cost}
                            onChange={(e) => updateFormData(material.id, 'cost', e.target.value)}
                            className="w-32"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.sell}
                            onChange={(e) => updateFormData(material.id, 'sell', e.target.value)}
                            className="w-32"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-primary">
                          {calculateMargin(form.cost, form.sell)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={form.active}
                          onCheckedChange={(checked) => updateFormData(material.id, 'active', checked)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold mb-2">How Materials Pricing Works</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Materials are only charged for windows using security film</li>
              <li>• Linear feet = perimeter of window × quantity (no waste factor applied)</li>
              <li>• Quote settings allow selection of Gasket, Caulk, or Both</li>
              <li>• "Both" option sums the per-linear-foot prices of Gasket + Caulk</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

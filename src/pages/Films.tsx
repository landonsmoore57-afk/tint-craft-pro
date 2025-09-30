import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface Film {
  id: string;
  brand: string;
  series: string;
  name: string;
  vlt: number | null;
  sku: string | null;
  cost_per_sqft: number;
  sell_per_sqft: number;
  notes: string | null;
  active: boolean;
  security_film: boolean;
}

export default function Films() {
  const [films, setFilms] = useState<Film[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFilm, setEditingFilm] = useState<Film | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    brand: "",
    series: "",
    name: "",
    vlt: "",
    sku: "",
    cost_per_sqft: "",
    sell_per_sqft: "",
    notes: "",
    active: true,
    security_film: false,
  });

  useEffect(() => {
    fetchFilms();
  }, []);

  const fetchFilms = async () => {
    try {
      const { data, error } = await supabase
        .from("films")
        .select("*")
        .order("brand", { ascending: true });

      if (error) throw error;
      setFilms(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching films",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const filmData = {
      brand: formData.brand,
      series: formData.series,
      name: formData.name,
      vlt: formData.vlt ? parseInt(formData.vlt) : null,
      sku: formData.sku || null,
      cost_per_sqft: parseFloat(formData.cost_per_sqft),
      sell_per_sqft: parseFloat(formData.sell_per_sqft),
      notes: formData.notes || null,
      active: formData.active,
      security_film: formData.security_film,
    };

    try {
      if (editingFilm) {
        const { error } = await supabase
          .from("films")
          .update(filmData)
          .eq("id", editingFilm.id);
        if (error) throw error;
        toast({ title: "Film updated successfully" });
      } else {
        const { error } = await supabase.from("films").insert([filmData]);
        if (error) throw error;
        toast({ title: "Film created successfully" });
      }
      
      setDialogOpen(false);
      resetForm();
      fetchFilms();
    } catch (error: any) {
      toast({
        title: "Error saving film",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this film?")) return;
    
    try {
      const { error } = await supabase.from("films").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Film deleted successfully" });
      fetchFilms();
    } catch (error: any) {
      toast({
        title: "Error deleting film",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      brand: "",
      series: "",
      name: "",
      vlt: "",
      sku: "",
      cost_per_sqft: "",
      sell_per_sqft: "",
      notes: "",
      active: true,
      security_film: false,
    });
    setEditingFilm(null);
  };

  const openEditDialog = (film: Film) => {
    setEditingFilm(film);
    setFormData({
      brand: film.brand,
      series: film.series,
      name: film.name,
      vlt: film.vlt?.toString() || "",
      sku: film.sku || "",
      cost_per_sqft: film.cost_per_sqft.toString(),
      sell_per_sqft: film.sell_per_sqft.toString(),
      notes: film.notes || "",
      active: film.active,
      security_film: film.security_film,
    });
    setDialogOpen(true);
  };

  const filteredFilms = films.filter(
    (film) =>
      film.brand.toLowerCase().includes(search.toLowerCase()) ||
      film.series.toLowerCase().includes(search.toLowerCase()) ||
      film.name.toLowerCase().includes(search.toLowerCase())
  );

  const calculateMargin = (cost: number, sell: number) => {
    const margin = sell - cost;
    const percentage = ((margin / sell) * 100).toFixed(1);
    return { margin: margin.toFixed(2), percentage };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Film Catalog</h1>
          <p className="text-muted-foreground">Manage your window tint films</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { 
          setDialogOpen(open); 
          if (!open) resetForm(); 
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Film
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingFilm ? "Edit Film" : "Add New Film"}</DialogTitle>
              <DialogDescription>
                {editingFilm ? "Update film details" : "Add a new film to your catalog"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Brand *</Label>
                  <Input
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Series *</Label>
                  <Input
                    value={formData.series}
                    onChange={(e) => setFormData({ ...formData, series: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>VLT %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.vlt}
                    onChange={(e) => setFormData({ ...formData, vlt: e.target.value })}
                  />
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cost per SqFt *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost_per_sqft}
                    onChange={(e) => setFormData({ ...formData, cost_per_sqft: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Sell per SqFt *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.sell_per_sqft}
                    onChange={(e) => setFormData({ ...formData, sell_per_sqft: e.target.value })}
                    required
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                  />
                  <Label>Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.security_film}
                    onCheckedChange={(checked) => setFormData({ ...formData, security_film: checked })}
                  />
                  <Label>Security Film</Label>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingFilm ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Films</CardTitle>
          <CardDescription>
            {filteredFilms.length} film{filteredFilms.length !== 1 ? "s" : ""} in catalog
          </CardDescription>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by brand, series, or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead>Series</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>VLT</TableHead>
                  <TableHead>Security</TableHead>
                  <TableHead>Cost/SqFt</TableHead>
                  <TableHead>Sell/SqFt</TableHead>
                  <TableHead>Margin</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredFilms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      No films found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFilms.map((film) => {
                    const { margin, percentage } = calculateMargin(film.cost_per_sqft, film.sell_per_sqft);
                    return (
                      <TableRow key={film.id}>
                        <TableCell className="font-medium">{film.brand}</TableCell>
                        <TableCell>{film.series}</TableCell>
                        <TableCell>{film.name}</TableCell>
                        <TableCell>{film.vlt ? `${film.vlt}%` : "-"}</TableCell>
                        <TableCell>
                          <Badge variant={film.security_film ? "default" : "secondary"}>
                            {film.security_film ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>${film.cost_per_sqft.toFixed(2)}</TableCell>
                        <TableCell>${film.sell_per_sqft.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">${margin}</div>
                            <div className="text-muted-foreground">{percentage}%</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={film.active ? "default" : "secondary"}>
                            {film.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(film)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(film.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

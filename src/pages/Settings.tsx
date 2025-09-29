import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Upload } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [brandColor, setBrandColor] = useState("#0891B2");
  const [logoUrl, setLogoUrl] = useState("");
  const [pdfFooterTerms, setPdfFooterTerms] = useState("");
  const [themeStyle, setThemeStyle] = useState("Modern");
  const [tagline, setTagline] = useState("");
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setSettingsId(data.id);
        setCompanyName(data.company_name);
        setBrandColor(data.brand_color_hex);
        setLogoUrl(data.logo_url || "");
        setPdfFooterTerms(data.pdf_footer_terms || "");
        setThemeStyle(data.theme_style || "Modern");
        setTagline(data.tagline || "");
      }
    } catch (error: any) {
      toast({
        title: "Error loading settings",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Logo must be under 4MB",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.match(/^image\/(png|svg\+xml|jpeg|jpg)$/)) {
      toast({
        title: "Invalid file type",
        description: "Logo must be PNG, SVG, or JPG",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("logos")
        .getPublicUrl(fileName);

      setLogoUrl(publicUrl);

      toast({
        title: "Logo uploaded",
        description: "Logo uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!companyName.trim()) {
      toast({
        title: "Validation error",
        description: "Company name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const settingsData = {
        company_name: companyName,
        brand_color_hex: brandColor,
        logo_url: logoUrl || null,
        pdf_footer_terms: pdfFooterTerms || null,
        theme_style: themeStyle,
        tagline: tagline || null,
      };

      if (settingsId) {
        const { error } = await supabase
          .from("company_settings")
          .update(settingsData)
          .eq("id", settingsId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("company_settings")
          .insert([settingsData])
          .select()
          .single();

        if (error) throw error;
        setSettingsId(data.id);
      }

      toast({
        title: "Settings saved",
        description: "Company settings updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Company Settings</h1>
        <p className="text-muted-foreground">Configure branding and PDF appearance</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Company Name *</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your Company Name" />
          </div>

          <div>
            <Label>Company Tagline (optional)</Label>
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Professional Window Tinting Services" />
            <p className="text-sm text-muted-foreground mt-1">Appears below company name in PDF header</p>
          </div>

          <div>
            <Label>Brand Color</Label>
            <div className="flex gap-2">
              <Input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-20 h-10 cursor-pointer" />
              <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} placeholder="#0891B2" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">Used for PDF headers and branding elements</p>
          </div>

          <div>
            <Label>PDF Theme</Label>
            <Select value={themeStyle} onValueChange={setThemeStyle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Modern">Modern (Default)</SelectItem>
                <SelectItem value="Minimal">Minimal</SelectItem>
                <SelectItem value="Bold">Bold</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-1">Visual style for PDF quotes (Modern recommended)</p>
          </div>

          <div>
            <Label>Company Logo</Label>
            <div className="flex items-center gap-4">
              <Button type="button" variant="outline" onClick={() => document.getElementById("logo-upload")?.click()} disabled={loading}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Logo
              </Button>
              <input id="logo-upload" type="file" accept="image/png,image/svg+xml,image/jpeg,image/jpg" className="hidden" onChange={handleLogoUpload} />
              {logoUrl && (
                <div className="flex items-center gap-2">
                  <img src={logoUrl} alt="Company logo" className="h-10 max-w-[200px] object-contain" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl("")}>Remove</Button>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">PNG, SVG, or JPG. Max 4MB. Appears in PDF header.</p>
          </div>

          <div>
            <Label>PDF Footer Terms</Label>
            <Textarea value={pdfFooterTerms} onChange={(e) => setPdfFooterTerms(e.target.value)} rows={4} placeholder="Enter terms and conditions to appear at the bottom of quotes..." />
            <p className="text-sm text-muted-foreground mt-1">Payment terms, warranty info, and legal text for PDF footer</p>
          </div>

          <Button onClick={saveSettings} disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

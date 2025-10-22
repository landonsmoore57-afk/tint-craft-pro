import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Upload, X, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { FilmSelector } from "@/components/quote/FilmSelector";
import { useAuth } from "@/contexts/AuthContext";

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [brandColor, setBrandColor] = useState("#0891B2");
  const [logoUrl, setLogoUrl] = useState("");
  const [pdfFooterTerms, setPdfFooterTerms] = useState("");
  const [themeStyle, setThemeStyle] = useState("Modern");
  const [tagline, setTagline] = useState("");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [defaultFilmId, setDefaultFilmId] = useState<string | null>(null);
  const [defaultIntroductionMessage, setDefaultIntroductionMessage] = useState("");
  const [jobberConnected, setJobberConnected] = useState(false);
  const [checkingJobber, setCheckingJobber] = useState(false);

  useEffect(() => {
    loadSettings();
    checkJobberConnection();
    
    // Check for OAuth callback status
    const params = new URLSearchParams(window.location.search);
    if (params.get('jobber') === 'connected') {
      toast({
        title: "Jobber Connected",
        description: "Successfully connected to Jobber",
      });
      setJobberConnected(true);
      // Clean URL
      window.history.replaceState({}, '', '/settings');
    } else if (params.get('jobber') === 'error') {
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Jobber. Please try again.",
        variant: "destructive",
      });
      // Clean URL
      window.history.replaceState({}, '', '/settings');
    }
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
        setDefaultFilmId(data.default_film_id || null);
        setDefaultIntroductionMessage(data.default_introduction_message || "");
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

  const checkJobberConnection = async () => {
    if (!user?.id) return;
    
    try {
      setCheckingJobber(true);
      const { data, error } = await supabase
        .from("integration_jobber_tokens")
        .select("id")
        .eq("account_id", user.id)
        .maybeSingle();
      
      setJobberConnected(!!data);
    } catch (error) {
      console.error("Error checking Jobber connection:", error);
    } finally {
      setCheckingJobber(false);
    }
  };

  const handleConnectJobber = () => {
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please log in to connect Jobber",
        variant: "destructive",
      });
      return;
    }
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const appOrigin = window.location.origin;
    const startUrl = `${supabaseUrl}/functions/v1/jobber-oauth-start?user_id=${user.id}&return_url=${encodeURIComponent(appOrigin)}`;
    window.location.href = startUrl;
  };

  const handleDisconnectJobber = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from("integration_jobber_tokens")
        .delete()
        .eq("account_id", user.id);
      
      if (error) throw error;
      
      setJobberConnected(false);
      toast({
        title: "Jobber Disconnected",
        description: "Successfully disconnected from Jobber",
      });
    } catch (error: any) {
      toast({
        title: "Disconnect Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    console.log('=== SAVING SETTINGS ===');
    console.log('defaultFilmId state:', defaultFilmId);
    
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
        default_film_id: defaultFilmId,
        default_introduction_message: defaultIntroductionMessage || null,
      };

      console.log('Settings data to save:', settingsData);

      if (settingsId) {
        console.log('Updating existing settings with ID:', settingsId);
        const { data, error } = await supabase
          .from("company_settings")
          .update(settingsData)
          .eq("id", settingsId)
          .select();

        console.log('Update result:', { data, error });
        if (error) throw error;
      } else {
        console.log('Inserting new settings');
        const { data, error } = await supabase
          .from("company_settings")
          .insert([settingsData])
          .select()
          .single();

        console.log('Insert result:', { data, error });
        if (error) throw error;
        setSettingsId(data.id);
      }

      toast({
        title: "Settings saved",
        description: "Company settings updated successfully",
      });
    } catch (error: any) {
      console.error('Save settings error:', error);
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
            {loading ? 'Saving…' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quote Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Default Film for New Quotes</Label>
            <div className="flex gap-2 mt-2">
              <div className="flex-1">
                <FilmSelector 
                  value={defaultFilmId} 
                  onChange={(filmId) => {
                    console.log('Film selected in Settings:', filmId);
                    setDefaultFilmId(filmId);
                  }}
                  placeholder="Select default film..."
                />
              </div>
              {defaultFilmId && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={() => setDefaultFilmId(null)}
                  title="Clear default film"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              This film will be automatically applied as the <strong>Global Film</strong> for all <strong>new quotes</strong>. 
              It will NOT affect existing quotes.
            </p>
          </div>

          <div>
            <Label>Default Introduction Message for New Quotes</Label>
            <Textarea 
              value={defaultIntroductionMessage} 
              onChange={(e) => setDefaultIntroductionMessage(e.target.value)} 
              rows={4} 
              maxLength={1000}
              placeholder="Enter default introduction message for new quotes..."
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-sm text-muted-foreground">
                This message will appear at the top of new quotes (can be customized per quote)
              </p>
              <span className="text-xs text-muted-foreground">{defaultIntroductionMessage.length}/1000</span>
            </div>
          </div>

          <Button onClick={saveSettings} disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? 'Saving…' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Label className="text-base">Jobber</Label>
                {checkingJobber ? (
                  <span className="text-sm text-muted-foreground">Checking...</span>
                ) : jobberConnected ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              {jobberConnected ? (
                <span className="text-sm text-green-600 font-medium">Connected</span>
              ) : (
                <span className="text-sm text-muted-foreground">Not connected</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Jobber account to push quotes directly to Jobber as clients, properties, and quote estimates.
            </p>
            {jobberConnected ? (
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleDisconnectJobber}
                  disabled={loading}
                >
                  Disconnect Jobber
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => window.open('https://secure.getjobber.com', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Jobber
                </Button>
              </div>
            ) : (
              <Button 
                type="button" 
                onClick={handleConnectJobber}
                disabled={loading || checkingJobber}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Connect to Jobber
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

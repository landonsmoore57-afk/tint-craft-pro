import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock } from "lucide-react";

export default function Auth() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, role, login } = useAuth();

  useEffect(() => {
    if (user && role) {
      // Redirect based on role
      if (role === 'tinter') {
        navigate("/jobs");
      } else {
        navigate("/");
      }
    }
  }, [user, role, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(pin);
      
      if (!result.success) {
        toast({
          title: "Login failed",
          description: result.error || "Invalid PIN",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Welcome!",
          description: "Successfully signed in.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(value);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-lg bg-primary flex items-center justify-center">
              <Lock className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">Window Tint OS</CardTitle>
          <CardDescription>
            Enter your 4-digit PIN to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="pin" className="text-center block text-lg">PIN</Label>
              <Input
                id="pin"
                type="text"
                inputMode="numeric"
                placeholder="••••"
                value={pin}
                onChange={handlePinInput}
                required
                maxLength={4}
                className="text-center text-2xl tracking-widest font-bold h-16"
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-center">
                Test PINs: 1234 (Admin), 5678 (Tinter), 9012 (Tinter)
              </p>
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 text-lg" 
              disabled={loading || pin.length !== 4}
            >
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, Film, Package, Settings as SettingsIcon, LogOut, Menu, Sparkles, X } from "lucide-react";
import { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

export default function Layout() {
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: "/", label: "Quotes", icon: FileText },
    { path: "/films", label: "Films", icon: Film },
    { path: "/materials", label: "Materials", icon: Package },
    { path: "/settings", label: "Settings", icon: SettingsIcon },
  ];

  if (!user) return null;

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-card transition-all duration-300",
          sidebarOpen ? "w-64" : "w-0 md:w-16"
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">Tint OS</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(!sidebarOpen && "mx-auto")}
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Button
              key={path}
              variant={isActive(path) ? "default" : "ghost"}
              className={cn(
                "w-full justify-start",
                !sidebarOpen && "justify-center px-2"
              )}
              onClick={() => navigate(path)}
            >
              <Icon className={cn("h-4 w-4", sidebarOpen && "mr-2")} />
              {sidebarOpen && label}
            </Button>
          ))}
        </nav>

        <div className="p-4 border-t">
          <Button
            variant="ghost"
            className={cn("w-full justify-start", !sidebarOpen && "justify-center px-2")}
            onClick={handleSignOut}
          >
            <LogOut className={cn("h-4 w-4", sidebarOpen && "mr-2")} />
            {sidebarOpen && "Sign Out"}
          </Button>
          {sidebarOpen && (
            <div className="mt-2 text-xs text-muted-foreground truncate">
              {user.email}
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          sidebarOpen ? "md:ml-64" : "md:ml-16"
        )}
      >
        <div className="container mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { FileText, Film, Package, Settings as SettingsIcon, LogOut, Menu, Sparkles, X, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Layout() {
  const { user, role, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
    
    // Redirect tinters away from admin-only pages
    if (role === 'tinter' && location.pathname !== '/jobs') {
      navigate("/jobs");
    }
  }, [user, loading, role, location.pathname, navigate]);

  const handleSignOut = () => {
    logout();
    navigate("/auth");
  };

  const isActive = (path: string) => location.pathname === path;

  // Filter nav items based on role
  const allNavItems = [
    { path: "/", label: "Quotes", icon: FileText, roles: ['admin'] },
    { path: "/jobs", label: "Jobs", icon: Calendar, roles: ['admin', 'tinter'] },
    { path: "/films", label: "Films", icon: Film, roles: ['admin'] },
    { path: "/materials", label: "Materials", icon: Package, roles: ['admin'] },
    { path: "/settings", label: "Settings", icon: SettingsIcon, roles: ['admin'] },
  ];

  const navItems = allNavItems.filter(item => 
    role && item.roles.includes(role)
  );

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Mobile Hamburger Menu Button - Always Visible Fixed Position */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background/95 backdrop-blur-sm border-b z-[60] flex items-center px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="h-10 w-10 touch-manipulation"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-card transition-all duration-300",
          // Mobile: slide in from left when open, hidden when closed
          "md:relative",
          sidebarOpen ? "w-64" : "-translate-x-full md:translate-x-0 md:w-16"
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b">
          {(sidebarOpen || window.innerWidth >= 768) && (
            <div className={cn("flex items-center gap-2", !sidebarOpen && "md:hidden")}>
              <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              {sidebarOpen && <span className="font-semibold">Tint OS</span>}
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn("hidden md:flex", !sidebarOpen && "mx-auto")}
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden"
          >
            <X className="h-4 w-4" />
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
              {user.name}
              <div className="text-[10px] mt-0.5 capitalize">{role}</div>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main
        className={cn(
          "flex-1 w-full transition-all duration-300",
          "md:ml-0",
          sidebarOpen ? "md:ml-64" : "md:ml-16"
        )}
      >
        <div className="container mx-auto p-6 pt-16 md:pt-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

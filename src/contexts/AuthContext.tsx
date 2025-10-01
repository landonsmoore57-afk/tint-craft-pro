import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  name: string;
  pin: string;
  active: boolean;
}

interface UserRole {
  role: 'admin' | 'tinter';
}

interface AuthContextType {
  user: User | null;
  role: 'admin' | 'tinter' | null;
  loading: boolean;
  login: (pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'tinter' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in (stored in localStorage)
    const storedUserId = localStorage.getItem('user_id');
    if (storedUserId) {
      loadUser(storedUserId);
    } else {
      setLoading(false);
    }
  }, []);

  const loadUser = async (userId: string) => {
    try {
      // Fetch user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .eq('active', true)
        .single();

      if (userError || !userData) {
        logout();
        return;
      }

      // Fetch user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (roleError || !roleData) {
        logout();
        return;
      }

      setUser(userData);
      setRole(roleData.role);
    } catch (error) {
      console.error('Error loading user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Find user by PIN
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('pin', pin)
        .eq('active', true)
        .maybeSingle();

      if (userError) {
        return { success: false, error: userError.message };
      }

      if (!userData) {
        return { success: false, error: 'Invalid PIN' };
      }

      // Fetch user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.id)
        .single();

      if (roleError || !roleData) {
        return { success: false, error: 'User role not found' };
      }

      // Store user ID in localStorage
      localStorage.setItem('user_id', userData.id);
      
      setUser(userData);
      setRole(roleData.role);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('user_id');
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

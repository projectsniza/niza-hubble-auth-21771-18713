import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type UserRole = 'super_admin' | 'hr' | 'manager' | 'employee';

export type HRAccessLevel = 'full' | 'organization' | 'branch';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  organizationId?: string;
  branchId?: string;
  hrAccessLevel?: HRAccessLevel; // For HR users
  mustChangePassword?: boolean;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  updatePassword: (newPassword: string) => boolean;
  markPasswordChanged: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Get users from localStorage
const getStoredUsers = () => {
  const stored = localStorage.getItem('niza_managed_users');
  return stored ? JSON.parse(stored) : [];
};

// Check if this is a super admin (stored separately)
const getSuperAdmins = () => {
  const stored = localStorage.getItem('niza_super_admins');
  if (!stored) {
    // Create default super admin on first load
    const defaultAdmin = {
      id: '1',
      email: 'admin@niza.com',
      password: 'admin123',
      name: 'Super Admin',
      role: 'super_admin',
      mustChangePassword: false,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem('niza_super_admins', JSON.stringify([defaultAdmin]));
    return [defaultAdmin];
  }
  return JSON.parse(stored);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('niza_user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = (email: string, password: string): boolean => {
    // Check super admins
    const superAdmins = getSuperAdmins();
    const superAdmin = superAdmins.find((u: any) => u.email === email && u.password === password);
    
    if (superAdmin) {
      const userData: User = {
        id: superAdmin.id,
        email: superAdmin.email,
        role: 'super_admin',
        name: superAdmin.name,
        mustChangePassword: superAdmin.mustChangePassword || false
      };
      setUser(userData);
      localStorage.setItem('niza_user', JSON.stringify(userData));
      return true;
    }

    // Check managed users (HR, Manager, Employee)
    const managedUsers = getStoredUsers();
    const foundUser = managedUsers.find((u: any) => u.email === email && u.password === password);
    
    if (foundUser) {
      const userData: User = {
        id: foundUser.id,
        email: foundUser.email,
        role: foundUser.role,
        name: foundUser.name,
        organizationId: foundUser.organizationId,
        branchId: foundUser.branchId,
        hrAccessLevel: foundUser.hrAccessLevel,
        mustChangePassword: foundUser.mustChangePassword !== false // Default to true for new users
      };
      setUser(userData);
      localStorage.setItem('niza_user', JSON.stringify(userData));
      return true;
    }

    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('niza_user');
  };

  const updatePassword = (newPassword: string): boolean => {
    if (!user) return false;

    // Update password in appropriate storage
    if (user.role === 'super_admin') {
      const superAdmins = getSuperAdmins();
      const updated = superAdmins.map((u: any) => 
        u.id === user.id ? { ...u, password: newPassword, mustChangePassword: false } : u
      );
      localStorage.setItem('niza_super_admins', JSON.stringify(updated));
    } else {
      const managedUsers = getStoredUsers();
      const updated = managedUsers.map((u: any) => 
        u.id === user.id ? { ...u, password: newPassword, mustChangePassword: false } : u
      );
      localStorage.setItem('niza_managed_users', JSON.stringify(updated));
    }

    // Update current user state
    const updatedUser = { ...user, mustChangePassword: false };
    setUser(updatedUser);
    localStorage.setItem('niza_user', JSON.stringify(updatedUser));
    
    return true;
  };

  const markPasswordChanged = () => {
    if (!user) return;
    const updatedUser = { ...user, mustChangePassword: false };
    setUser(updatedUser);
    localStorage.setItem('niza_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updatePassword, markPasswordChanged }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
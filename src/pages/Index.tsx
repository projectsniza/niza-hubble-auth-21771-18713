import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { NizaLoaderFullPage } from "@/components/ui/niza-loader";

const Index = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    // If arriving from a Supabase recovery email link (hash has type=recovery or access_token)
    if (window.location.hash.includes('type=recovery')) {
      navigate('/reset-password' + window.location.hash, { replace: true });
      return;
    }

    if (!isLoading) {
      if (user) {
        navigate('/dashboard');
      } else {
        navigate('/login');
      }
    }
  }, [user, isLoading, navigate]);

  // Show loading while checking auth
  if (isLoading) {
    return <NizaLoaderFullPage />;
  }

  return null;
};

export default Index;
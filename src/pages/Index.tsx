import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { NizaLoaderFullPage } from "@/components/ui/niza-loader";

const Index = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
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
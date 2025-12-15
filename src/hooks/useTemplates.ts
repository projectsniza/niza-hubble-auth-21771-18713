import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export type TemplateType = 'visiting_card' | 'email_signature' | 'id_card' | 'visitor_pass' | 'invoice' | 'gift_card' | 'custom';

export interface Template {
  id: string;
  name: string;
  description: string | null;
  template_type: TemplateType;
  folder_id: string | null;
  organization_id: string | null;
  content: Record<string, any>;
  thumbnail_path: string | null;
  is_default: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateFolder {
  id: string;
  name: string;
  description: string | null;
  color: string;
  parent_id: string | null;
  organization_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GiftCard {
  id: string;
  title: string;
  card_type: string;
  valid_date: string | null;
  discount: string;
  code: string;
  description: string | null;
  design_template: Record<string, any>;
  organization_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandSettings {
  id: string;
  organization_id: string | null;
  primary_logo_path: string | null;
  secondary_logo_path: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  brand_colors: string[];
  fonts: { heading: string; body: string };
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Templates Hook
export function useTemplates(folderId?: string) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (folderId) {
        query = query.eq('folder_id', folderId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setTemplates((data || []) as Template[]);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      toast({ title: 'Error loading templates', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const createTemplate = async (template: Partial<Template>) => {
    try {
      const insertData: any = { ...template };
      if (user?.id) insertData.created_by = user.id;
      
      const { data, error } = await supabase
        .from('templates')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      
      toast({ title: 'Template created successfully' });
      fetchTemplates();
      return data;
    } catch (error: any) {
      console.error('Error creating template:', error);
      toast({ title: 'Error creating template', variant: 'destructive' });
      throw error;
    }
  };

  const updateTemplate = async (id: string, template: Partial<Template>) => {
    try {
      const { data, error } = await supabase
        .from('templates')
        .update(template)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      toast({ title: 'Template updated successfully' });
      fetchTemplates();
      return data;
    } catch (error: any) {
      console.error('Error updating template:', error);
      toast({ title: 'Error updating template', variant: 'destructive' });
      throw error;
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('templates')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      
      toast({ title: 'Template deleted successfully' });
      fetchTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast({ title: 'Error deleting template', variant: 'destructive' });
      throw error;
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [folderId]);

  return {
    templates,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refetch: fetchTemplates,
  };
}

// Template Folders Hook
export function useTemplateFolders() {
  const [folders, setFolders] = useState<TemplateFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchFolders = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('template_folders')
        .select('*')
        .order('name');

      if (error) throw error;
      
      setFolders((data || []) as TemplateFolder[]);
    } catch (error: any) {
      console.error('Error fetching folders:', error);
      toast({ title: 'Error loading folders', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const createFolder = async (folder: Partial<TemplateFolder>) => {
    try {
      const insertData: any = { ...folder };
      if (user?.id) insertData.created_by = user.id;
      
      const { data, error } = await supabase
        .from('template_folders')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      
      toast({ title: 'Folder created successfully' });
      fetchFolders();
      return data;
    } catch (error: any) {
      console.error('Error creating folder:', error);
      toast({ title: 'Error creating folder', variant: 'destructive' });
      throw error;
    }
  };

  const updateFolder = async (id: string, folder: Partial<TemplateFolder>) => {
    try {
      const { data, error } = await supabase
        .from('template_folders')
        .update(folder)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      toast({ title: 'Folder updated successfully' });
      fetchFolders();
      return data;
    } catch (error: any) {
      console.error('Error updating folder:', error);
      toast({ title: 'Error updating folder', variant: 'destructive' });
      throw error;
    }
  };

  const deleteFolder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('template_folders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({ title: 'Folder deleted successfully' });
      fetchFolders();
    } catch (error: any) {
      console.error('Error deleting folder:', error);
      toast({ title: 'Error deleting folder', variant: 'destructive' });
      throw error;
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  return {
    folders,
    isLoading,
    createFolder,
    updateFolder,
    deleteFolder,
    refetch: fetchFolders,
  };
}

// Gift Cards Hook
export function useGiftCards() {
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchGiftCards = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setGiftCards((data || []) as GiftCard[]);
    } catch (error: any) {
      console.error('Error fetching gift cards:', error);
      toast({ title: 'Error loading gift cards', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const createGiftCard = async (giftCard: Partial<GiftCard>) => {
    try {
      const insertData: any = { ...giftCard };
      if (user?.id) insertData.created_by = user.id;
      
      const { data, error } = await supabase
        .from('gift_cards')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      
      toast({ title: 'Gift card created successfully' });
      fetchGiftCards();
      return data;
    } catch (error: any) {
      console.error('Error creating gift card:', error);
      toast({ title: 'Error creating gift card', variant: 'destructive' });
      throw error;
    }
  };

  const updateGiftCard = async (id: string, giftCard: Partial<GiftCard>) => {
    try {
      const { data, error } = await supabase
        .from('gift_cards')
        .update(giftCard)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      toast({ title: 'Gift card updated successfully' });
      fetchGiftCards();
      return data;
    } catch (error: any) {
      console.error('Error updating gift card:', error);
      toast({ title: 'Error updating gift card', variant: 'destructive' });
      throw error;
    }
  };

  const deleteGiftCard = async (id: string) => {
    try {
      const { error } = await supabase
        .from('gift_cards')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      
      toast({ title: 'Gift card deleted successfully' });
      fetchGiftCards();
    } catch (error: any) {
      console.error('Error deleting gift card:', error);
      toast({ title: 'Error deleting gift card', variant: 'destructive' });
      throw error;
    }
  };

  useEffect(() => {
    fetchGiftCards();
  }, []);

  return {
    giftCards,
    isLoading,
    createGiftCard,
    updateGiftCard,
    deleteGiftCard,
    refetch: fetchGiftCards,
  };
}

// Brand Settings Hook
export function useBrandSettings() {
  const [brandSettings, setBrandSettings] = useState<BrandSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchBrandSettings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('brand_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      setBrandSettings(data as BrandSettings | null);
    } catch (error: any) {
      console.error('Error fetching brand settings:', error);
      toast({ title: 'Error loading brand settings', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const saveBrandSettings = async (settings: Partial<BrandSettings>) => {
    try {
      if (brandSettings?.id) {
        const { data, error } = await supabase
          .from('brand_settings')
          .update(settings)
          .eq('id', brandSettings.id)
          .select()
          .single();

        if (error) throw error;
        
        setBrandSettings(data as BrandSettings);
        toast({ title: 'Brand settings saved successfully' });
        return data;
      } else {
        const { data, error } = await supabase
          .from('brand_settings')
          .insert({
            ...settings,
            created_by: user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        
        setBrandSettings(data as BrandSettings);
        toast({ title: 'Brand settings created successfully' });
        return data;
      }
    } catch (error: any) {
      console.error('Error saving brand settings:', error);
      toast({ title: 'Error saving brand settings', variant: 'destructive' });
      throw error;
    }
  };

  const uploadLogo = async (file: File, type: 'primary' | 'secondary') => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-logo-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('template-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('template-assets')
        .getPublicUrl(filePath);

      const field = type === 'primary' ? 'primary_logo_path' : 'secondary_logo_path';
      await saveBrandSettings({ [field]: urlData.publicUrl });

      toast({ title: `${type === 'primary' ? 'Primary' : 'Secondary'} logo uploaded successfully` });
      return urlData.publicUrl;
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast({ title: 'Error uploading logo', variant: 'destructive' });
      throw error;
    }
  };

  useEffect(() => {
    fetchBrandSettings();
  }, []);

  return {
    brandSettings,
    isLoading,
    saveBrandSettings,
    uploadLogo,
    refetch: fetchBrandSettings,
  };
}

// Template Stats Hook
export function useTemplateStats() {
  const [stats, setStats] = useState({
    totalTemplates: 0,
    totalFolders: 0,
    totalGiftCards: 0,
    brandColorsCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      
      const [templatesRes, foldersRes, giftCardsRes, brandRes] = await Promise.all([
        supabase.from('templates').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('template_folders').select('id', { count: 'exact', head: true }),
        supabase.from('gift_cards').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('brand_settings').select('brand_colors').limit(1).maybeSingle(),
      ]);

      setStats({
        totalTemplates: templatesRes.count || 0,
        totalFolders: foldersRes.count || 0,
        totalGiftCards: giftCardsRes.count || 0,
        brandColorsCount: Array.isArray(brandRes.data?.brand_colors) ? brandRes.data.brand_colors.length : 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return { stats, isLoading, refetch: fetchStats };
}

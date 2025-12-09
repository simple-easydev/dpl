import { supabase } from './supabase';

const BUCKET_NAME = 'organization-logos';
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];

export interface LogoUploadResult {
  success: boolean;
  logoUrl?: string;
  logoFilePath?: string;
  error?: string;
}

export async function uploadOrganizationLogo(
  organizationId: string,
  file: File
): Promise<LogoUploadResult> {
  try {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Please upload a PNG, JPG, or SVG image.',
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: 'File size exceeds 2MB limit. Please choose a smaller image.',
      };
    }

    const { data: orgData } = await supabase
      .from('organizations')
      .select('logo_file_path')
      .eq('id', organizationId)
      .maybeSingle();

    if (orgData?.logo_file_path) {
      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([orgData.logo_file_path]);

      if (deleteError) {
        console.error('Error deleting old logo:', deleteError);
      }
    }

    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const filePath = `${organizationId}/${timestamp}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      return {
        success: false,
        error: `Upload failed: ${uploadError.message}`,
      };
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const logoUrl = urlData.publicUrl;

    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        logo_url: logoUrl,
        logo_file_path: filePath,
      })
      .eq('id', organizationId);

    if (updateError) {
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);
      return {
        success: false,
        error: `Failed to update organization: ${updateError.message}`,
      };
    }

    return {
      success: true,
      logoUrl,
      logoFilePath: filePath,
    };
  } catch (error) {
    console.error('Error uploading logo:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while uploading the logo.',
    };
  }
}

export async function deleteOrganizationLogo(
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('logo_file_path')
      .eq('id', organizationId)
      .maybeSingle();

    if (!orgData?.logo_file_path) {
      return { success: true };
    }

    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([orgData.logo_file_path]);

    if (deleteError) {
      return {
        success: false,
        error: `Failed to delete logo file: ${deleteError.message}`,
      };
    }

    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        logo_url: null,
        logo_file_path: null,
      })
      .eq('id', organizationId);

    if (updateError) {
      return {
        success: false,
        error: `Failed to update organization: ${updateError.message}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting logo:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while deleting the logo.',
    };
  }
}

export async function getOrganizationLogo(
  organizationId: string
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('organizations')
      .select('logo_url')
      .eq('id', organizationId)
      .maybeSingle();

    return data?.logo_url || null;
  } catch (error) {
    console.error('Error fetching logo:', error);
    return null;
  }
}

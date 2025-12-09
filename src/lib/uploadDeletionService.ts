import { supabase } from './supabase';
import { updateAggregatedData } from './dataProcessor';

interface DeleteUploadResult {
  success: boolean;
  error?: string;
}

export async function deleteUpload(
  uploadId: string,
  organizationId: string
): Promise<DeleteUploadResult> {
  try {
    const { data: upload, error: fetchError } = await supabase
      .from('uploads')
      .select('file_path, status')
      .eq('id', uploadId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching upload:', fetchError);
      return {
        success: false,
        error: `Failed to fetch upload: ${fetchError.message}`,
      };
    }

    if (!upload) {
      return {
        success: false,
        error: 'Upload not found or access denied',
      };
    }

    if (upload.status === 'processing') {
      return {
        success: false,
        error: 'Cannot delete upload while it is being processed',
      };
    }

    if (upload.file_path) {
      const { error: storageError } = await supabase.storage
        .from('uploads-storage')
        .remove([upload.file_path]);

      if (storageError) {
        console.error('Warning: Error deleting file from storage:', storageError);
      }
    }

    const { error: uploadDeleteError } = await supabase
      .from('uploads')
      .delete()
      .eq('id', uploadId)
      .eq('organization_id', organizationId);

    if (uploadDeleteError) {
      console.error('Error deleting upload record:', uploadDeleteError);

      if (uploadDeleteError.code === '42501') {
        return {
          success: false,
          error: 'Permission denied: You do not have access to delete this upload',
        };
      }

      if (uploadDeleteError.code === '23503') {
        return {
          success: false,
          error: 'Cannot delete upload: There are related records that must be removed first',
        };
      }

      return {
        success: false,
        error: `Failed to delete upload: ${uploadDeleteError.message}`,
      };
    }

    await updateAggregatedData(organizationId);

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error in deleteUpload:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `An unexpected error occurred while deleting the upload: ${errorMessage}`,
    };
  }
}

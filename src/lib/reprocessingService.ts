import { supabase } from './supabase';
import { parseFile } from './fileParser';
import { processAndStoreSalesData } from './dataProcessor';
import { extractTextFromPDF } from './pdfParser';

export interface ReprocessingResult {
  success: boolean;
  uploadId: string;
  originalRecordCount: number;
  newRecordCount: number;
  confidenceScore: number;
  aiConfigUsed: string;
  error?: string;
}

export async function reprocessUpload(
  uploadId: string,
  organizationId: string,
  userId: string
): Promise<ReprocessingResult> {
  try {
    const { data: upload, error: uploadError } = await supabase
      .from('uploads')
      .select('*')
      .eq('id', uploadId)
      .eq('organization_id', organizationId)
      .single();

    if (uploadError || !upload) {
      throw new Error('Upload not found or access denied');
    }

    if (!upload.file_path) {
      throw new Error('No file stored for this upload. Cannot reprocess.');
    }

    if (!upload.distributor_id) {
      throw new Error('No distributor associated with this upload.');
    }

    const originalRecordCount = await supabase
      .from('sales_data')
      .select('id', { count: 'exact', head: true })
      .eq('upload_id', uploadId)
      .then(({ count }) => count || 0);

    const filePath = upload.file_path;
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('uploads-storage')
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message || 'Unknown error'}`);
    }

    const file = new File([fileData], upload.filename, {
      type: fileData.type || 'application/octet-stream',
    });

    const isPDF = upload.filename.toLowerCase().endsWith('.pdf');

    await supabase
      .from('uploads')
      .update({ status: 'processing' })
      .eq('id', uploadId);

    await supabase
      .from('sales_data')
      .delete()
      .eq('upload_id', uploadId);

    let rows: any[] = [];

    if (isPDF) {
      await processAndStoreSalesData({
        organizationId,
        userId,
        filename: upload.filename,
        fileSize: file.size,
        distributorId: upload.distributor_id,
        pdfFile: file,
        unitType: upload.unit_type || 'cases',
      });
    } else {
      const parseResult = await parseFile(file);
      rows = parseResult.rows;

      await processAndStoreSalesData({
        organizationId,
        userId,
        filename: upload.filename,
        fileSize: file.size,
        rows,
        distributorId: upload.distributor_id,
        unitType: upload.unit_type || 'cases',
      });
    }

    const { data: updatedUpload } = await supabase
      .from('uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    const newRecordCount = await supabase
      .from('sales_data')
      .select('id', { count: 'exact', head: true })
      .eq('upload_id', uploadId)
      .then(({ count }) => count || 0);

    const confidenceScore = updatedUpload?.column_mapping?._confidence || 0;
    const aiConfigUsed = updatedUpload?.column_mapping?._ai_config_used || 'none';

    await supabase
      .from('uploads')
      .update({
        reprocessed_count: (upload.reprocessed_count || 0) + 1,
        reprocessed_at: new Date().toISOString(),
        reprocessing_results: {
          original_record_count: originalRecordCount,
          new_record_count: newRecordCount,
          confidence_score: confidenceScore,
          ai_config_used: aiConfigUsed,
          reprocessed_at: new Date().toISOString(),
        },
      })
      .eq('id', uploadId);

    return {
      success: true,
      uploadId,
      originalRecordCount,
      newRecordCount,
      confidenceScore,
      aiConfigUsed,
    };
  } catch (error: any) {
    await supabase
      .from('uploads')
      .update({
        status: 'failed',
        error_message: error.message,
      })
      .eq('id', uploadId);

    return {
      success: false,
      uploadId,
      originalRecordCount: 0,
      newRecordCount: 0,
      confidenceScore: 0,
      aiConfigUsed: 'none',
      error: error.message,
    };
  }
}

export async function canReprocessUpload(uploadId: string, organizationId: string): Promise<boolean> {
  const { data: upload, error } = await supabase
    .from('uploads')
    .select('file_path, is_reprocessable, status')
    .eq('id', uploadId)
    .eq('organization_id', organizationId)
    .single();

  if (error || !upload) {
    return false;
  }

  return (
    upload.file_path !== null &&
    upload.is_reprocessable === true &&
    upload.status !== 'processing'
  );
}

export async function getReprocessingHistory(uploadId: string, organizationId: string) {
  const { data: upload, error } = await supabase
    .from('uploads')
    .select('reprocessed_count, reprocessed_at, reprocessing_results')
    .eq('id', uploadId)
    .eq('organization_id', organizationId)
    .single();

  if (error || !upload) {
    return null;
  }

  return {
    count: upload.reprocessed_count || 0,
    lastReprocessedAt: upload.reprocessed_at,
    results: upload.reprocessing_results,
  };
}

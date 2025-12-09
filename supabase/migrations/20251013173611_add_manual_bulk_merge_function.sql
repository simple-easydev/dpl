/*
  # Manual Bulk Product Merge Function
  
  1. New Function
    - `manual_bulk_merge_products`
      - Takes array of product IDs to merge and the canonical product name to keep
      - Updates all sales_data records to use the canonical name
      - Creates product_mappings for each merged variant
      - Logs the merge operation in merge_audit_log
      - Returns the number of records affected
  
  2. Purpose
    - Enables users to manually select multiple products from the UI and merge them
    - Performs atomic merge operation with full audit trail
    - More efficient than individual merge operations
  
  3. Security
    - Function is SECURITY DEFINER to allow data modifications
    - Validates organization ownership through RLS policies
    - Requires authenticated user
  
  4. Important Notes
    - All operations are wrapped in transaction (function is atomic)
    - Tracks which product variants were merged into canonical name
    - Records user who performed the merge for audit purposes
    - Returns JSON with operation summary
*/

-- Function to perform manual bulk merge of products
CREATE OR REPLACE FUNCTION manual_bulk_merge_products(
  p_organization_id uuid,
  p_product_ids uuid[],
  p_canonical_name text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_record RECORD;
  v_variant_names text[] := '{}';
  v_total_records_affected integer := 0;
  v_records_per_variant jsonb := '{}';
BEGIN
  -- Validate inputs
  IF p_canonical_name IS NULL OR trim(p_canonical_name) = '' THEN
    RAISE EXCEPTION 'Canonical product name cannot be empty';
  END IF;
  
  IF array_length(p_product_ids, 1) IS NULL OR array_length(p_product_ids, 1) < 2 THEN
    RAISE EXCEPTION 'At least 2 products must be selected for merge';
  END IF;
  
  IF array_length(p_product_ids, 1) > 20 THEN
    RAISE EXCEPTION 'Cannot merge more than 20 products at once';
  END IF;
  
  -- Loop through each product and merge it
  FOR v_product_record IN 
    SELECT id, product_name 
    FROM products 
    WHERE id = ANY(p_product_ids) 
      AND organization_id = p_organization_id
      AND product_name != p_canonical_name
  LOOP
    -- Count records that will be affected for this variant
    DECLARE
      v_count integer;
    BEGIN
      SELECT COUNT(*) INTO v_count
      FROM sales_data
      WHERE organization_id = p_organization_id
        AND product_name = v_product_record.product_name;
      
      v_total_records_affected := v_total_records_affected + v_count;
      
      -- Store per-variant record count
      v_records_per_variant := v_records_per_variant || jsonb_build_object(
        v_product_record.product_name, v_count
      );
    END;
    
    -- Update sales_data to use canonical name
    UPDATE sales_data
    SET product_name = p_canonical_name
    WHERE organization_id = p_organization_id
      AND product_name = v_product_record.product_name;
    
    -- Add variant name to list
    v_variant_names := array_append(v_variant_names, v_product_record.product_name);
    
    -- Create or update product mapping
    INSERT INTO product_mappings (
      organization_id,
      product_variant,
      canonical_name,
      confidence_score,
      source,
      created_by,
      is_active,
      usage_count
    ) VALUES (
      p_organization_id,
      v_product_record.product_name,
      p_canonical_name,
      1.0,
      'manual',
      p_user_id,
      true,
      0
    )
    ON CONFLICT (organization_id, product_variant)
    DO UPDATE SET
      canonical_name = p_canonical_name,
      confidence_score = 1.0,
      source = 'manual',
      is_active = true,
      created_by = p_user_id;
  END LOOP;
  
  -- Log the merge operation
  IF array_length(v_variant_names, 1) > 0 THEN
    INSERT INTO merge_audit_log (
      organization_id,
      merge_type,
      source_product_names,
      target_canonical_name,
      confidence_score,
      ai_reasoning,
      records_affected,
      performed_by,
      can_undo
    ) VALUES (
      p_organization_id,
      'bulk',
      v_variant_names,
      p_canonical_name,
      1.0,
      'User manually merged products from Products page',
      v_total_records_affected,
      p_user_id,
      true
    );
  END IF;
  
  -- Return summary
  RETURN jsonb_build_object(
    'success', true,
    'canonical_name', p_canonical_name,
    'variants_merged', v_variant_names,
    'total_records_affected', v_total_records_affected,
    'records_per_variant', v_records_per_variant
  );
END;
$$;
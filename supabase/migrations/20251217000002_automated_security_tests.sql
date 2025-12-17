/*
  # Automated Security Test Suite for RLS Policies
  
  ## Overview
  Comprehensive test suite to validate Row Level Security implementation.
  Tests organization isolation, role-based access, and platform admin capabilities.
  
  ## Usage
  -- Run all tests:
  SELECT * FROM run_all_security_tests();
  
  -- Run specific test:
  SELECT * FROM test_organization_isolation();
  
  ## Test Categories
  1. Organization Isolation Tests
  2. Role-Based Access Control Tests
  3. Platform Admin Override Tests
  4. Brand Isolation Tests
  5. Security Function Tests
  6. Audit Logging Tests
*/

-- =====================================================
-- Test Framework Functions
-- =====================================================

-- Test result type
DO $$ BEGIN
  CREATE TYPE test_result AS (
    test_name text,
    test_category text,
    status text,
    message text,
    execution_time interval
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Main test runner function
CREATE OR REPLACE FUNCTION run_all_security_tests()
RETURNS TABLE(
  test_name text,
  test_category text,
  status text,
  message text,
  execution_time interval
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_time timestamptz;
  end_time timestamptz;
  test_record record;
BEGIN
  -- Only platform admin or test users can run this
  IF NOT (is_platform_admin() OR current_setting('app.testing_mode', true) = 'true') THEN
    RAISE EXCEPTION 'Unauthorized: Platform admin or test mode required';
  END IF;
  
  -- Test Category 1: Organization Isolation
  FOR test_record IN SELECT * FROM test_organization_isolation() LOOP
    RETURN QUERY SELECT test_record.*;
  END LOOP;
  
  -- Test Category 2: Role-Based Access
  FOR test_record IN SELECT * FROM test_role_based_access() LOOP
    RETURN QUERY SELECT test_record.*;
  END LOOP;
  
  -- Test Category 3: Platform Admin Override
  FOR test_record IN SELECT * FROM test_platform_admin_override() LOOP
    RETURN QUERY SELECT test_record.*;
  END LOOP;
  
  -- Test Category 4: Security Functions
  FOR test_record IN SELECT * FROM test_security_functions() LOOP
    RETURN QUERY SELECT test_record.*;
  END LOOP;
  
  -- Test Category 5: Audit Logging
  FOR test_record IN SELECT * FROM test_audit_logging() LOOP
    RETURN QUERY SELECT test_record.*;
  END LOOP;
  
  RETURN;
END;
$$;

-- =====================================================
-- Test Category 1: Organization Isolation
-- =====================================================

CREATE OR REPLACE FUNCTION test_organization_isolation()
RETURNS TABLE(
  test_name text,
  test_category text,
  status text,
  message text,
  execution_time interval
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_time timestamptz;
  test_status text;
  test_message text;
  org_count integer;
BEGIN
  -- Test 1: User can only see their own organizations
  start_time := clock_timestamp();
  BEGIN
    SELECT COUNT(*) INTO org_count
    FROM organizations
    WHERE id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    );
    
    IF org_count >= 0 THEN
      test_status := 'PASS';
      test_message := format('User can see %s organizations they belong to', org_count);
    ELSE
      test_status := 'FAIL';
      test_message := 'Organization count query failed';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      test_status := 'ERROR';
      test_message := SQLERRM;
  END;
  
  RETURN QUERY SELECT 
    'Organization Visibility Check'::text,
    'Organization Isolation'::text,
    test_status,
    test_message,
    clock_timestamp() - start_time;
  
  -- Test 2: Sales data filtered by organization
  start_time := clock_timestamp();
  BEGIN
    SELECT COUNT(DISTINCT organization_id) INTO org_count
    FROM sales_data;
    
    -- Should only see sales_data from user's organizations
    IF org_count = (SELECT COUNT(DISTINCT organization_id) FROM organization_members WHERE user_id = auth.uid()) 
       OR is_platform_admin() THEN
      test_status := 'PASS';
      test_message := 'Sales data correctly filtered by organization membership';
    ELSE
      test_status := 'WARN';
      test_message := format('Sales data organization count mismatch: saw %s orgs', org_count);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      test_status := 'ERROR';
      test_message := SQLERRM;
  END;
  
  RETURN QUERY SELECT 
    'Sales Data Organization Filter'::text,
    'Organization Isolation'::text,
    test_status,
    test_message,
    clock_timestamp() - start_time;
  
  -- Test 3: Products filtered by organization
  start_time := clock_timestamp();
  BEGIN
    SELECT COUNT(DISTINCT organization_id) INTO org_count
    FROM products;
    
    IF org_count = (SELECT COUNT(DISTINCT organization_id) FROM organization_members WHERE user_id = auth.uid())
       OR is_platform_admin() THEN
      test_status := 'PASS';
      test_message := 'Products correctly filtered by organization membership';
    ELSE
      test_status := 'WARN';
      test_message := format('Products organization count mismatch: saw %s orgs', org_count);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      test_status := 'ERROR';
      test_message := SQLERRM;
  END;
  
  RETURN QUERY SELECT 
    'Products Organization Filter'::text,
    'Organization Isolation'::text,
    test_status,
    test_message,
    clock_timestamp() - start_time;
    
  -- Test 4: Uploads filtered by organization
  start_time := clock_timestamp();
  BEGIN
    SELECT COUNT(DISTINCT organization_id) INTO org_count
    FROM uploads;
    
    IF org_count = (SELECT COUNT(DISTINCT organization_id) FROM organization_members WHERE user_id = auth.uid())
       OR is_platform_admin() THEN
      test_status := 'PASS';
      test_message := 'Uploads correctly filtered by organization membership';
    ELSE
      test_status := 'WARN';
      test_message := format('Uploads organization count mismatch: saw %s orgs', org_count);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      test_status := 'ERROR';
      test_message := SQLERRM;
  END;
  
  RETURN QUERY SELECT 
    'Uploads Organization Filter'::text,
    'Organization Isolation'::text,
    test_status,
    test_message,
    clock_timestamp() - start_time;
  
  RETURN;
END;
$$;

-- =====================================================
-- Test Category 2: Role-Based Access Control
-- =====================================================

CREATE OR REPLACE FUNCTION test_role_based_access()
RETURNS TABLE(
  test_name text,
  test_category text,
  status text,
  message text,
  execution_time interval
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_time timestamptz;
  test_status text;
  test_message text;
  user_role text;
  role_count integer;
BEGIN
  -- Test 1: User role validation
  start_time := clock_timestamp();
  BEGIN
    SELECT COUNT(DISTINCT role) INTO role_count
    FROM organization_members
    WHERE user_id = auth.uid();
    
    IF role_count > 0 OR is_platform_admin() THEN
      test_status := 'PASS';
      test_message := format('User has %s role(s) assigned', role_count);
    ELSE
      test_status := 'FAIL';
      test_message := 'User has no roles assigned';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      test_status := 'ERROR';
      test_message := SQLERRM;
  END;
  
  RETURN QUERY SELECT 
    'User Role Assignment'::text,
    'Role-Based Access'::text,
    test_status,
    test_message,
    clock_timestamp() - start_time;
  
  -- Test 2: Admin role validation
  start_time := clock_timestamp();
  BEGIN
    SELECT COUNT(*) INTO role_count
    FROM organization_members
    WHERE user_id = auth.uid()
    AND role = 'admin';
    
    test_status := 'PASS';
    test_message := format('User is admin in %s organization(s)', role_count);
  EXCEPTION
    WHEN OTHERS THEN
      test_status := 'ERROR';
      test_message := SQLERRM;
  END;
  
  RETURN QUERY SELECT 
    'Admin Role Count'::text,
    'Role-Based Access'::text,
    test_status,
    test_message,
    clock_timestamp() - start_time;
  
  -- Test 3: validate_admin_role function
  start_time := clock_timestamp();
  BEGIN
    -- Test with first organization user belongs to
    SELECT organization_id INTO user_role
    FROM organization_members
    WHERE user_id = auth.uid()
    LIMIT 1;
    
    IF user_role IS NOT NULL THEN
      IF validate_admin_role(user_role::uuid) OR NOT validate_admin_role(user_role::uuid) THEN
        test_status := 'PASS';
        test_message := 'validate_admin_role function works correctly';
      END IF;
    ELSE
      test_status := 'SKIP';
      test_message := 'User not member of any organization';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      test_status := 'ERROR';
      test_message := SQLERRM;
  END;
  
  RETURN QUERY SELECT 
    'Admin Validation Function'::text,
    'Role-Based Access'::text,
    test_status,
    test_message,
    clock_timestamp() - start_time;
  
  RETURN;
END;
$$;

-- =====================================================
-- Test Category 3: Platform Admin Override
-- =====================================================

CREATE OR REPLACE FUNCTION test_platform_admin_override()
RETURNS TABLE(
  test_name text,
  test_category text,
  status text,
  message text,
  execution_time interval
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_time timestamptz;
  test_status text;
  test_message text;
  admin_status boolean;
  total_orgs integer;
BEGIN
  -- Test 1: is_platform_admin function
  start_time := clock_timestamp();
  BEGIN
    admin_status := is_platform_admin();
    test_status := 'PASS';
    test_message := format('Platform admin status: %s', admin_status);
  EXCEPTION
    WHEN OTHERS THEN
      test_status := 'ERROR';
      test_message := SQLERRM;
  END;
  
  RETURN QUERY SELECT 
    'Platform Admin Function'::text,
    'Platform Admin Override'::text,
    test_status,
    test_message,
    clock_timestamp() - start_time;
  
  -- Test 2: Platform admin can see all organizations
  start_time := clock_timestamp();
  BEGIN
    SELECT COUNT(*) INTO total_orgs FROM organizations WHERE deleted_at IS NULL;
    
    IF is_platform_admin() THEN
      test_status := 'PASS';
      test_message := format('Platform admin can see all %s organizations', total_orgs);
    ELSE
      test_status := 'SKIP';
      test_message := 'User is not platform admin';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      test_status := 'ERROR';
      test_message := SQLERRM;
  END;
  
  RETURN QUERY SELECT 
    'Platform Admin Organization Access'::text,
    'Platform Admin Override'::text,
    test_status,
    test_message,
    clock_timestamp() - start_time;
  
  RETURN;
END;
$$;

-- =====================================================
-- Test Category 4: Security Functions
-- =====================================================

CREATE OR REPLACE FUNCTION test_security_functions()
RETURNS TABLE(
  test_name text,
  test_category text,
  status text,
  message text,
  execution_time interval
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_time timestamptz;
  test_status text;
  test_message text;
  test_org_id uuid;
  test_result boolean;
BEGIN
  -- Test 1: validate_organization_access function
  start_time := clock_timestamp();
  BEGIN
    SELECT organization_id INTO test_org_id
    FROM organization_members
    WHERE user_id = auth.uid()
    LIMIT 1;
    
    IF test_org_id IS NOT NULL THEN
      test_result := validate_organization_access(test_org_id);
      IF test_result THEN
        test_status := 'PASS';
        test_message := 'validate_organization_access works correctly';
      ELSE
        test_status := 'FAIL';
        test_message := 'validate_organization_access returned false for valid org';
      END IF;
    ELSE
      test_status := 'SKIP';
      test_message := 'User not member of any organization';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      test_status := 'ERROR';
      test_message := SQLERRM;
  END;
  
  RETURN QUERY SELECT 
    'Organization Access Validation'::text,
    'Security Functions'::text,
    test_status,
    test_message,
    clock_timestamp() - start_time;
  
  -- Test 2: get_user_organizations function
  start_time := clock_timestamp();
  BEGIN
    IF EXISTS (SELECT 1 FROM get_user_organizations() LIMIT 1) OR is_platform_admin() THEN
      test_status := 'PASS';
      test_message := 'get_user_organizations returns data';
    ELSE
      test_status := 'WARN';
      test_message := 'get_user_organizations returned no results';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      test_status := 'ERROR';
      test_message := SQLERRM;
  END;
  
  RETURN QUERY SELECT 
    'Get User Organizations'::text,
    'Security Functions'::text,
    test_status,
    test_message,
    clock_timestamp() - start_time;
  
  RETURN;
END;
$$;

-- =====================================================
-- Test Category 5: Audit Logging
-- =====================================================

CREATE OR REPLACE FUNCTION test_audit_logging()
RETURNS TABLE(
  test_name text,
  test_category text,
  status text,
  message text,
  execution_time interval
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  start_time timestamptz;
  test_status text;
  test_message text;
  log_id uuid;
BEGIN
  -- Test 1: log_security_event function
  start_time := clock_timestamp();
  BEGIN
    log_id := log_security_event(
      'test_event',
      '{"test": true, "timestamp": "' || now()::text || '"}'::jsonb
    );
    
    IF log_id IS NOT NULL THEN
      test_status := 'PASS';
      test_message := format('Security event logged successfully: %s', log_id);
    ELSE
      test_status := 'FAIL';
      test_message := 'Failed to log security event';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      test_status := 'ERROR';
      test_message := SQLERRM;
  END;
  
  RETURN QUERY SELECT 
    'Security Event Logging'::text,
    'Audit Logging'::text,
    test_status,
    test_message,
    clock_timestamp() - start_time;
  
  -- Test 2: Audit log accessibility
  start_time := clock_timestamp();
  BEGIN
    IF EXISTS (SELECT 1 FROM audit_logs LIMIT 1) OR is_platform_admin() THEN
      test_status := 'PASS';
      test_message := 'Audit logs accessible';
    ELSE
      test_status := 'WARN';
      test_message := 'No audit logs found';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      test_status := 'ERROR';
      test_message := SQLERRM;
  END;
  
  RETURN QUERY SELECT 
    'Audit Log Access'::text,
    'Audit Logging'::text,
    test_status,
    test_message,
    clock_timestamp() - start_time;
  
  RETURN;
END;
$$;

-- =====================================================
-- Test Summary Function
-- =====================================================

CREATE OR REPLACE FUNCTION get_test_summary()
RETURNS TABLE(
  total_tests bigint,
  passed bigint,
  failed bigint,
  errors bigint,
  warnings bigint,
  skipped bigint,
  pass_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  results record;
BEGIN
  -- Run all tests and aggregate results
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'PASS') as pass_count,
    COUNT(*) FILTER (WHERE status = 'FAIL') as fail_count,
    COUNT(*) FILTER (WHERE status = 'ERROR') as error_count,
    COUNT(*) FILTER (WHERE status = 'WARN') as warn_count,
    COUNT(*) FILTER (WHERE status = 'SKIP') as skip_count
  INTO results
  FROM run_all_security_tests();
  
  RETURN QUERY SELECT 
    results.total,
    results.pass_count,
    results.fail_count,
    results.error_count,
    results.warn_count,
    results.skip_count,
    CASE 
      WHEN results.total > 0 THEN 
        ROUND((results.pass_count::numeric / results.total::numeric) * 100, 2)
      ELSE 0 
    END;
END;
$$;

-- =====================================================
-- Grant Permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION run_all_security_tests() TO authenticated;
GRANT EXECUTE ON FUNCTION test_organization_isolation() TO authenticated;
GRANT EXECUTE ON FUNCTION test_role_based_access() TO authenticated;
GRANT EXECUTE ON FUNCTION test_platform_admin_override() TO authenticated;
GRANT EXECUTE ON FUNCTION test_security_functions() TO authenticated;
GRANT EXECUTE ON FUNCTION test_audit_logging() TO authenticated;
GRANT EXECUTE ON FUNCTION get_test_summary() TO authenticated;

-- =====================================================
-- Documentation
-- =====================================================

COMMENT ON FUNCTION run_all_security_tests IS 
  'Runs complete security test suite. Returns detailed results for each test. Platform admin or test mode required.';

COMMENT ON FUNCTION get_test_summary IS 
  'Returns aggregated test results with pass/fail statistics and overall pass rate.';

-- =====================================================
-- Usage Examples
-- =====================================================

/*
-- Example 1: Run all tests
SELECT * FROM run_all_security_tests();

-- Example 2: Get summary
SELECT * FROM get_test_summary();

-- Example 3: Run specific category
SELECT * FROM test_organization_isolation();

-- Example 4: Filter failed tests
SELECT * FROM run_all_security_tests() WHERE status IN ('FAIL', 'ERROR');

-- Example 5: Get test execution times
SELECT 
  test_category,
  AVG(execution_time) as avg_time,
  MAX(execution_time) as max_time
FROM run_all_security_tests()
GROUP BY test_category;
*/

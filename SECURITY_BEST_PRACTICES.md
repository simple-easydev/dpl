# Security Best Practices for Developers

**Platform:** Multi-Tenant Sales Analytics Platform  
**Last Updated:** December 17, 2025  
**Audience:** Developers, DBAs, Security Engineers

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Row Level Security (RLS) Guidelines](#row-level-security-rls-guidelines)
4. [Writing Secure Queries](#writing-secure-queries)
5. [API Development](#api-development)
6. [Frontend Security](#frontend-security)
7. [Database Functions](#database-functions)
8. [Testing & Validation](#testing--validation)
9. [Common Vulnerabilities](#common-vulnerabilities)
10. [Incident Response](#incident-response)

---

## Overview

This platform implements a **defense-in-depth** security model with multiple layers:

```
┌─────────────────────────────────────────┐
│    Frontend (React + TypeScript)        │  ← Input Validation
├─────────────────────────────────────────┤
│    API Layer (Supabase Client)          │  ← Authentication Check
├─────────────────────────────────────────┤
│    Database RLS Policies                │  ← Authorization Enforcement
├─────────────────────────────────────────┤
│    PostgreSQL Database                  │  ← Data Storage
└─────────────────────────────────────────┘
```

**Key Principle:** Never trust the client. All security must be enforced at the database level.

---

## Authentication & Authorization

### User Authentication

**✅ DO:**
```typescript
// Always check if user is authenticated before operations
const { data: { user }, error } = await supabase.auth.getUser();
if (!user) {
  throw new Error('Not authenticated');
}

// Use Supabase Auth for all authentication
const { data, error } = await supabase.auth.signInWithPassword({
  email: email,
  password: password,
});
```

**❌ DON'T:**
```typescript
// Never implement custom authentication
// Never store passwords in plain text
// Never bypass Supabase Auth
```

### Authorization Checks

**✅ DO:**
```typescript
// Check organization membership before accessing data
const { data: membership } = await supabase
  .from('organization_members')
  .select('role')
  .eq('organization_id', orgId)
  .eq('user_id', user.id)
  .single();

if (!membership) {
  throw new Error('Not authorized');
}

// Check role for sensitive operations
if (membership.role !== 'admin') {
  throw new Error('Admin access required');
}
```

**❌ DON'T:**
```typescript
// Never skip authorization checks
// Never rely only on frontend checks
// Never trust user-provided organization IDs without validation
```

---

## Row Level Security (RLS) Guidelines

### Understanding RLS

RLS policies are PostgreSQL rules that automatically filter queries based on the current user.

**How it works:**
```sql
-- When a user queries:
SELECT * FROM sales_data;

-- PostgreSQL automatically adds WHERE clause based on RLS:
SELECT * FROM sales_data
WHERE organization_id IN (
  SELECT organization_id FROM organization_members 
  WHERE user_id = auth.uid()
);
```

### Writing RLS Policies

**✅ DO:**
```sql
-- Always use EXISTS for membership checks (better performance)
CREATE POLICY "Users can view sales data"
  ON sales_data FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = sales_data.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
    OR is_platform_admin()
  );

-- Use role checks for write operations
CREATE POLICY "Admins can update data"
  ON sales_data FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = sales_data.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
      AND organization_members.role = 'admin'
    )
  );
```

**❌ DON'T:**
```sql
-- Never use IN subqueries (causes recursion issues)
CREATE POLICY "Bad policy"
  ON sales_data FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Never omit platform admin override
-- Never use auth.uid() directly without SELECT wrapper
```

### Policy Performance Optimization

**✅ Best Practices:**

1. **Use `(SELECT auth.uid())` not `auth.uid()`**
   ```sql
   -- Good: Evaluates once per query
   WHERE user_id = (SELECT auth.uid())
   
   -- Bad: Re-evaluates for each row
   WHERE user_id = auth.uid()
   ```

2. **Use EXISTS instead of IN**
   ```sql
   -- Good: Stops at first match
   WHERE EXISTS (SELECT 1 FROM ...)
   
   -- Bad: Builds full result set
   WHERE organization_id IN (SELECT ...)
   ```

3. **Index foreign keys used in policies**
   ```sql
   CREATE INDEX idx_sales_org ON sales_data(organization_id);
   CREATE INDEX idx_members_user ON organization_members(user_id);
   ```

---

## Writing Secure Queries

### Query Patterns

**✅ Safe Query Pattern:**
```typescript
// Always let RLS handle filtering
const { data, error } = await supabase
  .from('sales_data')
  .select('*')
  .eq('organization_id', orgId); // Additional filter is OK

// RLS automatically ensures user can only see their org's data
```

**⚠️ Dangerous Patterns:**
```typescript
// Never use rpc() to bypass RLS without proper checks
const { data } = await supabase.rpc('unsafe_function', {
  org_id: orgId  // Could be manipulated by user
});

// Never trust client-side filtering
const allData = await supabase.from('sales_data').select('*');
const filtered = allData.filter(row => row.organization_id === myOrg);
// ^ RLS already filtered, but this pattern suggests trust in client
```

### Input Validation

**✅ DO:**
```typescript
// Validate all user inputs
function validateOrganizationId(id: string): boolean {
  // UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// Sanitize string inputs
function sanitizeInput(input: string): string {
  return input.trim().substring(0, 1000); // Length limit
}

// Type validation
interface CreateSaleData {
  order_date: string; // ISO date
  account_name: string;
  product_name: string;
  revenue: number;
  quantity: number;
}

function validateSaleData(data: unknown): data is CreateSaleData {
  // Implement runtime type checking
  return typeof data === 'object' && data !== null;
  // ... detailed validation
}
```

**❌ DON'T:**
```typescript
// Never trust user input without validation
const { data } = await supabase
  .from('sales_data')
  .insert({
    ...userProvidedData  // Dangerous!
  });

// Never concatenate SQL strings (Supabase prevents this, but still)
// Never allow unrestricted JSONB queries
```

---

## API Development

### Supabase Edge Functions

**✅ Secure Edge Function Pattern:**
```typescript
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  // 1. Verify authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Create authenticated client
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: { Authorization: authHeader }
      }
    }
  );

  // 3. Verify user
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 4. Validate input
  const body = await req.json();
  if (!validateInput(body)) {
    return new Response('Bad Request', { status: 400 });
  }

  // 5. Perform operation (RLS enforced automatically)
  const { data, error: dbError } = await supabaseClient
    .from('sales_data')
    .insert(body);

  // 6. Handle errors securely
  if (dbError) {
    console.error('Database error:', dbError);
    return new Response('Internal Server Error', { status: 500 });
    // Never expose internal error details to client
  }

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

### Service Role Key Usage

**⚠️ CRITICAL:** Service role key bypasses RLS!

**✅ Safe Usage:**
```typescript
// Only use service role for admin operations with explicit checks
const supabaseAdmin = createClient(
  supabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY  // Dangerous!
);

// MUST manually verify permissions
const isPlatformAdmin = await verifyPlatformAdmin(userId);
if (!isPlatformAdmin) {
  throw new Error('Unauthorized');
}

// Now safe to perform admin operation
await supabaseAdmin.from('organizations').select('*');
```

**❌ NEVER:**
```typescript
// Never expose service role key to frontend
// Never use service role for regular operations
// Never trust client-provided user IDs with service role
```

---

## Frontend Security

### React Component Best Practices

**✅ Secure Component Pattern:**
```tsx
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

export function SecureComponent() {
  const { user } = useAuth();
  const { currentOrganization, userRole } = useOrganization();

  // 1. Check authentication
  if (!user) {
    return <Navigate to="/login" />;
  }

  // 2. Check organization membership
  if (!currentOrganization) {
    return <div>No organization selected</div>;
  }

  // 3. Check role for sensitive features
  const canEdit = userRole === 'admin' || userRole === 'member';
  const canDelete = userRole === 'admin';

  return (
    <div>
      <DataView organizationId={currentOrganization.id} />
      {canEdit && <EditButton />}
      {canDelete && <DeleteButton />}
    </div>
  );
}
```

### State Management

**✅ DO:**
```typescript
// Store only non-sensitive data in state
const [organizations, setOrganizations] = useState<Organization[]>([]);

// Re-fetch data after role changes
useEffect(() => {
  if (userRoleChanged) {
    refetchData();
  }
}, [userRoleChanged]);

// Validate data received from server
function validateOrganization(org: unknown): org is Organization {
  return typeof org === 'object' && 
         org !== null && 
         'id' in org && 
         'name' in org;
}
```

**❌ DON'T:**
```typescript
// Never store sensitive data in localStorage
localStorage.setItem('admin_key', key); // Bad!

// Never store unvalidated server data in state
setState(serverData); // Validate first!

// Never assume client-side checks are enough
if (user.isAdmin) { // Backend must also check!
  performAction();
}
```

---

## Database Functions

### Writing Secure Functions

**✅ Secure Function Template:**
```sql
CREATE OR REPLACE FUNCTION secure_function(
  param1 uuid,
  param2 text
)
RETURNS TABLE(result_column text)
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with function owner's privileges
STABLE  -- Or VOLATILE if modifying data
SET search_path = public  -- Prevents search path attacks
AS $$
DECLARE
  current_user_id uuid;
  has_access boolean;
BEGIN
  -- 1. Get current user
  current_user_id := auth.uid();
  
  -- 2. Validate authentication
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- 3. Validate input
  IF param1 IS NULL OR param2 IS NULL THEN
    RAISE EXCEPTION 'Invalid parameters';
  END IF;
  
  -- 4. Check authorization
  has_access := EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = current_user_id
    AND organization_id = param1
  );
  
  IF NOT has_access AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized access';
  END IF;
  
  -- 5. Perform operation
  RETURN QUERY
  SELECT some_column
  FROM some_table
  WHERE organization_id = param1
  AND condition = param2;
  
  -- 6. Log if needed
  PERFORM log_security_event('function_called', jsonb_build_object(
    'function', 'secure_function',
    'param1', param1
  ));
END;
$$;

-- 7. Grant appropriate permissions
GRANT EXECUTE ON FUNCTION secure_function(uuid, text) TO authenticated;

-- 8. Document the function
COMMENT ON FUNCTION secure_function IS 
  'Securely performs X operation. Requires organization membership.';
```

**❌ Insecure Patterns:**
```sql
-- Never omit SECURITY DEFINER
CREATE FUNCTION insecure() -- Bad: uses invoker's privileges

-- Never omit SET search_path
SECURITY DEFINER -- Bad: vulnerable to search path attacks

-- Never skip authorization checks
CREATE FUNCTION bypass_security(org_id uuid)
RETURNS TABLE(data text)
SECURITY DEFINER
AS $$
BEGIN
  -- Bad: No access check!
  RETURN QUERY SELECT * FROM sensitive_table;
END;
$$;
```

---

## Testing & Validation

### Security Testing Checklist

**Before Every Deployment:**

- [ ] Run automated security tests: `SELECT * FROM run_all_security_tests();`
- [ ] Verify all new tables have RLS enabled
- [ ] Verify all new tables have policies for SELECT, INSERT, UPDATE, DELETE
- [ ] Test with different user roles (admin, member, viewer)
- [ ] Test cross-organization access attempts (should fail)
- [ ] Review audit logs for suspicious patterns
- [ ] Check for SQL injection vulnerabilities
- [ ] Verify API authentication on all endpoints
- [ ] Test with expired/invalid tokens

### Manual Testing Procedure

**1. Test Organization Isolation:**
```sql
-- As User A (member of Org 1)
SELECT * FROM sales_data WHERE organization_id = 'org-2-id';
-- Expected: 0 rows (blocked by RLS)

-- As User B (member of Org 2)
SELECT * FROM sales_data;
-- Expected: Only Org 2's data
```

**2. Test Role Enforcement:**
```sql
-- As Viewer
INSERT INTO sales_data (organization_id, ...) VALUES (...);
-- Expected: Permission denied

-- As Admin
UPDATE products SET brand = 'New Brand' WHERE id = '...';
-- Expected: Success
```

**3. Test Platform Admin:**
```sql
-- As Platform Admin
SELECT COUNT(DISTINCT organization_id) FROM sales_data;
-- Expected: All organizations

-- As Regular User
-- Expected: Only their organization(s)
```

### Automated Testing

**Integration Tests:**
```typescript
describe('Security Tests', () => {
  it('should prevent cross-organization access', async () => {
    // Login as user from Org A
    const { data: orgAData } = await supabase
      .from('sales_data')
      .select('*')
      .eq('organization_id', orgBId);
    
    // Should be empty due to RLS
    expect(orgAData).toEqual([]);
  });

  it('should enforce role-based permissions', async () => {
    // Login as viewer
    const { error } = await supabase
      .from('sales_data')
      .insert({ /* data */ });
    
    // Should fail
    expect(error).toBeDefined();
    expect(error?.code).toBe('42501'); // Insufficient privilege
  });
});
```

---

## Common Vulnerabilities

### 1. SQL Injection

**❌ Vulnerable:**
```typescript
// Supabase prevents this, but for reference:
const query = `SELECT * FROM users WHERE name = '${userName}'`;
```

**✅ Protected:**
```typescript
// Supabase uses parameterized queries automatically
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('name', userName); // Safe
```

### 2. Broken Access Control

**❌ Vulnerable:**
```typescript
// Trusting client-provided organization ID
async function getData(orgId: string) {
  // No verification that user belongs to orgId!
  return await supabase
    .from('sales_data')
    .select('*')
    .eq('organization_id', orgId);
}
```

**✅ Protected:**
```typescript
// RLS handles this automatically
async function getData(orgId: string) {
  // Even if user provides wrong orgId, RLS filters to their orgs
  const { data } = await supabase
    .from('sales_data')
    .select('*')
    .eq('organization_id', orgId);
  
  // If orgId doesn't match user's orgs, returns empty array
  return data;
}
```

### 3. Sensitive Data Exposure

**❌ Vulnerable:**
```typescript
// Exposing internal error details
catch (error) {
  return res.status(500).json({ error: error.message });
  // ^ Might expose SQL errors, table names, etc.
}
```

**✅ Protected:**
```typescript
catch (error) {
  console.error('Internal error:', error); // Log internally
  return res.status(500).json({ 
    error: 'An error occurred' // Generic message
  });
}
```

### 4. Missing Authentication

**❌ Vulnerable:**
```typescript
// No auth check
export default async function handler(req: Request) {
  const data = await supabase.from('sales_data').select('*');
  return Response.json(data);
}
```

**✅ Protected:**
```typescript
export default async function handler(req: Request) {
  // Verify authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Proceed with authenticated client
  // ...
}
```

---

## Incident Response

### Security Incident Checklist

**If you suspect a security breach:**

1. **Immediate Actions:**
   - [ ] Notify security team/platform admin
   - [ ] Document what you observed
   - [ ] DO NOT attempt to fix without coordination
   - [ ] Preserve logs and evidence

2. **Investigation:**
   ```sql
   -- Check audit logs
   SELECT * FROM audit_logs 
   WHERE created_at > '2024-XX-XX'
   ORDER BY created_at DESC;
   
   -- Check for suspicious access patterns
   SELECT * FROM detect_suspicious_activity(24);
   
   -- Review recent policy changes
   SELECT * FROM pg_policies 
   WHERE schemaname = 'public'
   ORDER BY policyname;
   ```

3. **Containment:**
   - [ ] Revoke compromised credentials
   - [ ] Force logout affected users
   - [ ] Temporarily disable affected features if needed
   - [ ] Block suspicious IP addresses

4. **Recovery:**
   - [ ] Apply security patches
   - [ ] Update affected policies
   - [ ] Run security test suite
   - [ ] Verify data integrity

5. **Post-Incident:**
   - [ ] Document incident details
   - [ ] Update security procedures
   - [ ] Team security training
   - [ ] Implement additional monitoring

### Emergency Contacts

```
Security Team: security@company.com
Platform Admin: admin@company.com
Supabase Support: https://supabase.com/support
```

---

## Quick Reference

### Security Checklist for New Features

- [ ] Authentication required? ✅
- [ ] Authorization checked? ✅
- [ ] RLS policies created? ✅
- [ ] Input validated? ✅
- [ ] Errors handled securely? ✅
- [ ] Audit logging added? ✅
- [ ] Security tests written? ✅
- [ ] Code review completed? ✅
- [ ] Documentation updated? ✅

### Common Commands

```sql
-- Check if RLS is enabled on table
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'your_table';

-- List all policies for a table
SELECT * FROM pg_policies WHERE tablename = 'your_table';

-- Run security tests
SELECT * FROM run_all_security_tests();

-- Check audit logs
SELECT * FROM security_events ORDER BY created_at DESC LIMIT 100;

-- Verify user's organizations
SELECT * FROM get_user_organizations();
```

---

## Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/sql-security.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Platform Security Audit Report](./SECURITY_AUDIT_REPORT.md)

---

**Last Updated:** December 17, 2025  
**Maintained By:** Security Team  
**Review Frequency:** Quarterly

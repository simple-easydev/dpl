import { useState } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { supabase } from '../lib/supabase';
import { Activity, CheckCircle, XCircle, AlertTriangle, Mail, Server, Key, Globe, Database, Upload } from 'lucide-react';

interface DiagnosticResult {
  name: string;
  status: 'success' | 'error' | 'warning' | 'info';
  message: string;
  details?: string;
}

export default function DiagnosticPage() {
  const { currentOrganization } = useOrganization();
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [running, setRunning] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  const addResult = (result: DiagnosticResult) => {
    setResults(prev => [...prev, result]);
  };

  const runDiagnostics = async () => {
    setResults([]);
    setRunning(true);

    // Check current user and platform admin status
    addResult({
      name: 'Current User',
      status: 'info',
      message: 'Checking authentication status...',
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        addResult({
          name: 'Current User',
          status: 'success',
          message: `Logged in as: ${user.email}`,
          details: `User ID: ${user.id}`,
        });

        // Check platform admin status
        const { data: isPlatformAdmin, error: adminError } = await supabase.rpc('is_platform_admin');
        if (adminError) {
          addResult({
            name: 'Platform Admin Check',
            status: 'error',
            message: 'Failed to check platform admin status',
            details: adminError.message,
          });
        } else {
          addResult({
            name: 'Platform Admin Check',
            status: isPlatformAdmin ? 'success' : 'info',
            message: isPlatformAdmin ? 'You ARE a platform admin' : 'You are NOT a platform admin',
            details: isPlatformAdmin ? 'Full access to all organizations' : 'Access limited to your organizations only',
          });
        }

        // Try to fetch organizations
        const { data: orgs, error: orgsError } = await supabase
          .from('organizations')
          .select('id, name, deleted_at')
          .is('deleted_at', null);

        if (orgsError) {
          addResult({
            name: 'Organizations Query',
            status: 'error',
            message: 'Failed to query organizations',
            details: orgsError.message,
          });
        } else {
          addResult({
            name: 'Organizations Query',
            status: 'success',
            message: `Found ${orgs?.length || 0} active organizations`,
            details: orgs?.map(o => o.name).join(', ') || 'None',
          });
        }
      } else {
        addResult({
          name: 'Current User',
          status: 'warning',
          message: 'Not logged in',
        });
      }
    } catch (err) {
      addResult({
        name: 'Current User',
        status: 'error',
        message: 'Failed to get user info',
        details: String(err),
      });
    }

    addResult({
      name: 'Environment Variables',
      status: 'info',
      message: 'Checking environment configuration...',
    });

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      addResult({
        name: 'Environment Variables',
        status: 'error',
        message: 'Missing Supabase environment variables',
        details: 'VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set',
      });
    } else {
      addResult({
        name: 'Environment Variables',
        status: 'success',
        message: 'Environment variables configured',
        details: `URL: ${supabaseUrl.substring(0, 30)}...`,
      });
    }

    addResult({
      name: 'Supabase Connection',
      status: 'info',
      message: 'Testing Supabase connection...',
    });

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        addResult({
          name: 'Supabase Connection',
          status: 'error',
          message: 'Failed to connect to Supabase',
          details: error.message,
        });
      } else {
        addResult({
          name: 'Supabase Connection',
          status: 'success',
          message: 'Successfully connected to Supabase',
          details: data.session ? 'Active session found' : 'No active session (expected)',
        });
      }
    } catch (err) {
      addResult({
        name: 'Supabase Connection',
        status: 'error',
        message: 'Connection error',
        details: String(err),
      });
    }

    addResult({
      name: 'Auth Configuration',
      status: 'info',
      message: 'Checking authentication configuration...',
    });

    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const currentUrl = `${protocol}//${hostname}`;

    addResult({
      name: 'Current Environment',
      status: 'info',
      message: 'Environment details',
      details: `Hostname: ${hostname}, Protocol: ${protocol}, Full URL: ${currentUrl}`,
    });

    const expectedRedirectUrl = hostname === 'localhost'
      ? 'http://localhost:5173/reset-password'
      : 'https://dpl-rey8.bolt.host/reset-password';

    addResult({
      name: 'Redirect URL',
      status: 'info',
      message: 'Expected redirect URL',
      details: expectedRedirectUrl,
    });

    addResult({
      name: 'API Endpoints',
      status: 'info',
      message: 'Testing API endpoints...',
    });

    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
        method: 'GET',
      });

      if (response.ok) {
        addResult({
          name: 'Auth Health Check',
          status: 'success',
          message: 'Auth API is reachable',
          details: `Status: ${response.status}`,
        });
      } else {
        addResult({
          name: 'Auth Health Check',
          status: 'warning',
          message: 'Auth API returned non-OK status',
          details: `Status: ${response.status}`,
        });
      }
    } catch (err) {
      addResult({
        name: 'Auth Health Check',
        status: 'error',
        message: 'Failed to reach Auth API',
        details: String(err),
      });
    }

    setRunning(false);
  };

  const checkDuplicateData = async () => {
    setRunning(true);

    addResult({
      name: 'Duplicate Data Check',
      status: 'info',
      message: 'Scanning for duplicate records in sales data...',
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        addResult({
          name: 'Duplicate Data Check',
          status: 'error',
          message: 'Not logged in',
        });
        setRunning(false);
        return;
      }

      // Get user's organization
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        addResult({
          name: 'Duplicate Data Check',
          status: 'error',
          message: 'No organization found for current user',
        });
        setRunning(false);
        return;
      }

      // Fetch all sales data for the organization
      const { data: salesData, error } = await supabase
        .from('sales_data')
        .select('id, order_id, order_date, account_name, product_name, quantity, quantity_in_bottles, organization_id')
        .eq('organization_id', membership.organization_id);

      if (error) {
        addResult({
          name: 'Duplicate Data Check',
          status: 'error',
          message: 'Failed to fetch sales data',
          details: error.message,
        });
        setRunning(false);
        return;
      }

      // Detect duplicates
      const seenKeys = new Map<string, number>();
      let duplicateCount = 0;
      const duplicateGroups: { [key: string]: number } = {};

      salesData?.forEach(record => {
        let key: string;

        if (record.order_id) {
          key = `${record.organization_id}_${record.order_id}`;
        } else {
          key = `${record.organization_id}_${record.order_date}_${record.account_name}_${record.product_name}_${record.quantity}_${record.quantity_in_bottles || 0}`;
        }

        const count = seenKeys.get(key) || 0;
        seenKeys.set(key, count + 1);

        if (count > 0) {
          duplicateCount++;
          duplicateGroups[key] = (duplicateGroups[key] || 1) + 1;
        }
      });

      const uniqueDuplicateGroups = Object.keys(duplicateGroups).length;

      if (duplicateCount === 0) {
        addResult({
          name: 'Duplicate Data Check',
          status: 'success',
          message: 'No duplicate records found',
          details: `Scanned ${salesData?.length || 0} records - all unique`,
        });
      } else {
        addResult({
          name: 'Duplicate Data Check',
          status: 'warning',
          message: `Found ${duplicateCount} duplicate records in ${uniqueDuplicateGroups} groups`,
          details: `Total records: ${salesData?.length || 0}. These duplicates are now being filtered out in calculations to prevent double-counting.`,
        });

        // Show some example duplicate groups
        const exampleGroups = Object.entries(duplicateGroups).slice(0, 5);
        if (exampleGroups.length > 0) {
          addResult({
            name: 'Example Duplicate Groups',
            status: 'info',
            message: 'Sample of duplicate groups found',
            details: exampleGroups.map(([key, count]) => `${count} records with key: ${key.substring(0, 100)}...`).join('\n'),
          });
        }
      }
    } catch (err) {
      addResult({
        name: 'Duplicate Data Check',
        status: 'error',
        message: 'Unexpected error',
        details: String(err),
      });
    }

    setRunning(false);
  };

  const testPasswordReset = async () => {
    if (!testEmail) {
      addResult({
        name: 'Password Reset Test',
        status: 'error',
        message: 'Please enter an email address',
      });
      return;
    }

    setRunning(true);

    addResult({
      name: 'Password Reset Test',
      status: 'info',
      message: `Testing password reset for ${testEmail}...`,
    });

    const redirectUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:5173/reset-password'
      : 'https://dpl-rey8.bolt.host/reset-password';

    const startTime = Date.now();

    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(testEmail, {
        redirectTo: redirectUrl,
      });

      const duration = Date.now() - startTime;

      if (error) {
        addResult({
          name: 'Password Reset Test',
          status: 'error',
          message: 'Password reset failed',
          details: `Error: ${error.message} (Status: ${error.status}) - Duration: ${duration}ms`,
        });

        if (error.message.includes('rate limit')) {
          addResult({
            name: 'Rate Limit Detected',
            status: 'warning',
            message: 'Email rate limit exceeded',
            details: 'Wait a few minutes before trying again. Check Supabase Dashboard for rate limit settings.',
          });
        }
      } else {
        addResult({
          name: 'Password Reset Test',
          status: 'success',
          message: 'Password reset request accepted',
          details: `Duration: ${duration}ms. Email should be sent to ${testEmail}. Check inbox and spam folder.`,
        });

        addResult({
          name: 'Email Delivery',
          status: 'warning',
          message: 'Check your email',
          details: 'If you don\'t receive the email within 2-3 minutes, there may be an SMTP configuration issue in Supabase. Check Supabase Dashboard > Authentication > Email Templates and SMTP settings.',
        });
      }
    } catch (err) {
      addResult({
        name: 'Password Reset Test',
        status: 'error',
        message: 'Unexpected error',
        details: String(err),
      });
    }

    setRunning(false);
  };

  const checkUploadData = async () => {
    if (!currentOrganization) {
      addResult({
        name: 'Upload Data Check',
        status: 'error',
        message: 'No organization selected',
        details: 'Please select an organization from the dropdown',
      });
      return;
    }

    setRunning(true);

    addResult({
      name: 'Upload Data Check',
      status: 'info',
      message: `Checking upload data for ${currentOrganization.name}...`,
    });

    try {
      // 1. Check total sales data records
      const { count: salesCount, error: salesError } = await supabase
        .from('sales_data')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id);

      if (salesError) throw salesError;

      addResult({
        name: 'Total Sales Records',
        status: salesCount && salesCount > 0 ? 'success' : 'warning',
        message: `Found ${salesCount || 0} sales records`,
        details: salesCount === 0 ? 'No sales data found. Have you uploaded any files?' : `Organization: ${currentOrganization.name}`,
      });

      // 2. Check for records with missing dates
      const { count: missingDatesCount, error: missingDatesError } = await supabase
        .from('sales_data')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id)
        .is('order_date', null)
        .is('default_period', null);

      if (missingDatesError) throw missingDatesError;

      if (missingDatesCount && missingDatesCount > 0) {
        addResult({
          name: 'Records with Missing Dates',
          status: 'error',
          message: `Found ${missingDatesCount} records without dates`,
          details: 'These records will NOT appear in Dashboard or analytics. Go to Upload page and click "Add Dates" button to fix this.',
        });
      } else {
        addResult({
          name: 'Date Validation',
          status: 'success',
          message: 'All records have dates',
          details: 'Records are properly dated and should appear in analytics',
        });
      }

      // 3. Check upload status
      const { data: uploads, error: uploadsError } = await supabase
        .from('uploads')
        .select('id, filename, status, created_at, row_count')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (uploadsError) throw uploadsError;

      if (uploads && uploads.length > 0) {
        const needsReview = uploads.filter(u => u.status === 'needs_review' || u.status === 'needs_product_review');
        const processing = uploads.filter(u => u.status === 'processing');
        const completed = uploads.filter(u => u.status === 'completed');
        const failed = uploads.filter(u => u.status === 'failed');

        addResult({
          name: 'Upload History',
          status: 'info',
          message: `${uploads.length} recent uploads found`,
          details: `Completed: ${completed.length}, Needs Review: ${needsReview.length}, Processing: ${processing.length}, Failed: ${failed.length}`,
        });

        if (needsReview.length > 0) {
          addResult({
            name: 'Uploads Needing Action',
            status: 'warning',
            message: `${needsReview.length} uploads need your attention`,
            details: `Files: ${needsReview.map(u => u.filename).join(', ')}. Go to Upload page to review and complete these uploads.`,
          });
        }

        if (processing.length > 0) {
          addResult({
            name: 'Processing Uploads',
            status: 'warning',
            message: `${processing.length} uploads still processing`,
            details: 'If uploads have been processing for more than 5 minutes, they may have failed. Try re-uploading.',
          });
        }

        if (failed.length > 0) {
          addResult({
            name: 'Failed Uploads',
            status: 'error',
            message: `${failed.length} uploads failed`,
            details: `Files: ${failed.map(u => u.filename).join(', ')}. Check Upload page for error messages.`,
          });
        }
      } else {
        addResult({
          name: 'Upload History',
          status: 'warning',
          message: 'No uploads found',
          details: 'You need to upload sales data files before they can appear in the dashboard.',
        });
      }

      // 4. Check records that should appear in dashboard
      const { count: dashboardReadyCount, error: dashboardError } = await supabase
        .from('sales_data')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id)
        .or('order_date.not.is.null,default_period.not.is.null');

      if (dashboardError) throw dashboardError;

      addResult({
        name: 'Dashboard-Ready Records',
        status: dashboardReadyCount && dashboardReadyCount > 0 ? 'success' : 'error',
        message: `${dashboardReadyCount || 0} records ready for dashboard`,
        details: dashboardReadyCount === 0
          ? 'No records have dates. This is why your dashboard is empty!'
          : 'These records should appear in your Dashboard and analytics',
      });

      // 5. Check most recent upload details
      if (uploads && uploads.length > 0) {
        const mostRecent = uploads[0];
        const { data: recentRecords, error: recentError } = await supabase
          .from('sales_data')
          .select('order_date, default_period')
          .eq('upload_id', mostRecent.id)
          .limit(5);

        if (!recentError && recentRecords) {
          const withDates = recentRecords.filter(r => r.order_date || r.default_period).length;
          addResult({
            name: 'Most Recent Upload Detail',
            status: withDates === recentRecords.length ? 'success' : 'warning',
            message: `Latest upload: ${mostRecent.filename}`,
            details: `Status: ${mostRecent.status}, Records with dates: ${withDates}/${recentRecords.length}`,
          });
        }
      }

      addResult({
        name: 'Upload Data Check Complete',
        status: 'success',
        message: 'Diagnostic complete',
        details: 'Review results above to understand why data may not be appearing',
      });

    } catch (err) {
      addResult({
        name: 'Upload Data Check',
        status: 'error',
        message: 'Error during diagnostic',
        details: String(err),
      });
    }

    setRunning(false);
  };

  const checkDataAccuracy = async () => {
    if (!currentOrganization) {
      addResult({
        name: 'Data Accuracy Check',
        status: 'error',
        message: 'No organization selected',
        details: 'Please select an organization from the dropdown',
      });
      return;
    }

    setRunning(true);

    addResult({
      name: 'Data Accuracy Check',
      status: 'info',
      message: `Checking data accuracy for ${currentOrganization.name}...`,
    });

    try {
      // 1. Get counts from sales_data
      const { count: salesCount, error: salesError } = await supabase
        .from('sales_data')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id);

      if (salesError) throw salesError;

      addResult({
        name: 'Sales Data Records',
        status: 'info',
        message: `Found ${salesCount || 0} sales records`,
        details: `Organization: ${currentOrganization.name}`,
      });

      // 2. Get counts from products table
      const { count: productsCount, error: productsError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization.id);

      if (productsError) throw productsError;

      addResult({
        name: 'Products Table Records',
        status: 'info',
        message: `Found ${productsCount || 0} unique products`,
      });

      // 3. Get actual sales data to calculate totals
      const { data: salesData, error: salesDataError } = await supabase
        .from('sales_data')
        .select('revenue, quantity_in_bottles, quantity, quantity_unit, case_size, has_revenue_data')
        .eq('organization_id', currentOrganization.id);

      if (salesDataError) throw salesDataError;

      // Calculate totals from sales_data
      let totalRevenueSales = 0;
      let totalBottlesSales = 0;
      let recordsWithRevenue = 0;

      salesData?.forEach((record: any) => {
        if (record.has_revenue_data && record.revenue) {
          totalRevenueSales += Number(record.revenue);
          recordsWithRevenue++;
        }

        let bottles = 0;
        if (record.quantity_in_bottles !== null) {
          bottles = Number(record.quantity_in_bottles);
        } else if (record.quantity_unit === 'cases' && record.case_size) {
          bottles = Number(record.quantity) * Number(record.case_size);
        } else {
          bottles = Number(record.quantity) || 1;
        }
        totalBottlesSales += bottles;
      });

      addResult({
        name: 'Sales Data Totals',
        status: 'info',
        message: `Revenue: $${totalRevenueSales.toFixed(2)}, Bottles: ${totalBottlesSales.toFixed(2)}`,
        details: `${recordsWithRevenue} records with revenue out of ${salesCount}`,
      });

      // 4. Get totals from products table
      const { data: productsData, error: productsDataError } = await supabase
        .from('products')
        .select('total_revenue, total_units')
        .eq('organization_id', currentOrganization.id);

      if (productsDataError) throw productsDataError;

      const totalRevenueProducts = productsData?.reduce((sum: number, p: any) => sum + Number(p.total_revenue || 0), 0) || 0;
      const totalBottlesProducts = productsData?.reduce((sum: number, p: any) => sum + Number(p.total_units || 0), 0) || 0;

      addResult({
        name: 'Products Table Totals',
        status: 'info',
        message: `Revenue: $${totalRevenueProducts.toFixed(2)}, Bottles: ${totalBottlesProducts.toFixed(2)}`,
      });

      // 5. Compare revenue
      const revenueDiff = Math.abs(totalRevenueSales - totalRevenueProducts);
      const revenueMatch = revenueDiff < 1;

      addResult({
        name: 'Revenue Consistency',
        status: revenueMatch ? 'success' : 'error',
        message: revenueMatch
          ? 'Revenue totals match between sales_data and products table'
          : `Revenue mismatch detected: Difference of $${revenueDiff.toFixed(2)}`,
        details: revenueMatch
          ? 'Data aggregation is working correctly'
          : 'The products table may need to be regenerated. This could explain incorrect data on the Products page.',
      });

      // 6. Compare bottles
      const bottlesDiff = Math.abs(totalBottlesSales - totalBottlesProducts);
      const bottlesMatch = bottlesDiff < 1;

      addResult({
        name: 'Units Consistency',
        status: bottlesMatch ? 'success' : 'error',
        message: bottlesMatch
          ? 'Bottle/unit totals match between sales_data and products table'
          : `Units mismatch detected: Difference of ${bottlesDiff.toFixed(2)} bottles`,
        details: bottlesMatch
          ? 'Unit calculations are consistent'
          : 'The bottle-to-case conversion or aggregation may have issues.',
      });

      // 7. Check for specific products
      const { data: topProducts, error: topProductsError } = await supabase
        .from('products')
        .select('product_name, total_revenue, total_units, total_orders')
        .eq('organization_id', currentOrganization.id)
        .order('total_revenue', { ascending: false })
        .limit(5);

      if (topProductsError) throw topProductsError;

      if (topProducts && topProducts.length > 0) {
        const productsList = topProducts.map((p: any) =>
          `${p.product_name}: $${Number(p.total_revenue).toFixed(2)}, ${Number(p.total_units).toFixed(0)} bottles, ${p.total_orders} orders`
        ).join('\n');

        addResult({
          name: 'Top 5 Products',
          status: 'info',
          message: 'Product details from products table',
          details: productsList,
        });
      }

      // 8. Verify each top product against sales_data
      if (topProducts && topProducts.length > 0) {
        for (const product of topProducts.slice(0, 3)) {
          const { data: productSales, error: productSalesError } = await supabase
            .from('sales_data')
            .select('revenue, quantity_in_bottles, quantity, quantity_unit, case_size')
            .eq('organization_id', currentOrganization.id)
            .eq('product_name', product.product_name);

          if (!productSalesError && productSales) {
            const calculatedRevenue = productSales.reduce((sum: number, r: any) => sum + Number(r.revenue || 0), 0);
            const calculatedBottles = productSales.reduce((sum: number, r: any) => {
              let bottles = 0;
              if (r.quantity_in_bottles !== null) {
                bottles = Number(r.quantity_in_bottles);
              } else if (r.quantity_unit === 'cases' && r.case_size) {
                bottles = Number(r.quantity) * Number(r.case_size);
              } else {
                bottles = Number(r.quantity) || 1;
              }
              return sum + bottles;
            }, 0);

            const revMatch = Math.abs(calculatedRevenue - Number(product.total_revenue)) < 0.01;
            const unitsMatch = Math.abs(calculatedBottles - Number(product.total_units)) < 0.01;

            addResult({
              name: `Verify: ${product.product_name}`,
              status: revMatch && unitsMatch ? 'success' : 'error',
              message: revMatch && unitsMatch
                ? 'Product data matches sales records'
                : 'Product data DOES NOT match sales records',
              details: `Sales records: ${productSales.length} | Calculated: $${calculatedRevenue.toFixed(2)}, ${calculatedBottles.toFixed(0)} bottles | Products table: $${Number(product.total_revenue).toFixed(2)}, ${Number(product.total_units).toFixed(0)} bottles`,
            });
          }
        }
      }

      addResult({
        name: 'Data Accuracy Check Complete',
        status: 'success',
        message: 'Diagnostic complete',
        details: 'Review the results above to identify any data accuracy issues',
      });

    } catch (err) {
      addResult({
        name: 'Data Accuracy Check',
        status: 'error',
        message: 'Error during diagnostic',
        details: String(err),
      });
    }

    setRunning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Activity className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-500 rounded-lg p-2">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                System Diagnostics
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Test system connectivity, check for duplicates, and verify email delivery
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Upload className="w-5 h-5 text-red-600 dark:text-red-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Upload Data</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Check why uploaded data isn't appearing
              </p>
              <button
                onClick={checkUploadData}
                disabled={running || !currentOrganization}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition disabled:opacity-50"
              >
                {running ? 'Checking...' : 'Check Uploads'}
              </button>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Data Accuracy</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Verify product and revenue data consistency
              </p>
              <button
                onClick={checkDataAccuracy}
                disabled={running || !currentOrganization}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-4 rounded-lg transition disabled:opacity-50"
              >
                {running ? 'Checking...' : 'Check Data'}
              </button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Connection Test</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Verify Supabase connectivity and configuration
              </p>
              <button
                onClick={runDiagnostics}
                disabled={running}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition disabled:opacity-50"
              >
                {running ? 'Running...' : 'Run Diagnostics'}
              </button>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Duplicate Check</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Scan for duplicate records in your sales data
              </p>
              <button
                onClick={checkDuplicateData}
                disabled={running}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition disabled:opacity-50"
              >
                {running ? 'Scanning...' : 'Check Duplicates'}
              </button>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-5 h-5 text-green-600 dark:text-green-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Email Test</h3>
              </div>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="w-full px-3 py-2 mb-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm"
              />
              <button
                onClick={testPasswordReset}
                disabled={running || !testEmail}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition disabled:opacity-50"
              >
                {running ? 'Sending...' : 'Test Password Reset'}
              </button>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                  Important Checks in Supabase Dashboard
                </p>
                <ul className="space-y-1 text-yellow-800 dark:text-yellow-300">
                  <li>• Authentication URL Configuration - Site URL and Redirect URLs</li>
                  <li>• Email Templates - Verify "Reset Password" template is configured</li>
                  <li>• SMTP Settings - Check email provider configuration</li>
                  <li>• Email Rate Limits - Ensure limits haven't been exceeded</li>
                  <li>• Project Status - Verify project is active and not paused</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {results.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Diagnostic Results
            </h2>
            <div className="space-y-3">
              {results.map((result, index) => (
                <div
                  key={index}
                  className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-start gap-3">
                    {getStatusIcon(result.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {result.name}
                        </h3>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          result.status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
                          result.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' :
                          result.status === 'warning' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' :
                          'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                        }`}>
                          {result.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                        {result.message}
                      </p>
                      {result.details && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded break-all">
                          {result.details}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
            Next Steps if Email Not Received
          </h2>
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-start gap-2">
              <Key className="w-4 h-4 text-blue-500 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">1. Check Supabase Dashboard</p>
                <p className="text-gray-600 dark:text-gray-400">
                  Navigate to Authentication Email Templates and verify the Reset Password template is configured with the correct ConfirmationURL variable.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Server className="w-4 h-4 text-blue-500 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">2. Verify SMTP Settings</p>
                <p className="text-gray-600 dark:text-gray-400">
                  In Supabase Dashboard, check if SMTP is configured. Consider setting up Resend for reliable email delivery.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Globe className="w-4 h-4 text-blue-500 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">3. Review URL Configuration</p>
                <p className="text-gray-600 dark:text-gray-400">
                  Ensure Site URL and Redirect URLs in Supabase match your application domains.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, AlertCircle, TrendingUp, Package, Calendar, GitMerge } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { updateAggregatedData } from '../lib/dataProcessor';
import { format } from 'date-fns';

interface BackgroundDuplicatesReviewProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  onReviewComplete: () => void;
}

interface DuplicateCandidate {
  id: string;
  product1_name: string;
  product2_name: string;
  product1_id: string;
  product2_id: string;
  confidence_score: number;
  similarity_details: {
    reasoning: string[];
    componentScores: {
      brand: number;
      productType: number;
      volume: number;
      packageCount: number;
      tokens: number;
      overall: number;
    };
  };
  product1: {
    id: string;
    product_name: string;
    total_revenue: number;
    total_orders: number;
    last_sale_date: string;
  };
  product2: {
    id: string;
    product_name: string;
    total_revenue: number;
    total_orders: number;
    last_sale_date: string;
  };
}

export default function BackgroundDuplicatesReview({
  isOpen,
  onClose,
  organizationId,
  onReviewComplete
}: BackgroundDuplicatesReviewProps) {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCandidates();
    }
  }, [isOpen, organizationId]);

  const loadCandidates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('background_duplicate_candidates')
      .select(`
        *,
        product1:products!background_duplicate_candidates_product1_id_fkey(id, product_name, total_revenue, total_orders, last_sale_date),
        product2:products!background_duplicate_candidates_product2_id_fkey(id, product_name, total_revenue, total_orders, last_sale_date)
      `)
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .is('archived_at', null)
      .order('confidence_score', { ascending: false })
      .limit(50);

    if (!error && data) {
      setCandidates(data as any);
    }
    setCurrentIndex(0);
    setLoading(false);
  };

  const handleMerge = async (keepProductId: string, mergeProductId: string, keepProductName: string, mergeProductName: string) => {
    if (!user) return;

    setProcessing(true);

    try {
      const candidate = candidates[currentIndex];

      await supabase
        .from('sales_data')
        .update({ product_name: keepProductName })
        .eq('organization_id', organizationId)
        .eq('product_name', mergeProductName);

      await supabase
        .from('product_mappings')
        .insert({
          organization_id: organizationId,
          product_variant: mergeProductName,
          canonical_name: keepProductName,
          confidence_score: candidate.confidence_score,
          source: 'manual',
          created_by: user.id,
          is_active: true
        });

      const { data: salesData } = await supabase
        .from('sales_data')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('product_name', mergeProductName);

      await supabase
        .from('merge_audit_log')
        .insert({
          organization_id: organizationId,
          merge_type: 'manual',
          source_product_names: [mergeProductName],
          target_canonical_name: keepProductName,
          confidence_score: candidate.confidence_score,
          ai_reasoning: `Background scan detected duplicate (${(candidate.confidence_score * 100).toFixed(0)}% confidence)`,
          records_affected: salesData?.length || 0,
          performed_by: user.id,
          can_undo: true
        });

      await supabase
        .from('background_duplicate_candidates')
        .update({
          status: 'merged',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          user_decision: {
            action: 'merged',
            kept_product: keepProductName,
            merged_product: mergeProductName
          }
        })
        .eq('id', candidate.id);

      console.log('🔄 Regenerating products aggregation...');
      await updateAggregatedData(organizationId);
      console.log('✅ Products table updated successfully');

      if (currentIndex < candidates.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onReviewComplete();
        onClose();
      }
    } catch (error) {
      console.error('Error merging products:', error);
      alert('Failed to merge products. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDismiss = async () => {
    if (!user) return;

    setProcessing(true);

    try {
      const candidate = candidates[currentIndex];

      await supabase
        .from('background_duplicate_candidates')
        .update({
          status: 'dismissed',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          user_decision: {
            action: 'dismissed',
            reason: 'User determined these are not duplicates'
          }
        })
        .eq('id', candidate.id);

      if (currentIndex < candidates.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onReviewComplete();
        onClose();
      }
    } catch (error) {
      console.error('Error dismissing candidate:', error);
      alert('Failed to dismiss. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="glass-card rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
          </div>
          <p className="text-center text-gray-600 dark:text-zinc-400 mt-4">Loading duplicate candidates...</p>
        </div>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="glass-card rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-accent-teal-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white text-center mb-2">
            No duplicates found!
          </h3>
          <p className="text-gray-600 dark:text-zinc-400 text-center mb-6">
            All products look good.
          </p>
          <button
            onClick={onClose}
            className="btn-primary w-full"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const currentCandidate = candidates[currentIndex];
  const progress = ((currentIndex + 1) / candidates.length) * 100;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Review Potential Duplicates</h2>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
              Candidate {currentIndex + 1} of {candidates.length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-zinc-400" />
          </button>
        </div>

        <div className="px-6 py-2 border-b border-gray-200 dark:border-white/10">
          <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
            <div
              className="bg-gradient-blue h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mb-6">
            <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Potential Duplicate Detected</h3>
                <p className="text-sm text-gray-600 dark:text-zinc-400">
                  Confidence: {(currentCandidate.confidence_score * 100).toFixed(0)}% - {currentCandidate.similarity_details.reasoning.join(', ')}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h4 className="font-semibold text-gray-900 dark:text-white">Product 1</h4>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {currentCandidate.product1_name}
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-zinc-400">Revenue:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ${currentCandidate.product1.total_revenue.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-zinc-400">Orders:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {currentCandidate.product1.total_orders}
                  </span>
                </div>
                {currentCandidate.product1.last_sale_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-zinc-400">Last Sale:</span>
                    <span className="text-gray-900 dark:text-white">
                      {format(new Date(currentCandidate.product1.last_sale_date), 'MMM dd, yyyy')}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => handleMerge(
                  currentCandidate.product1_id,
                  currentCandidate.product2_id,
                  currentCandidate.product1_name,
                  currentCandidate.product2_name
                )}
                disabled={processing}
                className="btn-primary w-full mt-4"
              >
                <CheckCircle className="w-4 h-4" />
                Keep This Product
              </button>
            </div>

            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h4 className="font-semibold text-gray-900 dark:text-white">Product 2</h4>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {currentCandidate.product2_name}
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-zinc-400">Revenue:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ${currentCandidate.product2.total_revenue.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-zinc-400">Orders:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {currentCandidate.product2.total_orders}
                  </span>
                </div>
                {currentCandidate.product2.last_sale_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-zinc-400">Last Sale:</span>
                    <span className="text-gray-900 dark:text-white">
                      {format(new Date(currentCandidate.product2.last_sale_date), 'MMM dd, yyyy')}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => handleMerge(
                  currentCandidate.product2_id,
                  currentCandidate.product1_id,
                  currentCandidate.product2_name,
                  currentCandidate.product1_name
                )}
                disabled={processing}
                className="btn-primary w-full mt-4"
              >
                <CheckCircle className="w-4 h-4" />
                Keep This Product
              </button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 dark:bg-white/5 rounded-xl">
            <h5 className="text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide mb-2">
              Similarity Analysis
            </h5>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div>
                <span className="text-gray-600 dark:text-zinc-400">Brand:</span>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {(currentCandidate.similarity_details.componentScores.brand * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <span className="text-gray-600 dark:text-zinc-400">Volume:</span>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {(currentCandidate.similarity_details.componentScores.volume * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <span className="text-gray-600 dark:text-zinc-400">Tokens:</span>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {(currentCandidate.similarity_details.componentScores.tokens * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <span className="text-gray-600 dark:text-zinc-400">Package:</span>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {(currentCandidate.similarity_details.componentScores.packageCount * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <span className="text-gray-600 dark:text-zinc-400">Overall:</span>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {(currentCandidate.similarity_details.componentScores.overall * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-between">
          <button
            onClick={handleDismiss}
            disabled={processing}
            className="btn-secondary"
          >
            <XCircle className="w-4 h-4" />
            Not Duplicates
          </button>
          <div className="text-sm text-gray-600 dark:text-zinc-400">
            {processing ? 'Processing...' : `${candidates.length - currentIndex - 1} remaining`}
          </div>
        </div>
      </div>
    </div>
  );
}

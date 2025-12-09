import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, TrendingUp, Package, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getPendingReviewProducts, markProductReviewed, createProductMapping, logMergeDecision } from '../lib/productDeduplicationService';
import { updateAggregatedData } from '../lib/dataProcessor';
import { format } from 'date-fns';

interface ProductDuplicateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  uploadId: string;
  organizationId: string;
  onReviewComplete: () => void;
}

interface PendingProduct {
  id: string;
  product_name: string;
  potential_matches: Array<{
    existingProductName: string;
    existingProductId: string;
    confidence: number;
    reasoning: string;
    totalRevenue: number;
    totalOrders: number;
    lastSaleDate: string;
  }>;
  ai_analysis: any;
}

export default function ProductDuplicateReviewModal({
  isOpen,
  onClose,
  uploadId,
  organizationId,
  onReviewComplete
}: ProductDuplicateReviewModalProps) {
  const { user } = useAuth();
  const [products, setProducts] = useState<PendingProduct[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPendingProducts();
    }
  }, [isOpen, uploadId]);

  const loadPendingProducts = async () => {
    setLoading(true);
    const data = await getPendingReviewProducts(uploadId, organizationId);
    setProducts(data);
    setCurrentIndex(0);
    setLoading(false);
  };

  const handleMergeDecision = async (productId: string, productName: string, mergeWithName: string | null, confidence?: number, reasoning?: string) => {
    if (!user) return;

    setProcessing(true);

    try {
      const decision = {
        action: mergeWithName ? 'merge' : 'keep_separate',
        canonical_name: mergeWithName || productName,
        timestamp: new Date().toISOString()
      };

      await markProductReviewed(productId, decision, user.id);

      if (mergeWithName) {
        await createProductMapping(
          organizationId,
          productName,
          mergeWithName,
          confidence || 0.85,
          'ai_confirmed',
          user.id
        );

        const { data: salesData } = await supabase
          .from('sales_data')
          .select('id')
          .eq('upload_id', uploadId)
          .eq('product_name', productName);

        const recordCount = salesData?.length || 0;

        if (recordCount > 0) {
          await supabase
            .from('sales_data')
            .update({ product_name: mergeWithName })
            .eq('upload_id', uploadId)
            .eq('product_name', productName);
        }

        await logMergeDecision(
          organizationId,
          'manual',
          [productName],
          mergeWithName,
          confidence || null,
          reasoning || 'User confirmed match',
          recordCount,
          uploadId,
          user.id
        );
      }

      if (currentIndex < products.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        await handleReviewComplete();
      }
    } catch (error) {
      console.error('Error processing merge decision:', error);
      alert('Failed to process decision. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReviewComplete = async () => {
    await supabase
      .from('uploads')
      .update({ status: 'completed' })
      .eq('id', uploadId);

    console.log('🔄 Regenerating products aggregation for organization...');
    await updateAggregatedData(organizationId);
    console.log('✅ Products table updated successfully');

    onReviewComplete();
    onClose();
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="glass-card rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
          </div>
          <p className="text-center text-gray-600 dark:text-zinc-400 mt-4">Loading products for review...</p>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="glass-card rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-accent-teal-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white text-center mb-2">
            All products reviewed!
          </h3>
          <p className="text-gray-600 dark:text-zinc-400 text-center mb-6">
            Upload processing complete.
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

  const currentProduct = products[currentIndex];
  const progress = ((currentIndex + 1) / products.length) * 100;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Review Product Duplicates</h2>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
              Product {currentIndex + 1} of {products.length}
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
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">New Product Found</h3>
                <p className="text-lg text-gray-900 dark:text-white font-medium">{currentProduct.product_name}</p>
                <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
                  We found {currentProduct.potential_matches.length} potential {currentProduct.potential_matches.length === 1 ? 'match' : 'matches'} in your catalog.
                  Please review and decide if this is a duplicate.
                </p>
              </div>
            </div>
          </div>

          <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-4">
            Potential Matches
          </h4>

          <div className="space-y-4">
            {currentProduct.potential_matches.map((match, index) => (
              <div
                key={index}
                className="glass-card rounded-xl p-5 hover:shadow-lg transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
                      <h5 className="font-semibold text-gray-900 dark:text-white">
                        {match.existingProductName}
                      </h5>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-zinc-400">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>${match.totalRevenue.toLocaleString()}</span>
                      </div>
                      <span>{match.totalOrders} orders</span>
                      {match.lastSaleDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Last sold: {format(new Date(match.lastSaleDate), 'MMM dd, yyyy')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      match.confidence >= 0.90 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                      match.confidence >= 0.80 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                      'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                    }`}>
                      {(match.confidence * 100).toFixed(0)}% match
                    </div>
                  </div>
                </div>

                <div className="mb-4 p-3 bg-gray-50 dark:bg-white/5 rounded-lg">
                  <p className="text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide mb-1">
                    AI Reasoning
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white">{match.reasoning}</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleMergeDecision(
                      currentProduct.id,
                      currentProduct.product_name,
                      match.existingProductName,
                      match.confidence,
                      match.reasoning
                    )}
                    disabled={processing}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Merge with This Product
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-between">
          <button
            onClick={() => handleMergeDecision(currentProduct.id, currentProduct.product_name, null)}
            disabled={processing}
            className="btn-secondary"
          >
            Keep as New Product
          </button>
          <div className="text-sm text-gray-600 dark:text-zinc-400">
            {processing ? 'Processing...' : `${products.length - currentIndex - 1} remaining`}
          </div>
        </div>
      </div>
    </div>
  );
}

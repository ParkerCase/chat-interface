// src/components/RAGStatusIndicator.jsx
import React, { useState, useEffect } from 'react';
import { Database, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import documentEmbeddingProcessor from '../utils/documentEmbeddingProcessor';

const RAGStatusIndicator = ({ className = '' }) => {
  const [status, setStatus] = useState({
    totalDocuments: 0,
    documentsWithEmbeddings: 0,
    processingQueue: 0,
    isProcessing: false,
    lastUpdated: null
  });
  const [isVisible, setIsVisible] = useState(false);

  const fetchStatus = async () => {
    try {
      // Get total document count
      const { count: totalCount, error: totalError } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');

      // Get documents with embeddings count
      const { count: embeddingCount, error: embeddingError } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .not('embedding', 'is', null);

      if (!totalError && !embeddingError) {
        const processorStatus = documentEmbeddingProcessor.getStatus();
        
        setStatus({
          totalDocuments: totalCount || 0,
          documentsWithEmbeddings: embeddingCount || 0,
          processingQueue: processorStatus.queueLength,
          isProcessing: processorStatus.isProcessing,
          lastUpdated: new Date()
        });
      }
    } catch (error) {
      console.error('Error fetching RAG status:', error);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchStatus();

    // Set up interval to refresh status
    const interval = setInterval(fetchStatus, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    if (status.isProcessing) return 'text-blue-500';
    if (status.totalDocuments === 0) return 'text-gray-400';
    if (status.documentsWithEmbeddings === status.totalDocuments) return 'text-green-500';
    return 'text-yellow-500';
  };

  const getStatusIcon = () => {
    if (status.isProcessing) return <Loader className="w-3 h-3 animate-spin" />;
    if (status.totalDocuments === 0) return <Database className="w-3 h-3" />;
    if (status.documentsWithEmbeddings === status.totalDocuments) return <CheckCircle className="w-3 h-3" />;
    return <AlertCircle className="w-3 h-3" />;
  };

  const getStatusText = () => {
    if (status.totalDocuments === 0) return 'No documents';
    if (status.isProcessing) return `Processing... (${status.processingQueue} queued)`;
    if (status.documentsWithEmbeddings === status.totalDocuments) {
      return `${status.totalDocuments} documents ready`;
    }
    return `${status.documentsWithEmbeddings}/${status.totalDocuments} ready`;
  };

  const getDetailedStatus = () => {
    const readyPercentage = status.totalDocuments > 0 
      ? Math.round((status.documentsWithEmbeddings / status.totalDocuments) * 100)
      : 0;
    
    return `Knowledge Base: ${readyPercentage}% ready (${status.documentsWithEmbeddings}/${status.totalDocuments} documents processed)`;
  };

  return (
    <div 
      className={`inline-flex items-center gap-2 text-xs ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      title={getDetailedStatus()}
    >
      <div className={`flex items-center gap-1 ${getStatusColor()}`}>
        {getStatusIcon()}
        <span className="font-medium">{getStatusText()}</span>
      </div>
      
      {isVisible && (
        <div className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 mt-8 min-w-64">
          <div className="text-sm font-medium text-gray-900 mb-2">RAG System Status</div>
          <div className="space-y-1 text-xs text-gray-600">
            <div>Total Documents: {status.totalDocuments}</div>
            <div>AI Ready: {status.documentsWithEmbeddings}</div>
            <div>Processing Queue: {status.processingQueue}</div>
            <div>Status: {status.isProcessing ? 'Processing' : 'Idle'}</div>
            {status.lastUpdated && (
              <div className="text-gray-400 pt-1 border-t border-gray-100">
                Updated: {status.lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RAGStatusIndicator;
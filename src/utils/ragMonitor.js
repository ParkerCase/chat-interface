// RAG System Test and Monitor Utility
// Use this in browser console to test and monitor the RAG system

class RAGMonitor {
  constructor() {
    this.isMonitoring = false;
    this.stats = {
      totalQueries: 0,
      enhancedQueries: 0,
      avgDocumentsFound: 0,
      totalDocumentsUsed: 0,
      errors: 0
    };
  }

  startMonitoring() {
    if (this.isMonitoring) {
      console.log('RAG Monitor: Already monitoring');
      return;
    }

    this.isMonitoring = true;
    console.log('🔍 RAG Monitor: Started monitoring RAG system');

    // Listen to RAG events
    window.addEventListener('rag:start', this.handleRAGStart.bind(this));
    window.addEventListener('rag:complete', this.handleRAGComplete.bind(this));
    window.addEventListener('rag:error', this.handleRAGError.bind(this));
  }

  stopMonitoring() {
    this.isMonitoring = false;
    console.log('⏹️ RAG Monitor: Stopped monitoring');
    
    window.removeEventListener('rag:start', this.handleRAGStart.bind(this));
    window.removeEventListener('rag:complete', this.handleRAGComplete.bind(this));
    window.removeEventListener('rag:error', this.handleRAGError.bind(this));
  }

  handleRAGStart() {
    this.stats.totalQueries++;
    console.log('🚀 RAG: Query started');
  }

  handleRAGComplete(event) {
    const documentsFound = event.detail?.documentsFound || 0;
    
    if (documentsFound > 0) {
      this.stats.enhancedQueries++;
      this.stats.totalDocumentsUsed += documentsFound;
      this.stats.avgDocumentsFound = this.stats.totalDocumentsUsed / this.stats.enhancedQueries;
    }
    
    console.log(`✅ RAG: Query completed with ${documentsFound} documents`);
  }

  handleRAGError(event) {
    this.stats.errors++;
    console.log('❌ RAG: Query failed -', event.detail?.error);
  }

  showStats() {
    console.log('📊 RAG Statistics:');
    console.log(`Total Queries: ${this.stats.totalQueries}`);
    console.log(`Enhanced Queries: ${this.stats.enhancedQueries}`);
    console.log(`Enhancement Rate: ${((this.stats.enhancedQueries / this.stats.totalQueries) * 100).toFixed(1)}%`);
    console.log(`Avg Documents Found: ${this.stats.avgDocumentsFound.toFixed(1)}`);
    console.log(`Total Documents Used: ${this.stats.totalDocumentsUsed}`);
    console.log(`Errors: ${this.stats.errors}`);
    console.log(`Error Rate: ${((this.stats.errors / this.stats.totalQueries) * 100).toFixed(1)}%`);
  }

  resetStats() {
    this.stats = {
      totalQueries: 0,
      enhancedQueries: 0,
      avgDocumentsFound: 0,
      totalDocumentsUsed: 0,
      errors: 0
    };
    console.log('🔄 RAG Monitor: Statistics reset');
  }

  async testRAG() {
    console.log('🧪 RAG Monitor: Running test queries...');
    
    const testQueries = [
      "What is tattoo removal?",
      "How does laser removal work?",
      "What are the side effects?",
      "How much does treatment cost?",
      "How many sessions are needed?"
    ];

    if (!window.ragService) {
      console.error('❌ RAG Service not found. Make sure the system is loaded.');
      return;
    }

    for (const query of testQueries) {
      console.log(`\n🔍 Testing: "${query}"`);
      try {
        const result = await window.ragService.enhanceQuery(query);
        console.log(`📋 Result: ${result.hasContext ? 'Enhanced' : 'No enhancement'} (${result.documentsFound} docs)`);
      } catch (error) {
        console.error(`❌ Test failed:`, error);
      }
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🎉 RAG testing completed!');
    this.showStats();
  }

  async checkSystemHealth() {
    console.log('🏥 RAG Monitor: Checking system health...');
    
    const checks = [];
    
    // Check if ragService is available
    if (window.ragService) {
      checks.push('✅ RAG Service: Available');
    } else {
      checks.push('❌ RAG Service: Not found');
    }
    
    // Check if supabase is available
    if (window.supabase) {
      checks.push('✅ Supabase: Available');
      
      try {
        // Test database connection
        const { data, error } = await window.supabase
          .from('documents')
          .select('id', { count: 'exact' })
          .limit(1);
          
        if (error) {
          checks.push(`❌ Database: Connection error - ${error.message}`);
        } else {
          checks.push('✅ Database: Connected');
        }
      } catch (error) {
        checks.push(`❌ Database: ${error.message}`);
      }
    } else {
      checks.push('❌ Supabase: Not found');
    }
    
    // Check OpenAI API key
    if (process.env.REACT_APP_OPENAI_API_KEY) {
      checks.push('✅ OpenAI API Key: Present');
    } else {
      checks.push('❌ OpenAI API Key: Missing');
    }
    
    console.log('🔍 System Health Check Results:');
    checks.forEach(check => console.log(`  ${check}`));
    
    return checks;
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.ragMonitor = new RAGMonitor();
  
  // Quick access functions
  window.startRAGMonitoring = () => window.ragMonitor.startMonitoring();
  window.stopRAGMonitoring = () => window.ragMonitor.stopMonitoring();
  window.showRAGStats = () => window.ragMonitor.showStats();
  window.testRAG = () => window.ragMonitor.testRAG();
  window.checkRAGHealth = () => window.ragMonitor.checkSystemHealth();
  
  console.log('🛠️ RAG Monitor loaded! Available commands:');
  console.log('  startRAGMonitoring() - Start monitoring RAG events');
  console.log('  stopRAGMonitoring() - Stop monitoring');
  console.log('  showRAGStats() - Show current statistics');
  console.log('  testRAG() - Run test queries');
  console.log('  checkRAGHealth() - Check system health');
}

export default RAGMonitor;

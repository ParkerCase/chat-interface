// supabase/functions/zenoti-reports/index.ts

import { corsHeaders } from '../_shared/cors.ts';


interface ReportRequest {
  reportType: 
    | 'accrual_basis' 
    | 'cash_basis' 
    | 'appointments' 
    | 'services' 
    | 'packages';
  
  startDate?: string;
  endDate?: string;
  centerCode: string;
  
  // Additional filters
  itemTypes?: number[];
  paymentTypes?: number[];
  saleTypes?: number[];
  invoiceStatuses?: number[];
  status?: string;
  therapistId?: string;
  serviceId?: string;
  
  // Pagination
  page?: number;
  size?: number;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Extract parameters from request
    const url = new URL(req.url);
    let params: ReportRequest;
    
    if (req.method === 'POST') {
      params = await req.json();
    } else {
      // Extract from query parameters
      params = {
        reportType: url.searchParams.get('reportType') as any || 'accrual_basis',
        startDate: url.searchParams.get('startDate') || undefined,
        endDate: url.searchParams.get('endDate') || undefined,
        centerCode: url.searchParams.get('centerCode') || '',
        status: url.searchParams.get('status') || undefined,
        page: url.searchParams.has('page') ? parseInt(url.searchParams.get('page')!) : 1,
        size: url.searchParams.has('size') ? parseInt(url.searchParams.get('size')!) : 50
      };
    }
    
    // Validate parameters
    if (!params.centerCode) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Center code is required' 
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }
    
    // Set up default date range if not provided
    if (!params.startDate) {
      const defaultStart = new Date();
      defaultStart.setMonth(defaultStart.getMonth() - 1); // Default to last month
      params.startDate = defaultStart.toISOString().split('T')[0];
    }
    
    if (!params.endDate) {
      params.endDate = new Date().toISOString().split('T')[0];
    }
    
    // Call the appropriate report function based on type
    switch (params.reportType) {
      case 'accrual_basis':
        return await getAccrualBasisReport(req.url, params);
      
      case 'cash_basis':
        return await getCashBasisReport(req.url, params);
      
      case 'appointments':
        return await getAppointmentsReport(req.url, params);
      
      case 'services':
        return await getServicesReport(req.url, params);
      
      case 'packages':
        return await getPackagesReport(req.url, params);
      
      default:
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Unsupported report type: ${params.reportType}` 
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
    }
  } catch (error) {
    console.error('Error generating report:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Error generating report: ${error.message}`
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});

/**
 * Gets the accrual basis sales report
 */
async function getAccrualBasisReport(baseUrl: string, params: ReportRequest): Promise<Response> {
  // Format date for Zenoti API
  const formattedStartDate = `${params.startDate} 00:00:00`;
  const formattedEndDate = `${params.endDate} 23:59:59`;
  
  // First get the center ID from the center code
  const centerIdResponse = await getCenterIdFromCode(baseUrl, params.centerCode);
  
  if (!centerIdResponse.success) {
    return new Response(
      JSON.stringify(centerIdResponse),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
  
  // Prepare request body for sales report
  const reportBody = {
    center_ids: [centerIdResponse.centerId],
    start_date: formattedStartDate,
    end_date: formattedEndDate,
    page: params.page || 1,
    size: params.size || 50
  };
  
  // Call the Zenoti connector function
  const connectorResponse = await fetch(new URL('/zenoti-connector', baseUrl).href, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    },
    body: JSON.stringify({
      endpoint: 'reports/sales/accrual_basis/flat_file',
      method: 'POST',
      body: reportBody
    })
  });
  
  const result = await connectorResponse.json();
  
  // Process and format the response
  if (result.success) {
    // Extract sales data from response
    let salesData = [];
    let summary = {
      total_sales: 0,
      total_refunds: 0,
      net_sales: 0
    };
    
    if (result.data.report) {
      // Try to extract from report object
      if (result.data.report.sales && Array.isArray(result.data.report.sales)) {
        salesData = result.data.report.sales;
      }
      
      // Extract summary data if available
      if (result.data.report.total) {
        summary.total_sales = result.data.report.total.sales || 0;
        summary.total_refunds = result.data.report.total.refunds || 0;
        summary.net_sales = summary.total_sales - summary.total_refunds;
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        reportType: 'accrual_basis',
        data: salesData,
        summary,
        params: {
          startDate: params.startDate,
          endDate: params.endDate,
          centerCode: params.centerCode
        }
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  } else {
    return new Response(
      JSON.stringify({
        success: false,
        error: result.error || 'Failed to generate accrual basis report',
        params: {
          startDate: params.startDate,
          endDate: params.endDate,
          centerCode: params.centerCode
        }
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
}

/**
 * Gets the cash basis sales report
 */
async function getCashBasisReport(baseUrl: string, params: ReportRequest): Promise<Response> {
  // Format date for Zenoti API
  const formattedStartDate = `${params.startDate} 00:00:00`;
  const formattedEndDate = `${params.endDate} 23:59:59`;
  
  // First get the center ID from the center code
  const centerIdResponse = await getCenterIdFromCode(baseUrl, params.centerCode);
  
  if (!centerIdResponse.success) {
    return new Response(
      JSON.stringify(centerIdResponse),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
  
  // Prepare request body for sales report
  const reportBody = {
    centers: {
      ids: [centerIdResponse.centerId]
    },
    start_date: formattedStartDate,
    end_date: formattedEndDate,
    level_of_detail: "1",
    item_types: params.itemTypes || [-1],
    payment_types: params.paymentTypes || [-1],
    sale_types: params.saleTypes || [-1],
    invoice_statuses: params.invoiceStatuses || [-1],
    sold_by_ids: [], // Required field
    page: params.page || 1,
    size: params.size || 50
  };
  
  // Call the Zenoti connector function
  const connectorResponse = await fetch(new URL('/zenoti-connector', baseUrl).href, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    },
    body: JSON.stringify({
      endpoint: 'reports/sales/cash_basis/flat_file',
      method: 'POST',
      body: reportBody
    })
  });
  
  const result = await connectorResponse.json();
  
  // Process and format the response similar to accrual basis
  if (result.success) {
    // Extract sales data from response
    let salesData = [];
    let summary = {
      total_sales: 0,
      total_refunds: 0,
      net_sales: 0
    };
    
    if (result.data.report) {
      // Try to extract from report object
      if (result.data.report.sales && Array.isArray(result.data.report.sales)) {
        salesData = result.data.report.sales;
      }
      
      // Extract summary data if available
      if (result.data.report.total) {
        summary.total_sales = result.data.report.total.sales || 0;
        summary.total_refunds = result.data.report.total.refunds || 0;
        summary.net_sales = summary.total_sales - summary.total_refunds;
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        reportType: 'cash_basis',
        data: salesData,
        summary,
        params: {
          startDate: params.startDate,
          endDate: params.endDate,
          centerCode: params.centerCode
        }
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  } else {
    return new Response(
      JSON.stringify({
        success: false,
        error: result.error || 'Failed to generate cash basis report',
        params: {
          startDate: params.startDate,
          endDate: params.endDate,
          centerCode: params.centerCode
        }
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
}

/**
 * Gets the appointments report
 */
async function getAppointmentsReport(baseUrl: string, params: ReportRequest): Promise<Response> {
  // Use the existing zenoti-appointments function
  const appointmentsUrl = new URL('/zenoti-appointments', baseUrl);
  
  // Add query parameters
  appointmentsUrl.searchParams.append('centerCode', params.centerCode);
  appointmentsUrl.searchParams.append('startDate', params.startDate || '');
  appointmentsUrl.searchParams.append('endDate', params.endDate || '');
  
  if (params.status) {
    appointmentsUrl.searchParams.append('status', params.status);
  }
  
  if (params.therapistId) {
    appointmentsUrl.searchParams.append('therapistId', params.therapistId);
  }
  
  if (params.page) {
    appointmentsUrl.searchParams.append('page', params.page.toString());
  }
  
  if (params.size) {
    appointmentsUrl.searchParams.append('limit', params.size.toString());
  }
  
  // Call the appointments function
  const response = await fetch(appointmentsUrl.toString(), {
    headers: corsHeaders
  });
  
  const result = await response.json();
  
  // Reformat to match our report format
  return new Response(
    JSON.stringify({
      ...result,
      reportType: 'appointments',
      params: {
        startDate: params.startDate,
        endDate: params.endDate,
        centerCode: params.centerCode,
        status: params.status
      }
    }),
    {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    }
  );
}

/**
 * Gets the services report
 */
async function getServicesReport(baseUrl: string, params: ReportRequest): Promise<Response> {
  // Use the existing zenoti-services function
  const servicesUrl = new URL('/zenoti-services', baseUrl);
  
  // Add query parameters
  servicesUrl.searchParams.append('centerCode', params.centerCode);
  
  if (params.serviceId) {
    servicesUrl.searchParams.append('serviceId', params.serviceId);
  }
  
  if (params.page) {
    servicesUrl.searchParams.append('page', params.page.toString());
  }
  
  if (params.size) {
    servicesUrl.searchParams.append('limit', params.size.toString());
  }
  
  // Call the services function
  const response = await fetch(servicesUrl.toString(), {
    headers: corsHeaders
  });
  
  const result = await response.json();
  
  // Reformat to match our report format
  return new Response(
    JSON.stringify({
      ...result,
      reportType: 'services',
      params: {
        centerCode: params.centerCode
      }
    }),
    {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    }
  );
}

/**
 * Gets the packages report
 */
async function getPackagesReport(baseUrl: string, params: ReportRequest): Promise<Response> {
  // Call the Zenoti connector function directly
  const connectorResponse = await fetch(new URL('/zenoti-connector', baseUrl).href, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    },
    body: JSON.stringify({
      endpoint: `centers/${params.centerCode}/packages`,
      method: 'GET',
      params: {
        limit: params.size || 100,
        offset: params.page ? (params.page - 1) * (params.size || 100) : 0
      }
    })
  });
  
  const result = await connectorResponse.json();
  
  // Process and format the response
  if (result.success) {
    let packages = [];
    
    if (result.data.packages) {
      packages = result.data.packages;
    } else if (Array.isArray(result.data)) {
      packages = result.data;
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        reportType: 'packages',
        packages,
        totalCount: packages.length,
        params: {
          centerCode: params.centerCode
        }
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  } else {
    return new Response(
      JSON.stringify({
        success: false,
        error: result.error || 'Failed to get packages',
        params: {
          centerCode: params.centerCode
        }
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
}

/**
 * Helper function to get center ID from center code
 */
async function getCenterIdFromCode(baseUrl: string, centerCode: string): Promise<{ success: boolean; centerId?: string; error?: string }> {
  // Hardcoded center ID mapping - fallback if API call fails
  const CENTER_ID_MAP: Record<string, string> = {
    AUS: "ca3dc432-280b-4cdb-86ea-6e582f3182a9",
    CHI: "c359afac-3210-49e5-a930-6676d8bb188a",
    CW: "4fa12356-a891-4af1-8d75-2fe81e6dd8f7",
    Draper: "5da78932-c7e1-48b2-a099-9c302c75d7e1",
    HTN: "7bc45610-d832-4e9a-b6c3-48dfb90a3f12",
    DEFAULT: "ca3dc432-280b-4cdb-86ea-6e582f3182a9",
  };
  
  // First check if we have a hardcoded mapping
  if (CENTER_ID_MAP[centerCode]) {
    return {
      success: true,
      centerId: CENTER_ID_MAP[centerCode]
    };
  }
  
  // Try to get from API
  try {
    const connectorResponse = await fetch(new URL('/zenoti-connector', baseUrl).href, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      body: JSON.stringify({
        endpoint: 'centers',
        method: 'GET'
      })
    });
    
    const result = await connectorResponse.json();
    
    if (result.success && result.data.centers) {
      const center = result.data.centers.find((c: any) => c.code === centerCode);
      
      if (center && center.id) {
        return {
          success: true,
          centerId: center.id
        };
      }
    }
    
    // If we couldn't find the center, use default
    return {
      success: true,
      centerId: CENTER_ID_MAP.DEFAULT
    };
  } catch (error) {
    console.error('Error getting center ID:', error);
    
    // Fall back to hardcoded default
    return {
      success: true,
      centerId: CENTER_ID_MAP.DEFAULT
    };
  }
}

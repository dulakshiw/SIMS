import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import MainLayout from '../../../Components/Layouts/MainLayout';
import {
  Badge,
  Button,
  Card,
  EntityDetailsModal,
  Modal,
  PageHeader,
  SummaryCard,
  SummaryCardsGrid,
  Table,
} from '../../../Components/UI';
import { ITEM_REQUEST_STATUS, ITEM_REQUEST_STATUS_META } from '../../../utils/constants';
import { resolveSidebarVariant } from '../../../utils/helpers';
import WorkflowReportExport from '../../../Components/Inventory/WorkflowReportExport';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const PENDING_EXPORT_COLUMNS = [
  { field: 'id', label: 'Request ID' },
  { field: 'requester', label: 'Requested by' },
  { field: 'department', label: 'Department' },
  { field: 'itemName', label: 'Item requested' },
  { field: 'quantity', label: 'Quantity' },
  { field: 'inventory', label: 'Lab inventory' },
  { field: 'requestedDate', label: 'Requested date' },
  { field: 'priority', label: 'Priority' },
  { field: 'status', label: 'Status' },
];

const PENDING_EXPORT_SEARCH_FIELDS = [
  'id',
  'requester',
  'department',
  'itemName',
  'inventory',
  'priority',
  'status',
];

const ISSUED_EXPORT_COLUMNS = [
  { field: 'id', label: 'Request ID' },
  { field: 'requester', label: 'Staff member' },
  { field: 'department', label: 'Department' },
  { field: 'itemName', label: 'Item requested' },
  { field: 'quantity', label: 'Quantity' },
  { field: 'inventory', label: 'Inventory' },
  { field: 'issuedDate', label: 'Issued date' },
  { field: 'returnedDate', label: 'Returned date' },
  { field: 'status', label: 'Status' },
];

const ISSUED_EXPORT_SEARCH_FIELDS = [
  'id',
  'requester',
  'department',
  'itemName',
  'inventory',
  'status',
];

const formatRequestStatusLabel = (statusKey) =>
  ITEM_REQUEST_STATUS_META[statusKey]?.label
  || String(statusKey || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const ISSUEABLE_STATUSES = new Set([
  ITEM_REQUEST_STATUS.APPROVED_TO_ISSUE,
  'pending_issue',
]);

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || '{}');
  } catch {
    return {};
  }
};

const formatDetailValue = (value) => {
  if (value === 0) {
    return '0';
  }
  return value || '—';
};

const normalizeInventoryItem = (item = {}) => ({
  ...item,
  id: item.id ?? item.item_id,
  itemName: item.itemName || item.item_name || item.name || '—',
  itemCode: item.itemCode || item.item_code || '—',
  serialNo: item.serialNo || item.serial_no || '—',
  model: item.model || '—',
  location: item.location || '—',
  status: item.status || '—',
  ginNo: item.ginNo || item.gin_no || '—',
  value: item.value ?? '—',
  remarks: item.remarks || '',
});

const buildSearchKeywords = (searchText = '') => {
  const keywords = new Set();
  const trimmed = String(searchText || '').trim();

  if (!trimmed) {
    return [];
  }

  keywords.add(trimmed.toLowerCase());

  trimmed
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((keyword) => {
      const lower = keyword.toLowerCase();
      keywords.add(lower);
      if (lower.length > 3 && lower.endsWith('s')) {
        keywords.add(lower.slice(0, -1));
      } else if (lower.length > 2) {
        keywords.add(`${lower}s`);
      }
    });

  return [...keywords];
};

const filterItemsByKeywords = (items, searchText) => {
  const keywords = buildSearchKeywords(searchText);

  if (keywords.length === 0) {
    return items;
  }

  return items.filter((item) => {
    const name = String(item.itemName || item.item_name || item.name || '').toLowerCase();
    return keywords.some((keyword) => name.includes(keyword));
  });
};

const InchargeStaffItemRequests = () => {
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [issuedRequests, setIssuedRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalStep, setModalStep] = useState(null);
  const [matchingItems, setMatchingItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsLoadError, setItemsLoadError] = useState('');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);
  const [selectedItemDetail, setSelectedItemDetail] = useState(null);
  const [issuedItemDetail, setIssuedItemDetail] = useState(null);
  const [itemDetailLoading, setItemDetailLoading] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [actionError, setActionError] = useState('');
  const [activeViewKey, setActiveViewKey] = useState('pending');

  const loadRequests = async () => {
    try {
      setLoading(true);
      setLoadError('');

      const storedUser = getStoredUser();
      const officerUserId = Number(storedUser.id ?? 0);

      if (!Number.isInteger(officerUserId) || officerUserId <= 0) {
        setPendingRequests([]);
        setIssuedRequests([]);
        setLoadError('Your profile is missing a user id, so item requests cannot be loaded.');
        return;
      }

      const baseUrl = `${API_BASE_URL}/api/item-requests?inventoryOfficerUserId=${officerUserId}`;
      const [pendingResponse, issuedResponse] = await Promise.all([
        fetch(`${baseUrl}&inventoryOfficerScope=pending_issue`),
        fetch(`${baseUrl}&inventoryOfficerScope=issued`),
      ]);

      const [pendingData, issuedData] = await Promise.all([
        pendingResponse.json().catch(() => ({})),
        issuedResponse.json().catch(() => ({})),
      ]);

      if (!pendingResponse.ok || !pendingData.success) {
        throw new Error(pendingData.message || pendingData.error || 'Failed to load pending item requests.');
      }

      if (!issuedResponse.ok || !issuedData.success) {
        throw new Error(issuedData.message || issuedData.error || 'Failed to load issued item requests.');
      }

      setPendingRequests(pendingData.requests || []);
      setIssuedRequests(issuedData.requests || []);
    } catch (error) {
      setPendingRequests([]);
      setIssuedRequests([]);
      setLoadError(error.message || 'Failed to load item requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const pendingRows = useMemo(() => (
    pendingRequests
      .filter((request) => ISSUEABLE_STATUSES.has(String(request.approvalStatus || '').toLowerCase()))
      .map((request) => ({
        id: `REQ-${request.id}`,
        requester: request.requestedByName || '—',
        department: request.departmentName || '—',
        itemName: request.itemName || '—',
        quantity: request.quantity ?? '—',
        inventory: request.inventoryLocation || request.inventoryName || '—',
        requestedDate: request.requestedDate || '—',
        priority: request.priority || 'normal',
        status: formatRequestStatusLabel(request.approvalStatus),
        statusKey: request.approvalStatus,
        _request: request,
      }))
      .sort(
        (a, b) => String(b.requestedDate).localeCompare(String(a.requestedDate))
          || Number(b._request.id) - Number(a._request.id)
      )
  ), [pendingRequests]);

  const historyRows = useMemo(() => (
    issuedRequests
      .filter((request) => !ISSUEABLE_STATUSES.has(String(request.approvalStatus || '').toLowerCase()))
      .map((request) => ({
        id: `REQ-${request.id}`,
        requester: request.requestedByName || '—',
        department: request.departmentName || '—',
        itemName: request.itemName || '—',
        quantity: request.quantity ?? '—',
        inventory: request.inventoryLocation || request.inventoryName || '—',
        issuedDate: request.issuedDate || '—',
        returnedDate: request.returnedDate || '—',
        status: formatRequestStatusLabel(request.approvalStatus),
        statusKey: request.approvalStatus,
        _request: request,
      }))
      .sort((a, b) => {
        const dateA = a._request.issuedDate || a._request.returnedDate || a._request.requestedDate || '';
        const dateB = b._request.issuedDate || b._request.returnedDate || b._request.requestedDate || '';
        return String(dateB).localeCompare(String(dateA)) || Number(b._request.id) - Number(a._request.id);
      })
  ), [issuedRequests]);

  const canReturnSelectedRequest = selectedRequest
    && String(selectedRequest.approvalStatus || '').toLowerCase() === ITEM_REQUEST_STATUS.APPROVED;

  const statusBadge = (statusKey) => {
    const config = ITEM_REQUEST_STATUS_META[statusKey] || { label: statusKey, variant: 'secondary' };
    return <Badge label={config.label} variant={config.variant} size="sm" />;
  };

  const requestColumns = [
    { field: 'id', label: 'Request ID', sortable: true },
    { field: 'requester', label: 'Requested by', sortable: true },
    { field: 'department', label: 'Department', sortable: true },
    { field: 'itemName', label: 'Item requested', sortable: true },
    { field: 'quantity', label: 'Quantity', sortable: true },
    { field: 'inventory', label: 'Lab inventory', sortable: true },
    { field: 'requestedDate', label: 'Requested date', sortable: true },
    {
      field: 'priority',
      label: 'Priority',
      sortable: true,
      render: (value) => (
        <Badge
          label={String(value || 'normal').charAt(0).toUpperCase() + String(value || 'normal').slice(1)}
          variant={value}
          size="sm"
        />
      ),
    },
    {
      field: 'status',
      label: 'Status',
      sortable: true,
      render: (value, row) => statusBadge(row.statusKey),
    },
  ];

  const historyColumns = [
    { field: 'id', label: 'Request ID', sortable: true },
    { field: 'requester', label: 'Staff member', sortable: true },
    { field: 'department', label: 'Department', sortable: true },
    { field: 'itemName', label: 'Item requested', sortable: true },
    { field: 'quantity', label: 'Quantity', sortable: true },
    { field: 'inventory', label: 'Inventory Name', sortable: true },
    { field: 'issuedDate', label: 'Issued date', sortable: true },
    { field: 'returnedDate', label: 'Returned date', sortable: true },
    {
      field: 'status',
      label: 'Status',
      sortable: true,
      render: (value, row) => statusBadge(row.statusKey),
    },
  ];

  const activeExportConfig = activeViewKey === 'pending'
    ? {
      rows: pendingRows,
      columns: PENDING_EXPORT_COLUMNS,
      searchFields: PENDING_EXPORT_SEARCH_FIELDS,
      searchPlaceholder: 'Search by request ID, staff name, department, item, or inventory...',
      reportTitle: 'Inventory Requests — Pending issues',
      fileNamePrefix: 'inventory-requests-pending',
      dateField: 'requestedDate',
    }
    : {
      rows: historyRows,
      columns: ISSUED_EXPORT_COLUMNS,
      searchFields: ISSUED_EXPORT_SEARCH_FIELDS,
      searchPlaceholder: 'Search by request ID, staff name, department, item, or status...',
      reportTitle: 'Inventory Requests — Issued and returned',
      fileNamePrefix: 'inventory-requests-history',
      dateField: 'issuedDate',
    };

  const itemPickerColumns = [
    { field: 'itemName', label: 'Item name', sortable: true },
    { field: 'itemCode', label: 'Item code', sortable: true },
    { field: 'serialNo', label: 'Serial no.', sortable: true },
    { field: 'model', label: 'Model', sortable: true },
    { field: 'location', label: 'Location', sortable: true },
    {
      field: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => (
        <Badge
          label={String(value || '—')}
          variant={value === 'available' ? 'success' : 'secondary'}
          size="sm"
        />
      ),
    },
  ];

  const buildRequestDetailFields = (request, { includeIssueFields = false } = {}) => {
    const statusConfig = ITEM_REQUEST_STATUS_META[request.approvalStatus] || {
      label: request.approvalStatus,
    };

    const fields = [
      { label: 'Request ID', value: `REQ-${request.id}` },
      { label: 'Requested by', value: request.requestedByName },
      { label: 'Requester department', value: request.departmentName },
      { label: 'Item requested', value: request.itemName },
      { label: 'Quantity', value: request.quantity },
      { label: 'Priority', value: request.priority },
      { label: 'Inventory location', value: request.inventoryLocation },
      { label: 'Inventory name', value: request.inventoryName },
      { label: 'Lab department', value: request.inventoryDepartmentName },
      { label: 'Requested date', value: request.requestedDate },
      { label: 'Required by date', value: request.requiredByDate },
      { label: 'Lab HOD approved date', value: request.labHodApprovedDate },
      { label: 'Status', value: statusConfig.label },
      { label: 'Specifications', value: request.specification, fullWidth: true },
      { label: 'Justification', value: request.reason, fullWidth: true },
    ];

    if (includeIssueFields) {
      fields.splice(12, 0,
        { label: 'Issued date', value: request.issuedDate },
        { label: 'Returned date', value: request.returnedDate },
        { label: 'Issued inventory item ID', value: request.allocatedInventoryItemId },
        { label: 'Current item location', value: issuedItemDetail?.location },
        { label: 'Current item status', value: issuedItemDetail?.status }
      );
    }

    return fields;
  };

  const buildInventoryItemDetailFields = (item) => [
    { label: 'Item name', value: item.itemName },
    { label: 'Item code', value: item.itemCode },
    { label: 'Serial no.', value: item.serialNo },
    { label: 'Serial no. 2', value: item.serialNo2 },
    { label: 'Model', value: item.model },
    { label: 'Location', value: item.location },
    { label: 'Status', value: item.status },
    { label: 'GIN no.', value: item.ginNo },
    { label: 'Value', value: item.value },
    { label: 'Purchase date', value: item.purchaseDate },
    { label: 'Inventory', value: item.inventoryName },
    { label: 'Remarks', value: item.remarks, fullWidth: true },
  ];

  const resetModalState = () => {
    setModalStep(null);
    setSelectedRequest(null);
    setMatchingItems([]);
    setItemsLoadError('');
    setSelectedInventoryItem(null);
    setSelectedItemDetail(null);
    setIssuedItemDetail(null);
    setActionError('');
  };

  const closeAllModals = () => {
    if (isIssuing || isReturning || itemDetailLoading) {
      return;
    }
    resetModalState();
  };

  const handleViewPendingDetails = (row) => {
    setActionError('');
    setSelectedRequest(row._request);
    setModalStep('request');
  };

  const loadIssuedInventoryItem = async (request) => {
    const itemId = Number(request.allocatedInventoryItemId ?? 0);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      setIssuedItemDetail(null);
      return;
    }

    try {
      setItemDetailLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/items/${itemId}`);
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        setIssuedItemDetail(normalizeInventoryItem(data.item));
      } else {
        setIssuedItemDetail(null);
      }
    } catch {
      setIssuedItemDetail(null);
    } finally {
      setItemDetailLoading(false);
    }
  };

  const handleViewIssuedDetails = async (row) => {
    setActionError('');
    setSelectedRequest(row._request);
    setIssuedItemDetail(null);
    setModalStep('issued-detail');
    await loadIssuedInventoryItem(row._request);
  };

  const loadMatchingItems = async (request) => {
    const inventoryId = Number(request.requestedInventoryId ?? 0);
    const search = String(request.itemName || '').trim();

    if (!Number.isInteger(inventoryId) || inventoryId <= 0) {
      setItemsLoadError('This request is missing a lab inventory reference.');
      setMatchingItems([]);
      return;
    }

    if (!search) {
      setItemsLoadError('This request is missing an item name to search inventory.');
      setMatchingItems([]);
      return;
    }

    try {
      setItemsLoading(true);
      setItemsLoadError('');

      const params = new URLSearchParams({
        inventoryId: String(inventoryId),
        search,
      });
      const response = await fetch(`${API_BASE_URL}/api/items?${params.toString()}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to load matching inventory items.');
      }

      let items = (data.items || []).map(normalizeInventoryItem);

      if (items.length === 0) {
        const allResponse = await fetch(`${API_BASE_URL}/api/items?inventoryId=${inventoryId}`);
        const allData = await allResponse.json().catch(() => ({}));

        if (allResponse.ok && allData.success) {
          items = filterItemsByKeywords(
            (allData.items || []).map(normalizeInventoryItem),
            search
          );
        }
      }

      setMatchingItems(items);
    } catch (error) {
      setMatchingItems([]);
      setItemsLoadError(error.message || 'Failed to load matching inventory items.');
    } finally {
      setItemsLoading(false);
    }
  };

  const handleOpenIssuePicker = async () => {
    if (!selectedRequest) {
      return;
    }

    setActionError('');
    setSelectedInventoryItem(null);
    setSelectedItemDetail(null);
    setModalStep('pick-item');
    await loadMatchingItems(selectedRequest);
  };

  const loadInventoryItemDetail = async (item) => {
    try {
      setItemDetailLoading(true);
      setActionError('');

      const response = await fetch(`${API_BASE_URL}/api/items/${item.id}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to load item details.');
      }

      const detail = normalizeInventoryItem(data.item || item);
      setSelectedInventoryItem(detail);
      setSelectedItemDetail(detail);
      setModalStep('item-detail');
    } catch (error) {
      setActionError(error.message || 'Failed to load item details.');
    } finally {
      setItemDetailLoading(false);
    }
  };

  const handleConfirmIssue = async () => {
    const itemToIssue = selectedInventoryItem || selectedItemDetail;

    if (!selectedRequest || !itemToIssue?.id) {
      setActionError('Select an inventory item to issue.');
      return;
    }

    const storedUser = getStoredUser();
    const issuerUserId = Number(storedUser.id ?? 0);

    if (!Number.isInteger(issuerUserId) || issuerUserId <= 0) {
      setActionError('Your session is missing a user id. Please sign in again.');
      return;
    }

    const confirmed = window.confirm(
      `Issue "${itemToIssue.itemName}" to ${selectedRequest.requestedByName || 'the requester'}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsIssuing(true);
      setActionError('');

      const response = await fetch(`${API_BASE_URL}/api/item-requests/${selectedRequest.id}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuerUserId,
          inventoryItemId: itemToIssue.id,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to issue item.');
      }

      resetModalState();
      await loadRequests();
      window.alert(data.message || 'Item issued successfully.');
    } catch (error) {
      setActionError(error.message || 'Failed to issue item.');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleReturnItem = async () => {
    if (!selectedRequest) {
      return;
    }

    const storedUser = getStoredUser();
    const returnerUserId = Number(storedUser.id ?? 0);

    if (!Number.isInteger(returnerUserId) || returnerUserId <= 0) {
      setActionError('Your session is missing a user id. Please sign in again.');
      return;
    }

    const confirmed = window.confirm(
      `Return the issued item for request REQ-${selectedRequest.id}? It will be assigned back to its lab inventory.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsReturning(true);
      setActionError('');

      const response = await fetch(`${API_BASE_URL}/api/item-requests/${selectedRequest.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnerUserId }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to return item.');
      }

      resetModalState();
      await loadRequests();
      window.alert(data.message || 'Item returned successfully.');
    } catch (error) {
      setActionError(error.message || 'Failed to return item.');
    } finally {
      setIsReturning(false);
    }
  };

  const outstandingIssuedCount = useMemo(
    () => historyRows.filter((row) => row.statusKey === ITEM_REQUEST_STATUS.APPROVED).length,
    [historyRows]
  );

  const returnedCount = useMemo(
    () => historyRows.filter((row) => row.statusKey === ITEM_REQUEST_STATUS.RETURNED).length,
    [historyRows]
  );

  const summaryCards = [
    {
      key: 'pending',
      title: 'Pending issues',
      description: 'Staff item requests approved by both HODs and ready to issue.',
      count: pendingRows.length,
      icon: 'pending_actions',
    },
    {
      key: 'issued',
      title: 'Issued items',
      description: 'All other requests including outstanding issued and returned items.',
      count: historyRows.length,
      icon: 'inventory_2',
    },
  ];

  const activeViewSummary = summaryCards.find((card) => card.key === activeViewKey) || summaryCards[0];

  const activeTableRows = activeViewKey === 'pending' ? pendingRows : historyRows;
  const activeTableColumns = activeViewKey === 'pending' ? requestColumns : historyColumns;
  const handleActiveRowClick = activeViewKey === 'pending' ? handleViewPendingDetails : handleViewIssuedDetails;

  const handleSelectSummary = (cardKey) => {
    setActiveViewKey(cardKey);
    resetModalState();
  };

  const tableSubtitle = () => {
    if (loading) {
      return 'Loading item requests…';
    }
    if (loadError) {
      return loadError;
    }
    if (activeTableRows.length === 0) {
      return `No requests in ${activeViewSummary.title.toLowerCase()}.`;
    }
    if (activeViewKey === 'issued') {
      return `${activeTableRows.length} request${activeTableRows.length === 1 ? '' : 's'} (${outstandingIssuedCount} issued, ${returnedCount} returned).`;
    }
    return `${activeTableRows.length} request${activeTableRows.length === 1 ? '' : 's'} approved to issue.`;
  };

  const itemPickerRows = useMemo(
    () => matchingItems.map((item) => ({
      ...item,
      _item: item,
    })),
    [matchingItems]
  );

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title="Inventory Requests"
        subtitle="Review pending issues and track issued or returned staff item requests."
      />

      <div className="p-6 space-y-6">
        {loadError ? (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {loadError}
          </div>
        ) : null}

        <SummaryCardsGrid columns={2}>
          {summaryCards.map((card) => (
            <SummaryCard
              key={card.key}
              title={card.title}
              count={card.count}
              description={card.description}
              icon={card.icon}
              loading={loading}
              active={activeViewKey === card.key}
              onClick={() => handleSelectSummary(card.key)}
            />
          ))}
        </SummaryCardsGrid>

        <Card title={activeViewSummary.title} subtitle={tableSubtitle()} icon={activeViewSummary.icon}>
          <WorkflowReportExport
            rows={activeExportConfig.rows}
            columns={activeExportConfig.columns}
            reportTitle={activeExportConfig.reportTitle}
            fileNamePrefix={activeExportConfig.fileNamePrefix}
            dateField={activeExportConfig.dateField}
            searchFields={activeExportConfig.searchFields}
            searchPlaceholder={activeExportConfig.searchPlaceholder}
            disabled={loading}
          />
          <Table
            columns={activeTableColumns}
            data={activeTableRows}
            onRowClick={handleActiveRowClick}
            searchable
            loading={loading}
            paginated={activeTableRows.length > 10}
            itemsPerPage={10}
          />
        </Card>

        <Modal
          isOpen={modalStep === 'request'}
          onClose={closeAllModals}
          title="Item request details"
          size="lg"
          footer={(
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={closeAllModals}>
                Close
              </Button>
              <Button variant="primary" onClick={handleOpenIssuePicker}>
                Issue
              </Button>
            </div>
          )}
        >
          <div className="space-y-4">
            <div className="bg-background-light p-4 rounded-lg">
              <p className="text-sm text-text-light">Item requested</p>
              <p className="text-lg font-semibold text-text-dark">{formatDetailValue(selectedRequest?.itemName)}</p>
              <p className="mt-1 text-sm text-text-light">
                Requested by {formatDetailValue(selectedRequest?.requestedByName)}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {(selectedRequest ? buildRequestDetailFields(selectedRequest) : []).map((detail) => (
                <div key={detail.label} className={detail.fullWidth ? 'md:col-span-2' : ''}>
                  <p className="text-text-light">{detail.label}</p>
                  <p className="font-semibold text-text-dark whitespace-pre-wrap">{formatDetailValue(detail.value)}</p>
                </div>
              ))}
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={modalStep === 'issued-detail'}
          onClose={closeAllModals}
          title="Issued item details"
          size="lg"
          footer={(
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={closeAllModals} disabled={isReturning || itemDetailLoading}>
                Close
              </Button>
              {canReturnSelectedRequest ? (
                <Button variant="primary" onClick={handleReturnItem} disabled={isReturning || itemDetailLoading}>
                  {isReturning ? 'Returning…' : 'Return item'}
                </Button>
              ) : null}
            </div>
          )}
        >
          <div className="space-y-4">
            {actionError ? (
              <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {actionError}
              </div>
            ) : null}

            <div className="bg-background-light p-4 rounded-lg">
              <p className="text-sm text-text-light">Issued item request</p>
              <p className="text-lg font-semibold text-text-dark">{formatDetailValue(selectedRequest?.itemName)}</p>
              <p className="mt-1 text-sm text-text-light">
                Issued to {formatDetailValue(selectedRequest?.requestedByName)}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {(selectedRequest ? buildRequestDetailFields(selectedRequest, { includeIssueFields: true }) : []).map((detail) => (
                <div key={detail.label} className={detail.fullWidth ? 'md:col-span-2' : ''}>
                  <p className="text-text-light">{detail.label}</p>
                  <p className="font-semibold text-text-dark whitespace-pre-wrap">{formatDetailValue(detail.value)}</p>
                </div>
              ))}
            </div>

            {issuedItemDetail ? (
              <div className="rounded-lg border border-border-lighter p-4 space-y-3">
                <p className="text-sm font-semibold text-text-dark">Linked inventory item</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {buildInventoryItemDetailFields(issuedItemDetail).map((detail) => (
                    <div key={detail.label} className={detail.fullWidth ? 'md:col-span-2' : ''}>
                      <p className="text-text-light">{detail.label}</p>
                      <p className="font-semibold text-text-dark whitespace-pre-wrap">{formatDetailValue(detail.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Modal>

        <Modal
          isOpen={modalStep === 'pick-item'}
          onClose={closeAllModals}
          title="Select inventory item to issue"
          size="full"
          footer={(
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={() => setModalStep('request')} disabled={isIssuing || itemsLoading}>
                Back
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmIssue}
                disabled={isIssuing || !selectedInventoryItem}
              >
                {isIssuing ? 'Issuing…' : 'Issue selected item'}
              </Button>
            </div>
          )}
        >
          <div className="space-y-4">
            {actionError ? (
              <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {actionError}
              </div>
            ) : null}

            <div className="bg-background-light p-4 rounded-lg text-sm">
              <p className="text-text-light">Request</p>
              <p className="font-semibold text-text-dark">
                {formatDetailValue(selectedRequest?.itemName)} × {formatDetailValue(selectedRequest?.quantity)}
              </p>
              <p className="mt-1 text-text-light">
                Inventory items matching any keyword from: {formatDetailValue(selectedRequest?.itemName)}
              </p>
            </div>

            {itemsLoadError ? (
              <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {itemsLoadError}
              </div>
            ) : null}

            <Table
              columns={itemPickerColumns}
              data={itemPickerRows}
              onRowClick={(row) => {
                setSelectedInventoryItem(row._item);
                loadInventoryItemDetail(row._item);
              }}
              loading={itemsLoading}
              searchable
              paginated={itemPickerRows.length > 8}
              itemsPerPage={8}
            />

            {!itemsLoading && !itemsLoadError && itemPickerRows.length === 0 ? (
              <p className="text-sm text-text-light">
                No inventory items matched the requested item name in this lab inventory.
              </p>
            ) : null}
          </div>
        </Modal>

        <EntityDetailsModal
          isOpen={modalStep === 'item-detail'}
          onClose={() => {
            if (isIssuing || itemDetailLoading) {
              return;
            }
            setModalStep('pick-item');
            setSelectedItemDetail(null);
          }}
          title="Inventory item details"
          selectedLabel="Item"
          selectedName={selectedItemDetail?.itemName}
          details={selectedItemDetail ? buildInventoryItemDetailFields(selectedItemDetail) : []}
          size="lg"
          footer={(
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setModalStep('pick-item');
                  setSelectedItemDetail(null);
                }}
                disabled={isIssuing || itemDetailLoading}
              >
                Back to list
              </Button>
              <Button variant="primary" onClick={handleConfirmIssue} disabled={isIssuing || itemDetailLoading}>
                {isIssuing ? 'Issuing…' : 'Issue this item'}
              </Button>
            </div>
          )}
        />
      </div>
    </MainLayout>
  );
};

export default InchargeStaffItemRequests;

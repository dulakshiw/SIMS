import React, { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../../Components/Layouts/MainLayout';
import { Badge, Button, Card, Modal, PageHeader, SummaryCard, SummaryCardsGrid, Table } from '../../../Components/UI';
import {
  ITEM_REQUEST_STATUS,
  ITEM_REQUEST_STATUS_META,
} from '../../../utils/constants';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const STAFF_HISTORY_EXCLUDED_STATUSES = new Set([
  ITEM_REQUEST_STATUS.PENDING_REQUESTER_HOD,
  ITEM_REQUEST_STATUS.PENDING_HOD,
  ITEM_REQUEST_STATUS.CANCELLED,
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

const getReturnedDate = (request) => {
  const status = String(request.approvalStatus || '').toLowerCase();

  if (status === ITEM_REQUEST_STATUS.REJECTED) {
    return request.rejectionDate || '—';
  }

  if (status === ITEM_REQUEST_STATUS.APPROVED || status === ITEM_REQUEST_STATUS.APPROVED_BY_HOD) {
    return request.issuedDate || request.labHodApprovedDate || request.hodApprovedDate || '—';
  }

  if (status === ITEM_REQUEST_STATUS.RETURNED) {
    return request.returnedDate || '—';
  }

  if (status === ITEM_REQUEST_STATUS.PENDING_LAB_HOD) {
    return request.requesterHodRecommendedDate || '—';
  }

  if (status === ITEM_REQUEST_STATUS.APPROVED_TO_ISSUE || status === ITEM_REQUEST_STATUS.PENDING_ISSUE) {
    return request.labHodApprovedDate || '—';
  }

  return request.requesterHodRecommendedDate
    || request.rejectionDate
    || request.labHodApprovedDate
    || '—';
};

const HodStaffItemRequests = () => {
  const [staffItemRequests, setStaffItemRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeViewKey, setActiveViewKey] = useState('active');

  const loadRequests = async () => {
    try {
      setLoading(true);
      setLoadError('');

      const storedUser = getStoredUser();
      const hodUserId = Number(storedUser.id ?? 0);

      if (!Number.isInteger(hodUserId) || hodUserId <= 0) {
        setStaffItemRequests([]);
        setLoadError('Your profile is missing a user id, so staff item requests cannot be loaded.');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/item-requests?hodUserId=${hodUserId}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to load staff item requests.');
      }

      setStaffItemRequests(data.requests || []);
    } catch (error) {
      setStaffItemRequests([]);
      setLoadError(error.message || 'Failed to load item requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const historyRows = useMemo(() => {
    return staffItemRequests
      .filter((request) => !STAFF_HISTORY_EXCLUDED_STATUSES.has(String(request.approvalStatus || '').toLowerCase()))
      .map((request) => ({
        id: request.id,
        staffName: request.requestedByName || '—',
        itemName: request.itemName || '—',
        quantity: request.quantity ?? '—',
        requestedDate: request.requestedDate || '—',
        returnedDate: getReturnedDate(request),
        statusKey: request.approvalStatus,
        _request: request,
      }))
      .sort(
        (a, b) => String(b.requestedDate).localeCompare(String(a.requestedDate)) || b.id - a.id
      );
  }, [staffItemRequests]);

  const activeRows = useMemo(
    () => historyRows.filter((row) => {
      const status = String(row.statusKey || '').toLowerCase();
      return [
        ITEM_REQUEST_STATUS.PENDING_LAB_HOD,
        ITEM_REQUEST_STATUS.APPROVED_TO_ISSUE,
        ITEM_REQUEST_STATUS.PENDING_ISSUE,
        ITEM_REQUEST_STATUS.APPROVED,
      ].includes(status);
    }),
    [historyRows]
  );

  const returnedRows = useMemo(
    () => historyRows.filter((row) => String(row.statusKey || '').toLowerCase() === ITEM_REQUEST_STATUS.RETURNED),
    [historyRows]
  );

  const rejectedRows = useMemo(
    () => historyRows.filter((row) => String(row.statusKey || '').toLowerCase() === ITEM_REQUEST_STATUS.REJECTED),
    [historyRows]
  );

  const summaryCards = [
    {
      key: 'active',
      title: 'In progress / Issued',
      description: 'Requests forwarded to lab HOD, awaiting issue, or currently issued.',
      count: activeRows.length,
      icon: 'forward',
    },
    {
      key: 'returned',
      title: 'Returned',
      description: 'Items returned to stores by the inventory officer.',
      count: returnedRows.length,
      icon: 'undo',
    },
    {
      key: 'rejected',
      title: 'Rejected',
      description: 'Requests rejected during the approval workflow.',
      count: rejectedRows.length,
      icon: 'cancel',
    },
  ];

  const activeViewSummary = summaryCards.find((card) => card.key === activeViewKey) || summaryCards[0];

  const activeTableRows = activeViewKey === 'active'
    ? activeRows
    : activeViewKey === 'returned'
      ? returnedRows
      : rejectedRows;

  const statusBadge = (statusKey) => {
    const config = ITEM_REQUEST_STATUS_META[statusKey] || { label: statusKey, variant: 'secondary' };
    return <Badge label={config.label} variant={config.variant} size="sm" />;
  };

  const columns = [
    { field: 'staffName', label: 'Staff member', sortable: true },
    { field: 'itemName', label: 'Item requested', sortable: true },
    { field: 'quantity', label: 'Quantity', sortable: true },
    { field: 'requestedDate', label: 'Requested date', sortable: true },
    { field: 'returnedDate', label: 'Returned date', sortable: true },
    {
      field: 'statusKey',
      label: 'Status',
      sortable: true,
      render: (value) => statusBadge(value),
    },
  ];

  const buildDetailFields = (request) => {
    const statusConfig = ITEM_REQUEST_STATUS_META[request.approvalStatus] || {
      label: request.approvalStatus,
    };

    return [
      { label: 'Request ID', value: request.id },
      { label: 'Staff member', value: request.requestedByName },
      { label: 'Item requested', value: request.itemName },
      { label: 'Quantity', value: request.quantity },
      { label: 'Priority', value: request.priority },
      { label: 'Inventory location', value: request.inventoryLocation },
      { label: 'Inventory name', value: request.inventoryName },
      { label: 'Lab department', value: request.inventoryDepartmentName },
      { label: 'Requester department', value: request.departmentName },
      { label: 'Requested date', value: request.requestedDate },
      { label: 'Required by date', value: request.requiredByDate },
      { label: 'Returned date', value: getReturnedDate(request) },
      { label: 'Recommended date', value: request.requesterHodRecommendedDate },
      { label: 'Approved date', value: request.labHodApprovedDate || request.hodApprovedDate },
      { label: 'Rejected date', value: request.rejectionDate },
      { label: 'Status', value: statusConfig.label },
      { label: 'Rejection reason', value: request.rejectionReason, fullWidth: true },
      { label: 'Specifications', value: request.specification, fullWidth: true },
      { label: 'Justification', value: request.reason, fullWidth: true },
    ];
  };

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedRequest(null);
  };

  const handleViewDetails = (row) => {
    setSelectedRequest(row._request);
    setIsDetailModalOpen(true);
  };

  const handleSelectSummary = (cardKey) => {
    setActiveViewKey(cardKey);
    closeDetailModal();
  };

  const tableSubtitle = () => {
    if (loading) {
      return 'Loading staff item requests…';
    }
    if (activeTableRows.length === 0) {
      return `No ${activeViewSummary.title.toLowerCase()} requests yet.`;
    }
    return `${activeTableRows.length} request${activeTableRows.length === 1 ? '' : 's'} in this list.`;
  };

  return (
    <MainLayout variant="hod">
      <PageHeader
        title="Requests by Staff"
        subtitle="View item requests submitted by your department staff after HOD recommendation, approval, or rejection."
      />

      <div className="p-6 space-y-6">
        {loadError ? (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {loadError}
          </div>
        ) : null}

        <SummaryCardsGrid columns={3}>
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
          <Table
            columns={columns}
            data={activeTableRows}
            onRowClick={handleViewDetails}
            searchable
            loading={loading}
            paginated={activeTableRows.length > 10}
            itemsPerPage={10}
          />
        </Card>

        <Modal
          isOpen={isDetailModalOpen}
          onClose={closeDetailModal}
          title="Item request details"
          size="lg"
          footer={(
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={closeDetailModal}>
                Close
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
              {(selectedRequest ? buildDetailFields(selectedRequest) : []).map((detail) => (
                <div key={detail.label} className={detail.fullWidth ? 'md:col-span-2' : ''}>
                  <p className="text-text-light">{detail.label}</p>
                  <p className="font-semibold text-text-dark whitespace-pre-wrap">{formatDetailValue(detail.value)}</p>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
};

export default HodStaffItemRequests;

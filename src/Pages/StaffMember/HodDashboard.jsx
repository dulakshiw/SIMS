import React, { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../Components/Layouts/MainLayout';
import { Badge, Button, Card, Modal, PageHeader, Table } from '../../Components/UI';
import {
  ACCOUNT_REQUEST_STATUS,
  ACCOUNT_REQUEST_STATUS_META,
  INVENTORY_REQUEST_STATUS_META,
  INVENTORY_REQUEST_TYPE_LABELS,
  ROLE_HIERARCHY,
} from '../../utils/constants';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const ACCOUNT_REQUEST_LABELS = {
  account_creation: 'New account',
  deactivation: 'Deactivation',
};

const HOD_PENDING_INVENTORY_STATUSES = new Set(['pending_hod', 'pending_staff']);

const INVENTORY_DOWNSTREAM_STATUSES = new Set([
  'approved_by_hod',
  'pending_registrar',
  'approved_by_registrar',
  'pending_admin',
  'approved_by_admin',
  'completed',
]);

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || '{}');
  } catch {
    return {};
  }
};

const getDepartmentName = (user) => user.departmentName || user.department || 'Department';

const mapPendingRows = (rows) =>
  [...rows].sort(
    (a, b) => String(b.requestedDate).localeCompare(String(a.requestedDate)) || a.queueKey.localeCompare(b.queueKey)
  );

const formatDetailValue = (value) => {
  if (value === 0) {
    return '0';
  }
  return value || '—';
};

const HodDashboard = () => {
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [accountRequests, setAccountRequests] = useState([]);
  const [inventoryRequests, setInventoryRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingKey, setActionLoadingKey] = useState(null);
  const [error, setError] = useState('');
  const [inventoryLoadError, setInventoryLoadError] = useState('');
  const [activeReviewTab, setActiveReviewTab] = useState('accounts');
  const [selectedReviewRow, setSelectedReviewRow] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const departmentName = getDepartmentName(currentUser);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError('');
      setInventoryLoadError('');
      const storedUser = getStoredUser();
      setCurrentUser(storedUser);

      const hodUserId = Number(storedUser.id ?? 0);
      const accountUrl = `${API_BASE_URL}/api/account-requests?requestType=account_creation,deactivation`;
      const inventoryUrl = Number.isInteger(hodUserId) && hodUserId > 0
        ? `${API_BASE_URL}/api/inventory-creation-requests?hodUserId=${hodUserId}`
        : null;

      const accountResponse = await fetch(accountUrl);
      const accountData = await accountResponse.json().catch(() => ({}));

      if (!accountResponse.ok || !accountData.success) {
        throw new Error(accountData.message || accountData.error || 'Failed to load account requests.');
      }

      setAccountRequests(accountData.requests || []);

      if (inventoryUrl) {
        try {
          const inventoryResponse = await fetch(inventoryUrl);
          const inventoryData = await inventoryResponse.json().catch(() => ({}));

          if (!inventoryResponse.ok || !inventoryData.success) {
            setInventoryRequests([]);
            setInventoryLoadError(inventoryData.message || inventoryData.error || 'Failed to load inventory creation requests.');
          } else {
            setInventoryRequests(inventoryData.requests || []);
          }
        } catch (invErr) {
          setInventoryRequests([]);
          setInventoryLoadError(invErr.message || 'Failed to load inventory creation requests.');
        }
      } else {
        setInventoryRequests([]);
        if (!hodUserId) {
          setInventoryLoadError('Your profile is missing a user id, so inventory requests assigned to you cannot be loaded.');
        }
      }
    } catch (loadError) {
      setAccountRequests([]);
      setInventoryRequests([]);
      setError(loadError.message || 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const departmentKey = String(departmentName).trim().toLowerCase();

  const departmentAccountRequests = useMemo(() => {
    if (!departmentKey || departmentKey === 'department') {
      return [];
    }

    return accountRequests.filter(
      (request) => String(request.department || '').trim().toLowerCase() === departmentKey
    );
  }, [accountRequests, departmentKey]);

  const departmentInventoryRequests = useMemo(() => {
    if (!departmentKey || departmentKey === 'department') {
      return [];
    }

    return inventoryRequests.filter(
      (request) => String(request.department || '').trim().toLowerCase() === departmentKey
    );
  }, [inventoryRequests, departmentKey]);

  const pendingAccountRows = useMemo(() => {
    const rows = departmentAccountRequests
      .filter((r) => r.approvalStatus === ACCOUNT_REQUEST_STATUS.PENDING_DEPT_HEAD)
      .map((r) => ({
        queueKey: `acc:${r.id}`,
        source: 'account',
        id: r.id,
        requestLabel: ACCOUNT_REQUEST_LABELS[r.requestType] || r.requestType || 'Account',
        requestedBy: r.name || '—',
        location: '—',
        requestedDate: r.requestedDate || '',
        statusKey: r.approvalStatus,
        statusKind: 'account',
        _account: r,
      }));

    return mapPendingRows(rows);
  }, [departmentAccountRequests]);

  const pendingInventoryRows = useMemo(() => {
    const rows = departmentInventoryRequests
      .filter((r) => HOD_PENDING_INVENTORY_STATUSES.has(String(r.approvalStatus || '').toLowerCase()))
      .map((r) => {
        const typeLabel = INVENTORY_REQUEST_TYPE_LABELS[r.requestType] || r.requestType || 'Inventory';
        return {
          queueKey: `inv:${r.id}`,
          source: 'inventory',
          id: r.id,
          requestLabel: typeLabel,
          requestedBy: r.requestedByName || '—',
          location: r.location || '—',
          requestedDate: r.requestedDate || '',
          statusKey: r.approvalStatus,
          statusKind: 'inventory',
          _inventory: r,
        };
      });

    return mapPendingRows(rows);
  }, [departmentInventoryRequests]);

  const pendingReviewCount = pendingAccountRows.length + pendingInventoryRows.length;

  const forwardedCount = useMemo(() => {
    const accounts = departmentAccountRequests.filter(
      (r) => r.approvalStatus === ACCOUNT_REQUEST_STATUS.APPROVED_BY_ADMIN
    ).length;
    const inventories = departmentInventoryRequests.filter((r) =>
      INVENTORY_DOWNSTREAM_STATUSES.has(String(r.approvalStatus || '').toLowerCase())
    ).length;
    return accounts + inventories;
  }, [departmentAccountRequests, departmentInventoryRequests]);

  const rejectedCount = useMemo(() => {
    const accounts = departmentAccountRequests.filter(
      (r) => r.approvalStatus === ACCOUNT_REQUEST_STATUS.REJECTED
    ).length;
    const inventories = departmentInventoryRequests.filter(
      (r) => String(r.approvalStatus || '').toLowerCase() === 'rejected'
    ).length;
    return accounts + inventories;
  }, [departmentAccountRequests, departmentInventoryRequests]);

  const statusBadge = (row) => {
    if (row.statusKind === 'account') {
      const config = ACCOUNT_REQUEST_STATUS_META[row.statusKey] || { label: row.statusKey, variant: 'secondary' };
      return <Badge label={config.label} variant={config.variant} size="sm" />;
    }
    const config = INVENTORY_REQUEST_STATUS_META[row.statusKey] || { label: row.statusKey, variant: 'secondary' };
    return <Badge label={config.label} variant={config.variant} size="sm" />;
  };

  const accountColumns = [
    {
      field: 'requestLabel',
      label: 'Request type',
      sortable: true,
      render: (value) => <Badge label={value} variant="info" size="sm" />,
    },
    { field: 'requestedBy', label: 'Requested by', sortable: true },
    { field: 'requestedDate', label: 'Requested date', sortable: true },
    {
      field: 'statusKey',
      label: 'Status',
      sortable: true,
      render: (_value, row) => statusBadge(row),
    },
  ];

  const inventoryColumns = [
    {
      field: 'requestLabel',
      label: 'Request type',
      sortable: true,
      render: (value) => <Badge label={value} variant="info" size="sm" />,
    },
    { field: 'requestedBy', label: 'Requested by', sortable: true },
    { field: 'location', label: 'Location', sortable: true },
    { field: 'requestedDate', label: 'Requested date', sortable: true },
    {
      field: 'statusKey',
      label: 'Status',
      sortable: true,
      render: (_value, row) => statusBadge(row),
    },
  ];

  const updateAccountStatus = (requestId, nextStatus) => {
    setAccountRequests((prev) => prev.map((request) => (
      request.id === requestId
        ? { ...request, approvalStatus: nextStatus }
        : request
    )));
  };

  const updateInventoryStatus = (requestId, nextStatus) => {
    setInventoryRequests((prev) => prev.map((request) => (
      request.id === requestId
        ? { ...request, approvalStatus: nextStatus }
        : request
    )));
  };

  const handleAccountAction = async (request, actionType) => {
    const isApprove = actionType === 'approve';
    const isDeactivation = request.requestType === 'deactivation';
    const confirmed = window.confirm(
      isApprove
        ? (
          isDeactivation
            ? `Approve deactivation of ${request.name}'s account? Their account will be set to inactive.`
            : `Approve ${request.name}'s new account request and activate their account?`
        )
        : (
          isDeactivation
            ? `Reject ${request.name}'s deactivation request?`
            : `Reject ${request.name}'s new account request?`
        )
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoadingKey(`acc:${request.id}`);
      const response = await fetch(
        `${API_BASE_URL}/api/account-requests/${request.id}/${isApprove ? 'approve' : 'reject'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isApprove
              ? { approverRole: 'head_of_department', approverUserId: currentUser.id }
              : { reason: 'Rejected by Head of Department' }
          ),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || `Failed to ${actionType} request.`);
      }

      updateAccountStatus(
        request.id,
        isApprove ? ACCOUNT_REQUEST_STATUS.APPROVED_BY_ADMIN : ACCOUNT_REQUEST_STATUS.REJECTED
      );
      setIsDetailModalOpen(false);
      setSelectedReviewRow(null);
    } catch (actionError) {
      window.alert(actionError.message || `Failed to ${actionType} request.`);
    } finally {
      setActionLoadingKey(null);
    }
  };

  const handleInventoryAction = async (request, actionType) => {
    const isApprove = actionType === 'approve';
    const typeLabel = INVENTORY_REQUEST_TYPE_LABELS[request.requestType] || 'This inventory request';
    const isAddExisting = request.requestType === 'add_inventory';
    const isChangeIncharge = request.requestType === 'change_incharge';
    const confirmed = window.confirm(
      isApprove
        ? (
          isChangeIncharge
            ? `Approve the officer change for "${request.name}" (${typeLabel}) and assign the new inventory officer?`
            : isAddExisting
              ? `Approve "${request.name}" (${typeLabel}) and activate it in the system?`
              : `Approve "${request.name}" (${typeLabel}) and send it to the registrar for the next step?`
        )
        : `Reject the inventory request "${request.name}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoadingKey(`inv:${request.id}`);
      const hodUserId = Number(currentUser.id ?? 0);
      const url = isApprove
        ? `${API_BASE_URL}/api/inventory-creation-requests/${request.id}/approve-hod`
        : `${API_BASE_URL}/api/inventory-creation-requests/${request.id}/reject`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isApprove
            ? { approverUserId: hodUserId }
            : { approverUserId: hodUserId, reason: 'Rejected by Head of Department' }
        ),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || `Failed to ${actionType} inventory request.`);
      }

      updateInventoryStatus(
        request.id,
        isApprove ? String(data.approvalStatus || '').toLowerCase() : 'rejected'
      );
      setIsDetailModalOpen(false);
      setSelectedReviewRow(null);
    } catch (actionError) {
      window.alert(actionError.message || `Failed to ${actionType} inventory request.`);
    } finally {
      setActionLoadingKey(null);
    }
  };

  const handleAction = (row, actionType) => {
    if (!row) {
      return;
    }
    if (row.source === 'account') {
      handleAccountAction(row._account, actionType);
      return;
    }
    handleInventoryAction(row._inventory, actionType);
  };

  const closeDetailModal = () => {
    if (actionLoadingKey !== null) {
      return;
    }
    setIsDetailModalOpen(false);
    setSelectedReviewRow(null);
  };

  const handleViewRowDetails = (row) => {
    setSelectedReviewRow(row);
    setIsDetailModalOpen(true);
  };

  const buildAccountDetailFields = (request) => {
    const isDeactivation = request.requestType === 'deactivation';
    const statusConfig = ACCOUNT_REQUEST_STATUS_META[request.approvalStatus] || {
      label: request.approvalStatus,
    };

    return [
      {
        label: 'Request type',
        value: ACCOUNT_REQUEST_LABELS[request.requestType] || request.requestType,
      },
      { label: 'Name', value: request.name },
      { label: 'Email', value: request.email },
      {
        label: isDeactivation ? 'Current role' : 'Requested role',
        value: ROLE_HIERARCHY[request.requestedRole]?.label || request.requestedRole,
      },
      { label: 'Department', value: request.department },
      { label: 'Designation', value: request.designation },
      { label: 'Mobile number', value: request.mobileNo },
      { label: 'Office extension', value: request.officeExtNo },
      ...(isDeactivation
        ? [{
          label: 'Current account status',
          value: request.userStatus
            ? request.userStatus.charAt(0).toUpperCase() + request.userStatus.slice(1)
            : '—',
        }]
        : []),
      { label: 'Requested date', value: request.requestedDate },
      { label: 'Status', value: statusConfig.label },
    ];
  };

  const buildInventoryDetailFields = (request) => {
    const statusConfig = INVENTORY_REQUEST_STATUS_META[request.approvalStatus] || {
      label: request.approvalStatus,
    };
    const typeLabel = INVENTORY_REQUEST_TYPE_LABELS[request.requestType] || request.requestType;

    const officerFields = request.requestType === 'change_incharge'
      ? [
        { label: 'Current officer', value: request.previousInchargeName || request.requestedByName },
        { label: 'Proposed officer', value: request.inchargeName },
      ]
      : [{ label: 'Inventory officer', value: request.inchargeName }];

    return [
      { label: 'Request type', value: typeLabel },
      { label: 'Inventory name', value: request.name },
      { label: 'Department', value: request.department },
      { label: 'Location', value: request.location },
      { label: 'Requested by', value: request.requestedByName },
      ...officerFields,
      { label: 'Requested date', value: request.requestedDate },
      { label: 'Status', value: statusConfig.label },
      { label: 'Reason', value: request.reason, fullWidth: true },
    ];
  };

  const detailModalTitle = selectedReviewRow
    ? (
      selectedReviewRow.source === 'account'
        ? `${ACCOUNT_REQUEST_LABELS[selectedReviewRow._account?.requestType] || 'Account'} request`
        : `${INVENTORY_REQUEST_TYPE_LABELS[selectedReviewRow._inventory?.requestType] || 'Inventory'} request`
    )
    : 'Request details';

  const detailModalSelectedName = selectedReviewRow
    ? (
      selectedReviewRow.source === 'account'
        ? selectedReviewRow._account?.name
        : selectedReviewRow._inventory?.name
    )
    : null;

  const detailFields = selectedReviewRow
    ? (
      selectedReviewRow.source === 'account'
        ? buildAccountDetailFields(selectedReviewRow._account)
        : buildInventoryDetailFields(selectedReviewRow._inventory)
    )
    : [];

  const isSelectedRowLoading = selectedReviewRow
    ? actionLoadingKey === selectedReviewRow.queueKey
    : false;

  const stats = [
    {
      title: 'Approved / forwarded',
      value: forwardedCount,
      icon: 'forward',
    },
    {
      title: 'Rejected requests',
      value: rejectedCount,
      icon: 'cancel',
    },
  ];

  const subtitleAwaiting = () => {
    if (loading) {
      return 'Loading requests for your department…';
    }
    if (error) {
      return 'Fix the account request error above and refresh. Inventory messages appear separately if loading failed.';
    }
    if (!departmentKey || departmentKey === 'department') {
      return 'Your profile needs a department name to filter requests for your department.';
    }
    if (pendingReviewCount === 0) {
      return 'There are no requests waiting for your approval or recommendation right now.';
    }
    return `${pendingReviewCount} item${pendingReviewCount === 1 ? '' : 's'} need your review across account and inventory requests for your department.`;
  };

  const activeTabRows = activeReviewTab === 'accounts' ? pendingAccountRows : pendingInventoryRows;
  const activeTabColumns = activeReviewTab === 'accounts' ? accountColumns : inventoryColumns;

  return (
    <MainLayout variant="hod">
      <PageHeader
        title="Dashboard"
        subtitle="Review new accounts, deactivation requests, and inventory creation or addition requests for your department. Approve or recommend items awaiting your review."
        actions={
          <Button variant="secondary" icon="refresh" onClick={loadRequests} disabled={loading || actionLoadingKey !== null}>
            Refresh
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {stats.map((stat) => (
            <Card key={stat.title} icon={stat.icon} hover={false}>
              <p className="text-sm text-text-light">{stat.title}</p>
              <p className="mt-2 text-3xl font-bold text-primary-800">{stat.value}</p>
            </Card>
          ))}
        </div>

        <Card title="Awaiting Your Review" subtitle={subtitleAwaiting()} icon="hourglass_empty">
          {error ? <p className="text-sm text-error">{error}</p> : null}
          {inventoryLoadError && activeReviewTab === 'inventory' ? (
            <p className="text-sm text-warning mt-2">{inventoryLoadError}</p>
          ) : null}
          {!error && actionLoadingKey !== null ? (
            <p className="mb-4 text-sm text-text-light">Updating request...</p>
          ) : null}

          <div className="border-b border-border-light mb-6">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveReviewTab('accounts');
                  closeDetailModal();
                }}
                className={`px-6 py-3 border-b-2 font-medium transition-colors ${
                  activeReviewTab === 'accounts'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-text-light hover:text-text-dark'
                }`}
              >
                Account Creations / Deactivations
                {pendingAccountRows.length > 0 ? ` (${pendingAccountRows.length})` : ''}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveReviewTab('inventory');
                  closeDetailModal();
                }}
                className={`px-6 py-3 border-b-2 font-medium transition-colors ${
                  activeReviewTab === 'inventory'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-text-light hover:text-text-dark'
                }`}
              >
                Inventory Creations
                {pendingInventoryRows.length > 0 ? ` (${pendingInventoryRows.length})` : ''}
              </button>
            </div>
          </div>

          <Table
            key={activeReviewTab}
            columns={activeTabColumns}
            data={activeTabRows}
            onRowClick={handleViewRowDetails}
            searchable
            loading={loading}
            paginated={activeTabRows.length > 10}
            itemsPerPage={10}
          />
        </Card>

        <Modal
          isOpen={isDetailModalOpen}
          onClose={closeDetailModal}
          title={detailModalTitle}
          size="lg"
          footer={(
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={closeDetailModal} disabled={isSelectedRowLoading}>
                Close
              </Button>
              <Button
                variant="danger"
                icon="cancel"
                onClick={() => handleAction(selectedReviewRow, 'reject')}
                disabled={isSelectedRowLoading}
                loading={isSelectedRowLoading}
              >
                Reject
              </Button>
              <Button
                variant="primary"
                icon="check_circle"
                onClick={() => handleAction(selectedReviewRow, 'approve')}
                disabled={isSelectedRowLoading}
                loading={isSelectedRowLoading}
              >
                Accept
              </Button>
            </div>
          )}
        >
          <div className="space-y-4">
            <div className="bg-background-light p-4 rounded-lg">
              <p className="text-sm text-text-light">
                {selectedReviewRow?.source === 'inventory' ? 'Inventory' : 'Applicant'}
              </p>
              <p className="text-lg font-semibold text-text-dark">{formatDetailValue(detailModalSelectedName)}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {detailFields.map((detail) => (
                <div key={detail.label} className={detail.fullWidth ? 'md:col-span-2' : ''}>
                  <p className="text-text-light">{detail.label}</p>
                  <p className="font-semibold text-text-dark whitespace-pre-wrap">{formatDetailValue(detail.value)}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-text-light">
              Accept to forward this request to the next step, or reject to decline it.
            </p>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
};

export default HodDashboard;

import React, { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../Components/Layouts/MainLayout';
import { Badge, Button, Card, PageHeader, Table } from '../../Components/UI';
import {
  ACCOUNT_REQUEST_STATUS,
  ACCOUNT_REQUEST_STATUS_META,
  INVENTORY_REQUEST_STATUS_META,
  INVENTORY_REQUEST_TYPE_LABELS,
} from '../../utils/constants';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const ACCOUNT_REQUEST_LABELS = {
  account_creation: 'New account',
  deactivation: 'Deactivation',
};

const HOD_PENDING_INVENTORY_STATUSES = new Set(['pending_staff', 'pending_hod']);

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

const getTimeOfDayGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 18) {
    return 'Good afternoon';
  }

  return 'Good evening';
};

const getLastName = (fullName = 'User') => {
  const nameParts = String(fullName).trim().split(/\s+/).filter(Boolean);
  return nameParts[nameParts.length - 1] || 'User';
};

const HodDashboard = () => {
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [accountRequests, setAccountRequests] = useState([]);
  const [inventoryRequests, setInventoryRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingKey, setActionLoadingKey] = useState(null);
  const [error, setError] = useState('');
  const [inventoryLoadError, setInventoryLoadError] = useState('');

  const departmentName = getDepartmentName(currentUser);
  const greeting = `${getTimeOfDayGreeting()} ${getLastName(currentUser.name || localStorage.getItem('username') || 'User')}`;

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

  const pendingReviewRows = useMemo(() => {
    const rows = [];

    departmentAccountRequests
      .filter((r) => r.approvalStatus === ACCOUNT_REQUEST_STATUS.PENDING_DEPT_HEAD)
      .forEach((r) => {
        rows.push({
          queueKey: `acc:${r.id}`,
          source: 'account',
          id: r.id,
          requestLabel: ACCOUNT_REQUEST_LABELS[r.requestType] || r.requestType || 'Account',
          subject: r.name || '—',
          detail: r.email || '—',
          department: r.department || '—',
          requestedDate: r.requestedDate || '',
          statusKey: r.approvalStatus,
          statusKind: 'account',
          _account: r,
        });
      });

    departmentInventoryRequests
      .filter((r) => HOD_PENDING_INVENTORY_STATUSES.has(String(r.approvalStatus || '').toLowerCase()))
      .forEach((r) => {
        const typeLabel = INVENTORY_REQUEST_TYPE_LABELS[r.requestType] || r.requestType || 'Inventory';
        rows.push({
          queueKey: `inv:${r.id}`,
          source: 'inventory',
          id: r.id,
          requestLabel: typeLabel,
          subject: r.name || '—',
          detail: [r.requestedByName, r.location].filter(Boolean).join(' · ') || '—',
          department: r.department || '—',
          requestedDate: r.requestedDate || '',
          statusKey: r.approvalStatus,
          statusKind: 'inventory',
          _inventory: r,
        });
      });

    rows.sort((a, b) => String(b.requestedDate).localeCompare(String(a.requestedDate)) || a.queueKey.localeCompare(b.queueKey));
    return rows;
  }, [departmentAccountRequests, departmentInventoryRequests]);

  const forwardedCount = useMemo(() => {
    const accounts = departmentAccountRequests.filter(
      (r) => r.approvalStatus === ACCOUNT_REQUEST_STATUS.PENDING_ADMIN
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

  const columns = [
    {
      field: 'requestLabel',
      label: 'Request',
      sortable: true,
      render: (value) => <Badge label={value} variant="info" size="sm" />,
    },
    { field: 'subject', label: 'Subject', sortable: true },
    { field: 'detail', label: 'Details', sortable: true },
    { field: 'department', label: 'Department', sortable: true },
    { field: 'requestedDate', label: 'Requested', sortable: true },
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
            ? `Recommend approval of ${request.name}'s deactivation request and forward it to the administrator?`
            : `Approve ${request.name}'s new account request and forward it to admin activation?`
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
        isApprove ? ACCOUNT_REQUEST_STATUS.PENDING_ADMIN : ACCOUNT_REQUEST_STATUS.REJECTED
      );
    } catch (actionError) {
      window.alert(actionError.message || `Failed to ${actionType} request.`);
    } finally {
      setActionLoadingKey(null);
    }
  };

  const handleInventoryAction = async (request, actionType) => {
    const isApprove = actionType === 'approve';
    const typeLabel = INVENTORY_REQUEST_TYPE_LABELS[request.requestType] || 'This inventory request';
    const confirmed = window.confirm(
      isApprove
        ? `Approve "${request.name}" (${typeLabel}) and send it to the next step in the workflow?`
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
    } catch (actionError) {
      window.alert(actionError.message || `Failed to ${actionType} inventory request.`);
    } finally {
      setActionLoadingKey(null);
    }
  };

  const handleAction = (row, actionType) => {
    if (row.source === 'account') {
      handleAccountAction(row._account, actionType);
      return;
    }
    handleInventoryAction(row._inventory, actionType);
  };

  const actions = [
    {
      label: 'Approve',
      icon: 'check_circle',
      onClick: (row) => handleAction(row, 'approve'),
    },
    {
      label: 'Reject',
      icon: 'cancel',
      onClick: (row) => handleAction(row, 'reject'),
    },
  ];

  const stats = [
    {
      title: 'With registrar / admin',
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
    if (pendingReviewRows.length === 0) {
      return 'There are no requests waiting for your approval or recommendation right now.';
    }
    return `${pendingReviewRows.length} item${pendingReviewRows.length === 1 ? '' : 's'} need your review: new accounts, deactivations, and inventory creation or additions for your department.`;
  };

  return (
    <MainLayout variant="hod">
      <PageHeader
        title={greeting}
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
          {inventoryLoadError ? <p className="text-sm text-warning mt-2">{inventoryLoadError}</p> : null}
          {!error && actionLoadingKey !== null ? (
            <p className="mb-4 text-sm text-text-light">Updating request...</p>
          ) : null}
          <Table
            columns={columns}
            data={pendingReviewRows}
            actions={actions}
            searchable
            loading={loading}
            paginated={pendingReviewRows.length > 10}
            itemsPerPage={10}
          />
        </Card>
      </div>
    </MainLayout>
  );
};

export default HodDashboard;

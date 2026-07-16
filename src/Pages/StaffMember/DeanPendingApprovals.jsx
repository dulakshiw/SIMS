import React, { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../Components/Layouts/MainLayout';
import { Badge, Card, PageHeader, SummaryCard, SummaryCardsGrid, Table } from '../../Components/UI';
import { ACCOUNT_REQUEST_STATUS, ACCOUNT_REQUEST_STATUS_META, ROLE_HIERARCHY } from '../../utils/constants';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const DEAN_APPROVAL_ROLES = new Set(['head_of_department', 'admin']);

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || '{}');
  } catch {
    return {};
  }
};

const DeanPendingApprovals = () => {
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [accountRequests, setAccountRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState('');

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError('');
      setCurrentUser(getStoredUser());

      const response = await fetch(`${API_BASE_URL}/api/account-requests?requestType=account_creation`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to load account requests.');
      }

      setAccountRequests(data.requests || []);
    } catch (loadError) {
      setAccountRequests([]);
      setError(loadError.message || 'Failed to load account requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const pendingDeanRequests = useMemo(
    () => accountRequests.filter(
      (request) =>
        request.approvalStatus === ACCOUNT_REQUEST_STATUS.PENDING_DEAN
        && DEAN_APPROVAL_ROLES.has(String(request.requestedRole || '').toLowerCase())
    ),
    [accountRequests]
  );

  const columns = [
    { field: 'name', label: 'Name', sortable: true },
    { field: 'email', label: 'Email', sortable: true },
    {
      field: 'requestedRole',
      label: 'Requested Role',
      render: (value) => (
        <Badge
          label={ROLE_HIERARCHY[value]?.label || value}
          variant="info"
          size="sm"
        />
      ),
    },
    { field: 'department', label: 'Department', sortable: true },
    { field: 'requestedDate', label: 'Requested Date', sortable: true },
    {
      field: 'approvalStatus',
      label: 'Status',
      render: (value) => {
        const config = ACCOUNT_REQUEST_STATUS_META[value] || { label: value, variant: 'secondary' };
        return <Badge label={config.label} variant={config.variant} size="sm" />;
      },
    },
  ];

  const updateRequestStatus = (requestId, nextStatus) => {
    setAccountRequests((prev) => prev.map((request) => (
      request.id === requestId
        ? { ...request, approvalStatus: nextStatus }
        : request
    )));
  };

  const handleAction = async (request, actionType) => {
    const isApprove = actionType === 'approve';
    const confirmed = window.confirm(
      isApprove
        ? `Approve ${request.name}'s ${ROLE_HIERARCHY[request.requestedRole]?.label || request.requestedRole} request and activate their account?`
        : `Reject ${request.name}'s account request?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoadingId(request.id);
      const response = await fetch(
        `${API_BASE_URL}/api/account-requests/${request.id}/${isApprove ? 'approve' : 'reject'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isApprove
              ? { approverRole: 'dean', approverUserId: currentUser.id }
              : { reason: 'Rejected by dean approval workflow' }
          ),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || `Failed to ${actionType} request.`);
      }

      updateRequestStatus(
        request.id,
        isApprove ? ACCOUNT_REQUEST_STATUS.APPROVED_BY_ADMIN : ACCOUNT_REQUEST_STATUS.REJECTED
      );
    } catch (actionError) {
      window.alert(actionError.message || `Failed to ${actionType} request.`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const stats = [
    {
      title: 'Pending HOD Requests',
      value: pendingDeanRequests.filter((request) => request.requestedRole === 'head_of_department').length,
      description: 'Head of Department account requests awaiting review.',
      icon: 'school',
    },
    {
      title: 'Pending Admin Requests',
      value: pendingDeanRequests.filter((request) => request.requestedRole === 'admin').length,
      description: 'Admin account requests awaiting review.',
      icon: 'admin_panel_settings',
    },
  ];

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

  return (
    <MainLayout variant="dean">
      <PageHeader
        title="Pending Approvals"
        subtitle="Review Head of Department and Admin account requests and activate approved accounts."
      />

      <div className="p-6 space-y-6">
        <SummaryCardsGrid showTitle={false} columns={2}>
          {stats.map((stat) => (
            <SummaryCard
              key={stat.title}
              title={stat.title}
              count={stat.value}
              description={stat.description}
              icon={stat.icon}
              hover={false}
            />
          ))}
        </SummaryCardsGrid>

        <Card title="Pending Dean Approvals" subtitle="Only Head of Department and Admin account requests are shown here.">
          {error ? <p className="text-sm text-error">{error}</p> : null}
          {!error && actionLoadingId !== null ? (
            <p className="mb-4 text-sm text-text-light">Updating request...</p>
          ) : null}
          <Table
            columns={columns}
            data={pendingDeanRequests}
            actions={actions}
            searchable
            loading={loading}
            paginated={pendingDeanRequests.length > 10}
            itemsPerPage={10}
          />
        </Card>
      </div>
    </MainLayout>
  );
};

export default DeanPendingApprovals;

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import MainLayout from '../../Components/Layouts/MainLayout';
import { Badge, Button, Card, Modal, PageHeader, SummaryCard, SummaryCardsGrid, Table } from '../../Components/UI';
import {
  ACCOUNT_REQUEST_STATUS,
  ACCOUNT_REQUEST_STATUS_META,
  INVENTORY_REQUEST_STATUS_META,
  INVENTORY_REQUEST_TYPE_LABELS,
  ITEM_REQUEST_PENDING_REQUESTER_STATUSES,
  ITEM_REQUEST_STATUS,
  ITEM_REQUEST_STATUS_META,
  ROLE_HIERARCHY,
} from '../../utils/constants';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const ACCOUNT_REQUEST_LABELS = {
  account_creation: 'New account',
  deactivation: 'Deactivation',
};

const HOD_PENDING_INVENTORY_STATUSES = new Set(['pending_hod', 'pending_staff']);

const PENDING_TAB_KEYS = new Set(['accounts', 'inventory', 'item-recommend', 'item-lab']);

const resolveInitialTab = (stateTab) => (
  PENDING_TAB_KEYS.has(stateTab) ? stateTab : 'accounts'
);

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

const HodPendingTasks = () => {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [accountRequests, setAccountRequests] = useState([]);
  const [inventoryRequests, setInventoryRequests] = useState([]);
  const [itemRecommendRequests, setItemRecommendRequests] = useState([]);
  const [itemLabRequests, setItemLabRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingKey, setActionLoadingKey] = useState(null);
  const [error, setError] = useState('');
  const [inventoryLoadError, setInventoryLoadError] = useState('');
  const [itemLoadError, setItemLoadError] = useState('');
  const [activeReviewTab, setActiveReviewTab] = useState(() => resolveInitialTab(location.state?.activeTab));
  const [selectedReviewRow, setSelectedReviewRow] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const departmentName = getDepartmentName(currentUser);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError('');
      setInventoryLoadError('');
      setItemLoadError('');
      const storedUser = getStoredUser();
      setCurrentUser(storedUser);

      const hodUserId = Number(storedUser.id ?? 0);
      const accountUrl = `${API_BASE_URL}/api/account-requests?requestType=account_creation,deactivation`;
      const inventoryUrl = Number.isInteger(hodUserId) && hodUserId > 0
        ? `${API_BASE_URL}/api/inventory-creation-requests?hodUserId=${hodUserId}`
        : null;
      const itemRecommendUrl = Number.isInteger(hodUserId) && hodUserId > 0
        ? `${API_BASE_URL}/api/item-requests?requesterHodUserId=${hodUserId}`
        : null;
      const itemLabUrl = Number.isInteger(hodUserId) && hodUserId > 0
        ? `${API_BASE_URL}/api/item-requests?labHodUserId=${hodUserId}`
        : null;

      const accountResponse = await fetch(accountUrl);
      const accountData = await accountResponse.json().catch(() => ({}));

      if (!accountResponse.ok || !accountData.success) {
        setAccountRequests([]);
        setError(accountData.message || accountData.error || 'Failed to load account requests.');
      } else {
        setAccountRequests(accountData.requests || []);
      }

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

      if (itemRecommendUrl || itemLabUrl) {
        try {
          const [itemRecommendResponse, itemLabResponse] = await Promise.all([
            itemRecommendUrl ? fetch(itemRecommendUrl) : Promise.resolve(null),
            itemLabUrl ? fetch(itemLabUrl) : Promise.resolve(null),
          ]);

          const itemRecommendData = itemRecommendResponse
            ? await itemRecommendResponse.json().catch(() => ({}))
            : { success: true, requests: [] };
          const itemLabData = itemLabResponse
            ? await itemLabResponse.json().catch(() => ({}))
            : { success: true, requests: [] };

          if (itemRecommendResponse && (!itemRecommendResponse.ok || !itemRecommendData.success)) {
            setItemRecommendRequests([]);
            setItemLoadError(itemRecommendData.message || itemRecommendData.error || 'Failed to load staff item requests.');
          } else {
            setItemRecommendRequests(itemRecommendData.requests || []);
          }

          if (itemLabResponse && (!itemLabResponse.ok || !itemLabData.success)) {
            setItemLabRequests([]);
            if (!itemLoadError) {
              setItemLoadError(itemLabData.message || itemLabData.error || 'Failed to load lab item requests.');
            }
          } else {
            setItemLabRequests(itemLabData.requests || []);
          }
        } catch (itemErr) {
          setItemRecommendRequests([]);
          setItemLabRequests([]);
          setItemLoadError(itemErr.message || 'Failed to load item requests.');
        }
      } else {
        setItemRecommendRequests([]);
        setItemLabRequests([]);
        if (!hodUserId) {
          setItemLoadError('Your profile is missing a user id, so item requests assigned to you cannot be loaded.');
        }
      }
    } catch (loadError) {
      setAccountRequests([]);
      setInventoryRequests([]);
      setItemRecommendRequests([]);
      setItemLabRequests([]);
      setError((prev) => prev || loadError.message || 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    if (location.state?.activeTab && PENDING_TAB_KEYS.has(location.state.activeTab)) {
      setActiveReviewTab(location.state.activeTab);
    }
  }, [location.state?.activeTab]);

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

  const pendingItemRecommendRows = useMemo(() => {
    const rows = itemRecommendRequests
      .filter((r) => ITEM_REQUEST_PENDING_REQUESTER_STATUSES.has(String(r.approvalStatus || '').toLowerCase()))
      .map((r) => ({
        queueKey: `item-rec:${r.id}`,
        source: 'item',
        itemActionType: 'recommend',
        id: r.id,
        requestLabel: 'Staff item request',
        requestedBy: r.requestedByName || '—',
        itemName: r.itemName || '—',
        location: r.inventoryLocation || '—',
        requestedDate: r.requestedDate || '',
        statusKey: r.approvalStatus,
        statusKind: 'item',
        _item: r,
      }));

    return mapPendingRows(rows);
  }, [itemRecommendRequests]);

  const pendingItemLabRows = useMemo(() => {
    const rows = itemLabRequests
      .filter((r) => String(r.approvalStatus || '').toLowerCase() === ITEM_REQUEST_STATUS.PENDING_LAB_HOD)
      .map((r) => ({
        queueKey: `item-lab:${r.id}`,
        source: 'item',
        itemActionType: 'approveLab',
        id: r.id,
        requestLabel: 'Lab item request',
        requestedBy: r.requestedByName || '—',
        itemName: r.itemName || '—',
        location: r.inventoryLocation || '—',
        requestedDate: r.requestedDate || '',
        statusKey: r.approvalStatus,
        statusKind: 'item',
        _item: r,
      }));

    return mapPendingRows(rows);
  }, [itemLabRequests]);

  const statusBadge = (row) => {
    if (row.statusKind === 'account') {
      const config = ACCOUNT_REQUEST_STATUS_META[row.statusKey] || { label: row.statusKey, variant: 'secondary' };
      return <Badge label={config.label} variant={config.variant} size="sm" />;
    }
    if (row.statusKind === 'item') {
      const config = ITEM_REQUEST_STATUS_META[row.statusKey] || { label: row.statusKey, variant: 'secondary' };
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

  const itemColumns = [
    {
      field: 'requestLabel',
      label: 'Request type',
      sortable: true,
      render: (value) => <Badge label={value} variant="info" size="sm" />,
    },
    { field: 'requestedBy', label: 'Requested by', sortable: true },
    { field: 'itemName', label: 'Item', sortable: true },
    { field: 'location', label: 'Inventory location', sortable: true },
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

  const updateItemStatus = (requestId, nextStatus, itemActionType) => {
    const updateList = (requests) => requests.map((request) => (
      request.id === requestId
        ? { ...request, approvalStatus: nextStatus }
        : request
    ));

    if (itemActionType === 'recommend') {
      setItemRecommendRequests(updateList);
      return;
    }

    setItemLabRequests(updateList);
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

  const handleItemAction = async (request, actionType, itemActionType = 'recommend') => {
    const isApprove = actionType === 'approve';
    const isRecommend = itemActionType === 'recommend';
    const confirmed = window.confirm(
      isApprove
        ? (
          isRecommend
            ? `Recommend ${request.requestedByName || 'this staff member'}'s request for "${request.itemName}" and forward it to the lab Head of Department?`
            : `Approve ${request.requestedByName || 'this staff member'}'s request for "${request.itemName}" and forward it to the lab inventory officer with status Approved to issue?`
        )
        : `Reject the item request for "${request.itemName}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoadingKey(isRecommend ? `item-rec:${request.id}` : `item-lab:${request.id}`);
      const hodUserId = Number(currentUser.id ?? 0);
      const url = isApprove
        ? (
          isRecommend
            ? `${API_BASE_URL}/api/item-requests/${request.id}/approve-dept-head`
            : `${API_BASE_URL}/api/item-requests/${request.id}/approve-lab-hod`
        )
        : `${API_BASE_URL}/api/item-requests/${request.id}/reject`;
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
        throw new Error(data.message || data.error || `Failed to ${actionType} item request.`);
      }

      if (isApprove && isRecommend) {
        updateItemStatus(request.id, ITEM_REQUEST_STATUS.PENDING_LAB_HOD, 'recommend');
        await loadRequests();
      } else if (isApprove) {
        updateItemStatus(
          request.id,
          String(data.approvalStatus || ITEM_REQUEST_STATUS.APPROVED_TO_ISSUE).toLowerCase(),
          itemActionType
        );
        await loadRequests();
      } else {
        updateItemStatus(request.id, ITEM_REQUEST_STATUS.REJECTED, itemActionType);
      }

      setIsDetailModalOpen(false);
      setSelectedReviewRow(null);
    } catch (actionError) {
      window.alert(actionError.message || `Failed to ${actionType} item request.`);
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
    if (row.source === 'item') {
      handleItemAction(row._item, actionType, row.itemActionType);
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

  const buildItemDetailFields = (request) => {
    const statusConfig = ITEM_REQUEST_STATUS_META[request.approvalStatus] || {
      label: request.approvalStatus,
    };

    return [
      { label: 'Request type', value: 'Item request' },
      { label: 'Item requested', value: request.itemName },
      { label: 'Inventory location', value: request.inventoryLocation },
      { label: 'Inventory name', value: request.inventoryName },
      { label: 'Lab department', value: request.inventoryDepartmentName },
      { label: 'Quantity', value: request.quantity },
      { label: 'Priority', value: request.priority },
      { label: 'Requested by', value: request.requestedByName },
      { label: 'Requester department', value: request.departmentName },
      { label: 'Requested date', value: request.requestedDate },
      { label: 'Required by date', value: request.requiredByDate },
      { label: 'Recommended date', value: request.requesterHodRecommendedDate },
      { label: 'Status', value: statusConfig.label },
      { label: 'Specifications', value: request.specification, fullWidth: true },
      { label: 'Justification', value: request.reason, fullWidth: true },
    ];
  };

  const detailModalTitle = selectedReviewRow
    ? (
      selectedReviewRow.source === 'account'
        ? `${ACCOUNT_REQUEST_LABELS[selectedReviewRow._account?.requestType] || 'Account'} request`
        : selectedReviewRow.source === 'item'
          ? 'Item request'
          : `${INVENTORY_REQUEST_TYPE_LABELS[selectedReviewRow._inventory?.requestType] || 'Inventory'} request`
    )
    : 'Request details';

  const detailModalSelectedName = selectedReviewRow
    ? (
      selectedReviewRow.source === 'account'
        ? selectedReviewRow._account?.name
        : selectedReviewRow.source === 'item'
          ? selectedReviewRow._item?.itemName
          : selectedReviewRow._inventory?.name
    )
    : null;

  const detailFields = selectedReviewRow
    ? (
      selectedReviewRow.source === 'account'
        ? buildAccountDetailFields(selectedReviewRow._account)
        : selectedReviewRow.source === 'item'
          ? buildItemDetailFields(selectedReviewRow._item)
          : buildInventoryDetailFields(selectedReviewRow._inventory)
    )
    : [];

  const selectedItemActionType = selectedReviewRow?.itemActionType || 'recommend';
  const selectedPrimaryActionLabel = selectedReviewRow?.source === 'item'
    ? (selectedItemActionType === 'approveLab' ? 'Approve' : 'Recommend')
    : 'Accept';

  const isSelectedRowLoading = selectedReviewRow
    ? actionLoadingKey === selectedReviewRow.queueKey
    : false;

  const pendingSummaryCards = [
    {
      key: 'accounts',
      title: 'User Accounts',
      description: 'New account creation and deactivation requests from your department.',
      count: pendingAccountRows.length,
      icon: 'person_add',
    },
    {
      key: 'inventory',
      title: 'Inventories',
      description: 'Inventory creation, addition, and officer change requests.',
      count: pendingInventoryRows.length,
      icon: 'inventory_2',
    },
    {
      key: 'item-recommend',
      title: 'Staff Item Requests',
      description: 'Item requests from your department staff.',
      count: pendingItemRecommendRows.length,
      icon: 'how_to_reg',
    },
    {
      key: 'item-lab',
      title: 'Received Item Requests',
      description: 'Item requests received for labs in your department.',
      count: pendingItemLabRows.length,
      icon: 'science',
    },
  ];

  const activePendingSummary = pendingSummaryCards.find((card) => card.key === activeReviewTab)
    || pendingSummaryCards[0];

  const handleSelectPendingTab = (tabKey) => {
    setActiveReviewTab(tabKey);
    closeDetailModal();
  };

  const tableSubtitle = () => {
    if (loading) {
      return 'Loading requests for your department…';
    }
    if (error && activeReviewTab === 'accounts') {
      return error;
    }
    if (inventoryLoadError && activeReviewTab === 'inventory') {
      return inventoryLoadError;
    }
    if (itemLoadError && (activeReviewTab === 'item-recommend' || activeReviewTab === 'item-lab')) {
      return itemLoadError;
    }
    if ((activeReviewTab === 'accounts' || activeReviewTab === 'inventory')
      && (!departmentKey || departmentKey === 'department')) {
      return 'Your profile needs a department name to filter requests for your department.';
    }
    if (activeTabRows.length === 0) {
      return `No pending requests in ${activePendingSummary.title.toLowerCase()}.`;
    }
    return `${activeTabRows.length} request${activeTabRows.length === 1 ? '' : 's'} awaiting your action.`;
  };

  const activeTabRows = activeReviewTab === 'accounts'
    ? pendingAccountRows
    : activeReviewTab === 'inventory'
      ? pendingInventoryRows
      : activeReviewTab === 'item-recommend'
        ? pendingItemRecommendRows
        : pendingItemLabRows;
  const activeTabColumns = activeReviewTab === 'accounts'
    ? accountColumns
    : activeReviewTab === 'inventory'
      ? inventoryColumns
      : itemColumns;

  return (
    <MainLayout variant="hod">
      <PageHeader
        title="Pending Approvals / Recommendations"
        subtitle="Review account, inventory, and staff item requests awaiting your action."
      />

      <div className="p-6 space-y-6">
        {error ? (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <SummaryCardsGrid showTitle={false} columns={4}>
          {pendingSummaryCards.map((card) => (
            <SummaryCard
              key={card.key}
              title={card.title}
              count={card.count}
              description={card.description}
              icon={card.icon}
              loading={loading}
              active={activeReviewTab === card.key}
              onClick={() => handleSelectPendingTab(card.key)}
            />
          ))}
        </SummaryCardsGrid>

        <Card title={activePendingSummary.title} subtitle={tableSubtitle()} icon={activePendingSummary.icon}>
          {!error && actionLoadingKey !== null ? (
            <p className="mb-4 text-sm text-text-light">Updating request...</p>
          ) : null}

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
                {selectedPrimaryActionLabel}
              </Button>
            </div>
          )}
        >
          <div className="space-y-4">
            <div className="bg-background-light p-4 rounded-lg">
              <p className="text-sm text-text-light">
                {selectedReviewRow?.source === 'inventory'
                  ? 'Inventory'
                  : selectedReviewRow?.source === 'item'
                    ? 'Item'
                    : 'Applicant'}
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
              {selectedReviewRow?.source === 'item' && selectedItemActionType === 'recommend'
                ? 'Recommend to forward this request to the lab Head of Department, or reject to decline it.'
                : selectedReviewRow?.source === 'item' && selectedItemActionType === 'approveLab'
                  ? 'Approve to accept this lab inventory request, or reject to decline it.'
                  : 'Accept to forward this request to the next step, or reject to decline it.'}
            </p>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
};

export default HodPendingTasks;

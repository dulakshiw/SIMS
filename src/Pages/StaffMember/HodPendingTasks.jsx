import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import MainLayout from '../../Components/Layouts/MainLayout';
import { Badge, Button, Card, Modal, PageHeader, SummaryCard, SummaryCardsGrid, Table, Tabs } from '../../Components/UI';
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
const ALLOWED_INCHARGE_DESIGNATIONS = new Set(['Technical Officer', 'Management Assistant']);
const HISTORY_VIEW_KEYS = new Set(['forwarded', 'rejected']);
const INVENTORY_DOWNSTREAM_STATUSES = new Set([
  'approved_by_hod',
  'pending_registrar',
  'approved_by_registrar',
  'pending_admin',
  'approved_by_admin',
  'completed',
]);

const PENDING_TAB_KEYS = new Set(['accounts', 'inventory', 'movements', 'item-recommend', 'item-lab', 'forwarded', 'rejected']);

const resolveInitialTab = (stateTab, pathname) => {
  if (PENDING_TAB_KEYS.has(stateTab)) {
    return stateTab;
  }

  if (String(pathname || '').startsWith('/hod/approval-history')) {
    return 'forwarded';
  }

  return 'accounts';
};

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

const resolveUserId = (user = {}) => Number(user.id ?? user.user_id ?? user.userId ?? 0);

const HodPendingTasks = () => {
  const location = useLocation();
  const isApprovalHistoryPath = location.pathname.startsWith('/hod/approval-history');
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [accountRequests, setAccountRequests] = useState([]);
  const [inventoryRequests, setInventoryRequests] = useState([]);
  const [itemRecommendRequests, setItemRecommendRequests] = useState([]);
  const [itemLabRequests, setItemLabRequests] = useState([]);
  const [transferRequests, setTransferRequests] = useState([]);
  const [disposalRequests, setDisposalRequests] = useState([]);
  const [repairRequests, setRepairRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingKey, setActionLoadingKey] = useState(null);
  const [error, setError] = useState('');
  const [inventoryLoadError, setInventoryLoadError] = useState('');
  const [transferLoadError, setTransferLoadError] = useState('');
  const [disposalLoadError, setDisposalLoadError] = useState('');
  const [repairLoadError, setRepairLoadError] = useState('');
  const [itemLoadError, setItemLoadError] = useState('');
  const [activeReviewTab, setActiveReviewTab] = useState(() => resolveInitialTab(location.state?.activeTab, location.pathname));
  const [activeMovementTabIndex, setActiveMovementTabIndex] = useState(0);
  const [selectedReviewRow, setSelectedReviewRow] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [officerCandidates, setOfficerCandidates] = useState([]);
  const [officerCandidatesLoading, setOfficerCandidatesLoading] = useState(false);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [officerSelectionError, setOfficerSelectionError] = useState('');

  const departmentName = getDepartmentName(currentUser);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError('');
      setInventoryLoadError('');
      setTransferLoadError('');
      setDisposalLoadError('');
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
      const transferUrl = Number.isInteger(hodUserId) && hodUserId > 0
        ? `${API_BASE_URL}/api/item-transfers?sourceHodUserId=${hodUserId}`
        : null;
      const disposalUrl = Number.isInteger(hodUserId) && hodUserId > 0
        ? `${API_BASE_URL}/api/item-disposals?sourceHodUserId=${hodUserId}`
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

      if (transferUrl) {
        try {
          const transferResponse = await fetch(transferUrl);
          const transferData = await transferResponse.json().catch(() => ({}));

          if (!transferResponse.ok || !transferData.success) {
            setTransferRequests([]);
            setTransferLoadError(transferData.message || transferData.error || 'Failed to load item transfer requests.');
          } else {
            setTransferRequests(transferData.transfers || []);
          }
        } catch (transferErr) {
          setTransferRequests([]);
          setTransferLoadError(transferErr.message || 'Failed to load item transfer requests.');
        }
      } else {
        setTransferRequests([]);
        if (!hodUserId) {
          setTransferLoadError('Your profile is missing a user id, so transfer requests assigned to you cannot be loaded.');
        }
      }

      if (disposalUrl) {
        try {
          const disposalResponse = await fetch(disposalUrl);
          const disposalData = await disposalResponse.json().catch(() => ({}));

          if (!disposalResponse.ok || !disposalData.success) {
            setDisposalRequests([]);
            setDisposalLoadError(disposalData.message || disposalData.error || 'Failed to load item disposal requests.');
          } else {
            setDisposalRequests(disposalData.disposals || []);
          }
        } catch (disposalErr) {
          setDisposalRequests([]);
          setDisposalLoadError(disposalErr.message || 'Failed to load item disposal requests.');
        }
      } else {
        setDisposalRequests([]);
        if (!hodUserId) {
          setDisposalLoadError('Your profile is missing a user id, so disposal requests assigned to you cannot be loaded.');
        }
      }

      const repairUrl = Number.isInteger(hodUserId) && hodUserId > 0
        ? `${API_BASE_URL}/api/item-repairs?sourceHodUserId=${hodUserId}&approvalStatus=pending_hod`
        : null;

      if (repairUrl) {
        try {
          const repairResponse = await fetch(repairUrl);
          const repairData = await repairResponse.json().catch(() => ({}));

          if (!repairResponse.ok || !repairData.success) {
            setRepairRequests([]);
            setRepairLoadError(repairData.message || repairData.error || 'Failed to load repair requests.');
          } else {
            setRepairRequests(repairData.repairs || []);
            setRepairLoadError('');
          }
        } catch (repairErr) {
          setRepairRequests([]);
          setRepairLoadError(repairErr.message || 'Failed to load repair requests.');
        }
      } else {
        setRepairRequests([]);
        if (!hodUserId) {
          setRepairLoadError('Your profile is missing a user id, so repair requests assigned to you cannot be loaded.');
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
      setTransferRequests([]);
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
    if (isApprovalHistoryPath) {
      if (!HISTORY_VIEW_KEYS.has(activeReviewTab)) {
        setActiveReviewTab('forwarded');
      }
      return;
    }

    if (HISTORY_VIEW_KEYS.has(activeReviewTab)) {
      setActiveReviewTab('accounts');
      return;
    }

    if (location.state?.activeTab && PENDING_TAB_KEYS.has(location.state.activeTab)) {
      setActiveReviewTab(location.state.activeTab);
    }
  }, [activeReviewTab, isApprovalHistoryPath, location.state?.activeTab]);

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

  const pendingTransferRows = useMemo(() => {
    const rows = transferRequests.map((transfer) => ({
      queueKey: `transfer:${transfer.id}`,
      source: 'transfer',
      id: transfer.id,
      requestLabel: 'Item transfer',
      requestedBy: transfer.initiatedBy || '—',
      itemName: transfer.itemName || '—',
      location: transfer.fromInventory || '—',
      destination: transfer.toInventory || '—',
      requestedDate: transfer.transferDate || '',
      statusKey: transfer.approvalStatus || 'pending_hod',
      statusKind: 'transfer',
      _transfer: transfer,
    }));

    return mapPendingRows(rows);
  }, [transferRequests]);

  const pendingDisposalRows = useMemo(() => {
    const rows = disposalRequests.map((disposal) => ({
      queueKey: `disposal:${disposal.id}`,
      source: 'disposal',
      id: disposal.id,
      requestLabel: 'Item disposal',
      requestedBy: disposal.initiatedBy || '—',
      itemName: disposal.itemName || '—',
      location: disposal.inventory || '—',
      requestedDate: disposal.disposalDate || '',
      statusKey: disposal.approvalStatus || 'pending_hod',
      statusKind: 'disposal',
      _disposal: disposal,
    }));

    return mapPendingRows(rows);
  }, [disposalRequests]);

  const pendingRepairRows = useMemo(() => {
    const rows = repairRequests.map((repair) => ({
      queueKey: `repair:${repair.id}`,
      source: 'repair',
      id: repair.id,
      requestLabel: 'Item repair',
      requestedBy: repair.initiatedBy || '—',
      itemName: repair.itemName || '—',
      location: repair.inventory || '—',
      destination: '—',
      requestedDate: repair.repairDate || '',
      statusKey: repair.approvalStatus || 'pending_hod',
      statusKind: 'repair',
      _repair: repair,
    }));

    return mapPendingRows(rows);
  }, [repairRequests]);

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

  const allItemRequests = useMemo(() => {
    const byId = new Map();
    [...itemRecommendRequests, ...itemLabRequests].forEach((request) => byId.set(request.id, request));
    return [...byId.values()];
  }, [itemRecommendRequests, itemLabRequests]);

  const isForwardedAccount = (request) => {
    const status = String(request.approvalStatus || '').toLowerCase();
    return status !== ACCOUNT_REQUEST_STATUS.PENDING_DEPT_HEAD
      && status !== ACCOUNT_REQUEST_STATUS.REJECTED;
  };

  const isForwardedItem = (request) => {
    const status = String(request.approvalStatus || '').toLowerCase();
    return !ITEM_REQUEST_PENDING_REQUESTER_STATUSES.has(status)
      && status !== ITEM_REQUEST_STATUS.REJECTED
      && status !== ITEM_REQUEST_STATUS.CANCELLED;
  };

  const forwardedRows = useMemo(() => {
    const accountRows = departmentAccountRequests
      .filter(isForwardedAccount)
      .map((r) => ({
        queueKey: `acc:${r.id}`,
        source: 'account',
        category: 'Account',
        requestLabel: ACCOUNT_REQUEST_LABELS[r.requestType] || r.requestType || 'Account',
        subjectName: r.name || '—',
        requestedBy: r.name || '—',
        location: '—',
        requestedDate: r.requestedDate || '',
        statusKey: r.approvalStatus,
        statusKind: 'account',
        _account: r,
      }));

    const inventoryRows = departmentInventoryRequests
      .filter((r) => INVENTORY_DOWNSTREAM_STATUSES.has(String(r.approvalStatus || '').toLowerCase()))
      .map((r) => {
        const typeLabel = INVENTORY_REQUEST_TYPE_LABELS[r.requestType] || r.requestType || 'Inventory';
        return {
          queueKey: `inv:${r.id}`,
          source: 'inventory',
          category: 'Inventory',
          requestLabel: typeLabel,
          subjectName: r.name || '—',
          requestedBy: r.requestedByName || '—',
          location: r.location || '—',
          requestedDate: r.requestedDate || '',
          statusKey: r.approvalStatus,
          statusKind: 'inventory',
          _inventory: r,
        };
      });

    const itemRows = allItemRequests
      .filter(isForwardedItem)
      .map((r) => ({
        queueKey: `item:${r.id}`,
        source: 'item',
        category: 'Item',
        requestLabel: 'Item request',
        subjectName: r.itemName || '—',
        requestedBy: r.requestedByName || '—',
        location: r.inventoryLocation || '—',
        requestedDate: r.requestedDate || '',
        statusKey: r.approvalStatus,
        statusKind: 'item',
        _item: r,
      }));

    return mapPendingRows([...accountRows, ...inventoryRows, ...itemRows]);
  }, [departmentAccountRequests, departmentInventoryRequests, allItemRequests]);

  const rejectedRows = useMemo(() => {
    const accountRows = departmentAccountRequests
      .filter((r) => r.approvalStatus === ACCOUNT_REQUEST_STATUS.REJECTED)
      .map((r) => ({
        queueKey: `acc:${r.id}`,
        source: 'account',
        category: 'Account',
        requestLabel: ACCOUNT_REQUEST_LABELS[r.requestType] || r.requestType || 'Account',
        subjectName: r.name || '—',
        requestedBy: r.name || '—',
        location: '—',
        requestedDate: r.requestedDate || '',
        statusKey: r.approvalStatus,
        statusKind: 'account',
        _account: r,
      }));

    const inventoryRows = departmentInventoryRequests
      .filter((r) => String(r.approvalStatus || '').toLowerCase() === 'rejected')
      .map((r) => {
        const typeLabel = INVENTORY_REQUEST_TYPE_LABELS[r.requestType] || r.requestType || 'Inventory';
        return {
          queueKey: `inv:${r.id}`,
          source: 'inventory',
          category: 'Inventory',
          requestLabel: typeLabel,
          subjectName: r.name || '—',
          requestedBy: r.requestedByName || '—',
          location: r.location || '—',
          requestedDate: r.requestedDate || '',
          statusKey: r.approvalStatus,
          statusKind: 'inventory',
          _inventory: r,
        };
      });

    const itemRows = allItemRequests
      .filter((r) => String(r.approvalStatus || '').toLowerCase() === ITEM_REQUEST_STATUS.REJECTED)
      .map((r) => ({
        queueKey: `item:${r.id}`,
        source: 'item',
        category: 'Item',
        requestLabel: 'Item request',
        subjectName: r.itemName || '—',
        requestedBy: r.requestedByName || '—',
        location: r.inventoryLocation || '—',
        requestedDate: r.requestedDate || '',
        statusKey: r.approvalStatus,
        statusKind: 'item',
        _item: r,
      }));

    return mapPendingRows([...accountRows, ...inventoryRows, ...itemRows]);
  }, [departmentAccountRequests, departmentInventoryRequests, allItemRequests]);

  const statusBadge = (row) => {
    if (row.statusKind === 'account') {
      const config = ACCOUNT_REQUEST_STATUS_META[row.statusKey] || { label: row.statusKey, variant: 'secondary' };
      return <Badge label={config.label} variant={config.variant} size="sm" />;
    }
    if (row.statusKind === 'item') {
      const config = ITEM_REQUEST_STATUS_META[row.statusKey] || { label: row.statusKey, variant: 'secondary' };
      return <Badge label={config.label} variant={config.variant} size="sm" />;
    }
    if (row.statusKind === 'transfer' || row.statusKind === 'disposal' || row.statusKind === 'repair') {
      return <Badge label="Pending HOD recommendation" variant="warning" size="sm" />;
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

  const transferColumns = [
    {
      field: 'requestLabel',
      label: 'Request type',
      sortable: true,
      render: (value) => <Badge label={value} variant="info" size="sm" />,
    },
    { field: 'requestedBy', label: 'Submitted by', sortable: true },
    { field: 'itemName', label: 'Item', sortable: true },
    { field: 'location', label: 'From inventory', sortable: true },
    { field: 'destination', label: 'To inventory', sortable: true },
    { field: 'requestedDate', label: 'Transfer date', sortable: true },
    {
      field: 'statusKey',
      label: 'Status',
      sortable: true,
      render: (_value, row) => statusBadge(row),
    },
  ];

  const disposalColumns = [
    {
      field: 'requestLabel',
      label: 'Request type',
      sortable: true,
      render: (value) => <Badge label={value} variant="info" size="sm" />,
    },
    { field: 'requestedBy', label: 'Submitted by', sortable: true },
    { field: 'itemName', label: 'Item', sortable: true },
    { field: 'location', label: 'Inventory', sortable: true },
    { field: 'requestedDate', label: 'Disposal date', sortable: true },
    {
      field: 'statusKey',
      label: 'Status',
      sortable: true,
      render: (_value, row) => statusBadge(row),
    },
  ];

  const movementColumns = [
    {
      field: 'requestLabel',
      label: 'Request type',
      sortable: true,
      render: (value) => <Badge label={value} variant="info" size="sm" />,
    },
    { field: 'requestedBy', label: 'Submitted by', sortable: true },
    { field: 'itemName', label: 'Item', sortable: true },
    { field: 'location', label: 'From / Inventory', sortable: true },
    { field: 'destination', label: 'To / Destination', sortable: true },
    { field: 'requestedDate', label: 'Date', sortable: true },
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

  const historyColumns = [
    {
      field: 'category',
      label: 'Category',
      sortable: true,
      render: (value) => <Badge label={value} variant="secondary" size="sm" />,
    },
    {
      field: 'requestLabel',
      label: 'Request type',
      sortable: true,
      render: (value) => <Badge label={value} variant="info" size="sm" />,
    },
    { field: 'subjectName', label: 'Subject', sortable: true },
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

  const updateTransferStatus = (transferId) => {
    setTransferRequests((prev) => prev.filter((transfer) => transfer.id !== transferId));
  };

  const handleTransferAction = async (transfer, actionType) => {
    const isApprove = actionType === 'approve';
    const confirmed = window.confirm(
      isApprove
        ? `Recommend this transfer from "${transfer.fromInventory}" to "${transfer.toInventory}" and forward it to the registrar?`
        : `Reject this item transfer request from "${transfer.fromInventory}" to "${transfer.toInventory}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoadingKey(`transfer:${transfer.id}`);
      const hodUserId = Number(currentUser.id ?? 0);
      const url = isApprove
        ? `${API_BASE_URL}/api/item-transfers/${transfer.id}/approve-hod`
        : `${API_BASE_URL}/api/item-transfers/${transfer.id}/reject-hod`;
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
        throw new Error(data.message || data.error || `Failed to ${actionType} transfer request.`);
      }

      updateTransferStatus(transfer.id);
      setIsDetailModalOpen(false);
      setSelectedReviewRow(null);
    } catch (actionError) {
      window.alert(actionError.message || `Failed to ${actionType} transfer request.`);
    } finally {
      setActionLoadingKey(null);
    }
  };

  const updateDisposalStatus = (disposalId) => {
    setDisposalRequests((prev) => prev.filter((disposal) => disposal.id !== disposalId));
  };

  const updateRepairStatus = (repairId) => {
    setRepairRequests((prev) => prev.filter((repair) => repair.id !== repairId));
  };

  const handleRepairAction = async (repair, actionType) => {
    const isApprove = actionType === 'approve';
    const confirmed = window.confirm(
      isApprove
        ? `Recommend this repair request for "${repair.itemName}" from "${repair.inventory}" and forward it to the registrar?`
        : `Reject this repair request for "${repair.itemName}" from "${repair.inventory}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoadingKey(`repair:${repair.id}`);
      const hodUserId = Number(currentUser.id ?? 0);
      const url = isApprove
        ? `${API_BASE_URL}/api/item-repairs/${repair.id}/approve-hod`
        : `${API_BASE_URL}/api/item-repairs/${repair.id}/reject-hod`;
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
        throw new Error(data.message || data.error || `Failed to ${actionType} repair request.`);
      }

      updateRepairStatus(repair.id);
      setIsDetailModalOpen(false);
      setSelectedReviewRow(null);
    } catch (actionError) {
      window.alert(actionError.message || `Failed to ${actionType} repair request.`);
    } finally {
      setActionLoadingKey(null);
    }
  };

  const handleDisposalAction = async (disposal, actionType) => {
    const isApprove = actionType === 'approve';
    const confirmed = window.confirm(
      isApprove
        ? `Recommend disposal of "${disposal.itemName}" from "${disposal.inventory}" and forward it to the registrar?`
        : `Reject this item disposal request for "${disposal.itemName}" from "${disposal.inventory}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoadingKey(`disposal:${disposal.id}`);
      const hodUserId = Number(currentUser.id ?? 0);
      const url = isApprove
        ? `${API_BASE_URL}/api/item-disposals/${disposal.id}/approve-hod`
        : `${API_BASE_URL}/api/item-disposals/${disposal.id}/reject-hod`;
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
        throw new Error(data.message || data.error || `Failed to ${actionType} disposal request.`);
      }

      updateDisposalStatus(disposal.id);
      setIsDetailModalOpen(false);
      setSelectedReviewRow(null);
    } catch (actionError) {
      window.alert(actionError.message || `Failed to ${actionType} disposal request.`);
    } finally {
      setActionLoadingKey(null);
    }
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

    if (isApprove && isChangeIncharge) {
      const nextOfficerId = Number(selectedOfficerId);
      if (!Number.isInteger(nextOfficerId) || nextOfficerId <= 0) {
        setOfficerSelectionError('Select the new inventory officer before approving this request.');
        return;
      }
    }

    try {
      setActionLoadingKey(`inv:${request.id}`);
      const hodUserId = Number(currentUser.id ?? 0);
      const nextOfficerId = Number(selectedOfficerId);
      const url = isApprove
        ? `${API_BASE_URL}/api/inventory-creation-requests/${request.id}/approve-hod`
        : `${API_BASE_URL}/api/inventory-creation-requests/${request.id}/reject`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isApprove
            ? {
              approverUserId: hodUserId,
              ...(isChangeIncharge && Number.isInteger(nextOfficerId) && nextOfficerId > 0
                ? { inchargeId: nextOfficerId }
                : {}),
            }
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
    if (row.source === 'transfer') {
      handleTransferAction(row._transfer, actionType);
      return;
    }
    if (row.source === 'disposal') {
      handleDisposalAction(row._disposal, actionType);
      return;
    }
    if (row.source === 'repair') {
      handleRepairAction(row._repair, actionType);
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
    setOfficerCandidates([]);
    setSelectedOfficerId('');
    setOfficerSelectionError('');
  };

  const handleViewRowDetails = (row) => {
    setSelectedReviewRow(row);
    setIsDetailModalOpen(true);
    setOfficerSelectionError('');
    if (row?.source === 'inventory' && row?._inventory?.requestType === 'change_incharge') {
      setSelectedOfficerId(String(row._inventory.inchargeUserId || ''));
    } else {
      setSelectedOfficerId('');
    }
  };

  useEffect(() => {
    const request = selectedReviewRow?._inventory;
    const shouldLoadCandidates = isDetailModalOpen
      && selectedReviewRow?.source === 'inventory'
      && request?.requestType === 'change_incharge';

    if (!shouldLoadCandidates) {
      setOfficerCandidates([]);
      setOfficerCandidatesLoading(false);
      return;
    }

    const loadOfficerCandidates = async () => {
      try {
        setOfficerCandidatesLoading(true);
        setOfficerSelectionError('');

        const response = await fetch(`${API_BASE_URL}/api/users`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(data.message || data.error || 'Failed to load eligible staff members.');
        }

        const departmentKey = String(request.department || '').trim().toLowerCase();
        const currentOfficerId = Number(request.requestedById ?? request.previousInchargeUserId ?? 0);

        const candidates = (data.users || []).filter((user) => {
          const userId = resolveUserId(user);
          const designation = String(user.designation || '').trim();
          const userDepartment = String(user.department || user.departmentName || '').trim().toLowerCase();

          return user.status === 'active'
            && ['staff', 'inventory_incharge'].includes(String(user.role || '').toLowerCase())
            && ALLOWED_INCHARGE_DESIGNATIONS.has(designation)
            && userDepartment === departmentKey
            && userId > 0
            && userId !== currentOfficerId;
        });

        setOfficerCandidates(candidates);
        setSelectedOfficerId((previous) => {
          if (candidates.length === 0) {
            return '';
          }
          const previousMatch = candidates.some((user) => String(resolveUserId(user)) === String(previous || ''));
          return previousMatch ? previous : String(resolveUserId(candidates[0]));
        });
      } catch (loadError) {
        setOfficerCandidates([]);
        setOfficerSelectionError(loadError.message || 'Failed to load eligible staff members.');
      } finally {
        setOfficerCandidatesLoading(false);
      }
    };

    loadOfficerCandidates();
  }, [isDetailModalOpen, selectedReviewRow]);

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
        { label: 'New officer', value: request.inchargeName || 'To be selected by HOD' },
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

  const buildTransferDetailFields = (transfer) => [
    { label: 'Request type', value: 'Item transfer' },
    { label: 'Item', value: transfer.itemName },
    { label: 'From inventory', value: transfer.fromInventory },
    { label: 'To inventory', value: transfer.toInventory },
    { label: 'Submitted by', value: transfer.initiatedBy },
    { label: 'Transfer date', value: transfer.transferDate },
    { label: 'Quantity', value: transfer.quantity },
    { label: 'Status', value: 'Pending HOD recommendation' },
    { label: 'Reason', value: transfer.reason, fullWidth: true },
  ];

  const buildDisposalDetailFields = (disposal) => [
    { label: 'Request type', value: 'Item disposal' },
    { label: 'Item', value: disposal.itemName },
    { label: 'Inventory', value: disposal.inventory },
    { label: 'Submitted by', value: disposal.initiatedBy },
    { label: 'Disposal date', value: disposal.disposalDate },
    { label: 'Quantity', value: disposal.quantity },
    { label: 'Condition', value: disposal.condition },
    { label: 'Status', value: 'Pending HOD recommendation' },
    { label: 'Reason', value: disposal.reason, fullWidth: true },
    { label: 'Description', value: disposal.description, fullWidth: true },
  ];

  const buildRepairDetailFields = (repair) => [
    { label: 'Request type', value: 'Item repair' },
    { label: 'Item', value: repair.itemName },
    { label: 'Inventory', value: repair.inventory },
    { label: 'Submitted by', value: repair.initiatedBy },
    { label: 'Repair date', value: repair.repairDate },
    { label: 'Quantity', value: repair.quantity },
    { label: 'Status', value: repair.approvalStatus ? repair.approvalStatus.replace(/_/g, ' ') : 'Pending HOD recommendation' },
    { label: 'Fault description', value: repair.faultDescription, fullWidth: true },
    { label: 'Repair notes', value: repair.repairNotes, fullWidth: true },
  ];

  const detailModalTitle = selectedReviewRow
    ? (
      selectedReviewRow.source === 'account'
        ? `${ACCOUNT_REQUEST_LABELS[selectedReviewRow._account?.requestType] || 'Account'} request`
        : selectedReviewRow.source === 'item'
          ? 'Item request'
          : selectedReviewRow.source === 'transfer'
            ? 'Item transfer request'
            : selectedReviewRow.source === 'disposal'
              ? 'Item disposal request'
              : selectedReviewRow.source === 'repair'
                ? 'Item repair request'
                : `${INVENTORY_REQUEST_TYPE_LABELS[selectedReviewRow._inventory?.requestType] || 'Inventory'} request`
    )
    : 'Request details';

  const detailModalSelectedName = selectedReviewRow
    ? (
      selectedReviewRow.source === 'account'
        ? selectedReviewRow._account?.name
        : selectedReviewRow.source === 'item'
          ? selectedReviewRow._item?.itemName
          : selectedReviewRow.source === 'transfer'
            ? selectedReviewRow._transfer?.itemName
            : selectedReviewRow.source === 'disposal'
              ? selectedReviewRow._disposal?.itemName
              : selectedReviewRow.source === 'repair'
                ? selectedReviewRow._repair?.itemName
                : selectedReviewRow._inventory?.name
    )
    : null;

  const detailFields = selectedReviewRow
    ? (
      selectedReviewRow.source === 'account'
        ? buildAccountDetailFields(selectedReviewRow._account)
        : selectedReviewRow.source === 'item'
          ? buildItemDetailFields(selectedReviewRow._item)
          : selectedReviewRow.source === 'transfer'
            ? buildTransferDetailFields(selectedReviewRow._transfer)
            : selectedReviewRow.source === 'disposal'
              ? buildDisposalDetailFields(selectedReviewRow._disposal)
              : selectedReviewRow.source === 'repair'
                ? buildRepairDetailFields(selectedReviewRow._repair)
                : buildInventoryDetailFields(selectedReviewRow._inventory)
    )
    : [];

  const selectedItemActionType = selectedReviewRow?.itemActionType || 'recommend';
  const selectedPrimaryActionLabel = selectedReviewRow?.source === 'item'
    ? (selectedItemActionType === 'approveLab' ? 'Approve' : 'Recommend')
    : selectedReviewRow?.source === 'transfer'
      ? 'Recommend'
      : selectedReviewRow?.source === 'disposal'
        ? 'Recommend'
        : selectedReviewRow?.source === 'repair'
          ? 'Recommend'
          : 'Accept';

  const isSelectedRowLoading = selectedReviewRow
    ? actionLoadingKey === selectedReviewRow.queueKey
    : false;
  const isSelectedChangeIncharge = selectedReviewRow?.source === 'inventory'
    && selectedReviewRow?._inventory?.requestType === 'change_incharge';

  const movementTabs = [
    { id: 'transfers', label: `Transfers (${pendingTransferRows.length})` },
    { id: 'disposals', label: `Disposals (${pendingDisposalRows.length})` },
    { id: 'repairs', label: `Repairs (${pendingRepairRows.length})` },
  ];

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
      key: 'movements',
      title: 'Movements & Repairs',
      description: 'Item transfers, disposals, and repair requests awaiting your recommendation.',
      count: pendingTransferRows.length + pendingDisposalRows.length + pendingRepairRows.length,
      icon: 'swap_horiz',
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
    {
      key: 'forwarded',
      title: 'Approved / Recommended',
      description: 'Requests you approved or forwarded to the next step.',
      count: forwardedRows.length,
      icon: 'forward',
    },
    {
      key: 'rejected',
      title: 'Rejected Requests',
      description: 'Requests you declined or rejected.',
      count: rejectedRows.length,
      icon: 'cancel',
    },
  ];

  const displayedSummaryCards = isApprovalHistoryPath
    ? pendingSummaryCards.filter((card) => HISTORY_VIEW_KEYS.has(card.key))
    : pendingSummaryCards.filter((card) => !HISTORY_VIEW_KEYS.has(card.key));

  const activePendingSummary = displayedSummaryCards.find((card) => card.key === activeReviewTab)
    || displayedSummaryCards[0];

  const handleSelectPendingTab = (tabKey) => {
    setActiveReviewTab(tabKey);
    if (tabKey === 'movements') {
      setActiveMovementTabIndex(0);
    }
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
    if (activeReviewTab === 'movements') {
      const activeMovementId = movementTabs[activeMovementTabIndex]?.id;
      if (activeMovementId === 'repairs' && repairLoadError) {
        return repairLoadError;
      }
      if (activeMovementId === 'transfers' || activeMovementId === 'disposals') {
        const movementError = [transferLoadError, disposalLoadError].filter(Boolean).join(' ');
        if (movementError) {
          return movementError;
        }
      }
    }
    if (transferLoadError && activeReviewTab === 'movements' && activeMovementTabId === 'transfers') {
      return transferLoadError;
    }
    if (disposalLoadError && activeReviewTab === 'movements' && activeMovementTabId === 'disposals') {
      return disposalLoadError;
    }
    if (itemLoadError && (activeReviewTab === 'item-recommend' || activeReviewTab === 'item-lab')) {
      return itemLoadError;
    }
    if ((activeReviewTab === 'accounts' || activeReviewTab === 'inventory')
      && (!departmentKey || departmentKey === 'department')) {
      return 'Your profile needs a department name to filter requests for your department.';
    }
    if (activeTabRows.length === 0) {
      if (HISTORY_VIEW_KEYS.has(activeReviewTab)) {
        return `No ${activePendingSummary.title.toLowerCase()} yet.`;
      }
      return `No pending requests in ${activePendingSummary.title.toLowerCase()}.`;
    }
    if (HISTORY_VIEW_KEYS.has(activeReviewTab)) {
      return `${activeTabRows.length} request${activeTabRows.length === 1 ? '' : 's'} in this list.`;
    }
    return `${activeTabRows.length} request${activeTabRows.length === 1 ? '' : 's'} awaiting your action.`;
  };

  const activeMovementTabId = movementTabs[activeMovementTabIndex]?.id;
  const activeTabRows = activeReviewTab === 'accounts'
    ? pendingAccountRows
    : activeReviewTab === 'inventory'
      ? pendingInventoryRows
      : activeReviewTab === 'movements'
        ? (activeMovementTabId === 'repairs'
          ? pendingRepairRows
          : activeMovementTabId === 'disposals'
            ? pendingDisposalRows
            : pendingTransferRows)
        : activeReviewTab === 'item-recommend'
          ? pendingItemRecommendRows
          : activeReviewTab === 'item-lab'
            ? pendingItemLabRows
            : activeReviewTab === 'forwarded'
              ? forwardedRows
              : rejectedRows;
  const activeTabColumns = activeReviewTab === 'accounts'
    ? accountColumns
    : activeReviewTab === 'inventory'
      ? inventoryColumns
      : activeReviewTab === 'movements'
        ? movementColumns
        : activeReviewTab === 'item-recommend'
          ? itemColumns
          : activeReviewTab === 'item-lab'
            ? itemColumns
            : historyColumns;

  return (
    <MainLayout variant="hod">
      <PageHeader
        title={isApprovalHistoryPath ? 'Approval History' : 'Pending Approvals / Recommendations'}
        subtitle={
          isApprovalHistoryPath
            ? 'View requests you already approved/recommended or rejected.'
            : 'Review account, inventory, transfer, disposal, and staff item requests awaiting your action.'
        }
      />

      <div className="p-6 space-y-6">
        {error ? (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <SummaryCardsGrid showTitle={false} gridClassName="md:grid-cols-2 xl:grid-cols-3">
          {displayedSummaryCards.map((card) => (
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

          {activeReviewTab === 'movements' ? (
            <div className="mb-4">
              <Tabs
                tabs={movementTabs.map((tab) => ({ label: tab.label }))}
                activeTab={activeMovementTabIndex}
                onChange={setActiveMovementTabIndex}
                className="border-b border-border-light"
              />
            </div>
          ) : null}

          <Table
            key={`${activeReviewTab}-${activeMovementTabIndex}`}
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
              {!HISTORY_VIEW_KEYS.has(activeReviewTab) ? (
                <>
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
                </>
              ) : null}
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
                    : selectedReviewRow?.source === 'transfer'
                      ? 'Transfer item'
                      : selectedReviewRow?.source === 'disposal'
                        ? 'Disposal item'
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

            {isSelectedChangeIncharge ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-dark" htmlFor="hod-selected-officer">
                  New inventory officer (HOD selection)
                </label>
                <select
                  id="hod-selected-officer"
                  className="w-full rounded border border-border-lighter px-3 py-2 text-sm"
                  value={selectedOfficerId}
                  onChange={(event) => {
                    setSelectedOfficerId(event.target.value);
                    setOfficerSelectionError('');
                  }}
                  disabled={officerCandidatesLoading || isSelectedRowLoading}
                >
                  <option value="">Select staff member</option>
                  {officerCandidates.map((user) => (
                    <option key={resolveUserId(user)} value={resolveUserId(user)}>
                      {user.name}
                      {user.designation ? ` (${user.designation})` : ''}
                    </option>
                  ))}
                </select>
                {officerCandidatesLoading ? (
                  <p className="text-xs text-text-light">Loading eligible staff...</p>
                ) : null}
                {!officerCandidatesLoading && officerCandidates.length === 0 ? (
                  <p className="text-xs text-text-light">
                    No eligible staff found in this department. Add an active Technical Officer or Management Assistant to continue.
                  </p>
                ) : null}
                {officerSelectionError ? (
                  <p className="text-xs text-red-700">{officerSelectionError}</p>
                ) : null}
              </div>
            ) : null}

            <p className="text-xs text-text-light">
              {HISTORY_VIEW_KEYS.has(activeReviewTab)
                ? 'This is a history record. Use this dialog to review details.'
                : selectedReviewRow?.source === 'transfer'
                  ? 'Recommend to forward this transfer to the registrar, or reject to decline it.'
                  : selectedReviewRow?.source === 'disposal'
                    ? 'Recommend to forward this disposal to the registrar, or reject to decline it.'
                    : selectedReviewRow?.source === 'item' && selectedItemActionType === 'recommend'
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

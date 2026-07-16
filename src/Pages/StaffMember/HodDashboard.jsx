import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../Components/Layouts/MainLayout';
import { PageHeader, SummaryCard, SummaryCardsGrid } from '../../Components/UI';
import {
  ACCOUNT_REQUEST_STATUS,
  ITEM_REQUEST_PENDING_REQUESTER_STATUSES,
  ITEM_REQUEST_STATUS,
} from '../../utils/constants';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const HOD_PENDING_INVENTORY_STATUSES = new Set(['pending_hod', 'pending_staff']);

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || '{}');
  } catch {
    return {};
  }
};

const getDepartmentName = (user) => user.departmentName || user.department || '';

const HodDashboard = () => {
  const navigate = useNavigate();
  const [inventoryCount, setInventoryCount] = useState(0);
  const [myIssuedCount, setMyIssuedCount] = useState(0);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError('');

        const storedUser = getStoredUser();
        const hodUserId = Number(storedUser.id ?? 0);
        const departmentKey = String(getDepartmentName(storedUser)).trim().toLowerCase();
        const hasHodUserId = Number.isInteger(hodUserId) && hodUserId > 0;

        const [
          accountResponse,
          inventoryRequestResponse,
          itemRecommendResponse,
          itemLabResponse,
          inventoriesResponse,
          issuedResponse,
        ] = await Promise.all([
          fetch(`${API_BASE_URL}/api/account-requests?requestType=account_creation,deactivation`),
          hasHodUserId
            ? fetch(`${API_BASE_URL}/api/inventory-creation-requests?hodUserId=${hodUserId}`)
            : Promise.resolve(null),
          hasHodUserId
            ? fetch(`${API_BASE_URL}/api/item-requests?requesterHodUserId=${hodUserId}`)
            : Promise.resolve(null),
          hasHodUserId
            ? fetch(`${API_BASE_URL}/api/item-requests?labHodUserId=${hodUserId}`)
            : Promise.resolve(null),
          fetch(`${API_BASE_URL}/api/inventories`),
          hasHodUserId
            ? fetch(`${API_BASE_URL}/api/item-requests?requestedById=${hodUserId}&requesterScope=issued`)
            : Promise.resolve(null),
        ]);

        const [
          accountData,
          inventoryRequestData,
          itemRecommendData,
          itemLabData,
          inventoriesData,
          issuedData,
        ] = await Promise.all([
          accountResponse.json().catch(() => ({})),
          inventoryRequestResponse ? inventoryRequestResponse.json().catch(() => ({})) : Promise.resolve({ success: true, requests: [] }),
          itemRecommendResponse ? itemRecommendResponse.json().catch(() => ({})) : Promise.resolve({ success: true, requests: [] }),
          itemLabResponse ? itemLabResponse.json().catch(() => ({})) : Promise.resolve({ success: true, requests: [] }),
          inventoriesResponse.json().catch(() => ({})),
          issuedResponse ? issuedResponse.json().catch(() => ({})) : Promise.resolve({ success: true, requests: [] }),
        ]);

        if (!accountResponse.ok || !accountData.success) {
          throw new Error(accountData.message || accountData.error || 'Failed to load account requests.');
        }

        if (!inventoriesResponse.ok || !inventoriesData.success) {
          throw new Error(inventoriesData.message || inventoriesData.error || 'Failed to load inventories.');
        }

        const accountRequests = accountData.requests || [];
        const inventoryRequests = (inventoryRequestResponse && inventoryRequestResponse.ok && inventoryRequestData.success)
          ? (inventoryRequestData.requests || [])
          : [];
        const itemRecommendRequests = (itemRecommendResponse && itemRecommendResponse.ok && itemRecommendData.success)
          ? (itemRecommendData.requests || [])
          : [];
        const itemLabRequests = (itemLabResponse && itemLabResponse.ok && itemLabData.success)
          ? (itemLabData.requests || [])
          : [];

        const departmentAccountRequests = departmentKey
          ? accountRequests.filter(
            (request) => String(request.department || '').trim().toLowerCase() === departmentKey
          )
          : [];

        const departmentInventoryRequests = departmentKey
          ? inventoryRequests.filter(
            (request) => String(request.department || '').trim().toLowerCase() === departmentKey
          )
          : [];

        const pendingAccounts = departmentAccountRequests.filter(
          (request) => request.approvalStatus === ACCOUNT_REQUEST_STATUS.PENDING_DEPT_HEAD
        ).length;

        const pendingInventories = departmentInventoryRequests.filter(
          (request) => HOD_PENDING_INVENTORY_STATUSES.has(String(request.approvalStatus || '').toLowerCase())
        ).length;

        const pendingRecommendItems = itemRecommendRequests.filter(
          (request) => ITEM_REQUEST_PENDING_REQUESTER_STATUSES.has(String(request.approvalStatus || '').toLowerCase())
        ).length;

        const pendingLabItems = itemLabRequests.filter(
          (request) => String(request.approvalStatus || '').toLowerCase() === ITEM_REQUEST_STATUS.PENDING_LAB_HOD
        ).length;

        const allInventories = inventoriesData.inventories || [];
        const departmentInventories = departmentKey
          ? allInventories.filter(
            (inventory) => String(inventory.department || '').trim().toLowerCase() === departmentKey
          )
          : allInventories;

        const issuedCount = (issuedResponse && issuedResponse.ok && issuedData.success)
          ? (issuedData.requests || []).length
          : 0;

        if (!isMounted) {
          return;
        }

        setInventoryCount(departmentInventories.length);
        setMyIssuedCount(issuedCount);
        setPendingTasksCount(pendingAccounts + pendingInventories + pendingRecommendItems + pendingLabItems);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setInventoryCount(0);
        setMyIssuedCount(0);
        setPendingTasksCount(0);
        setError(loadError.message || 'Failed to load dashboard data.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const stats = useMemo(() => ([
    {
      key: 'inventories',
      title: 'Inventories',
      count: inventoryCount,
      description: 'View department inventories and item details.',
      icon: 'inventory_2',
      onClick: () => navigate('/hod/inventory'),
    },
    {
      key: 'issued',
      title: 'My Issued items',
      count: myIssuedCount,
      description: 'Items currently issued to your account.',
      icon: 'inventory',
      onClick: () => navigate('/inventory/list/hod'),
    },
    {
      key: 'pending',
      title: 'Pending Tasks',
      count: pendingTasksCount,
      description: 'Requests waiting for your approval or recommendation.',
      icon: 'pending_actions',
      onClick: () => navigate('/hod/pending-tasks'),
    },
  ]), [inventoryCount, myIssuedCount, pendingTasksCount, navigate]);

  return (
    <MainLayout variant="hod">
      <PageHeader
        title="Dashboard"
        subtitle="Track inventories, issued items, and pending approvals at a glance."
      />

      <div className="p-6 space-y-6">
        {error ? (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <SummaryCardsGrid showTitle={false} columns={3}>
          {stats.map((stat) => (
            <SummaryCard
              key={stat.key}
              title={stat.title}
              count={stat.count}
              description={stat.description}
              icon={stat.icon}
              loading={loading}
              onClick={stat.onClick}
            />
          ))}
        </SummaryCardsGrid>
      </div>
    </MainLayout>
  );
};

export default HodDashboard;

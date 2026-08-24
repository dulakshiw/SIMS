import React, { useEffect, useMemo, useState } from 'react';
import MainLayout from '../../Components/Layouts/MainLayout';
import { Badge, Card, EntityDetailsModal, PageHeader, Table } from '../../Components/UI';
import { ROLE_HIERARCHY } from '../../utils/constants';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || '{}');
  } catch {
    return {};
  }
};

const normalizeStatus = (status) => String(status || '').toLowerCase();

const StaffDirectory = ({ viewerRole }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const storedUser = getStoredUser();

    const loadUsers = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await fetch(
          `${API_BASE_URL}/api/staff-directory?viewerRole=${encodeURIComponent(viewerRole)}&viewerUserId=${encodeURIComponent(storedUser.id || '')}`
        );
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          throw new Error(data.message || data.error || 'Failed to load users.');
        }

        if (isMounted) {
          setUsers(data.users || []);
        }
      } catch (loadError) {
        if (isMounted) {
          setUsers([]);
          setError(loadError.message || 'Failed to load users.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUsers();
    return () => {
      isMounted = false;
    };
  }, [viewerRole]);

  const columns = useMemo(() => [
    { field: 'name', label: 'Name', sortable: true },
    { field: 'email', label: 'Email', sortable: true },
    { field: 'department', label: 'Department', sortable: true },
    { field: 'designation', label: 'Designation', sortable: true },
    {
      field: 'role',
      label: 'Role',
      render: (value) => (
        <Badge label={ROLE_HIERARCHY[value]?.label || value || 'User'} variant="primary" size="sm" />
      ),
    },
    {
      field: 'status',
      label: 'Status',
      render: (value) => {
        const status = normalizeStatus(value);
        return <Badge label={status.charAt(0).toUpperCase() + status.slice(1)} variant={status === 'active' ? 'success' : 'warning'} size="sm" />;
      },
    },
  ], []);

  const title = viewerRole === 'dean' ? 'Faculty Users' : 'Department Users';
  const subtitle = viewerRole === 'dean'
    ? 'View users and account details across the faculty.'
    : 'View users and account details in your department.';

  return (
    <MainLayout variant={viewerRole === 'dean' ? 'dean' : 'hod'}>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="p-6 space-y-6">
        {error ? (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>
        ) : null}
        <Card title={title} icon="group">
          <Table
            columns={columns}
            data={users}
            loading={loading}
            onRowClick={setSelectedUser}
            paginated
            itemsPerPage={10}
          />
        </Card>
      </div>
      <EntityDetailsModal
        isOpen={Boolean(selectedUser)}
        onClose={() => setSelectedUser(null)}
        title={`User Details${selectedUser?.name ? ` - ${selectedUser.name}` : ''}`}
        selectedName={selectedUser?.name}
        details={[
          { label: 'Email', value: selectedUser?.email },
          { label: 'Role', value: ROLE_HIERARCHY[selectedUser?.role]?.label || selectedUser?.role },
          { label: 'Department', value: selectedUser?.department },
          { label: 'Designation', value: selectedUser?.designation },
          { label: 'Status', value: selectedUser?.status },
          { label: 'Mobile No', value: selectedUser?.mobileNo },
          { label: 'Office Extension', value: selectedUser?.officeExtNo },
          { label: 'Location', value: selectedUser?.location },
          { label: 'Created Date', value: selectedUser?.createdDate },
          { label: 'Last Login', value: selectedUser?.lastLogin },
          { label: 'User ID', value: selectedUser?.id },
        ]}
      />
    </MainLayout>
  );
};

export default StaffDirectory;

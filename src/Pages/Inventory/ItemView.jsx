import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import MainLayout from "../../Components/Layouts/MainLayout";
import { PageHeader } from "../../Components/UI";
import { resolveSidebarVariant } from "../../utils/helpers";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

// Very small client-side QR view helper. In a real app this should
// fetch item details by identifier from backend and apply real auth.
const ItemView = () => {
  const location = useLocation();
  const { role } = useParams();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') || ''; // expected format: CODE_serial
  const inchargeParam = params.get('incharge') || '';

  const currentUser = (window.currentUser && window.currentUser.name) || 'Alice';

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadItem = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await fetch(`${API_BASE_URL}/api/items/scan?q=${encodeURIComponent(q)}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data.error || data.message || 'Unable to load the scanned item.');
        }
        if (isMounted) setItem(data.item);
      } catch (loadError) {
        if (isMounted) {
          setItem(null);
          setError(loadError.message || 'Unable to load the scanned item.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (q) loadItem();
    else {
      setError('No QR item code was provided.');
      setLoading(false);
    }

    return () => { isMounted = false; };
  }, [q]);

  const isInventoryOfficer = item?.incharge === inchargeParam || item?.incharge === currentUser;

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader title="Scanned Item" subtitle={`QR payload: ${q || '-'}`} />

      <div className="p-6">
        {loading && <div className="bg-white p-4 rounded-lg border">Loading scanned item...</div>}
        {!loading && error && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{error}</div>}
        {!loading && item && (
        <div className="bg-white p-4 rounded-lg border">
          <h2 className="text-lg font-semibold">{item.itemName}</h2>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div><span className="font-semibold">Inventory Name:</span> {item.inventoryName || '-'}</div>
            <div><span className="font-semibold">Department:</span> {item.department || '-'}</div>
            <div><span className="font-semibold">Incharge:</span> {item.incharge || inchargeParam || '-'}</div>
          </div>

          {isInventoryOfficer ? (
            <div className="mt-4 space-y-2">
              <div>Code: {item.itemCode}</div>
              <div>Serial: {item.serialNo}</div>
              <div>Model: {item.model}</div>
              <div>Value: {item.value}</div>
              <div>Location: {item.location}</div>
              <div>Remarks: {item.remarks}</div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-text-light">
              Only the inventory name and inventory officer are visible to you.
            </div>
          )}
        </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ItemView;

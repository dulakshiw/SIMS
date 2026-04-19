import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import MainLayout from "../../Components/Layouts/MainLayout";
import { Card, Button, PageHeader } from "../../Components/UI";
import { resolveSidebarVariant } from "../../utils/helpers";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const ItemDetail = () => {
  const { id, role } = useParams();
  const location = useLocation();
  const sidebarVariant = resolveSidebarVariant(location.pathname, role);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/items/${id}`);
        const data = await res.json();
        if (!mounted) return;
        if (res.ok) setItem(data.item);
        else setItem(null);
      } catch (err) {
        console.error(err);
        setItem(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (loading) return (
    <MainLayout variant={sidebarVariant}>
      <div className="p-6">Loading...</div>
    </MainLayout>
  );

  if (!item) return (
    <MainLayout variant={sidebarVariant}>
      <div className="p-6">Item not found.</div>
    </MainLayout>
  );

  // Simulated current user (replace with real auth lookup)
  const currentUser = (window.currentUser && window.currentUser.name) || 'Alice';
  const isInventoryOfficer = item.receivedfrom === currentUser || item.incharge === currentUser;

  return (
    <MainLayout variant={sidebarVariant}>
      <PageHeader
        title={item.itemName || item.name || 'Item Details'}
        subtitle={`ID: ${item.id}`}
        actions={
          <>
            <Button onClick={() => window.history.back()} variant="secondary">Back</Button>
            <Button onClick={() => window.print()} variant="primary">Print</Button>
          </>
        }
      />

      <div className="p-6">
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div><strong>Item Code:</strong> {item.itemCode || item.code || '-'}</div>
              <div><strong>Serial No:</strong> {item.serialNo || item.serial || '-'}</div>
              <div><strong>Serial No 2:</strong> {item.serialNo2 || '-'}</div>
              <div><strong>Model:</strong> {item.model || '-'}</div>
              <div><strong>Value:</strong> {item.value || '-'}</div>
              <div><strong>Purchase Date:</strong> {item.purchaseDate || '-'}</div>
            </div>

            <div className="space-y-2">
              <div><strong>Supplier:</strong> {item.supplier || '-'}</div>
              <div><strong>Funding:</strong> {item.funding || '-'}</div>
              <div><strong>GIN No:</strong> {item.ginNo || '-'}</div>
              <div><strong>Location:</strong> {item.location || '-'}</div>
              <div><strong>Inventory Officer / Received From:</strong> {item.receivedfrom || item.incharge || '-'}</div>
            </div>

            <div className="col-span-1 md:col-span-2 space-y-2">
              <div><strong>Remarks:</strong></div>
              <div className="whitespace-pre-wrap">{item.remarks || '-'}</div>
            </div>

            {isInventoryOfficer && (
              <>
                <div className="col-span-1 md:col-span-2">
                  <h3 className="text-lg font-semibold">Confidential Details (Inventory Officer only)</h3>
                  <div><strong>QR Code:</strong> {item.QRCode || item.qrcode || '-'}</div>
                  <div><strong>QR Code 2:</strong> {item.QRCode2 || item.qrcode2 || '-'}</div>
                  <div><strong>GIN File:</strong> {item.ginfile || '-'}</div>
                  <div><strong>Image:</strong> {item.itemImage || '-'}</div>
                </div>
              </>
            )}

            {!isInventoryOfficer && (
              <div className="col-span-1 md:col-span-2 text-sm text-text-light">
                Only the inventory name and inventory officer are visible to you.
              </div>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
};

export default ItemDetail;

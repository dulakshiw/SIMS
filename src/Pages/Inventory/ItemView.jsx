import React from 'react';
import MainLayout from "../../Components/Layouts/MainLayout";

// Very small client-side QR view helper. In a real app this should
// fetch item details by identifier from backend and apply real auth.
const ItemView = () => {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') || ''; // expected format: CODE_serial
  const inchargeParam = params.get('incharge') || '';

  // Simulated current user (replace with real auth lookup)
  const currentUser = (window.currentUser && window.currentUser.name) || 'Alice';

  const [code, serial] = q.split('_');

  // Mock item data derived from QR payload
  const item = {
    itemName: code ? `Item for ${code}` : 'Unknown Item',
    itemCode: code || '',
    serialNo: serial || '',
    model: 'Model X',
    value: '5000',
    location: 'Building A',
    incharge: inchargeParam || 'Unassigned',
    remarks: 'No additional remarks.'
  };

  const isIncharge = item.incharge === currentUser;

  return (
    <MainLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold">Scanned Item</h1>
        <p className="text-sm text-text-light mt-2">QR payload: {q}</p>

        <div className="mt-6 bg-white p-4 rounded-lg border">
          <h2 className="text-lg font-semibold">{item.itemName}</h2>
          <p className="text-sm text-text-light">Incharge: {item.incharge}</p>

          {isIncharge ? (
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
              Only the inventory name and incharge are visible to you.
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default ItemView;

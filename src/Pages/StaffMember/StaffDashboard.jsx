import React from 'react'
import MainLayout from '../../Components/Layouts/MainLayout'
import { Card, Button } from '../../Components/UI'
import { canRequestItems, canManageInventoryItems } from '../../utils/permissionUtils'

const StaffDashboard = () => {
    // In a real app role comes from auth
    const userRole = 'staff'

    const stats = {
        myRequests: 2,
        availableItems: 240,
    }

    const mockRecent = [
        { item: 'Projector Epson X200', action: 'Requested', date: '2024-01-20' },
        { item: 'Whiteboard', action: 'Returned', date: '2024-01-18' },
    ]

    return (
        <MainLayout>
            <div className="gradient-primary py-6 rounded-t">
                <div className="max-w-7xl mx-auto px-6">
                    <h1 className="text-3xl font-bold text-white">Staff Dashboard</h1>
                    <p className="text-sm text-primary-50 mt-1">Request items and browse inventories available to you</p>
                </div>
            </div>

            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <Card title="My Requests" icon="receipt_long">
                        <p className="text-3xl font-bold text-primary-800">{stats.myRequests}</p>
                    </Card>
                    <Card title="Available Items" icon="inventory_2">
                        <p className="text-3xl font-bold text-primary-800">{stats.availableItems}</p>
                    </Card>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md border border-border-lighter mb-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex gap-3">
                            {canRequestItems(userRole) && (
                                <Button variant="primary" onClick={() => console.log('Create item request')} icon="add_circle">Request Item</Button>
                            )}
                            <Button onClick={() => console.log('View my requests')}>My Requests</Button>
                        </div>

                        {canManageInventoryItems('inventory_incharge') && (
                            <div className="flex gap-3">
                                <Button variant="secondary" onClick={() => console.log('Manage items (incharge)')}>Manage Items</Button>
                                <Button onClick={() => console.log('Approve requests (incharge)')}>Approve Requests</Button>
                            </div>
                        )}
                    </div>
                </div>

                <Card title="Recent Activity" icon="history">
                    <div className="space-y-3">
                        {mockRecent.map((r, i) => (
                            <div key={i} className="flex items-center justify-between p-3 border-b border-border-lighter last:border-0">
                                <div>
                                    <p className="font-medium text-text-dark">{r.item}</p>
                                    <p className="text-sm text-text-light">{r.action}</p>
                                </div>
                                <span className="text-sm text-text-light">{r.date}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </MainLayout>
    )
}

export default StaffDashboard
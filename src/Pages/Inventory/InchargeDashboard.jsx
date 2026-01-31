import React from 'react'
import MainLayout from '../../Components/Layouts/MainLayout'
import { Card, Button } from '../../Components/UI'

const InchargeDashboard = () => {
    const username = 'Inventory In-Charge'

    const mockStats = [
        { title: 'Total Assets', value: '425', icon: 'inventory_2', color: 'primary-800' },
        { title: 'Available', value: '320', icon: 'check_circle', color: 'success' },
        { title: 'In Use', value: '95', icon: 'assignment', color: 'info' },
        { title: 'Pending Requests', value: '12', icon: 'request_quote', color: 'warning' },
    ]

    const mockRecentActivity = [
        { item: 'Laptop Dell XPS 13', action: 'Added', date: '2024-01-15' },
        { item: 'Office Chair', action: 'Transferred', date: '2024-01-10' },
        { item: 'Printer HP M433', action: 'Maintenance', date: '2024-01-12' },
    ]

    return (
        <MainLayout>
            <div className="gradient-primary py-6 rounded-t">
                <div className="max-w-7xl mx-auto px-6">
                    <h1 className="text-3xl font-bold text-white">Inventory Dashboard</h1>
                    <p className="text-sm text-primary-50 mt-1">Overview of your inventory management system</p>
                </div>
            </div>

            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {mockStats.map((stat, index) => (
                        <Card key={index} icon={stat.icon}>
                            <p className="text-sm text-text-light">{stat.title}</p>
                            <p className={`text-3xl font-bold ${stat.color === 'success' ? 'text-success' : stat.color === 'info' ? 'text-info' : 'text-primary-800'} mt-2`}>{stat.value}</p>
                        </Card>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <Button fullWidth variant="primary" icon="add_circle">
                        Add New Item
                    </Button>
                    <Button fullWidth variant="secondary" icon="compare_arrows">
                        Create Transfer
                    </Button>
                    <Button fullWidth variant="secondary" icon="delete_sweep">
                        Create Disposal
                    </Button>
                    <Button fullWidth variant="secondary" icon="request_quote">
                        Create Request
                    </Button>
                </div>

                <Card title="Recent Activity" icon="history">
                    <div className="space-y-3">
                        {mockRecentActivity.map((activity, index) => (
                            <div key={index} className="flex items-center justify-between p-3 border-b border-border-lighter last:border-0">
                                <div>
                                    <p className="font-medium text-text-dark">{activity.item}</p>
                                    <p className="text-sm text-text-light">{activity.action}</p>
                                </div>
                                <span className="text-sm text-text-light">{activity.date}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </MainLayout>
    )
}

export default InchargeDashboard




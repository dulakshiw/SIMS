import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import MainLayout from '../../Components/Layouts/MainLayout'
import { Card, Button } from '../../Components/UI'

const InchargeDashboard = () => {
    const location = useLocation()
    const sidebarVariant = location.pathname.startsWith('/incharge') ? 'incharge' : 'inventory'
    const [summary, setSummary] = useState({
        totalAssets: 0,
        available: 0,
        inUse: 0,
        pendingRequests: 0,
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let isMounted = true

        const loadSummary = async () => {
            try {
                setLoading(true)
                setError('')
                const response = await fetch('/api/dashboard/summary')
                const data = await response.json()

                if (!response.ok || !data.success) {
                    throw new Error(data.error || 'Failed to load inventory dashboard summary.')
                }

                if (isMounted) {
                    setSummary(data.inventorySummary || {})
                }
            } catch (fetchError) {
                console.error('Failed to load inventory dashboard summary:', fetchError)
                if (isMounted) {
                    setError(fetchError.message || 'Unable to load inventory dashboard summary.')
                }
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        loadSummary()
        return () => {
            isMounted = false
        }
    }, [])

    const dashboardStats = [
        { title: 'Total Assets', value: summary.totalAssets ?? 0, icon: 'inventory_2', colorClass: 'text-primary-800' },
        { title: 'Available', value: summary.available ?? 0, icon: 'check_circle', colorClass: 'text-success' },
        { title: 'In Use', value: summary.inUse ?? 0, icon: 'assignment', colorClass: 'text-info' },
        { title: 'Pending Requests', value: summary.pendingRequests ?? 0, icon: 'request_quote', colorClass: 'text-warning' },
    ]

    const mockRecentActivity = [
        { item: 'Laptop Dell XPS 13', action: 'Added', date: '2026-01-15' },
        { item: 'Office Chair', action: 'Transferred', date: '2026-01-18' },
        { item: 'Printer HP M433', action: 'Under Repair', date: '2026-01-12' },
    ]

    return (
        <MainLayout variant={sidebarVariant}>
            <div className="gradient-primary py-6 rounded-t">
                <div className="max-w-7xl mx-auto px-6">
                    <h1 className="text-3xl font-bold text-white">Inventory Dashboard</h1>
                    <p className="text-sm text-primary-50 mt-1">Overview of your inventory management system</p>
                </div>
            </div>

            <div className="p-6">
                {error && (
                    <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {dashboardStats.map((stat, index) => (
                        <Card key={index} icon={stat.icon}>
                            <p className="text-sm text-text-light">{stat.title}</p>
                            <p className={`text-3xl font-bold mt-2 ${stat.colorClass}`}>{loading ? '...' : stat.value}</p>
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




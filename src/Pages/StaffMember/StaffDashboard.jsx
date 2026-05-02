import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import MainLayout from '../../Components/Layouts/MainLayout'
import { Card, Button, PageHeader } from '../../Components/UI'
import { canRequestItems } from '../../utils/permissionUtils'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'
const ALLOWED_INVENTORY_REQUEST_DESIGNATIONS = new Set(['Technical Officer', 'Management Assistant'])

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || '{}')
  } catch {
    return {}
  }
}

const getTimeOfDayGreeting = () => {
  const hour = new Date().getHours()

  if (hour < 12) {
    return 'Good morning'
  }

  if (hour < 18) {
    return 'Good afternoon'
  }

  return 'Good evening'
}

const getLastName = (fullName = 'User') => {
  const nameParts = String(fullName).trim().split(/\s+/).filter(Boolean)
  return nameParts[nameParts.length - 1] || 'User'
}

const StaffDashboard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [currentUser, setCurrentUser] = useState(getStoredUser)
  const userRole = currentUser.role || (Number(currentUser.assignedInventoryCount ?? 0) > 0 ? 'inventory_incharge' : '') || localStorage.getItem('userRole') || 'staff'
  const isInventoryOfficer = userRole === 'inventory_incharge'
  const userDesignation = String(currentUser.designation || '').trim()
  const greeting = `${getTimeOfDayGreeting()} ${getLastName(currentUser.name || localStorage.getItem('username') || 'User')}`
  const canRequestInventoryCreation = ['staff', 'inventory_incharge'].includes(userRole) && ALLOWED_INVENTORY_REQUEST_DESIGNATIONS.has(userDesignation)
  const [inventorySummary, setInventorySummary] = useState({
    totalAssets: 0,
    available: 0,
    inUse: 0,
    pendingRequests: 0,
  })
  const [assignedInventories, setAssignedInventories] = useState([])
  const [inventoryError, setInventoryError] = useState('')
  const [inventoryLoading, setInventoryLoading] = useState(false)

  useEffect(() => {
    let isMounted = true
    const storedUser = getStoredUser()

    setCurrentUser(storedUser)

    if (!storedUser?.email && !storedUser?.id) {
      return undefined
    }

    const searchParams = new URLSearchParams()

    if (storedUser.email) {
      searchParams.set('email', storedUser.email)
    } else if (storedUser.id) {
      searchParams.set('userId', storedUser.id)
    }

    const loadEffectiveProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/profile?${searchParams.toString()}`)
        const data = await response.json().catch(() => ({}))

        if (!response.ok || !data.success || !isMounted) {
          return
        }

        const profile = data.profile || {}
        const nextRole = profile.role || storedUser.role || localStorage.getItem('userRole') || 'staff'
        const nextUser = { ...storedUser, ...profile, role: nextRole }

        localStorage.setItem('currentUser', JSON.stringify(nextUser))
        localStorage.setItem('userRole', nextRole)
        if (nextUser.name) {
          localStorage.setItem('username', nextUser.name)
        }
        window.currentUser = nextUser
        setCurrentUser(nextUser)
      } catch {
        // Fall back to the locally stored user if the refresh fails.
      }
    }

    loadEffectiveProfile()

    return () => {
      isMounted = false
    }
  }, [])

  const stats = {
    myRequests: 2,
    availableItems: 240,
    myIssuedItems: 0,
  }

  const mockRecent = [
    { item: 'Projector Epson X200', action: 'Requested', date: '2024-01-20' },
    { item: 'Whiteboard', action: 'Returned', date: '2024-01-18' },
  ]

  useEffect(() => {
    if (!isInventoryOfficer) {
      return undefined
    }

    let isMounted = true

    const loadInventoryFeatures = async () => {
      try {
        setInventoryLoading(true)
        setInventoryError('')

        const [summaryResponse, inventoriesResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/dashboard/summary`),
          fetch(`${API_BASE_URL}/api/inventories`),
        ])

        const [summaryData, inventoriesData] = await Promise.all([
          summaryResponse.json(),
          inventoriesResponse.json(),
        ])

        if (!summaryResponse.ok || !summaryData.success) {
          throw new Error(summaryData.error || 'Failed to load inventory dashboard summary.')
        }

        if (!inventoriesResponse.ok || !inventoriesData.success) {
          throw new Error(inventoriesData.error || 'Failed to load assigned inventories.')
        }

        if (!isMounted) {
          return
        }

        setInventorySummary(summaryData.inventorySummary || {})
        setAssignedInventories(
          (inventoriesData.inventories || []).filter(
            (inventory) => String(inventory.inchargeId) === String(storedUser.id)
          )
        )
      } catch (error) {
        if (isMounted) {
          setInventoryError(error.message || 'Failed to load inventory features.')
          setAssignedInventories([])
        }
      } finally {
        if (isMounted) {
          setInventoryLoading(false)
        }
      }
    }

    loadInventoryFeatures()

    return () => {
      isMounted = false
    }
  }, [currentUser.id, isInventoryOfficer])

  const managedInventoryCount = Number(currentUser.assignedInventoryCount ?? 0)
  const assignedInventoryCount = Math.max(assignedInventories.length, managedInventoryCount)
  const isManagingInventory = assignedInventoryCount > 0

  return (
    <MainLayout variant="staff">
      <PageHeader
        title={greeting}
        subtitle={isInventoryOfficer ? 'You can use your account for both staff requests and inventory management.' : 'Request items and view details of items issued to you'}
      />

      <div className="p-6">
        <div className={`grid grid-cols-1 md:grid-cols-2 ${(isInventoryOfficer || isManagingInventory) ? 'lg:grid-cols-3' : ''} gap-6 mb-6`}>
          <Card title="My Requests" icon="receipt_long">
            <p className="text-3xl font-bold text-primary-800">{stats.myRequests}</p>
          </Card>
          <Card title="My Issued Items" icon="">
            <p className="text-3xl font-bold text-primary-800">{stats.myIssuedItems}</p>
          </Card>
          {(isInventoryOfficer || isManagingInventory) && (
            <Card title="Assigned Inventories" icon="inventory">
              <p className="text-3xl font-bold text-primary-800">{assignedInventoryCount}</p>
            </Card>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-border-lighter mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex gap-3">
              {canRequestItems(userRole) && (
                <Button variant="primary" onClick={() => navigate('/inventory/requests/new/staff')} icon="add_circle">Request Item</Button>
              )}
              <Button onClick={() => navigate('/requests/my/staff')}>My Requests</Button>
            </div>
            {canRequestInventoryCreation && (
              <Button
                variant="primary"
                onClick={() => navigate(`/requests/inventory/staff`)}
                icon="playlist_add"
              >
                Add Inventory
              </Button>
            )}
            {canRequestInventoryCreation && (
              <Button
                variant="primary"
                onClick={() => navigate(`/requests/inventory/staff`)}
                icon="playlist_add"
              >
                New Inventory Creation
              </Button>
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
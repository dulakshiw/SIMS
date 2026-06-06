import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import MainLayout from '../../Components/Layouts/MainLayout'
import { Card, Button, PageHeader, SummaryCard, SummaryCardsGrid } from '../../Components/UI'
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

const StaffDashboard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [currentUser, setCurrentUser] = useState(getStoredUser)
  const userRole = currentUser.role || (Number(currentUser.assignedInventoryCount ?? 0) > 0 ? 'inventory_incharge' : '') || localStorage.getItem('userRole') || 'staff'
  const isInventoryOfficer = userRole === 'inventory_incharge'
  const userDesignation = String(currentUser.designation || '').trim()
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

  const [requestStats, setRequestStats] = useState({ myRequests: 0, myIssuedItems: 0 })
  const [requestStatsLoading, setRequestStatsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    const userId = Number(currentUser.id ?? 0)

    if (!Number.isInteger(userId) || userId <= 0) {
      setRequestStats({ myRequests: 0, myIssuedItems: 0 })
      setRequestStatsLoading(false)
      return undefined
    }

    const loadRequestStats = async () => {
      try {
        setRequestStatsLoading(true)

        const [allResponse, issuedResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/item-requests?requestedById=${userId}`),
          fetch(`${API_BASE_URL}/api/item-requests?requestedById=${userId}&requesterScope=issued`),
        ])

        const [allData, issuedData] = await Promise.all([
          allResponse.json().catch(() => ({})),
          issuedResponse.json().catch(() => ({})),
        ])

        if (!isMounted) {
          return
        }

        const allRequests = allResponse.ok && allData.success ? allData.requests || [] : []
        const issuedRequests = issuedResponse.ok && issuedData.success ? issuedData.requests || [] : []

        setRequestStats({
          myRequests: allRequests.length,
          myIssuedItems: issuedRequests.filter(
            (request) => String(request.approvalStatus || '').toLowerCase() === 'approved'
          ).length,
        })
      } catch {
        if (isMounted) {
          setRequestStats({ myRequests: 0, myIssuedItems: 0 })
        }
      } finally {
        if (isMounted) {
          setRequestStatsLoading(false)
        }
      }
    }

    loadRequestStats()

    return () => {
      isMounted = false
    }
  }, [currentUser.id])

  useEffect(() => {
    if (!isInventoryOfficer) {
      return undefined
    }

    let isMounted = true
    const storedUser = getStoredUser()

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
        title="Dashboard"
        subtitle={isInventoryOfficer ? 'You can use your account for both staff requests and inventory management.' : 'Request items and view details of items issued to you'}
      />

      <div className="p-6">
        <SummaryCardsGrid showTitle={false} columns={(isInventoryOfficer || isManagingInventory) ? 3 : 2} className="mb-6">
          <SummaryCard
            title="My Requests"
            count={requestStats.myRequests}
            description="Item requests you have submitted."
            icon="receipt_long"
            loading={requestStatsLoading}
            onClick={() => navigate('/requests/my/staff')}
          />
          <SummaryCard
            title="My Issued Items"
            count={requestStats.myIssuedItems}
            description="Items currently issued to you."
            icon="inventory"
            loading={requestStatsLoading}
            onClick={() => navigate('/inventory/list/staff')}
          />
          {(isInventoryOfficer || isManagingInventory) && (
            <SummaryCard
              title="Assigned Inventories"
              count={assignedInventoryCount}
              description="Inventories you manage as officer."
              icon="inventory_2"
              hover={false}
            />
          )}
        </SummaryCardsGrid>

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
                Add New Inventory
              </Button>
            )}
          </div>
        </div>

        <Card title="Recent Activity" icon="history">
          <p className="text-sm text-text-light">No recent activity yet.</p>
        </Card>
      </div>
    </MainLayout>
  )
}

export default StaffDashboard
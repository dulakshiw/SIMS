import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../Components/Layouts/MainLayout'
import { Card, Button, FormInput, Modal, PageHeader } from '../../Components/UI'
import { canRequestItems } from '../../utils/permissionUtils'
import { INVENTORY_REQUEST_TYPE } from '../../utils/constants'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
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
  const [currentUser, setCurrentUser] = useState(getStoredUser)
  const userRole = currentUser.role || (Number(currentUser.assignedInventoryCount ?? 0) > 0 ? 'inventory_incharge' : '') || localStorage.getItem('userRole') || 'staff'
  const isInventoryOfficer = userRole === 'inventory_incharge'
  const userDesignation = String(currentUser.designation || '').trim()
  const greeting = `${getTimeOfDayGreeting()} ${getLastName(currentUser.name || localStorage.getItem('username') || 'User')}`
  const canRequestInventoryCreation = ['staff', 'inventory_incharge'].includes(userRole) && ALLOWED_INVENTORY_REQUEST_DESIGNATIONS.has(userDesignation)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [activeRequestType, setActiveRequestType] = useState(INVENTORY_REQUEST_TYPE.ADD_EXISTING)
  const [users, setUsers] = useState([])
  const [requestError, setRequestError] = useState('')
  const [requestMessage, setRequestMessage] = useState('')
  const [optionsError, setOptionsError] = useState('')
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)
  const [inventorySummary, setInventorySummary] = useState({
    totalAssets: 0,
    available: 0,
    inUse: 0,
    pendingRequests: 0,
  })
  const [assignedInventories, setAssignedInventories] = useState([])
  const [inventoryError, setInventoryError] = useState('')
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    department: currentUser.department || '',
    incharge: '',
    Hod: '',
    description: '',
  })

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
    if (!canRequestInventoryCreation) {
      return undefined
    }

    let isMounted = true

    const loadFormOptions = async () => {
      try {
        setOptionsError('')

        const usersResponse = await fetch(`${API_BASE_URL}/api/users`)

        const usersData = await usersResponse.json()

        if (!usersResponse.ok || !usersData.success) {
          throw new Error(usersData.error || usersData.message || 'Failed to load users.')
        }

        if (!isMounted) {
          return
        }

        setUsers(usersData.users || [])
      } catch (error) {
        if (isMounted) {
          setUsers([])
          setOptionsError(error.message || 'Failed to load account details for inventory request.')
        }
      }
    }

    loadFormOptions()

    return () => {
      isMounted = false
    }
  }, [canRequestInventoryCreation])

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

  const currentUserRecord = useMemo(
    () =>
      users.find(
        (user) =>
          (currentUser.id && String(user.id) === String(currentUser.id)) ||
          (currentUser.email && String(user.email || '').toLowerCase() === String(currentUser.email).toLowerCase())
      ) || null,
    [currentUser.email, currentUser.id, users]
  )

  const accountDepartment = currentUser.department || currentUserRecord?.department || ''
  const accountHolderName = currentUser.name || currentUserRecord?.name || ''
  const accountInchargeId = Number(currentUser.id || currentUserRecord?.id || 0)

  const departmentHodLookup = useMemo(
    () =>
      users.reduce((lookup, user) => {
        if (user.role === 'head_of_department' && user.department) {
          lookup[user.department] = { id: user.id, name: user.name }
        }

        return lookup
      }, {}),
    [users]
  )

  const assignedHod = departmentHodLookup[accountDepartment]

  useEffect(() => {
    const nextDepartment = accountDepartment
    const nextIncharge = accountInchargeId > 0 ? String(accountInchargeId) : ''
    const nextHod = assignedHod?.name || ''

    if (formData.department !== nextDepartment || formData.incharge !== nextIncharge || formData.Hod !== nextHod) {
      setFormData((prev) => ({
        ...prev,
        department: nextDepartment,
        incharge: nextIncharge,
        Hod: nextHod,
      }))
    }
  }, [accountDepartment, accountInchargeId, assignedHod?.name, formData.Hod, formData.department, formData.incharge])

  const resetRequestForm = () => {
    setFormData({
      name: '',
      location: '',
      department: accountDepartment,
      incharge: accountInchargeId > 0 ? String(accountInchargeId) : '',
      Hod: assignedHod?.name || '',
      description: '',
    })
    setRequestError('')
    setRequestMessage('')
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleInventoryRequestSubmit = async (e) => {
    e?.preventDefault()
    setRequestError('')
    setRequestMessage('')

    try {
      setIsSubmittingRequest(true)

      const payload = {
        requestedById: currentUser.id,
        requestType: activeRequestType,
        name: formData.name.trim(),
        location: formData.location.trim(),
        department: accountDepartment,
        inchargeId: accountInchargeId,
        hodUserId: assignedHod?.id || null,
        description: formData.description.trim(),
      }

      const response = await fetch(`${API_BASE_URL}/api/inventory-creation-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to submit inventory creation request.')
      }

      setRequestMessage(
        data.message ||
          (activeRequestType === INVENTORY_REQUEST_TYPE.ADD_EXISTING
            ? 'Inventory addition request submitted to your Head of Department for approval.'
            : 'New inventory creation request submitted for approval.')
      )
      setIsRequestModalOpen(false)
      resetRequestForm()
    } catch (error) {
      setRequestError(error.message || 'Failed to submit inventory creation request.')
    } finally {
      setIsSubmittingRequest(false)
    }
  }

  const requestModalFooter = (
    <div className="flex gap-3 justify-end">
      <Button variant="secondary" onClick={() => {
        setIsRequestModalOpen(false)
        resetRequestForm()
      }}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleInventoryRequestSubmit} disabled={isSubmittingRequest}>
        {isSubmittingRequest ? 'Submitting...' : 'Submit Request'}
      </Button>
    </div>
  )

  const requestModalTitle =
    activeRequestType === INVENTORY_REQUEST_TYPE.ADD_EXISTING ? 'Add Inventory Request' : 'New Inventory Creation Request'
  const requestModalDescription =
    activeRequestType === INVENTORY_REQUEST_TYPE.ADD_EXISTING
      ? 'Use this for inventories already used by the faculty. Only HOD approval is required.'
      : 'Use this for creating a brand new inventory. This request proceeds through HOD, registrar, and admin approval.'

  return (
    <MainLayout variant="staff">
      <PageHeader
        title="Staff Member Dashboard"
        subtitle={isInventoryOfficer ? 'Use your staff account for both staff requests and inventory management.' : 'Request items and view details of items issued to you'}
        actions={
          <div className="text-right text-base font-medium text-white sm:text-lg">
            {greeting}
          </div>
        }
      />

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card title="My Requests" icon="receipt_long">
            <p className="text-3xl font-bold text-primary-800">{stats.myRequests}</p>
          </Card>
          <Card title="My Issued Items" icon="">
            <p className="text-3xl font-bold text-primary-800">{stats.myIssuedItems}</p>
          </Card>
        </div>

        {isInventoryOfficer && inventoryError && (
          <div className="mb-6 rounded bg-red-50 px-4 py-3 text-sm text-red-800">{inventoryError}</div>
        )}

        {isInventoryOfficer && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <Card title="Assigned Inventories" icon="inventory">
                <p className="text-3xl font-bold text-primary-800">{inventoryLoading ? '...' : assignedInventories.length}</p>
              </Card>
              <Card title="Total Assets" icon="inventory_2">
                <p className="text-3xl font-bold text-primary-800">{inventoryLoading ? '...' : inventorySummary.totalAssets ?? 0}</p>
              </Card>
              <Card title="Available" icon="check_circle">
                <p className="text-3xl font-bold text-success">{inventoryLoading ? '...' : inventorySummary.available ?? 0}</p>
              </Card>
              <Card title="In Use" icon="assignment">
                <p className="text-3xl font-bold text-info">{inventoryLoading ? '...' : inventorySummary.inUse ?? 0}</p>
              </Card>
              <Card title="Pending Requests" icon="request_quote">
                <p className="text-3xl font-bold text-warning">{inventoryLoading ? '...' : inventorySummary.pendingRequests ?? 0}</p>
              </Card>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border border-border-lighter mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-text-dark">Inventory Management</h2>
                  <p className="text-sm text-text-light">Manage all inventories assigned to this staff account.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => navigate('/inventory/list/incharge')} icon="inventory_2">My Inventories</Button>
                  <Button variant="primary" onClick={() => navigate('/inventory/add/incharge')} icon="playlist_add">Add Item</Button>
                  <Button variant="secondary" onClick={() => navigate('/inventory/transfers/list/incharge')} icon="compare_arrows">Transfers</Button>
                  <Button variant="secondary" onClick={() => navigate('/inventory/disposals/list/incharge')} icon="delete_sweep">Disposals</Button>
                </div>
              </div>
            </div>

            <Card title="Assigned Inventories" icon="inventory" className="mb-6">
              <div className="space-y-3">
                {assignedInventories.length === 0 && !inventoryLoading ? (
                  <p className="text-sm text-text-light">No inventories are assigned to this account yet.</p>
                ) : (
                  assignedInventories.map((inventory) => (
                    <div key={inventory.id} className="flex items-center justify-between rounded-lg border border-border-lighter p-3">
                      <div>
                        <p className="font-medium text-text-dark">{inventory.name}</p>
                        <p className="text-sm text-text-light">{inventory.location || 'No location'} • {inventory.department}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => navigate(`/inventory/list/incharge?inventoryId=${inventory.id}`)}>
                          Open
                        </Button>
                        <Button variant="primary" onClick={() => navigate(`/inventory/add/incharge?inventoryId=${inventory.id}`)}>
                          Add Item
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </>
        )}

        <div className="bg-white p-6 rounded-lg shadow-md border border-border-lighter mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex gap-3">
              {canRequestItems(userRole) && (
                <Button variant="primary" onClick={() => console.log('Create item request')} icon="add_circle">Request Item</Button>
              )}
              <Button onClick={() => console.log('View my requests')}>My Requests</Button>     
            </div>
             {canRequestInventoryCreation && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setActiveRequestType(INVENTORY_REQUEST_TYPE.ADD_EXISTING)
                    resetRequestForm()
                    setIsRequestModalOpen(true)
                  }}
                  icon="playlist_add"
                >
                  Add Inventory
                </Button>
              )}
            {canRequestInventoryCreation && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setActiveRequestType(INVENTORY_REQUEST_TYPE.CREATE_NEW)
                    resetRequestForm()
                    setIsRequestModalOpen(true)
                  }}
                  icon="playlist_add"
                >
                  New Inventory Creation
                </Button>
              )}
          </div>
        </div>

        {requestMessage && <div className="mb-6 rounded bg-green-50 px-4 py-3 text-sm text-green-800">{requestMessage}</div>}
        {requestError && <div className="mb-6 rounded bg-red-50 px-4 py-3 text-sm text-red-800">{requestError}</div>}

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

        <Modal
          isOpen={isRequestModalOpen}
          title={requestModalTitle}
          onClose={() => setIsRequestModalOpen(false)}
          footer={requestModalFooter}
          size="lg"
        >
          <form onSubmit={handleInventoryRequestSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {optionsError && <p className="md:col-span-2 rounded bg-warning/10 px-3 py-2 text-sm text-warning">{optionsError}</p>}
            <p className="md:col-span-2 rounded bg-blue-50 px-3 py-2 text-sm text-blue-800">{requestModalDescription}</p>

            <FormInput
              label="Inventory Name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter inventory name"
              required
            />

            <FormInput
              label="Inventory Location (Office/Lab)"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="Enter inventory location"
              required
            />

            <FormInput
              label="Department"
              name="department"
              value={formData.department}
              onChange={handleInputChange}
              placeholder="Department"
              disabled
              required
            />

            <FormInput
              label="HOD"
              name="Hod"
              value={formData.Hod}
              onChange={handleInputChange}
              placeholder="Department HOD"
              disabled
            />

            <FormInput
              label="Inventory Officer"
              name="incharge"
              value={accountHolderName}
              onChange={handleInputChange}
              placeholder="Inventory officer"
              disabled
              required
            />

            <FormInput
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Inventory request description"
              as="textarea"
              rows={3}
              className="md:col-span-2"
            />
          </form>
        </Modal>
      </div>
    </MainLayout>
  )
}

export default StaffDashboard
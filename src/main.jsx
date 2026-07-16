import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'

// Auth Pages - Using existing pages
import Login from './Pages/Login/Login'
import SignUp from './Pages/Login/SIgnUp'
import ForgotPW from './Pages/Login/ForgotPW'
import ResetPassword from './Pages/Login/ResetPassword'

// Admin Pages
import AdminDashboard from './Pages/Admin/AdminDashboard'
import AdminPendingTasks from './Pages/Admin/AdminPendingTasks'
import UserManagement from './Pages/Admin/UserManagement'
import Reports from './Pages/Admin/Reports'
import Profile from './Pages/Admin/Profile'
import CreateUser from './Pages/Admin/CreateUser'
import CreateDepartment from './Pages/Admin/CreateDepartment'
import CreateInventory from './Pages/Admin/CreateInventory'

// Inventory Pages
import InventoryListView from './Pages/Inventory/InventoryListView'
import AddNewItem from './Pages/Inventory/AddNewItem'
import ItemView from './Pages/Inventory/ItemView'
import ItemDetail from './Pages/Inventory/ItemDetail'

// Disposal Pages
import DisposalList from './Pages/Inventory/Disposals/DisposalList'
import CreateDisposal from './Pages/Inventory/Disposals/CreateDisposal'
import DisposalDetails from './Pages/Inventory/Disposals/DisposalDetails'
import DisposalReports from './Pages/Inventory/Disposals/DisposalReports'

// Transfer Pages
import TransferList from './Pages/Inventory/Transfers/TransferList'
import TransferDetails from './Pages/Inventory/Transfers/TransferDetails'
import CreateTransfer from './Pages/Inventory/Transfers/CreateTransfer'

// Repair Pages
import RepairList from './Pages/Inventory/Repairs/RepairList'
import CreateRepair from './Pages/Inventory/Repairs/CreateRepair'
import RepairDetails from './Pages/Inventory/Repairs/RepairDetails'
import WarrantyClaimList from './Pages/Inventory/Repairs/WarrantyClaimList'
import CreateWarrantyClaim from './Pages/Inventory/Repairs/CreateWarrantyClaim'
import WarrantyClaimDetails from './Pages/Inventory/Repairs/WarrantyClaimDetails'
import InventoryOfficerReports from './Pages/Inventory/InventoryOfficerReports'

// Request Pages
import RequestList from './Pages/Inventory/Requests/RequestList'
import CreateRequest from './Pages/Inventory/Requests/CreateRequest'
import ItemRequest from './Pages/Inventory/Requests/ItemRequest'
import MyRequests from './Pages/Inventory/Requests/MyRequests'
import MyIssuedItems from './Pages/Inventory/Requests/MyIssuedItems'
import InventoryCreationRequest from './Pages/Inventory/InventoryCreationRequest'

// Staff Pages
import StaffDashboard from './Pages/StaffMember/StaffDashboard'
import HodDashboard from './Pages/StaffMember/HodDashboard'
import HodPendingTasks from './Pages/StaffMember/HodPendingTasks'
import HodReports from './Pages/StaffMember/HodReports'
import DeanDashboard from './Pages/StaffMember/DeanDashboard'
import DeanPendingApprovals from './Pages/StaffMember/DeanPendingApprovals'
import DepartmentManagement from './Pages/Admin/DepartmentManagement'
import InventoryManagement from './Pages/Admin/InventoryManagement'
import RegistrarAdminOutlet from './Components/Auth/RegistrarAdminOutlet'

const router = createBrowserRouter([
  // ==================== Authentication Routes ====================
  {
    path: "/",
    element: <Login />
  },
  {
    path: "/signup",
    element: <SignUp />
  },
  {
    path: "/forgotPassword",
    element: <ForgotPW />
  },
  {
    path: "/resetPassword",
    element: <ResetPassword />
  },

  // ==================== Admin Routes ====================
  {
    path: "/admin",
    element: <RegistrarAdminOutlet />,
    children: [
      {
        path: "dashboard",
        element: <AdminDashboard />
      },
      {
        path: "profile",
        element: <Profile />
      },
      {
        path: "users",
        element: <UserManagement />
      },
      {
        path: "users/create",
        element: <CreateUser />
      },
      {
        path: "reports",
        element: <Reports />
      },
      {
        path: "departments",
        element: <DepartmentManagement />
      },
      {
        path: "departments/create",
        element: <CreateDepartment />
      },
      {
        path: "inventory",
        element: <InventoryManagement />
      },
      {
        path: "inventory/create",
        element: <CreateInventory />
      },
      {
        path: "pending-tasks",
        element: <AdminPendingTasks />
      }
    ]
  },

  // ==================== Inventory Routes ====================
  {
    path: "/inventory",
    children: [
      {
        path: "dashboard",
        element: <StaffDashboard />
      },
      {
        path: "scan",
        element: <ItemView />
      },
      {
        path: "scan/:role",
        element: <ItemView />
      },
      {
        path: "item/:id",
        element: <ItemDetail />
      },
      {
        path: "item/:id/:role",
        element: <ItemDetail />
      },
      {
        path: "list",
        element: <InventoryListView />
      },
      {
        path: "list/staff",
        element: <MyIssuedItems />
      },
      {
        path: "list/hod",
        element: <MyIssuedItems />
      },
      {
        path: "list/dean",
        element: <MyIssuedItems />
      },
      {
        path: "list/:role",
        element: <InventoryListView />
      },
      {
        path: "add",
        element: <AddNewItem />
      },
      {
        path: "add/:role",
        element: <AddNewItem />
      },
      {
        path: "transfers",
        children: [
          {
            path: "new/:role",
            element: <CreateTransfer />
          },
          {
            path: "new",
            element: <CreateTransfer />
          },
          {
            path: "list/:role",
            element: <TransferList />
          },
          {
            path: "list",
            element: <TransferList />
          },
          {
            path: ":transferId/:role",
            element: <TransferDetails />
          },
          {
            path: ":transferId",
            element: <TransferDetails />
          },
        ]
      },
      {
        path: "disposals",
        children: [
          {
            path: "list",
            element: <DisposalList />
          },
          {
            path: "list/:role",
            element: <DisposalList />
          },
          {
            path: "new/:role",
            element: <CreateDisposal />
          },
          {
            path: "new",
            element: <CreateDisposal />
          },
          {
            path: "reports/:role",
            element: <DisposalReports />
          },
          {
            path: "reports",
            element: <DisposalReports />
          },
          {
            path: ":disposalId/:role",
            element: <DisposalDetails />
          },
          {
            path: ":disposalId",
            element: <DisposalDetails />
          },
        ]
      },
      {
        path: "repairs",
        children: [
          {
            path: "list",
            element: <RepairList />
          },
          {
            path: "list/:role",
            element: <RepairList />
          },
          {
            path: "new",
            element: <CreateRepair />
          },
          {
            path: "new/:role",
            element: <CreateRepair />
          },
          {
            path: "warranty-claims",
            children: [
              {
                path: "list",
                element: <WarrantyClaimList />
              },
              {
                path: "list/:role",
                element: <WarrantyClaimList />
              },
              {
                path: "new",
                element: <CreateWarrantyClaim />
              },
              {
                path: "new/:role",
                element: <CreateWarrantyClaim />
              },
              {
                path: ":claimId",
                element: <WarrantyClaimDetails />
              },
              {
                path: ":claimId/:role",
                element: <WarrantyClaimDetails />
              },
            ]
          },
          {
            path: ":repairId",
            element: <RepairDetails />
          },
          {
            path: ":repairId/:role",
            element: <RepairDetails />
          },
        ]
      },
      {
        path: "reports",
        element: <InventoryOfficerReports />
      },
      {
        path: "reports/:role",
        element: <InventoryOfficerReports />
      },
      {
        path: "requests",
        children: [
          {
            path: "list",
            element: <RequestList />
          },
          {
            path: "list/:role",
            element: <RequestList />
          },
          {
            path: "new",
            element: <CreateRequest />
          },
          {
            path: "new/:role",
            element: <CreateRequest />
          }
        ]
      }
    ]
  },

  // ==================== Shared Profile Route ====================
  {
    path: "/profile",
    element: <Profile />
  },
  {
    path: "/profile/:role",
    element: <Profile />
  },

  // ==================== Shared Reports Route ====================
  {
    path: "/reports/hod",
    element: <HodReports />
  },
  {
    path: "/reports/:role",
    element: <Reports layoutVariant="main" />
  },

  // ==================== Requests & Approvals Routes ====================
  {
    path: "/requests",
    children: [
      {
        path: "approval",
        element: <ItemRequest />
      },
      {
        path: "approval/dean",
        element: <DeanPendingApprovals />
      },
      {
        path: "approval/:role",
        element: <ItemRequest />
      },
      {
        path: "my/:role",
        element: <MyRequests />
      },
      {
        path: "inventory/:role",
        element: <InventoryCreationRequest />
      }
    ]
  },

  // ==================== Staff Routes ====================
  {
    path: "/staff",
    children: [
      {
        path: "dashboard",
        element: <StaffDashboard />
      }
    ]
  },

  // ==================== HOD Routes ====================
  {
    path: "/hod/dashboard",
    element: <HodDashboard />
  },
  {
    path: "/hod/pending-tasks",
    element: <HodPendingTasks />
  },
  {
    path: "/hod/approval-history",
    element: <HodPendingTasks />
  },
  {
    path: "/hod/inventory",
    element: <InventoryManagement />
  },

  // ==================== Dean Routes ====================
  {
    path: "/dean",
    children: [
      {
        path: "dashboard",
        element: <DeanDashboard />
      },
      {
        path: "inventory",
        element: <InventoryManagement />
      }
    ]
  },

])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

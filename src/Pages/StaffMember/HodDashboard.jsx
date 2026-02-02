import React from 'react'
import MainLayout from '../../Components/Layouts/MainLayout'
import { Card, Button } from '../../Components/UI'

const HodDashboard = () => {
  const stats = [
    { title: 'Department Inventories', value: '12', icon: 'inventory_2' },
    { title: 'Pending Staff Requests', value: '8', icon: 'rule' },
    { title: 'Pending Account Approvals', value: '3', icon: 'person_add' },
  ]

  return (
    <MainLayout variant="hod">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-dark">HOD Dashboard</h1>
          <p className="text-text-light mt-2">Department-level oversight of inventories and requests</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat, index) => (
            <Card key={index} icon={stat.icon} hover={true}>
              <p className="text-sm text-text-light">{stat.title}</p>
              <p className="text-3xl font-bold text-primary-800 mt-2">{stat.value}</p>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="primary" icon="rule">Review Requests</Button>
          <Button variant="secondary" icon="person_add">Approve Staff Accounts</Button>
          <Button variant="secondary" icon="add_circle">Recommend Inventory Creation</Button>
        </div>
      </div>
    </MainLayout>
  )
}

export default HodDashboard

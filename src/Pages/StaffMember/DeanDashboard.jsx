import React from 'react'
import MainLayout from '../../Components/Layouts/MainLayout'
import { Card, Button } from '../../Components/UI'

const DeanDashboard = () => {
  const stats = [
    { title: 'Faculty Inventories', value: '24', icon: 'inventory_2' },
    { title: 'Pending HOD Requests', value: '6', icon: 'rule' },
    { title: 'HOD Account Approvals', value: '2', icon: 'person_add' },
  ]

  return (
    <MainLayout variant="dean">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-dark">Dean Dashboard</h1>
          <p className="text-text-light mt-2">Faculty-wide overview and approvals</p>
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
          <Button variant="primary" icon="rule">Review HOD Requests</Button>
          <Button variant="secondary" icon="person_add">Approve HOD Accounts</Button>
        </div>
      </div>
    </MainLayout>
  )
}

export default DeanDashboard

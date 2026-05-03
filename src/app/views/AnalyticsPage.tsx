'use client';

import { useState } from 'react';
import {
  Users,
  Briefcase,
  UserCheck,
  Clock,
  TrendingUp,
  DollarSign,
  BarChart3,
  PieChart,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

// Stats Card Component
function StatsCard({
  title,
  value,
  change,
  icon: Icon,
  color = 'yellow',
}: {
  title: string;
  value: string | number;
  change?: string;
  icon: any;
  color?: 'yellow' | 'green' | 'blue' | 'purple';
}) {
  const colorClasses = {
    yellow: 'bg-cdata-yellow/10 text-cdata-black',
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-cdata-black mt-1">{value}</p>
          {change && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {change}
            </p>
          )}
        </div>
        <div className={cn('p-3 rounded-lg', colorClasses[color])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

// Skills Demand Chart
function SkillsDemandChart() {
  const skills = [
    { skill: 'React', demand: 85, count: 45 },
    { skill: 'Python', demand: 78, count: 38 },
    { skill: 'AWS', demand: 72, count: 32 },
    { skill: 'Java', demand: 68, count: 28 },
    { skill: 'Kubernetes', demand: 62, count: 24 },
    { skill: 'TypeScript', demand: 58, count: 21 },
    { skill: 'Node.js', demand: 55, count: 19 },
    { skill: '.NET', demand: 48, count: 15 },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-cdata-black">Skills in Demand</h2>
        <BarChart3 className="w-5 h-5 text-gray-400" />
      </div>
      <div className="space-y-4">
        {skills.map((item) => (
          <div key={item.skill} className="flex items-center gap-4">
            <span className="w-24 text-sm font-medium text-gray-700">{item.skill}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cdata-yellow to-yellow-400 rounded-full transition-all duration-500"
                style={{ width: `${item.demand}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-cdata-black w-12 text-right">
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Placement Trends
function PlacementTrends() {
  const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const data = [12, 18, 15, 22, 19, 25];
  const maxValue = Math.max(...data);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-cdata-black">Placements Trend</h2>
        <TrendingUp className="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex items-end justify-between h-48 gap-3">
        {data.map((value, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full flex flex-col items-center justify-end h-36">
              <span className="text-xs font-semibold text-cdata-black mb-1">{value}</span>
              <div
                className="w-full bg-gradient-to-t from-cdata-yellow to-yellow-300 rounded-t transition-all duration-500 hover:from-cdata-navy hover:to-blue-400"
                style={{ height: `${(value / maxValue) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{months[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Rate Distribution
function RateDistribution() {
  const ranges = [
    { range: '$50-70', count: 15, percent: 12 },
    { range: '$70-90', count: 35, percent: 29 },
    { range: '$90-110', count: 42, percent: 35 },
    { range: '$110-130', count: 20, percent: 17 },
    { range: '$130+', count: 8, percent: 7 },
  ];

  const colors = ['bg-yellow-200', 'bg-yellow-300', 'bg-cdata-yellow', 'bg-yellow-500', 'bg-yellow-600'];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-cdata-black">Rate Distribution</h2>
        <PieChart className="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex items-center justify-center mb-6">
        <div className="relative w-40 h-40">
          {/* Simplified pie chart visualization */}
          <div className="absolute inset-0 rounded-full border-8 border-cdata-yellow" />
          <div className="absolute inset-4 rounded-full bg-white flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-cdata-black">120</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {ranges.map((item, i) => (
          <div key={item.range} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn('w-3 h-3 rounded', colors[i])} />
              <span className="text-sm text-gray-600">{item.range}/hr</span>
            </div>
            <span className="text-sm font-medium text-cdata-black">{item.count} ({item.percent}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Recruiter Performance Table
function RecruiterPerformance() {
  const recruiters = [
    { name: 'Sarah Miller', placements: 12, revenue: 145000, margin: 24.2, rating: 4.8 },
    { name: 'John Davis', placements: 10, revenue: 128000, margin: 23.8, rating: 4.6 },
    { name: 'Emily Chen', placements: 9, revenue: 112000, margin: 22.5, rating: 4.9 },
    { name: 'Mike Thompson', placements: 8, revenue: 98000, margin: 23.1, rating: 4.5 },
    { name: 'Lisa Park', placements: 7, revenue: 87000, margin: 21.8, rating: 4.7 },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-cdata-black mb-4">Recruiter Performance</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Recruiter</th>
              <th className="text-right py-3 px-2 text-sm font-semibold text-gray-600">Placements</th>
              <th className="text-right py-3 px-2 text-sm font-semibold text-gray-600">Revenue</th>
              <th className="text-right py-3 px-2 text-sm font-semibold text-gray-600">Margin</th>
              <th className="text-right py-3 px-2 text-sm font-semibold text-gray-600">Rating</th>
            </tr>
          </thead>
          <tbody>
            {recruiters.map((r) => (
              <tr key={r.name} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-2 text-sm font-medium text-cdata-black">{r.name}</td>
                <td className="py-3 px-2 text-sm text-right text-gray-600">{r.placements}</td>
                <td className="py-3 px-2 text-sm text-right text-gray-600">
                  ${r.revenue.toLocaleString()}
                </td>
                <td className="py-3 px-2 text-sm text-right">
                  <span className="text-green-600 font-medium">{r.margin}%</span>
                </td>
                <td className="py-3 px-2 text-sm text-right text-gray-600">{r.rating}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-cdata-black">Analytics Dashboard</h1>
        <p className="text-gray-500 mt-1">Insights and performance metrics</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Candidates"
          value="247"
          change="+12 this week"
          icon={Users}
          color="yellow"
        />
        <StatsCard
          title="Active Placements"
          value="89"
          change="+5 this month"
          icon={UserCheck}
          color="green"
        />
        <StatsCard
          title="Open Requisitions"
          value="34"
          icon={Briefcase}
          color="blue"
        />
        <StatsCard
          title="Bench Candidates"
          value="28"
          change="Ready to place"
          icon={Clock}
          color="purple"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkillsDemandChart />
        <PlacementTrends />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecruiterPerformance />
        </div>
        <RateDistribution />
      </div>
    </div>
  );
}

'use client';

/**
 * Suppliers Management Page
 * For owners and admins to manage suppliers
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { teamApi, TeamMember } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { Truck, Mail, User, Calendar, Shield, AlertCircle } from 'lucide-react';

export default function SuppliersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only owners and admins can access this page
    if (user && !['owner', 'admin'].includes(user.role.toLowerCase())) {
      router.push('/dashboard');
      return;
    }
    
    loadSuppliers();
  }, [user, router]);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const members = await teamApi.getMembers();
      // Filter for suppliers only
      const supplierMembers = members.filter(
        (member: TeamMember) => member.role.toLowerCase() === 'supplier'
      );
      setSuppliers(supplierMembers);
    } catch (error: any) {
      showToast(error.detail || 'Failed to load suppliers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Active
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-50 text-yellow-700 text-xs rounded-full">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 text-gray-700 text-xs rounded-full">
            <span className="w-2 h-2 rounded-full bg-gray-500"></span>
            {status}
          </span>
        );
    }
  };

  if (!user || !['owner', 'admin'].includes(user.role.toLowerCase())) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Suppliers</h1>
            <p className="text-[var(--text-muted)] mt-1">
              Manage your suppliers and their order assignments
            </p>
          </div>
          <button
            onClick={() => router.push('/settings?tab=team')}
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90"
          >
            Invite Supplier
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DashboardCard>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[var(--primary-bg)] rounded-lg">
                <Truck className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Total Suppliers</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {suppliers.length}
                </p>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <Shield className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Active</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {suppliers.filter(s => s.invitation_status === 'accepted').length}
                </p>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-50 rounded-lg">
                <Mail className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Pending Invites</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {suppliers.filter(s => s.invitation_status === 'pending').length}
                </p>
              </div>
            </div>
          </DashboardCard>
        </div>

        {/* Suppliers List */}
        <DashboardCard>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">All Suppliers</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
              <p className="text-[var(--text-primary)] font-medium mb-2">No Suppliers Yet</p>
              <p className="text-[var(--text-muted)] text-sm mb-4">
                Invite suppliers to help fulfill orders
              </p>
              <button
                onClick={() => router.push('/settings?tab=team')}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90"
              >
                Invite Your First Supplier
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-color)]">
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-muted)]">
                      Supplier
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-muted)]">
                      Email
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-muted)]">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-muted)]">
                      Joined
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-muted)]">
                      Shop Access
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((supplier) => (
                    <tr
                      key={supplier.id}
                      className="border-b border-[var(--border-color)] hover:bg-[var(--card-bg-hover)] transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[var(--primary-bg)] flex items-center justify-center">
                            <User className="w-5 h-5 text-[var(--primary)]" />
                          </div>
                          <div>
                            <p className="text-[var(--text-primary)] font-medium">
                              {supplier.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-[var(--text-secondary)] text-sm">{supplier.email}</p>
                      </td>
                      <td className="py-4 px-4">
                        {getStatusBadge(supplier.invitation_status)}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm">
                          <Calendar className="w-4 h-4" />
                          {supplier.joined_at
                            ? new Date(supplier.joined_at).toLocaleDateString()
                            : 'N/A'}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-[var(--text-secondary)] text-sm">
                          {supplier.allowed_shop_ids && supplier.allowed_shop_ids.length > 0
                            ? `${supplier.allowed_shop_ids.length} shop(s)`
                            : 'All shops'}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardCard>

        {/* Info Card */}
        <DashboardCard>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[var(--info)] flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-[var(--text-primary)] font-medium mb-2">
                About Suppliers
              </h3>
              <ul className="text-[var(--text-secondary)] text-sm space-y-1">
                <li>• Suppliers can view and fulfill assigned orders</li>
                <li>• They can add tracking information for shipments</li>
                <li>• Suppliers cannot access shop settings or Etsy OAuth</li>
                <li>• All pricing information is hidden from suppliers</li>
                <li>• Supplier tracking is recorded locally and not synced to Etsy</li>
              </ul>
            </div>
          </div>
        </DashboardCard>
      </div>
    </DashboardLayout>
  );
}

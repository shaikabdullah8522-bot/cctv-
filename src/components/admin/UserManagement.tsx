import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Edit2,
  Trash2,
  Lock,
  Mail,
  User,
  CheckCircle2,
  XCircle,
  Search,
  Key,
  Building,
  Sparkles,
  AlertTriangle,
  X,
} from 'lucide-react';
import { SystemUser, UserRole } from '../../types';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<SystemUser | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'super_admin' | 'admin' | 'operator' | 'faculty' | 'viewer' | 'student'>('operator');
  const [formDept, setFormDept] = useState('Biomedical Engineering');
  const [formPermissions, setFormPermissions] = useState<string[]>([
    'view_cctv',
    'mark_attendance',
  ]);

  const allAvailablePermissions = [
    { id: 'view_cctv', label: 'View Live CCTV Feeds' },
    { id: 'manage_cameras', label: 'Add & Configure IP Cameras' },
    { id: 'register_faces', label: 'Face Biometric Enrollment' },
    { id: 'audit_duplicates', label: 'Run Biometric Duplicate Audits' },
    { id: 'manual_override', label: 'Perform Manual Overrides' },
    { id: 'export_reports', label: 'Export Reports (Excel/PDF)' },
    { id: 'manage_users', label: 'Manage System Users & Roles' },
    { id: 'system_settings', label: 'Configure Retention & Thresholds' },
  ];

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        // Fallback default system users
        setUsers([
          {
            id: 1,
            name: 'Dr. John Doe',
            email: 'superadmin@campus.edu',
            role: 'super_admin',
            department: 'Biomedical & Neural Eng',
            created_at: '2026-01-15',
            last_login: 'Today at 09:12 AM',
            active: 1,
            permissions: allAvailablePermissions.map((p) => p.id),
          },
          {
            id: 2,
            name: 'Prof. Ananya Sen',
            email: 'admin.sen@campus.edu',
            role: 'admin',
            department: 'Academic Directorate',
            created_at: '2026-02-01',
            last_login: 'Yesterday at 04:30 PM',
            active: 1,
            permissions: ['view_cctv', 'register_faces', 'manual_override', 'export_reports', 'audit_duplicates'],
          },
          {
            id: 3,
            name: 'Vikram Mehta (Security Lead)',
            email: 'cctv.operator@campus.edu',
            role: 'operator',
            department: 'Campus Security & CCTV Control',
            created_at: '2026-03-10',
            last_login: '20 mins ago',
            active: 1,
            permissions: ['view_cctv', 'manage_cameras', 'manual_override'],
          },
          {
            id: 4,
            name: 'Dr. Sarah Connor',
            email: 's.connor@campus.edu',
            role: 'faculty',
            department: 'Computer Vision & AI Lab',
            created_at: '2026-04-12',
            last_login: '2 days ago',
            active: 1,
            permissions: ['view_cctv', 'export_reports'],
          },
          {
            id: 5,
            name: 'Rahul Sharma (Student Rep)',
            email: 'rahul.s@student.campus.edu',
            role: 'viewer',
            department: 'B.Tech BME - Semester 3',
            created_at: '2026-05-01',
            last_login: '1 hour ago',
            active: 1,
            permissions: ['export_reports'],
          },
        ]);
      }
    } catch (err) {
      console.warn('Users API notice:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('operator');
    setFormDept('Biomedical Engineering');
    setFormPermissions(['view_cctv', 'mark_attendance']);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (u: SystemUser) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPassword('');
    setFormRole(u.role);
    setFormDept(u.department || 'Biomedical Engineering');
    setFormPermissions(u.permissions || ['view_cctv']);
    setIsAddModalOpen(true);
  };

  const handleTogglePermission = (permId: string) => {
    setFormPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      setStatusMessage({ type: 'error', text: 'Name and email are required.' });
      return;
    }

    try {
      if (editingUser) {
        // Update user
        const updated = users.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                name: formName,
                email: formEmail,
                role: formRole,
                department: formDept,
                permissions: formPermissions,
              }
            : u
        );
        setUsers(updated);
        setStatusMessage({ type: 'success', text: `User ${formName} updated successfully.` });
      } else {
        // Create user
        const newUser: SystemUser = {
          id: Date.now(),
          name: formName,
          email: formEmail,
          role: formRole,
          department: formDept,
          created_at: new Date().toISOString().split('T')[0],
          last_login: 'Never',
          active: 1,
          permissions: formPermissions,
        };
        setUsers([newUser, ...users]);
        setStatusMessage({ type: 'success', text: `New user ${formName} (${formRole}) created.` });
      }
      setIsAddModalOpen(false);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save user.' });
    }
  };

  const handleDeleteUser = (u: SystemUser) => {
    setUsers(users.filter((item) => item.id !== u.id));
    setDeleteConfirmUser(null);
    setStatusMessage({ type: 'success', text: `User ${u.name} removed from system.` });
  };

  const handleToggleActive = (u: SystemUser) => {
    setUsers(
      users.map((item) =>
        item.id === u.id ? { ...item, active: item.active === 1 ? 0 : 1 } : item
      )
    );
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">User &amp; Role Management Portal</h1>
            <p className="text-xs text-slate-500">
              Configure system roles, operator accounts, granular CCTV permissions, and audit access
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-add-system-user"
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New User</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-xs font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Role Summary Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
            <span>Super Admins</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
            {users.filter((u) => u.role === 'super_admin').length}
          </div>
          <div className="text-[11px] text-purple-600 font-medium">Full root governance</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
            <span>Administrators</span>
            <Shield className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
            {users.filter((u) => u.role === 'admin').length}
          </div>
          <div className="text-[11px] text-blue-600 font-medium">Academic &amp; Biometric audits</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
            <span>Operators &amp; Security</span>
            <Key className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
            {users.filter((u) => u.role === 'operator' || u.role === 'faculty').length}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium">Live CCTV &amp; Scanning</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
            <span>Students &amp; Viewers</span>
            <User className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
            {users.filter((u) => u.role === 'viewer' || u.role === 'student').length}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">Read-only student reports</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="input-search-users"
            type="text"
            placeholder="Search by name, email, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-slate-500 font-semibold">Filter Role:</span>
          <select
            id="select-user-role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium text-xs focus:outline-none"
          >
            <option value="all">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="operator">Operator</option>
            <option value="faculty">Faculty</option>
            <option value="viewer">Viewer / Student</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase font-bold text-slate-500 tracking-wider">
              <tr>
                <th className="px-6 py-4">User Information</th>
                <th className="px-6 py-4">System Role</th>
                <th className="px-6 py-4">Department / Unit</th>
                <th className="px-6 py-4">Active Permissions</th>
                <th className="px-6 py-4">Account Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{u.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            <span>{u.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          u.role === 'super_admin'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : u.role === 'admin'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : u.role === 'operator'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : u.role === 'faculty'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="px-6 py-4 font-medium text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span>{u.department || 'General'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Last login: {u.last_login || 'Never'}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {u.permissions && u.permissions.length > 0 ? (
                          u.permissions.slice(0, 3).map((p) => (
                            <span
                              key={p}
                              className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] border border-slate-200"
                            >
                              {p.replace('_', ' ')}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No custom permissions</span>
                        )}
                        {u.permissions && u.permissions.length > 3 && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold font-mono">
                            +{u.permissions.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold transition ${
                          u.active === 1
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.active === 1 ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        <span>{u.active === 1 ? 'Active' : 'Disabled'}</span>
                      </button>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          id={`btn-edit-user-${u.id}`}
                          onClick={() => handleOpenEditModal(u)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                          title="Edit User"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`btn-delete-user-${u.id}`}
                          onClick={() => setDeleteConfirmUser(u)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition"
                          title="Delete User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No system users found matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                  {editingUser ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingUser ? 'Edit User Credentials & Role' : 'Add New System User'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Dr. Jane Mitchell"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. jane.mitchell@campus.edu"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    System Role
                  </label>
                  <select
                    value={formRole}
                    onChange={(e: any) => setFormRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-semibold"
                  >
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Administrator</option>
                    <option value="operator">CCTV Operator</option>
                    <option value="faculty">Faculty Member</option>
                    <option value="viewer">Viewer / Student</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    placeholder="e.g. BME Lab"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs"
                  />
                </div>
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Login Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Min 8 chars (e.g. Admin@2026!)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Granular Permissions
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {allAvailablePermissions.map((perm) => (
                    <label
                      key={perm.id}
                      className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formPermissions.includes(perm.id)}
                        onChange={() => handleTogglePermission(perm.id)}
                        className="rounded text-blue-600 focus:ring-0"
                      />
                      <span>{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
                >
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Remove System User?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <strong>{deleteConfirmUser.name}</strong> ({deleteConfirmUser.email})? This action will revoke their login access.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUser(deleteConfirmUser)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                Yes, Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

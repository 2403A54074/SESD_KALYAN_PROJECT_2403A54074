import React, { useMemo, useState } from 'react';
import { Pencil, Search, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import type { Recipient } from '../../types/system';
import { EmptyState, ErrorAlert, ModulePageHeader, StatusLabel } from '../ui/CommonUI';

export const RecipientsModule: React.FC = () => {
  const {
    state,
    addRecipient,
    updateRecipient,
    toggleRecipientStatus,
    deleteRecipient,
    setActiveModule,
  } = useSystem();

  const [formOpen, setFormOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Suspended'>('All');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rowPad = state.settings.compactTables ? 'py-2 px-3.5' : 'py-3 px-4';

  const copyCountByRecipient = useMemo(() => {
    const map = new Map<string, number>();
    state.watermarkedCopies.forEach((w) => {
      map.set(w.recipientId, (map.get(w.recipientId) || 0) + 1);
    });
    return map;
  }, [state.watermarkedCopies]);

  const resetForm = () => {
    setEditingRecipient(null);
    setFullName('');
    setEmail('');
    setOrganization('');
    setRole('');
    setNotes('');
    setErrorMsg(null);
  };

  const openAddForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = (rec: Recipient) => {
    setEditingRecipient(rec);
    setFullName(rec.fullName);
    setEmail(rec.email);
    setOrganization(rec.organization);
    setRole(rec.role);
    setNotes(rec.notes);
    setErrorMsg(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanOrg = organization.trim();
    const cleanRole = role.trim();

    if (!cleanName || !cleanEmail) {
      setErrorMsg('Recipient name and valid email address are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    const duplicate = state.recipients.some(
      (r) =>
        r.email.toLowerCase() === cleanEmail &&
        (!editingRecipient || r.id !== editingRecipient.id)
    );
    if (duplicate) {
      setErrorMsg('A recipient with this email address already exists in your directory.');
      return;
    }

    setErrorMsg(null);
    setIsSaving(true);
    try {
      if (editingRecipient) {
        await updateRecipient({
          ...editingRecipient,
          fullName: cleanName,
          email: cleanEmail,
          organization: cleanOrg,
          role: cleanRole,
          notes: notes.trim(),
        });
      } else {
        await addRecipient({
          fullName: cleanName,
          email: cleanEmail,
          organization: cleanOrg,
          role: cleanRole,
          status: 'Active',
          notes: notes.trim(),
        });
      }
      resetForm();
      setFormOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save recipient.');
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = state.recipients.filter((r) => {
    if (statusFilter !== 'All' && r.status !== statusFilter) return false;
    const q = searchQuery.toLowerCase();
    return (
      r.fullName.toLowerCase().includes(q) ||
      r.recipientCode.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.organization.toLowerCase().includes(q) ||
      r.role.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <ModulePageHeader
        title="Recipients"
        description="Manage authorized recipients manually. A unique Recipient ID is generated automatically for every added recipient."
        actions={
          <button
            type="button"
            onClick={openAddForm}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Recipient</span>
          </button>
        }
      />

      {errorMsg && (
        <div className="mb-5">
          <ErrorAlert message={errorMsg} onDismiss={() => setErrorMsg(null)} />
        </div>
      )}

      {/* Add / Edit Recipient Form Panel */}
      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 mb-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {editingRecipient
                  ? `Edit Recipient (${editingRecipient.recipientCode})`
                  : 'Add New Recipient'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setFormOpen(false);
              }}
              aria-label="Close recipient form"
              className="rounded-md p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Recipient Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter full name"
                required
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.edu"
                required
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Organization
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Institution, centre, or company"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Role
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Role or designation"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setFormOpen(false);
                }}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white transition-colors"
              >
                {isSaving ? 'Saving…' : editingRecipient ? 'Save Changes' : 'Save Recipient'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1">
          {(['All', 'Active', 'Suspended'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === tab
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ID, name, email, org, role…"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={state.recipients.length === 0 ? 'No recipients added yet' : 'No matching recipients'}
          description={
            state.recipients.length === 0
              ? 'Click "Add Recipient" to create your first recipient entry with name, email, organization, and role.'
              : 'Try clearing your search query or status filter.'
          }
          actionLabel={state.recipients.length === 0 ? 'Add Recipient' : undefined}
          onAction={state.recipients.length === 0 ? openAddForm : undefined}
        />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Recipient ID</th>
                <th className="py-2.5 px-4">Recipient</th>
                <th className="py-2.5 px-4">Organization</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Copies</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {filtered.map((rec) => {
                const issued = copyCountByRecipient.get(rec.id) || 0;
                return (
                  <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className={`${rowPad} font-mono font-semibold text-cyan-700 dark:text-cyan-400 whitespace-nowrap`}>
                      {rec.recipientCode}
                    </td>
                    <td className={rowPad}>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {rec.fullName}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {rec.email}
                      </p>
                    </td>
                    <td className={`${rowPad} text-slate-700 dark:text-slate-300`}>
                      {rec.organization || '—'}
                    </td>
                    <td className={`${rowPad} text-slate-700 dark:text-slate-300`}>
                      {rec.role || '—'}
                    </td>
                    <td className={rowPad}>
                      <StatusLabel
                        status={rec.status}
                        tone={rec.status === 'Active' ? 'success' : 'warning'}
                      />
                    </td>
                    <td className={`${rowPad} text-right font-mono tabular-nums text-slate-800 dark:text-slate-200`}>
                      {issued}
                    </td>
                    <td className={`${rowPad} text-right whitespace-nowrap`}>
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveModule('watermarking')}
                          disabled={rec.status !== 'Active'}
                          className="rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-40 px-2.5 py-1 text-xs font-medium text-white"
                        >
                          Watermark
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditForm(rec)}
                          aria-label={`Edit ${rec.fullName}`}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleRecipientStatus(rec.id)}
                          className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          {rec.status === 'Active' ? 'Suspend' : 'Activate'}
                        </button>
                        {confirmDeleteId === rec.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                void deleteRecipient(rec.id);
                                setConfirmDeleteId(null);
                              }}
                              className="rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(rec.id)}
                            aria-label={`Delete ${rec.fullName}`}
                            className="rounded-md border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

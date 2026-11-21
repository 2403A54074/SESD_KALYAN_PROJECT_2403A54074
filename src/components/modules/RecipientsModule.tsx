import React, { useMemo, useState } from 'react';
import { Search, Trash2, UserPlus, Users } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import type { RecipientClearance } from '../../types/system';
import { EmptyState, ErrorAlert, ModulePageHeader, StatusLabel } from '../ui/CommonUI';

export const RecipientsModule: React.FC = () => {
  const { state, addRecipient, toggleRecipientStatus, deleteRecipient, setActiveModule } =
    useSystem();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [department, setDepartment] = useState('');
  const [clearance, setClearance] = useState<RecipientClearance>('Security');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Suspended'>('All');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const copyCountByRecipient = useMemo(() => {
    const map = new Map<string, number>();
    state?.watermarkedCopies.forEach((w) => {
      map.set(w.recipientId, (map.get(w.recipientId) || 0) + 1);
    });
    return map;
  }, [state?.watermarkedCopies]);

  if (!state) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setErrorMsg('Recipient full name and valid email address are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    const duplicate = state.recipients.some(
      (r) => r.email.toLowerCase() === email.trim().toLowerCase()
    );
    if (duplicate) {
      setErrorMsg('A recipient with this email address already exists.');
      return;
    }

    setErrorMsg(null);
    addRecipient({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      organization: organization.trim() || 'External Organization',
      department: department.trim() || 'General',
      clearance,
      status: 'Active',
      notes: notes.trim(),
    });
    setFullName('');
    setEmail('');
    setOrganization('');
    setDepartment('');
    setNotes('');
  };

  const filtered = state.recipients.filter((r) => {
    if (statusFilter !== 'All' && r.status !== statusFilter) return false;
    const q = searchQuery.toLowerCase();
    return (
      r.fullName.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.organization.toLowerCase().includes(q) ||
      r.clearance.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <ModulePageHeader
        title="Recipient Management"
        description="Maintain authorized recipient identities, clearance levels, and distribution status for recipient-specific PDF watermarking."
      />

      {errorMsg && (
        <div className="mb-5">
          <ErrorAlert message={errorMsg} onDismiss={() => setErrorMsg(null)} />
        </div>
      )}

      {/* Add Recipient Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-5 mb-7"
      >
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Register Authorized Recipient
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full Name"
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Address"
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
          <input
            type="text"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder="Organization"
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
          <input
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Department"
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
          <select
            value={clearance}
            onChange={(e) => setClearance(e.target.value as RecipientClearance)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          >
            <option value="Security">Security</option>
            <option value="Auditor">Auditor</option>
            <option value="Legal">Legal</option>
            <option value="Executive">Executive</option>
            <option value="External Partner">External Partner</option>
          </select>
        </div>

        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional NDA / clearance notes"
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
          >
            Add Recipient
          </button>
        </div>
      </form>

      {/* Filter Bar */}
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
            placeholder="Search recipients…"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No matching recipients"
          description="Add an authorized recipient above or adjust your status filter."
        />
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Recipient</th>
                <th className="py-2.5 px-4">Organization</th>
                <th className="py-2.5 px-4">Clearance</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Issued Copies</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {filtered.map((rec) => {
                const issued = copyCountByRecipient.get(rec.id) || 0;
                return (
                  <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {rec.fullName}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {rec.email}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {rec.organization} · {rec.department}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {rec.clearance}
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel status={rec.status} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {issued}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveModule('watermarking')}
                          className="rounded-md bg-violet-600 hover:bg-violet-500 px-2.5 py-1 text-xs font-medium text-white"
                        >
                          Issue Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleRecipientStatus(rec.id)}
                          className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          {rec.status === 'Active' ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRecipient(rec.id)}
                          aria-label={`Remove ${rec.fullName}`}
                          className="rounded-md border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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

import React, { useState, useMemo } from 'react';
import { UserSummary } from '../services/reportService';
import { Search, UserCheck, Shield, ChevronDown, Check } from 'lucide-react';

interface ReportUserSelectorProps {
  roleLabel: string;
  users: UserSummary[];
  selectedUser: UserSummary | null;
  onSelectUser: (user: UserSummary) => void;
  isLoading?: boolean;
}

export const ReportUserSelector: React.FC<ReportUserSelectorProps> = ({
  roleLabel,
  users,
  selectedUser,
  onSelectUser,
  isLoading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(term) ||
        u.employee_code?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.designation?.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-500" />
            Select {roleLabel}
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
              {users.length} Available
            </span>
          </h3>
          <p className="text-xs text-zinc-500">
            Choose an authorized {roleLabel.toLowerCase()} to inspect their live activity records and generate an official PDF report.
          </p>
        </div>

        {/* Selected User Pill Indicator */}
        {selectedUser && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Selected: <strong>{selectedUser.full_name}</strong></span>
            {selectedUser.employee_code && (
              <span className="text-amber-700 font-mono">({selectedUser.employee_code})</span>
            )}
          </div>
        )}
      </div>

      {/* Search and Selection Box */}
      <div className="relative">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder={`Search ${roleLabel} by name, employee code, or email...`}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="w-full pl-9 pr-10 py-2.5 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
          />
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-600 rounded transition"
          >
            <ChevronDown className={`w-4 h-4 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Dropdown Options List */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-64 overflow-y-auto bg-white border border-zinc-200 rounded-xl shadow-lg divide-y divide-zinc-100">
            {isLoading ? (
              <div className="p-4 text-center text-xs text-zinc-500">
                Loading {roleLabel.toLowerCase()} directory...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500">
                No {roleLabel.toLowerCase()}s found matching &quot;{searchTerm}&quot;
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = selectedUser?.id === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onSelectUser(u);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`w-full text-left p-3 flex items-center justify-between transition hover:bg-zinc-50 cursor-pointer ${
                      isSelected ? 'bg-amber-50/70 border-l-4 border-amber-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-900 truncate">
                            {u.full_name}
                          </span>
                          {u.employee_code && (
                            <span className="text-[10px] font-mono bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">
                              {u.employee_code}
                            </span>
                          )}
                          {!u.is_active && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-semibold">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate flex items-center gap-2 mt-0.5">
                          <span>{u.designation || u.role}</span>
                          <span>•</span>
                          <span>{u.email}</span>
                          {u.shift && (
                            <>
                              <span>•</span>
                              <span className="capitalize">{u.shift} Shift</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

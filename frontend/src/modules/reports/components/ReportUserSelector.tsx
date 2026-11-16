import React, { useState, useMemo, useRef, useEffect } from 'react';
import { UserSummary } from '../services/reportService';
import { Search, UserCheck, ChevronDown, Check, X, Building2, Factory } from 'lucide-react';

interface ReportUserSelectorProps {
  roleLabel: string;
  users: UserSummary[];
  selectedUser: UserSummary | null;
  onSelectUser: (user: UserSummary | null) => void;
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    <div ref={containerRef} className="bg-white border-2 border-zinc-200 rounded-2xl p-5 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-zinc-950 uppercase tracking-tight flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-500" />
            Select {roleLabel}
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
              {users.length} Authorized
            </span>
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Search and select an authorized {roleLabel.toLowerCase()} to inspect their live records and generate an official summary report.
          </p>
        </div>

        {/* Selected User Pill Indicator */}
        {selectedUser ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-950 text-xs font-bold shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>
              Selected: <strong className="font-black text-zinc-950">{selectedUser.full_name}</strong>
            </span>
            {selectedUser.employee_code && (
              <span className="text-amber-800 font-mono text-[11px] bg-amber-100/70 px-1.5 py-0.5 rounded">
                {selectedUser.employee_code}
              </span>
            )}
            <button
              type="button"
              onClick={() => onSelectUser(null)}
              className="ml-1 p-0.5 text-zinc-400 hover:text-red-600 rounded transition cursor-pointer"
              title="Deselect employee"
              aria-label="Deselect employee"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-100 border border-zinc-200 rounded-xl text-zinc-500 text-xs font-medium shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            <span>No {roleLabel.toLowerCase()} selected</span>
          </div>
        )}
      </div>

      {/* Search and Selection Box */}
      <div className="relative">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder={
              selectedUser
                ? `Selected: ${selectedUser.full_name} - Click or search to change...`
                : `Search and select a ${roleLabel} by name, employee code, or email...`
            }
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="w-full pl-9 pr-10 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-amber-500 focus:bg-white transition"
          />
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg transition cursor-pointer"
            aria-label="Toggle user list"
          >
            <ChevronDown
              className={`w-4 h-4 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Dropdown Options List */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-40 max-h-72 overflow-y-auto bg-white border-2 border-zinc-200 rounded-2xl shadow-xl divide-y divide-zinc-100 animate-in fade-in zoom-in-95 duration-100">
            {isLoading ? (
              <div className="p-5 text-center text-xs text-zinc-500 font-medium">
                Loading authorized {roleLabel.toLowerCase()} directory...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-5 text-center text-xs text-zinc-500 font-medium">
                No authorized {roleLabel.toLowerCase()}s found matching &quot;{searchTerm}&quot;
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
                    className={`w-full text-left p-3.5 flex items-center justify-between transition hover:bg-zinc-50 cursor-pointer ${
                      isSelected ? 'bg-amber-50/70 border-l-4 border-amber-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 flex items-center justify-center font-black text-xs shrink-0">
                        {u.full_name ? u.full_name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-zinc-950 truncate">
                            {u.full_name}
                          </span>
                          {u.employee_code && (
                            <span className="text-[10px] font-mono font-bold bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded border border-zinc-200">
                              {u.employee_code}
                            </span>
                          )}
                          {!u.is_active && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold uppercase">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate flex items-center gap-2 mt-0.5">
                          <span>{u.designation || u.role}</span>
                          <span>&bull;</span>
                          <span>{u.email}</span>
                          {u.shift && (
                            <>
                              <span>&bull;</span>
                              <span className="capitalize">{u.shift} Shift</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center shrink-0 shadow-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
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

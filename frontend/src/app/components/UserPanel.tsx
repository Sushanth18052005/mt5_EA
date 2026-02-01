"use client";
import React, { useState, useEffect } from 'react';
import API_BASE_URL from '@/config/api';

const API_URL = API_BASE_URL; // shared base URL for all backend calls

interface UserPanelProps {
  onLogout: () => void;
}

type Screen = 'dashboard' | 'account-management' | 'portfolio' | 'profile' | 'support' | 'ib-change';

interface TradingAccount {
  account_id: string;
  broker: string;
  server: string;
  account_number_masked: string;
  account_type: string;
  current_balance: number;
  profit_since_copy_start: number;
  copy_status: string;
  status: string;
  last_sync: string;
}

interface RunningTrade {
  trade_id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  open_price: number;
  current_price: number;
  profit: number;
  open_time: string;
  account_id: string;
}

interface DashboardData {
  user_info: {
    name: string;
    email: string;
    mobile: string;
    group_name: string;
    group_join_date: string;
    kyc_status: string;
  };
  account_summary: {
    total_accounts: number;
    active_accounts: number;
    total_balance: number;
    total_profit: number;
    today_profit: number;
  };
  recent_activity: Array<{
    date: string;
    action: string;
    details: string;
    amount?: number;
  }>;
}

interface GroupSummary {
  id: string;
  group_name: string;
  company_name?: string;
  profit_sharing_percentage?: number;
  settlement_cycle?: string;
  trading_status?: string;
  total_members?: number;
  active_members?: number;
  api_key?: string;
}

export default function UserPanel({ onLogout }: UserPanelProps) {
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [runningTrades, setRunningTrades] = useState<RunningTrade[]>([]);
  const [eaStatus, setEaStatus] = useState<'active' | 'stopped'>('active');
  const [loading, setLoading] = useState(false);
  const [eaLoading, setEaLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  // Groups that user can join
  const [availableGroups, setAvailableGroups] = useState<GroupSummary[]>([]);
  const [joining, setJoining] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  // Show notification helper
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Profile form state
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileMobile, setProfileMobile] = useState('');
  const [profileCountry, setProfileCountry] = useState('');
  const [profileStateField, setProfileStateField] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChanging, setPasswordChanging] = useState(false);

  // Fetch EA status from backend
  const fetchEAStatus = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const savedStatus = localStorage.getItem('eaStatus') as 'active' | 'stopped' | null;

      if (!token) {
        if (savedStatus) setEaStatus(savedStatus);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/group/trading-controls`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // backend returned error — use saved local status if available
        if (savedStatus) setEaStatus(savedStatus);
        return;
      }

      const result = await response.json();
      if (result && result.success && result.data && result.data.trading_status) {
        const status = result.data.trading_status === 'active' ? 'active' : 'stopped';
        setEaStatus(status);
        localStorage.setItem('eaStatus', status);
      } else if (savedStatus) {
        // API succeeded but no useful data — fallback to local value
        setEaStatus(savedStatus);
      }
    } catch (error) {
      console.warn('Could not fetch EA status:', error);
      // network / parse error — fallback to localStorage
      const savedStatus = localStorage.getItem('eaStatus') as 'active' | 'stopped' | null;
      if (savedStatus) setEaStatus(savedStatus);
    }
  };

  // Toggle EA status with backend API
  const toggleEAStatus = async () => {
    if (eaLoading) return;

    const newStatus = eaStatus === 'active' ? 'stopped' : 'active';
    const action = newStatus === 'active' ? 'start' : 'stop';

    if (!confirm(`Are you sure you want to ${action} the EA?`)) {
      return;
    }

    setEaLoading(true);
    showNotification('info', `${action === 'start' ? 'Starting' : 'Stopping'} EA...`);

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/group/trading-controls/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: action,
          status: newStatus
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setEaStatus(newStatus);
        localStorage.setItem('eaStatus', newStatus);
        showNotification('success', `✅ EA has been ${newStatus === 'active' ? 'started' : 'stopped'} successfully!`);

        // Refresh data after status change
        setTimeout(() => {
          fetchEAStatus();
          // Optionally refresh page data here if needed
        }, 1000);
      } else {
        throw new Error(result.message || result.detail || 'Failed to update EA status');
      }
    } catch (error) {
      console.error('EA toggle error:', error);
      showNotification('error', `❌ Failed to ${action} EA: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // For now, simulate the change locally if API fails (for development)
      setEaStatus(newStatus);
      localStorage.setItem('eaStatus', newStatus);
      showNotification('info', `⚠️ EA ${newStatus === 'active' ? 'started' : 'stopped'} locally (API simulation)`);
    } finally {
      setEaLoading(false);
    }
  };

  // Fetch real data from backend
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const userData = localStorage.getItem('userData');

        if (!token || !userData) {
          console.error('No authentication token found');
          return;
        }

        const user = JSON.parse(userData);

        // Fetch user dashboard data
        const response = await fetch(`${API_URL}/api/v1/user/dashboard`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setDashboardData(result.data);
          }
        } else {
          // Fallback to demo data if API fails
          setDashboardData({
            user_info: {
              name: user.name || "John Doe",
              email: user.email || "john@example.com",
              mobile: user.mobile || "+1234567890",
              group_name: "Professional Traders",
              group_join_date: "2025-09-01",
              kyc_status: "verified"
            },
            account_summary: {
              total_accounts: 3,
              active_accounts: 2,
              total_balance: 26400.80,
              total_profit: 2450.80,
              today_profit: 125.50
            },
            recent_activity: [
              {
                date: "2025-09-28T14:30:00Z",
                action: "EA Executed",
                details: "EURUSD BUY 0.1 lot from Professional Traders",
                amount: 125.50
              },
              {
                date: "2025-09-28T09:15:00Z",
                action: "Account Added",
                details: "Exness account ****4567 connected successfully"
              }
            ]
          });
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Fallback to demo data on error
        const userData = localStorage.getItem('userData');
        const user = userData ? JSON.parse(userData) : {};
        setDashboardData({
          user_info: {
            name: user.name || "John Doe",
            email: user.email || "john@example.com",
            mobile: user.mobile || "+1234567890",
            group_name: "Professional Traders",
            group_join_date: "2025-09-01",
            kyc_status: "verified"
          },
          account_summary: {
            total_accounts: 3,
            active_accounts: 2,
            total_balance: 26400.80,
            total_profit: 2450.80,
            today_profit: 125.50
          },
          recent_activity: [
            {
              date: "2025-09-28T14:30:00Z",
              action: "EA Executed",
              details: "EURUSD BUY 0.1 lot from Professional Traders",
              amount: 125.50
            },
            {
              date: "2025-09-28T09:15:00Z",
              action: "Account Added",
              details: "Exness account ****4567 connected successfully"
            }
          ]
        });
      } finally {
        setLoading(false);
      }
    };

    // Also fetch accounts and trades data
    const fetchAccountsAndTrades = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const userData = localStorage.getItem('userData');

        if (!token || !userData) return;

        const user = JSON.parse(userData);

        // Fetch trading accounts
        try {
          const accountsResponse = await fetch(`${API_URL}/api/v1/user/accounts`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (accountsResponse.ok) {
            const accountsResult = await accountsResponse.json();
            if (accountsResult.success && accountsResult.data) {
              setAccounts(accountsResult.data);
            }
          }
        } catch (error) {
          console.error('Error fetching accounts:', error);
        }

        // Fetch running trades
        try {
          const tradesResponse = await fetch(`${API_URL}/api/v1/users/${user.id}/trades/running`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (tradesResponse.ok) {
            const tradesResult = await tradesResponse.json();
            if (tradesResult.success && tradesResult.data) {
              setRunningTrades(tradesResult.data);
            }
          }
        } catch (error) {
          console.error('Error fetching running trades:', error);
        }

        // If no real data available, use demo data as fallback
        setTimeout(() => {
          if (accounts.length === 0) {
            setAccounts([
              {
                account_id: "1",
                broker: "Vantage",
                server: "VantageInternational-Live",
                account_number_masked: "****1234",
                account_type: "Standard",
                current_balance: 12450.80,
                profit_since_copy_start: 850.30,
                copy_status: "active",
                status: "approved",
                last_sync: "2025-09-28T14:30:00Z"
              },
              {
                account_id: "2",
                broker: "Exness",
                server: "ExnessReal-Server",
                account_number_masked: "****4567",
                account_type: "Cent",
                current_balance: 8750.00,
                profit_since_copy_start: 1200.50,
                copy_status: "active",
                status: "approved",
                last_sync: "2025-09-28T14:25:00Z"
              },
              {
                account_id: "3",
                broker: "XM",
                server: "XM-Real",
                account_number_masked: "****9876",
                account_type: "Raw",
                current_balance: 5200.00,
                profit_since_copy_start: 400.00,
                copy_status: "pending",
                status: "pending",
                last_sync: "2025-09-27T16:00:00Z"
              }
            ]);
          }

          if (runningTrades.length === 0) {
            setRunningTrades([
              {
                trade_id: "T001",
                symbol: "EURUSD",
                type: "BUY",
                volume: 0.1,
                open_price: 1.0850,
                current_price: 1.0875,
                profit: 25.50,
                open_time: "2025-09-28T13:45:00Z",
                account_id: "1"
              },
              {
                trade_id: "T002",
                symbol: "GBPUSD",
                type: "SELL",
                volume: 0.05,
                open_price: 1.2650,
                current_price: 1.2635,
                profit: 15.75,
                open_time: "2025-09-28T14:15:00Z",
                account_id: "1"
              },
              {
                trade_id: "T003",
                symbol: "USDJPY",
                type: "BUY",
                volume: 0.2,
                open_price: 149.50,
                current_price: 149.75,
                profit: 33.45,
                open_time: "2025-09-28T11:30:00Z",
                account_id: "2"
              },
              {
                trade_id: "T004",
                symbol: "XAUUSD",
                type: "BUY",
                volume: 0.01,
                open_price: 1945.80,
                current_price: 1948.20,
                profit: 24.00,
                open_time: "2025-09-28T09:20:00Z",
                account_id: "2"
              }
            ]);
          }
        }, 1000);
      } catch (error) {
        console.error('Error in fetchAccountsAndTrades:', error);
      }
    };

    fetchDashboardData();
    fetchAccountsAndTrades();
    fetchEAStatus();
    // Group listing removed — joining is allowed only via API key per product decision.
  }, []);

  // Initialize profile form when dashboardData loads
  useEffect(() => {
    if (dashboardData && dashboardData.user_info) {
      setProfileName(dashboardData.user_info.name || '');
      setProfileEmail(dashboardData.user_info.email || '');
      setProfileMobile(dashboardData.user_info.mobile || '');
      // user_info may not include country/state in the dashboard payload; use safe access
      const ui: any = dashboardData.user_info as any;
      setProfileCountry(ui?.country || '');
      setProfileStateField(ui?.state || '');
    }
  }, [dashboardData]);

  const handleUpdateProfile = async () => {
    if (profileSaving) return;
    setProfileSaving(true);
    const token = localStorage.getItem('authToken');
    if (!token) {
      showNotification('error', 'Please login to update profile');
      setProfileSaving(false);
      return;
    }

    try {
      const body = {
        name: profileName,
        email: profileEmail,
        mobile: profileMobile,
        country: profileCountry,
        state: profileStateField
      };

      const res = await fetch(`${API_URL}/api/v1/user/profile`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await res.json();
      if (res.ok && result.success) {
        showNotification('success', 'Profile updated successfully');
        // Refresh dashboard data
        const userData = localStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          // fetch dashboard again
          const r = await fetch(`${API_URL}/api/v1/user/dashboard`, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
          if (r.ok) {
            const d = await r.json();
            if (d.success && d.data) setDashboardData(d.data);
          }
        }
      } else {
        const err = result?.detail || result?.message || 'Failed to update profile';
        showNotification('error', `❌ ${err}`);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      showNotification('error', 'Network error while updating profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordChanging) return;
    if (!currentPassword || !newPassword || newPassword !== confirmPassword) {
      showNotification('error', 'Please ensure passwords are filled and new passwords match');
      return;
    }
    setPasswordChanging(true);
    const token = localStorage.getItem('authToken');
    if (!token) {
      showNotification('error', 'Please login to change password');
      setPasswordChanging(false);
      return;
    }

    try {
      const body = { current_password: currentPassword, new_password: newPassword };
      const res = await fetch(`${API_URL}/api/v1/users/change-password`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await res.json();
      if (res.ok && result.success) {
        showNotification('success', 'Password changed successfully');
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      } else {
        const err = result?.detail || result?.message || 'Failed to change password';
        showNotification('error', `❌ ${err}`);
      }
    } catch (error) {
      console.error('Error changing password:', error);
      showNotification('error', 'Network error while changing password');
    } finally {
      setPasswordChanging(false);
    }
  };

  // Join a group by API key
  const joinByApiKey = async (apiKey?: string) => {
    if (joining) return;
    setJoining(true);
    const token = localStorage.getItem('authToken');
    if (!token) {
      showNotification('error', 'Please login to join a group.');
      setJoining(false);
      return;
    }
    try {
      const body = { api_key: apiKey || apiKeyInput };
      const res = await fetch(`${API_URL}/api/v1/groups/join-by-api-key`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await res.json();
      if (res.ok && result.success) {
        showNotification('success', `Joined group: ${result.data.group_name}`);
        // Update UI state
        setDashboardData(prev => prev ? { ...prev, user_info: { ...prev.user_info, group_name: result.data.group_name, group_join_date: result.data.join_date } } : prev);
        setApiKeyInput('');
        // Refresh groups list
        const r2 = await fetch(`${API_URL}/api/v1/groups/list?status=all`, {
          headers: token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
        });
        if (r2.ok) {
          const d2 = await r2.json();
          if (d2.success && d2.data && d2.data.groups) {
            const groups: GroupSummary[] = d2.data.groups.map((g: any) => ({
              id: g.id,
              group_name: g.group_name,
              company_name: g.company_name,
              profit_sharing_percentage: g.profit_sharing_percentage,
              settlement_cycle: g.settlement_cycle,
              trading_status: g.trading_status,
              total_members: g.total_members,
              active_members: g.active_members,
              api_key: g.api_key
            }));
            setAvailableGroups(groups);
          }
        }
      } else {
        const err = result?.detail || result?.message || 'Failed to join group';
        showNotification('error', `❌ ${err}`);
      }
    } catch (error) {
      console.error('Error joining group:', error);
      showNotification('error', 'Network error while joining group');
    } finally {
      setJoining(false);
    }
  };

  const showScreen = (screenId: Screen) => {
    setCurrentScreen(screenId);
  };

  const renderSidebar = () => (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>EA Trading Platform</h3>
        <p>Member Portal</p>
      </div>
      <nav className="sidebar-nav">
        <a
          href="#"
          className={`nav-item ${currentScreen === 'dashboard' ? 'active' : ''}`}
          onClick={() => showScreen('dashboard')}
        >
          <div className="nav-icon">📊</div>
          Dashboard
        </a>
        <a
          href="#"
          className={`nav-item ${currentScreen === 'account-management' ? 'active' : ''}`}
          onClick={() => showScreen('account-management')}
        >
          <div className="nav-icon">🏦</div>
          Account Management
        </a>
        <a
          href="#"
          className={`nav-item ${currentScreen === 'portfolio' ? 'active' : ''}`}
          onClick={() => showScreen('portfolio')}
        >
          <div className="nav-icon">📈</div>
          Portfolio
        </a>
        <a
          href="#"
          className={`nav-item ${currentScreen === 'profile' ? 'active' : ''}`}
          onClick={() => showScreen('profile')}
        >
          <div className="nav-icon">👤</div>
          Profile
        </a>
        <a
          href="#"
          className={`nav-item ${currentScreen === 'support' ? 'active' : ''}`}
          onClick={() => showScreen('support')}
        >
          <div className="nav-icon">❓</div>
          Support/Help
        </a>
        <a
          href="#"
          className={`nav-item ${currentScreen === 'ib-change' ? 'active' : ''}`}
          onClick={() => showScreen('ib-change')}
        >
          <div className="nav-icon">🔄</div>
          Change Your IB
        </a>
        <a
          href="#"
          className="nav-item logout-item"
          onClick={(e) => {
            e.preventDefault();
            if (window.confirm('Are you sure you want to logout?')) {
              onLogout();
            }
          }}
        >
          <div className="nav-icon">🚪</div>
          Logout
        </a>
      </nav>
    </div>
  );

  const renderDashboard = () => (
    <div className="main-content">
      <div className="dashboard-header">
        <h1>Welcome Back, {dashboardData?.user_info.name}!</h1>
        <p>Here&apos;s an overview of your EA trading performance</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Accounts</h3>
          <div className="value">{dashboardData?.account_summary.total_accounts}</div>
          <div className="change">{dashboardData?.account_summary.active_accounts} active</div>
        </div>
        <div className="stat-card">
          <h3>Total Balance</h3>
          <div className="value">${dashboardData?.account_summary.total_balance.toLocaleString()}</div>
          <div className="change">Across all accounts</div>
        </div>
        <div className="stat-card">
          <h3>Total Profit</h3>
          <div className="value" style={{ color: '#10b981' }}>${dashboardData?.account_summary.total_profit.toLocaleString()}</div>
          <div className="change" style={{ color: '#10b981' }}>Since copy start</div>
        </div>
        <div className="stat-card">
          <h3>Today&apos;s P&L</h3>
          <div className="value" style={{ color: '#10b981' }}>+${dashboardData?.account_summary.today_profit.toLocaleString()}</div>
          <div className="change" style={{ color: '#10b981' }}>+2.1% today</div>
        </div>
      </div>

      {/* Join a Group card */}
      <div className="card" style={{ marginTop: '20px' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
          <h3>Join a Group</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Join a group to start copying. You can be in only one group at a time.</p>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px', color: '#6b7280' }}>
            {dashboardData?.user_info.group_name ? (
              <>You are currently in <strong>{dashboardData.user_info.group_name}</strong>.</>
            ) : (
              <>You are not part of any group yet. Pick one below to start copying trades.</>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ color: '#6b7280' }}>
              For security and consistency, joining groups is allowed only via API key. Enter the group's API key below and click "Join by API Key".
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="Enter group API key" style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb' }} />
            <button className="btn btn-primary" onClick={() => joinByApiKey()} disabled={joining}>{joining ? 'Joining...' : 'Join by API Key'}</button>
          </div>
        </div>
      </div>

      {/* EA Control Panel */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
          <h3>EA Trading Control</h3>
        </div>
        <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
                EA Status:
                <span style={{
                  color: eaStatus === 'active' ? '#10b981' : '#ef4444',
                  marginLeft: '8px'
                }}>
                  {eaStatus === 'active' ? '🟢 ACTIVE' : '🔴 STOPPED'}
                </span>
              </span>
            </div>
            {/** Show total as number of approved accounts for clarity */}
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              {accounts.filter(acc => acc.status === 'approved').length} Accounts • {accounts.filter(acc => acc.status === 'approved').length} Active
              <div style={{ marginTop: '6px', fontSize: '13px' }}>
                {eaStatus === 'active'
                  ? 'EA is running and copying trades from Professional Traders'
                  : 'EA is stopped - no new trades will be copied'}
              </div>
            </div>
          </div>
          <button
            className={`btn ${eaStatus === 'active' ? 'btn-outline' : 'btn-primary'}`}
            onClick={toggleEAStatus}
            disabled={eaLoading || !dashboardData?.user_info?.group_name || accounts.filter(acc => acc.status === 'approved').reduce((s, a) => s + (a.current_balance || 0), 0) < 20}
            style={{
              padding: '15px 30px',
              fontSize: '16px',
              fontWeight: 'bold',
              minWidth: '150px',
              backgroundColor: eaLoading ? '#9ca3af' : (eaStatus === 'active' ? '#ef4444' : '#10b981'),
              color: 'white',
              border: 'none',
              cursor: eaLoading ? 'not-allowed' : 'pointer',
              opacity: eaLoading ? 0.7 : 1
            }}
          >
            {eaLoading
              ? '⏳ Processing...'
              : (eaStatus === 'active' ? '🛑 STOP EA' : '▶️ START EA')
            }
          </button>
        </div>
      </div>

      {/* Running Trades */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Current Running Trades</h3>
            <div style={{
              background: '#f0f9ff',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '14px',
              color: '#0369a1',
              fontWeight: 'bold'
            }}>
              {runningTrades.length} Active Trades
            </div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {runningTrades.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Type</th>
                  <th>Volume</th>
                  <th>Open Price</th>
                  <th>Current Price</th>
                  <th>Profit/Loss</th>
                  <th>Open Time</th>
                  <th>Account</th>
                </tr>
              </thead>
              <tbody>
                {runningTrades.map((trade, index) => (
                  <tr key={index}>
                    <td style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{trade.symbol}</td>
                    <td>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: 'white',
                        backgroundColor: trade.type === 'BUY' ? '#10b981' : '#ef4444'
                      }}>
                        {trade.type}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{trade.volume}</td>
                    <td style={{ fontFamily: 'monospace' }}>{trade.open_price.toFixed(5)}</td>
                    <td style={{ fontFamily: 'monospace' }}>{trade.current_price.toFixed(5)}</td>
                    <td style={{
                      fontWeight: 'bold',
                      color: trade.profit >= 0 ? '#10b981' : '#ef4444'
                    }}>
                      {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {new Date(trade.open_time).toLocaleString()}
                    </td>
                    <td>
                      {accounts.find(acc => acc.account_id === trade.account_id)?.account_number_masked || 'Unknown'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>💤</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>No Running Trades</div>
              <div>All positions are currently closed</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="card">
          <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
            <h3>Recent Activity</h3>
          </div>
          <div style={{ padding: '20px' }}>
            {dashboardData?.recent_activity.map((activity, index) => (
              <div key={index} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: index < dashboardData.recent_activity.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong>{activity.action}</strong>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      {new Date(activity.date).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '14px', marginTop: '4px' }}>{activity.details}</div>
                  </div>
                  {activity.amount && (
                    <div style={{ fontSize: '14px', color: activity.amount > 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                      {activity.amount > 0 ? '+' : ''}${activity.amount}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
            <h3>Account Performance</h3>
          </div>
          <div style={{ padding: '20px' }}>
            {accounts.filter(acc => acc.status === 'approved').map((account, index) => (
              <div key={index} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: index < accounts.filter(acc => acc.status === 'approved').length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontWeight: 'bold' }}>{account.broker} {account.account_number_masked}</span>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{account.account_type}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold' }}>${account.current_balance.toLocaleString()}</div>
                    <div style={{ fontSize: '12px', color: '#10b981' }}>
                      +${account.profit_since_copy_start.toLocaleString()} profit
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
          <h3>Group Information</h3>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Group Name</label>
              <div style={{ fontWeight: 'bold', marginTop: '4px' }}>{dashboardData?.user_info.group_name}</div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>Join Date</label>
              <div style={{ fontWeight: 'bold', marginTop: '4px' }}>
                {dashboardData?.user_info.group_join_date ? new Date(dashboardData.user_info.group_join_date).toLocaleDateString() : 'N/A'}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>KYC Status</label>
              <div style={{ marginTop: '4px' }}>
                <span className={`status-badge ${dashboardData?.user_info.kyc_status === 'verified' ? 'status-active' : 'status-pending'}`}>
                  {dashboardData?.user_info.kyc_status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAccountManagement = () => (
    <div className="main-content">
      <div className="dashboard-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Account Management</h1>
            <p>Manage your trading accounts and copy settings</p>
          </div>
          <button className="btn btn-primary">+ Add New Account</button>
        </div>
      </div>

      <div className="account-list">
        {accounts.map((account, index) => (
          <div key={index} className="account-item">
            <div className="account-info">
              <div className="account-avatar">{account.broker.substring(0, 2).toUpperCase()}</div>
              <div className="account-details">
                <h4>{account.broker} {account.account_number_masked}</h4>
                <p>{account.account_type} • {account.server}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 'bold' }}>${account.current_balance.toLocaleString()}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Balance</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 'bold', color: account.profit_since_copy_start >= 0 ? '#10b981' : '#ef4444' }}>
                  {account.profit_since_copy_start >= 0 ? '+' : ''}${account.profit_since_copy_start.toLocaleString()}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Profit</div>
              </div>
              <span className={`status-badge ${account.status === 'approved' ? 'status-active' : 'status-pending'}`}>
                {account.status}
              </span>
              <span className={`status-badge ${account.copy_status === 'active' ? 'status-active' : 'status-pending'}`}>
                Copy: {account.copy_status}
              </span>
              <div className="account-actions">
                <button className="btn btn-outline btn-sm">Settings</button>
                <button className="btn btn-outline btn-sm">View Details</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
        <div className="card">
          <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
            <h3>Copy Settings</h3>
          </div>
          <div style={{ padding: '20px' }}>
            <div className="form-group">
              <label>Default Lot Multiplier</label>
              <select>
                <option>0.1x (10%)</option>
                <option>0.5x (50%)</option>
                <option>1x (100%)</option>
                <option>2x (200%)</option>
                <option>5x (500%)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Max Daily Loss (%)</label>
              <input type="number" defaultValue="5" min="1" max="50" />
            </div>

            <div className="form-group">
              <label>Risk Management</label>
              <div style={{ marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', fontWeight: 'normal' }}>
                  <input type="checkbox" style={{ marginRight: '8px' }} defaultChecked />
                  Copy Stop Loss
                </label>
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', fontWeight: 'normal' }}>
                  <input type="checkbox" style={{ marginRight: '8px' }} defaultChecked />
                  Copy Take Profit
                </label>
                <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', fontWeight: 'normal' }}>
                  <input type="checkbox" style={{ marginRight: '8px' }} />
                  Auto-pause on drawdown
                </label>
              </div>
            </div>

            <button className="btn btn-primary">Save Settings</button>
          </div>
        </div>

        <div className="card">
          <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
            <h3>Symbol Mapping</h3>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '15px' }}>
              Configure symbol mappings for proper trade copying
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '12px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><strong>EURUSD</strong> → <strong>EURUSD</strong></div>
                <button className="btn btn-outline btn-sm">Edit</button>
              </div>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '12px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><strong>XAUUSD</strong> → <strong>GOLD</strong></div>
                <button className="btn btn-outline btn-sm">Edit</button>
              </div>
            </div>

            <button className="btn btn-outline" style={{ width: '100%', marginTop: '10px' }}>
              + Add Mapping
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPortfolio = () => (
    <div className="main-content">
      <div className="dashboard-header">
        <h1>Portfolio</h1>
        <p>Your trading performance and trade history</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Return</h3>
          <div className="value" style={{ color: '#10b981' }}>+$2,450.80</div>
          <div className="change" style={{ color: '#10b981' }}>+12.5% overall</div>
        </div>
        <div className="stat-card">
          <h3>Win Rate</h3>
          <div className="value">74%</div>
          <div className="change">23 wins / 31 trades</div>
        </div>
        <div className="stat-card">
          <h3>Best Trade</h3>
          <div className="value" style={{ color: '#10b981' }}>+$245.60</div>
          <div className="change">XAUUSD on Sep 25</div>
        </div>
        <div className="stat-card">
          <h3>Avg. Trade</h3>
          <div className="value" style={{ color: '#10b981' }}>+$79.06</div>
          <div className="change">Per closed trade</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="card">
          <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
            <h3>Daily P&L Chart</h3>
          </div>
          <div style={{ padding: '20px', height: '200px', background: '#f8fafc', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#6b7280' }}>P&L Chart would be rendered here</div>
          </div>
        </div>

        <div className="card">
          <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
            <h3>Net Return by Account</h3>
          </div>
          <div style={{ padding: '20px' }}>
            {accounts.filter(acc => acc.status === 'approved').map((account, index) => (
              <div key={index} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: index < accounts.filter(acc => acc.status === 'approved').length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 'bold' }}>{account.broker} {account.account_number_masked}</span>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                    +${account.profit_since_copy_start.toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280' }}>
                  <span>Return %</span>
                  <span style={{ color: '#10b981' }}>
                    +{((account.profit_since_copy_start / (account.current_balance - account.profit_since_copy_start)) * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
          <h3>Trade History</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>Account</th>
                <th>Symbol</th>
                <th>Type</th>
                <th>Volume</th>
                <th>Open Price</th>
                <th>Close Price</th>
                <th>P&L</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>2025-09-28 14:30</td>
                <td>Vantage ****1234</td>
                <td>EURUSD</td>
                <td>BUY</td>
                <td>0.10</td>
                <td>1.0850</td>
                <td>1.0875</td>
                <td style={{ color: '#10b981' }}>+$125.50</td>
                <td><span className="status-badge status-active">Closed</span></td>
              </tr>
              <tr>
                <td>2025-09-28 09:15</td>
                <td>Exness ****4567</td>
                <td>XAUUSD</td>
                <td>SELL</td>
                <td>0.02</td>
                <td>2050.25</td>
                <td>2048.10</td>
                <td style={{ color: '#10b981' }}>+$86.20</td>
                <td><span className="status-badge status-active">Closed</span></td>
              </tr>
              <tr>
                <td>2025-09-27 16:45</td>
                <td>Vantage ****1234</td>
                <td>GBPUSD</td>
                <td>BUY</td>
                <td>0.15</td>
                <td>1.2650</td>
                <td>-</td>
                <td style={{ color: '#ef4444' }}>-$25.00</td>
                <td><span className="status-badge status-pending">Open</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="main-content">
      <div className="dashboard-header">
        <h1>Profile</h1>
        <p>Manage your profile information and settings</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="card">
          <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
            <h3>Personal Information</h3>
          </div>
          <div style={{ padding: '20px' }}>
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} />
            </div>

            <div className="form-group">
              <label>Mobile Number</label>
              <input type="tel" value={profileMobile} onChange={(e) => setProfileMobile(e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>Country</label>
                <select value={profileCountry} onChange={(e) => setProfileCountry(e.target.value)}>
                  <option value="">Select country</option>
                  <option>United States</option>
                  <option>United Kingdom</option>
                  <option>India</option>
                  <option>Singapore</option>
                </select>
              </div>
              <div className="form-group">
                <label>State/Province</label>
                <input type="text" value={profileStateField} onChange={(e) => setProfileStateField(e.target.value)} />
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleUpdateProfile} disabled={profileSaving}>{profileSaving ? 'Saving...' : 'Update Profile'}</button>
          </div>
        </div>

        <div className="card">
          <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
            <h3>Security Settings</h3>
          </div>
          <div style={{ padding: '20px' }}>
            <div className="form-group">
              <label>Current Password</label>
              <input type="password" placeholder="Enter current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>

            <div className="form-group">
              <label>New Password</label>
              <input type="password" placeholder="Enter new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>

            <button className="btn btn-primary" style={{ marginBottom: '20px' }} onClick={handleChangePassword} disabled={passwordChanging}>{passwordChanging ? 'Changing...' : 'Change Password'}</button>

            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '10px' }}>Two-Factor Authentication</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>2FA Status: <strong style={{ color: '#ef4444' }}>Disabled</strong></span>
                <button className="btn btn-outline btn-sm">Enable 2FA</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
          <h3>Notification Preferences</h3>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            <div>
              <h4 style={{ marginBottom: '15px' }}>Email Notifications</h4>
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', fontWeight: 'normal' }}>
                <input type="checkbox" style={{ marginRight: '12px' }} defaultChecked />
                Trade confirmations
              </label>
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', fontWeight: 'normal' }}>
                <input type="checkbox" style={{ marginRight: '12px' }} defaultChecked />
                Daily performance reports
              </label>
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', fontWeight: 'normal' }}>
                <input type="checkbox" style={{ marginRight: '12px' }} />
                Weekly summaries
              </label>
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', fontWeight: 'normal' }}>
                <input type="checkbox" style={{ marginRight: '12px' }} defaultChecked />
                Account alerts
              </label>
            </div>
            <div>
              <h4 style={{ marginBottom: '15px' }}>Push Notifications</h4>
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', fontWeight: 'normal' }}>
                <input type="checkbox" style={{ marginRight: '12px' }} defaultChecked />
                New trades copied
              </label>
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', fontWeight: 'normal' }}>
                <input type="checkbox" style={{ marginRight: '12px' }} />
                Daily loss limit reached
              </label>
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', fontWeight: 'normal' }}>
                <input type="checkbox" style={{ marginRight: '12px' }} defaultChecked />
                Group announcements
              </label>
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', fontWeight: 'normal' }}>
                <input type="checkbox" style={{ marginRight: '12px' }} />
                System maintenance
              </label>
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: '20px' }}>Save Preferences</button>
        </div>
      </div>
    </div>
  );

  const renderSupport = () => (
    <div className="main-content">
      <div className="dashboard-header">
        <h1>Support & Help</h1>
        <p>Get help and submit support tickets</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="card">
          <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
            <h3>Submit New Ticket</h3>
          </div>
          <div style={{ padding: '20px' }}>
            <div className="form-group">
              <label>Category</label>
              <select>
                <option>General Support</option>
                <option>Trading Issues</option>
                <option>Account Problems</option>
                <option>Payment/Settlement</option>
                <option>Technical Support</option>
              </select>
            </div>

            <div className="form-group">
              <label>Priority</label>
              <select>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Urgent</option>
              </select>
            </div>

            <div className="form-group">
              <label>Subject</label>
              <input type="text" placeholder="Brief description of your issue" />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                rows={5}
                placeholder="Please provide detailed information about your issue..."
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="form-group">
              <label>Attach Screenshot (Optional)</label>
              <input type="file" accept="image/*,.pdf" />
            </div>

            <button className="btn btn-primary">Submit Ticket</button>
          </div>
        </div>

        <div className="card">
          <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
            <h3>Quick Help</h3>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '10px' }}>📚 Knowledge Base</h4>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li style={{ marginBottom: '8px' }}>
                  <a href="#" style={{ color: '#3b82f6', textDecoration: 'none' }}>
                    → Getting Started with EA Trading
                  </a>
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <a href="#" style={{ color: '#3b82f6', textDecoration: 'none' }}>
                    → How to Add Trading Accounts
                  </a>
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <a href="#" style={{ color: '#3b82f6', textDecoration: 'none' }}>
                    → Understanding Risk Management
                  </a>
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <a href="#" style={{ color: '#3b82f6', textDecoration: 'none' }}>
                    → Settlement Process Guide
                  </a>
                </li>
              </ul>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '10px' }}>📞 Contact Information</h4>
              <div style={{ fontSize: '14px' }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Email:</strong> support@eatrading.com
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Phone:</strong> +1-800-123-4567
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Hours:</strong> Mon-Fri 9AM-6PM EST
                </div>
              </div>
            </div>

            <div style={{ background: '#f0f9ff', padding: '15px', borderRadius: '8px', border: '1px solid #e0f2fe' }}>
              <h4 style={{ marginBottom: '8px', color: '#0369a1' }}>💬 Live Chat</h4>
              <p style={{ fontSize: '14px', color: '#0369a1', marginBottom: '10px' }}>
                Get instant help from our support team
              </p>
              <button className="btn btn-primary btn-sm">Start Chat</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
          <h3>My Support Tickets</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Subject</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>#TKT-2025-001</td>
                <td>Issue with trade copying</td>
                <td>Trading Issues</td>
                <td><span className="status-badge" style={{ background: '#fef3c7', color: '#92400e' }}>Medium</span></td>
                <td><span className="status-badge status-pending">In Progress</span></td>
                <td>2025-09-27</td>
                <td>2025-09-28</td>
                <td>
                  <button className="btn btn-outline btn-sm">View</button>
                </td>
              </tr>
              <tr>
                <td>#TKT-2025-002</td>
                <td>Account verification help</td>
                <td>Account Problems</td>
                <td><span className="status-badge" style={{ background: '#dcfce7', color: '#166534' }}>Low</span></td>
                <td><span className="status-badge status-active">Resolved</span></td>
                <td>2025-09-25</td>
                <td>2025-09-26</td>
                <td>
                  <button className="btn btn-outline btn-sm">View</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderIBChange = () => (
    <div className="main-content">
      <div className="dashboard-header">
        <h1>Change Your IB</h1>
        <p>Change your IB to ours to enable EA trading features</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="card">
          <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
            <h3>IB Change Request</h3>
          </div>
          <div style={{ padding: '20px' }}>
            <div className="form-group">
              <label>Select Account</label>
              <select>
                <option>Select trading account...</option>
                {accounts.map((account, index) => (
                  <option key={index} value={account.account_id}>
                    {account.broker} {account.account_number_masked} ({account.account_type})
                  </option>
                ))}
              </select>
            </div>

            <div className="alert alert-info" style={{ marginBottom: '20px' }}>
              <strong>Required IB Number:</strong> IB123456789
              <br />
              <small>You must change your IB to this specific number to enable EA features.</small>
            </div>

            <div className="form-group">
              <label>New IB Code/ID</label>
              <input
                type="text"
                value="IB123456789"
                readOnly
                style={{ backgroundColor: '#f9fafb', color: '#6b7280' }}
              />
              <small style={{ color: '#6b7280', fontSize: '12px' }}>
                This is our required IB number. Use this in your broker account.
              </small>
            </div>

            <div className="form-group">
              <label>IB Change Proof</label>
              <input type="file" accept="image/*,.pdf" />
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Upload screenshot or document proving IB change completion
              </div>
            </div>

            <div className="form-group">
              <label>Additional Notes</label>
              <textarea
                rows={3}
                placeholder="Any additional information about the IB change..."
                style={{ resize: 'vertical' }}
              />
            </div>

            <button className="btn btn-primary">Submit IB Change Request</button>
          </div>
        </div>

        <div className="card">
          <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
            <h3>IB Change Guides</h3>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '10px' }}>📋 Step-by-Step Guides</h4>

              <div style={{ marginBottom: '15px' }}>
                <button
                  className="btn btn-primary"
                  style={{ marginBottom: '10px' }}
                  onClick={() => alert('Demo: This would show a popup with step-by-step images for IB change process')}
                >
                  📸 Show Steps with Images
                </button>
                <br />
                <small style={{ color: '#6b7280' }}>
                  View detailed screenshots for changing IB number to IB123456789
                </small>
              </div>

              <div style={{ fontSize: '14px' }}>
                <div style={{ marginBottom: '12px', padding: '12px', background: '#f8fafc', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>🔸 Exness</div>
                  <div style={{ color: '#6b7280' }}>Login → Partner Settings → Change IB → Enter IB123456789 → Verify OTP</div>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ marginTop: '8px' }}
                    onClick={() => alert('Demo: Exness IB change steps with screenshots would open here')}
                  >
                    View Guide Images
                  </button>
                </div>

                <div style={{ marginBottom: '12px', padding: '12px', background: '#f8fafc', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>🔸 Vantage</div>
                  <div style={{ color: '#6b7280' }}>Email support with account details and new IB ID: IB123456789</div>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ marginTop: '8px' }}
                    onClick={() => alert('Demo: Vantage IB change steps with screenshots would open here')}
                  >
                    View Guide Images
                  </button>
                </div>

                <div style={{ marginBottom: '12px', padding: '12px', background: '#f8fafc', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>🔸 XM</div>
                  <div style={{ color: '#6b7280' }}>Login → My Account → IB Settings → Request Change → Enter IB123456789</div>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ marginTop: '8px' }}
                    onClick={() => alert('Demo: XM IB change steps with screenshots would open here')}
                  >
                    View Guide Images
                  </button>
                </div>

                <div style={{ marginBottom: '12px', padding: '12px', background: '#f8fafc', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>🔸 IC Markets</div>
                  <div style={{ color: '#6b7280' }}>Client Portal → Account Settings → IB Change → Submit Request with IB123456789</div>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ marginTop: '8px' }}
                    onClick={() => alert('Demo: IC Markets IB change steps with screenshots would open here')}
                  >
                    View Guide Images
                  </button>
                </div>

                <div style={{ marginBottom: '12px', padding: '12px', background: '#f8fafc', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>🔸 Pepperstone</div>
                  <div style={{ color: '#6b7280' }}>MyPepperstone → Account Management → Change IB → Enter IB123456789</div>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ marginTop: '8px' }}
                    onClick={() => alert('Demo: Pepperstone IB change steps with screenshots would open here')}
                  >
                    View Guide Images
                  </button>
                </div>
              </div>
            </div>

            <div style={{ background: '#fee2e2', padding: '15px', borderRadius: '8px', border: '1px solid #ef4444' }}>
              <h4 style={{ marginBottom: '8px', color: '#dc2626' }}>🚨 Critical Requirements</h4>
              <ul style={{ fontSize: '14px', color: '#dc2626', marginBottom: 0, paddingLeft: '20px' }}>
                <li><strong>EA features are blocked until IB change is completed and approved</strong></li>
                <li>You must change to our IB number: <strong>IB123456789</strong></li>
                <li>Upload screenshot proof after changing IB</li>
                <li>Admin approval required before EA activation</li>
                <li>IB changes may take 24-48 hours to process with your broker</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
          <h3>IB Change History</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Account</th>
                <th>Broker</th>
                <th>New IB ID</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>#IB-2025-001</td>
                <td>****1234</td>
                <td>Vantage</td>
                <td>VT-NEW-123</td>
                <td><span className="status-badge status-pending">Pending</span></td>
                <td>2025-09-27</td>
                <td>2025-09-27</td>
                <td>
                  <button className="btn btn-outline btn-sm">View</button>
                </td>
              </tr>
              <tr>
                <td>#IB-2025-002</td>
                <td>****4567</td>
                <td>Exness</td>
                <td>EX-PART-456</td>
                <td><span className="status-badge status-active">Completed</span></td>
                <td>2025-09-20</td>
                <td>2025-09-22</td>
                <td>
                  <button className="btn btn-outline btn-sm">View</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return renderDashboard();
      case 'account-management':
        return renderAccountManagement();
      case 'portfolio':
        return renderPortfolio();
      case 'profile':
        return renderProfile();
      case 'support':
        return renderSupport();
      case 'ib-change':
        return renderIBChange();
      default:
        return renderDashboard();
    }
  };

  // Notification Component
  const NotificationComponent = () => {
    if (!notification) return null;

    const bgColor = notification.type === 'success' ? '#dcfce7' :
      notification.type === 'error' ? '#fef2f2' : '#eff6ff';
    const textColor = notification.type === 'success' ? '#166534' :
      notification.type === 'error' ? '#dc2626' : '#1d4ed8';

    return (
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: bgColor,
        color: textColor,
        padding: '12px 20px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        zIndex: 10000,
        maxWidth: '400px',
        border: `1px solid ${notification.type === 'success' ? '#bbf7d0' :
          notification.type === 'error' ? '#fecaca' : '#bfdbfe'}`
      }}>
        {notification.message}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <NotificationComponent />
      {renderSidebar()}
      {renderCurrentScreen()}

      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px' }}>
            Loading...
          </div>
        </div>
      )}

      {/* Screen Selector for Demo */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000
      }}>
        <select
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white' }}
          value={currentScreen}
          onChange={(e) => showScreen(e.target.value as Screen)}
        >
          <option value="dashboard">Dashboard</option>
          <option value="account-management">Account Management</option>
          <option value="portfolio">Portfolio</option>
          <option value="profile">Profile</option>
          <option value="support">Support/Help</option>
          <option value="ib-change">Change Your IB</option>
        </select>
      </div>
    </div>
  );
}
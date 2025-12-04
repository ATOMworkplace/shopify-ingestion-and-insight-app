'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import Pusher from 'pusher-js'; 
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer 
} from 'recharts';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [shopUrl, setShopUrl] = useState('');
  const [toast, setToast] = useState(null);

  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      start: firstDay.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    };
  });
  
  const router = useRouter();
  const searchParams = useSearchParams();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);

      const res = await api.get('/data/stats', {
        params: { startDate: dateRange.start, endDate: dateRange.end }
      });
      
      const cleanData = {
        ...res.data,
        chartData: (res.data.chartData || []).map(item => ({
          ...item,
          sales: Number(item.sales || 0),
          orders: Number(item.orders || 0)
        }))
      };

      setData(cleanData);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) router.push('/');
      else console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(); 

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER
    });

    const channel = pusher.subscribe('shop-updates');

    channel.bind('order-synced', (data) => {
        showToast('New Order Received! 🔔', 'success');
        fetchData(true); 
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
    };
  }, [dateRange]);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const synced = searchParams.get('synced');
    if (connected === 'true' && synced === 'true') showToast('Store connected & synced!', 'success');
    if (searchParams.get('error')) showToast('Connection failed.', 'error');
  }, [searchParams]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post('/data/sync');
      await fetchData(false);
      showToast('Data synced successfully!', 'success');
    } catch (err) {
      showToast('Sync failed: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleConnect = () => {
    if(!shopUrl) return showToast("Enter shop domain", 'error');
    const cleanShop = shopUrl.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const token = localStorage.getItem('gj_token');
    if (!token) return router.push('/');
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/shopify/install?shop=${cleanShop}&token=${token}`;
  };

  const bentoCard = "bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow duration-300";

  if (loading && !data) return (
    <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center">
      <div className="text-gray-400 font-medium animate-pulse text-lg tracking-tight">Loading Dashboard...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#111111] font-sans p-6 md:p-10">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-black mb-1">Financial Dashboard</h1>
          {data?.isConnected && (
            <p className="text-gray-400 text-sm font-medium">{data.shopDomain}</p>
          )}
        </div>

        {data?.isConnected && (
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-white rounded-full px-2 py-2 shadow-sm border border-gray-100">
              <input 
                type="date" 
                className="bg-transparent text-gray-600 text-sm font-medium border-none focus:outline-none px-2"
                value={dateRange.start} 
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} 
              />
              <span className="text-gray-300 text-xs mx-1">to</span>
              <input 
                type="date" 
                className="bg-transparent text-gray-600 text-sm font-medium border-none focus:outline-none px-2"
                value={dateRange.end} 
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} 
              />
            </div>

            <button 
              onClick={handleSync} 
              disabled={syncing}
              className="bg-[#F04D28] hover:bg-[#D63E1C] text-white px-8 py-3 rounded-full text-sm font-bold shadow-lg shadow-orange-500/20 transition-all flex items-center"
            >
              {syncing ? 'Syncing...' : 'Sync Data'}
              <span className="ml-2 text-lg">→</span>
            </button>
            
            <button 
               onClick={() => { localStorage.clear(); router.push('/'); }} 
               className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
               title="Logout"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {!data?.isConnected ? (
        <div className="max-w-xl mx-auto mt-20">
          <div className={`${bentoCard} text-center py-16`}>
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">🛍️</span>
            </div>
            <h2 className="text-3xl font-bold mb-4">Connect Store</h2>
            <p className="text-gray-400 mb-8 max-w-sm mx-auto leading-relaxed">
              Enter your Shopify domain to visualize your financial data.
            </p>
            <div className="flex flex-col gap-4 max-w-sm mx-auto w-full">
              <input 
                type="text" placeholder="store.myshopify.com" 
                className="bg-gray-50 text-black text-lg p-4 rounded-2xl border-none focus:ring-2 focus:ring-orange-100 focus:outline-none w-full text-center placeholder:text-gray-300"
                value={shopUrl} onChange={(e) => setShopUrl(e.target.value)}
              />
              <button 
                onClick={handleConnect} 
                className="bg-black text-white py-4 rounded-2xl font-bold text-lg hover:bg-gray-800 transition-all w-full"
              >
                Connect Now
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 auto-rows-[minmax(180px,auto)]">
          
          <div className={`${bentoCard} md:col-span-2 relative overflow-hidden`}>
            <div className="flex justify-between items-start z-10">
              <span className="text-gray-400 font-medium text-sm">Total Revenue</span>
              <span className="bg-green-50 text-green-600 px-3 py-1 rounded-full text-xs font-bold">+12%</span>
            </div>
            <div className="mt-4 z-10">
              <h3 className="text-5xl font-bold tracking-tight text-black">
                ${(data.stats?.totalSales || 0).toLocaleString()}
              </h3>
            </div>
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-orange-50 rounded-full opacity-50 z-0 pointer-events-none"></div>
          </div>

          <div className={bentoCard}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 font-medium text-sm">Total Orders</span>
              <div className="w-2 h-2 rounded-full bg-black"></div>
            </div>
            <h3 className="text-4xl font-bold text-black mt-auto">
              {data.stats?.orderCount || 0}
            </h3>
          </div>

          <div className={bentoCard}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 font-medium text-sm">Avg. Order</span>
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            </div>
            <h3 className="text-4xl font-bold text-black mt-auto">
              ${(data.stats?.avgOrderValue || 0).toFixed(0)}
            </h3>
          </div>

          <div className={`${bentoCard} md:col-span-2 md:row-span-2`}>
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold">Sales Activity</h3>
              <select className="bg-gray-50 border-none rounded-lg text-xs font-bold px-3 py-2 text-gray-500 cursor-pointer focus:outline-none">
                <option>2025</option>
              </select>
            </div>
            <div className="h-[250px] w-full mt-auto">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.chartData || []}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F04D28" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#F04D28" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#F04D28" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${bentoCard} md:col-span-2 md:row-span-2`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Top Customers</h3>
              <button className="text-gray-400 hover:text-black text-xl">•••</button>
            </div>
            
            <div className="flex flex-col gap-4 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
              {data.topCustomers?.length > 0 ? data.topCustomers.map((c, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 group-hover:bg-black group-hover:text-white transition-colors">
                      {c.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-black">{c.email?.split('@')[0]}</p>
                      <p className="text-xs text-gray-400">{c.ordersCount || 0} Orders</p>
                    </div>
                  </div>
                  <span className="font-bold text-sm text-black group-hover:text-[#F04D28] transition-colors">
                    ${(c.totalSpent || 0).toFixed(2)}
                  </span>
                </div>
              )) : (
                <div className="text-center text-gray-400 py-10 text-sm">No customers found</div>
              )}
            </div>
          </div>

          <div className={`${bentoCard} md:col-span-2`}>
             <div className="flex justify-between items-center mb-4">
              <span className="text-gray-400 font-medium text-sm">Order Volume</span>
            </div>
            <div className="h-[100px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.chartData || []}>
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={[0, 'dataMax + 5']} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="orders" fill="#111111" radius={[4, 4, 4, 4]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

      {toast && (
        <div className={`fixed bottom-8 right-8 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-up z-50 ${toast.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-black text-white'}`}>
          <div className={`w-2 h-2 rounded-full ${toast.type === 'error' ? 'bg-red-500' : 'bg-[#F04D28]'}`}></div>
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}

    </div>
  );
}